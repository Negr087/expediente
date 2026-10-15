import { handle } from '@/lib/api';
import { insertRoom, GameError } from '@/lib/store';
import { newState } from '@/lib/game';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir

function randomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export async function POST(request) {
  return handle(async () => {
    const { mode } = await request.json().catch(() => ({}));
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = randomCode();
      if (await insertRoom(code, newState(mode))) return { code };
    }
    throw new GameError('No se pudo crear la partida. Probá de nuevo.', 500);
  });
}
