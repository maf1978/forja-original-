import type { Env } from "../../env";
import { Db } from "../../db/client";
import { layout } from "./layout";
import { costOfUsage, type ModelId } from "../../pricing";
import { resolveAgentConfig, type AgentConfig } from "../../settings-loader";
import { buildTools } from "../../tools";
import { resolveProvider, modelIdFor } from "../../llm/provider";
import { handoffNotifyStatus } from "../../tools/handoffHuman";
import { connectionsSummary } from "./conexiones";
import { KbDocsRepo, FIXTURE_CHUNKS } from "../../kb/docs";
import { InsightsRepo } from "../../db/insights";
import { SuggestionsRepo } from "../../db/suggestions";
import { channelLabel } from "../../channels/labels";
import { getNiche } from "../../niches";

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!),
  );
}

/** Short relative time in Spanish (ej. "hace 5 min", "hace 2 h", "hace 3 d"). */
function ago(ms: number | null | undefined): string {
  if (!ms) return "—";
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Two-letter avatar initials from a display name (or channel-id fallback). */
function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

/** "auto" or the concrete model id the agent is pinned to. */
function agentModelLabel(env: Env, cfg: AgentConfig): string {
  if (cfg.modelOverride === "auto") return "auto";
  const provider = resolveProvider(env);
  return modelIdFor(env, provider, cfg.modelOverride === "haiku" ? "fast" : "smart");
}

// Single-letter Spanish day-of-week labels, indexed like Date#getUTCDay() (0 = Dom).
const DOW_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

export async function renderOverview(env: Env): Promise<string> {
  const db = new Db(env.DB);
  const niche = getNiche(env);
  const oneDay = Date.now() - 86_400_000;
  const sevenDays = Date.now() - 7 * 86_400_000;
  const thirtyDays = Date.now() - 30 * 86_400_000;

  const todayMsgs = (await db.first<{ n: number }>(
    "SELECT COUNT(*) as n FROM messages WHERE created_at > ?", [oneDay],
  ))?.n ?? 0;
  const todayConvs = (await db.first<{ n: number }>(
    "SELECT COUNT(DISTINCT conversation_id) as n FROM messages WHERE created_at > ?", [oneDay],
  ))?.n ?? 0;
  const todayLeads = (await db.first<{ n: number }>(
    "SELECT COUNT(*) as n FROM leads WHERE created_at > ?", [oneDay],
  ))?.n ?? 0;

  const monthMsgs = (await db.first<{ n: number }>(
    "SELECT COUNT(*) as n FROM messages WHERE created_at > ?", [thirtyDays],
  ))?.n ?? 0;

  const tokenUsage = await db.all<{ model_used: string; input: number; output: number; cached: number }>(
    `SELECT model_used,
            SUM(COALESCE(input_tokens, 0)) as input,
            SUM(COALESCE(output_tokens, 0)) as output,
            SUM(COALESCE(cached_input_tokens, 0)) as cached
     FROM messages WHERE created_at > ? GROUP BY model_used`,
    [thirtyDays],
  );
  let totalCost = 0;
  for (const row of tokenUsage) {
    if (!row.model_used) continue;
    totalCost += costOfUsage(row.model_used as ModelId, {
      input: row.input,
      output: row.output,
      cached: row.cached,
    });
  }

  const openTickets = (await db.first<{ n: number }>(
    "SELECT COUNT(*) as n FROM tickets WHERE status != 'resolved'",
  ))?.n ?? 0;

  const hotLeads = await db.all<{ id: string; name: string | null; intent: string; score: number; next_action: string | null; metadata: string | null }>(
    `SELECT l.id, l.name, l.intent, r.score, r.next_action, l.metadata
     FROM realtor_lead_pipeline r JOIN leads l ON l.id = r.lead_id
     ORDER BY r.score DESC, r.updated_at DESC LIMIT 5`,
  );
  const intakeStarted = (await db.first<{ n: number }>("SELECT COUNT(*) n FROM realtor_intakes"))?.n ?? 0;
  const intakeCompleted = (await db.first<{ n: number }>("SELECT COUNT(*) n FROM realtor_intakes WHERE step = 'complete'"))?.n ?? 0;
  const hotCount = hotLeads.filter((l) => l.score >= 60).length;
  const appointmentRequests = (await db.first<{ n: number }>(
    `SELECT COUNT(*) n FROM realtor_lead_tags lt JOIN realtor_tags t ON t.id = lt.tag_id WHERE t.slug = 'appointment-requested'`,
  ))?.n ?? 0;
  const actNow = hotLeads.length
    ? hotLeads.map((l) => {
      let m: Record<string, string> = {}; try { m = JSON.parse(l.metadata ?? "{}"); } catch { /* noop */ }
      return `<a href="/admin/leads" style="display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--line)"><span style="width:32px;height:32px;display:grid;place-items:center;background:var(--accent-soft);border:1px solid var(--accent);font-size:11px;color:var(--accent)">${l.score}</span><span style="flex:1;min-width:0"><b style="display:block;color:var(--cream);font-size:12px">${esc(l.name || "Prospecto")}</b><small style="color:var(--muted);font-size:10px">${esc(m.area || l.intent)} · ${esc(m.budget || "presupuesto pendiente")}</small></span><span style="font-size:10px;color:var(--accent2);max-width:145px;text-align:right">${esc(l.next_action || "Revisar hoy")}</span></a>`;
    }).join("")
    : `<p class="text-dim" style="font-size:12px">Todavía no hay leads calificados. El primer lead de WhatsApp aparecerá aquí.</p>`;
  const qualificationFunnel = `<div class="card" style="border:1px solid var(--line);background:var(--panel);padding:18px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div><div style="font-size:10px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase">Qualification Journey</div><h2 style="font-family:'Manrope';font-size:19px;margin:5px 0">De WhatsApp a oportunidad</h2></div><a href="/admin/qualification" style="font-size:11px">Abrir quiz →</a></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px">${[["Iniciaron", intakeStarted], ["Completaron", intakeCompleted], ["Hot", hotCount], ["Solicitan cita", appointmentRequests]].map(([label, value], i) => `<div style="border:1px solid var(--line);background:${i === 2 ? "var(--accent-soft)" : "var(--bg)"};padding:12px"><div style="font-family:'Manrope';font-size:25px;font-weight:800;color:${i === 2 ? "var(--accent)" : "var(--cream)"}">${value}</div><div style="font-size:9px;letter-spacing:.1em;color:var(--dim);text-transform:uppercase">${label}</div></div>`).join("")}</div><div style="display:flex;gap:5px;align-items:center;margin-top:16px;font-size:10px;color:var(--muted)"><span>WhatsApp</span><b style="color:var(--accent)">→</b><span>Perfil</span><b style="color:var(--accent)">→</b><span>Budget</span><b style="color:var(--accent)">→</b><span>Pre-calificación</span><b style="color:var(--accent)">→</b><a href="/admin/appointments">Solicitudes de cita</a></div></div>`;

  // Speed-to-lead: cada mensaje del cliente se asocia con la primera respuesta
  // posterior del equipo o concierge. Ignoramos esperas extremas porque suelen
  // pertenecer a una conversación retomada, no al tiempo operativo de respuesta.
  const responsePairs = await db.all<{ sent_at: number; response_at: number | null }>(
    `SELECT u.created_at sent_at,
       (SELECT MIN(a.created_at) FROM messages a
        WHERE a.conversation_id = u.conversation_id
          AND a.role IN ('assistant', 'owner') AND a.created_at >= u.created_at) response_at
     FROM messages u WHERE u.role = 'user' AND u.created_at > ?`, [sevenDays],
  );
  const responseMinutes = responsePairs
    .filter((p) => p.response_at !== null && p.response_at >= p.sent_at && p.response_at - p.sent_at <= 12 * 60 * 60 * 1000)
    .map((p) => Math.round(((p.response_at ?? p.sent_at) - p.sent_at) / 60_000))
    .sort((a, b) => a - b);
  const medianResponse = responseMinutes.length ? responseMinutes[Math.floor(responseMinutes.length / 2)] : null;
  const waitingConversations = await db.all<{ id: string; display_name: string | null; channel_user_id: string | null; last_message_at: number; content: string }>(
    `SELECT c.id, c.display_name, c.channel_user_id, c.last_message_at, m.content
     FROM conversations c JOIN messages m ON m.id = (
       SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
     )
     WHERE m.role = 'user' AND c.last_message_at > ? ORDER BY c.last_message_at DESC LIMIT 4`, [oneDay],
  );
  const responseHealth = `<div class="card" style="border:1px solid var(--line);background:var(--panel);padding:18px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><div style="font-size:10px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase">Speed to Lead</div><h2 style="font-family:'Space Grotesk';font-size:19px;margin:5px 0">Respuesta y seguimiento</h2></div><a href="/admin/conversations" style="font-size:11px">Abrir inbox →</a></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0"><div style="border:1px solid var(--line);background:var(--bg);padding:11px"><div style="font-family:'Space Grotesk';font-size:23px;color:${medianResponse !== null && medianResponse <= 5 ? "var(--accent)" : "var(--cream)"}">${medianResponse === null ? "—" : medianResponse === 0 ? "< 1 min" : `${medianResponse} min`}</div><div style="font-size:9px;letter-spacing:.1em;color:var(--dim);text-transform:uppercase">mediana 7 días</div></div><div style="border:1px solid var(--line);background:${waitingConversations.length ? "var(--accent-soft)" : "var(--bg)"};padding:11px"><div style="font-family:'Space Grotesk';font-size:23px;color:${waitingConversations.length ? "var(--accent)" : "var(--cream)"}">${waitingConversations.length}</div><div style="font-size:9px;letter-spacing:.1em;color:var(--dim);text-transform:uppercase">esperando respuesta</div></div></div>${waitingConversations.length ? `<div>${waitingConversations.map((c) => `<a href="/admin/conversations?c=${encodeURIComponent(c.id)}" style="display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--line)"><span style="width:7px;height:7px;background:var(--accent);border-radius:50%;flex:none"></span><span style="min-width:0;flex:1"><b style="display:block;font-size:11px;color:var(--cream)">${esc(c.display_name || c.channel_user_id || "Prospecto")}</b><small style="display:block;color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.content)}</small></span><span style="font-size:10px;color:var(--dim);white-space:nowrap">${ago(c.last_message_at)}</span></a>`).join("")}</div>` : `<p class="text-dim" style="font-size:12px;margin:0">No hay respuestas pendientes durante las últimas 24 horas.</p>`}</div>`;

  // --- Actividad 7 días ---------------------------------------------------------
  const activityRows = await db.all<{ day: string; msgs: number }>(
    `SELECT date(created_at / 1000, 'unixepoch') as day, COUNT(*) as msgs
     FROM messages WHERE created_at > ? GROUP BY day ORDER BY day ASC`,
    [sevenDays],
  );
  const activityByDay = new Map(activityRows.map((r) => [r.day, r.msgs]));
  const activityDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { dow: d.getUTCDay(), msgs: activityByDay.get(key) ?? 0, isToday: i === 6 };
  });
  const activityMax = Math.max(...activityDays.map((d) => d.msgs), 1);

  // --- Estado del agente ----------------------------------------------------------
  const toolNames = Object.keys(buildTools({ env, getConversationId: () => null }));
  const agentCfg = await resolveAgentConfig(env, toolNames);
  const kbDocs = await new KbDocsRepo(db).list();
  const totalKbDocs = kbDocs.length + FIXTURE_CHUNKS.length;
  const insight7d = await new InsightsRepo(db).stats(sevenDays);
  const resolvedPct7d =
    insight7d.analyzed > 0 ? Math.round((insight7d.resolvedNoHuman / insight7d.analyzed) * 100) : null;

  // --- Conversaciones recientes -----------------------------------------------------
  const recentConvs = await db.all<{
    id: string;
    display_name: string | null;
    channel_user_id: string | null;
    channel: string;
    last_message_at: number | null;
    last_msg: string | null;
  }>(
    `SELECT c.id, c.display_name, c.channel_user_id, c.channel, c.last_message_at,
       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg
     FROM conversations c ORDER BY c.last_message_at DESC LIMIT 5`,
  );

  // --- Mejoras sugeridas -------------------------------------------------------------
  const proposedSuggestions = await new SuggestionsRepo(db).listProposed();

  // --- Markup: actividad + estado del agente -----------------------------------------
  const activityChart = `
    <div class="card bg-panel border border-line p-[18px]" style="animation-delay:.22s">
      <div class="font-display font-semibold text-[15px] text-cream flex items-center gap-2 mb-0.5">
        <i data-lucide="bar-chart-3" width="16" height="16" class="text-accent"></i>
        Actividad — últimos 7 días
      </div>
      <div class="text-[11px] text-dim mb-1">mensajes procesados por día</div>
      <div class="flex items-end gap-3" style="height:150px;padding-top:16px">
        ${activityDays
          .map((d) => {
            const pct = d.msgs === 0 ? 3 : Math.max(8, Math.round((d.msgs / activityMax) * 90));
            const label = d.isToday ? "HOY" : DOW_LETTER[d.dow];
            const barColor = d.isToday ? "var(--accent)" : "var(--linelit)";
            const numClass = d.isToday ? "text-accent font-semibold" : "text-muted";
            const labelClass = d.isToday ? "text-accent font-semibold" : "text-dim";
            return `
            <div class="bargrp flex-1 flex flex-col items-center gap-2" style="height:100%;justify-content:flex-end">
              <div class="text-[10px] ${numClass}">${d.msgs}</div>
              <div class="bar" style="width:100%;height:${pct}%;background:${barColor}"></div>
              <div class="text-[10px] ${labelClass}">${label}</div>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;

  const agentStatus = `
    <div class="card bg-panel border border-line p-[18px] flex flex-col" style="animation-delay:.26s">
      <div class="font-display font-semibold text-[15px] text-cream flex items-center gap-2 mb-3.5">
        <i data-lucide="activity" width="16" height="16" class="text-accent"></i>
        Estado del AI Concierge
      </div>
      <div class="flex flex-col gap-[11px] text-[12.5px]">
        <div class="flex items-center justify-between">
          <span class="text-muted">Modelo activo</span>
          <span class="font-semibold font-mono text-[11.5px]">${esc(agentModelLabel(env, agentCfg))}</span>
        </div>
        <div style="height:1px;background:var(--line)"></div>
        <div class="flex items-center justify-between">
          <span class="text-muted">Acciones activas</span>
          <span class="font-semibold">${agentCfg.enabledToolNames.length} <span class="text-dim font-normal">de ${toolNames.length}</span></span>
        </div>
        <div style="height:1px;background:var(--line)"></div>
        <div class="flex items-center justify-between">
          <span class="text-muted">Market Intel</span>
          <span class="font-semibold">${totalKbDocs} <span class="text-dim font-normal">(${FIXTURE_CHUNKS.length} precargados)</span></span>
        </div>
        <div style="height:1px;background:var(--line)"></div>
        <div class="flex items-center justify-between">
          <span class="text-muted">Resueltas sin humano</span>
          <span class="font-semibold ${resolvedPct7d === null ? "text-dim" : "text-ok"}">${resolvedPct7d === null ? "—" : `${resolvedPct7d}%`}</span>
        </div>
      </div>
      <a href="/admin/agente" class="bigbtn font-display font-bold text-[12.5px] cursor-pointer flex items-center justify-center gap-2"
         style="background:var(--accent);color:#1a1206;border:1px solid var(--accent);box-shadow:4px 4px 0 var(--linelit);padding:13px;margin-top:18px">
        <i data-lucide="settings-2" width="16" height="16"></i> Configurar AI Concierge
      </a>
    </div>`;

  // --- Markup: conversaciones recientes + mejoras sugeridas --------------------------
  const convRows =
    recentConvs
      .map((c) => {
        const label = c.display_name ?? c.channel_user_id ?? "—";
        const name = esc(label);
        const initials = initialsOf(label);
        const preview = esc((c.last_msg ?? "").replace(/\s+/g, " ").slice(0, 60)) || "—";
        const chanColor = c.channel === "twilio" || c.channel === "whatsapp" ? "var(--info)" : "var(--accent-2)";
        return `
        <a href="/admin/conversations?c=${encodeURIComponent(c.id)}" class="convrow flex items-center gap-3" style="padding:12px 18px;border-top:1px solid var(--line);cursor:pointer">
          <div class="flex items-center justify-center flex-none" style="width:36px;height:36px;background:var(--raise);border:1px solid var(--linelit);font-size:12px;font-weight:700;color:var(--accent)">${initials}</div>
          <div class="flex-1" style="min-width:0">
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-semibold text-cream">${name}</span>
              <span style="font-size:9px;letter-spacing:.05em;color:${chanColor};border:1px solid ${chanColor};padding:0 5px">${esc(channelLabel(c.channel))}</span>
            </div>
            <div class="text-[12px] text-muted mt-0.5" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}</div>
          </div>
          <div class="text-[10px] text-dim flex-none">${ago(c.last_message_at)}</div>
          <i data-lucide="chevron-right" width="16" height="16" class="arr flex-none" style="color:var(--accent);opacity:0;transform:translateX(-4px);transition:all .15s ease"></i>
        </a>`;
      })
      .join("") || `<div class="text-center text-[12.5px] text-dim" style="padding:32px 16px">Aún no hay conversaciones.</div>`;

  const recentConversations = `
    <div class="card bg-panel border border-line" style="animation-delay:.3s">
      <div class="flex items-center justify-between" style="padding:16px 18px 12px">
        <div class="font-display font-semibold text-[15px] text-cream flex items-center gap-2">
          <i data-lucide="messages-square" width="16" height="16" class="text-accent"></i>
          Inbox reciente
        </div>
        <a href="/admin/conversations" class="flex items-center gap-1 text-[11.5px]">ver todas <i data-lucide="arrow-right" width="13" height="13"></i></a>
      </div>
      <div>${convRows}</div>
    </div>`;

  const suggestionItems =
    proposedSuggestions.length === 0
      ? `<p class="text-[12px] text-dim">Sin mejoras pendientes.</p>`
      : proposedSuggestions
          .slice(0, 2)
          .map(
            (s) =>
              `<div class="text-[12.5px] text-cream mb-2" style="border:1px solid var(--linelit);background:var(--panel);padding:10px 12px;line-height:1.45">${esc(s.title)}</div>`,
          )
          .join("");

  const suggestedImprovements = `
    <div class="card bg-panel border border-line p-[18px] relative overflow-hidden" style="animation-delay:.34s;background:linear-gradient(160deg,var(--panel2),var(--panel));border-color:var(--linelit)">
      <div class="flex items-center gap-2 mb-1">
        <i data-lucide="sparkles" width="16" height="16" class="text-accent2"></i>
        <span class="font-display font-semibold text-[15px] text-cream">Training Lab</span>
      </div>
      <div class="text-[11px] text-dim mb-3.5">
        ${proposedSuggestions.length} ${proposedSuggestions.length === 1 ? "oportunidad detectada" : "oportunidades detectadas"} para mejorar conversión y seguimiento
      </div>
      ${suggestionItems}
      <a href="/admin/mejoras" class="flex items-center gap-1 text-[11.5px] mt-2.5">ver todas <i data-lucide="arrow-right" width="13" height="13"></i></a>
    </div>`;

  const body = `
    <div class="flex flex-col gap-[22px]">
      <section class="card" style="border:1px solid var(--line);background:linear-gradient(135deg,var(--panel),var(--panel2));padding:20px"><div style="display:flex;justify-content:space-between;gap:18px;align-items:start;flex-wrap:wrap"><div><div style="font-size:10px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase">Today’s Deal Desk</div><h2 style="font-family:'Space Grotesk';font-size:25px;margin:6px 0">Tu operación inmobiliaria, priorizada.</h2><p class="text-dim" style="font-size:12px;margin:0;max-width:560px">El concierge convierte WhatsApp en perfiles completos. Empieza por los leads con intención, presupuesto y plazo definidos.</p></div><a class="bigbtn" href="/admin/qualification" style="background:var(--accent);color:#10130e;padding:11px 14px;border:1px solid var(--accent);font-size:11px;font-weight:700">+ CALIFICAR LEAD</a></div></section>
      <section class="grid grid-cols-1 lg:grid-cols-[1.25fr_.75fr] gap-[14px]">${qualificationFunnel}<div class="card" style="border:1px solid var(--line);background:var(--panel);padding:18px"><div style="font-size:10px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase">Act Now</div><h2 style="font-family:'Space Grotesk';font-size:19px;margin:5px 0 8px">Leads que merecen atención</h2>${actNow}<a href="/admin/pipelines" style="display:inline-block;margin-top:12px;font-size:11px">Ver pipeline →</a></div></section>
      <section class="grid grid-cols-1 lg:grid-cols-[.9fr_1.1fr] gap-[14px]">${responseHealth}<div class="card" style="border:1px solid var(--line);background:var(--panel);padding:18px"><div style="font-size:10px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase">Follow-up Playbook</div><h2 style="font-family:'Space Grotesk';font-size:19px;margin:5px 0 8px">El siguiente toque, con intención</h2><p class="text-muted" style="font-size:12px;line-height:1.5;margin:0">Usa campañas solo para conversaciones fuera de la ventana; dentro de las 24 horas, responde desde Inbox con el contexto completo.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px"><a href="/admin/campanas" class="ghostbtn" style="padding:8px 10px;font-size:11px">Preparar campaña</a><a href="/admin/leads" class="ghostbtn" style="padding:8px 10px;font-size:11px">Revisar dossiers</a></div></div></section>
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <div class="card bg-panel border border-line p-4 relative overflow-hidden" style="animation-delay:.02s">
          <div class="absolute top-3 right-3 text-[9.5px] tracking-[.2em] text-dim uppercase">01</div>
          <div class="flex items-center gap-2 text-muted">
            <i data-lucide="message-circle" width="15" height="15"></i>
            <span class="text-[11px] tracking-[.05em]">MENSAJES HOY</span>
          </div>
          <div class="glow font-display font-bold text-[38px] leading-none mt-3">${todayMsgs}</div>
          <div class="text-[11px] text-dim mt-2">últimas 24 horas</div>
        </div>

        <div class="card bg-panel border border-line p-4 relative overflow-hidden" style="animation-delay:.06s">
          <div class="absolute top-3 right-3 text-[9.5px] tracking-[.2em] text-dim uppercase">02</div>
          <div class="flex items-center gap-2 text-muted">
            <i data-lucide="users" width="15" height="15"></i>
            <span class="text-[11px] tracking-[.05em]">CONVERSACIONES ACTIVAS</span>
          </div>
          <div class="glow font-display font-bold text-[38px] leading-none mt-3">${todayConvs}</div>
          <div class="text-[11px] text-dim mt-2">conversaciones distintas hoy</div>
        </div>

        <div class="card bg-panel border border-line p-4 relative overflow-hidden" style="animation-delay:.1s">
          <div class="absolute top-3 right-3 text-[9.5px] tracking-[.2em] text-dim uppercase">03</div>
          <div class="flex items-center gap-2 text-muted">
            <i data-lucide="${niche.navIcon}" width="15" height="15"></i>
            <span class="text-[11px] tracking-[.05em]">${niche.kpiLabel.toUpperCase()}</span>
          </div>
          <div class="glow font-display font-bold text-[38px] leading-none mt-3 text-accent">${todayLeads}</div>
          <div class="text-[11px] text-dim mt-2">nuevos hoy</div>
        </div>

        <div class="card bg-panel border border-line p-4 relative overflow-hidden" style="animation-delay:.14s">
          <div class="absolute top-3 right-3 text-[9.5px] tracking-[.2em] text-dim uppercase">04</div>
          <div class="flex items-center gap-2 text-muted">
            <i data-lucide="coins" width="15" height="15"></i>
            <span class="text-[11px] tracking-[.05em]">AI SPEND · MES</span>
          </div>
          <div class="glow font-display font-bold text-[38px] leading-none mt-3">$${totalCost.toFixed(2)}</div>
          <div class="text-[11px] text-dim mt-2">${monthMsgs} mensajes · IA · 30 días</div>
        </div>
      </section>

      <section class="card bg-panel border border-line p-[18px]" style="animation-delay:.18s">
        <div class="flex items-center justify-between">
          <div class="font-display font-semibold text-[15px] text-cream flex items-center gap-2">
            <i data-lucide="activity" width="16" height="16" class="text-accent"></i>
            Salud de operación
          </div>
          <a href="/admin/tickets" class="flex items-center gap-1 text-[11.5px]">
            ver tickets <i data-lucide="arrow-right" width="13" height="13"></i>
          </a>
        </div>
        <div class="mt-3" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${
            openTickets > 0
              ? `<span style="font-size:9px;color:var(--bad);border:1px solid var(--bad);padding:1px 6px">⚠ ${openTickets} tickets abiertos</span>`
              : `<span style="font-size:9px;color:var(--ok);border:1px solid var(--ok);padding:1px 6px">✓ 0 tickets abiertos</span>`
          }
          ${(() => {
            // Cuando el bot escala a humano, ¿alguien se entera? Antes esto
            // fallaba en silencio; ahora se ve aquí en rojo si falta configurar.
            const notify = handoffNotifyStatus(env);
            return notify.ok
              ? `<span style="font-size:9px;color:var(--ok);border:1px solid var(--ok);padding:1px 6px">✓ escalación notifica por ${notify.channels.join(" + ")}</span>`
              : `<span style="font-size:9px;color:var(--bad);border:1px solid var(--bad);padding:1px 6px">⚠ ESCALACIÓN SIN AVISO — configura Telegram, WhatsApp o email del equipo</span>`;
          })()}
          ${(() => {
            const conn = connectionsSummary(env);
            const ok = conn.connected > 0;
            return `<a href="/admin/conexiones" style="font-size:9px;color:${ok ? "var(--ok)" : "var(--bad)"};border:1px solid ${ok ? "var(--ok)" : "var(--bad)"};padding:1px 6px;text-decoration:none">${ok ? "✓" : "⚠"} ${conn.connected}/${conn.total} canales conectados</a>`;
          })()}
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[14px]">
        ${activityChart}
        ${agentStatus}
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[14px]">
        ${recentConversations}
        ${suggestedImprovements}
      </section>
    </div>`;

  return layout({ title: "Hawk Guru Realtor Suite", activeTab: "overview", body, env });
}
