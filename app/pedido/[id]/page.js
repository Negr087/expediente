import PedidoStatus from '@/components/PedidoStatus';

export const metadata = { title: 'Tu pedido — Expediente' };

export default async function Pedido({ params }) {
  const { id } = await params;
  return <PedidoStatus id={id.toUpperCase()} />;
}
