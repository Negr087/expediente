import StartForm from '@/components/StartForm';
import { listCases } from '@/lib/cases';
import DemoVideo from '@/components/DemoVideo';

export default async function Home() {
  const cases = await listCases();
  return (
    <main className="landing">
      <a className="brand" href="/">Expediente</a>

      <section className="hero">
        <div>
          <h1>Un misterio para resolver en pareja.</h1>
          <p className="hero-lead">
            Uno es la Forense y el otro el Investigador, y cada uno tiene pistas distintas. Ninguno puede
            resolverlo solo: van a tener que hablar, cruzar lo que tienen y acusar juntos. Jueguen con un
            celular o con uno cada uno.
          </p>
          <a className="demo-link" href="#demo">▶ Mirá cómo se juega (47 s)</a>
          <StartForm cases={cases} />
          <p className="custom-cta">
            ¿Querés un caso con tus amigos de personajes? <a href="/arma-tu-caso">Armá tu caso</a>
          </p>
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

      <section className="section demo" id="demo">
        <div>
          <h2>Mirá cómo se juega</h2>
          <p className="demo-text">
            Eligen un caso, se reparten los roles y cada uno lee su evidencia. Le muestran pruebas a los sospechosos,
            se cuentan lo que encontraron y responden juntos para abrir la fase siguiente. Al final, acusan.
          </p>
        </div>
        <DemoVideo />
      </section>

      <section className="section">
        <h2>Cómo se juega</h2>
        <ol className="steps">
          <li>
            <h3>Abran la partida</h3>
            <p>Con un solo celular se pasan la pantalla. Con dos, uno crea la sala y el otro entra con el código QR. No hace falta registrarse.</p>
          </li>
          <li>
            <h3>Elijan su rol</h3>
            <p>La Forense revisa el cuerpo y el laboratorio. El Investigador, las cámaras y los papeles.</p>
          </li>
          <li>
            <h3>Resuelvan juntos</h3>
            <p>Miren las cámaras, las fotos de la escena y las caras de los sospechosos. Respondan para abrir evidencia nueva y acusen al culpable. Entre 60 y 90 minutos.</p>
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
