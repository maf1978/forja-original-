// Tab "Conocimiento" — la KB editable desde el dashboard (F4).
//
// El dueño escribe documentos (horarios, políticas, FAQ, promos) y quedan
// indexados en Vectorize AL GUARDAR: el bot los usa vía searchKb desde el
// siguiente mensaje. Los fragmentos precargados del repo conviven con estos.
import type { Env } from "../../env";
import { Db } from "../../db/client";
import { KbDocsRepo, FIXTURE_CHUNKS, MAX_DOC_CHARS, chunkContent, type KbDoc } from "../../kb/docs";
import { layout } from "./layout";

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!),
  );
}

function ago(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Callout banner. `tone` picks the token: ok=verde (éxito), bad=rojo (error), neutral=gris (info). */
function banner(tone: "ok" | "bad" | "neutral", text: string): string {
  const color = tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--dim)";
  const bg = tone === "ok" ? "rgba(127,183,126,.1)" : tone === "bad" ? "rgba(217,122,106,.1)" : "var(--panel2)";
  return `<div style="border:1px solid ${color};background:${bg};color:${tone === "neutral" ? "var(--muted)" : color};padding:10px 14px;font-size:12.5px;margin-bottom:16px">${text}</div>`;
}

type ListingSnapshot = {
  doc: KbDoc;
  address: string;
  price: string;
  status: "available" | "under-contract" | "sold" | "unknown";
  zone: string;
};

/** A Listing verificado is still a KB document (so the AI can retrieve it),
 * but this small projection gives the human team a reliable property board. */
function listingSnapshot(doc: KbDoc): ListingSnapshot | null {
  if (!doc.title.toLowerCase().startsWith("listing verificado")) return null;
  const field = (name: string): string => {
    const match = doc.content.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
    return match?.[1]?.trim() ?? "";
  };
  const rawStatus = field("Estatus").toLowerCase();
  const status = rawStatus.includes("vendido")
    ? "sold"
    : rawStatus.includes("contrato") || rawStatus.includes("oferta")
      ? "under-contract"
      : rawStatus.includes("disponible")
        ? "available"
        : "unknown";
  return { doc, address: field("Dirección") || doc.title.replace(/^listing verificado\s*·?\s*/i, ""), price: field("Precio"), status, zone: field("Zona") };
}

function renderListingBoard(listings: ListingSnapshot[]): string {
  if (!listings.length) return "";
  const labels = { available: "Disponible", "under-contract": "Bajo contrato", sold: "Vendido", unknown: "Por confirmar" };
  const colors = { available: "var(--ok)", "under-contract": "var(--accent)", sold: "var(--dim)", unknown: "var(--bad)" };
  return `<section style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><div style="font-size:10px;letter-spacing:.14em;color:var(--accent)">PROPERTY INTELLIGENCE</div><span class="text-dim text-[10.5px]">${listings.length} ${listings.length === 1 ? "propiedad verificada" : "propiedades verificadas"}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px">${listings.map((listing) => `<a href="/admin/kb/${encodeURIComponent(listing.doc.id)}/edit" style="display:block;border:1px solid var(--line);background:var(--panel);padding:13px;text-decoration:none"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><b class="text-cream" style="font-size:12px;line-height:1.35">${esc(listing.address || "Dirección por confirmar")}</b><span style="font-size:9px;letter-spacing:.06em;color:${colors[listing.status]};border:1px solid ${colors[listing.status]};padding:3px 5px;white-space:nowrap">${labels[listing.status]}</span></div>${listing.price ? `<div style="font-size:14px;color:var(--accent);font-family:'Space Grotesk';font-weight:700;margin-top:10px">${esc(listing.price)}</div>` : `<div class="text-dim" style="font-size:11px;margin-top:10px">Precio por confirmar</div>`}${listing.zone ? `<div class="text-muted" style="font-size:10.5px;margin-top:5px">${esc(listing.zone)}</div>` : ""}</a>`).join("")}</div></section>`;
}

export async function renderKbList(
  env: Env,
  flash?: { saved?: boolean; deleted?: boolean; reindexed?: string },
): Promise<string> {
  const docs = await new KbDocsRepo(new Db(env.DB)).list();
  const listings = docs.map(listingSnapshot).filter((listing): listing is ListingSnapshot => listing !== null);

  const bannerHtml = flash?.saved
    ? banner("ok", "✓ Guardado e indexado — el bot ya puede usarlo.")
    : flash?.deleted
      ? banner("neutral", "Documento eliminado (también del índice del bot).")
      : flash?.reindexed
        ? banner("ok", `✓ Reindexado: ${esc(flash.reindexed)} fragmentos actualizados.`)
        : "";

  const rows = docs.length
    ? docs
        .map((d) => {
          const chunks = chunkContent(d.content).length;
          return `
      <div class="kbrow" style="display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--line);transition:background .12s ease">
        <div style="min-width:0;flex:1">
          <a href="/admin/kb/${encodeURIComponent(d.id)}/edit" class="font-display font-semibold text-[13px] text-cream" style="display:block">${esc(d.title)}</a>
          <div class="text-dim text-[11.5px]" style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.content.replace(/\s+/g, " ").slice(0, 90))}</div>
        </div>
        <div class="text-dim text-[10.5px]" style="text-align:right;white-space:nowrap;flex:none">
          <div>${d.content.length.toLocaleString("es-MX")} caracteres · ${chunks} ${chunks === 1 ? "fragmento" : "fragmentos"}</div>
          <div>${ago(d.updated_at)}</div>
        </div>
        <a href="/admin/kb/${encodeURIComponent(d.id)}/edit" class="kbedit" style="border:1px solid var(--line);color:var(--muted);padding:5px 12px;font-size:11px;white-space:nowrap;transition:all .12s ease;flex:none">Editar</a>
      </div>`;
        })
        .join("")
    : `<div class="text-dim text-[12.5px]" style="padding:40px 18px;text-align:center">
         Aún no tienes documentos propios. Crea el primero — horarios, precios, políticas, promociones…
       </div>`;

  const body = `
    ${bannerHtml}
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px">
      <div>
        <h2 class="font-display font-semibold text-[15px] text-cream">📚 Conocimiento del bot</h2>
        <p class="text-muted text-[12.5px]" style="margin-top:2px">Lo que tu bot sabe del negocio. Cada documento se indexa al guardar y el bot lo usa de inmediato.</p>
      </div>
      <a href="/admin/kb/new" class="bigbtn font-display font-bold text-[12.5px] cursor-pointer"
         style="margin-left:auto;background:var(--accent);border:1px solid var(--accent);color:#1a1206;box-shadow:3px 3px 0 var(--linelit);padding:9px 16px;display:flex;align-items:center;gap:8px;white-space:nowrap">
        <i data-lucide="plus" width="14" height="14"></i> Nuevo documento
      </a>
      <a href="/admin/kb/new?template=listing" class="ghostbtn" style="border:1px solid var(--line);padding:9px 12px;font-size:11px">＋ Listing verificado</a>
    </div>

    ${renderListingBoard(listings)}

    <div class="bg-panel border border-line" style="margin-bottom:16px;overflow:hidden">
      ${rows}
    </div>

    <div style="border:1px solid var(--line);background:var(--panel2);padding:14px;margin-bottom:16px"><div style="font-size:10px;letter-spacing:.14em;color:var(--accent)">PROPERTY INTELLIGENCE</div><p class="text-muted text-[11.5px]" style="line-height:1.5;margin:7px 0 0">Usa “Listing verificado” para cargar dirección, precio, estatus, características y Open House. El bot solo debe recomendar información que esté aquí confirmada. Marca “bajo contrato” o “vendido” antes de que un agente la siga ofreciendo.</p></div>

    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px" class="text-dim text-[11.5px]">
      <span>Además, tu bot trae <b class="text-cream">${FIXTURE_CHUNKS.length}</b> fragmentos precargados del repo.</span>
      <form method="POST" action="/admin/kb/reindex" style="margin-left:auto">
        <button class="ghostbtn cursor-pointer" style="display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);color:var(--muted);padding:8px 14px;font-size:11.5px;transition:all .12s ease">
          <i data-lucide="refresh-cw" width="13" height="13"></i> Reindexar todo
        </button>
      </form>
    </div>`;

  return layout({ title: "Market Intel", activeTab: "kb", body, env });
}

export function renderKbEditor(doc: KbDoc | null, env: Env, template?: string): string {
  const isNew = doc === null;
  const listing = isNew && template === "listing";
  const defaultTitle = listing ? "Listing verificado · [Dirección]" : "";
  const defaultContent = listing ? "Dirección: \nEstatus: disponible / bajo contrato / vendido\nPrecio: \nTipo y características: \nZona: \nOpen House: \nCTA permitido: \nNotas para el agente: confirmar disponibilidad y precio antes de prometerlos." : "";
  const body = `
    <div style="margin-bottom:16px">
      <a href="/admin/kb" style="font-size:12.5px;display:inline-flex;align-items:center;gap:6px">
        <i data-lucide="arrow-left" width="14" height="14"></i> Volver a Conocimiento
      </a>
    </div>
    <form method="POST" action="/admin/kb/save" class="bg-panel border border-line" style="padding:22px;display:flex;flex-direction:column;gap:18px">
      <h2 class="font-display font-semibold text-[15px] text-cream">${isNew ? "＋ Nuevo documento" : "Editar documento"}</h2>
      ${isNew ? "" : `<input type="hidden" name="id" value="${esc(doc.id)}">`}

      <div style="display:flex;flex-direction:column;gap:6px">
        <label for="title" class="font-display font-semibold text-[12.5px] text-cream">Título</label>
        <p class="text-dim text-[11px]">Un nombre claro del tema (el bot lo ve como contexto).</p>
        <input type="text" id="title" name="title" required maxlength="200"
               value="${esc(doc?.title ?? defaultTitle)}" placeholder="Ej. Horarios y ubicación"
               style="background:var(--bg);border:1px solid var(--line);color:var(--cream);padding:10px 12px;font-size:12.5px;outline:none">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <label for="content" class="font-display font-semibold text-[12.5px] text-cream">Contenido</label>
        <p class="text-dim text-[11px]">Escribe en lenguaje natural, como se lo explicarías a un empleado nuevo. Máximo ${MAX_DOC_CHARS.toLocaleString("es-MX")} caracteres.</p>
        <textarea id="content" name="content" rows="14" required maxlength="${MAX_DOC_CHARS}"
                  placeholder="Ej. Abrimos de lunes a sábado de 9am a 7pm. Los domingos cerramos. Estamos en Av. Reforma 123, a dos cuadras del metro…"
                  style="background:var(--bg);border:1px solid var(--line);color:var(--cream);padding:10px 12px;font-size:12.5px;outline:none;resize:vertical">${esc(doc?.content ?? defaultContent)}</textarea>
      </div>

      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <button type="submit" class="bigbtn font-display font-bold text-[12.5px] cursor-pointer"
                style="background:var(--accent);border:1px solid var(--accent);color:#1a1206;box-shadow:4px 4px 0 var(--linelit);padding:11px 20px">Guardar e indexar</button>
        ${isNew ? "" : `
        <details style="margin-left:auto">
          <summary class="text-bad text-[12px]" style="cursor:pointer;list-style:none">Eliminar documento…</summary>
          <span style="display:inline-flex;align-items:center;gap:10px;margin-top:8px">
            <span class="text-dim text-[11px]">¿Seguro? El bot dejará de saber esto.</span>
            <button type="submit" formaction="/admin/kb/${encodeURIComponent(doc.id)}/delete" formnovalidate
                    style="background:transparent;border:1px solid var(--bad);color:var(--bad);padding:6px 12px;font-size:11px;cursor:pointer">Sí, eliminar</button>
          </span>
        </details>`}
      </div>
    </form>`;

  return layout({ title: isNew ? "Nuevo documento" : "Editar documento", activeTab: "kb", body, env });
}
