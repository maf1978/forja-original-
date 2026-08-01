import type { Env } from "../../env";
import { Db } from "../../db/client";
import { LeadsRepo, leadMetadata, type Lead } from "../../db/leads";
import { getNiche } from "../../niches";
import { layout } from "./layout";

// Escapa texto del LLM/cliente antes de meterlo en HTML (el intent y las notas
// pueden traer <, &, links pegados por el cliente, etc.).
function esc(v: string | null | undefined): string {
  return (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface Col {
  h: string;
  w: string;
  cell: (l: Lead, meta: Record<string, string>) => string;
}

export async function renderLeads(env: Env): Promise<string> {
  const niche = getNiche(env);
  const db = new Db(env.DB);
  const leads = new LeadsRepo(db);
  const list = await leads.list(100);
  const dossierRows = await db.all<{ lead_id: string; score: number; next_action: string | null; score_reason: string | null; tags: string | null }>(
    `SELECT r.lead_id, r.score, r.next_action, r.score_reason, GROUP_CONCAT(t.slug, ',') tags
     FROM realtor_lead_pipeline r LEFT JOIN realtor_lead_tags lt ON lt.lead_id=r.lead_id
     LEFT JOIN realtor_tags t ON t.id=lt.tag_id GROUP BY r.lead_id`,
  );
  const dossiers = new Map(dossierRows.map((r) => [r.lead_id, r]));
  const insightRows = await db.all<{ conversation_id: string; sentiment: string | null; resolution: string | null; summary: string | null; sale_opportunity: number | null }>(
    "SELECT conversation_id, sentiment, resolution, summary, sale_opportunity FROM conversation_insights",
  );
  const insightsByConversation = new Map(insightRows.map((r) => [r.conversation_id, r]));
  const socialRows = await db.all<{ conversation_id: string; source_type: string; content_id: string | null; campaign_id: string | null; ad_id: string | null }>(
    "SELECT conversation_id, source_type, content_id, campaign_id, ad_id FROM social_events ORDER BY created_at DESC",
  );
  const socialByConversation = new Map<string, { source_type: string; content_id: string | null; campaign_id: string | null; ad_id: string | null }>();
  for (const row of socialRows) if (!socialByConversation.has(row.conversation_id)) socialByConversation.set(row.conversation_id, row);

  const statusLabel = (s: Lead["status"]) => niche.statusLabels[s];

  // Columnas: núcleo (fecha, nombre, contacto) + o bien las columnas del nicho
  // (leídas de metadata) o bien el "Resumen" genérico + estado (re-etiquetado).
  const cols: Col[] = [
    { h: "Fecha", w: "94px", cell: (l) => `<span class="text-dim">${new Date(l.created_at).toLocaleDateString("es-MX")}</span>` },
    { h: "Nombre", w: "minmax(120px,1.1fr)", cell: (l) => `<span class="text-cream" style="display:flex;align-items:center;gap:7px"><i data-lucide="chevron-right" width="13" height="13" class="chev" style="flex:none;transition:transform .12s ease"></i>${esc(l.name) || "(sin nombre)"}</span>` },
    { h: "Contacto", w: "minmax(110px,1fr)", cell: (l) => `<span class="text-muted">${esc(l.contact) || "—"}</span>` },
    { h: "Origen", w: "minmax(92px,.8fr)", cell: (l) => { const s = l.conversation_id ? socialByConversation.get(l.conversation_id) : undefined; return `<span class="text-muted">${s ? esc(s.source_type.replaceAll("_", " ")) : "Directo"}</span>`; } },
    { h: "Readiness", w: "minmax(110px,1fr)", cell: (l) => { const d=dossiers.get(l.id); return `<span style="color:${(d?.score ?? 0)>=60?"var(--accent)":"var(--muted)"}">${d ? `${d.score}/100 · ${(d.tags ?? "warm").split(',').slice(-2).join(' · ')}` : "Por calificar"}</span>`; } },
  ];
  if (niche.columns.length) {
    for (const c of niche.columns) {
      cols.push({ h: c.label, w: "minmax(78px,.85fr)", cell: (_l, meta) => `<span class="text-muted truncate">${esc(meta[c.key]) || "—"}</span>` });
    }
  } else {
    cols.push({ h: "Resumen · click para ver detalle", w: "minmax(200px,1.8fr)", cell: (l) => `<span class="text-muted truncate">${esc(l.intent)}</span>` });
  }
  cols.push({
    h: "Estado",
    w: "132px",
    cell: (l) => `<form method="POST" action="/admin/leads/${l.id}/status" onclick="event.stopPropagation()">
      <select name="status" onchange="this.form.submit()"
              style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--cream);padding:6px 8px;font-size:11px;outline:none;cursor:pointer">
        ${(["new", "contacted", "sold", "lost"] as const)
          .map((s) => `<option ${l.status === s ? "selected" : ""} value="${s}">${esc(statusLabel(s))}</option>`)
          .join("")}
      </select>
    </form>`,
  });

  const gridCols = cols.map((c) => c.w).join(" ");
  const minWidth = 640 + niche.columns.length * 90; // asegura el scroll horizontal cuando hay muchas columnas

  const rows = list
    .map((l) => {
      const meta = leadMetadata(l);
      const dossier = dossiers.get(l.id);
      const social = l.conversation_id ? socialByConversation.get(l.conversation_id) : undefined;
      const insight = l.conversation_id ? insightsByConversation.get(l.conversation_id) : undefined;
      const coach = (() => {
        if ((insight?.sentiment === "frustrated" || insight?.sentiment === "angry")) return ["Escalar a humano", "Hay fricción en la conversación. Responde personalmente antes de continuar el flujo."];
        if ((dossier?.score ?? 0) >= 70) return ["Contactar hoy", "Lead de alta intención. Propón llamada, showing o valoración con un horario concreto."];
        if (social?.source_type === "meta_ad") return ["Conectar el anuncio con la necesidad", "Menciona el tema del anuncio y confirma zona, presupuesto o propiedad antes de sugerir opciones."];
        if (insight?.sale_opportunity) return ["Resolver la oportunidad abierta", "Hay intención sin cierre. Haz una pregunta concreta para desbloquear el siguiente paso."];
        return ["Completar perfil", "Pide solo el dato que falta para poder recomendar una propiedad, valoración o cita."];
      })();
      const fullDate = new Date(l.created_at).toLocaleString("es-MX");
      const convLink = l.conversation_id
        ? `<a href="/admin/conversations?c=${encodeURIComponent(l.conversation_id)}" class="text-accent" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;text-decoration:none">
             <i data-lucide="messages-square" width="13" height="13"></i> Ver conversación completa
           </a>`
        : `<span class="text-dim" style="font-size:11.5px">Sin conversación ligada</span>`;
      // Detalle: todos los campos del nicho (metadata) + resumen IA + notas.
      const metaRows = Object.entries(meta)
        .map(([k, v]) => `<span class="text-muted" style="font-size:12px"><span class="text-dim">${esc(k)}:</span> ${esc(v)}</span>`)
        .join("");
      return `<div class="lead" style="border-top:1px solid var(--line)">
        <div class="leadrow" onclick="var d=this.parentNode.querySelector('.lead-detail');var open=d.style.display==='block';d.style.display=open?'none':'block';this.querySelector('.chev').style.transform=open?'rotate(0deg)':'rotate(90deg)'"
             style="display:grid;grid-template-columns:${gridCols};gap:12px;padding:13px 18px;font-size:12.5px;align-items:center;cursor:pointer">
          ${cols.map((c) => c.cell(l, meta)).join("")}
        </div>
        <div class="lead-detail" style="display:none;padding:4px 18px 20px 18px;background:var(--bg)">
          <div style="max-width:760px;display:flex;flex-direction:column;gap:14px;padding-top:14px">
            ${metaRows ? `<div><div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Datos</div><div style="display:flex;flex-wrap:wrap;gap:6px 18px">${metaRows}</div></div>` : ""}
            ${dossier ? `<div style="display:grid;grid-template-columns:110px 1fr;gap:10px;border:1px solid var(--line);background:var(--panel);padding:12px"><div><div style="font-family:'Space Grotesk';font-size:25px;color:var(--accent)">${dossier.score}<span style="font-size:10px;color:var(--dim)"> /100</span></div><div style="font-size:9px;color:var(--dim);letter-spacing:.12em">READINESS</div></div><div><b style="font-size:11px">Siguiente acción</b><div class="text-muted" style="font-size:12px;margin-top:3px">${esc(dossier.next_action || "Revisar perfil")}</div><div class="text-dim" style="font-size:10px;margin-top:5px">${esc(dossier.score_reason || "Sin explicación")}</div></div></div>` : ""}
            ${social ? `<div style="border:1px solid var(--line);background:var(--panel);padding:12px"><div style="font-size:9px;letter-spacing:.14em;color:var(--accent);margin-bottom:6px">SOCIAL ATTRIBUTION</div><div style="font-size:12px;color:var(--cream)">${esc(social.source_type.replaceAll("_", " "))}</div><div class="text-dim" style="font-size:10px;margin-top:4px">${[social.content_id && `contenido: ${social.content_id}`, social.campaign_id && `campaña: ${social.campaign_id}`, social.ad_id && `ad: ${social.ad_id}`].filter(Boolean).map(esc).join(" · ") || "Sin referencia de campaña"}</div></div>` : ""}
            <div style="border:1px solid var(--accent);background:var(--accent-soft);padding:12px"><div style="font-size:9px;letter-spacing:.14em;color:var(--accent2);margin-bottom:6px">AI DEAL COACH · REVISAR ANTES DE ENVIAR</div><b style="font-size:12px;color:var(--cream)">${esc(coach[0])}</b><div class="text-muted" style="font-size:11px;line-height:1.45;margin-top:4px">${esc(coach[1])}</div>${insight?.summary ? `<div class="text-dim" style="font-size:10px;line-height:1.4;margin-top:7px">Insight: ${esc(insight.summary)}</div>` : ""}</div>
            <div>
              <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Resumen de la IA</div>
              <div class="text-cream" style="font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(l.intent)}</div>
            </div>
            ${l.notes ? `<div>
              <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Notas</div>
              <div class="text-muted" style="font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(l.notes)}</div>
            </div>` : ""}
            <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding-top:2px">
              ${convLink}
              <span class="text-dim" style="font-size:11.5px;display:inline-flex;align-items:center;gap:6px"><i data-lucide="clock" width="12" height="12"></i>${fullDate}</span>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const empty = `<div style="padding:40px 18px;text-align:center" class="text-dim text-[12.5px]">Aún no hay ${esc(niche.recordPlural.toLowerCase())}.</div>`;
  const header = cols
    .map((c) => `<span>${esc(c.h)}</span>`)
    .join("");

  const body = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap">
      <div><div style="font-size:10px;color:var(--accent);letter-spacing:.16em">LEAD DOSSIERS</div><h2 class="font-display font-semibold text-[20px] text-cream" style="margin:3px 0">${esc(niche.recordPlural)}</h2><div class="text-dim" style="font-size:11px">Abre un lead para ver readiness, razón del score y próxima acción.</div></div>
      <a href="/admin/leads/export.csv" class="ghostbtn" style="display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);color:var(--muted);padding:9px 14px;font-size:12.5px;transition:all .12s ease">
        <i data-lucide="download" width="14" height="14"></i> Exportar CSV
      </a>
    </div>
    <div class="bg-panel border border-line" style="overflow-x:auto">
      <div style="min-width:${minWidth}px">
        <div style="display:grid;grid-template-columns:${gridCols};gap:12px;padding:10px 18px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)">
          ${header}
        </div>
        ${list.length ? rows : empty}
      </div>
    </div>`;
  return layout({ title: niche.recordPlural, activeTab: "leads", body, env });
}

export async function exportLeadsCsv(env: Env): Promise<string> {
  const leads = new LeadsRepo(new Db(env.DB));
  const list = await leads.list(10_000);
  const header = "fecha,nombre,contacto,intent,status,notas,metadata\n";
  const rows = list.map((l) => {
    const date = new Date(l.created_at).toISOString();
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    return `${date},${esc(l.name)},${esc(l.contact)},${esc(l.intent)},${l.status},${esc(l.notes)},${esc(l.metadata)}`;
  }).join("\n");
  return header + rows;
}
