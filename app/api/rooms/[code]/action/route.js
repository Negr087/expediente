import { handle, normalizeCode } from '@/lib/api';
import { updateRoom, GameError } from '@/lib/store';
import { join, answerGate, takeHint, ask, accuse, publicState } from '@/lib/game';

export async function POST(request, { params }) {
  return handle(async () => {
    const code = normalizeCode((await params).code);
    const body = await request.json().catch(() => ({}));
    const { player, type } = body;

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
