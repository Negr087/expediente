// Validación del formulario "Armá tu caso".

import { DURATIONS } from '../cases/shared.mjs';

export const TONOS = {
  clasico: 'Clásico, de misterio',
  humor: 'Con humor',
  oscuro: 'Más oscuro (sin gore)',
};

export class FormError extends Error {}

function text(value, max, label, { required = false } = {}) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (required && !s) throw new FormError(`Falta completar: ${label}.`);
  if (s.length > max) throw new FormError(`${label}: es muy largo (máximo ${max} caracteres).`);
  return s;
}

function age(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 && n < 120 ? n : null;
}

// `photos` es el conjunto de claves de foto que llegaron ('victima', '0', '1'…).
export function parsePedido(raw, photos) {
  const victima = {
    nombre: text(raw?.victima?.nombre, 60, 'el nombre de la víctima', { required: true }),
    edad: age(raw?.victima?.edad),
    descripcion: text(raw?.victima?.descripcion, 300, 'quién era la víctima'),
    foto: photos.has('victima') ? 'victima.jpg' : null,
  };

  const sospechosos = (Array.isArray(raw?.sospechosos) ? raw.sospechosos : [])
    .slice(0, 4)
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => String(s?.nombre ?? '').trim())
    .map(({ s, i }, n) => ({
      nombre: text(s.nombre, 60, `el nombre del sospechoso ${n + 1}`, { required: true }),
      edad: age(s.edad),
      relacion: text(s.relacion, 200, `la relación del sospechoso ${n + 1} con la víctima`),
      rasgos: text(s.rasgos, 200, `cómo es el sospechoso ${n + 1}`),
      foto: photos.has(String(i)) ? `sospechoso-${n + 1}.jpg` : null,
      _slot: String(i),
    }));
  if (sospechosos.length < 3) throw new FormError('Cargá al menos 3 sospechosos.');

  const names = [victima.nombre, ...sospechosos.map((s) => s.nombre)].map((n) => n.toLowerCase());
  if (new Set(names).size !== names.length) throw new FormError('Cada personaje tiene que tener un nombre distinto.');

  let culpable = 'sorpresa';
  if (raw?.culpable !== 'sorpresa') {
    const idx = Number.parseInt(raw?.culpable, 10);
    if (sospechosos.some((s) => s._slot === String(idx))) culpable = sospechosos.find((s) => s._slot === String(idx)).nombre;
  }

  const hasPhotos = victima.foto || sospechosos.some((s) => s.foto);
  if (hasPhotos && raw?.permisoFotos !== true) {
    throw new FormError('Para subir fotos tenés que confirmar que tenés permiso de esas personas.');
  }

  return {
    data: {
      contacto: text(raw?.contacto, 60, 'tu nombre'),
      tema: text(raw?.tema, 600, 'la temática', { required: true }),
      tono: TONOS[raw?.tono] ? raw.tono : 'clasico',
      duracion: DURATIONS[raw?.duracion] ? raw.duracion : 'corto',
      victima,
      sospechosos: sospechosos.map(({ _slot, ...s }) => s),
      culpable,
      extras: text(raw?.extras, 1000, 'los detalles extra'),
      permisoFotos: Boolean(hasPhotos),
    },
    // Qué archivo del formulario va con qué nombre guardado.
    photoMap: [
      ...(victima.foto ? [['victima', victima.foto]] : []),
      ...sospechosos.filter((s) => s.foto).map((s) => [s._slot, s.foto]),
    ],
  };
}

// Cómo avisarle a la persona cuando su caso esté listo.
// Nostr: npub1…, nprofile1… o un usuario NIP-05 (nombre@dominio.com), que se
// busca en el momento para guardar su clave pública.
export async function parseAviso(raw) {
  const tipo = raw?.tipo;
  const valor = String(raw?.valor ?? '').trim();
  if (tipo === 'email') {
    if (valor.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw new FormError('Revisá el email: no parece válido.');
    return { tipo: 'email', valor };
  }
  if (tipo === 'nostr') {
    if (!valor) throw new FormError('Escribí tu npub o tu usuario de Nostr.');
    const nip19 = await import('nostr-tools/nip19');
    if (/^(npub|nprofile)1/.test(valor)) {
      try {
        const d = nip19.decode(valor);
        const pubkey = d.type === 'npub' ? d.data : d.type === 'nprofile' ? d.data.pubkey : null;
        if (pubkey) return { tipo: 'nostr', valor, pubkey };
      } catch {}
      throw new FormError('Ese npub no es válido. Copialo de nuevo desde tu cliente de Nostr.');
    }
    const nip05 = await import('nostr-tools/nip05');
    if (nip05.isNip05(valor)) {
      const profile = await Promise.race([
        nip05.queryProfile(valor).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (profile?.pubkey) return { tipo: 'nostr', valor, pubkey: profile.pubkey };
      throw new FormError(`No encontramos el usuario de Nostr ${valor}. Probá con tu npub.`);
    }
    throw new FormError('Escribí tu npub (empieza con npub1) o tu usuario de Nostr (nombre@dominio.com).');
  }
  return { tipo: 'ninguno' };
}
