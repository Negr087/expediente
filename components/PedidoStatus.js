'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

const POLL_MS = 20000;
const POLL_PAGO_MS = 4000;
const STEPS = [
  ['esperando_pago', 'Pago', 'Falta pagar para que entre a la fila.'],
  ['pendiente', 'Recibido', 'Tu pedido está en la fila.'],
  ['en_preparacion', 'En preparación', 'Estamos escribiendo el caso.'],
  ['listo', 'Listo', 'Ya lo pueden jugar.'],
];

export default function PedidoStatus({ id }) {
  const router = useRouter();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(false);

  const esperandoPago = pedido?.status === 'esperando_pago';

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`/api/pedidos/${id}`, { cache: 'no-store' });
        const data = await res.json();
        if (stop) return;
        if (!res.ok) setError(data.error);
        else setPedido(data);
      } catch {}
    }
    load();
    const t = setInterval(load, esperandoPago ? POLL_PAGO_MS : POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [id, esperandoPago]);

  async function play(mode) {
    setBusy(mode);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, caseId: pedido.case.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/sala/${data.code}`);
    } catch (err) {
      setError(err.message || 'No se pudo crear la partida.');
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (error && !pedido) {
    return (
      <main className="center-msg">
        <h1>Pedido no encontrado</h1>
        <p>{error}</p>
        <a className="btn" href="/arma-tu-caso">Hacer un pedido</a>
      </main>
    );
  }
  if (!pedido) return <main className="center-msg"><p>Buscando tu pedido…</p></main>;

  // Los pedidos gratis no muestran el paso del pago.
  const steps = pedido.pago ? STEPS : STEPS.slice(1);
  const current = steps.findIndex(([s]) => s === pedido.status);

  return (
    <main className="game">
      <a className="brand" href="/" style={{ display: 'inline-block', marginTop: 20 }}>Expediente</a>
      <p className="kicker" style={{ marginTop: 24 }}>Pedido {pedido.id}</p>
      <h1 className="screen-title" style={{ marginTop: 4 }}>
        {pedido.status === 'listo' ? pedido.case.title
          : pedido.status === 'rechazado' ? 'No pudimos armar este caso'
          : esperandoPago ? 'Falta el pago' : 'Tu caso está en camino'}
      </h1>

      {pedido.status === 'rechazado' ? (
        <>
          <p className="screen-lead">{pedido.note || 'El pedido no cumple con las reglas del juego.'}</p>
          {pedido.pago?.pagado && (
            <p className="screen-lead">
              Te devolvemos los {pedido.pago.sats.toLocaleString('es-AR')} sats.
              {pedido.aviso === 'ninguno' ? ' Escribinos con el número de pedido y una factura por ese monto.' : ' Te escribimos para coordinarlo.'}
            </p>
          )}
        </>
      ) : (
        <ol className="pedido-steps">
          {steps.map(([s, label, desc], i) => (
            <li key={s} className={i < current ? 'done' : i === current ? 'now' : undefined}>
              <strong>{label}</strong>
              {i === current && <span>{desc}</span>}
            </li>
          ))}
        </ol>
      )}

      {esperandoPago ? (
        <Pago pago={pedido.pago} />
      ) : pedido.status === 'listo' ? (
        <div className="panel">
          {pedido.case.teaser && <p style={{ marginTop: 0 }}>{pedido.case.teaser}</p>}
          <div className="start-modes" style={{ marginBottom: 0 }}>
            <button className="mode-btn" onClick={() => play('solo')} disabled={Boolean(busy)}>
              <strong>{busy === 'solo' ? 'Creando…' : 'Jugar en un celular'}</strong>
              <span>Los dos con la misma pantalla.</span>
            </button>
            <button className="mode-btn" style={{ background: 'var(--tinta)', color: 'var(--hoja)' }} onClick={() => play('duo')} disabled={Boolean(busy)}>
              <strong>{busy === 'duo' ? 'Creando…' : 'Cada uno con su celular'}</strong>
              <span style={{ color: 'var(--hoja-2)' }}>Evidencia secreta para cada rol.</span>
            </button>
          </div>
        </div>
      ) : pedido.status !== 'rechazado' && (
        <p className="screen-lead">
          {pedido.aviso === 'nostr' ? 'Te vamos a avisar por Nostr cuando esté listo. ' : pedido.aviso === 'email' ? 'Te vamos a avisar por email cuando esté listo. ' : ''}
          Guardá este link: cuando el caso esté listo, lo juegan desde acá. Esta página se actualiza sola.
        </p>
      )}

      <div className="pedido-summary">
        <p><span>Historia</span>{pedido.tema}</p>
        <p><span>Duración</span>{pedido.duracion}</p>
        <p><span>Personajes</span>{pedido.personajes.join(', ')}</p>
      </div>
      <button className="btn btn-ghost" onClick={copy}>{copied ? 'Link copiado' : 'Copiar el link de este pedido'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  );
}

function Pago({ pago }) {
  const pr = pago.factura?.pr;
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setQr(null);
    if (pr) QRCode.toDataURL(`lightning:${pr}`.toUpperCase(), { margin: 1, width: 320, color: { dark: '#1f1d1a', light: '#ece7da' } }).then(setQr);
  }, [pr]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="panel pago">
      <p className="pago-monto">{pago.sats.toLocaleString('es-AR')} sats</p>
      {pr ? (
        <>
          <a href={`lightning:${pr}`} aria-label="Abrir la factura en tu billetera">
            {qr ? <img src={qr} alt="Código QR de la factura Lightning" /> : <div className="pago-qr-vacio" />}
          </a>
          <div className="start-modes" style={{ marginBottom: 0 }}>
            <a className="btn btn-block" href={`lightning:${pr}`}>Abrir en mi billetera</a>
            <button className="btn btn-ink btn-block" onClick={copy}>{copied ? 'Factura copiada' : 'Copiar la factura'}</button>
          </div>
          <p className="form-help">Escaneala con cualquier billetera Lightning. Cuando entra el pago, esta página se actualiza sola.</p>
        </>
      ) : (
        <p>Estamos generando una factura nueva. Esperá unos segundos.</p>
      )}
    </div>
  );
}
