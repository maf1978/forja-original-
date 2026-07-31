import type { Env } from "../../env";
import { layout } from "./layout";

const esc = (s: unknown) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function renderQualification(env: Env, created?: { score: string; tags: string; next: string }): string {
  const result = created
    ? `<div style="border:1px solid var(--accent);background:var(--accent-soft);padding:14px;margin-bottom:18px;font-size:12px"><b>Prospecto calificado: ${esc(created.score)}/100</b> · tags: ${esc(created.tags)}<br><span class="text-dim">Siguiente acción: ${esc(created.next)}</span></div>`
    : "";
  const body = `${result}
  <div class="card" style="max-width:760px;border:1px solid var(--line);background:var(--panel);padding:22px">
    <div style="font-size:10px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase">Hawk Guru Realtor Suite</div>
    <h2 style="font-family:'Space Grotesk';font-size:23px;margin:7px 0">Realtor Readiness Quiz</h2>
    <p class="text-dim" style="font-size:12px;line-height:1.55;margin:0 0 20px">Cinco preguntas para decidir prioridad, tags y pipeline. El resultado sugiere el próximo paso; no envía mensajes ni cierra etapas automáticamente.</p>
    <form method="post" action="/admin/qualification">
      <label style="display:block;font-size:12px;font-weight:600">1 · ¿Qué necesita hoy?</label>
      <select name="operation" required style="width:100%;margin:7px 0 16px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"><option value="buyer">Comprar</option><option value="seller">Vender</option><option value="renter">Rentar</option></select>
      <label style="display:block;font-size:12px;font-weight:600">2 · Zona, tipo de propiedad y presupuesto aproximado</label>
      <input name="area" required placeholder="Ej. Doral, condo 2 habitaciones" style="width:100%;box-sizing:border-box;margin:7px 0 8px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)">
      <input name="budget" placeholder="Presupuesto o rango (opcional)" style="width:100%;box-sizing:border-box;margin:0 0 16px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)">
      <label style="display:block;font-size:12px;font-weight:600">3 · ¿Cuándo quiere avanzar?</label>
      <select name="timeline" required style="width:100%;margin:7px 0 16px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"><option value="0-30 días">0–30 días</option><option value="1-3 meses">1–3 meses</option><option value="3-6 meses">3–6 meses</option><option value="explorando">Solo explorando</option></select>
      <label style="display:block;font-size:12px;font-weight:600">4 · ¿Cuál es su nivel de preparación?</label>
      <select name="readiness" required style="width:100%;margin:7px 0 16px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"><option value="ready">Listo para avanzar / documentación disponible</option><option value="needs-guidance">Necesita orientación financiera o del proceso</option><option value="valuation">Solicita valoración de propiedad</option><option value="move-in-ready">Fecha de mudanza definida</option><option value="exploring">Aún comparando opciones</option></select>
      <label style="display:block;font-size:12px;font-weight:600">5 · ¿Cuál es el mejor siguiente paso?</label>
      <select name="next_step" required style="width:100%;margin:7px 0 16px;padding:10px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"><option value="call">Llamada breve</option><option value="appointment">Cita o valoración</option><option value="whatsapp">Recibir opciones por WhatsApp</option><option value="questions">Aún tiene preguntas</option></select>
      <details style="margin:0 0 16px"><summary style="cursor:pointer;font-size:12px;color:var(--muted)">Datos opcionales para el CRM</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><input name="name" placeholder="Nombre" style="padding:9px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"><input name="contact" placeholder="Teléfono o email" style="padding:9px;background:var(--bg);border:1px solid var(--line);color:var(--cream)"></div></details>
      <button class="btn" style="border:1px solid var(--accent);background:var(--accent-soft);padding:10px 16px;font-weight:700;cursor:pointer">CALIFICAR Y AGREGAR AL PIPELINE</button>
    </form>
  </div>`;
  return layout({ title: "Lead Qualification", activeTab: "qualification", body, env });
}
