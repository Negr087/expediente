import 'server-only';
import { NextResponse } from 'next/server';
import { GameError } from './store';

export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export async function handle(fn) {
  try {
    return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof GameError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: 'Algo falló en el servidor. Probá de nuevo.' }, { status: 500 });
  }
}
