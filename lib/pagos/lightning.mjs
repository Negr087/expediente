// Cobro de los pedidos en sats con una Lightning Address (LIGHTNING_ADDRESS,
// por ejemplo vos@getalby.com). El servidor le pide la factura a la billetera
// por LNURL-pay y después pregunta si se pagó con la URL `verify` (LUD-21).
// No hace falta nodo propio ni darle acceso a la billetera a nadie.
// Sin LIGHTNING_ADDRESS los pedidos son gratis.
//
//   SATS_CORTO, SATS_MEDIO, SATS_LARGO: precio de cada duración (opcional)

const DEFAULT_SATS = { corto: 2100, medio: 4200, largo: 6300 };
const TIMEOUT_MS = 8000;

export function lightningAddress(env = process.env) {
  const addr = (env.LIGHTNING_ADDRESS ?? '').trim().toLowerCase();
  return /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(addr) ? addr : null;
}

// Precio en sats de cada duración, o null si los pedidos son gratis.
export function preciosSats(env = process.env) {
  if (!lightningAddress(env)) return null;
  const out = {};
  for (const [dur, def] of Object.entries(DEFAULT_SATS)) {
    const n = Number.parseInt(env[`SATS_${dur.toUpperCase()}`] ?? '', 10);
    out[dur] = Number.isFinite(n) && n > 0 ? n : def;
  }
  return out;
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`${new URL(url).host} respondió ${res.status}`);
  if (body.status === 'ERROR') throw new Error(body.reason || 'la billetera devolvió un error');
  return body;
}

// Lo justo de BOLT11 para saber el monto y cuándo vence la factura.
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const MULT = { m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 };

export function leerFactura(pr) {
  const s = pr.toLowerCase();
  const sep = s.lastIndexOf('1');
  const amount = s.slice(0, sep).match(/^ln[a-z]+?(\d+)([munp]?)$/);
  const words = [...s.slice(sep + 1, -6)].map((c) => CHARSET.indexOf(c));
  if (!amount || words.some((w) => w < 0)) throw new Error('factura inválida');
  const num = (ws) => ws.reduce((n, w) => n * 32 + w, 0);
  const timestamp = num(words.slice(0, 7));
  let expiry = 3600;
  for (let i = 7; i < words.length - 104;) {
    const type = words[i];
    const len = num(words.slice(i + 1, i + 3));
    if (type === 6) expiry = num(words.slice(i + 3, i + 3 + len)); // tag x
    i += 3 + len;
  }
  const btc = Number(amount[1]) * (amount[2] ? MULT[amount[2]] : 1);
  return { sats: Math.round(btc * 1e8), vence: new Date((timestamp + expiry) * 1000).toISOString() };
}

// Pide una factura a la Lightning Address. Devuelve { pr, verify, vence }.
export async function crearFactura(sats, comentario, env = process.env) {
  const addr = lightningAddress(env);
  if (!addr) throw new Error('Falta LIGHTNING_ADDRESS.');
  const [user, domain] = addr.split('@');
  const meta = await getJson(`https://${domain}/.well-known/lnurlp/${user}`);
  const msats = sats * 1000;
  if (msats < meta.minSendable || msats > meta.maxSendable) {
    throw new Error(`la billetera acepta entre ${meta.minSendable / 1000} y ${meta.maxSendable / 1000} sats`);
  }
  const cb = new URL(meta.callback);
  cb.searchParams.set('amount', String(msats));
  if (comentario && meta.commentAllowed > 0) cb.searchParams.set('comment', comentario.slice(0, meta.commentAllowed));
  const inv = await getJson(cb);
  if (!inv.pr) throw new Error('la billetera no devolvió factura');
  if (!inv.verify) throw new Error(`${domain} no permite verificar pagos (LUD-21): usá otra billetera`);
  const { sats: monto, vence } = leerFactura(inv.pr);
  if (monto !== sats) throw new Error(`la factura es de ${monto} sats y se pidieron ${sats}`);
  return { pr: inv.pr, verify: inv.verify, vence };
}

// ¿Se pagó? Devuelve la preimagen si está pagada, null si no.
export async function facturaPagada(verify) {
  const r = await getJson(verify);
  return r.settled ? (r.preimage ?? 'pagada') : null;
}
