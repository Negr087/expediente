'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const POLL_MS = 2500;
const ROLE_IDS = ['forense', 'investigador'];
const ROLE_SHORT = { forense: 'Forense', investigador: 'Investigador' };
const ROLE_NAME = { forense: 'La Forense', investigador: 'El Investigador' };

// Sala y jugador, para pedir las imágenes del caso a la API.
const MediaCtx = createContext(null);

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

// Un Set guardado en localStorage: qué evidencias y respuestas ya se leyeron.
function useStoredSet(key) {
  const [value, setValue] = useState(() => new Set());
  useEffect(() => {
    try {
      setValue(new Set(JSON.parse(localStorage.getItem(key) ?? '[]')));
    } catch {}
  }, [key]);
  const add = useCallback((ids) => {
    setValue((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [key]);
  return [value, add];
}

function readNumber(key) {
  try { return Number(localStorage.getItem(key) ?? 0); } catch { return 0; }
}

function writeNumber(key, n) {
  try { localStorage.setItem(key, String(n)); } catch {}
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

// Los casos a pedido no tienen número.
function caseTitle(c) {
  return c.number ? `Caso N.º ${String(c.number).padStart(2, '0')}: ${c.title}` : c.title;
}

function scrollToEvidence(id) {
  document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Game({ code }) {
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [suspects, setSuspects] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [tab, setTab] = useState('expediente');
  const [toast, setToast] = useState(null);
  const [intro, setIntro] = useState(null);
  const [view, setView] = useState('forense'); // en un celular: de qué rol se muestra el expediente
  const [seenEvidence, markEvidence] = useStoredSet(`expediente-vistas-${code}`);
  const [seenAnswers, markAnswers] = useStoredSet(`expediente-respuestas-${code}`);
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

  // Cada fase nueva (y el arranque) se anuncia una vez, con lo que tiene que leer cada uno.
  useEffect(() => {
    if (room?.status !== 'playing' || !room.unlocked) return;
    const key = `expediente-fase-${code}`;
    if (readNumber(key) >= room.phase) return;
    writeNumber(key, room.phase);
    setIntro(room.phase);
    setToast(null);
  }, [code, room?.status, room?.phase, room?.unlocked]);

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

  const goTo = useCallback((id) => { setTab(id); window.scrollTo(0, 0); }, []);

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

  let screen;
  if (!room.myRole) {
    screen = room.mode === 'solo' ? <SoloStart room={room} act={act} /> : <RolePick room={room} act={act} />;
  } else if (room.status === 'lobby') {
    screen = <Lobby room={room} />;
  } else if (room.result) {
    screen = <Resolution room={room} evidence={evidence} />;
  }
  if (screen) return <MediaCtx.Provider value={{ code, player }}>{screen}</MediaCtx.Provider>;

  const myEvidence = evidence?.evidence ?? [];
  const unseenEvidence = myEvidence.filter((e) => !seenEvidence.has(e.id)).length;
  const answered = (suspects ?? []).flatMap((s) => s.questions.filter((q) => q.asked).map((q) => q.id));
  const unseenAnswers = answered.filter((id) => !seenAnswers.has(id)).length;

  return (
    <MediaCtx.Provider value={{ code, player }}>
      <main className="game">
        <TopBar room={room} />
        <RoleStrip room={room} />
        <PhaseTrack phase={room.phase} names={room.phaseNames} />

        {tab === 'expediente' && (
          <Dossier
            room={room}
            data={evidence}
            seen={seenEvidence}
            onSeen={markEvidence}
            view={view}
            setView={setView}
            goTo={goTo}
          />
        )}
        {tab === 'sospechosos' && (
          <Suspects room={room} suspects={suspects} act={act} seen={seenAnswers} onSeen={markAnswers} />
        )}
        {tab === 'resolver' && <Solve room={room} act={act} />}

        <nav className="tabs" aria-label="Secciones">
          <div className="tabs-inner" role="tablist">
            {[
              ['expediente', 'Expediente', unseenEvidence],
              ['sospechosos', 'Sospechosos', unseenAnswers],
              ['resolver', room.phase < 3 ? 'Avanzar' : 'Acusar', 0],
            ].map(([id, label, badge]) => (
              <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => goTo(id)}>
                {label}
                {badge > 0 && tab !== id && <span className="badge" aria-label={`${badge} sin leer`}>{badge}</span>}
              </button>
            ))}
          </div>
        </nav>

        {intro && (
          <PhaseIntro
            room={room}
            onClose={() => {
              setIntro(null);
              if (room.mode === 'solo') setView('forense');
              goTo('expediente');
            }}
          />
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    </MediaCtx.Provider>
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
      <h1 className="screen-title">{caseTitle(room.case)}</h1>
      {full ? (
        <p className="screen-lead">Los dos roles de esta partida ya están ocupados. Si sos parte de ella, abrí el link desde el mismo celular con el que entraste.</p>
      ) : (
        <>
          <p className="screen-lead">Elegí cómo vas a investigar. Tu pareja toma el otro rol desde su celular.</p>
          <div className="role-pick">
            {Object.entries(room.roles).map(([id, r]) => (
              <button key={id} className={`role-option role-${id}`} disabled={r.taken || busy} onClick={() => pick(id)}>
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

function SoloStart({ room, act }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const taken = Object.values(room.roles).some((r) => r.taken);

  async function start() {
    setBusy(true);
    setError('');
    try {
      await act({ type: 'join', role: 'equipo' });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="game">
      <h1 className="screen-title">{caseTitle(room.case)}</h1>
      {taken ? (
        <p className="screen-lead">Esta partida ya se está jugando en otro celular. Para jugar acá, creá una partida nueva.</p>
      ) : (
        <>
          <p className="screen-lead">Juegan los dos con este celular. Antes de abrir el expediente, repártanse los roles:</p>
          <div className="role-pick">
            {Object.entries(room.roles).map(([id, r]) => (
              <div key={id} className={`role-option role-${id}`}>
                <h3>{r.name}</h3>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
          <ol className="how-solo">
            <li>Cada documento tiene el color y el nombre de quien lo lee.</li>
            <li>Pásense el celular: cada uno lee lo suyo <strong>en voz alta</strong>, sin mostrarle la pantalla al otro si quieren más desafío.</li>
            <li>Cuando se abre una fase, el juego les avisa qué le toca leer a cada uno.</li>
          </ol>
          <button className="btn btn-block" onClick={start} disabled={busy} style={{ marginTop: 8 }}>
            {busy ? 'Abriendo…' : 'Abrir el expediente'}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
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

function RoleStrip({ room }) {
  if (room.mode === 'solo') {
    return (
      <div className="role-strip">
        <span>Un celular para los dos:</span>
        <span className="role-chip role-forense">Forense</span>
        <span className="role-chip role-investigador">Investigador</span>
      </div>
    );
  }
  const partner = ROLE_IDS.find((r) => r !== room.myRole);
  return (
    <div className={`role-strip mine role-${room.myRole}`}>
      <span>Sos <strong>{ROLE_NAME[room.myRole]}</strong></span>
      <span className="role-strip-partner">Tu pareja: <span className={`role-chip role-${partner}`}>{ROLE_SHORT[partner]}</span></span>
    </div>
  );
}

function PhaseTrack({ phase, names }) {
  return (
    <div className="phases" aria-label={`Fase ${phase} de 3`}>
      {names.map((name, i) => {
        const n = i + 1;
        const cls = n < phase ? 'phase done' : n === phase ? 'phase now' : 'phase';
        return <div key={name} className={cls} aria-current={n === phase ? 'step' : undefined}>Fase {n}<br />{name}</div>;
      })}
    </div>
  );
}

// Lista de lo que abre la fase para un rol, con tilde si ya se leyó.
function ReadList({ items, seen, onPick }) {
  return (
    <ul className="read-list">
      {items.map((e) => {
        const done = seen?.has(e.id);
        const label = <><b>{e.id}</b> {e.title}</>;
        return (
          <li key={e.id} className={done ? 'done' : undefined}>
            {onPick ? <button onClick={() => onPick(e.id)}>{label}</button> : <span>{label}</span>}
            {done && <span className="check" aria-label="leída">✓</span>}
          </li>
        );
      })}
    </ul>
  );
}

function PhaseIntro({ room, onClose }) {
  const solo = room.mode === 'solo';
  const name = room.phaseNames[room.phase - 1];
  const first = room.phase === 1;
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const order = solo ? ROLE_IDS : [room.myRole, ...ROLE_IDS.filter((r) => r !== room.myRole)];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro-card">
        <span className="stamp">{first ? 'CASO ABIERTO' : 'NUEVA EVIDENCIA'}</span>
        <p className="kicker">Fase {room.phase} · {name}</p>
        <h2 id="intro-title">{first ? 'Empieza la investigación' : `Se abrió la fase ${room.phase}`}</h2>
        <p className="intro-lead">
          {solo
            ? 'Pásense el celular. Cada uno lee en voz alta lo que le toca:'
            : 'Esto es lo que tiene cada uno. Lo de tu pareja aparece solo en su celular.'}
        </p>

        {order.map((r) => {
          const mine = !solo && r === room.myRole;
          const title = solo ? `${ROLE_NAME[r]} lee` : mine ? `Vos (${ROLE_NAME[r]}) leés` : `Tu pareja (${ROLE_NAME[r]}) lee`;
          return (
            <div key={r} className={`intro-role role-${r}${!solo && !mine ? ' partner' : ''}`}>
              <h3>{title}</h3>
              <ReadList items={room.unlocked[r]} />
              {!solo && !mine && <p className="intro-note">Pedile que te cuente qué dice.</p>}
            </div>
          );
        })}

        <p className="intro-next">
          Después, cuéntense lo que encontraron
          {room.gate ? <> y respondan: <strong>«{room.gate.question}»</strong></> : <> y armen la acusación: quién, cómo y por qué.</>}
        </p>
        <button ref={closeRef} className="btn btn-ink btn-block" onClick={onClose}>
          {solo ? 'Empezar a leer' : 'Ver mi evidencia'}
        </button>
      </div>
    </div>
  );
}

function Mission({ room, seen, solo, onPick, goTo }) {
  const order = solo ? ROLE_IDS : [room.myRole, ...ROLE_IDS.filter((r) => r !== room.myRole)];
  return (
    <div className="mission">
      <p className="kicker">Fase {room.phase} · {room.phaseNames[room.phase - 1]}</p>
      <h3>Qué hacer ahora</h3>
      <ol className="mission-steps">
        <li>
          {room.phase === 1 ? 'Lean su evidencia:' : 'Lean la evidencia nueva:'}
          <div className="mission-roles">
            {order.map((r) => {
              const mine = solo || r === room.myRole;
              return (
                <div key={r} className={`mission-role role-${r}${mine ? '' : ' partner'}`}>
                  <span className={`role-chip role-${r}`}>{solo ? ROLE_SHORT[r] : mine ? 'Vos' : 'Tu pareja'}</span>
                  <ReadList items={room.unlocked[r]} seen={mine ? seen : null} onPick={mine ? (id) => onPick(r, id) : null} />
                </div>
              );
            })}
          </div>
        </li>
        <li>{solo ? 'Léanse en voz alta lo que tiene cada uno.' : 'Cuéntense lo que tiene cada uno: tu pareja no ve tu pantalla.'}</li>
        <li>
          Muéstrenles la evidencia a los{' '}
          <button className="link" onClick={() => goTo('sospechosos')}>sospechosos</button>.
        </li>
        <li>
          {room.gate ? (
            <>Respondan en <button className="link" onClick={() => goTo('resolver')}>Avanzar</button>: «{room.gate.question}»</>
          ) : (
            <><button className="link" onClick={() => goTo('resolver')}>Acusen</button>: quién, cómo y por qué.</>
          )}
        </li>
      </ol>
    </div>
  );
}

function Dossier({ room, data, seen, onSeen, view, setView, goTo }) {
  const solo = room.mode === 'solo';
  if (!data) return <p className="screen-lead">Cargando evidencia…</p>;

  const items = solo ? data.evidence.filter((e) => e.role === view) : data.evidence;
  const unseenBy = (r) => data.evidence.filter((e) => e.role === r && !seen.has(e.id)).length;

  function pick(role, id) {
    if (solo && role !== view) {
      setView(role);
      setTimeout(() => scrollToEvidence(id), 50);
    } else {
      scrollToEvidence(id);
    }
  }

  const phases = [];
  for (let p = room.phase; p >= 1; p--) {
    const list = items.filter((e) => e.phase === p);
    if (list.length) phases.push([p, list]);
  }

  return (
    <section>
      <Mission room={room} seen={seen} solo={solo} onPick={pick} goTo={goTo} />

      <h2 className="screen-title">{solo ? 'El expediente' : 'Tu expediente'}</h2>
      {solo ? (
        <>
          <p className="screen-lead">Elegí de quién es el turno de leer.</p>
          <div className="role-switch" role="tablist" aria-label="Rol">
            {ROLE_IDS.map((r) => {
              const n = unseenBy(r);
              return (
                <button key={r} role="tab" aria-selected={view === r} className={`role-${r}`} onClick={() => setView(r)}>
                  {ROLE_NAME[r]}
                  {n > 0 && <span className="badge">{n}</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="screen-lead">Sos {ROLE_NAME[room.myRole]}. Esto lo ves solo vos: contáselo a tu pareja.</p>
      )}

      <details className="briefing" open={room.phase === 1}>
        <summary>Volver a leer el informe inicial</summary>
        <Sheet item={{ id: 'Caso', ...data.briefing }} />
      </details>

      {phases.map(([p, list]) => (
        <div key={p}>
          <h3 className="phase-heading">
            Fase {p} · {room.phaseNames[p - 1]}
            {p === room.phase && p > 1 && <span className="phase-new">recién abierta</span>}
          </h3>
          {list.map((item) => (
            <Sheet key={item.id} item={item} showRole={solo} isNew={!seen.has(item.id)} onSeen={onSeen} />
          ))}
        </div>
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

// Una hoja cuenta como leída cuando estuvo a la vista un momento.
function useSeenOnView(id, onSeen) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onSeen) return;
    let timer = null;
    const obs = new IntersectionObserver(([entry]) => {
      const visible = entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.5;
      clearTimeout(timer);
      if (visible) timer = setTimeout(() => onSeen([id]), 1200);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    obs.observe(el);
    return () => { clearTimeout(timer); obs.disconnect(); };
  }, [id, onSeen]);
  return ref;
}

function Sheet({ item, isNew, onSeen, showRole = true }) {
  const ref = useSeenOnView(item.id, isNew ? onSeen : null);
  const role = item.role;
  return (
    <article ref={ref} id={`ev-${item.id}`} className={`sheet${role ? ` role-${role}` : ''}`}>
      <span className="sheet-id">{item.id}{role && showRole ? ` · ${ROLE_SHORT[role]}` : ''}</span>
      {isNew && <span className="stamp new-mark">NUEVA</span>}
      <h3>{item.title}</h3>
      {item.source && <p className="sheet-source">{item.source}</p>}
      {item.blocks.map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}

function mediaUrl(ctx, file) {
  return `/api/rooms/${ctx.code}/media/${file}?player=${ctx.player}`;
}

function Lightbox({ src, alt, caption, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={caption || alt} onClick={onClose}>
      <img src={src} alt={alt} />
      {caption && <p>{caption}</p>}
      <button className="btn btn-ghost" onClick={onClose} autoFocus>Cerrar</button>
    </div>
  );
}

function Picture({ b }) {
  const ctx = useContext(MediaCtx);
  const [zoom, setZoom] = useState(false);
  const src = mediaUrl(ctx, b.src);
  return (
    <figure className={`media media-${b.style ?? 'polaroid'}`}>
      <button className="media-btn" onClick={() => setZoom(true)} aria-label={`Ampliar ${b.caption ?? 'imagen'}`}>
        <img src={src} alt={b.alt ?? ''} loading="lazy" />
        <span className="zoom-hint" aria-hidden="true">Ampliar</span>
      </button>
      {(b.caption || b.text) && (
        <figcaption>
          {b.caption && <strong>{b.caption}</strong>}
          {b.text && <span>{b.text}</span>}
        </figcaption>
      )}
      {zoom && <Lightbox src={src} alt={b.alt ?? ''} caption={b.caption} onClose={() => setZoom(false)} />}
    </figure>
  );
}

function Block({ b }) {
  switch (b.type) {
    case 'p':
      return <p>{b.text}</p>;
    case 'note':
      return <p className="note">{b.text}</p>;
    case 'image':
      return <Picture b={b} />;
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

function Portrait({ suspect }) {
  const ctx = useContext(MediaCtx);
  const [zoom, setZoom] = useState(false);
  if (!suspect.photo) return null;
  const src = mediaUrl(ctx, suspect.photo);
  return (
    <>
      <button className="portrait" onClick={() => setZoom(true)} aria-label={`Ver la foto de ${suspect.name}`}>
        <img src={src} alt={`Foto de ${suspect.name}`} />
      </button>
      {zoom && <Lightbox src={src} alt={`Foto de ${suspect.name}`} caption={suspect.name} onClose={() => setZoom(false)} />}
    </>
  );
}

function Suspects({ room, suspects, act, seen, onSeen }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(() => new Set());
  const solo = room.mode === 'solo';

  // Las respuestas que llegan mientras se mira esta pantalla se marcan como nuevas.
  useEffect(() => {
    if (!suspects) return;
    const ids = suspects.flatMap((s) => s.questions.filter((q) => q.asked && !seen.has(q.id)).map((q) => q.id));
    if (!ids.length) return;
    setFresh((prev) => new Set([...prev, ...ids]));
    onSeen(ids);
  }, [suspects, seen, onSeen]);

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

  function owner(role) {
    if (solo) return { label: `La lee ${ROLE_NAME[role].toLowerCase()}`, chip: ROLE_SHORT[role] };
    if (room.myRoles.includes(role)) return { label: 'Está en tu expediente', chip: 'Tuya' };
    return { label: 'La tiene tu pareja: pedile que te la lea antes', chip: 'De tu pareja' };
  }

  return (
    <section>
      <h2 className="screen-title">Sospechosos</h2>
      <p className="screen-lead">
        Mostrales evidencia para ver cómo reaccionan.{' '}
        {solo ? 'Lean la respuesta en voz alta.' : 'Lo que respondan lo ven los dos.'}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {suspects.map((s) => (
        <article key={s.id} className="suspect">
          <div className="suspect-head">
            <Portrait suspect={s} />
            <div>
              <h3>{s.name}</h3>
              <p className="who">{s.age} años. {s.role}.</p>
            </div>
          </div>
          <p className="statement">“{s.statement}”</p>
          {s.questions.map((q) => {
            const o = owner(q.ownedBy);
            return q.asked ? (
              <div key={q.id} className={`answer role-${q.ownedBy}`}>
                {fresh.has(q.id) && <span className="answer-new">Nueva</span>}
                <span className="label">Le mostraron {q.evidenceId}: {q.evidenceTitle}</span>
                <p>“{q.answer}”</p>
              </div>
            ) : (
              <button key={q.id} className={`q-btn role-${q.ownedBy}`} onClick={() => show(q.id)} disabled={busy === q.id}>
                <span className={`role-chip role-${q.ownedBy}`}>{o.chip}</span>
                Mostrarle {q.evidenceId}: {q.evidenceTitle}
                <small>{o.label}</small>
              </button>
            );
          })}
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
    const who = room.mode === 'solo' ? '' : ' y la ven los dos';
    if (!window.confirm(`La pista cuesta ${h.nextCost} puntos${who}. ¿La piden?`)) return;
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
          <p className="screen-lead">
            {room.mode === 'solo' ? 'Todo el expediente, junto.' : 'Ahora pueden ver también lo que tenía su pareja.'}
          </p>
          {evidence.evidence.map((item) => <Sheet key={item.id} item={item} />)}
        </>
      )}

      <p style={{ textAlign: 'center', marginTop: 32 }}><a className="btn" href="/">Jugar otra partida</a></p>
    </main>
  );
}
