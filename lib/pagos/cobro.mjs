// Cobro de los pedidos de "Armá tu caso". Un pedido con precio queda
// "esperando_pago" (no aparece en la fila) hasta que se paga alguna de sus
// facturas; ahí pasa a "pendiente". Lo usan la API y scripts/pedidos.mjs.

import { crearFactura, facturaPagada } from './lightning.mjs';
import { getPedido, updatePedido } from '../pedidos/store.mjs';

const MAX_FACTURAS = 10;
const MARGEN_MS = 30_000; // una factura que vence en menos de esto ya no se muestra

export async function nuevaFactura(id, sats) {
  return crearFactura(sats, `Expediente, pedido ${id}`);
}

const vigente = (f) => new Date(f.vence).getTime() - Date.now() > MARGEN_MS;

// Mira si se pagó alguna factura del pedido y, si la última venció, pide otra.
// Devuelve { pedido, recienPagado } (recienPagado: se acaba de marcar pagado).
export async function revisarPago(p) {
  if (p.status !== 'esperando_pago' || !p.data.pago) return { pedido: p, recienPagado: false };
  const pago = p.data.pago;

  const results = await Promise.allSettled(pago.facturas.map((f) => facturaPagada(f.verify)));
  const i = results.findIndex((r) => r.status === 'fulfilled' && r.value);
  for (const r of results) if (r.status === 'rejected') console.error(`Pago del pedido ${p.id}: ${r.reason.message}`);

  if (i >= 0) {
    const data = { ...p.data, pago: { ...pago, pagado: new Date().toISOString(), factura: pago.facturas[i].pr, preimage: results[i].value } };
    const updated = await updatePedido(p.id, { status: 'pendiente', data }, 'esperando_pago');
    return { pedido: updated ?? (await getPedido(p.id)), recienPagado: Boolean(updated) };
  }

  const last = pago.facturas.at(-1);
  if (last && !vigente(last) && pago.facturas.length < MAX_FACTURAS) {
    try {
      const f = await nuevaFactura(p.id, pago.sats);
      const data = { ...p.data, pago: { ...pago, facturas: [...pago.facturas, f] } };
      return { pedido: (await updatePedido(p.id, { data }, 'esperando_pago')) ?? (await getPedido(p.id)), recienPagado: false };
    } catch (err) {
      console.error(`Factura nueva del pedido ${p.id}: ${err.message}`);
    }
  }
  return { pedido: p, recienPagado: false };
}

// Lo que ve la persona para pagar: la última factura, si sigue vigente.
export function facturaPublica(p) {
  const pago = p.data.pago;
  if (!pago) return null;
  const last = pago.facturas?.at(-1);
  return {
    sats: pago.sats,
    pagado: Boolean(pago.pagado),
    factura: p.status === 'esperando_pago' && last && vigente(last) ? { pr: last.pr, vence: last.vence } : null,
  };
}
