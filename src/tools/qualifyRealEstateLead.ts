import { tool } from "ai";
import { z } from "zod";
import type { Env } from "../env";
import { Db } from "../db/client";
import { LeadsRepo } from "../db/leads";
import { RealtorRepo, type RealtorPipelineKind } from "../db/realtor";

const inputSchema = z.object({
  operation: z.enum(["buyer", "seller", "renter"]),
  name: z.string().optional(),
  contact: z.string().optional(),
  area: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  preapproved: z.boolean().optional(),
  cashBuyer: z.boolean().optional(),
  readiness: z.enum(["ready", "needs-guidance", "valuation", "move-in-ready", "exploring"]).optional(),
  nextStep: z.enum(["call", "appointment", "whatsapp", "questions"]).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export function scoreRealEstateLead(input: z.infer<typeof inputSchema>): { score: number; tags: string[]; reason: string; nextAction: string } {
  let score = 20;
  const tags: string[] = [input.operation];
  const reasons = ["intención inmobiliaria identificada"];
  if (input.contact) { score += 15; reasons.push("contacto disponible"); }
  if (input.area) { score += 10; reasons.push("zona definida"); }
  if (input.budget) { score += 15; reasons.push("presupuesto definido"); }
  if (input.timeline) { score += 10; reasons.push("plazo compartido"); }
  if (input.preapproved) { score += 20; tags.push("preapproved"); reasons.push("preaprobación confirmada"); }
  if (input.cashBuyer) { score += 20; tags.push("cash-buyer"); reasons.push("compra de contado"); }
  if (input.timeline?.includes("0-30")) { score += 15; tags.push("0-30-days"); reasons.push("plazo de 0-30 días"); }
  if (input.readiness === "ready") { score += 20; reasons.push("listo para avanzar"); }
  if (input.readiness === "valuation") { score += 20; tags.push("valuation-requested"); reasons.push("solicita valoración"); }
  if (input.readiness === "move-in-ready") { score += 20; tags.push("move-in-ready"); reasons.push("fecha de mudanza definida"); }
  if (input.nextStep === "call" || input.nextStep === "appointment") { score += 20; tags.push("appointment-requested"); reasons.push("solicita conversación"); }
  const hot = score >= 60;
  tags.push(hot ? "hot" : "warm");
  return {
    score: Math.min(score, 100), tags,
    reason: reasons.join(" · "),
    nextAction: input.nextStep === "appointment" ? "Contactar hoy para coordinar la cita solicitada." : hot ? "Contactar hoy para agendar la siguiente conversación." : "Completar presupuesto, zona y fecha objetivo.",
  };
}

export function qualifyRealEstateLeadTool(env: Env, getConversationId: () => string | null) {
  return tool({
    description: "Califica un prospecto inmobiliario y lo registra en el pipeline de buyer, seller o renter con score y tags automáticos. Úsala solo cuando el cliente expresa intención real.",
    inputSchema,
    execute: async (input) => {
      if (!input.name?.trim() || !input.contact?.trim()) {
        return {
          qualified: false,
          message: "Antes de calificar el prospecto, confirma su nombre y teléfono de contacto.",
        };
      }
      const db = new Db(env.DB);
      const leads = new LeadsRepo(db);
      const scored = scoreRealEstateLead(input);
      const leadId = await leads.create({
        conversationId: getConversationId(), channelUserId: null,
        name: input.name, contact: input.contact,
        intent: `${input.operation}: ${input.area ?? "zona por definir"}`,
        notes: input.notes,
        metadata: { operation: input.operation, area: input.area ?? null, budget: input.budget ?? null, timeline: input.timeline ?? null, preapproved: input.preapproved ? "sí" : null },
      });
      await new RealtorRepo(db).attachLead({ leadId, kind: input.operation as RealtorPipelineKind, score: scored.score, reason: scored.reason, source: input.source ?? "chat", nextAction: scored.nextAction, tags: scored.tags });
      return { leadId, score: scored.score, tags: scored.tags, nextAction: scored.nextAction, message: "Prospecto calificado y agregado al pipeline." };
    },
  });
}
