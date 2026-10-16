// Genera un caso nuevo con Claude y lo guarda como borrador en casos/.
//
//   npm run generar-caso                      (Claude elige el escenario)
//   npm run generar-caso -- "una bodega en Mendoza durante la vendimia"
//
// Necesita ANTHROPIC_API_KEY (en .env o en el entorno). El caso queda con
// "published": false: se ve en local (npm run dev) pero no en producción.
// Para publicarlo, cambiá a "published": true y hacé deploy.

import Anthropic from '@anthropic-ai/sdk';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateCase, ROLES } from '../lib/cases/shared.mjs';
import { LOOK_OPTIONS } from '../lib/cases/portrait.mjs';
import { GAME_INTRO, DESIGN_RULES } from '../lib/cases/rules.mjs';
import { pickRecipe, recipeText, designOf } from '../lib/cases/variety.mjs';

const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4, output: 20 }; // US$ por millón de tokens
const MAX_FIXES = 2;
const DIR = path.join(process.cwd(), 'casos');

// ---------- Formato que devuelve Claude ----------
// Es el formato del juego con dos diferencias: las filas de las tablas son
// objetos (el esquema no admite tuplas) y no hay imágenes (los retratos se
// dibujan a partir de `look`).

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items) => ({ type: 'array', items });

const block = {
  anyOf: [
    obj({ type: { type: 'string', const: 'p' }, text: str }),
    obj({ type: { type: 'string', const: 'note' }, text: str }),
    obj({ type: { type: 'string', const: 'quote' }, who: str, text: str }),
    obj({ type: { type: 'string', const: 'kv' }, rows: arr(obj({ label: str, value: str })) }),
    obj({ type: { type: 'string', const: 'log' }, title: str, rows: arr(obj({ time: str, text: str })) }),
    obj({ type: { type: 'string', const: 'chat' }, title: str, messages: arr(obj({ who: str, time: str, text: str })) }),
    obj({ type: { type: 'string', const: 'letter' }, text: str, signature: str }),
  ],
};
const look = obj({
  skin: { type: 'string', enum: LOOK_OPTIONS.skin },
  hair: { type: 'string', enum: LOOK_OPTIONS.hair },
  hairColor: { type: 'string', enum: LOOK_OPTIONS.hairColor },
  clothes: { type: 'string', enum: LOOK_OPTIONS.clothes },
  clothesColor: { type: 'string', enum: LOOK_OPTIONS.clothesColor },
  facialHair: { type: 'string', enum: LOOK_OPTIONS.facialHair },
  expression: { type: 'string', enum: LOOK_OPTIONS.expression },
  glasses: { type: 'boolean' },
  earrings: { type: 'boolean' },
  necklace: { type: 'boolean' },
});
const options = arr(obj({ id: str, label: str }));
const choice = obj({ question: str, options, correct: str });
const gate = obj({ question: str, options, correct: str, hints: arr(str) });

const CASE_SCHEMA = obj({
  title: str,
  teaser: str,
  phaseNames: arr(str),
  victim: obj({ name: str, age: { type: 'integer' }, look }),
  briefing: obj({ blocks: arr(block) }),
  evidence: arr(obj({
    id: str,
    role: { type: 'string', enum: ROLES },
    phase: { type: 'integer', enum: [1, 2, 3] },
    title: str,
    source: str,
    blocks: arr(block),
  })),
  suspects: arr(obj({
    id: str, name: str, age: { type: 'integer' }, role: str, statement: str, look,
    questions: arr(obj({ evidence: str, answer: str })),
  })),
  gate1: gate,
  gate2: gate,
  accusation: obj({ who: choice, how: choice, why: choice, hints: arr(str) }),
  solution: arr(str),
});

const SOLVE_SCHEMA = obj({
  gate1: str, gate2: str, who: str, how: str, why: str,
  reasoning: str,
  problems: arr(str),
});
const ROLE_SOLVE_SCHEMA = obj({ who: str, confident: { type: 'boolean' } });

// ---------- Conversión entre formatos ----------

function blockToGame(b) {
  if (b.type === 'kv') return { type: 'kv', rows: b.rows.map((r) => [r.label, r.value]) };
  if (b.type === 'log') return { type: 'log', ...(b.title ? { title: b.title } : {}), rows: b.rows.map((r) => [r.time, r.text]) };
  if (b.type === 'chat') return { type: 'chat', ...(b.title ? { title: b.title } : {}), messages: b.messages };
  if (b.type === 'letter') return { type: 'letter', text: b.text, ...(b.signature ? { signature: b.signature } : {}) };
  return b;
}

function blockToGen(b) {
  if (b.type === 'kv') return { type: 'kv', rows: b.rows.map(([label, value]) => ({ label, value })) };
  if (b.type === 'log') return { type: 'log', title: b.title ?? '', rows: b.rows.map(([time, text]) => ({ time, text })) };
  if (b.type === 'chat') return { type: 'chat', title: b.title ?? '', messages: b.messages };
  if (b.type === 'letter') return { type: 'letter', text: b.text, signature: b.signature ?? '' };
  return b;
}

function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

export function toGame(gen, { id, number, design }) {
  const usedQ = new Set();
  return {
    id,
    number,
    title: gen.title,
    published: false,
    generated: { model: MODEL, at: new Date().toISOString() },
    ...(design ? { design } : {}),
    teaser: gen.teaser,
    phaseNames: gen.phaseNames,
    victim: { ...gen.victim, photo: 'victima.svg' },
    briefing: {
      title: 'Informe inicial',
      blocks: [
        {
          type: 'image', src: 'victima.svg', style: 'polaroid',
          caption: `${gen.victim.name}, ${gen.victim.age} años`, alt: `Retrato de ${gen.victim.name}.`,
        },
        ...gen.briefing.blocks.map(blockToGame),
      ],
    },
    evidence: gen.evidence.map((e) => ({ ...e, blocks: e.blocks.map(blockToGame) })),
    suspects: gen.suspects.map((s) => ({
      ...s,
      photo: `${s.id}.svg`,
      questions: s.questions.map((q) => {
        let qid = `${s.id}-${q.evidence}`;
        for (let n = 2; usedQ.has(qid); n++) qid = `${s.id}-${q.evidence}-${n}`;
        usedQ.add(qid);
        return { id: qid, evidence: q.evidence, answer: q.answer };
      }),
    })),
    gates: { 1: gen.gate1, 2: gen.gate2 },
    accusation: {
      hints: gen.accusation.hints,
      parts: ['who', 'how', 'why'].map((pid) => ({ id: pid, ...gen.accusation[pid] })),
    },
    solution: gen.solution,
  };
}

// Las Toscas en el formato de Claude, como ejemplo de estructura y de calidad.
const EXAMPLE_LOOKS = {
  victim: { skin: 'claro', hair: 'pelado', hairColor: 'blanco', clothes: 'camisa', clothesColor: 'blanco', facialHair: 'bigote', expression: 'sonrisa', glasses: true, earrings: false, necklace: false },
  renata: { skin: 'claro', hair: 'rodete', hairColor: 'castaño', clothes: 'cardigan', clothesColor: 'bordo', facialHair: 'ninguno', expression: 'neutral', glasses: false, earrings: false, necklace: true },
  clara: { skin: 'claro', hair: 'largo', hairColor: 'negro', clothes: 'blazer', clothesColor: 'azul', facialHair: 'ninguno', expression: 'neutral', glasses: false, earrings: true, necklace: false },
  bruno: { skin: 'trigueño', hair: 'corto', hairColor: 'negro', clothes: 'cocinero', clothesColor: 'blanco', facialHair: 'barba_de_dias', expression: 'seria', glasses: false, earrings: false, necklace: false },
  ferran: { skin: 'medio', hair: 'pelado', hairColor: 'canoso', clothes: 'saco', clothesColor: 'azul', facialHair: 'ninguno', expression: 'sonrisa', glasses: true, earrings: false, necklace: false },
};

export function toGen(c) {
  // Las fotos con descripción pasan a texto; las demás se omiten.
  const noImages = (blocks) => blocks
    .filter((b) => b.type !== 'image' || b.text)
    .map((b) => (b.type === 'image' ? { type: 'p', text: `${b.caption}: ${b.text}` } : blockToGen(b)));
  const parts = Object.fromEntries(c.accusation.parts.map(({ id, ...rest }) => [id, rest]));
  return {
    title: c.title,
    teaser: c.teaser,
    phaseNames: c.phaseNames,
    victim: { name: 'Ernesto Valdés', age: 68, look: EXAMPLE_LOOKS.victim },
    briefing: { blocks: noImages(c.briefing.blocks) },
    evidence: c.evidence.map(({ id, role, phase, title, source, blocks }) => ({ id, role, phase, title, source, blocks: noImages(blocks) })),
    suspects: c.suspects.map(({ id, name, age, role, statement, questions }) => ({
      id, name, age, role, statement, look: EXAMPLE_LOOKS[id],
      questions: questions.map(({ evidence, answer }) => ({ evidence, answer })),
    })),
    gate1: c.gates['1'],
    gate2: c.gates['2'],
    accusation: { who: parts.who, how: parts.how, why: parts.why, hints: c.accusation.hints },
    solution: c.solution,
  };
}

// ---------- Prompts ----------

const SYSTEM = `${GAME_INTRO}

${DESIGN_RULES}

Te paso un caso ya publicado para que veas el formato y el nivel esperado. No copies su trama, su escenario ni su forma de matar.`;

function solverMaterial(c) {
  const lines = [];
  const text = (b) => {
    if (b.type === 'kv') return b.rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    if (b.type === 'log') return (b.title ? `${b.title}\n` : '') + b.rows.map(([t, x]) => `${t} — ${x}`).join('\n');
    if (b.type === 'quote') return `${b.who}: "${b.text}"`;
    if (b.type === 'chat') return (b.title ? `${b.title}\n` : '') + b.messages.map((m) => `[${m.time}] ${m.who}: ${m.text}`).join('\n');
    if (b.type === 'letter') return `Carta: "${b.text}"${b.signature ? ` — ${b.signature}` : ''}`;
    if (b.type === 'image') return '';
    return b.text;
  };
  lines.push('# Informe inicial', ...c.briefing.blocks.map(text));
  return { lines, text };
}

function solvePrompt(c) {
  const { lines, text } = solverMaterial(c);
  for (const e of c.evidence) lines.push(`\n# ${e.id} (${e.role}, fase ${e.phase}): ${e.title}`, ...e.blocks.map(text));
  lines.push('\n# Sospechosos');
  for (const s of c.suspects) {
    lines.push(`\n## ${s.name} (${s.age}), ${s.role}`, `Declaración: "${s.statement}"`);
    for (const q of s.questions) lines.push(`Al mostrarle ${q.evidence}: "${q.answer}"`);
  }
  const opts = (o) => o.options.map((x) => `  - ${x.id}: ${x.label}`).join('\n');
  lines.push(
    '\n# Preguntas',
    `gate1. ${c.gates[1].question}\n${opts(c.gates[1])}`,
    `gate2. ${c.gates[2].question}\n${opts(c.gates[2])}`,
    ...c.accusation.parts.map((p) => `${p.id}. ${p.question}\n${opts(p)}`),
  );
  return `Sos un jugador experto de juegos de detectives. Resolvé este caso solo con la evidencia. Respondé cada pregunta con el id de la opción.
En "problems" anotá cualquier contradicción, ambigüedad (más de una opción defendible), dato faltante o respuesta que se pueda adivinar sin cruzar evidencia. Si el caso está bien, dejalo vacío.

${lines.join('\n')}`;
}

function roleSolvePrompt(c, role) {
  const { lines, text } = solverMaterial(c);
  const mine = c.evidence.filter((e) => e.role === role);
  const mineIds = new Set(mine.map((e) => e.id));
  for (const e of mine) lines.push(`\n# ${e.id}: ${e.title}`, ...e.blocks.map(text));
  lines.push('\n# Sospechosos');
  for (const s of c.suspects) {
    lines.push(`\n## ${s.name} (id: ${s.id}), ${s.role}`, `Declaración: "${s.statement}"`);
    for (const q of s.questions.filter((q) => mineIds.has(q.evidence))) lines.push(`Al mostrarle ${q.evidence}: "${q.answer}"`);
  }
  return `Con SOLO esta evidencia (es la mitad del caso), ¿quién es el culpable? Respondé con el id del sospechoso. Poné "confident": true únicamente si la evidencia alcanza para asegurarlo sin adivinar.

${lines.join('\n')}`;
}

// ---------- Llamadas a Claude ----------

let client;
const usage = { input: 0, output: 0 };

async function ask(messages, schema, { system, effort = 'high' } = {}) {
  client ??= new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    ...(system ? { system } : {}),
    messages,
  });
  const msg = await stream.finalMessage();
  usage.input += (msg.usage.input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0);
  usage.output += msg.usage.output_tokens ?? 0;
  if (msg.stop_reason === 'refusal') throw new Error(`Claude no quiso responder (${msg.stop_details?.category ?? 'sin categoría'}).`);
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por largo. Probá de nuevo.');
  const textBlock = msg.content.find((b) => b.type === 'text');
  return { data: JSON.parse(textBlock.text), content: msg.content };
}

async function check(c) {
  const [full, ...roles] = await Promise.all([
    ask([{ role: 'user', content: solvePrompt(c) }], SOLVE_SCHEMA),
    ...ROLES.map((r) => ask([{ role: 'user', content: roleSolvePrompt(c, r) }], ROLE_SOLVE_SCHEMA, { effort: 'medium' })),
  ]);
  const answer = full.data;
  const expected = {
    gate1: c.gates[1].correct, gate2: c.gates[2].correct,
    ...Object.fromEntries(c.accusation.parts.map((p) => [p.id, p.correct])),
  };
  const problems = [...answer.problems];
  for (const [k, v] of Object.entries(expected)) {
    if (answer[k] !== v) problems.push(`Un jugador experto respondió "${answer[k]}" en ${k} y la respuesta del caso es "${v}". Razonamiento del jugador: ${answer.reasoning}`);
  }
  const culprit = expected.who;
  ROLES.forEach((r, i) => {
    const res = roles[i].data;
    if (res.confident && res.who === culprit) {
      problems.push(`Con solo la evidencia de ${r} ya se puede asegurar quién es el culpable: el caso tiene que obligar a cruzar los dos roles.`);
    }
  });
  return problems;
}

// ---------- Programa ----------

function cost() {
  return ((usage.input * PRICE.input + usage.output * PRICE.output) / 1e6).toFixed(2);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error('Falta ANTHROPIC_API_KEY. Agregala a .env (la sacás de https://platform.claude.com/settings/keys).');
    process.exit(1);
  }
  const theme = process.argv.slice(2).join(' ').trim();

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
  const existing = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(DIR, f), 'utf8'))));
  const example = existing.find((c) => c.id === 'las-toscas');
  const nextNumber = Math.max(0, ...existing.map((c) => c.number ?? 0)) + 1;

  const recipe = pickRecipe([...existing].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)));
  const request = [
    theme ? `Escribí un caso nuevo. Escenario y tema: ${theme}.` : 'Escribí un caso nuevo. Elegí vos un escenario original.',
    `Casos que ya existen (no repitas escenario ni trama): ${existing.map((c) => c.title).join('; ')}.`,
    '',
    recipeText(recipe),
    theme ? 'El escenario y el tema del pedido tienen prioridad sobre el lugar y la época de la receta.' : '',
  ].join('\n');

  const messages = [{
    role: 'user',
    content: `Caso de ejemplo:\n${JSON.stringify(toGen(example))}\n\n${request}`,
  }];

  console.log(`Generando el caso N.º ${String(nextNumber).padStart(2, '0')}${theme ? ` (${theme})` : ''}. Tarda unos minutos…`);
  console.log(`${recipeText(recipe)}\n`);
  let gen;
  let game;
  for (let round = 0; ; round++) {
    const res = await ask(messages, CASE_SCHEMA, { system: SYSTEM });
    gen = res.data;
    messages.push({ role: 'assistant', content: res.content });

    const base = slugify(gen.title) || `caso-${nextNumber}`;
    let id = base;
    for (let n = 2; existing.some((c) => c.id === id); n++) id = `${base}-${n}`;
    game = toGame(gen, { id, number: nextNumber, design: designOf(recipe) });

    console.log(`  Borrador: "${gen.title}". Revisando…`);
    let problems = validateCase(game);
    if (!problems.length) {
      console.log('  Estructura bien. Un jugador lo está intentando resolver…');
      problems = await check(game);
    }
    if (!problems.length) break;

    console.log(`  Encontré ${problems.length} problema(s):`);
    for (const p of problems) console.log(`   - ${p}`);
    if (round >= MAX_FIXES) {
      console.log('  No quedó bien después de varios intentos. Lo guardo igual como borrador para que lo revises.');
      game.reviewNotes = problems;
      break;
    }
    console.log('  Pidiendo una corrección…');
    messages.push({
      role: 'user',
      content: `Revisamos el caso y tiene estos problemas:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nCorregilos y devolvé el caso completo otra vez, con el mismo formato.`,
    });
  }

  const file = path.join(DIR, `${game.id}.json`);
  await writeFile(file, JSON.stringify(game, null, 2) + '\n');
  console.log(`\nListo: ${path.relative(process.cwd(), file)} (costo aproximado: US$ ${cost()})`);
  console.log('Probalo con `npm run dev`: aparece en el inicio marcado como Borrador.');
  console.log('Para publicarlo, cambiá "published" a true y hacé deploy.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((err) => {
  console.error(`\nNo se pudo generar el caso: ${err.message}`);
  if (usage.input) console.error(`Costo hasta el error: US$ ${cost()}`);
  process.exit(1);
});
