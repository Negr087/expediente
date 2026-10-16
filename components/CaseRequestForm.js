'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TONOS = [
  ['clasico', 'Clásico, de misterio'],
  ['humor', 'Con humor'],
  ['oscuro', 'Más oscuro (sin gore)'],
];

const DURACIONES = [
  ['corto', 'Corto, unos 20 minutos'],
  ['medio', 'Medio, unos 40 minutos'],
  ['largo', 'Largo, alrededor de una hora'],
];

const emptyPerson = () => ({ nombre: '', edad: '', relacion: '', rasgos: '' });

// Achica la foto en el celular antes de subirla: el envío queda liviano.
async function shrink(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

function rememberPedido(id) {
  try {
    const list = JSON.parse(localStorage.getItem('expediente-pedidos') ?? '[]');
    localStorage.setItem('expediente-pedidos', JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 10)));
  } catch {}
}

function PhotoInput({ label, photo, onChange }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  return (
    <div className="photo-input">
      {preview ? <img src={preview} alt="" /> : <div className="photo-empty" aria-hidden="true">Sin foto</div>}
      <div>
        <label className="btn btn-ghost photo-btn">
          {photo ? 'Cambiar foto' : 'Subir foto (opcional)'}
          <input
            type="file"
            accept="image/*"
            aria-label={label}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onChange(await shrink(f).catch(() => f));
            }}
          />
        </label>
        {photo && <button type="button" className="link" onClick={() => onChange(null)}>Quitar</button>}
      </div>
    </div>
  );
}

export default function CaseRequestForm() {
  const router = useRouter();
  const [contacto, setContacto] = useState('');
  const [tema, setTema] = useState('');
  const [tono, setTono] = useState('clasico');
  const [duracion, setDuracion] = useState('corto');
  const [victima, setVictima] = useState({ nombre: '', edad: '', descripcion: '' });
  const [sospechosos, setSospechosos] = useState(() => [emptyPerson(), emptyPerson(), emptyPerson(), emptyPerson()]);
  const [culpable, setCulpable] = useState('sorpresa');
  const [extras, setExtras] = useState('');
  const [fotos, setFotos] = useState({});
  const [permiso, setPermiso] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previous, setPrevious] = useState([]);

  useEffect(() => {
    try { setPrevious(JSON.parse(localStorage.getItem('expediente-pedidos') ?? '[]')); } catch {}
  }, []);

  const hasPhotos = Object.values(fotos).some(Boolean);
  const setSuspect = (i, patch) => setSospechosos((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setFoto = (slot, f) => setFotos((all) => ({ ...all, [slot]: f }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (hasPhotos && !permiso) {
      setError('Para subir fotos, confirmá que tenés permiso de esas personas.');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('datos', JSON.stringify({ contacto, tema, tono, duracion, victima, sospechosos, culpable, extras, permisoFotos: permiso }));
      body.set('web', e.target.elements.web.value);
      for (const [slot, f] of Object.entries(fotos)) if (f) body.set(`foto-${slot}`, f, `${slot}.jpg`);
      const res = await fetch('/api/pedidos', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar. Probá de nuevo.');
      rememberPedido(data.id);
      router.push(`/pedido/${data.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const named = sospechosos.map((s, i) => [i, s.nombre.trim()]).filter(([, n]) => n);

  return (
    <form className="request-form" onSubmit={submit}>
      {previous.length > 0 && (
        <p className="previous">
          Tus pedidos anteriores:{' '}
          {previous.map((id, i) => (
            <span key={id}>{i > 0 && ', '}<a href={`/pedido/${id}`}>{id}</a></span>
          ))}
        </p>
      )}

      <fieldset className="form-block">
        <legend>La historia</legend>
        <label className="field">
          <span>¿Dónde y cuándo pasa?</span>
          <textarea
            required
            maxLength={600}
            rows={3}
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Ej.: el cumpleaños de 40 de Caro en una quinta de Pilar, un sábado de lluvia."
          />
        </label>
        <fieldset className="duration-pick">
          <legend>¿Cuánto querés que dure?</legend>
          {DURACIONES.map(([id, label]) => (
            <label key={id} className="duration-option">
              <input type="radio" name="duracion" value={id} checked={duracion === id} onChange={() => setDuracion(id)} />
              <span>{label}</span>
            </label>
          ))}
          <p className="form-help">Los más largos tienen más fases, más evidencia, más sospechosos y alguna historia secundaria.</p>
        </fieldset>
        <label className="field">
          <span>Tono</span>
          <select value={tono} onChange={(e) => setTono(e.target.value)}>
            {TONOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="form-block">
        <legend>La víctima</legend>
        <div className="field-row">
          <label className="field grow">
            <span>Nombre</span>
            <input required maxLength={60} value={victima.nombre} onChange={(e) => setVictima({ ...victima, nombre: e.target.value })} />
          </label>
          <label className="field age">
            <span>Edad</span>
            <input inputMode="numeric" maxLength={3} value={victima.edad} onChange={(e) => setVictima({ ...victima, edad: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
        <label className="field">
          <span>¿Quién era? (opcional)</span>
          <input maxLength={300} value={victima.descripcion} onChange={(e) => setVictima({ ...victima, descripcion: e.target.value })} placeholder="Ej.: el dueño de la quinta, fanático del truco." />
        </label>
        <PhotoInput label="Foto de la víctima" photo={fotos.victima} onChange={(f) => setFoto('victima', f)} />
      </fieldset>

      <fieldset className="form-block">
        <legend>Los sospechosos</legend>
        <p className="form-help">Entre 3 y 4. Uno de ellos va a ser el culpable.</p>
        {sospechosos.map((s, i) => (
          <div key={i} className="suspect-input">
            <p className="suspect-input-title">Sospechoso {i + 1}{i === 3 ? ' (opcional)' : ''}</p>
            <div className="field-row">
              <label className="field grow">
                <span>Nombre</span>
                <input required={i < 3} maxLength={60} value={s.nombre} onChange={(e) => setSuspect(i, { nombre: e.target.value })} />
              </label>
              <label className="field age">
                <span>Edad</span>
                <input inputMode="numeric" maxLength={3} value={s.edad} onChange={(e) => setSuspect(i, { edad: e.target.value.replace(/\D/g, '') })} />
              </label>
            </div>
            <label className="field">
              <span>¿Qué relación tiene con la víctima?</span>
              <input maxLength={200} value={s.relacion} onChange={(e) => setSuspect(i, { relacion: e.target.value })} placeholder="Ej.: su socio, le debe plata." />
            </label>
            <label className="field">
              <span>¿Cómo es? (opcional)</span>
              <input maxLength={200} value={s.rasgos} onChange={(e) => setSuspect(i, { rasgos: e.target.value })} placeholder="Ej.: pelo largo, anteojos, siempre con campera de cuero." />
            </label>
            <PhotoInput label={`Foto del sospechoso ${i + 1}`} photo={fotos[i]} onChange={(f) => setFoto(String(i), f)} />
          </div>
        ))}
        <label className="field">
          <span>¿Quién es el culpable?</span>
          <select value={culpable} onChange={(e) => setCulpable(e.target.value)}>
            <option value="sorpresa">Que sea sorpresa</option>
            {named.map(([i, n]) => <option key={i} value={String(i)}>{n}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="form-block">
        <legend>Detalles</legend>
        <label className="field">
          <span>Chistes internos, lugares, mascotas, lo que quieras que aparezca (opcional)</span>
          <textarea maxLength={1000} rows={3} value={extras} onChange={(e) => setExtras(e.target.value)} />
        </label>
        <label className="field">
          <span>Tu nombre o apodo (opcional)</span>
          <input maxLength={60} value={contacto} onChange={(e) => setContacto(e.target.value)} />
        </label>
      </fieldset>

      {hasPhotos && (
        <label className="consent">
          <input type="checkbox" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} />
          <span>Tengo permiso de las personas de las fotos para usarlas en este juego. Las fotos solo se ven en este caso.</span>
        </label>
      )}

      {/* Campo trampa: las personas no lo ven, los bots lo completan. */}
      <input name="web" tabIndex={-1} autoComplete="off" className="trap" aria-hidden="true" />

      <button className="btn btn-block" disabled={busy}>{busy ? 'Enviando…' : 'Pedir mi caso'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="form-help">El caso es privado: solo se juega con el link que te damos al enviar.</p>
    </form>
  );
}
