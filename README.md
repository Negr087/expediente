# Expediente

Juego de detectives online para resolver en pareja. Uno es la Forense y el otro el Investigador, y cada rol tiene evidencia distinta. Para avanzar tienen que hablar y cruzar lo que tiene cada uno.

Hay dos modos, que se eligen al crear la partida:

- **Un celular:** los dos juegan con la misma pantalla. Cada documento tiene el color y el nombre del rol que lo lee, y un selector arriba del expediente muestra lo de la Forense o lo del Investigador. Se pasan el celular y cada uno lee lo suyo en voz alta.
- **Cada uno con su celular:** cada jugador ve solo la evidencia de su rol y tiene que contársela al otro.

En los dos modos, cada fase nueva abre un aviso con lo que le toca leer a cada uno, y el expediente arranca con un "Qué hacer ahora" que marca lo que ya leyeron.

Caso incluido: **#01 — Última partida en Las Toscas**.

## Probarlo en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 y creá una partida. Sin variables de entorno, las partidas se guardan en memoria del servidor, así que alcanza para probar.

Para jugar los dos roles desde una sola computadora, abrí la sala en una ventana normal y en una de incógnito: cada ventana es un jugador distinto. Para probar con el celular en tu misma red, usá `npm run dev -- -H 0.0.0.0` y entrá con la IP de tu compu.

## Producción (Vercel + Supabase)

1. En Supabase, abrí el SQL Editor y corré `supabase/schema.sql`.
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
components/
  StartForm.js                Crear partida / unirse con código
  Game.js                     Todas las pantallas del juego
lib/
  case/las-toscas.js          El caso: evidencias, sospechosos, respuestas (solo servidor)
  game.js                     Reglas, puntaje y lo que se le muestra a cada jugador
  store.js                    Guardado en Supabase o en memoria
media/
  las-toscas/                 Retratos, cámaras de seguridad y fotos de la escena
supabase/schema.sql
```

**Anti-trampa:** el archivo del caso tiene `import 'server-only'`, así que nunca llega al navegador. Las respuestas se validan en el servidor y cada evidencia se entrega solo al rol que corresponde y cuando se desbloquea su fase.

**Sincronización:** cada celular consulta el estado de la sala cada 2,5 segundos. Para dos jugadores alcanza y sobra; si más adelante hace falta, se puede cambiar por Supabase Realtime.

**Concurrencia:** cada escritura usa control por versión (`version` en la tabla), así dos acciones simultáneas no se pisan.

## Imágenes

Las imágenes de cada caso están en `media/<id del caso>/`, fuera de `public/`, y se sirven por `/api/rooms/[code]/media/[archivo]`. La API solo entrega una imagen si el jugador ya puede ver la evidencia que la usa: una foto de cámara de la fase 3 no se puede abrir en la fase 1, y en el modo de dos celulares la Forense no puede abrir las cámaras del Investigador.

Las que vienen ahora son ilustraciones SVG. Para cambiarlas por fotos reales (o generadas con IA), poné un `.jpg`, `.png` o `.webp` en la carpeta y cambiá el nombre en el caso:

- En la evidencia, un bloque `{ type: 'image', src: 'cam-pasillo.jpg', style: 'cctv' | 'polaroid' | 'doc', caption, text, alt }`.
- En los sospechosos, el campo `photo: 'ferran.jpg'`.

## Reglas de puntaje

Arrancan con 1.000 puntos.

| Concepto | Puntos |
| --- | --- |
| Pistas 1, 2 y 3 de una fase | −50, −100, −200 |
| Respuesta incorrecta para pasar de fase | −25 |
| Acusación incorrecta (hay 2 intentos) | −300 |
| Cada 10 minutos pasados los 60 | −20 |

## Agregar un caso nuevo

Copiá `lib/case/las-toscas.js` con la misma estructura (evidencias con `role`, `phase` y bloques de texto o de imagen, sospechosos con `photo`, sospechosos con preguntas atadas a una evidencia, `gates` para las fases 1 y 2, `accusation` y `solution`). Por ahora el juego importa un solo caso; para tener varios, falta guardar `caseId` al crear la sala y elegir el caso desde la landing.
# expediente
