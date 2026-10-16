import { handle } from '@/lib/api';
import { GameError } from '@/lib/store';
import { getPedido } from '@/lib/pedidos/store.mjs';
import { DURATIONS } from '@/lib/cases/shared.mjs';

// Lo que ve quien hizo el pedido: el estado y, cuando está listo, cómo jugarlo.
// Nunca el contenido del caso.
export async function GET(request, { params }) {
  return handle(async () => {
    const id = String((await params).id ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const p = id && (await getPedido(id));
    if (!p) throw new GameError('No encontramos ese pedido. Revisá el link.', 404);
    return {
      id: p.id,
      status: p.status,
      createdAt: p.created_at,
      tema: p.data.tema,
      duracion: DURATIONS[p.data.duracion ?? 'corto'].label,
      personajes: [p.data.victima.nombre, ...p.data.sospechosos.map((s) => s.nombre)],
      note: p.status === 'rechazado' ? p.note : null,
      case: p.status === 'listo' && p.case_data
        ? { id: p.case_id, title: p.case_data.title, teaser: p.case_data.teaser ?? '' }
        : null,
    };
  });
}
