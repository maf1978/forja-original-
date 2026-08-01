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
import { Db } from "../db/client";

export type MarketingFormat = "mls" | "instagram" | "facebook" | "reel" | "open-house" | "meta-ad";
export type MarketingLanguage = "es" | "en";

export type MarketingDraft = {
  status: "ready_for_review" | "requires_confirmation";
  fields: Record<string, string>;
  missingFacts: string[];
  complianceFlags: string[];
  draft?: string;
};

export type SavedMarketingDraft = { id: string; listing_doc_id: string; format: MarketingFormat; content: string; status: "draft" | "approved" | "archived"; created_at: number; updated_at: number; approved_at: number | null };

export class MarketingDraftsRepo {
  constructor(private readonly db: Db) {}
  async create(listingDocId: string, format: MarketingFormat, draft: MarketingDraft): Promise<SavedMarketingDraft> {
    if (!draft.draft) throw new Error("No se puede guardar un borrador vacío");
    const record: SavedMarketingDraft = { id: crypto.randomUUID(), listing_doc_id: listingDocId, format, content: draft.draft, status: "draft", created_at: Date.now(), updated_at: Date.now(), approved_at: null };
    await this.db.run("INSERT INTO marketing_drafts (id, listing_doc_id, format, content, facts_json, flags_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [record.id, record.listing_doc_id, record.format, record.content, JSON.stringify(draft.fields), JSON.stringify(draft.complianceFlags), record.status, record.created_at, record.updated_at]);
    return record;
  }
  async listForListing(listingDocId: string): Promise<SavedMarketingDraft[]> {
    return this.db.all<SavedMarketingDraft>("SELECT id, listing_doc_id, format, content, status, created_at, updated_at, approved_at FROM marketing_drafts WHERE listing_doc_id = ? ORDER BY created_at DESC", [listingDocId]);
  }
  async getById(id: string): Promise<SavedMarketingDraft | null> { return this.db.first<SavedMarketingDraft>("SELECT id, listing_doc_id, format, content, status, created_at, updated_at, approved_at FROM marketing_drafts WHERE id = ?", [id]); }
  async setStatus(id: string, status: "approved" | "archived"): Promise<void> { const now = Date.now(); await this.db.run("UPDATE marketing_drafts SET status = ?, updated_at = ?, approved_at = ? WHERE id = ?", [status, now, status === "approved" ? now : null, id]); }
}

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

export async function createMarketingDraft(env: Env, doc: KbDoc, format: MarketingFormat, language: MarketingLanguage = "es"): Promise<MarketingDraft> {
  const result = inspectListing(doc);
  if (result.status !== "ready_for_review") return result;
  const { model } = createModel(env, "fast", await loadLlmOverrides(env));
  const label: Record<MarketingFormat, string> = { mls: "descripción MLS", instagram: "caption de Instagram", facebook: "post de Facebook", reel: "guion corto para Reel", "open-house": "promoción de Open House", "meta-ad": "copy de Meta Ads para vivienda" };
  const languageLabel = language === "en" ? "English" : "español";
  const reviewLine = language === "en" ? "Draft — requires Realtor approval before publishing." : "Borrador — requiere aprobación del Realtor antes de publicar.";
  const response = await generateText({
    model,
    maxOutputTokens: 420,
    system: `Eres Marketing Compliance Copilot para un Realtor. Solo creas borradores para revisión humana; no respondes leads ni controlas canales. Usa exclusivamente los hechos proporcionados. No inventes datos, distancias, escuelas, disponibilidad, precio, financiamiento, tasas, premios o características. Evita lenguaje que indique preferencia, limitación o discriminación por clases protegidas. No uses descriptores demográficos. Si un dato no está disponible, omítelo. Para Meta Ads, crea solamente copy y nunca sugieras segmentar, excluir o inferir audiencias por atributos protegidos. Devuelve el borrador en ${languageLabel} y termina exactamente con: '${reviewLine}'`,
    prompt: `Formato solicitado: ${label[format]}\n\nHechos verificados:\n${Object.entries(result.fields).map(([key, value]) => `${key}: ${value || "No confirmado"}`).join("\n")}`,
  });
  const complianceFlags = format === "meta-ad" ? [...result.complianceFlags, "Meta Ads: revisar categoría especial Housing y no usar segmentación o exclusiones basadas en clases protegidas."] : result.complianceFlags;
  return { ...result, complianceFlags, draft: response.text.trim() };
}
