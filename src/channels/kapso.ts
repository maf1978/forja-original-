import type { ChannelAdapter, IncomingMessage, OutgoingReply } from "./shared";
import type { Env } from "../env";

type KapsoData = Record<string, any>;

async function kapsoSend(to: string, payload: Record<string, unknown>, env: Env): Promise<void> {
  if (!env.KAPSO_API_KEY || !env.KAPSO_PHONE_NUMBER_ID) throw new Error("Kapso: falta KAPSO_API_KEY o KAPSO_PHONE_NUMBER_ID.");
  const res = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(env.KAPSO_PHONE_NUMBER_ID)}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": env.KAPSO_API_KEY }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  if (!res.ok) throw new Error(`Kapso send ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}

export async function sendKapsoButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>, env: Env): Promise<void> {
  await kapsoSend(to, { type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.slice(0, 3).map((button) => ({ type: "reply", reply: button })) } } }, env);
}

function textFrom(message: KapsoData): string | undefined {
  if (message.type === "text") return message.text?.body || undefined;
  const interactive = message.interactive;
  return interactive?.button_reply?.title || interactive?.list_reply?.title || interactive?.nfm_reply?.response_json || undefined;
}

/** Normaliza la carga v2 de Kapso; acepta teléfono o BSUID para no perder leads. */
export function parseKapsoMessage(data: KapsoData): IncomingMessage | null {
  const message = data.message ?? data;
  const userId = message.from || message.wa_id || data.business_scoped_user_id || data.parent_business_scoped_user_id || data.contact?.business_scoped_user_id;
  const text = textFrom(message);
  if (!userId || !text) return null;
  return {
    channel: "kapso",
    channelUserId: String(userId),
    displayName: data.contact?.profile?.name || data.contact?.name || data.username || undefined,
    text,
    isOwnerMessage: false,
    receivedAt: Date.now(),
    rawPayload: data,
  };
}

export const kapsoAdapter: ChannelAdapter = {
  async parseIncoming(request: Request): Promise<IncomingMessage> {
    const msg = parseKapsoMessage(await request.json() as KapsoData);
    if (!msg) throw new Error("Kapso webhook sin mensaje procesable");
    return msg;
  },
  async sendReply(reply: OutgoingReply, env: Env): Promise<void> {
    for (let i = 0; i < reply.chunks.length; i++) {
      const delay = i === 0 ? 0 : reply.interChunkDelayMs ?? 1000;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      await kapsoSend(reply.channelUserId, { type: "text", text: { preview_url: false, body: reply.chunks[i] } }, env).catch((e) => console.error("kapso sendReply", e));
    }
  },
};
