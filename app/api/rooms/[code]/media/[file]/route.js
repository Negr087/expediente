import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { normalizeCode } from '@/lib/api';
import { getRoom } from '@/lib/store';
import { canSeeMedia } from '@/lib/game';
import { CASE } from '@/lib/case/las-toscas';

// Las imágenes viven fuera de /public para que no se puedan abrir antes de tiempo.
const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export async function GET(request, { params }) {
  const { code: rawCode, file } = await params;
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !/^[a-z0-9-]+\.[a-z]+$/i.test(file)) return new NextResponse(null, { status: 404 });

  const room = await getRoom(normalizeCode(rawCode));
  if (!room || !canSeeMedia(room.state, request.nextUrl.searchParams.get('player'), file)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await readFile(path.join(process.cwd(), 'media', CASE.id, file));
    return new NextResponse(body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
