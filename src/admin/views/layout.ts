// HAWK GURU REALTOR DESK — direction contract
// THESIS: a private Realtor office, not a generic bot control center.
// OWN-WORLD: limestone surfaces, ink-blue navigation and copper as the action signal.
// STORY: each page frames leads, listings and follow-ups as decisions to review.
// FIRST VIEWPORT: a slim monogram rail, a calm workspace header and the day's work.
// FORM: private-office desk, candidate 3 from the operated-surface structural pass.
// Dashboard shell for Hawk Guru Realtor Suite: an operational command center
// for pipeline, conversations and lead intelligence.
// lines. Design tokens are exposed both as CSS custom properties (for inline
// styles) and mapped to Tailwind color names (for utility classes) — see
// docs/design-system.md, the contract every view follows.
//
// The layout() API is unchanged: views keep their own activeTab id; the group,
// breadcrumb and page title are derived here.

import type { Env } from "../../env";
import { isPro, PRO_ONLY_TABS } from "../../config";
import { getNiche } from "../../niches";
import type { NichePack } from "../../niches";

const UPGRADE_URL = "/admin/upgrade";

interface Item {
  id: string;
  label: string;
  href: string;
  icon: string; // lucide icon name
}

interface Section {
  label: string;
  items: Item[];
}

// Navigation model. The item ids + hrefs are load-bearing (views and tests
// depend on them) — do not rename them. Icons are lucide names.
const NAV: Section[] = [
  {
    label: "Command Center",
    items: [{ id: "overview", label: "Inicio", href: "/admin/overview", icon: "layout-dashboard" }],
  },
  {
    label: "Lead Operations",
    items: [
      { id: "conversations", label: "Inbox", href: "/admin/conversations", icon: "messages-square" },
      { id: "leads", label: "Prospectos", href: "/admin/leads", icon: "house" },
      { id: "tickets", label: "Escalaciones", href: "/admin/tickets", icon: "life-buoy" },
      { id: "campanas", label: "Follow-up", href: "/admin/campanas", icon: "megaphone" },
    ],
  },
  {
    label: "AI Realtor",
    items: [
      { id: "agente", label: "AI Concierge", href: "/admin/agente", icon: "workflow" },
      { id: "kb", label: "Market Intel", href: "/admin/kb", icon: "book-open" },
      { id: "mejoras", label: "Training Lab", href: "/admin/mejoras", icon: "sparkles" },
      { id: "conexiones", label: "Canales", href: "/admin/conexiones", icon: "plug-zap" },
      { id: "config", label: "Settings", href: "/admin/config", icon: "sliders-horizontal" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { id: "insights", label: "Conversation Intel", href: "/admin/insights", icon: "scan-eye" },
      { id: "stats", label: "Conversion Intel", href: "/admin/stats", icon: "bar-chart-3" },
      { id: "costs", label: "AI Spend", href: "/admin/costs", icon: "receipt" },
    ],
  },
];

// <head> assets: fonts, Tailwind CDN + token config, lucide, htmx.
const HEAD_ASSETS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          // Apuntan a las CSS custom properties de :root — UNA sola fuente de
          // verdad. Antes la paleta estaba escrita DOS veces (aqui y en :root) y
          // podian desincronizarse: cambiar un token no movia nada en pantalla,
          // porque las vistas usan sobre todo las clases de Tailwind.
          //
          // ok / info / bad / violet quedan literales A PROPOSITO: se usan con
          // modificadores de opacidad (bg-ok/10) y eso no funciona con var().
          colors: {
            bg: "var(--bg)", panel: "var(--panel)", panel2: "var(--panel2)", raise: "var(--raise)",
            line: "var(--line)", linelit: "var(--linelit)",
            accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", soft: "var(--accent-soft)" },
            accent2: "var(--accent-2)",
            cream: "var(--cream)", muted: "var(--muted)", dim: "var(--dim)",
            ok: "#5fd39b", info: "#6fc0e8", bad: "#ff8868", violet: "#b9a8f0",
          },
          fontFamily: {
            display: ["'Manrope'", "ui-sans-serif", "system-ui", "sans-serif"],
            mono: ["'Roboto Mono'", "ui-monospace", "monospace"],
          },
        },
      },
    };
  </script>
  <script src="https://unpkg.com/lucide@latest"></script>`;

// Global stylesheet: design tokens, base type/scroll, the reusable component
// classes from the mockups (buttons, rows, cards, chips, canvas nodes), the
// modal/toast/range classes existing views already depend on, and the scanline
// overlay. All motion collapses under prefers-reduced-motion.
const GLOBAL_STYLE = `
<style>
  :root{
    /* "Deal Desk After Dark" — la paleta oscura de DESIGN.md. Cada par
       texto/fondo verificado contra WCAG AA (4.5 texto, 3.0 componentes). */
    --bg:#09100d; --panel:#111a15; --panel2:#16211b; --raise:#1c2a22;
    --line:#3a4f3d; --linelit:#516b54;
    /* --on-accent es el texto que va ENCIMA del acento. Con lime va tinta
       oscura, nunca blanco. Token semantico: si el tema cambia otra vez, los
       botones no quedan ilegibles. */
    --accent:#c7ff4d; --accent-ink:#c7ff4d; --on-accent:#09100d;
    --accent-2:#9fe08a; --accent-soft:rgba(199,255,77,.12);
    --cream:#dce7d7; --muted:#a8b8a6; --dim:#8a9a89;
    --ok:#5fd39b; --info:#6fc0e8; --bad:#ff8868; --violet:#b9a8f0;
    /* legacy aliases kept so mockup-derived snippets keep working */
    --border:#3a4f3d; --border-lit:#516b54; --green:#5fd39b; --blue:#6fc0e8; --red:#ff8868;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--cream);
    font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none}
  a:hover{color:var(--accent-2)}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-track{background:var(--bg)}
  ::-webkit-scrollbar-thumb{background:var(--linelit);border-radius:999px}
  ::-webkit-scrollbar-thumb:hover{background:var(--accent)}
  input,textarea,select{font-family:inherit}
  input::placeholder,textarea::placeholder{color:var(--dim)}
  input[type="range"]{accent-color:var(--accent);height:4px}

  /* keyframes */
  @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.82)}}
  @keyframes ring{0%{box-shadow:0 0 0 0 rgba(127,183,126,.5)}100%{box-shadow:0 0 0 8px rgba(127,183,126,0)}}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes popIn{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes toastOut{to{opacity:0;transform:translateY(8px);visibility:hidden}}

  .scanlines::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:200;
    background:linear-gradient(90deg,transparent 0,rgba(23,70,90,.018) 50%,transparent 100%)}

  /* sidebar nav */
  .navlink:hover{background:var(--panel2);color:var(--cream)}

  /* entrance + brutalist buttons */
  .card{animation:rise .3s cubic-bezier(.16,1,.3,1) both;border-radius:14px}
  .bigbtn{transition:transform .12s ease,box-shadow .12s ease}
  .bigbtn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,.45)}
  .bigbtn:active{transform:translateY(0);box-shadow:none}
  .ghostbtn:hover{border-color:var(--accent);color:var(--cream);background:var(--accent-soft)}
  .glow{letter-spacing:-.045em}

  /* list / table rows + interactive bits reused across views */
  .convrow:hover{background:var(--panel2)}
  .convrow:hover .arr{opacity:1;transform:translateX(0)}
  .leadrow:hover{background:var(--panel2)}
  .datarow:hover{background:var(--panel2)}
  .kbrow:hover{background:var(--panel2)}
  .kbrow:hover .kbedit{border-color:var(--accent);color:var(--accent)}
  .tkcard{transition:transform .12s ease,border-color .12s ease}
  .tkcard:hover{border-color:var(--linelit);transform:translateY(-1px)}
  .subtab{transition:all .12s ease;cursor:pointer}
  .subtab:hover{color:var(--cream)}
  .chip:hover{border-color:var(--accent);color:var(--accent)}
  .cfgcard{transition:all .12s ease;cursor:pointer}
  .cfgcard:hover{border-color:var(--linelit)}
  .bar{transition:transform .5s cubic-bezier(.16,1,.3,1)}
  .bargrp:hover .bar{background:var(--accent) !important}

  /* flow-canvas node (mockup ".node") + the existing views' ".node-card" */
  .node{transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease;cursor:pointer}
  .node:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:4px 4px 0 var(--linelit)}
  .node-card{transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
  .node-card:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:4px 4px 0 var(--linelit)}

  /* modal + toast (class names kept from prior layout for existing views) */
  .modal-backdrop{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;
    padding:1rem;background:rgba(10,8,4,.6);animation:fadeIn .15s ease-out}
  .modal-card{background:var(--panel);border:1px solid var(--linelit);box-shadow:8px 8px 0 rgba(0,0,0,.4);
    animation:popIn .18s cubic-bezier(.16,1,.3,1);transform-origin:center}
  .toast{background:var(--panel);border:1px solid var(--linelit);color:var(--cream);box-shadow:4px 4px 0 var(--linelit);
    animation:toastIn .25s cubic-bezier(.16,1,.3,1),toastOut .3s ease-in 2.4s forwards}

  /* app shell */
  .shell{min-height:100vh;display:grid;grid-template-columns:232px minmax(0,1fr);background:var(--bg)}
  .sb{background:var(--panel);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:40;border-right:1px solid var(--line)}
  .sb-nav{padding:16px 12px;display:flex;flex-direction:column;gap:3px;flex:1;overflow-y:auto}
  .sb-sec{margin:16px 9px 7px;color:var(--muted)!important;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
  .live-pill{display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:7px 11px;box-shadow:0 3px 12px rgba(0,0,0,.35)}

  @media (max-width:767px){
    .shell{grid-template-columns:1fr}
    .sb{position:sticky;top:0;height:auto;flex-direction:row;align-items:center;border-right:none;overflow-x:auto}
    .sb-brand{flex:none;border-bottom:none !important;border-right:1px solid var(--line)}
    .sb-nav{flex-direction:row;align-items:center;gap:4px;padding:8px 10px;overflow-y:visible;overflow-x:auto}
    .sb-sec{display:none}
    .sb-foot{display:none}
    .navlink{width:auto!important;height:auto!important;border-left:none !important;white-space:nowrap;border-bottom:2px solid transparent}
  }

  @media (prefers-reduced-motion:reduce){
    .card,.toast,.modal-backdrop,.modal-card{animation:none}
    .bigbtn,.ghostbtn,.convrow,.leadrow,.datarow,.kbrow,.tkcard,.subtab,.chip,.cfgcard,.node,.node-card,.bar,.navlink{transition:none}
    .bigbtn:hover,.node:hover,.node-card:hover,.tkcard:hover{transform:none}
    .animate-pulse,[style*="animation"]{animation:none !important}
  }
</style>`;

// Re-run lucide after every htmx swap (fragments bring fresh icons) and close
// any open modal with Escape.
const GLOBAL_SCRIPT = `
<script>
  function drawIcons(){ if (window.lucide) window.lucide.createIcons(); }
  document.addEventListener("DOMContentLoaded", drawIcons);
  // lucide's unpkg script may resolve after DOMContentLoaded — retry briefly.
  (function(){ var n=0; var t=setInterval(function(){ if(window.lucide){drawIcons();clearInterval(t);} if(++n>25) clearInterval(t); },120); })();
  document.body.addEventListener("htmx:afterSwap", drawIcons);
  document.body.addEventListener("htmx:oobAfterSwap", drawIcons);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") {
      var root = document.getElementById("modal-root");
      if (root) root.innerHTML = "";
    }
  });
</script>`;

function navItem(item: Item, active: boolean): string {
  const base =
    "display:flex;align-items:center;width:100%;min-height:40px;padding:9px 11px;border-radius:9px;font-size:13px;font-weight:700;";
  const style = active
    ? base + "color:var(--on-accent);background:var(--accent);box-shadow:0 4px 10px rgba(199,255,77,.20)"
    : base + "color:var(--muted);background:transparent";
  return `<a href="${item.href}" class="navlink" style="${style}" aria-label="${item.label}">
    ${item.label}
  </a>`;
}

// Tier free: los tabs Pro se muestran bloqueados (candado + tag PRO) y llevan a
// la página de upgrade en vez de a la vista real. Se ven, pero invitan a subir.
function navItemLocked(item: Item): string {
  const base =
    "display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:9px 11px;border-radius:9px;font-size:13px;font-weight:700;color:var(--dim)";
  return `<a href="${UPGRADE_URL}" class="navlink" style="${base}" title="${item.label}: disponible en Pro" aria-label="${item.label}: disponible en Pro">
    ${item.label}<span style="margin-left:auto;font-size:8px;letter-spacing:.1em;color:var(--accent)">PRO</span>
  </a>`;
}

// El pack de nicho re-etiqueta el item "leads" (ej. "Leads" → "Reservaciones").
// El id y el href NO cambian (son load-bearing); solo la etiqueta y el ícono.
function applyNiche(item: Item, niche: NichePack | null): Item {
  if (!niche || niche.id === "generico" || item.id !== "leads") return item;
  return { ...item, label: niche.navLabel, icon: niche.navIcon };
}

function sidebar(activeTab: string, pro: boolean, niche: NichePack | null): string {
  const locked = (id: string) => !pro && (PRO_ONLY_TABS as readonly string[]).includes(id);
  const navigation = NAV.map((section) => ({ ...section, items: [...section.items] }));
  if (niche?.id === "realtor") {
    navigation[1].items.splice(2, 0, { id: "pipelines", label: "Pipelines", href: "/admin/pipelines", icon: "kanban-square" });
    navigation[1].items.splice(3, 0, { id: "qualification", label: "Calificar Lead", href: "/admin/qualification", icon: "clipboard-check" });
    navigation[1].items.splice(4, 0, { id: "appointments", label: "Citas", href: "/admin/appointments", icon: "calendar-check-2" });
    navigation[1].items.splice(5, 0, { id: "openhouses", label: "Open Houses", href: "/admin/open-houses", icon: "qr-code" });
  }
  const sections = navigation.map((sec) => {
    const items = sec.items
      .map((raw) => {
        const i = applyNiche(raw, niche);
        return locked(i.id) ? navItemLocked(i) : navItem(i, i.id === activeTab);
      })
      .join("");
    return `<div class="sb-sec" aria-hidden="true">${sec.label}</div>${items}`;
  }).join("");

  return `<aside class="sb">
    <div class="sb-brand" style="padding:18px 16px 16px;border-bottom:1px solid var(--line)">
      <a href="/admin/overview" title="Hawk Guru Realtor Suite" aria-label="Hawk Guru Realtor Suite" style="display:flex;align-items:center;gap:10px;color:var(--cream)">
        <img src="/admin/brand/logo" alt="Hawk Guru" width="35" height="35" style="width:35px;height:35px;border-radius:10px;object-fit:cover;display:block">
        <span style="font-size:12px;line-height:1.1;font-weight:800;letter-spacing:-.02em">HAWK GURU<small style="display:block;margin-top:4px;color:var(--dim);font-size:8px;font-weight:800;letter-spacing:.12em">REALTOR SUITE</small></span>
      </a>
    </div>
    <nav class="sb-nav">${sections}</nav>
    <div class="sb-foot" style="padding:12px;border-top:1px solid var(--line)">
      <a href="/admin/agente" title="AI Concierge" aria-label="AI Concierge" style="display:block;padding:10px 11px;border-radius:9px;background:var(--panel2);color:var(--cream);font-size:12px;font-weight:800">AI Concierge</a>
    </div>
  </aside>`;
}

export function layout(opts: { title: string; activeTab: string; body: string; env?: Env }): string {
  // Tier: si se pasa env, el nav Pro se bloquea para free. Sin env (ej. notFound)
  // se asume Pro para no ocultar nada por accidente.
  const pro = opts.env ? isPro(opts.env) : true;
  const niche = opts.env ? getNiche(opts.env) : null;
  const dynamicNav = NAV.map((section) => ({ ...section, items: [...section.items] }));
  if (niche?.id === "realtor") {
    dynamicNav[1].items.splice(2, 0, { id: "pipelines", label: "Pipelines", href: "/admin/pipelines", icon: "kanban-square" });
    dynamicNav[1].items.splice(3, 0, { id: "qualification", label: "Calificar Lead", href: "/admin/qualification", icon: "clipboard-check" });
    dynamicNav[1].items.splice(4, 0, { id: "appointments", label: "Citas", href: "/admin/appointments", icon: "calendar-check-2" });
    dynamicNav[1].items.splice(5, 0, { id: "openhouses", label: "Open Houses", href: "/admin/open-houses", icon: "qr-code" });
  }
  const section = dynamicNav.find((s) => s.items.some((i) => i.id === opts.activeTab)) ?? dynamicNav[0];
  const item = applyNiche(section.items.find((i) => i.id === opts.activeTab) ?? section.items[0], niche);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${opts.title}</title>
  ${HEAD_ASSETS}
  ${GLOBAL_STYLE}
</head>
<body class="scanlines">
  <div class="shell">
    ${sidebar(opts.activeTab, pro, niche)}
    <div style="display:flex;flex-direction:column;min-width:0">
      <header style="position:sticky;top:0;z-index:30;background:rgba(9,16,13,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:15px 30px;display:flex;align-items:center;gap:20px">
        <div style="min-width:0">
          <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--dim);text-transform:uppercase">Hawk Guru Realtor Suite <span style="color:var(--linelit);padding:0 5px">/</span> ${section.label}</div>
          <h1 style="font-family:'Manrope';font-weight:800;font-size:21px;margin:3px 0 0;letter-spacing:-.035em">${item.label}</h1>
        </div>
        <div id="proj-switcher" style="margin-left:auto"></div>
        <div class="live-pill">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--ok);animation:pulse 1.8s ease-in-out infinite,ring 2s infinite"></span>
          <span style="font-size:10px;font-weight:800;letter-spacing:.06em;color:var(--cream)">OPERACIÓN ACTIVA</span>
        </div>
      </header>
      <main style="padding:28px 30px 44px;min-width:0;max-width:1680px;width:100%;margin:0 auto">${opts.body}</main>
    </div>
  </div>
  <div id="modal-root"></div>
  <script>
  // Selector de proyectos: si esta instancia declara PEER_BOTS, el header
  // muestra un dropdown para brincar entre bots (cada uno con su panel).
  fetch('/admin/projects').then(function(r){ return r.ok ? r.json() : null }).then(function(d){
    if (!d || !d.peers || d.peers.length === 0) return;
    var el = document.getElementById('proj-switcher');
    if (!el) return;
    var opts = '<option selected>' + d.current.replace(/</g,'&lt;') + '</option>';
    d.peers.forEach(function(p){
      opts += '<option value="' + p.url.replace(/"/g,'&quot;') + '">' + p.name.replace(/</g,'&lt;') + '</option>';
    });
    el.innerHTML = '<select onchange="if(this.value.indexOf(\'http\')===0)window.location=this.value" ' +
      'style="background:var(--panel);color:var(--cream);border:1px solid var(--line);border-radius:9px;' +
      'padding:7px 10px;font-family:\'Manrope\',sans-serif;font-size:11px;font-weight:600;letter-spacing:.01em;cursor:pointer" ' +
      'title="Cambiar de proyecto">' + opts + '</select>';
  }).catch(function(){});
  </script>
  <div id="toast-root" style="position:fixed;bottom:1rem;right:1rem;z-index:60"></div>
  ${GLOBAL_SCRIPT}
</body>
</html>`;
}

// Página de upgrade: se muestra cuando un panel free intenta abrir un tab Pro
// (o al hacer click en un item bloqueado). Vive dentro del layout para conservar
// el nav. `feature` es el nombre del tab que pidió (para personalizar el copy).
export function renderUpgrade(env: Env, feature?: string): string {
  const perks = [
    ["scan-eye", "Analista IA", "Resúmenes automáticos de cada conversación: qué querían, objeciones y oportunidad de venta."],
    ["bar-chart-3", "Estadísticas", "Métricas de volumen, retención y desempeño de tu bot en el tiempo."],
    ["receipt", "Costos", "Cuánto gasta tu bot en IA, con tope de presupuesto mensual."],
    ["sparkles", "Mejoras", "El bot detecta huecos en su conocimiento y se mejora solo (flywheel)."],
    ["megaphone", "Campañas", "Manda difusiones y seguimientos por WhatsApp a tus segmentos."],
  ]
    .map(
      ([icon, title, desc]) => `<div style="display:flex;gap:12px;padding:14px;border:1px solid var(--line);background:var(--panel)">
        <i data-lucide="${icon}" width="20" height="20" style="color:var(--accent);flex:none;margin-top:2px"></i>
        <div><div style="font-family:'Manrope';font-weight:700;font-size:14px;margin-bottom:3px">${title}</div>
        <div style="font-size:12.5px;color:var(--muted);line-height:1.5">${desc}</div></div>
      </div>`,
    )
    .join("");

  const body = `
    <div class="card" style="max-width:720px">
      <div style="border:1px solid var(--linelit);background:var(--panel);box-shadow:6px 6px 0 var(--linelit);padding:28px">
        <div style="display:inline-flex;align-items:center;gap:8px;border:1px solid var(--accent);color:var(--accent2);font-size:10px;letter-spacing:.16em;padding:4px 10px;text-transform:uppercase">
          <i data-lucide="lock" width="13" height="13"></i> Función Pro
        </div>
        <h2 style="font-family:'Manrope';font-weight:800;font-size:24px;letter-spacing:-.02em;margin:14px 0 6px">
          ${feature ? `“${feature}” es parte de Pro` : "Desbloquea el panel Pro"}
        </h2>
        <p style="font-size:13.5px;color:var(--muted);line-height:1.6;margin:0 0 20px;max-width:560px">
          Hawk Guru Realtor Suite centraliza conversaciones, qualification y pipelines.
          Esta función suma inteligencia adicional para tu operación:
        </p>
        <div style="display:grid;gap:10px;margin-bottom:22px">${perks}</div>
        <a href="/admin/pipelines" class="bigbtn"
          style="display:inline-flex;align-items:center;gap:8px;background:var(--accent);border:1px solid var(--accent);color:var(--on-accent);box-shadow:4px 4px 0 var(--linelit);padding:12px 20px;font-family:'Manrope';font-weight:800;font-size:14px">
          <i data-lucide="kanban-square" width="17" height="17"></i> Abrir Pipelines
        </a>
      </div>
    </div>`;
  return layout({ title: "Pro", activeTab: "overview", body, env });
}

export function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login</title>
  ${HEAD_ASSETS}
  ${GLOBAL_STYLE}
</head>
<body class="scanlines" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem">
  <form method="POST" action="/admin/auth/request" style="background:var(--panel);border:1px solid var(--linelit);box-shadow:8px 8px 0 var(--linelit);padding:32px;max-width:360px;width:100%">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <div style="width:34px;height:34px;flex:none;border:1.5px solid var(--accent);display:flex;align-items:center;justify-content:center;background:var(--accent-soft);box-shadow:3px 3px 0 var(--linelit)">
        <i data-lucide="terminal" width="18" height="18" style="color:var(--accent)"></i>
      </div>
      <div>
        <h1 style="font-family:'Manrope';font-weight:800;font-size:18px;margin:0;letter-spacing:-.02em">Hawk Guru Realtor Suite</h1>
        <p style="font-size:11px;color:var(--dim);margin:2px 0 0">Te mandamos un link a tu email para entrar.</p>
      </div>
    </div>
    ${error ? `<p style="color:var(--bad);font-size:12px;margin:0 0 12px">${error}</p>` : ""}
    <input name="email" type="email" required placeholder="tu@email.com"
      style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--cream);padding:10px 12px;font-size:13px;outline:none;margin-bottom:14px">
    <button class="bigbtn" type="submit"
      style="width:100%;background:var(--accent);border:1px solid var(--accent);color:var(--on-accent);box-shadow:4px 4px 0 var(--linelit);padding:11px;font-family:'Manrope';font-weight:800;font-size:13px;cursor:pointer">
      Mandar link
    </button>
  </form>
  ${GLOBAL_SCRIPT}
</body>
</html>`;
}
