/**
 * Marketing Compliance Copilot is deliberately separate from SupportAgent.
 * It only receives a verified listing from the private admin dashboard and
 * returns drafts. It never imports channel adapters, webhooks, or chat tools.
 */
import { generateText } from "ai";
import type { Env } from "../env";
import { createModel } from "../llm/provider";
import { loadLlmOverrides } from "../settings-loader";
import type { KbDoc } from "../kb/docs";

export type MarketingFormat = "mls" | "instagram" | "facebook" | "reel" | "open-house";

export type MarketingDraft = {
  status: "ready_for_review" | "requires_confirmation";
  fields: Record<string, string>;
  missingFacts: string[];
  complianceFlags: string[];
  draft?: string;
};

const required = ["Dirección", "Estatus", "Precio", "Tipo y características"];

function field(content: string, name: string): string {
  return content.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
}

export function inspectListing(doc: KbDoc): MarketingDraft {
  const fields = Object.fromEntries([
    "Dirección", "Estatus", "Precio", "Tipo y características", "Zona", "Open House", "CTA permitido",
  ].map((name) => [name, field(doc.content, name)]));
  const missingFacts = required.filter((name) => !fields[name] || /disponible\s*\/|precio\s*por confirmar/i.test(fields[name]));
  const status = fields.Estatus.toLowerCase();
  if (status.includes("vendido") || status.includes("contrato")) missingFacts.push("Estatus publicable: la propiedad no está disponible");
  return {
    status: missingFacts.length ? "requires_confirmation" : "ready_for_review",
    fields,
    missingFacts,
    complianceFlags: [
      "Borrador sujeto a revisión del Realtor, MLS local y Fair Housing.",
      "No publicar ni prometer disponibilidad, precio o características sin confirmar.",
    ],
  };
}

export async function createMarketingDraft(env: Env, doc: KbDoc, format: MarketingFormat): Promise<MarketingDraft> {
  const result = inspectListing(doc);
  if (result.status !== "ready_for_review") return result;
  const { model } = createModel(env, "fast", await loadLlmOverrides(env));
  const label: Record<MarketingFormat, string> = { mls: "descripción MLS", instagram: "caption de Instagram", facebook: "post de Facebook", reel: "guion corto para Reel", "open-house": "promoción de Open House" };
  const response = await generateText({
    model,
    maxOutputTokens: 420,
    system: "Eres Marketing Compliance Copilot para un Realtor. Solo creas borradores para revisión humana; no respondes leads ni controlas canales. Usa exclusivamente los hechos proporcionados. No inventes datos, distancias, escuelas, disponibilidad, precio, financiamiento, tasas, premios o características. Evita lenguaje que indique preferencia, limitación o discriminación por clases protegidas. No uses descriptores demográficos. Si un dato no está disponible, omítelo. Devuelve el borrador en español y termina exactamente con: 'Borrador — requiere aprobación del Realtor antes de publicar.'",
    prompt: `Formato solicitado: ${label[format]}\n\nHechos verificados:\n${Object.entries(result.fields).map(([key, value]) => `${key}: ${value || "No confirmado"}`).join("\n")}`,
  });
  return { ...result, draft: response.text.trim() };
}

