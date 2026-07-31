import type { Env } from "../../env";
import { Db } from "../../db/client";
import { RealtorRepo, type RealtorLeadCard } from "../../db/realtor";
import { layout } from "./layout";

const esc = (s: unknown) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function card(lead: RealtorLeadCard, stages: Array<{ id: string; name: string }>): string {
  const tags = (lead.tags ?? "").split(",").filter(Boolean).map((tag) => `<span style="font-size:9px;border:1px solid var(--line);padding:2px 5px;color:var(--muted)">${esc(tag)}</span>`).join("");
  const options = stages.map((s) => `<option value="${esc(s.id)}" ${s.id === lead.stage_id ? "selected" : ""}>${esc(s.name)}</option>`).join("");
  return `<article style="border:1px solid var(--line);background:var(--panel);padding:12px;box-shadow:3px 3px 0 rgba(0,0,0,.18)">
    <div style="display:flex;justify-content:space-between;gap:8px"><strong style="font-family:'Space Grotesk';font-size:14px">${esc(lead.name || "Prospecto sin nombre")}</strong><span style="font-size:11px;color:var(--accent2)">${lead.score}/100</span></div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lead.intent)}</div>
    ${lead.contact ? `<div style="font-size:10px;color:var(--dim);margin-top:6px">${esc(lead.contact)}</div>` : ""}
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:9px">${tags}</div>
    <div style="font-size:10px;color:var(--dim);line-height:1.4;margin-top:10px">${esc(lead.next_action || "Sin siguiente acción")}</div>
    <form method="POST" action="/admin/pipelines/leads/${encodeURIComponent(lead.lead_id)}/stage" style="margin-top:10px;display:flex;gap:6px">
      <select name="stage_id" style="min-width:0;flex:1;background:var(--bg);border:1px solid var(--line);color:var(--cream);padding:6px;font-size:10px">${options}</select>
      <button class="ghostbtn" style="background:var(--raise);border:1px solid var(--line);color:var(--cream);padding:6px 8px;font-size:10px">Mover</button>
    </form>
  </article>`;
}

export async function renderPipelines(env: Env): Promise<string> {
  const repo = new RealtorRepo(new Db(env.DB));
  const pipelines = await repo.pipelines();
  const tabs = pipelines.map((p) => `<a href="#${p.kind}" class="chip" style="border:1px solid var(--line);padding:7px 10px;color:var(--muted);font-size:11px">${esc(p.name)}</a>`).join("");
  const boards = await Promise.all(pipelines.map(async (pipeline) => {
    const cards = await repo.cards(pipeline.id);
    const columns = pipeline.stages.map((stage) => {
      const inStage = cards.filter((c) => c.stage_id === stage.id);
      return `<section style="width:240px;flex:none"><div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 9px"><span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${stage.color || "var(--muted)"}">${esc(stage.name)}</span><span style="font-size:10px;color:var(--dim)">${inStage.length}</span></div><div style="display:flex;flex-direction:column;gap:9px">${inStage.map((c) => card(c, pipeline.stages)).join("") || `<div style="border:1px dashed var(--line);padding:12px;color:var(--dim);font-size:10px">Sin prospectos</div>`}</div></section>`;
    }).join("");
    return `<section id="${pipeline.kind}" class="card" style="margin-top:24px"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px"><h2 style="font-family:'Space Grotesk';font-size:18px;margin:0">${esc(pipeline.name)} Pipeline</h2><span style="font-size:10px;color:var(--dim)">${cards.length} prospectos</span></div><div style="display:flex;gap:12px;overflow-x:auto;padding:2px 2px 12px">${columns}</div></section>`;
  }));
  const body = `<div class="card" style="border:1px solid var(--line);background:var(--panel);padding:20px"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div style="font-size:10px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase">Hawk Guru Realtor Suite</div><h2 style="font-family:'Space Grotesk';font-size:22px;margin:6px 0">Pipelines de ventas</h2><p style="font-size:12px;color:var(--muted);max-width:650px;line-height:1.55;margin:0">Los prospectos se clasifican desde el chat o lead magnets. Mueve etapas manualmente; las acciones críticas siguen bajo control humano.</p></div><div style="display:flex;gap:7px;align-items:start;flex-wrap:wrap">${tabs}</div></div></div>${boards.join("")}`;
  return layout({ title: "Pipelines", activeTab: "pipelines", body, env });
}
