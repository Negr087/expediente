// Sortea la receta de un caso nuevo, evitando lo que ya usaron los casos de casos/.
//
//   npm run receta            receta nueva
//   npm run receta -- 42      siempre la misma receta para la semilla 42
//
// Imprime las instrucciones y el bloque "design" para pegar en el JSON del caso.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pickRecipe, recipeText, designOf } from '../lib/cases/variety.mjs';

const dir = path.join(process.cwd(), 'casos');
const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
const cases = (await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')))))
  .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

const seed = process.argv[2] ? Number.parseInt(process.argv[2], 10) : Date.now() % 1e9;
const recipe = pickRecipe(cases, seed);

console.log(recipeText(recipe));
console.log(`\nSemilla: ${seed}`);
console.log(`\nPegá esto en el caso como "design":\n${JSON.stringify(designOf(recipe), null, 2)}`);
