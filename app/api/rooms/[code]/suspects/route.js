import { handle, normalizeCode } from '@/lib/api';
import { getRoom, GameError } from '@/lib/store';
import { suspectsView } from '@/lib/game';

export async function GET(request, { params }) {
  return handle(async () => {
    const code = normalizeCode((await params).code);
    const room = await getRoom(code);
    if (!room) throw new GameError('No existe una partida con ese código.', 404);
    return { suspects: suspectsView(room.state, request.nextUrl.searchParams.get('player')) };
  });
}
