import { Db } from "../db/client";
import type { Env } from "../env";
import { LeadsRepo } from "../db/leads";
import { RealtorRepo, type RealtorPipelineKind } from "../db/realtor";
import { scoreRealEstateLead } from "../tools/qualifyRealEstateLead";
import { sendKapsoButtons } from "../channels/kapso";

type Intake = { conversation_id: string; step: string; name: string | null; contact: string | null; operation: string | null; area: string | null; budget: string | null; timeline: string | null; preapproved: string | null };

async function save(db: Db, conversationId: string, patch: Partial<Intake> & { step: string }) {
  const prev = await db.first<Intake>("SELECT * FROM realtor_intakes WHERE conversation_id = ?", [conversationId]);
  const next = { ...prev, ...patch, conversation_id: conversationId } as Intake;
  await db.run(`INSERT OR REPLACE INTO realtor_intakes (conversation_id, step, name, contact, operation, area, budget, timeline, preapproved, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [conversationId, next.step, next.name ?? null, next.contact ?? null, next.operation ?? null, next.area ?? null, next.budget ?? null, next.timeline ?? null, next.preapproved ?? null, Date.now()]);
}

export async function runRealtorIntake(input: { env: Env; db: Db; conversationId: string; channelUserId: string; text: string; reply: (text: string) => Promise<void> }): Promise<boolean> {
  const { env, db, conversationId, channelUserId, text, reply } = input;
  const current = await db.first<Intake>("SELECT * FROM realtor_intakes WHERE conversation_id = ?", [conversationId]);
  if (!current) {
    await save(db, conversationId, { step: "name" });
    await reply("Hola, soy el asistente virtual de Jorge Cruz Leal P.A., REALTOR® de Real Estate Empire Group. Jorge ha trabajado recientemente con compradores y sellers en Miami y Hialeah. ¿Con quién tengo el gusto?");
    return true;
  }
  if (current.step === "name") {
    await save(db, conversationId, { ...current, step: "phone", name: text.trim() });
    await reply("Mucho gusto, " + text.trim() + ". ¿Cuál es el mejor número de teléfono para contactarte si Jorge o su equipo necesita coordinar contigo?");
    return true;
  }
  if (current.step === "phone") {
    await save(db, conversationId, { ...current, step: "operation", contact: text.trim() });
    await sendKapsoButtons(channelUserId, "Gracias. ¿Cómo te puede ayudar Jorge hoy?", [{ id: "buyer", title: "Comprar" }, { id: "seller", title: "Vender" }, { id: "renter", title: "Rentar" }], env);
    return true;
  }
  if (current.step === "operation") {
    const normalized = text.toLowerCase();
    const operation = normalized.includes("vend") ? "seller" : normalized.includes("rent") || normalized.includes("alquil") ? "renter" : "buyer";
    await save(db, conversationId, { ...current, step: "area", operation });
    await sendKapsoButtons(channelUserId, operation === "seller" ? "Perfecto. ¿En qué zona está la propiedad?" : operation === "renter" ? "Perfecto. ¿En qué zona te gustaría rentar?" : "Perfecto. ¿En qué zona te gustaría comprar?", [{ id: "miami", title: "Miami" }, { id: "hialeah", title: "Hialeah" }, { id: "other-area", title: "Otra zona" }], env);
    return true;
  }
  if (current.step === "area") {
    await save(db, conversationId, { ...current, step: "property_type", area: text.trim() });
    await sendKapsoButtons(channelUserId, "¿Qué tipo de propiedad es o buscas?", [{ id: "house", title: "Casa" }, { id: "condo", title: "Condo" }, { id: "townhome", title: "Townhome / Otro" }], env);
    return true;
  }
  if (current.step === "property_type") {
    const area = `${current.area ?? ""} · ${text.trim()}`;
    await save(db, conversationId, { ...current, step: "budget", area });
    const buttons = current.operation === "renter"
      ? [{ id: "under-2k", title: "Hasta $2K" }, { id: "2-3k", title: "$2K–$3K" }, { id: "3k-plus", title: "$3K+" }]
      : current.operation === "seller"
        ? [{ id: "under-500k", title: "Hasta $500K" }, { id: "500-750k", title: "$500K–$750K" }, { id: "750k-plus", title: "$750K+" }]
        : [{ id: "0-300k", title: "$0–$300K" }, { id: "300-500k", title: "$300K–$500K" }, { id: "500-750k", title: "$500K–$750K" }];
    await sendKapsoButtons(channelUserId, current.operation === "seller" ? "¿Qué rango de valor estimado tiene la propiedad?" : "¿Cuál es tu presupuesto aproximado?", buttons, env);
    return true;
  }
  if (current.step === "budget") {
    await save(db, conversationId, { ...current, step: "timeline", budget: text.trim() });
    await sendKapsoButtons(channelUserId, "¿En qué plazo te gustaría avanzar?", [{ id: "0-30", title: "0–30 días" }, { id: "1-3", title: "1–3 meses" }, { id: "exploring", title: "Explorando" }], env);
    return true;
  }
  if (current.step === "timeline") {
    const timeline = text.includes("30") ? "0-30 días" : text.includes("1") || text.includes("3") ? "1-3 meses" : "explorando";
    await save(db, conversationId, { ...current, step: "preapproved", timeline });
    if (current.operation === "buyer") {
      await sendKapsoButtons(channelUserId, "Última pregunta: ¿ya cuentas con pre-calificación?", [{ id: "preapproved", title: "Sí, pre-calificado" }, { id: "not-yet", title: "Aún no" }, { id: "cash", title: "Compra cash" }], env);
    } else {
      await finishIntake({ env, db, conversationId, intake: { ...current, timeline }, reply });
    }
    return true;
  }
  if (current.step === "preapproved") {
    const preapproved = text.toLowerCase().includes("sí") || text.toLowerCase().includes("pre-cal") || text.toLowerCase().includes("cash");
    await finishIntake({ env, db, conversationId, intake: { ...current, preapproved: preapproved ? "sí" : "no" }, reply });
    return true;
  }
  return false;
}

async function finishIntake(input: { env: Env; db: Db; conversationId: string; intake: Intake; reply: (text: string) => Promise<void> }) {
  const { db, conversationId, intake, reply } = input;
  const operation = intake.operation as RealtorPipelineKind;
  const scored = scoreRealEstateLead({ operation, name: intake.name ?? undefined, contact: intake.contact ?? undefined, area: intake.area ?? undefined, budget: intake.budget ?? undefined, timeline: intake.timeline ?? undefined, preapproved: intake.preapproved === "sí", cashBuyer: false, readiness: intake.preapproved === "sí" ? "ready" : "exploring", nextStep: "call" });
  const leadId = await new LeadsRepo(db).create({ conversationId, channelUserId: null, name: intake.name ?? undefined, contact: intake.contact ?? undefined, intent: `${operation}: ${intake.area ?? "zona por definir"}`, notes: "Kapso guided qualification", metadata: { operation, area: intake.area ?? null, budget: intake.budget ?? null, timeline: intake.timeline ?? null, preapproved: intake.preapproved ?? "no" } });
  await new RealtorRepo(db).attachLead({ leadId, kind: operation, score: scored.score, reason: scored.reason, source: "kapso-guided-qualification", nextAction: scored.nextAction, tags: scored.tags });
  await save(db, conversationId, { ...intake, step: "complete" });
  await reply(`Gracias, ${intake.name}. Ya registré tu búsqueda como prioridad ${scored.score >= 60 ? "alta" : "en desarrollo"}. Jorge o su equipo revisará tu información y coordinará el siguiente paso contigo.`);
}
