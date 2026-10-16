// Sortea la receta de un caso nuevo, evitando lo que ya usaron los casos de casos/.
//
//   npm run receta                receta nueva de un caso corto (~20 min)
//   npm run receta -- medio       corto, medio (~40 min) o largo (~60 min)
//   npm run receta -- largo 42    siempre la misma receta para la semilla 42
//
// Imprime las instrucciones y el bloque "design" para pegar en el JSON del caso.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pickRecipe, recipeText, designOf } from '../lib/cases/variety.mjs';

const dir = path.join(process.cwd(), 'casos');
const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
const cases = (await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')))))
  .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

const args = process.argv.slice(2);
const duracion = args.find((a) => ['corto', 'medio', 'largo'].includes(a)) ?? 'corto';
const seedArg = args.find((a) => /^\d+$/.test(a));
const seed = seedArg ? Number.parseInt(seedArg, 10) : Date.now() % 1e9;
const recipe = pickRecipe(cases, seed, { duracion });

console.log(recipeText(recipe));
console.log(`\nSemilla: ${seed}`);
console.log(`\nPegá esto en el caso como "design":\n${JSON.stringify(designOf(recipe), null, 2)}`);
