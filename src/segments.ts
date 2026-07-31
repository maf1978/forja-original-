/**
 * Segmentación de audiencias (modo evento) — la moneda de las campañas.
 *
 * Cada segmento es una consulta sobre datos que el bot YA captura: keywords,
 * clicks en links trackeados, etiquetas de la minería (interés/objeción) y
 * actividad. Cada miembro sale con `inWindow`: si su último mensaje fue hace
 * <24h, WhatsApp permite responderle free-form (gratis, sin plantilla); si no,
 * hay que usar plantilla HSM aprobada (cuenta contra el límite diario del
 * número — p.ej. 250 conversaciones iniciadas por el negocio cada 24h).
 */
import { Db } from "./db/client";

export interface SegmentMember {
  conversationId: string;
  channel: string;
  channelUserId: string;
  name: string | null;
  lastUserAt: number;
  inWindow: boolean;
}

export interface SegmentDef {
  id: string;
  label: string;
  desc: string;
}

export interface RealtorFollowUpCopy {
  freeform: string;
  template: string;
  campaignKeyHint: string;
}

export const SEGMENTS: SegmentDef[] = [
  {
    id: "buyer_ready",
    label: "Buyers listos para avanzar 🏠",
    desc: "Prospectos del pipeline Buyer con intención identificada; prioriza zona, presupuesto y próxima conversación.",
  },
  {
    id: "seller_valuation",
    label: "Sellers que pidieron valoración 📈",
    desc: "Dueños en el pipeline Seller: invítalos a compartir propiedad y coordinar una valoración, sin prometer precio.",
  },
  {
    id: "renter_ready",
    label: "Renters buscando opciones 🔑",
    desc: "Prospectos del pipeline Renter: recupera sus criterios y ofrece una conversación para afinar la búsqueda.",
  },
  {
    id: "property_viewed",
    label: "Vieron una propiedad o recurso",
    desc: "Abrieron un enlace de listing, propiedad o valoración: pregunta qué les llamó la atención y cuál es su duda.",
  },
  {
    id: "hot",
    label: "Leads de alta prioridad 🔥",
    desc: "Calificados con tag hot o intención alta en conversación. Propón una llamada o cita; la aprobación humana decide el siguiente paso.",
  },
  {
    id: "warm",
    label: "Leads con preguntas abiertas 🌤️",
    desc: "Interesados tibios: recupera la conversación con una sola pregunta sobre zona, presupuesto, plazo o propiedad.",
  },
  {
    id: "all_conversations",
    label: "Todas las conversaciones activas",
    desc: "Cualquier persona que haya escrito. Úsalo solo para comunicaciones relevantes y con copy específico.",
  },
];

export const REALTOR_FOLLOW_UP_COPY: Record<string, RealtorFollowUpCopy> = {
  buyer_ready: {
    freeform: "Hola, vi que estás explorando compra de vivienda. ¿Sigues buscando en la misma zona? Si me dices tu plazo ideal y qué te importa más, preparo los siguientes pasos contigo.",
    template: "Hola {{1}}, estamos dando seguimiento a tu búsqueda de vivienda. Si aún te interesa avanzar, responde a este mensaje con tu zona y plazo ideal para coordinar una conversación.",
    campaignKeyHint: "buyer-followup-aaaa-mm-dd",
  },
  seller_valuation: {
    freeform: "Hola, retomo tu consulta de venta. ¿Aún te gustaría conversar sobre tu propiedad y el proceso de valoración? Puedo coordinar una llamada en el horario que te funcione.",
    template: "Hola {{1}}, estamos dando seguimiento a tu consulta de venta de propiedad. Si deseas coordinar una conversación de valoración, responde a este mensaje con el mejor horario para ti.",
    campaignKeyHint: "seller-valuation-aaaa-mm-dd",
  },
  renter_ready: {
    freeform: "Hola, ¿sigues buscando renta? Cuéntame si cambiaron tu zona, fecha de mudanza o presupuesto y así afinamos las opciones que vale la pena revisar.",
    template: "Hola {{1}}, estamos dando seguimiento a tu búsqueda de renta. Si aún deseas avanzar, responde con tu zona y fecha ideal de mudanza para coordinar una conversación.",
    campaignKeyHint: "renter-followup-aaaa-mm-dd",
  },
  property_viewed: {
    freeform: "Hola, vi que revisaste una propiedad o recurso. ¿Qué te llamó la atención y qué te gustaría confirmar antes de avanzar? Te ayudo a revisar el siguiente paso.",
    template: "Hola {{1}}, gracias por revisar la información que te compartimos. Si tienes alguna pregunta sobre la propiedad o deseas conversar sobre tu búsqueda, responde a este mensaje.",
    campaignKeyHint: "property-followup-aaaa-mm-dd",
  },
  hot: {
    freeform: "Hola, quiero asegurarme de que tengas una respuesta clara para avanzar con tu plan inmobiliario. ¿Te viene bien una llamada breve hoy o prefieres que coordinemos otro horario?",
    template: "Hola {{1}}, estamos dando seguimiento a tu consulta inmobiliaria. Si deseas avanzar, responde a este mensaje y coordinamos una conversación en el horario que prefieras.",
    campaignKeyHint: "hot-leads-aaaa-mm-dd",
  },
  warm: {
    freeform: "Hola, retomo nuestra conversación para entender mejor qué necesitas. ¿Qué es lo más importante ahora: zona, presupuesto, fecha o tipo de propiedad?",
    template: "Hola {{1}}, estamos dando seguimiento a tu consulta inmobiliaria. Responde a este mensaje con la prioridad de tu búsqueda y te ayudaremos a definir el próximo paso.",
    campaignKeyHint: "warm-leads-aaaa-mm-dd",
  },
  all_conversations: {
    freeform: "Hola, gracias por escribir a Hawk Guru Realtor Suite. ¿Sigues evaluando comprar, vender o rentar? Cuéntame en qué etapa estás y coordinamos el mejor siguiente paso.",
    template: "Hola {{1}}, gracias por contactar a Hawk Guru Realtor Suite. Si aún necesitas apoyo para comprar, vender o rentar, responde a este mensaje y coordinamos una conversación.",
    campaignKeyHint: "reengagement-aaaa-mm-dd",
  },
};

const WINDOW_MS = 24 * 3600_000;
// Margen: no mandamos free-form si la ventana cierra en <1h (riesgo de rebote).
const WINDOW_SAFE_MS = 23 * 3600_000;

const MEMBER_SELECT = `
  SELECT c.id AS conversationId, c.channel AS channel, c.channel_user_id AS channelUserId,
         c.display_name AS name, MAX(m.created_at) AS lastUserAt
  FROM conversations c
  JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'`;

function whereFor(segmentId: string): { joins: string; where: string } {
  switch (segmentId) {
    case "buyer_ready":
      return {
        joins: "",
        where: `WHERE EXISTS (
          SELECT 1 FROM leads l JOIN realtor_lead_pipeline rlp ON rlp.lead_id = l.id
          JOIN realtor_pipelines rp ON rp.id = rlp.pipeline_id
          WHERE l.conversation_id = c.id AND rp.kind = 'buyer'
        )`,
      };
    case "seller_valuation":
      return {
        joins: "",
        where: `WHERE EXISTS (
          SELECT 1 FROM leads l JOIN realtor_lead_pipeline rlp ON rlp.lead_id = l.id
          JOIN realtor_pipelines rp ON rp.id = rlp.pipeline_id
          WHERE l.conversation_id = c.id AND rp.kind = 'seller'
        )`,
      };
    case "renter_ready":
      return {
        joins: "",
        where: `WHERE EXISTS (
          SELECT 1 FROM leads l JOIN realtor_lead_pipeline rlp ON rlp.lead_id = l.id
          JOIN realtor_pipelines rp ON rp.id = rlp.pipeline_id
          WHERE l.conversation_id = c.id AND rp.kind = 'renter'
        )`,
      };
    case "property_viewed":
      return {
        joins: "",
        where: "WHERE c.id IN (SELECT conversation_id FROM tracked_links WHERE target IN ('property', 'listing', 'valuation') AND clicks > 0)",
      };
    case "hot":
      return {
        joins: "",
        where: `WHERE EXISTS (
          SELECT 1 FROM conv_labels l WHERE l.conversation_id = c.id AND l.interest = 'caliente'
        ) OR EXISTS (
          SELECT 1 FROM leads lead JOIN realtor_lead_tags rlt ON rlt.lead_id = lead.id
          JOIN realtor_tags rt ON rt.id = rlt.tag_id
          WHERE lead.conversation_id = c.id AND rt.slug = 'hot'
        )`,
      };
    case "warm":
      return {
        joins: "",
        where: `WHERE EXISTS (
          SELECT 1 FROM conv_labels l WHERE l.conversation_id = c.id AND l.interest = 'tibio'
        ) OR EXISTS (
          SELECT 1 FROM leads lead JOIN realtor_lead_tags rlt ON rlt.lead_id = lead.id
          JOIN realtor_tags rt ON rt.id = rlt.tag_id
          WHERE lead.conversation_id = c.id AND rt.slug = 'warm'
        )`,
      };
    case "all_conversations":
      return { joins: "", where: "" };
    default:
      throw new Error(`segmento desconocido: ${segmentId}`);
  }
}

/** Miembros de un segmento, cada uno con su estado de ventana de 24h. */
export async function segmentMembers(
  db: Db,
  segmentId: string,
  now = Date.now(),
): Promise<SegmentMember[]> {
  const { joins, where } = whereFor(segmentId);
  const rows = await db.all<Omit<SegmentMember, "inWindow">>(
    `${MEMBER_SELECT}
     ${joins}
     ${where}
     GROUP BY c.id
     ORDER BY lastUserAt DESC`,
  );
  return rows.map((r) => ({
    ...r,
    inWindow: now - r.lastUserAt < WINDOW_SAFE_MS,
  }));
}

export interface SegmentCount {
  id: string;
  label: string;
  desc: string;
  total: number;
  inWindow: number;
  outWindow: number;
}

/** Conteos de todos los segmentos (para pintar la página de campañas). */
export async function segmentCounts(db: Db, now = Date.now()): Promise<SegmentCount[]> {
  const out: SegmentCount[] = [];
  for (const seg of SEGMENTS) {
    const members = await segmentMembers(db, seg.id, now);
    const inW = members.filter((m) => m.inWindow).length;
    out.push({
      id: seg.id,
      label: seg.label,
      desc: seg.desc,
      total: members.length,
      inWindow: inW,
      outWindow: members.length - inW,
    });
  }
  return out;
}

export { WINDOW_MS, WINDOW_SAFE_MS };
