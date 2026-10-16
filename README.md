# Expediente

Juego de detectives online para resolver en pareja. Uno es la Forense y el otro el Investigador, y cada rol tiene evidencia distinta. Para avanzar tienen que hablar y cruzar lo que tiene cada uno.

Hay dos modos, que se eligen al crear la partida:

- **Un celular:** los dos juegan con la misma pantalla. Cada documento tiene el color y el nombre del rol que lo lee, y un selector arriba del expediente muestra lo de la Forense o lo del Investigador. Se pasan el celular y cada uno lee lo suyo en voz alta.
- **Cada uno con su celular:** cada jugador ve solo la evidencia de su rol y tiene que contársela al otro.

En los dos modos, cada fase nueva abre un aviso con lo que le toca leer a cada uno, y el expediente arranca con un "Qué hacer ahora" que marca lo que ya leyeron.

Caso incluido: **#01 — Última partida en Las Toscas**. Se pueden sumar más a mano o generarlos con Claude (ver abajo).

## Probarlo en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 y creá una partida. Sin variables de entorno, las partidas se guardan en memoria del servidor, así que alcanza para probar.

Para jugar los dos roles desde una sola computadora, abrí la sala en una ventana normal y en una de incógnito: cada ventana es un jugador distinto. Para probar con el celular en tu misma red, usá `npm run dev -- -H 0.0.0.0` y entrá con la IP de tu compu.

## Producción (Vercel + Supabase)

1. En Supabase, abrí el SQL Editor y corré `supabase/schema.sql` (crea las tablas `rooms` y `pedidos` y el bucket privado `pedidos` para las fotos). Se puede volver a correr sin romper nada.
2. En Vercel, cargá estas variables de entorno (Settings → API en Supabase):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy.

La clave de service role solo se usa en el servidor. La tabla `rooms` tiene RLS activado y sin políticas públicas: el navegador nunca toca la base directo, todo pasa por la API.

## Cómo está armado

```
app/
  page.js                     Landing
  sala/[code]/page.js         Partida
  api/rooms/                  Crear partida
  api/rooms/[code]/           Estado público de la sala
  api/rooms/[code]/action     Unirse, responder, pedir pista, interrogar, acusar
  api/rooms/[code]/evidence   Evidencia del rol del jugador, según la fase
  api/rooms/[code]/suspects   Sospechosos y preguntas desbloqueadas
  api/rooms/[code]/media      Imágenes del caso, con las mismas reglas que la evidencia
  arma-tu-caso/               Formulario para pedir un caso a medida
  pedido/[id]/                Estado del pedido y botón para jugarlo
  api/pedidos/                Recibe el formulario y las fotos
components/
  StartForm.js                Crear partida / unirse con código
  Game.js                     Todas las pantallas del juego
lib/
  cases/index.js              Carga los casos de casos/ (solo servidor)
  cases/shared.mjs            Roles y validación de un caso
  cases/portrait.mjs          Retratos dibujados a partir de rasgos
  game.js                     Reglas, puntaje y lo que se le muestra a cada jugador
  store.js                    Guardado en Supabase o en memoria
  pedidos/                    Pedidos de "Armá tu caso" (Supabase o .datos-locales/)
casos/
  las-toscas.json             Cada caso es un JSON: evidencias, sospechosos, respuestas
scripts/
  generar-caso.mjs            Genera un caso nuevo con Claude
  pedidos.mjs                 Atiende los pedidos de "Armá tu caso"
CLAUDE.md                     Paso a paso para que Claude Code arme los casos a pedido
media/
  las-toscas/                 Retratos, cámaras de seguridad y fotos de la escena
supabase/schema.sql
```

**Anti-trampa:** los casos se leen del disco solo en el servidor (`lib/cases/index.js` tiene `import 'server-only'`), así que nunca llegan al navegador. Las respuestas se validan en el servidor y cada evidencia se entrega solo al rol que corresponde y cuando se desbloquea su fase.

**Sincronización:** cada celular consulta el estado de la sala cada 2,5 segundos. Para dos jugadores alcanza y sobra; si más adelante hace falta, se puede cambiar por Supabase Realtime.

**Concurrencia:** cada escritura usa control por versión (`version` en la tabla), así dos acciones simultáneas no se pisan.

## Imágenes

Las imágenes de cada caso están en `media/<id del caso>/`, fuera de `public/`, y se sirven por `/api/rooms/[code]/media/[archivo]`. La API solo entrega una imagen si el jugador ya puede ver la evidencia que la usa: una foto de cámara de la fase 3 no se puede abrir en la fase 1, y en el modo de dos celulares la Forense no puede abrir las cámaras del Investigador.

Las que vienen ahora son ilustraciones SVG. Para cambiarlas por fotos reales (o generadas con IA), poné un `.jpg`, `.png` o `.webp` en la carpeta y cambiá el nombre en el caso:

- En la evidencia, un bloque `{ type: 'image', src: 'cam-pasillo.jpg', style: 'cctv' | 'polaroid' | 'doc', caption, text, alt }`.
- En los sospechosos, el campo `photo: 'ferran.jpg'`.

## Armá tu caso

En `/arma-tu-caso` cualquiera pide un caso a medida: cuánto dura (20, 40 o 60 minutos), dónde pasa, la víctima, de 3 a 4 sospechosos con su relación, fotos opcionales, quién es el culpable (o sorpresa) y detalles extra. Recibe un link `/pedido/<ID>` donde ve el estado (pago, recibido, en preparación, listo) y, cuando está listo, lo juega desde ahí.

- **Pago en sats:** con `LIGHTNING_ADDRESS` cargada, cada pedido se cobra según la duración (`SATS_CORTO`, `SATS_MEDIO`, `SATS_LARGO`; por defecto 2.100, 4.200 y 6.300). La página del pedido muestra una factura Lightning con QR, y el pedido queda "esperando pago" (fuera de la fila) hasta que se paga. Recién ahí te llega el aviso por Nostr. El servidor pide la factura a tu Lightning Address por LNURL y confirma el pago con la URL `verify` (LUD-21), así que no hace falta nodo propio y nadie tiene acceso a tu billetera. Si la factura vence se genera otra sola. `npm run pedidos` también revisa los pagos, por si alguien pagó y cerró la página. Si rechazás un pedido pago, el aviso le pide a la persona una factura para devolverle los sats. Sin `LIGHTNING_ADDRESS`, los pedidos son gratis.

- **Aviso:** la persona elige cómo enterarse de que su caso está listo: por Nostr (npub o usuario `nombre@dominio`), por email o guardándose el link. Por Nostr, el aviso sale solo al entregar o rechazar el pedido, desde la identidad del juego; por email, el script te imprime el mensaje para mandarlo. El contacto queda solo en el pedido: no se muestra en la página pública.
- **Privado:** el caso no aparece en el inicio. Solo se juega con el link del pedido.
- **Fotos:** se achican en el celular, el servidor las recorta y les borra los metadatos (por ejemplo la ubicación GPS) y quedan en un bucket privado de Supabase. Solo se ven dentro de ese caso. Para subirlas hay que confirmar que se tiene permiso de esas personas. Sin foto, se usa el retrato dibujado.
- **Quién lo arma:** por ahora, Claude Code siguiendo `CLAUDE.md` (desde la notebook, desde claude.ai/code o con una tarea programada en la nube). Más adelante, con saldo en la API, se puede llamar al generador automáticamente al recibir el pedido.

```bash
npm run pedidos                          # pendientes
npm run pedidos -- ver <ID>
npm run pedidos -- tomar <ID>
npm run pedidos -- entregar <ID> caso.json
npm run pedidos -- rechazar <ID> "motivo"
npm run pedidos -- pagado <ID>           # lo pasa a la fila si te pagaron por otro lado
npm run pedidos -- avisar <ID>           # reintenta el aviso por Nostr
```

Sin variables de Supabase, los pedidos y las fotos se guardan en `.datos-locales/` (ignorada por git), para probar en local.

### Aviso por Nostr

Cuando entra un pedido, el juego te manda un mensaje directo cifrado por Nostr con el ID, el comienzo de la temática y el link.

1. `npm run nostr-clave` crea la identidad del juego. Copiá el `NOSTR_NSEC` que imprime.
2. En `.env` y en Vercel (Settings → Environment Variables) cargá `NOSTR_NSEC` y `NOSTR_AVISOS_NPUB` (tu npub).
3. `npm run pedidos -- aviso` manda un mensaje de prueba.

Por defecto usa mensajes privados NIP-17 (Amethyst, 0xchat, Coracle…). Si tu cliente no los muestra, agregá `NOSTR_DM=nip04`. Los relays se pueden cambiar con `NOSTR_RELAYS` (separados por coma). Sin estas variables no se manda nada.

## Reglas de puntaje

Arrancan con 1.000 puntos.

| Concepto | Puntos |
| --- | --- |
| Pistas 1, 2 y 3 de una fase | −50, −100, −200 |
| Respuesta incorrecta para pasar de fase | −25 |
| Acusación incorrecta (hay 2 intentos) | −300 |
| Cada 10 minutos pasado el doble de la duración del caso (40 min en un caso de 20) | −20 |

## Agregar un caso nuevo

Cada caso es un archivo en `casos/<id>.json` y sus imágenes van en `media/<id>/`. Al crear la partida se elige el caso, y cada sala guarda cuál usa.

Un caso con `"published": false` es un **borrador**: aparece en local (`npm run dev`, marcado como Borrador) pero no en producción. Para publicarlo, cambiá a `"published": true` y hacé deploy.

### A mano

Copiá `casos/las-toscas.json` y cambiá el contenido. La estructura: evidencias con `role`, `phase` y bloques (`p`, `note`, `kv`, `log`, `quote`, `chat`, `letter`, `image`), sospechosos con preguntas atadas a una evidencia, `gates` para las fases 1 y 2, `accusation` (`who`, `how`, `why`) y `solution`.

### Recetas: que cada caso se juegue distinto

`npm run receta` sortea el diseño de un caso nuevo entre muchas opciones (en `lib/cases/variety.mjs`):

- **Duración:** corto (~20 min, 3 fases), medio (~40 min, 4 fases, una historia secundaria) o largo (~60 min, 5 fases, dos historias secundarias y doble giro). `npm run receta -- medio`.
- **Qué pasó:** asesinato, envenenamiento lento, desaparición, robo imposible, accidente encubierto, sabotaje o estafa.
- **Giro:** la hora es falsa, la víctima equivocada, dos culpables, el que encontró el cuerpo, el testigo clave…
- **Quién es el culpable:** el más querible, el que ayuda a investigar, el más joven, el de afuera…
- **Motivo, preguntas de fase, mecánicas de pistas, documentos, tono, época, lugar y la voz de cada sospechoso.**

Lo que usaron los últimos casos queda excluido, y cada caso guarda su receta en `design`. El generador por API la usa sola; a mano, se escribe el caso siguiendo la receta.

### Con Claude

1. Sacá una API key en https://platform.claude.com/settings/keys y agregala a `.env` como `ANTHROPIC_API_KEY`.
2. Corré:

   ```bash
   npm run generar-caso                                   # Claude elige el escenario
   npm run generar-caso -- "una bodega en Mendoza durante la vendimia"
   ```

El script le pide el caso a Claude Opus 5.5 usando Las Toscas como ejemplo de formato y calidad, y después lo revisa:

- **Estructura:** que cada pregunta apunte a una evidencia que existe, que cada fase tenga evidencia para los dos roles, que las respuestas correctas estén entre las opciones, etc.
- **Que se pueda resolver:** otro llamado a Claude juega el caso solo con la evidencia. Si responde algo distinto de la solución, o si con la evidencia de un solo rol ya alcanza para saber quién fue, le pide a Claude que lo corrija (hasta 2 veces).

Al final guarda el borrador en `casos/` y muestra el costo aproximado (alrededor de US$1 por caso). Los sospechosos y la víctima traen rasgos (`look`) y la API dibuja sus retratos; no hace falta subir imágenes.

Jugalo entero antes de publicarlo: la revisión automática ayuda, pero no reemplaza a una persona.
# expediente
