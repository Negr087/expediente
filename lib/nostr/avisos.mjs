// Avisos por mensaje directo de Nostr. El juego tiene su propia identidad
// (NOSTR_NSEC) y le escribe a NOSTR_AVISOS_NPUB. Sin esas variables no hace nada.
//
//   NOSTR_DM=nip17 (por defecto): mensaje privado moderno (Amethyst, 0xchat, Coracle…)
//   NOSTR_DM=nip04: mensaje directo viejo, para clientes que todavía no leen NIP-17
//   NOSTR_RELAYS: relays separados por coma (opcional)

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

export function nostrConfig(env = process.env) {
  if (!env.NOSTR_NSEC || !env.NOSTR_AVISOS_NPUB) return null;
  const sk = nip19.decode(env.NOSTR_NSEC.trim());
  const to = nip19.decode(env.NOSTR_AVISOS_NPUB.trim());
  if (sk.type !== 'nsec') throw new Error('NOSTR_NSEC tiene que empezar con nsec1.');
  if (to.type !== 'npub') throw new Error('NOSTR_AVISOS_NPUB tiene que empezar con npub1.');
  const relays = (env.NOSTR_RELAYS ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  return {
    secretKey: sk.data,
    recipient: to.data,
    relays: relays.length ? relays : DEFAULT_RELAYS,
    mode: env.NOSTR_DM === 'nip04' ? 'nip04' : 'nip17',
  };
}

// Los relays donde la persona dice que quiere recibir mensajes privados (NIP-17, kind 10050).
async function dmRelays(pool, cfg) {
  const ev = await pool.get(cfg.relays, { kinds: [10050], authors: [cfg.recipient] }, { maxWait: WAIT_MS });
  return ev?.tags.filter((t) => t[0] === 'relay' && t[1]).map((t) => t[1]) ?? [];
}

// Devuelve en qué relays quedó publicado el mensaje y en cuáles falló.
export async function sendDm(text, cfg = nostrConfig()) {
  if (!cfg) return { ok: [], failed: [] };
  const pool = new SimplePool();
  try {
    let targets = cfg.relays;
    let event;
    if (cfg.mode === 'nip04') {
      event = finalizeEvent({
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', cfg.recipient]],
        content: nip04.encrypt(cfg.secretKey, cfg.recipient, text),
      }, cfg.secretKey);
    } else {
      targets = [...new Set([...(await dmRelays(pool, cfg)), ...cfg.relays])];
      event = nip17.wrapEvent(cfg.secretKey, { publicKey: cfg.recipient }, text);
    }
    const results = await Promise.allSettled(pool.publish(targets, event, { maxWait: WAIT_MS }));
    return {
      ok: targets.filter((_, i) => results[i].status === 'fulfilled'),
      failed: targets.filter((_, i) => results[i].status === 'rejected'),
    };
  } finally {
    pool.destroy();
  }
}

// Aviso de pedido nuevo. Solo el ID, el comienzo de la temática y el link.
export async function avisarPedido(id, data, origin) {
  const tema = data.tema.length > 80 ? `${data.tema.slice(0, 80)}…` : data.tema;
  const text = `Nuevo pedido en Expediente: ${id}\n«${tema}»\n${origin}/pedido/${id}\n\nPara armarlo: "atendé los pedidos pendientes".`;
  try {
    const { ok } = await sendDm(text);
    if (nostrConfig() && !ok.length) console.error(`Aviso de Nostr del pedido ${id}: ningún relay lo aceptó.`);
  } catch (err) {
    console.error(`Aviso de Nostr del pedido ${id}: ${err.message}`);
  }
}
