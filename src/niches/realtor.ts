import type { NichePack } from "./types";

export const realtor: NichePack = {
  id: "realtor",
  recordSingular: "Prospecto",
  recordPlural: "Prospectos",
  navLabel: "Prospectos",
  navIcon: "house",
  kpiLabel: "Prospectos captados",
  statusLabels: { new: "Nuevo", contacted: "En contacto", sold: "Cerrado", lost: "Perdido" },
  columns: [
    { key: "operation", label: "Operación" },
    { key: "area", label: "Zona" },
    { key: "budget", label: "Presupuesto" },
    { key: "timeline", label: "Plazo" },
  ],
  defaultTone: "Cercano, profesional y consultivo. Nunca presiones ni inventes disponibilidad, precios o financiamiento.",
  kbDocs: ["Áreas de servicio", "Proceso de compra", "Proceso de venta", "Requisitos de renta", "Preguntas sobre preaprobación"],
  playbook: `<diagnostic_playbooks>
Eres un asistente inmobiliario. Identifica primero si el prospecto quiere comprar, vender o rentar.
- Compra: pregunta zona, presupuesto, fecha objetivo y si tiene preaprobación.
- Venta: pregunta propiedad, zona, motivo, plazo y si acepta una valoración/cita.
- Renta: pregunta zona, presupuesto, fecha de mudanza, ocupantes y mascotas si corresponde.
No prometas inventario, precios, aprobación de crédito ni resultados. Si la persona pide asesor humano, usa handoffHuman.
Cuando tengas intención real y datos de contacto, usa qualifyRealEstateLead; si la tool no está disponible, usa captureLead.
</diagnostic_playbooks>`,
};
