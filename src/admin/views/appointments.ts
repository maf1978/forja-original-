import type { Env } from "../../env";
import { Db } from "../../db/client";
import { calcomConfigured, calcomTimeZone } from "../../integrations/calcom";
import { layout } from "./layout";

const esc = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

interface AppointmentRequest {
  lead_id: string;
  conversation_id: string | null;
  name: string | null;
  contact: string | null;
  score: number;
  next_action: string | null;
  metadata: string | null;
  updated_at: number;
}

function leadContext(raw: string | null): Record<string, string> {
  try {
    const value = JSON.parse(raw ?? "{}");
    return value && typeof value === "object" ? value as Record<string, string> : {};
  } catch {
    return {};
  }
}

export async function renderAppointments(env: Env): Promise<string> {
  const db = new Db(env.DB);
  const requests = await db.all<AppointmentRequest>(
    `SELECT l.id lead_id, l.conversation_id, l.name, l.contact, r.score, r.next_action, l.metadata, r.updated_at
     FROM realtor_lead_pipeline r
     JOIN leads l ON l.id = r.lead_id
     JOIN realtor_lead_tags lt ON lt.lead_id = l.id
     JOIN realtor_tags t ON t.id = lt.tag_id
     WHERE t.slug = 'appointment-requested'
     ORDER BY r.score DESC, r.updated_at DESC`,
  );
  const calendarReady = calcomConfigured(env);
  const requestRows = requests.map((lead) => {
    const meta = leadContext(lead.metadata);
    const operation = meta.operation === "seller" ? "Vender" : meta.operation === "renter" ? "Rentar" : "Comprar";
    const detail = [meta.area, meta.budget, meta.timeline].filter(Boolean).join(" · ") || "Perfil pendiente de completar";
    const href = lead.conversation_id ? `/admin/conversations?c=${encodeURIComponent(lead.conversation_id)}` : "/admin/leads";
    return `<article style="border:1px solid var(--line);background:var(--panel);padding:15px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center">
      <div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-family:'Space Grotesk';font-size:15px">${esc(lead.name || "Prospecto sin nombre")}</b><span style="font-size:9px;letter-spacing:.1em;color:var(--accent);border:1px solid var(--accent);padding:2px 5px">${operation}</span><span style="font-size:10px;color:var(--accent2)">${lead.score}/100</span></div><div style="font-size:11px;color:var(--muted);margin-top:5px">${esc(detail)}</div><div style="font-size:10px;color:var(--dim);margin-top:7px">${esc(lead.contact || "Sin teléfono o email")} · ${esc(lead.next_action || "Coordinar siguiente paso")}</div></div>
      <a href="${href}" class="ghostbtn" style="white-space:nowrap;padding:8px 10px;font-size:11px">Abrir contexto →</a>
    </article>`;
  }).join("") || `<div style="padding:36px;text-align:center;color:var(--dim);font-size:12px">Aún no hay solicitudes de cita. Cuando un lead elija “Cita o valoración” durante la calificación, aparecerá aquí.</div>`;

  const calendarState = calendarReady
    ? `<div style="color:var(--ok);font-size:12px">● Cal.com conectado · ${esc(calcomTimeZone(env))}</div><p style="font-size:11px;color:var(--muted);line-height:1.5;margin:8px 0 0">El Concierge puede usar la disponibilidad real configurada en Cal.com. Confirma cada booking desde el calendario antes de mover el pipeline.</p>`
    : `<div style="color:var(--accent);font-size:12px">○ Calendario pendiente de conectar</div><p style="font-size:11px;color:var(--muted);line-height:1.5;margin:8px 0 0">Las solicitudes se guardan aquí; todavía no se crea ninguna reserva. Para activar agenda real, configura <code>CALCOM_API_KEY</code> y un event type en Cloudflare.</p>`;

  const body = `<div style="display:flex;flex-direction:column;gap:18px"><section class="card" style="border:1px solid var(--line);background:linear-gradient(135deg,var(--panel),var(--panel2));padding:20px"><div style="display:flex;justify-content:space-between;gap:16px;align-items:start;flex-wrap:wrap"><div><div style="font-size:10px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase">Appointment Hub</div><h2 style="font-family:'Space Grotesk';font-size:24px;margin:6px 0">Convierte intención en conversación.</h2><p style="font-size:12px;line-height:1.5;color:var(--muted);max-width:620px;margin:0">Centraliza las citas solicitadas por compradores, vendedores y renters. El equipo conserva la decisión final y el contexto antes de confirmar.</p></div><div style="border:1px solid var(--line);background:var(--bg);padding:12px;min-width:250px">${calendarState}</div></div></section><section class="card" style="border:1px solid var(--line);background:var(--bg)"><div style="display:flex;justify-content:space-between;align-items:baseline;padding:15px 16px 10px"><div><div style="font-size:10px;letter-spacing:.14em;color:var(--accent);text-transform:uppercase">Solicitudes reales</div><h3 style="font-family:'Space Grotesk';font-size:18px;margin:4px 0">${requests.length} esperando coordinación</h3></div><a href="/admin/qualification" style="font-size:11px">Crear calificación →</a></div><div style="display:flex;flex-direction:column;gap:8px;padding:0 12px 12px">${requestRows}</div></section></div>`;
  return layout({ title: "Citas", activeTab: "appointments", body, env });
}
