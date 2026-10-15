// Retratos ilustrados a partir de rasgos. Los casos generados describen a cada
// sospechoso con un `look` y la API dibuja el SVG cuando se pide la foto.

export const LOOK_OPTIONS = {
  skin: ['claro', 'medio', 'trigueño', 'oscuro'],
  hair: ['corto', 'largo', 'melena', 'rodete', 'pelado', 'rapado'],
  hairColor: ['negro', 'castaño', 'rubio', 'pelirrojo', 'canoso', 'blanco'],
  clothes: ['camisa', 'saco', 'blazer', 'cocinero', 'cardigan', 'remera', 'uniforme'],
  clothesColor: ['azul', 'bordo', 'gris', 'negro', 'blanco', 'verde', 'marron', 'celeste', 'mostaza'],
  facialHair: ['ninguno', 'bigote', 'barba', 'barba_de_dias'],
  expression: ['neutral', 'sonrisa', 'seria'],
};

const SKIN = { claro: '#ecc5a6', medio: '#dcae8a', trigueño: '#c8946d', oscuro: '#8d5b3e' };
const HAIR = { negro: '#1e1a17', castaño: '#5e4030', rubio: '#c9a35c', pelirrojo: '#9c4a26', canoso: '#a9a59d', blanco: '#ece9e3' };
const CLOTH = {
  azul: '#1f2c4d', bordo: '#6d2a35', gris: '#5d6166', negro: '#222326', blanco: '#f2efe8',
  verde: '#2f4a3a', marron: '#5a3d26', celeste: '#8fb0cf', mostaza: '#b08a2e',
};

function pick(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

export function portraitSvg(look = {}, { label = '', style = 'ficha' } = {}) {
  const skin = SKIN[pick(look.skin, LOOK_OPTIONS.skin, 'medio')];
  const hairKind = pick(look.hair, LOOK_OPTIONS.hair, 'corto');
  const hair = HAIR[pick(look.hairColor, LOOK_OPTIONS.hairColor, 'castaño')];
  const clothesKind = pick(look.clothes, LOOK_OPTIONS.clothes, 'camisa');
  const cloth = CLOTH[pick(look.clothesColor, LOOK_OPTIONS.clothesColor, 'gris')];
  const facial = pick(look.facialHair, LOOK_OPTIONS.facialHair, 'ninguno');
  const expression = pick(look.expression, LOOK_OPTIONS.expression, 'neutral');
  const dark = shade(skin, -60);

  let s = '';

  // Fondo
  if (style === 'ficha') {
    s += '<rect width="300" height="360" fill="#cbc2ab"/>';
    for (let i = 0, y = 40; y < 360; y += 40, i++) {
      s += `<line x1="0" x2="300" y1="${y}" y2="${y}" stroke="#a99f86" stroke-width="1.5"/>`;
      s += `<text x="8" y="${y - 6}" font-family="monospace" font-size="11" fill="#8f8570">${190 - i * 10}</text>`;
    }
  } else {
    s += '<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#a8865a"/><stop offset="1" stop-color="#4c3a28"/></radialGradient></defs>';
    s += '<rect width="300" height="360" fill="url(#g)"/>';
  }

  // Pelo de atrás (largo y melena caen detrás de los hombros)
  if (hairKind === 'largo') s += `<path d="M86 140 C80 70 120 66 150 66 C180 66 220 70 214 140 L222 290 L78 290 Z" fill="${hair}"/>`;
  if (hairKind === 'melena') s += `<path d="M84 140 C80 70 120 64 150 64 C180 64 220 70 216 140 L214 220 L86 220 Z" fill="${hair}"/>`;
  if (hairKind === 'rodete') s += `<circle cx="150" cy="70" r="30" fill="${hair}"/>`;

  // Torso
  s += `<path d="M30 360 C40 270 90 250 150 250 C210 250 260 270 270 360 Z" fill="${cloth}"/>`;
  const lapel = shade(cloth, 18);
  switch (clothesKind) {
    case 'saco':
      s += '<path d="M124 250 L150 300 L176 250 Z" fill="#f2efe8"/>';
      s += '<path d="M145 262 L155 262 L160 330 L150 345 L140 330 Z" fill="#7a2531"/>';
      s += `<path d="M124 250 L150 300 L132 360 L104 360 Z" fill="${lapel}"/><path d="M176 250 L150 300 L168 360 L196 360 Z" fill="${lapel}"/>`;
      break;
    case 'blazer':
      s += '<path d="M126 250 L150 310 L174 250 Z" fill="#f2efe8"/>';
      s += `<path d="M126 250 L150 310 L140 360 L110 360 Z" fill="${lapel}"/><path d="M174 250 L150 310 L160 360 L190 360 Z" fill="${lapel}"/>`;
      break;
    case 'cocinero':
      s += '<path d="M30 360 C40 270 90 250 150 250 C210 250 260 270 270 360 Z" fill="#f2efe8"/>';
      s += '<path d="M120 252 L150 290 L180 252" fill="none" stroke="#cfc9bd" stroke-width="4"/>';
      for (const x of [128, 172]) for (const y of [300, 330]) s += `<circle cx="${x}" cy="${y}" r="5" fill="#cfc9bd"/>`;
      break;
    case 'cardigan':
      s += '<path d="M118 250 L150 300 L182 250 Z" fill="#e9dfd0"/>';
      s += `<path d="M150 300 L150 360" stroke="${shade(cloth, -25)}" stroke-width="3"/>`;
      break;
    case 'remera':
      s += `<path d="M126 252 C136 268 164 268 174 252" fill="none" stroke="${shade(cloth, -30)}" stroke-width="5"/>`;
      break;
    case 'uniforme':
      s += `<path d="M120 252 L150 280 L180 252" fill="none" stroke="${shade(cloth, -35)}" stroke-width="5"/>`;
      s += `<rect x="186" y="292" width="34" height="22" rx="3" fill="${shade(cloth, 30)}"/>`;
      s += '<circle cx="150" cy="300" r="4" fill="#d9b45a"/><circle cx="150" cy="328" r="4" fill="#d9b45a"/>';
      break;
    default: // camisa
      s += `<path d="M122 250 L150 286 L178 250" fill="none" stroke="${shade(cloth, -25)}" stroke-width="5"/>`;
  }
  if (look.necklace) {
    for (let a = 4; a < 28; a += 2) {
      s += `<circle cx="${(150 + 32 * Math.cos(a / 10)).toFixed(1)}" cy="${(256 + 26 * Math.sin(a / 10)).toFixed(1)}" r="4.5" fill="#f4efe6" stroke="#bdb3a3"/>`;
    }
  }

  // Cara
  s += `<rect x="130" y="200" width="40" height="50" fill="${skin}"/>`;
  s += `<ellipse cx="96" cy="156" rx="9" ry="14" fill="${skin}"/><ellipse cx="204" cy="156" rx="9" ry="14" fill="${skin}"/>`;
  s += `<ellipse cx="150" cy="150" rx="56" ry="68" fill="${skin}"/>`;
  if (look.earrings) s += '<circle cx="94" cy="172" r="4" fill="#d9b45a"/><circle cx="206" cy="172" r="4" fill="#d9b45a"/>';

  // Pelo de adelante
  switch (hairKind) {
    case 'pelado':
      s += `<path d="M94 160 C88 110 100 96 110 104 C104 120 102 140 104 160 Z" fill="${hair}"/>`;
      s += `<path d="M206 160 C212 110 200 96 190 104 C196 120 198 140 196 160 Z" fill="${hair}"/>`;
      break;
    case 'rapado':
      s += `<path d="M96 132 C96 90 120 80 150 80 C180 80 204 90 204 132 C196 106 176 98 150 98 C124 98 104 106 96 132 Z" fill="${hair}" opacity="0.8"/>`;
      break;
    case 'largo':
    case 'melena':
      s += `<path d="M94 140 C92 90 120 82 150 82 C190 82 206 96 206 130 C180 104 140 100 108 128 Z" fill="${hair}"/>`;
      break;
    case 'rodete':
      s += `<path d="M94 150 C88 80 120 70 150 70 C180 70 212 80 206 150 C200 110 180 98 150 98 C120 98 100 110 94 150 Z" fill="${hair}"/>`;
      break;
    default: // corto
      s += `<path d="M95 140 C92 86 120 76 150 76 C182 76 210 86 205 140 C200 108 180 96 150 96 C120 96 100 108 95 140 Z" fill="${hair}"/>`;
  }

  // Facciones
  const brow = hairKind === 'pelado' || hairKind === 'rapado' ? shade(hair, -20) : hair;
  s += '<ellipse cx="128" cy="152" rx="5" ry="4" fill="#2a211c"/><ellipse cx="172" cy="152" rx="5" ry="4" fill="#2a211c"/>';
  s += `<path d="M150 156 q-6 20 2 26" fill="none" stroke="${dark}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
  if (expression === 'seria') {
    s += `<path d="M117 132 l24 6 M183 132 l-24 6" stroke="${brow}" stroke-width="5" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M115 138 q13 -7 26 0 M159 138 q13 -7 26 0" fill="none" stroke="${brow}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (facial === 'barba' || facial === 'barba_de_dias') {
    const op = facial === 'barba' ? 0.95 : 0.45;
    s += `<path d="M100 170 C104 214 128 222 150 222 C172 222 196 214 200 170 C196 200 176 206 150 206 C124 206 104 200 100 170 Z" fill="${hair}" opacity="${op}"/>`;
  }
  if (facial !== 'ninguno') {
    s += `<path d="M126 186 C138 176 162 176 174 186 C166 192 134 192 126 186 Z" fill="${hair}" opacity="${facial === 'barba_de_dias' ? 0.5 : 0.95}"/>`;
  }
  const lip = shade(skin, -70);
  const mouth = {
    neutral: 'M134 194 q16 4 32 0',
    sonrisa: 'M132 192 q18 12 36 0',
    seria: 'M134 196 q16 -6 32 0',
  }[expression];
  s += `<path d="${mouth}" fill="none" stroke="${lip}" stroke-width="4" stroke-linecap="round"/>`;
  if (look.glasses) {
    s += '<rect x="110" y="138" width="34" height="26" rx="4" fill="#ffffff22" stroke="#2a2522" stroke-width="3.5"/>';
    s += '<rect x="156" y="138" width="34" height="26" rx="4" fill="#ffffff22" stroke="#2a2522" stroke-width="3.5"/>';
    s += '<path d="M144 148 h12" stroke="#2a2522" stroke-width="3.5"/>';
  }

  if (style === 'ficha' && label) {
    s += '<rect x="60" y="318" width="180" height="32" fill="#1f1d1a"/>';
    s += `<text x="150" y="339" text-anchor="middle" font-family="monospace" font-size="14" letter-spacing="2" fill="#ece7da">${esc(label)}</text>`;
  }
  if (style !== 'ficha') s += '<rect width="300" height="360" fill="#f3d9a0" opacity="0.12"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360" width="300" height="360">${s}</svg>`;
}

// "Elena Ríos" -> "RÍOS, E."
export function plateLabel(name) {
  const parts = String(name).replace(/^(Dr|Dra|Sr|Sra)\.?\s+/i, '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0]?.toUpperCase() ?? '';
  const last = parts.at(-1).toUpperCase();
  return `${last}, ${parts[0][0].toUpperCase()}.`;
}
