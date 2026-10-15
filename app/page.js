import StartForm from '@/components/StartForm';

export default function Home() {
  return (
    <main className="landing">
      <a className="brand" href="/">Expediente</a>

      <section className="hero">
        <div>
          <h1>Un asesinato para resolver en pareja.</h1>
          <p className="hero-lead">
            Cada uno abre el caso en su celular y ve pistas distintas. Ninguno puede resolverlo solo:
            van a tener que hablar, cruzar lo que tienen y acusar juntos.
          </p>
          <StartForm />
        </div>

        <div className="folder" aria-hidden="true">
          <div className="folder-tab">Caso N.º 01</div>
          <div className="folder-back" />
          <div className="folder-sheet">
            <p className="sheet-title">Última partida en Las Toscas</p>
            <p>Domingo, 08:10. Ernesto Valdés aparece muerto frente al tablero de ajedrez de su estudio.</p>
            <p>A su lado, una taza de té vacía.</p>
            <p>Cuatro personas estuvieron cerca de él esa noche.</p>
          </div>
          <div className="folder-front" />
          <span className="stamp">CASO ABIERTO</span>
        </div>
      </section>

      <section className="section">
        <h2>Cómo se juega</h2>
        <ol className="steps">
          <li>
            <h3>Abran la partida</h3>
            <p>Uno crea la sala y el otro entra escaneando el código QR desde su celular. No hace falta registrarse.</p>
          </li>
          <li>
            <h3>Elijan su rol</h3>
            <p>La Forense revisa el cuerpo y el laboratorio. El Investigador, las cámaras y los papeles.</p>
          </li>
          <li>
            <h3>Resuelvan juntos</h3>
            <p>Interroguen a los sospechosos, respondan para abrir evidencia nueva y acusen al culpable. Entre 60 y 90 minutos.</p>
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>Dos miradas sobre el mismo crimen</h2>
        <div className="roles-grid">
          <div className="role-card">
            <h3>La Forense</h3>
            <p>Autopsia, fotos de la escena, análisis de laboratorio y lo que dicen los remedios.</p>
          </div>
          <div className="role-card">
            <h3>El Investigador</h3>
            <p>Cámaras de seguridad, registros de entrada y salida, declaraciones y movimientos de plata.</p>
          </div>
        </div>
        <p className="footer-note">Próximamente: casos ambientados en el mundo Bitcoin.</p>
      </section>
    </main>
  );
}
