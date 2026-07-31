import { describe, it, expect, beforeEach } from "vitest";
import { createTestMiniflare } from "../helpers/miniflareSetup";
import { Db } from "../../src/db/client";
import { LeadsRepo } from "../../src/db/leads";
import { RealtorRepo } from "../../src/db/realtor";

let db: Db;
let leads: LeadsRepo;
let realtor: RealtorRepo;

beforeEach(async () => {
  const mf = await createTestMiniflare();
  db = new Db((await mf.getD1Database("DB")) as any);
  leads = new LeadsRepo(db);
  realtor = new RealtorRepo(db);
});

describe("RealtorRepo", () => {
  it("initializes buyer, seller and renter pipelines", async () => {
    const pipelines = await realtor.pipelines();
    expect(pipelines.map((p) => p.kind)).toEqual(["buyer", "seller", "renter"]);
    expect(pipelines[0].stages[0].name).toBe("Nuevo");
  });

  it("attaches a lead with tags and moves it only inside its pipeline", async () => {
    const leadId = await leads.create({ conversationId: null, channelUserId: null, name: "Ana", intent: "Buyer in Miami" });
    await realtor.attachLead({ leadId, kind: "buyer", score: 70, reason: "budget + preapproval", tags: ["buyer", "hot", "preapproved"] });
    const buyer = (await realtor.pipelines()).find((p) => p.kind === "buyer")!;
    const cards = await realtor.cards(buyer.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].score).toBe(70);
    expect(cards[0].tags).toContain("hot");
    expect(await realtor.moveLead(leadId, buyer.stages[1].id)).toBe(true);
    expect(await realtor.moveLead(leadId, "realtor-seller-1")).toBe(false);
  });
});
