import CaseRequestForm from '@/components/CaseRequestForm';
import { preciosSats } from '@/lib/pagos/lightning.mjs';

export const metadata = { title: 'Armá tu caso — Expediente' };
// Los precios salen del entorno: que un cambio no pida volver a compilar.
export const dynamic = 'force-dynamic';

export default function ArmaTuCaso() {
  return (
    <main className="game">
      <a className="brand" href="/" style={{ display: 'inline-block', marginTop: 20 }}>Expediente</a>
      <h1 className="screen-title">Armá tu caso</h1>
      <p className="screen-lead">
        Contanos dónde pasa y quiénes son los personajes: tus amigos, tu familia, quien quieras. Con eso escribimos
        un misterio a medida, con la víctima, los sospechosos y las pistas para la Forense y el Investigador.
      </p>
      <CaseRequestForm precios={preciosSats()} />
    </main>
  );
}
