import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { normalizeCode } from '@/lib/api';
import { getRoom } from '@/lib/store';
import { canSeeMedia } from '@/lib/game';
import { loadCase } from '@/lib/cases';
import { portraitSvg, plateLabel } from '@/lib/cases/portrait.mjs';
import { getPhoto } from '@/lib/pedidos/store.mjs';

// Las imágenes viven fuera de /public para que no se puedan abrir antes de tiempo.
const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const HEADERS = { 'Cache-Control': 'private, max-age=86400' };

// Los casos generados no traen imágenes: los retratos se dibujan con el `look` de cada persona.
function drawnPortrait(c, file) {
  const suspect = c.suspects.find((s) => s.photo === file && s.look);
  if (suspect) return portraitSvg(suspect.look, { label: plateLabel(suspect.name) });
  if (c.victim?.look && c.victim.photo === file) return portraitSvg(c.victim.look, { style: 'retrato' });
  return null;
}

export async function GET(request, { params }) {
  const { code: rawCode, file } = await params;
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !/^[a-z0-9-]+\.[a-z]+$/i.test(file)) return new NextResponse(null, { status: 404 });

  const room = await getRoom(normalizeCode(rawCode));
  if (!room) return new NextResponse(null, { status: 404 });
  const c = await loadCase(room.state.caseId);
  if (!canSeeMedia(room.state, request.nextUrl.searchParams.get('player'), file)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await readFile(path.join(process.cwd(), 'media', c.id, file));
    return new NextResponse(body, { headers: { 'Content-Type': type, ...HEADERS } });
  } catch {
    // En un caso a pedido, las fotos que subió la persona tienen prioridad.
    const uploaded = c.pedido && (await getPhoto(c.pedido, file));
    if (uploaded) return new NextResponse(uploaded, { headers: { 'Content-Type': 'image/jpeg', ...HEADERS } });
    const svg = drawnPortrait(c, file);
    if (svg) return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', ...HEADERS } });
    return new NextResponse(null, { status: 404 });
  }
}
