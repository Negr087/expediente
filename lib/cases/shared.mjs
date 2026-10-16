// Reglas comunes a todos los casos. Sin dependencias de Next: también lo usa
// el generador de casos (scripts/generar-caso.mjs).

export const ROLES = ['forense', 'investigador'];

export const ROLE_INFO = {
  forense: { name: 'La Forense', short: 'Forense', desc: 'Cuerpo, escena y laboratorio.' },
  investigador: { name: 'El Investigador', short: 'Investigador', desc: 'Cámaras, registros y documentos.' },
};

// Duraciones de un caso. Cuanto más largo, más fases, evidencia y sospechosos.
export const DURATIONS = {
  corto: { minutes: 20, phases: 3, label: 'Corto, unos 20 minutos' },
  medio: { minutes: 40, phases: 4, label: 'Medio, unos 40 minutos' },
  largo: { minutes: 60, phases: 5, label: 'Largo, alrededor de una hora' },
};

const BLOCK_TYPES = ['p', 'note', 'kv', 'log', 'quote', 'image', 'chat', 'letter'];

// Devuelve la lista de problemas del caso (vacía si está bien armado).
export function validateCase(c) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (!/^[a-z0-9-]+$/.test(c.id ?? '')) err('El id del caso tiene que ser un slug (a-z, 0-9, guiones).');
  if (!c.title) err('Falta el título.');
  const phaseCount = c.phaseNames?.length ?? 0;
  if (!Array.isArray(c.phaseNames) || phaseCount < 3 || phaseCount > 5) err('phaseNames tiene que tener entre 3 y 5 nombres (uno por fase).');
  if (!Number.isInteger(c.duration) || c.duration <= 0) err('Falta "duration": los minutos que dura el caso (20, 40 o 60).');
  const phases = Array.from({ length: phaseCount }, (_, i) => i + 1);
  if (!c.briefing?.blocks?.length) err('Falta el informe inicial (briefing).');
  if (!c.solution?.length) err('Falta la solución.');

  const checkBlocks = (blocks, where) => {
    for (const b of blocks ?? []) {
      if (!BLOCK_TYPES.includes(b.type)) err(`${where}: tipo de bloque desconocido "${b.type}".`);
      if (['kv', 'log'].includes(b.type) && !b.rows?.length) err(`${where}: un bloque ${b.type} sin filas.`);
      if (b.type === 'chat' && !b.messages?.length) err(`${where}: un chat sin mensajes.`);
      if (b.type === 'letter' && !b.text) err(`${where}: una carta sin texto.`);
    }
  };
  checkBlocks(c.briefing?.blocks, 'Informe inicial');

  const evidence = c.evidence ?? [];
  const ids = new Set();
  for (const e of evidence) {
    if (ids.has(e.id)) err(`Evidencia repetida: ${e.id}.`);
    ids.add(e.id);
    if (!ROLES.includes(e.role)) err(`${e.id}: rol desconocido "${e.role}".`);
    if (!phases.includes(e.phase)) err(`${e.id}: la fase tiene que estar entre 1 y ${phaseCount}.`);
    if (!e.title) err(`${e.id}: falta el título.`);
    if (!e.blocks?.length) err(`${e.id}: no tiene contenido.`);
    checkBlocks(e.blocks, e.id);
  }
  for (const phase of phases) {
    for (const role of ROLES) {
      if (!evidence.some((e) => e.phase === phase && e.role === role)) {
        err(`La fase ${phase} no tiene evidencia para ${ROLE_INFO[role].short}.`);
      }
    }
  }

  const suspects = c.suspects ?? [];
  if (suspects.length < 3) err('Tiene que haber al menos 3 sospechosos.');
  const suspectIds = new Set();
  const questionIds = new Set();
  for (const s of suspects) {
    if (suspectIds.has(s.id)) err(`Sospechoso repetido: ${s.id}.`);
    suspectIds.add(s.id);
    if (!s.statement) err(`${s.name}: falta su declaración.`);
    if (!s.questions?.length) err(`${s.name}: no tiene preguntas.`);
    for (const q of s.questions ?? []) {
      if (questionIds.has(q.id)) err(`Pregunta repetida: ${q.id}.`);
      questionIds.add(q.id);
      if (!ids.has(q.evidence)) err(`${q.id}: apunta a una evidencia que no existe (${q.evidence}).`);
    }
  }

  const checkChoice = (choice, where) => {
    const opts = choice?.options ?? [];
    if (opts.length < 3) err(`${where}: tiene que tener al menos 3 opciones.`);
    if (new Set(opts.map((o) => o.id)).size !== opts.length) err(`${where}: hay opciones con el mismo id.`);
    if (!opts.some((o) => o.id === choice?.correct)) err(`${where}: la respuesta correcta no está entre las opciones.`);
  };
  for (const phase of phases.slice(0, -1)) {
    const gate = c.gates?.[phase];
    if (!gate) { err(`Falta la pregunta para pasar de la fase ${phase}.`); continue; }
    checkChoice(gate, `Pregunta de la fase ${phase}`);
    if (gate.hints?.length !== 3) err(`Pregunta de la fase ${phase}: tiene que tener 3 pistas.`);
  }
  const parts = c.accusation?.parts ?? [];
  for (const id of ['who', 'how', 'why']) {
    const part = parts.find((p) => p.id === id);
    if (!part) err(`A la acusación le falta la parte "${id}".`);
    else checkChoice(part, `Acusación (${id})`);
  }
  const who = parts.find((p) => p.id === 'who');
  // Con dos culpables, el id de la opción es "ana+leo".
  const isSuspects = (id) => String(id).split('+').every((x) => suspectIds.has(x));
  if (who && !isSuspects(who.correct)) err('El culpable de la acusación tiene que ser el id de un sospechoso (o dos unidos con "+").');
  for (const o of who?.options ?? []) if (!isSuspects(o.id)) err(`Acusación (who): la opción "${o.id}" no es un sospechoso.`);
  if (c.accusation?.hints?.length !== 3) err('La acusación tiene que tener 3 pistas.');

  return errors;
}
