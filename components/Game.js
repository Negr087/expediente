'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const POLL_MS = 2500;
const PHASE_NAMES = ['La escena', 'Las coartadas', 'La acusación'];

function getPlayerId(code) {
  const key = `expediente-jugador-${code}`;
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

async function api(path, options) {
  const res = await fetch(path, { cache: 'no-store', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Algo falló. Probá de nuevo.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function clock(t) {
  return new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function duration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Game({ code }) {
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [suspects, setSuspects] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [tab, setTab] = useState('expediente');
  const [toast, setToast] = useState(null);
  const [seenEvidence, setSeenEvidence] = useState(() => new Set());
  const lastLog = useRef(null);
  const sync = useRef({ phase: null, status: null, asked: null, role: null });

  useEffect(() => setPlayer(getPlayerId(code)), [code]);

  const applyRoom = useCallback((next, { quiet = false } = {}) => {
    setRoom(next);
    const newest = next.log.at(-1);
    if (newest && lastLog.current && newest.t !== lastLog.current && !quiet) {
      setToast(newest.text);
    }
    if (newest) lastLog.current = newest.t;
  }, []);

  const refreshDetails = useCallback(async (next, playerId) => {
    if (!next.myRole) return;
    const [ev, su] = await Promise.all([
      api(`/api/rooms/${code}/evidence?player=${playerId}`),
      next.status === 'lobby' ? Promise.resolve(null) : api(`/api/rooms/${code}/suspects?player=${playerId}`),
    ]);
    setEvidence(ev);
    if (su) setSuspects(su.suspects);
  }, [code]);

  // Sondeo del estado de la sala
  useEffect(() => {
    if (!player) return;
    let stop = false;
    let first = true;

    async function tick() {
      try {
        const next = await api(`/api/rooms/${code}?player=${player}`);
        if (stop) return;
        applyRoom(next, { quiet: first });
        first = false;
        const s = sync.current;
        if (s.phase !== next.phase || s.status !== next.status || s.asked !== next.askedCount || s.role !== next.myRole) {
          sync.current = { phase: next.phase, status: next.status, asked: next.askedCount, role: next.myRole };
          await refreshDetails(next, player);
        }
      } catch (err) {
        if (err.status === 404) setFatal('No existe una partida con ese código. Revisá las letras o creá una nueva.');
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [code, player, applyRoom, refreshDetails]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const act = useCallback(async (body) => {
    const next = await api(`/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, ...body }),
    });
    lastLog.current = next.log.at(-1)?.t ?? lastLog.current; // la acción propia no se anuncia
    applyRoom(next, { quiet: true });
    sync.current = { phase: next.phase, status: next.status, asked: next.askedCount, role: next.myRole };
    await refreshDetails(next, player);
    return next;
  }, [code, player, applyRoom, refreshDetails]);

  if (fatal) {
    return (
      <main className="center-msg">
        <h1>Partida no encontrada</h1>
        <p>{fatal}</p>
        <a className="btn" href="/">Volver al inicio</a>
      </main>
    );
  }

  if (!room) {
    return <main className="center-msg"><p>Abriendo el expediente…</p></main>;
  }

  if (!room.myRole) return <RolePick room={room} act={act} />;
  if (room.status === 'lobby') return <Lobby room={room} />;
  if (room.result) return <Resolution room={room} evidence={evidence} />;

  return (
    <main className="game">
      <TopBar room={room} />
      <PhaseTrack phase={room.phase} />

      {tab === 'expediente' && (
        <Dossier room={room} data={evidence} seen={seenEvidence} onSeen={setSeenEvidence} />
      )}
      {tab === 'sospechosos' && <Suspects suspects={suspects} act={act} />}
      {tab === 'resolver' && <Solve room={room} act={act} />}

      <nav className="tabs" aria-label="Secciones">
        <div className="tabs-inner" role="tablist">
          {[
            ['expediente', 'Expediente'],
            ['sospechosos', 'Sospechosos'],
            ['resolver', room.phase < 3 ? 'Avanzar' : 'Acusar'],
          ].map(([id, label]) => (
            <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); window.scrollTo(0, 0); }}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

// ---------- Sala ----------

function Invite({ code }) {
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}/sala/${code}`;
    setLink(url);
    QRCode.toDataURL(url, { margin: 1, width: 256, color: { dark: '#1f1d1a', light: '#ece7da' } }).then(setQr);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="invite">
      {qr ? <img src={qr} alt={`Código QR para entrar a la partida ${code}`} /> : <div style={{ width: 128, height: 128 }} />}
      <div>
        <p>Código de la partida</p>
        <div className="code">{code}</div>
        <p>Tu pareja escanea el QR o escribe el código en la página de inicio.</p>
        <button className="btn btn-ink" onClick={copy} style={{ minHeight: 40, padding: '0 14px' }}>
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  );
}

function RolePick({ room, act }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(role) {
    setBusy(true);
    setError('');
    try {
      await act({ type: 'join', role });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const full = Object.values(room.roles).every((r) => r.taken);

  return (
    <main className="game">
      <h1 className="screen-title">Caso N.º {String(room.case.number).padStart(2, '0')}: {room.case.title}</h1>
      {full ? (
        <p className="screen-lead">Los dos roles de esta partida ya están ocupados. Si sos parte de ella, abrí el link desde el mismo celular con el que entraste.</p>
      ) : (
        <>
          <p className="screen-lead">Elegí cómo vas a investigar. Tu pareja toma el otro rol desde su celular.</p>
          <div className="role-pick">
            {Object.entries(room.roles).map(([id, r]) => (
              <button key={id} className="role-option" disabled={r.taken || busy} onClick={() => pick(id)}>
                {r.taken && <span className="stamp">TOMADO</span>}
                <h3>{r.name}</h3>
                <p>{r.desc}</p>
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div style={{ marginTop: 28 }}><Invite code={room.code} /></div>
        </>
      )}
    </main>
  );
}

function Lobby({ room }) {
  const other = Object.values(room.roles).find((r) => !r.mine);
  return (
    <main className="game">
      <h1 className="screen-title">Sos {room.roles[room.myRole].name}.</h1>
      <p className="screen-lead">Falta {other.name}. Pasale este código a tu pareja: el reloj arranca cuando entren los dos.</p>
      <Invite code={room.code} />
      <p className="waiting">Esperando a tu pareja…</p>
    </main>
  );
}

// ---------- Juego ----------

function TopBar({ room }) {
  const offset = useRef(Date.parse(room.serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    offset.current = Date.parse(room.serverNow) - Date.now();
  }, [room.serverNow]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = room.startedAt ? now + offset.current - Date.parse(room.startedAt) : 0;

  return (
    <header className="topbar">
      <a className="brand" href="/" style={{ fontSize: 18 }}>Expediente</a>
      <div className="topbar-stats">
        <div><span>Sala</span>{room.code}</div>
        <div><span>Tiempo</span>{duration(elapsed)}</div>
        <div><span>Puntos</span>{room.score.total}</div>
      </div>
    </header>
  );
}

function PhaseTrack({ phase }) {
  return (
    <div className="phases" aria-label={`Fase ${phase} de 3`}>
      {PHASE_NAMES.map((name, i) => {
        const n = i + 1;
        const cls = n < phase ? 'phase done' : n === phase ? 'phase now' : 'phase';
        return <div key={name} className={cls} aria-current={n === phase ? 'step' : undefined}>Fase {n}<br />{name}</div>;
      })}
    </div>
  );
}

function Dossier({ room, data, seen, onSeen }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => onSeen(new Set(data.evidence.map((e) => e.id))), 1500);
    return () => clearTimeout(t);
  }, [data, onSeen]);

  if (!data) return <p className="screen-lead">Cargando evidencia…</p>;
  const role = room.roles[room.myRole];

  return (
    <section>
      <h2 className="screen-title">Tu expediente</h2>
      <p className="screen-lead">Sos {role.name}. Lo que ves acá, tu pareja no lo ve: contáselo.</p>

      <details className="briefing" open={room.phase === 1}>
        <summary>Volver a leer el informe inicial</summary>
        <Sheet item={{ id: 'Caso', ...data.briefing }} />
      </details>
      {[...data.evidence].reverse().map((item) => (
        <Sheet key={item.id} item={item} isNew={seen.size > 0 && !seen.has(item.id)} />
      ))}

      {data.lockedCount > 0 && (
        <div className="locked">
          {data.lockedCount === 1 ? 'Queda 1 evidencia' : `Quedan ${data.lockedCount} evidencias`} sin abrir.
          Respondan la pregunta de la fase en Avanzar para desbloquear más.
        </div>
      )}
    </section>
  );
}

function Sheet({ item, isNew }) {
  return (
    <article className="sheet">
      <span className="sheet-id">{item.id}</span>
      {isNew && <span className="stamp new-mark">NUEVA</span>}
      <h3>{item.title}</h3>
      {item.source && <p className="sheet-source">{item.source}</p>}
      {item.blocks.map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}

function Block({ b }) {
  switch (b.type) {
    case 'p':
      return <p>{b.text}</p>;
    case 'note':
      return <p className="note">{b.text}</p>;
    case 'kv':
      return (
        <table className="kv">
          <tbody>
            {b.rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}
          </tbody>
        </table>
      );
    case 'log':
      return (
        <>
          {b.title && <p className="log-title">{b.title}</p>}
          <ol className="log">
            {b.rows.map(([t, text]) => <li key={t + text}><time>{t}</time><span>{text}</span></li>)}
          </ol>
        </>
      );
    case 'quote':
      return (
        <blockquote className="quote">
          <p>“{b.text}”</p>
          <cite>{b.who}</cite>
        </blockquote>
      );
    case 'photo':
      return (
        <figure className="photo">
          {b.text}
          <figcaption>{b.caption}</figcaption>
        </figure>
      );
    default:
      return null;
  }
}

function Suspects({ suspects, act }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  if (!suspects) return <p className="screen-lead">Cargando sospechosos…</p>;

  async function show(questionId) {
    setBusy(questionId);
    setError('');
    try {
      await act({ type: 'ask', question: questionId });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="screen-title">Sospechosos</h2>
      <p className="screen-lead">Mostrales evidencia para ver cómo reaccionan. Lo que respondan lo ven los dos.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {suspects.map((s) => (
        <article key={s.id} className="suspect">
          <h3>{s.name}</h3>
          <p className="who">{s.age} años. {s.role}.</p>
          <p className="statement">“{s.statement}”</p>
          {s.questions.map((q) =>
            q.asked ? (
              <div key={q.id} className="answer">
                <span className="label">Le mostraron {q.evidenceId}: {q.evidenceTitle}</span>
                <p>“{q.answer}”</p>
              </div>
            ) : (
              <button key={q.id} className="q-btn" onClick={() => show(q.id)} disabled={busy === q.id}>
                Mostrarle {q.evidenceId}: {q.evidenceTitle}
                <small>La tiene {q.ownedBy === 'Forense' ? 'la Forense' : 'el Investigador'}</small>
              </button>
            ),
          )}
        </article>
      ))}
    </section>
  );
}

function Solve({ room, act }) {
  return (
    <section>
      {room.gate ? <Gate room={room} act={act} /> : <Accuse room={room} act={act} />}
      <Hints room={room} act={act} />
      <Bitacora log={room.log} />
    </section>
  );
}

function Gate({ room, act }) {
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setChoice(''); setError(''); }, [room.phase]);

  async function submit(e) {
    e.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError('');
    const wrongBefore = room.wrong;
    try {
      const next = await act({ type: 'answer', option: choice });
      if (next.wrong > wrongBefore) setError('No es eso. Revisen la evidencia y vuelvan a intentar (−25 puntos).');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="screen-title">Para abrir la fase {room.phase + 1}</h2>
      <p className="screen-lead">Pónganse de acuerdo antes de responder: cada error resta 25 puntos.</p>
      <form className="panel" onSubmit={submit}>
        <h3>{room.gate.question}</h3>
        {room.gate.options.map((o) => (
          <label key={o.id} className="choice">
            <input type="radio" name="gate" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
            {o.label}
          </label>
        ))}
        <button className="btn btn-ink btn-block" disabled={!choice || busy} style={{ marginTop: 8 }}>
          {busy ? 'Revisando…' : 'Responder'}
        </button>
        {error && <p className="error-line" role="alert">{error}</p>}
      </form>
    </>
  );
}

function Accuse({ room, act }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parts = room.accusation.parts;
  const complete = parts.every((p) => answers[p.id]);

  async function submit(e) {
    e.preventDefault();
    if (!complete) return;
    const ok = window.confirm(
      room.accuseLeft > 1
        ? '¿Confirman la acusación? Si se equivocan pierden 300 puntos y les queda un solo intento.'
        : 'Es su último intento. Si se equivocan, el caso queda sin resolver. ¿Confirman?',
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const next = await act({ type: 'accuse', answers });
      if (!next.result) setError('La acusación no se sostiene. Revisen las tres respuestas: les queda un intento.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="screen-title">La acusación</h2>
      <p className="screen-lead">
        Ya tienen toda la evidencia. Respondan las tres preguntas juntos.{' '}
        {room.accuseLeft === 1 ? 'Les queda un solo intento.' : 'Tienen dos intentos.'}
      </p>
      <form className="panel" onSubmit={submit}>
        {parts.map((p) => (
          <fieldset key={p.id} className="fieldset">
            <legend>{p.question}</legend>
            {p.options.map((o) => (
              <label key={o.id} className="choice">
                <input
                  type="radio"
                  name={p.id}
                  value={o.id}
                  checked={answers[p.id] === o.id}
                  onChange={() => setAnswers((a) => ({ ...a, [p.id]: o.id }))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        ))}
        <button className="btn btn-ink btn-block" disabled={!complete || busy}>
          {busy ? 'Revisando…' : 'Acusar'}
        </button>
        {error && <p className="error-line" role="alert">{error}</p>}
      </form>
    </>
  );
}

function Hints({ room, act }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const h = room.hints;
  if (!h) return null;

  async function take() {
    if (!window.confirm(`La pista cuesta ${h.nextCost} puntos y la ven los dos. ¿La piden?`)) return;
    setBusy(true);
    setError('');
    try {
      await act({ type: 'hint' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>Pistas de esta fase</h3>
      {h.revealed.length > 0 ? (
        <ol className="hint-list">{h.revealed.map((t) => <li key={t}>{t}</li>)}</ol>
      ) : (
        <p style={{ marginTop: 0 }}>Si se traban, pidan una pista. La tercera da la respuesta.</p>
      )}
      {h.nextCost ? (
        <button className="btn btn-ink" onClick={take} disabled={busy}>
          Pedir pista {h.used + 1} (−{h.nextCost})
        </button>
      ) : (
        <p style={{ margin: 0 }}>Ya usaron las tres pistas de esta fase.</p>
      )}
      {error && <p className="error-line" role="alert">{error}</p>}
    </div>
  );
}

function Bitacora({ log }) {
  if (!log.length) return null;
  return (
    <div className="bitacora">
      <h3>Bitácora</h3>
      <ol>
        {[...log].reverse().map((l) => (
          <li key={l.t + l.text}><time>{clock(l.t)}</time><span>{l.text}</span></li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Resolución ----------

function discounts(b) {
  const parts = [
    [b.hints, 'pistas'],
    [b.wrong, 'respuestas incorrectas'],
    [b.accusations, 'acusaciones fallidas'],
    [b.time, 'tiempo'],
  ].filter(([n]) => n > 0).map(([n, label]) => `${label} −${n}`);
  return parts.length ? `Descuentos: ${parts.join(', ')}.` : 'Sin descuentos: resolvieron el caso sin pistas ni errores.';
}

function Resolution({ room, evidence }) {
  const r = room.result;
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const time = room.startedAt && room.finishedAt ? Date.parse(room.finishedAt) - Date.parse(room.startedAt) : 0;
  const b = room.score.breakdown;

  return (
    <main className="game">
      <div className="verdict">
        <span className={r.solved ? 'stamp' : 'stamp fail'}>{r.solved ? 'CASO RESUELTO' : 'SIN RESOLVER'}</span>
        <div className="score">{room.score.total}</div>
        <div className="score-label">puntos en {duration(time)}</div>
      </div>

      <div className="panel" style={{ marginTop: 28 }}>
        <h3>Su acusación</h3>
        <table className="compare">
          <thead><tr><th>Pregunta</th><th>Ustedes</th><th>Respuesta</th></tr></thead>
          <tbody>
            {r.parts.map((p) => (
              <tr key={p.id}>
                <td>{p.question}</td>
                <td className={p.chosen === p.correct ? 'good' : 'bad'}>{p.chosen}</td>
                <td>{p.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginBottom: 0, fontSize: 14 }}>{discounts(b)}</p>
      </div>

      <article className="sheet">
        <span className="sheet-id">Resolución</span>
        <h3>Qué pasó esa noche</h3>
        {r.solution.map((t) => <p key={t}>{t}</p>)}
      </article>

      {evidence?.evidence?.length > 0 && (
        <>
          <h2 className="screen-title">Toda la evidencia</h2>
          <p className="screen-lead">Ahora pueden ver también lo que tenía su pareja.</p>
          {evidence.evidence.map((item) => <Sheet key={item.id} item={item} />)}
        </>
      )}

      <p style={{ textAlign: 'center', marginTop: 32 }}><a className="btn" href="/">Jugar otra partida</a></p>
    </main>
  );
}
