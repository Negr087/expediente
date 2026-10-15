# Expediente

Juego de detectives online para resolver en pareja. Cada jugador entra desde su celular, elige un rol (Forense o Investigador) y ve evidencia distinta. Para avanzar tienen que hablar y cruzar lo que tiene cada uno.

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
components/
  StartForm.js                Crear partida / unirse con código
  Game.js                     Todas las pantallas del juego
lib/
  case/las-toscas.js          El caso: evidencias, sospechosos, respuestas (solo servidor)
  game.js                     Reglas, puntaje y lo que se le muestra a cada jugador
  store.js                    Guardado en Supabase o en memoria
supabase/schema.sql
```

**Anti-trampa:** el archivo del caso tiene `import 'server-only'`, así que nunca llega al navegador. Las respuestas se validan en el servidor y cada evidencia se entrega solo al rol que corresponde y cuando se desbloquea su fase.

**Sincronización:** cada celular consulta el estado de la sala cada 2,5 segundos. Para dos jugadores alcanza y sobra; si más adelante hace falta, se puede cambiar por Supabase Realtime.

**Concurrencia:** cada escritura usa control por versión (`version` en la tabla), así dos acciones simultáneas no se pisan.

## Reglas de puntaje

Arrancan con 1.000 puntos.

| Concepto | Puntos |
| --- | --- |
| Pistas 1, 2 y 3 de una fase | −50, −100, −200 |
| Respuesta incorrecta para pasar de fase | −25 |
| Acusación incorrecta (hay 2 intentos) | −300 |
| Cada 10 minutos pasados los 60 | −20 |

## Agregar un caso nuevo

Copiá `lib/case/las-toscas.js` con la misma estructura (evidencias con `role` y `phase`, sospechosos con preguntas atadas a una evidencia, `gates` para las fases 1 y 2, `accusation` y `solution`). Por ahora el juego importa un solo caso; para tener varios, falta guardar `caseId` al crear la sala y elegir el caso desde la landing.
# expediente
