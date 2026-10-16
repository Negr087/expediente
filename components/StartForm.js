'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartForm({ cases }) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(cases[0]?.id);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(mode) {
    setBusy(mode);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/sala/${data.code}`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la partida.');
      setBusy(false);
    }
  }

  function join(e) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError('El código tiene 4 letras.');
      return;
    }
    router.push(`/sala/${clean}`);
  }

  return (
    <>
      {cases.length > 1 && (
        <fieldset className="case-pick">
          <legend>Elegí el caso</legend>
          {cases.map((c) => (
            <label key={c.id} className="case-option">
              <input type="radio" name="caso" value={c.id} checked={caseId === c.id} onChange={() => setCaseId(c.id)} />
              <span>
                <strong>N.º {String(c.number).padStart(2, '0')} · {c.title}</strong>
                {c.duration && <em className="duration">≈ {c.duration} min</em>}
                {c.draft && <em className="draft">Borrador</em>}
                {c.teaser && <small>{c.teaser}</small>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="start-modes">
        <button className="mode-btn" onClick={() => create('solo')} disabled={Boolean(busy)}>
          <strong>{busy === 'solo' ? 'Creando…' : 'Jugar en un celular'}</strong>
          <span>Los dos con la misma pantalla. Cada uno lee su parte en voz alta.</span>
        </button>
        <button className="mode-btn mode-duo" onClick={() => create('duo')} disabled={Boolean(busy)}>
          <strong>{busy === 'duo' ? 'Creando…' : 'Cada uno con su celular'}</strong>
          <span>Evidencia secreta para cada rol. Más desafío: tienen que contarse todo.</span>
        </button>
      </div>
      <div className="start">
        <form className="join-form" onSubmit={join}>
          <input
            aria-label="Código de la partida"
            placeholder="Código de tu pareja"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, ''))}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button className="btn btn-ghost" type="submit">Unirme</button>
        </form>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
