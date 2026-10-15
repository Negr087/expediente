import { handle, normalizeCode } from '@/lib/api';
import { getRoom, updateRoom, GameError } from '@/lib/store';
import { loadCase } from '@/lib/cases';
import { join, answerGate, takeHint, ask, accuse, publicState } from '@/lib/game';

export async function POST(request, { params }) {
  return handle(async () => {
    const code = normalizeCode((await params).code);
    const body = await request.json().catch(() => ({}));
    const { player, type } = body;

    // El caso no cambia durante la partida: se carga una vez antes de aplicar la acción.
    const room = await getRoom(code);
    if (!room) throw new GameError('No existe una partida con ese código.', 404);
    await loadCase(room.state.caseId);

    const state = await updateRoom(code, (s) => {
      switch (type) {
        case 'join': return join(s, player, body.role);
        case 'answer': return answerGate(s, player, body.option);
        case 'hint': return takeHint(s, player);
        case 'ask': return ask(s, player, body.question);
        case 'accuse': return accuse(s, player, body.answers);
        default: throw new GameError('Acción desconocida.');
      }
    });
    return publicState(code, state, player);
  });
}
