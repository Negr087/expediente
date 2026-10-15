// Pedidos de "Armá tu caso": el formulario, las fotos y el caso terminado.
// Sin dependencias de Next: lo usan la API y también scripts/pedidos.mjs.
// Con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY usa Supabase (tabla `pedidos` y
// bucket privado `pedidos`); sin ellas, la carpeta .datos-locales/ (para probar).

import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const STATUS = ['pendiente', 'en_preparacion', 'listo', 'rechazado'];

const BUCKET = 'pedidos';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const LOCAL = path.join(process.cwd(), '.datos-locales');

export const usingSupabase = Boolean(supabase);

const localFile = (id) => path.join(LOCAL, 'pedidos', `${id}.json`);
const localPhoto = (id, name) => path.join(LOCAL, 'fotos', id, name);

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function insertPedido({ id, data }) {
  const now = new Date().toISOString();
  const row = { id, status: 'pendiente', data, case_id: null, case_data: null, note: null, created_at: now, updated_at: now };
  if (!supabase) {
    await mkdir(path.dirname(localFile(id)), { recursive: true });
    if (await readJson(localFile(id))) return false;
    await writeFile(localFile(id), JSON.stringify(row, null, 2));
    return true;
  }
  const { error } = await supabase.from('pedidos').insert(row);
  if (error) {
    if (error.code === '23505') return false; // id repetido
    throw error;
  }
  return true;
}

export async function getPedido(id) {
  if (!supabase) return readJson(localFile(id));
  const { data, error } = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPedidoByCase(caseId) {
  if (!supabase) {
    const all = await listPedidos();
    return all.find((p) => p.case_id === caseId) ?? null;
  }
  const { data, error } = await supabase.from('pedidos').select('*').eq('case_id', caseId).maybeSingle();
  if (error) throw error;
  return data;
}

// Del más viejo al más nuevo. Sin `status` trae todos.
export async function listPedidos(status) {
  if (!supabase) {
    let files = [];
    try { files = await readdir(path.join(LOCAL, 'pedidos')); } catch {}
    const rows = (await Promise.all(files.map((f) => readJson(path.join(LOCAL, 'pedidos', f))))).filter(Boolean);
    return rows.filter((r) => !status || r.status === status).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  let q = supabase.from('pedidos').select('*').order('created_at');
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function updatePedido(id, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (!supabase) {
    const row = await readJson(localFile(id));
    if (!row) return null;
    const merged = { ...row, ...next };
    await writeFile(localFile(id), JSON.stringify(merged, null, 2));
    return merged;
  }
  const { data, error } = await supabase.from('pedidos').update(next).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function putPhoto(id, name, buffer) {
  if (!supabase) {
    await mkdir(path.dirname(localPhoto(id, name)), { recursive: true });
    await writeFile(localPhoto(id, name), buffer);
    return;
  }
  const { error } = await supabase.storage.from(BUCKET).upload(`${id}/${name}`, buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export async function getPhoto(id, name) {
  if (!supabase) {
    try { return await readFile(localPhoto(id, name)); } catch { return null; }
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(`${id}/${name}`);
  if (error) return null;
  return Buffer.from(await data.arrayBuffer());
}
