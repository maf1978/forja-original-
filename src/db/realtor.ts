import { Db } from "./client";

export type RealtorPipelineKind = "buyer" | "seller" | "renter";

export interface RealtorStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string | null;
  is_closed: number;
  is_won: number;
}

export interface RealtorLeadCard {
  lead_id: string;
  name: string | null;
  contact: string | null;
  intent: string;
  metadata: string | null;
  stage_id: string;
  score: number;
  score_reason: string | null;
  source: string | null;
  next_action: string | null;
  updated_at: number;
  tags: string | null;
}

const PIPELINES: Array<{ kind: RealtorPipelineKind; name: string; stages: Array<[string, string, number, number]> }> = [
  { kind: "buyer", name: "Buyers", stages: [["Nuevo", "#7aa2d6", 0, 0], ["Calificado", "#b99bd6", 0, 0], ["Preaprobación", "#f5a623", 0, 0], ["Showing", "#f07a3f", 0, 0], ["Oferta", "#e39d4e", 0, 0], ["Bajo contrato", "#7fb77e", 0, 0], ["Cerrado", "#54a66b", 1, 1], ["Perdido", "#d97a6a", 1, 0]] },
  { kind: "seller", name: "Sellers", stages: [["Nuevo", "#7aa2d6", 0, 0], ["Valoración", "#b99bd6", 0, 0], ["Cita de listing", "#f5a623", 0, 0], ["Listing firmado", "#f07a3f", 0, 0], ["Activo", "#e39d4e", 0, 0], ["Bajo contrato", "#7fb77e", 0, 0], ["Cerrado", "#54a66b", 1, 1], ["Perdido", "#d97a6a", 1, 0]] },
  { kind: "renter", name: "Renters", stages: [["Nuevo", "#7aa2d6", 0, 0], ["Calificado", "#b99bd6", 0, 0], ["Showing", "#f5a623", 0, 0], ["Aplicación", "#f07a3f", 0, 0], ["Aprobado", "#7fb77e", 0, 0], ["Move-in", "#54a66b", 1, 1], ["Perdido", "#d97a6a", 1, 0]] },
];

const TAGS = ["buyer", "seller", "renter", "hot", "warm", "preapproved", "cash-buyer", "needs-financing", "urgent", "lead-magnet", "open-house"];

export class RealtorRepo {
  constructor(private readonly db: Db) {}

  async ensureDefaults(): Promise<void> {
    const now = Date.now();
    for (const pipeline of PIPELINES) {
      const pipelineId = `realtor-${pipeline.kind}`;
      await this.db.run("INSERT OR IGNORE INTO realtor_pipelines (id, name, kind, created_at) VALUES (?, ?, ?, ?)", [pipelineId, pipeline.name, pipeline.kind, now]);
      for (const [position, [name, color, closed, won]] of pipeline.stages.entries()) {
        await this.db.run(
          "INSERT OR IGNORE INTO realtor_pipeline_stages (id, pipeline_id, name, position, color, is_closed, is_won) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [`${pipelineId}-${position}`, pipelineId, name, position, color, closed, won],
        );
      }
    }
    for (const slug of TAGS) {
      await this.db.run("INSERT OR IGNORE INTO realtor_tags (id, slug, label, color, created_at) VALUES (?, ?, ?, ?, ?)", [`tag-${slug}`, slug, slug.replaceAll("-", " "), slug === "hot" ? "#f07a3f" : null, now]);
    }
  }

  async pipelines(): Promise<Array<{ id: string; name: string; kind: RealtorPipelineKind; stages: RealtorStage[] }>> {
    await this.ensureDefaults();
    const pipelines = await this.db.all<{ id: string; name: string; kind: RealtorPipelineKind }>("SELECT id, name, kind FROM realtor_pipelines ORDER BY CASE kind WHEN 'buyer' THEN 1 WHEN 'seller' THEN 2 ELSE 3 END");
    const stages = await this.db.all<RealtorStage>("SELECT * FROM realtor_pipeline_stages ORDER BY pipeline_id, position");
    return pipelines.map((p) => ({ ...p, stages: stages.filter((s) => s.pipeline_id === p.id) }));
  }

  async cards(pipelineId: string): Promise<RealtorLeadCard[]> {
    return this.db.all<RealtorLeadCard>(
      `SELECT rlp.lead_id, l.name, l.contact, l.intent, l.metadata, rlp.stage_id, rlp.score, rlp.score_reason, rlp.source, rlp.next_action, rlp.updated_at,
              GROUP_CONCAT(t.slug, ',') AS tags
       FROM realtor_lead_pipeline rlp
       JOIN leads l ON l.id = rlp.lead_id
       LEFT JOIN realtor_lead_tags rlt ON rlt.lead_id = l.id
       LEFT JOIN realtor_tags t ON t.id = rlt.tag_id
       WHERE rlp.pipeline_id = ?
       GROUP BY rlp.lead_id
       ORDER BY rlp.score DESC, rlp.updated_at DESC`, [pipelineId],
    );
  }

  async attachLead(input: { leadId: string; kind: RealtorPipelineKind; score: number; reason: string; source?: string; nextAction?: string; tags: string[] }): Promise<void> {
    await this.ensureDefaults();
    const pipelineId = `realtor-${input.kind}`;
    const first = await this.db.first<RealtorStage>("SELECT * FROM realtor_pipeline_stages WHERE pipeline_id = ? ORDER BY position LIMIT 1", [pipelineId]);
    if (!first) throw new Error("Realtor pipeline is not initialized");
    const now = Date.now();
    const old = await this.db.first<{ stage_id: string }>("SELECT stage_id FROM realtor_lead_pipeline WHERE lead_id = ?", [input.leadId]);
    await this.db.run(
      `INSERT INTO realtor_lead_pipeline (lead_id, pipeline_id, stage_id, score, score_reason, source, next_action, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lead_id) DO UPDATE SET pipeline_id=excluded.pipeline_id, stage_id=excluded.stage_id, score=excluded.score, score_reason=excluded.score_reason, source=excluded.source, next_action=excluded.next_action, updated_at=excluded.updated_at`,
      [input.leadId, pipelineId, first.id, input.score, input.reason, input.source ?? null, input.nextAction ?? null, now],
    );
    await this.db.run("INSERT INTO realtor_pipeline_events (id, lead_id, from_stage_id, to_stage_id, actor, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), input.leadId, old?.stage_id ?? null, first.id, "qualification", "Lead added to Realtor pipeline", now]);
    for (const slug of [...new Set(input.tags)]) {
      const tag = await this.db.first<{ id: string }>("SELECT id FROM realtor_tags WHERE slug = ?", [slug]);
      if (tag) await this.db.run("INSERT OR IGNORE INTO realtor_lead_tags (lead_id, tag_id, source, created_at) VALUES (?, ?, 'qualification', ?)", [input.leadId, tag.id, now]);
    }
  }

  async moveLead(leadId: string, stageId: string, actor = "owner"): Promise<boolean> {
    const current = await this.db.first<{ stage_id: string; pipeline_id: string }>("SELECT stage_id, pipeline_id FROM realtor_lead_pipeline WHERE lead_id = ?", [leadId]);
    const target = await this.db.first<RealtorStage>("SELECT * FROM realtor_pipeline_stages WHERE id = ?", [stageId]);
    if (!current || !target || target.pipeline_id !== current.pipeline_id) return false;
    const now = Date.now();
    await this.db.run("UPDATE realtor_lead_pipeline SET stage_id = ?, updated_at = ? WHERE lead_id = ?", [stageId, now, leadId]);
    await this.db.run("INSERT INTO realtor_pipeline_events (id, lead_id, from_stage_id, to_stage_id, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), leadId, current.stage_id, stageId, actor, now]);
    return true;
  }
}
