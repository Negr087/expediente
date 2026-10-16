// Recetas de casos: antes de escribir un caso se sortea su diseño, así cada caso
// se juega distinto y no solo cambia la escenografía. Cada caso guarda su receta
// en "design" y el sorteo evita lo que ya usaron los casos anteriores.
//
//   npm run receta                 receta nueva de un caso corto
//   npm run receta -- largo        corto, medio o largo
//   npm run receta -- medio 42     misma receta siempre con la misma semilla

import { DURATIONS } from './shared.mjs';

// Estructura según la duración.
export const STRUCTURE = {
  corto: { evidencias: '2 evidencias por rol en cada fase (12 en total)', sospechosos: [3, 4], historia: 'Una sola trama, directa.' },
  medio: { evidencias: '2 o 3 evidencias por rol en cada fase (entre 18 y 20 en total)', sospechosos: [4, 5], historia: 'La trama principal y una historia secundaria: un secreto ajeno al crimen que confunde y se aclara antes de la última fase.' },
  largo: { evidencias: '3 evidencias por rol en cada fase (30 en total)', sospechosos: [5, 6], historia: 'La trama principal, dos historias secundarias y un doble giro: lo que parece la solución en la fase 4 está incompleto y la fase 5 lo da vuelta.' },
};

export const AXES = {
  crimen: [
    { id: 'asesinato', label: 'Asesinato', desc: 'Alguien murió y fue a propósito.' },
    { id: 'envenenamiento-lento', label: 'Envenenamiento lento', desc: 'La víctima venía enfermándose hace semanas; nadie lo vio venir.' },
    { id: 'desaparicion', label: 'Desaparición', desc: 'Alguien desapareció. Hay que descubrir qué le pasó y quién está detrás.' },
    { id: 'robo-imposible', label: 'Robo imposible', desc: 'Algo valioso desapareció de un lugar cerrado o vigilado.' },
    { id: 'accidente-encubierto', label: 'Accidente encubierto', desc: 'La muerte fue un accidente, pero alguien lo tapó y armó una escena falsa. El "culpable" es quien lo causó o lo encubrió.' },
    { id: 'sabotaje', label: 'Sabotaje', desc: 'Alguien arruinó algo importante (una obra, una competencia, un lanzamiento) y casi termina en tragedia.' },
    { id: 'estafa', label: 'Estafa', desc: 'Un fraude que dejó una víctima; hay que descubrir al estafador entre los que parecen damnificados.' },
  ],

  giro: [
    { id: 'hora-falsa', label: 'La hora es falsa', desc: 'El crimen pasó mucho antes (o después) de lo que todos creen; alguien manipuló la hora.' },
    { id: 'victima-equivocada', label: 'La víctima equivocada', desc: 'El crimen era para otra persona.' },
    { id: 'dos-culpables', label: 'Dos culpables', desc: 'Dos sospechosos actuaron juntos y se cubren mutuamente. La acusación correcta los nombra a los dos.' },
    { id: 'coartada-cruzada', label: 'Coartadas cruzadas', desc: 'Dos personas se dan coartada una a la otra; una de las dos miente por otro motivo.' },
    { id: 'quien-lo-encontro', label: 'Quien lo encontró', desc: 'El culpable es quien "descubrió" el crimen.' },
    { id: 'el-testigo', label: 'El testigo clave', desc: 'El testigo más útil del caso es el culpable y su testimonio guía a todos hacia otro lado.' },
    { id: 'lugar-falso', label: 'El lugar es falso', desc: 'El crimen no pasó donde apareció la víctima o el objeto.' },
    { id: 'identidad', label: 'Identidad cambiada', desc: 'Alguien no es quien dice ser.' },
    { id: 'culpable-obvio-inocente', label: 'El obvio es inocente', desc: 'Todo apunta a un sospechoso desde el principio; es inocente del crimen pero culpable de otra cosa que oculta.' },
    { id: 'sin-giro', label: 'Clásico directo', desc: 'Sin truco de estructura: la dificultad está en cruzar bien la evidencia.' },
  ],

  culpable: [
    { id: 'el-mas-querible', label: 'El más querible', desc: 'El personaje más simpático y colaborador.' },
    { id: 'el-sin-motivo', label: 'El que parecía no tener motivo', desc: 'Su motivo aparece recién en la última fase.' },
    { id: 'familiar-cercano', label: 'Familiar cercano', desc: 'Pareja, hijo, hermana: alguien de la familia directa.' },
    { id: 'el-mas-joven', label: 'El más joven', desc: 'La persona más joven del grupo.' },
    { id: 'el-de-afuera', label: 'El de afuera', desc: 'Alguien ajeno al grupo que todos subestimaron.' },
    { id: 'la-autoridad', label: 'La autoridad', desc: 'Quien tenía el poder o el control del lugar.' },
    { id: 'el-que-ayuda', label: 'El que ayuda a investigar', desc: 'Se ofrece a colaborar y da datos; los usa para desviar.' },
    { id: 'empleado-confianza', label: 'Empleado de confianza', desc: 'Alguien que trabajaba para la víctima hace años.' },
  ],

  motivo: [
    { id: 'plata', label: 'Plata', desc: 'Deudas, un robo descubierto, un negocio.' },
    { id: 'herencia', label: 'Herencia', desc: 'Un testamento, una propiedad, un cambio de último momento.' },
    { id: 'celos', label: 'Amor y celos', desc: 'Una relación secreta, una traición.' },
    { id: 'venganza', label: 'Venganza', desc: 'Algo que pasó hace años y nadie relacionó.' },
    { id: 'proteger', label: 'Proteger a alguien', desc: 'Lo hizo para salvar a otra persona.' },
    { id: 'secreto', label: 'Un secreto', desc: 'La víctima sabía algo que iba a arruinar al culpable.' },
    { id: 'reconocimiento', label: 'Reconocimiento', desc: 'Un premio, una autoría robada, un puesto.' },
    { id: 'miedo', label: 'Miedo', desc: 'El culpable se sintió amenazado.' },
  ],

  // Qué se pregunta para pasar de fase. Nunca "¿quién es el culpable?" en la fase 2.
  pregunta1: [
    { id: 'metodo', label: 'Cómo se hizo' },
    { id: 'momento', label: 'Cuándo pasó realmente' },
    { id: 'lugar', label: 'Dónde pasó realmente' },
    { id: 'objeto', label: 'Qué objeto es clave' },
    { id: 'que-paso', label: 'Qué pasó de verdad (accidente, robo, crimen…)' },
  ],
  pregunta2: [
    { id: 'quien-miente', label: 'Quién mintió en su declaración (no es necesariamente el culpable)' },
    { id: 'coartada-falsa', label: 'Qué coartada no se sostiene' },
    { id: 'conexion', label: 'Qué conecta a dos personajes que decían no conocerse' },
    { id: 'objeto-movido', label: 'Quién movió o se llevó un objeto' },
    { id: 'hora-clave', label: 'Qué pasó en un momento clave de la noche' },
    { id: 'dato-oculto', label: 'Qué escondía la víctima' },
  ],

  mecanicas: [
    { id: 'conocimiento-culpable', label: 'Conocimiento culpable', desc: 'Alguien menciona un detalle que solo podía saber quien estuvo ahí.' },
    { id: 'clima', label: 'El clima', desc: 'Lluvia, barro, viento o luz que delatan algo (zapatos secos, ventana abierta).' },
    { id: 'zurdo', label: 'La mano', desc: 'Zurdo o diestro, una herida en la mano, una letra.' },
    { id: 'reloj', label: 'El reloj', desc: 'Un reloj adelantado, una alarma, una vela consumida, un hielo derretido.' },
    { id: 'celular', label: 'El celular', desc: 'Batería, ubicación, una foto con hora, un "visto" a destiempo.' },
    { id: 'animal', label: 'El animal', desc: 'Un perro que no ladró, un gato que estaba encerrado.' },
    { id: 'alergia', label: 'Alergia o salud', desc: 'Un remedio, una alergia, una intolerancia que alguien no podía tener.' },
    { id: 'foto-reflejo', label: 'El fondo de una foto', desc: 'Un reflejo, algo que aparece o falta en el fondo.' },
    { id: 'ticket', label: 'Ticket o comprobante', desc: 'Una compra, un peaje, una entrada con hora y lugar.' },
    { id: 'idioma', label: 'Forma de hablar', desc: 'Una palabra, una falta de ortografía o un apodo que delata quién escribió algo.' },
    { id: 'ropa', label: 'La ropa', desc: 'Una prenda que no corresponde, un cambio de ropa.' },
    { id: 'rastro', label: 'Rastro físico', desc: 'Pintura, barro, harina, polen: algo que quedó en quien estuvo ahí.' },
    { id: 'llave', label: 'La llave', desc: 'Quién podía abrir, una copia, una cerradura forzada desde adentro.' },
    { id: 'musica', label: 'Sonido o música', desc: 'Una canción que duró tanto, un ruido que alguien no pudo oír.' },
    { id: 'comida', label: 'La comida', desc: 'Lo que se comió, se sirvió o sobró dice quién estuvo y cuándo.' },
  ],

  // Tipos de documento que tienen que aparecer, además de los de siempre.
  formatos: [
    { id: 'chat', label: 'Chat de WhatsApp (bloque "chat")' },
    { id: 'carta', label: 'Carta o nota escrita a mano (bloque "letter")' },
    { id: 'audio', label: 'Transcripción de un audio o una llamada' },
    { id: 'posteo', label: 'Posteos o comentarios en redes' },
    { id: 'ticket', label: 'Tickets, facturas o resúmenes de tarjeta' },
    { id: 'plano', label: 'Plano o descripción del lugar con distancias' },
    { id: 'agenda', label: 'Agenda, calendario o lista de tareas' },
    { id: 'informe', label: 'Informe técnico (peritaje, laboratorio, mecánica)' },
  ],

  tono: [
    { id: 'clasico', label: 'Misterio clásico, a lo Agatha Christie' },
    { id: 'noir', label: 'Policial negro: lluvia, humo, gente con pasado' },
    { id: 'humor', label: 'Con humor: personajes exagerados, situaciones absurdas, pero el misterio es serio' },
    { id: 'cotidiano', label: 'Cotidiano y cercano: un barrio, una familia, un club' },
    { id: 'suspenso', label: 'Suspenso: algo raro, inquietante, sin gore' },
  ],

  epoca: [
    { id: 'hoy', label: 'Hoy' },
    { id: 'hoy', label: 'Hoy' },
    { id: 'hoy', label: 'Hoy' },
    { id: 'anos-20', label: 'Buenos Aires, años 20' },
    { id: 'anos-70', label: 'Años 70' },
    { id: 'anos-90', label: 'Años 90, sin celulares' },
    { id: 'futuro-cercano', label: 'Futuro cercano' },
  ],

  lugar: [
    'un club de barrio la noche de la fiesta aniversario', 'un tren nocturno a Bariloche', 'un estudio de radio en vivo',
    'un circo de gira por la costa', 'un museo la noche antes de una muestra', 'un barco cruzando a Colonia',
    'un hotel de montaña aislado por la nieve', 'una obra en construcción en Palermo', 'un torneo de truco en un pueblo',
    'un set de filmación de una telenovela', 'un colegio durante el viaje de egresados', 'una estancia en La Pampa durante la yerra',
    'un observatorio en San Juan', 'una cervecería artesanal el día del lanzamiento', 'una peluquería de barrio',
    'un edificio durante un corte de luz', 'una competencia de cocina televisada', 'un refugio de alta montaña',
    'una mudanza que salió mal', 'un casamiento en una quinta', 'una convención de cómics', 'una regata en el Delta',
  ],

  voces: [
    'formal y medida, usa "usted"', 'charlatana, se va por las ramas', 'seca, contesta con monosílabos',
    'nerviosa, se contradice y se corrige', 'irónica, todo le parece un chiste', 'dramática, todo es una tragedia',
    'técnica, habla con datos y números', 'campechana, con dichos de campo', 'joven, habla con muletillas ("tipo", "re")',
    'desconfiada, contesta con preguntas', 'amable de más, demasiado colaboradora', 'ofendida, se siente acusada todo el tiempo',
  ],
};

// Generador pseudoaleatorio con semilla (mulberry32), para poder repetir una receta.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(list, rand, avoid = []) {
  const fresh = list.filter((o) => !avoid.includes(o.id ?? o));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rand() * pool.length)];
}

function pickMany(list, n, rand, avoid = []) {
  const fresh = list.filter((o) => !avoid.includes(o.id ?? o));
  const rest = list.filter((o) => avoid.includes(o.id ?? o));
  const shuffle = (arr) => arr.map((o) => [rand(), o]).sort((a, b) => a[0] - b[0]).map(([, o]) => o);
  return [...shuffle(fresh), ...shuffle(rest)].slice(0, n);
}

// `previous`: los casos existentes (con su "design"). Se evita repetir lo de los
// últimos 3 casos en los ejes que más se notan, y las mecánicas ya usadas.
export function pickRecipe(previous = [], seed = Date.now(), { duracion = 'corto' } = {}) {
  if (!DURATIONS[duracion]) duracion = 'corto';
  const { phases } = DURATIONS[duracion];
  const range = STRUCTURE[duracion].sospechosos;
  const rand = rng(seed);
  const recent = previous.filter((c) => c.design).slice(-3).map((c) => c.design);
  const used = (key) => recent.flatMap((d) => [].concat(d[key] ?? []));
  const usedEver = (key) => previous.flatMap((c) => [].concat(c.design?.[key] ?? []));

  const crimen = pickOne(AXES.crimen, rand, used('crimen'));
  const giro = pickOne(AXES.giro, rand, used('giro'));
  const culpable = pickOne(AXES.culpable, rand, used('culpable'));
  const motivo = pickOne(AXES.motivo, rand, used('motivo'));
  const sospechosos = giro.id === 'dos-culpables' ? range[1] : range[Math.floor(rand() * range.length)];
  const usedQuestions = recent.flatMap((d) => d.preguntas ?? [d.pregunta1, d.pregunta2]);
  // Una pregunta por cada paso de fase: la primera de la lista de apertura, las demás sin repetir.
  const preguntas = [
    pickOne(AXES.pregunta1, rand, usedQuestions),
    ...pickMany(AXES.pregunta2, phases - 2, rand, usedQuestions),
  ];

  return {
    seed,
    crimen,
    giro,
    culpable,
    motivo,
    duracion,
    preguntas,
    mecanicas: pickMany(AXES.mecanicas, 3, rand, usedEver('mecanicas')),
    formatos: pickMany(AXES.formatos, 2, rand, used('formatos')),
    tono: pickOne(AXES.tono, rand, used('tono')),
    epoca: pickOne(AXES.epoca, rand),
    lugar: pickOne(AXES.lugar, rand, previous.map((c) => c.design?.lugar)),
    sospechosos,
    voces: pickMany(AXES.voces, sospechosos, rand),
  };
}

// Lo que se guarda en el caso: solo los ids, para comparar después.
export function designOf(recipe) {
  const id = (x) => x.id ?? x;
  return {
    crimen: id(recipe.crimen),
    giro: id(recipe.giro),
    culpable: id(recipe.culpable),
    motivo: id(recipe.motivo),
    duracion: recipe.duracion,
    preguntas: recipe.preguntas.map(id),
    mecanicas: recipe.mecanicas.map(id),
    formatos: recipe.formatos.map(id),
    tono: id(recipe.tono),
    epoca: id(recipe.epoca),
    lugar: recipe.lugar,
  };
}

// La receta como instrucciones para quien escribe el caso.
export function recipeText(recipe) {
  const line = (title, o) => `- ${title}: ${o.label}${o.desc ? `. ${o.desc}` : ''}`;
  return [
    'Receta de este caso (respetala: es lo que lo hace distinto de los anteriores):',
    `- Duración: ${DURATIONS[recipe.duracion].label}. "duration": ${DURATIONS[recipe.duracion].minutes}. ${DURATIONS[recipe.duracion].phases} fases (${DURATIONS[recipe.duracion].phases} nombres en "phaseNames"); se acusa en la última.`,
    `- Evidencia: ${STRUCTURE[recipe.duracion].evidencias}.`,
    `- Historia: ${STRUCTURE[recipe.duracion].historia}`,
    line('Qué pasó', recipe.crimen),
    line('Giro', recipe.giro),
    line('Quién es el culpable', recipe.culpable),
    line('Motivo', recipe.motivo),
    ...recipe.preguntas.map((q, i) => `- Pregunta para pasar de la fase ${i + 1}: sobre "${q.label}".`),
    `- Mecánicas de pistas (usá las tres): ${recipe.mecanicas.map((m) => `${m.label} (${m.desc})`).join('; ')}.`,
    `- Tienen que aparecer estos documentos: ${recipe.formatos.map((f) => f.label).join('; ')}.`,
    `- Tono: ${recipe.tono.label}.`,
    `- Época: ${recipe.epoca.label}.`,
    `- Lugar (punto de partida, se puede adaptar): ${recipe.lugar}.`,
    `- Sospechosos: ${recipe.sospechosos}. Cada uno habla distinto: ${recipe.voces.map((v, i) => `${i + 1}) ${v}`).join('; ')}.`,
  ].join('\n');
}
