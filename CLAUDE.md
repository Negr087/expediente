# Expediente

Juego de detectives para dos (Forense e Investigador). Next.js 15 + Supabase. Todo el texto del juego está en español rioplatense. El README explica la arquitectura.

## Armar un caso a pedido ("Armá tu caso")

La gente llena el formulario en `/arma-tu-caso`. El pedido queda en Supabase (tabla `pedidos`, fotos en el bucket privado `pedidos`) y la persona sigue el estado en `/pedido/<ID>`. Para atender los pedidos:

1. `npm run pedidos` lista los pendientes. Atendé del más viejo al más nuevo. Los que esperan el pago en sats no aparecen hasta que se pagan (`npm run pedidos -- todos` los muestra); no los atiendas antes.
2. `npm run pedidos -- ver <ID>` muestra el pedido completo.
3. `npm run pedidos -- tomar <ID>` lo marca "en preparación" (la persona lo ve).
4. Si el pedido es ofensivo, apunta a lastimar a alguien o no se puede convertir en un caso apto para todo público: `npm run pedidos -- rechazar <ID> "motivo corto y amable"` y listo. Si estaba pago, el script lo avisa: decíselo al dueño del juego, que tiene que devolver los sats.
5. Sorteá la receta con `npm run receta -- <duración>` (la del pedido: `corto`, `medio` o `largo`; está en `ver`) y seguila. Lo que fije el pedido (culpable, tono, lugar, época) tiene prioridad sobre la receta. Guardá en el caso el bloque `design` que imprime.
6. Escribí el caso en un archivo **fuera del repo** (por ejemplo `/tmp/caso-<ID>.json`):
   - Formato: el mismo de `casos/robo-en-laguna-escondida.json`. Usalo solo como referencia de formato: la trama, el culpable y el tipo de pistas salen de la receta. No hace falta `id`, `number` ni `published`: los pone la entrega.
   - Reglas: `GAME_INTRO`, `DESIGN_RULES` y `REQUEST_RULES` de `lib/cases/rules.mjs`. Cumplilas todas.
   - Personas: cada una con `look` (rasgos, opciones en `LOOK_OPTIONS` de `lib/cases/portrait.mjs`). Si en el pedido tiene foto, poné `"photo": "<archivo de la foto>"` (por ejemplo `sospechoso-2.jpg`); si no, `"photo": "<id>.svg"` y la API dibuja el retrato. La víctima va en `victim` y su imagen como primer bloque del `briefing`, igual que en el ejemplo.
   - Para que el `look` coincida con una foto, la podés bajar y mirar: `npm run pedidos -- foto <ID> <archivo> /tmp/<archivo>`.
   - Solo usá imágenes en los bloques si existen; en un caso a pedido, lo normal es no poner imágenes en la evidencia.
7. Revisalo como jugador antes de entregar: una sola línea de tiempo coherente, cada pregunta necesita evidencia de los dos roles, cada inocente se descarta con evidencia concreta.
8. `npm run pedidos -- entregar <ID> /tmp/caso-<ID>.json` valida y entrega. Si marca problemas, corregí y volvé a entregar.
9. Al entregar o rechazar, si la persona dejó su Nostr se le manda el aviso solo. Si dejó un email, el script imprime el mensaje para que el dueño del juego se lo mande: pasáselo tal cual. Para reintentar un aviso de Nostr: `npm run pedidos -- avisar <ID>`.

Nunca agregues al repo los casos a pedido ni las fotos: son privados.

## Casos del catálogo

Los casos públicos son `casos/<id>.json` (con `"published": true`) y sus imágenes van en `media/<id>/`. Para uno nuevo, empezá siempre con `npm run receta` (o `npm run receta -- medio`, `-- largo`): sortea el diseño (duración y estructura, qué pasó, giro, culpable, motivo, preguntas de fase, mecánicas de pistas, documentos, tono, época, voces de los sospechosos) evitando lo que ya usaron los casos anteriores, y guardá su `design` en el JSON. Así los casos no se parecen entre sí. Para validar uno: `node --input-type=module -e "import fs from 'node:fs'; import { validateCase } from './lib/cases/shared.mjs'; console.log(validateCase(JSON.parse(fs.readFileSync('casos/<id>.json','utf8'))))"`.
