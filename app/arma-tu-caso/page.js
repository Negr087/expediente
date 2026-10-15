import CaseRequestForm from '@/components/CaseRequestForm';

export const metadata = { title: 'Armá tu caso — Expediente' };

export default function ArmaTuCaso() {
  return (
    <main className="game">
      <a className="brand" href="/" style={{ display: 'inline-block', marginTop: 20 }}>Expediente</a>
      <h1 className="screen-title">Armá tu caso</h1>
      <p className="screen-lead">
        Contanos dónde pasa y quiénes son los personajes: tus amigos, tu familia, quien quieras. Con eso escribimos
        un misterio a medida, con la víctima, los sospechosos y las pistas para la Forense y el Investigador.
      </p>
      <CaseRequestForm />
    </main>
  );
}
