import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Guarda las salas. Con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY usa Supabase;
// sin ellas usa memoria del servidor (sirve para probar en local con `npm run dev`).

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

const memory = (globalThis.__expedienteRooms ??= new Map());

export async function insertRoom(code, state) {
  if (!supabase) {
    if (memory.has(code)) return false;
    memory.set(code, { state, version: 0 });
    return true;
  }
  const { error } = await supabase.from('rooms').insert({ code, state, version: 0 });
  if (error) {
    if (error.code === '23505') return false; // código repetido
    throw error;
  }
  return true;
}

export async function getRoom(code) {
  if (!supabase) return memory.get(code) ?? null;
  const { data, error } = await supabase.from('rooms').select('state, version').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

// Lee, aplica `fn` y guarda solo si nadie escribió en el medio (control por versión).
// `fn` recibe una copia del estado y devuelve el estado nuevo, o lanza GameError.
export async function updateRoom(code, fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const room = await getRoom(code);
    if (!room) throw new GameError('No existe una partida con ese código.', 404);
    const next = fn(structuredClone(room.state));

    if (!supabase) {
      const current = memory.get(code);
      if (current.version !== room.version) continue;
      memory.set(code, { state: next, version: room.version + 1 });
      return next;
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({ state: next, version: room.version + 1, updated_at: new Date().toISOString() })
      .eq('code', code)
      .eq('version', room.version)
      .select('code');
    if (error) throw error;
    if (data.length === 1) return next;
  }
  throw new GameError('La partida está muy ocupada, probá de nuevo.', 409);
}

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
