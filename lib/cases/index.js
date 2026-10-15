import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROLE_INFO } from './shared.mjs';
import { GameError } from '../store';

// Los casos son archivos JSON en casos/. Solo se leen en el servidor: las
// respuestas y la resolución nunca viajan al navegador.
// Un caso con "published": false es un borrador: se ve en local pero no en producción.

const DIR = path.join(process.cwd(), 'casos');
const DEV = process.env.NODE_ENV !== 'production';
export const DEFAULT_CASE = 'las-toscas';

const cache = (globalThis.__expedienteCases ??= new Map());

function normalize(raw) {
  return { ...raw, roles: ROLE_INFO, gates: { 1: raw.gates['1'], 2: raw.gates['2'] } };
}

async function readCase(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return normalize(JSON.parse(await readFile(path.join(DIR, `${id}.json`), 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Carga el caso en memoria. Hay que llamarlo antes de usar caseOf().
// En local se relee siempre, así un caso recién generado aparece sin reiniciar.
export async function loadCase(id = DEFAULT_CASE) {
  if (!DEV && cache.has(id)) return cache.get(id);
  const c = await readCase(id);
  if (!c) throw new GameError('Ese caso no existe.', 404);
  cache.set(id, c);
  return c;
}

export function caseOf(state) {
  const c = cache.get(state.caseId ?? DEFAULT_CASE);
  if (!c) throw new Error(`Caso ${state.caseId} sin cargar: llamá a loadCase antes.`);
  return c;
}

export function isPlayable(c) {
  return c.published || DEV;
}

// Lo que se muestra en la página de inicio.
export async function listCases() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
  const all = await Promise.all(files.map((f) => readCase(f.slice(0, -5))));
  return all
    .filter((c) => c && isPlayable(c))
    .sort((a, b) => a.number - b.number)
    .map((c) => ({ id: c.id, number: c.number, title: c.title, teaser: c.teaser ?? '', draft: !c.published }));
}

export function getEvidence(c, id) {
  return c.evidence.find((e) => e.id === id);
}
