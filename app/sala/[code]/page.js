import Game from '@/components/Game';

export const metadata = { title: 'Partida — Expediente' };

export default async function Sala({ params }) {
  const { code } = await params;
  return <Game code={code.toUpperCase()} />;
}
