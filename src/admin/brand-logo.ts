// Logo de marca embebido en el bundle (white-label del panel).
//
// Por qué vive aquí y no en R2 ni en un CDN: el panel tiene que verse igual
// aunque el bot no tenga R2 (es opcional, pide tarjeta) y sin depender de un
// host externo que un día se cae y deja el panel del cliente sin logo. Son
// ~8 KB en WebP 160x160: irrelevante frente al límite de 3 MB del worker, y el
// navegador lo cachea un año (immutable) después del primer request.
//
// Para cambiar el logo: reemplaza BRAND_LOGO_B64 por el base64 de tu imagen y
// ajusta BRAND_LOGO_TYPE. O, más simple, apunta BRAND_LOGO_URL (wrangler.toml)
// a una URL externa: si esa var está puesta, el panel la usa y este archivo
// queda sin efecto.
export const BRAND_LOGO_TYPE = "image/webp";

const BRAND_LOGO_B64 =
  "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" +
  "OGJ9xzaAFsmlq74E+HTtUAAA";

// Se decodifica una sola vez por isolate (el módulo se evalúa al arrancar el
// worker), no en cada request.
export const BRAND_LOGO_BYTES: Uint8Array = (() => {
  const bin = atob(BRAND_LOGO_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();
