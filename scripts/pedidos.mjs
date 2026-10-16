// Manejo de los pedidos de "Armá tu caso". Ver CLAUDE.md para el paso a paso.
//
//   npm run pedidos                              lista los pendientes
//   npm run pedidos -- todos                     lista todos
//   npm run pedidos -- ver <ID>                  muestra el pedido completo
//   npm run pedidos -- foto <ID> <archivo> <destino>   baja una foto para mirarla
//   npm run pedidos -- tomar <ID>                lo marca "en preparación"
//   npm run pedidos -- entregar <ID> <caso.json> valida el caso y lo publica para ese pedido
//   npm run pedidos -- rechazar <ID> "motivo"    lo rechaza con un motivo para la persona
//   npm run pedidos -- aviso                     manda un mensaje de prueba por Nostr
//
// Usa Supabase si hay SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env o en el
// entorno); si no, la carpeta local .datos-locales/.

import { readFile, writeFile } from 'node:fs/promises';
import {
  listPedidos, getPedido, updatePedido, getPhoto, usingSupabase,
} from '../lib/pedidos/store.mjs';
import { validateCase } from '../lib/cases/shared.mjs';
import { sendDm, nostrConfig } from '../lib/nostr/avisos.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function mustGet(id) {
  if (!id) fail('Falta el ID del pedido.');
  const p = await getPedido(id.toUpperCase());
  if (!p) fail(`No existe el pedido ${id}.`);
  return p;
}

function photosOf(p) {
  return [p.data.victima.foto, ...p.data.sospechosos.map((s) => s.foto)].filter(Boolean);
}

const commands = {
  async listar(status = 'pendiente') {
    const rows = await listPedidos(status === 'todos' ? undefined : status);
    if (!rows.length) return console.log(status === 'todos' ? 'No hay pedidos.' : `No hay pedidos en estado "${status}".`);
    for (const p of rows) {
      const tema = p.data.tema.length > 70 ? `${p.data.tema.slice(0, 70)}…` : p.data.tema;
      console.log(`${p.id}  ${p.status.padEnd(14)} ${p.created_at.slice(0, 16).replace('T', ' ')}  ${tema}`);
    }
  },

  async todos() {
    return commands.listar('todos');
  },

  async ver(id) {
    const p = await mustGet(id);
    console.log(JSON.stringify({ id: p.id, status: p.status, creado: p.created_at, caso: p.case_id, ...p.data }, null, 2));
    const fotos = photosOf(p);
    if (fotos.length) console.log(`\nFotos: ${fotos.join(', ')} (bajalas con: npm run pedidos -- foto ${p.id} <archivo> <destino>)`);
  },

  async foto(id, name, dest) {
    const p = await mustGet(id);
    if (!name || !dest) fail('Uso: npm run pedidos -- foto <ID> <archivo> <destino>');
    const buf = await getPhoto(p.id, name);
    if (!buf) fail(`El pedido ${p.id} no tiene la foto ${name}.`);
    await writeFile(dest, buf);
    console.log(`Guardada en ${dest}. No la agregues al repo.`);
  },

  async tomar(id) {
    const p = await mustGet(id);
    if (p.status === 'listo') fail(`El pedido ${p.id} ya está entregado.`);
    await updatePedido(p.id, { status: 'en_preparacion' });
    console.log(`Pedido ${p.id}: en preparación.`);
  },

  async entregar(id, file) {
    const p = await mustGet(id);
    if (!file) fail('Uso: npm run pedidos -- entregar <ID> <caso.json>');
    let c;
    try {
      c = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      fail(`No se pudo leer ${file}: ${err.message}`);
    }
    const caseId = `p-${p.id.toLowerCase()}`;
    c = { ...c, id: caseId, private: true, published: false, pedido: p.id, number: null };

    const problems = validateCase(c);
    const fotos = new Set(photosOf(p));
    for (const person of [c.victim, ...(c.suspects ?? [])].filter(Boolean)) {
      if (!person.look && !person.photo) problems.push(`${person.name}: le falta "look" o "photo".`);
      if (person.photo?.endsWith('.jpg') && !fotos.has(person.photo)) problems.push(`${person.name}: el pedido no tiene la foto ${person.photo}.`);
    }
    if (problems.length) fail(`El caso tiene problemas, corregilos y volvé a entregar:\n${problems.map((x) => `- ${x}`).join('\n')}`);

    await updatePedido(p.id, { status: 'listo', case_id: caseId, case_data: c, note: null });
    console.log(`Pedido ${p.id} entregado: "${c.title}". Se juega desde /pedido/${p.id}`);
  },

  async rechazar(id, ...motivo) {
    const p = await mustGet(id);
    const note = motivo.join(' ').trim();
    if (!note) fail('Escribí un motivo corto para la persona: npm run pedidos -- rechazar <ID> "motivo"');
    await updatePedido(p.id, { status: 'rechazado', note });
    console.log(`Pedido ${p.id} rechazado.`);
  },
};

commands.aviso = async () => {
  const cfg = nostrConfig();
  if (!cfg) fail('Faltan NOSTR_NSEC y NOSTR_AVISOS_NPUB en .env (creá la clave con: npm run nostr-clave).');
  const n = await sendDm('Prueba de aviso de Expediente: si leés esto, los avisos de pedidos funcionan.', cfg);
  console.log(n ? `Mensaje publicado en ${n} relay(s) (${cfg.mode}). Fijate en tu cliente de Nostr.` : 'Ningún relay aceptó el mensaje.');
};

const [cmd = 'listar', ...args] = process.argv.slice(2);
if (!commands[cmd]) fail(`Comando desconocido: ${cmd}. Opciones: ${Object.keys(commands).join(', ')}.`);
console.error(usingSupabase ? '(Supabase)' : '(datos locales en .datos-locales/)');
commands[cmd](...args).catch((err) => fail(err.message));
