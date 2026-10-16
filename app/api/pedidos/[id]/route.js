import { handle } from '@/lib/api';
import { GameError } from '@/lib/store';
import { getPedido } from '@/lib/pedidos/store.mjs';
import { DURATIONS } from '@/lib/cases/shared.mjs';
import { revisarPago, facturaPublica } from '@/lib/pagos/cobro.mjs';
import { avisarPedido } from '@/lib/nostr/avisos.mjs';
import { after } from 'next/server';

// Lo que ve quien hizo el pedido: el estado y, cuando está listo, cómo jugarlo.
// Nunca el contenido del caso.
export async function GET(request, { params }) {
  return handle(async () => {
    const id = String((await params).id ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const found = id && (await getPedido(id));
    if (!found) throw new GameError('No encontramos ese pedido. Revisá el link.', 404);
    const { pedido: p, recienPagado } = await revisarPago(found);
    if (recienPagado) after(() => avisarPedido(p.id, p.data, p.data.origen));
    return {
      id: p.id,
      status: p.status,
      createdAt: p.created_at,
      tema: p.data.tema,
      duracion: DURATIONS[p.data.duracion ?? 'corto'].label,
      aviso: p.data.aviso?.tipo ?? 'ninguno',
      personajes: [p.data.victima.nombre, ...p.data.sospechosos.map((s) => s.nombre)],
      note: p.status === 'rechazado' ? p.note : null,
      pago: facturaPublica(p),
      case: p.status === 'listo' && p.case_data
        ? { id: p.case_id, title: p.case_data.title, teaser: p.case_data.teaser ?? '' }
        : null,
    };
  });
}
