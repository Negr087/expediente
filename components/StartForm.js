'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartForm() {
  const router = useRouter();
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
        body: JSON.stringify({ mode }),
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
