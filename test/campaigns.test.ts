import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestMiniflare } from "./helpers/miniflareSetup";
import { Db } from "../src/db/client";
import { ConversationsRepo } from "../src/db/conversations";
import { LeadsRepo } from "../src/db/leads";
import { RealtorRepo } from "../src/db/realtor";

// Capturamos free-forms sin red
const freeformSends = vi.hoisted(() => [] as { userId: string; text: string }[]);
vi.mock("../src/replies/sender", () => ({
  pickAdapter: () => ({
    sendReply: async (r: { channelUserId: string; chunks: string[] }) => {
      freeformSends.push({ userId: r.channelUserId, text: r.chunks[0] });
    },
  }),
  sendChunkedReply: async () => {},
}));

import { segmentMembers, segmentCounts } from "../src/segments";
import { sendCampaign, templatesSentLast24h } from "../src/campaigns";

let env: any;
let db: Db;
const NOW = 1_700_000_000_000;
const H = 3600_000;

// Plantillas via fetch → stub global
const templateCalls: string[] = [];

async function seedConv(userId: string, lastMsgAt: number) {
  const conv = await new ConversationsRepo(db).getOrCreate("twilio", userId);
  await db.run(
    `INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', 'hola', ?)`,
    [crypto.randomUUID(), conv.id, lastMsgAt],
  );
  return conv;
}

beforeEach(async () => {
  const mf = await createTestMiniflare();
  const d1 = await mf.getD1Database("DB");
  env = {
    DB: d1,
    TWILIO_ACCOUNT_SID: "ACtest",
    TWILIO_AUTH_TOKEN: "tok",
    TWILIO_WA_FROM: "+15550001111",
  };
  db = new Db(d1 as any);
  freeformSends.length = 0;
  templateCalls.length = 0;
  vi.stubGlobal("fetch", async (url: any) => {
    templateCalls.push(String(url));
    return new Response("{}", { status: 201 });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("segments", () => {
  it("segmenta buyer y sellers usando el pipeline Realtor", async () => {
    const a = await seedConv("+521111", NOW - 2 * H);
    const b = await seedConv("+522222", NOW - 2 * H);
    await seedConv("+523333", NOW - 30 * H); // solo conversó, fuera de ventana
    const leads = new LeadsRepo(db);
    const realtor = new RealtorRepo(db);
    const buyerLead = await leads.create({ conversationId: a.id, channelUserId: "+521111", intent: "buyer" });
    const sellerLead = await leads.create({ conversationId: b.id, channelUserId: "+522222", intent: "seller" });
    await realtor.attachLead({ leadId: buyerLead, kind: "buyer", score: 70, reason: "test", source: "test", nextAction: "call", tags: ["buyer", "hot"] });
    await realtor.attachLead({ leadId: sellerLead, kind: "seller", score: 40, reason: "test", source: "test", nextAction: "call", tags: ["seller", "warm"] });

    const buyers = await segmentMembers(db, "buyer_ready", NOW);
    expect(buyers.map((m) => m.channelUserId)).toEqual(["+521111"]);
    expect(buyers[0].inWindow).toBe(true);

    const sellers = await segmentMembers(db, "seller_valuation", NOW);
    expect(sellers.map((m) => m.channelUserId)).toEqual(["+522222"]);

    const todos = await segmentCounts(db, NOW);
    const t = todos.find((s) => s.id === "all_conversations")!;
    expect(t.total).toBe(3);
    expect(t.inWindow).toBe(2);
    expect(t.outWindow).toBe(1);
  });

  it("segmenta prioridad hot desde las etiquetas Realtor", async () => {
    const a = await seedConv("+524444", NOW - 1 * H);
    const lead = await new LeadsRepo(db).create({ conversationId: a.id, channelUserId: "+524444", intent: "buyer" });
    await new RealtorRepo(db).attachLead({ leadId: lead, kind: "buyer", score: 80, reason: "test", source: "test", nextAction: "call", tags: ["buyer", "hot"] });
    expect((await segmentMembers(db, "hot", NOW)).length).toBe(1);
    expect((await segmentMembers(db, "warm", NOW)).length).toBe(0);
  });
});

describe("sendCampaign", () => {
  it("free-form a los de ventana, plantilla a los de fuera; reintento no duplica", async () => {
    await seedConv("+521111", NOW - 2 * H); // en ventana
    await seedConv("+523333", NOW - 30 * H); // fuera

    const r1 = await sendCampaign(env, {
      segmentId: "all_conversations",
      campaignKey: "test-camp",
      freeformText: "hola en ventana",
      template: { sid: "HX123", body: "Hola {{1}}, ¿vienes hoy? Responde SÍ", variables: { "1": "crack" } },
      now: NOW,
    });
    expect(r1.sentFreeform).toBe(1);
    expect(r1.sentTemplate).toBe(1);
    expect(freeformSends[0]).toEqual({ userId: "+521111", text: "hola en ventana" });
    expect(templateCalls.some((u) => u.includes("api.twilio.com"))).toBe(true);
    expect(await templatesSentLast24h(db, NOW)).toBe(1);

    // El historial guarda el TEXTO de la plantilla (con variables) — el agente
    // necesita ese contexto cuando el cliente responda "SÍ".
    const persisted = await db.first<{ content: string }>(
      `SELECT m.content FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.channel_user_id = '+523333' AND m.role = 'assistant'`,
    );
    expect(persisted?.content).toBe("Hola crack, ¿vienes hoy? Responde SÍ");

    // Reintento: mismo campaignKey → todos saltados
    const r2 = await sendCampaign(env, {
      segmentId: "all_conversations",
      campaignKey: "test-camp",
      freeformText: "hola en ventana",
      template: { sid: "HX123" },
      now: NOW,
    });
    expect(r2.sentFreeform + r2.sentTemplate).toBe(0);
    expect(r2.skippedDuplicate).toBe(2);
  });

  it("respeta el tope diario de plantillas", async () => {
    await seedConv("+525555", NOW - 30 * H);
    await seedConv("+526666", NOW - 40 * H);
    const r = await sendCampaign(
      { ...env, WA_DAILY_TEMPLATE_CAP: "1" },
      { segmentId: "all_conversations", campaignKey: "cap-test", template: { sid: "HX9" }, now: NOW },
    );
    expect(r.sentTemplate).toBe(1);
    expect(r.skippedQuota).toBe(1);
  });

  it("sin plantilla dada, los de fuera de ventana no reciben nada", async () => {
    await seedConv("+527777", NOW - 30 * H);
    const r = await sendCampaign(env, {
      segmentId: "all_conversations",
      campaignKey: "solo-ff",
      freeformText: "hola",
      now: NOW,
    });
    expect(r.sentFreeform).toBe(0);
    expect(r.sentTemplate).toBe(0);
  });
});
