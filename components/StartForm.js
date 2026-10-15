'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
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
      <div className="start">
        <button className="btn" onClick={create} disabled={busy}>
          {busy ? 'Creando…' : 'Crear partida'}
        </button>
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
