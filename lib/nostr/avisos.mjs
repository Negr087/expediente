// Avisos por mensaje directo de Nostr. El juego tiene su propia identidad
// (NOSTR_NSEC). Le escribe a NOSTR_AVISOS_NPUB cuando entra un pedido y a
// quien hizo el pedido cuando su caso está listo. Sin NOSTR_NSEC no hace nada.
//
//   NOSTR_DM=nip17 (por defecto): mensaje privado moderno (Amethyst, 0xchat, Coracle…)
//   NOSTR_DM=nip04: mensaje directo viejo, para clientes que todavía no leen NIP-17
//   NOSTR_RELAYS: relays separados por coma (opcional)
// NOSTR_DM es solo para los avisos que te llegan a vos. Para los usuarios se
// elige solo: NIP-17 si publicaron sus relays de mensajes privados, NIP-04 si no.

import WebSocket from 'ws';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import { finalizeEvent } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip17 from 'nostr-tools/nip17';
import * as nip19 from 'nostr-tools/nip19';

// Cuando un relay tarda en conectar, nostr-tools corta la conexión después de
// sacar su manejador de errores, y ws tira un error sin atrapar que tumba el
// proceso. Este manejador de respaldo lo evita.
class QuietWebSocket extends WebSocket {
  constructor(...args) {
    super(...args);
    this.on('error', () => {});
  }
}
useWebSocketImplementation(QuietWebSocket);

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const WAIT_MS = 5000;

function gameKey(env) {
  if (!env.NOSTR_NSEC) return null;
  const sk = nip19.decode(env.NOSTR_NSEC.trim());
  if (sk.type !== 'nsec') throw new Error('NOSTR_NSEC tiene que empezar con nsec1.');
  return sk.data;
}

function relaysFrom(env) {
  const relays = (env.NOSTR_RELAYS ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  return relays.length ? relays : DEFAULT_RELAYS;
}

// Configuración para los avisos que te llegan a vos.
export function nostrConfig(env = process.env) {
  const secretKey = gameKey(env);
  if (!secretKey || !env.NOSTR_AVISOS_NPUB) return null;
  const to = nip19.decode(env.NOSTR_AVISOS_NPUB.trim());
  if (to.type !== 'npub') throw new Error('NOSTR_AVISOS_NPUB tiene que empezar con npub1.');
  return {
    secretKey,
    recipient: to.data,
    relays: relaysFrom(env),
    mode: env.NOSTR_DM === 'nip04' ? 'nip04' : 'nip17',
  };
}

function buildEvent(mode, secretKey, recipient, text) {
  if (mode === 'nip04') {
    return finalizeEvent({
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipient]],
      content: nip04.encrypt(secretKey, recipient, text),
    }, secretKey);
  }
  return nip17.wrapEvent(secretKey, { publicKey: recipient }, text);
}

async function publish(pool, targets, event) {
  const results = await Promise.allSettled(pool.publish(targets, event, { maxWait: WAIT_MS }));
  return {
    ok: targets.filter((_, i) => results[i].status === 'fulfilled'),
    failed: targets.filter((_, i) => results[i].status === 'rejected'),
  };
}

// Relays que la persona publicó: los de mensajes privados (kind 10050, NIP-17)
// y los que lee (kind 10002, NIP-65).
async function recipientRelays(pool, relays, pubkey) {
  const events = await pool.querySync(relays, { kinds: [10050, 10002], authors: [pubkey] }, { maxWait: WAIT_MS });
  const newest = (kind) => events.filter((e) => e.kind === kind).sort((a, b) => b.created_at - a.created_at)[0];
  const dm = newest(10050)?.tags.filter((t) => t[0] === 'relay' && t[1]).map((t) => t[1]) ?? [];
  const read = newest(10002)?.tags.filter((t) => t[0] === 'r' && t[1] && t[2] !== 'write').map((t) => t[1]) ?? [];
  return { dm, read };
}

// Devuelve en qué relays quedó publicado el mensaje y en cuáles falló.
export async function sendDm(text, cfg = nostrConfig()) {
  if (!cfg) return { ok: [], failed: [] };
  const pool = new SimplePool();
  try {
    let targets = cfg.relays;
    if (cfg.mode === 'nip17') {
      const { dm } = await recipientRelays(pool, cfg.relays, cfg.recipient);
      targets = [...new Set([...dm, ...cfg.relays])];
    }
    return { ...(await publish(pool, targets, buildEvent(cfg.mode, cfg.secretKey, cfg.recipient, text))), mode: cfg.mode };
  } finally {
    pool.destroy();
  }
}

// Mensaje a un usuario (por su clave pública en hex). El formato se elige solo.
export async function sendDmToUser(pubkey, text, env = process.env) {
  const secretKey = gameKey(env);
  if (!secretKey) throw new Error('Falta NOSTR_NSEC: el juego no tiene identidad de Nostr para escribir.');
  const relays = relaysFrom(env);
  const pool = new SimplePool();
  try {
    const { dm, read } = await recipientRelays(pool, relays, pubkey);
    const mode = dm.length ? 'nip17' : 'nip04';
    const targets = [...new Set([...(mode === 'nip17' ? dm : read), ...relays])];
    return { ...(await publish(pool, targets, buildEvent(mode, secretKey, pubkey, text))), mode };
  } finally {
    pool.destroy();
  }
}

// Aviso de pedido nuevo. Solo el ID, el comienzo de la temática y el link.
export async function avisarPedido(id, data, origin) {
  const tema = data.tema.length > 80 ? `${data.tema.slice(0, 80)}…` : data.tema;
  const aviso = { nostr: 'por Nostr', email: 'por email' }[data.aviso?.tipo] ?? 'no pidió aviso';
  const pago = data.pago?.pagado ? `\nPagado: ${data.pago.sats} sats.` : '';
  const text = `Nuevo pedido en Expediente: ${id}\n«${tema}»\n${origin}/pedido/${id}\nAviso al usuario: ${aviso}.${pago}\n\nPara armarlo: "atendé los pedidos pendientes".`;
  try {
    const { ok } = await sendDm(text);
    if (nostrConfig() && !ok.length) console.error(`Aviso de Nostr del pedido ${id}: ningún relay lo aceptó.`);
  } catch (err) {
    console.error(`Aviso de Nostr del pedido ${id}: ${err.message}`);
  }
}
