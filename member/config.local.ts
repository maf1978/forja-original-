// member/config.local.ts
// Business-specific configuration. Edited by the member (or by the skill
// /configurar-mi-chatbot). NEVER overwritten on template update.
//
// This is a stub with example values. Replace with your real business info.

export const memberConfig = {
  businessName: "Hawk Guru Realtor Suite",
  botName: "AI Realtor Concierge",
  language: "es" as "es" | "en",
  tier: "pro" as "free" | "pro",
  timezone: "America/New_York",
  contactEmail: "",
};

export type MemberConfig = typeof memberConfig;

// Business context consumed by src/businessContext.ts to render the
// <business_context> section of the system prompt. Edit freely.
export const businessConfig = {
  customFields: {
    Especialidad: "Asistencia para comprar, vender o rentar propiedades.",
    Proceso: "El concierge califica prospectos, registra preferencias y coordina el siguiente paso con un realtor.",
    Politica: "No confirma inventario, precio, disponibilidad ni financiación sin revisión humana.",
  } as Record<string, string>,
};

// Product catalog consumed by src/tools/catalogQuery.ts (Pro tier).
// Member fills via skill. Example:
//   { name: "Pan dulce", price: 25, description: "Concha tradicional", sku: "PD-01" }
export const catalog: { name: string; price: number; description?: string; sku?: string }[] = [];
