// member/config.local.ts
// Business-specific configuration. Edited by the member (or by the skill
// /configurar-mi-chatbot). NEVER overwritten on template update.
//
// This is a stub with example values. Replace with your real business info.

export const memberConfig = {
  businessName: "Jorge Cruz Leal P.A. · Real Estate Empire Group",
  botName: "Jorge Cruz Leal P.A. AI Concierge",
  language: "es" as "es" | "en",
  tier: "pro" as "free" | "pro",
  timezone: "America/New_York",
  contactEmail: "",
};

export type MemberConfig = typeof memberConfig;

// Business context consumed by src/businessContext.ts to render the
// <business_context> section of the system prompt. Edit freely.
export const businessConfig = {
  hours: "",
  services: [] as { name: string; price: number }[],
  location: "",
  paymentMethods: [] as string[],
  contactPhone: "",
  customFields: {
    Equipo: "Real Estate Empire Group.",
    Perfil_publico: "Jorge Cruz Leal P.A. es REALTOR®. Perfil público compartido: calificación 5.0 basada en 10 reseñas.",
    Actividad_publica: "11 ventas en los últimos 12 meses; 24 ventas totales; rango de venta reportado $150K-$875K; precio promedio reportado $510K.",
    Mercados_recientes: "Ventas recientes compartidas en Miami y Hialeah, Florida.",
    Ejemplos_de_ventas: "Seller: 14113 SW 120th Ct #4-16, Miami — $403,000, vendida hace 2 meses. Buyer: 705 E 9th Ln, Hialeah — $695,000. Buyer: 1300 W 77th St, Hialeah — $705,000. Buyer: 7993 W 18th Ln, Hialeah — $875,000. Buyer: 3400 W 13th Ave, Hialeah — $585,000.",
    Proceso: "El concierge identifica si la persona quiere comprar, vender o rentar; registra preferencias y coordina el siguiente paso con Jorge o su equipo.",
    Politica: "Este es un demo basado en información pública proporcionada. No confirma inventario, precio actual, disponibilidad, comisiones ni financiación sin revisión humana.",
  } as Record<string, string>,
};

// Product catalog consumed by src/tools/catalogQuery.ts (Pro tier).
// Member fills via skill. Example:
//   { name: "Pan dulce", price: 25, description: "Concha tradicional", sku: "PD-01" }
export const catalog: { name: string; price: number; description?: string; sku?: string }[] = [];
