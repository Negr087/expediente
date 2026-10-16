import sharp from 'sharp';
import { NextResponse, after } from 'next/server';
import { insertPedido, putPhoto } from '@/lib/pedidos/store.mjs';
import { parsePedido, parseAviso, FormError } from '@/lib/pedidos/form.mjs';
import { avisarPedido } from '@/lib/nostr/avisos.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Las fotos se recortan a retrato y se vuelven a codificar: así se van los
// metadatos (por ejemplo la ubicación GPS) y quedan livianas.
async function cleanPhoto(file) {
  if (file.size > MAX_PHOTO_BYTES) throw new FormError('Una de las fotos es muy pesada (máximo 6 MB).');
  try {
    return await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(600, 720, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new FormError('Una de las fotos no se pudo leer. Probá con otra (JPG o PNG).');
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    if (form.get('web')) return NextResponse.json({ error: 'No se pudo enviar.' }, { status: 400 }); // campo trampa para bots

    const files = new Map();
    for (const slot of ['victima', '0', '1', '2', '3']) {
      const f = form.get(`foto-${slot}`);
      if (f && typeof f === 'object' && f.size > 0) files.set(slot, f);
    }
    let raw;
    try { raw = JSON.parse(form.get('datos') ?? '{}'); } catch { raw = {}; }
    const { data, photoMap } = parsePedido(raw, new Set(files.keys()));
    data.aviso = await parseAviso(raw.aviso);
    // Para armar el link del aviso cuando el caso esté listo.
    data.origen = new URL(request.url).origin;
    const cleaned = await Promise.all(photoMap.map(async ([slot, name]) => [name, await cleanPhoto(files.get(slot))]));

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomId();
      if (await insertPedido({ id, data })) {
        await Promise.all(cleaned.map(([name, buf]) => putPhoto(id, name, buf)));
        // El aviso sale después de responder: la persona no espera a los relays.
        after(() => avisarPedido(id, data, data.origen));
        return NextResponse.json({ id });
      }
    }
    throw new Error('No se pudo generar un id libre.');
  } catch (err) {
    if (err instanceof FormError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: 'Algo falló en el servidor. Probá de nuevo.' }, { status: 500 });
  }
}
