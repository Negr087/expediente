import 'server-only';
import { caseOf, getEvidence } from './cases';
import { ROLES } from './cases/shared.mjs';
import { GameError } from './store';

const HINT_COSTS = [50, 100, 200];
const WRONG_COST = 25;
const ACCUSE_COST = 300;
const MAX_ACCUSE_FAILS = 2;
const FREE_MINUTES = 60;

export { ROLES };
export const MODES = ['duo', 'solo'];

// duo: cada jugador en su celular, con su rol. solo: un solo celular con los dos roles.
export function newState(c, mode = 'duo') {
  return {
    caseId: c.id,
    mode: MODES.includes(mode) ? mode : 'duo',
    status: 'lobby', // lobby | playing | solved | failed
    phase: 1,
    players: { forense: null, investigador: null },
    asked: [],
    hints: { 1: 0, 2: 0, 3: 0 },
    wrong: 0,
    accuseFails: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    log: [],
    result: null,
  };
}

function addLog(state, text) {
  state.log.push({ t: new Date().toISOString(), text });
  if (state.log.length > 60) state.log = state.log.slice(-60);
}

export function roleOf(state, playerId) {
  return ROLES.find((r) => playerId && state.players[r] === playerId) ?? null;
}

export function rolesOf(state, playerId) {
  return ROLES.filter((r) => playerId && state.players[r] === playerId);
}

function actor(state, playerId) {
  const CASE = caseOf(state);
  return state.mode === 'solo' ? 'El equipo' : CASE.roles[roleOf(state, playerId)].name;
}

function requirePlaying(state, playerId) {
  if (!roleOf(state, playerId)) throw new GameError('No sos parte de esta partida.', 403);
  if (state.status !== 'playing') throw new GameError('La partida no está en juego.');
}

// ---------- Acciones ----------

export function join(state, playerId, role) {
  const CASE = caseOf(state);
  if (state.mode === 'solo') return joinSolo(state, playerId);
  if (!ROLES.includes(role)) throw new GameError('Ese rol no existe.');
  if (!playerId || playerId.length < 8) throw new GameError('Falta el identificador del jugador.');
  const current = roleOf(state, playerId);
  if (current === role) return state;
  if (current) throw new GameError(`Ya elegiste ser ${CASE.roles[current].short}.`);
  if (state.players[role]) throw new GameError(`Tu pareja ya eligió ser ${CASE.roles[role].short}.`, 409);

  state.players[role] = playerId;
  addLog(state, `${CASE.roles[role].name} entró a la partida.`);
  if (state.players.forense && state.players.investigador && state.status === 'lobby') {
    state.status = 'playing';
    state.startedAt = new Date().toISOString();
    addLog(state, 'Empieza la investigación. El reloj corre.');
  }
  return state;
}

function joinSolo(state, playerId) {
  if (!playerId || playerId.length < 8) throw new GameError('Falta el identificador del jugador.');
  if (roleOf(state, playerId)) return state;
  if (state.players.forense) throw new GameError('Esta partida ya se está jugando en otro celular.', 409);
  for (const r of ROLES) state.players[r] = playerId;
  state.status = 'playing';
  state.startedAt = new Date().toISOString();
  addLog(state, 'Empieza la investigación. El reloj corre.');
  return state;
}

export function answerGate(state, playerId, optionId) {
  const CASE = caseOf(state);
  requirePlaying(state, playerId);
  const gate = CASE.gates[state.phase];
  if (!gate) throw new GameError('En esta fase ya solo queda acusar.');
  if (!gate.options.some((o) => o.id === optionId)) throw new GameError('Elegí una de las opciones.');

  const who = actor(state, playerId);
  if (optionId === gate.correct) {
    state.phase += 1;
    addLog(state, `${who} acertó. Se abre la fase ${state.phase}: hay evidencia nueva para los dos.`);
  } else {
    state.wrong += 1;
    addLog(state, `${who} respondió mal la pregunta de la fase ${state.phase} (−${WRONG_COST}).`);
  }
  return state;
}

export function takeHint(state, playerId) {
  requirePlaying(state, playerId);
  const used = state.hints[state.phase] ?? 0;
  if (used >= HINT_COSTS.length) throw new GameError('Ya usaron todas las pistas de esta fase.');
  state.hints[state.phase] = used + 1;
  addLog(state, `${actor(state, playerId)} pidió la pista ${used + 1} (−${HINT_COSTS[used]}).`);
  return state;
}

export function ask(state, playerId, questionId) {
  const CASE = caseOf(state);
  requirePlaying(state, playerId);
  const found = findQuestion(CASE, questionId);
  if (!found) throw new GameError('Esa pregunta no existe.');
  if (getEvidence(CASE, found.question.evidence).phase > state.phase) throw new GameError('Todavía no tienen esa evidencia.');
  if (state.asked.includes(questionId)) return state;
  state.asked.push(questionId);
  addLog(state, `${actor(state, playerId)} le mostró ${found.question.evidence} a ${found.suspect.name}. Su respuesta está en Sospechosos.`);
  return state;
}

export function accuse(state, playerId, answers) {
  const CASE = caseOf(state);
  requirePlaying(state, playerId);
  if (state.phase < 3) throw new GameError('Todavía no pueden acusar: falta evidencia.');
  const parts = CASE.accusation.parts;
  for (const part of parts) {
    if (!part.options.some((o) => o.id === answers?.[part.id])) throw new GameError('Completen las tres respuestas de la acusación.');
  }
  const correct = parts.every((p) => answers[p.id] === p.correct);
  const chosen = Object.fromEntries(parts.map((p) => [p.id, answers[p.id]]));

  if (correct) {
    state.status = 'solved';
    state.finishedAt = new Date().toISOString();
    state.result = { correct: true, chosen };
    addLog(state, 'Caso resuelto.');
    return state;
  }

  state.accuseFails += 1;
  if (state.accuseFails >= MAX_ACCUSE_FAILS) {
    state.status = 'failed';
    state.finishedAt = new Date().toISOString();
    state.result = { correct: false, chosen };
    addLog(state, 'Segunda acusación equivocada. El caso queda sin resolver.');
  } else {
    addLog(state, `La acusación no se sostiene (−${ACCUSE_COST}). Les queda un intento.`);
  }
  return state;
}

// ---------- Vistas (lo único que sale al navegador) ----------

function findQuestion(CASE, questionId) {
  for (const suspect of CASE.suspects) {
    const question = suspect.questions.find((q) => q.id === questionId);
    if (question) return { suspect, question };
  }
  return null;
}

export function scoreOf(state, now = Date.now()) {
  let hintCost = 0;
  for (const used of Object.values(state.hints)) {
    hintCost += HINT_COSTS.slice(0, used).reduce((a, b) => a + b, 0);
  }
  let timeCost = 0;
  if (state.startedAt) {
    const end = state.finishedAt ? Date.parse(state.finishedAt) : now;
    const minutes = (end - Date.parse(state.startedAt)) / 60000;
    if (minutes > FREE_MINUTES) timeCost = Math.floor((minutes - FREE_MINUTES) / 10) * 20;
  }
  const breakdown = {
    hints: hintCost,
    wrong: state.wrong * WRONG_COST,
    accusations: state.accuseFails * ACCUSE_COST,
    time: timeCost,
  };
  const total = Math.max(0, 1000 - breakdown.hints - breakdown.wrong - breakdown.accusations - breakdown.time);
  return { total, breakdown };
}

function phaseEvidence(CASE, phase) {
  return Object.fromEntries(
    ROLES.map((r) => [r, CASE.evidence.filter((e) => e.role === r && e.phase === phase).map(({ id, title }) => ({ id, title }))]),
  );
}

export function publicState(code, state, playerId) {
  const CASE = caseOf(state);
  const mode = state.mode ?? 'duo';
  const myRoles = rolesOf(state, playerId);
  const myRole = mode === 'solo' ? (myRoles.length ? 'equipo' : null) : (myRoles[0] ?? null);
  const playing = state.status === 'playing';
  const finished = state.status === 'solved' || state.status === 'failed';
  const hintsUsed = state.hints[state.phase] ?? 0;
  const hintTexts = state.phase < 3 ? CASE.gates[state.phase].hints : CASE.accusation.hints;

  return {
    code,
    case: { id: CASE.id, number: CASE.number, title: CASE.title },
    mode,
    status: state.status,
    phase: state.phase,
    myRole,
    myRoles,
    phaseNames: CASE.phaseNames,
    // Qué evidencia abre la fase actual, por rol (solo títulos: los textos siguen protegidos).
    unlocked: state.status === 'playing' ? phaseEvidence(CASE, state.phase) : null,
    roles: Object.fromEntries(
      ROLES.map((r) => [r, { ...CASE.roles[r], taken: Boolean(state.players[r]), mine: myRoles.includes(r) }]),
    ),
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    serverNow: new Date().toISOString(),
    score: scoreOf(state),
    wrong: state.wrong,
    accuseFails: state.accuseFails,
    accuseLeft: MAX_ACCUSE_FAILS - state.accuseFails,
    gate: playing && state.phase < 3
      ? { question: CASE.gates[state.phase].question, options: CASE.gates[state.phase].options }
      : null,
    accusation: playing && state.phase === 3
      ? { parts: CASE.accusation.parts.map(({ id, question, options }) => ({ id, question, options })) }
      : null,
    hints: playing
      ? { used: hintsUsed, revealed: hintTexts.slice(0, hintsUsed), nextCost: HINT_COSTS[hintsUsed] ?? null }
      : null,
    log: state.log.slice(-20),
    askedCount: state.asked.length,
    result: finished ? resultView(state) : null,
  };
}

function resultView(state) {
  const CASE = caseOf(state);
  const parts = CASE.accusation.parts.map((p) => ({
    id: p.id,
    question: p.question,
    chosen: p.options.find((o) => o.id === state.result.chosen[p.id])?.label ?? '—',
    correct: p.options.find((o) => o.id === p.correct).label,
  }));
  return { solved: state.status === 'solved', parts, solution: CASE.solution };
}

function canSeeEvidence(state, myRoles, e) {
  const finished = state.status === 'solved' || state.status === 'failed';
  return finished || (state.status === 'playing' && myRoles.includes(e.role) && e.phase <= state.phase);
}

export function evidenceView(state, playerId) {
  const CASE = caseOf(state);
  const myRoles = rolesOf(state, playerId);
  if (!myRoles.length) throw new GameError('Elegí un rol para ver tu evidencia.', 403);
  const finished = state.status === 'solved' || state.status === 'failed';
  const visible = CASE.evidence.filter((e) => canSeeEvidence(state, myRoles, e));
  const lockedCount = CASE.evidence.filter((e) => myRoles.includes(e.role) && e.phase > state.phase).length;
  return {
    briefing: CASE.briefing,
    evidence: visible,
    lockedCount: finished ? 0 : lockedCount,
  };
}

export function suspectsView(state, playerId) {
  const CASE = caseOf(state);
  if (!roleOf(state, playerId)) throw new GameError('No sos parte de esta partida.', 403);
  return CASE.suspects.map((s) => ({
    id: s.id,
    name: s.name,
    age: s.age,
    role: s.role,
    statement: s.statement,
    photo: s.photo ?? null,
    questions: s.questions
      .filter((q) => getEvidence(CASE, q.evidence).phase <= state.phase)
      .map((q) => {
        const ev = getEvidence(CASE, q.evidence);
        const asked = state.asked.includes(q.id);
        return {
          id: q.id,
          evidenceId: ev.id,
          evidenceTitle: ev.title,
          ownedBy: ev.role,
          asked,
          answer: asked ? q.answer : null,
        };
      }),
  }));
}

// Las imágenes del caso se sirven por la API con las mismas reglas que la
// evidencia: una foto de cámara de la fase 3 no se puede abrir en la fase 1.
function mediaIn(blocks, file) {
  return (blocks ?? []).some((b) => b.type === 'image' && b.src === file);
}

export function canSeeMedia(state, playerId, file) {
  const CASE = caseOf(state);
  const myRoles = rolesOf(state, playerId);
  if (!myRoles.length) return false;
  if (CASE.suspects.some((s) => s.photo === file)) return state.status !== 'lobby';
  if (mediaIn(CASE.briefing.blocks, file)) return true;
  return CASE.evidence.some((e) => mediaIn(e.blocks, file) && canSeeEvidence(state, myRoles, e));
}
