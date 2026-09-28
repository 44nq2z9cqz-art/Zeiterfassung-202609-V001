// Erzeugt die App-Symbole als PNG: Night-Shift-Fläche mit Laser-Lemon-Ring (wie die Arbeitszeit in „Heute“).
// Aufruf: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NIGHT = [0x10, 0x13, 0x1a];
const LEMON = [0xef, 0xff, 0x4f];
const DIM = [0x3a, 0x40, 0x2c];

function crc32(buf) {
  let c;
  const table = crc32.t ?? (crc32.t = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, crc]);
}

function png(groesse, pixel) {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(groesse, 0);
  kopf.writeUInt32BE(groesse, 4);
  kopf[8] = 8; // Bittiefe
  kopf[9] = 2; // RGB
  const roh = Buffer.alloc((groesse * 3 + 1) * groesse);
  for (let y = 0; y < groesse; y++) {
    roh[y * (groesse * 3 + 1)] = 0;
    pixel.copy(roh, y * (groesse * 3 + 1) + 1, y * groesse * 3, (y + 1) * groesse * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', kopf),
    chunk('IDAT', deflateSync(roh)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Farbe an einem Punkt (in Einheiten 0..1 der Kantenlänge). `skala` verkleinert das Motiv für „maskable“. */
function farbe(x, y, skala) {
  const dx = (x - 0.5) / skala;
  const dy = (y - 0.5) / skala;
  const r = Math.hypot(dx, dy);
  const innen = 0.235;
  const aussen = 0.335;
  if (r < innen || r > aussen) return NIGHT;
  // Winkel ab 12 Uhr im Uhrzeigersinn, 0..1
  const w = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
  const ende = 0.72;
  // abgerundete Enden des Bogens
  const mitte = (innen + aussen) / 2;
  const kappe = (aussen - innen) / 2;
  const punkt = (t) => [Math.sin(t * 2 * Math.PI) * mitte, -Math.cos(t * 2 * Math.PI) * mitte];
  const [ax, ay] = punkt(0);
  const [ex, ey] = punkt(ende);
  if (w <= ende || Math.hypot(dx - ax, dy - ay) < kappe || Math.hypot(dx - ex, dy - ey) < kappe) return LEMON;
  return DIM;
}

function zeichne(groesse, skala = 1) {
  const pixel = Buffer.alloc(groesse * groesse * 3);
  const n = 4; // Kantenglättung durch 4×4 Abtastung
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const summe = [0, 0, 0];
      for (let sy = 0; sy < n; sy++)
        for (let sx = 0; sx < n; sx++) {
          const f = farbe((x + (sx + 0.5) / n) / groesse, (y + (sy + 0.5) / n) / groesse, skala);
          summe[0] += f[0];
          summe[1] += f[1];
          summe[2] += f[2];
        }
      const i = (y * groesse + x) * 3;
      pixel[i] = Math.round(summe[0] / (n * n));
      pixel[i + 1] = Math.round(summe[1] / (n * n));
      pixel[i + 2] = Math.round(summe[2] / (n * n));
    }
  }
  return png(groesse, pixel);
}

const ziel = new URL('../public/icons/', import.meta.url);
mkdirSync(ziel, { recursive: true });
const dateien = [
  ['apple-touch-icon.png', 180, 1],
  ['favicon.png', 64, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.8]
];
for (const [name, groesse, skala] of dateien) {
  writeFileSync(new URL(name, ziel), zeichne(groesse, skala));
  console.log('erstellt', name);
}
