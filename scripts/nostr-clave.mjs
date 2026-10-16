// Crea la identidad de Nostr del juego (la que manda los avisos).
//   npm run nostr-clave
// La clave secreta (nsec) va solo en las variables de entorno: no la compartas.

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

const sk = generateSecretKey();
console.log(`
Identidad nueva para los avisos de Expediente

  NOSTR_NSEC=${nip19.nsecEncode(sk)}
  (clave secreta: va en .env y en Vercel, no la compartas)

  npub del juego: ${nip19.npubEncode(getPublicKey(sk))}
  (es pública: podés seguirla desde tu cliente para reconocer los avisos)

Agregá también NOSTR_AVISOS_NPUB=<tu npub> y probá con: npm run pedidos -- aviso
`);
