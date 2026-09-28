// Gesetzliche Feiertage in Berlin (Konzept A4).
import { type Datum, datumAus, plusTage, zerlege } from './zeit';

/** Ostersonntag nach der Gaußschen Osterformel (gregorianisch). */
export function ostersonntag(jahr: number): Datum {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return datumAus(jahr, monat, tag);
}

// Einmalige Feiertage in Berlin (75. und 80. Jahrestag des Kriegsendes)
const EINMALIG: Record<Datum, string> = {
  '2020-05-08': 'Tag der Befreiung',
  '2025-05-08': 'Tag der Befreiung'
};

const cache = new Map<number, Map<Datum, string>>();

export function feiertageBerlin(jahr: number): Map<Datum, string> {
  const vorhanden = cache.get(jahr);
  if (vorhanden) return vorhanden;
  const ostern = ostersonntag(jahr);
  const liste: [Datum, string][] = [
    [datumAus(jahr, 1, 1), 'Neujahr'],
    [datumAus(jahr, 3, 8), 'Internationaler Frauentag'],
    [plusTage(ostern, -2), 'Karfreitag'],
    [plusTage(ostern, 1), 'Ostermontag'],
    [datumAus(jahr, 5, 1), 'Tag der Arbeit'],
    [plusTage(ostern, 39), 'Christi Himmelfahrt'],
    [plusTage(ostern, 50), 'Pfingstmontag'],
    [datumAus(jahr, 10, 3), 'Tag der Deutschen Einheit'],
    [datumAus(jahr, 12, 25), '1. Weihnachtstag'],
    [datumAus(jahr, 12, 26), '2. Weihnachtstag']
  ];
  const karte = new Map(liste.filter(([d]) => !(d.endsWith('-03-08') && jahr < 2019)));
  for (const [d, name] of Object.entries(EINMALIG)) if (zerlege(d)[0] === jahr) karte.set(d, name);
  cache.set(jahr, karte);
  return karte;
}

export function feiertag(datum: Datum): string | null {
  return feiertageBerlin(zerlege(datum)[0]).get(datum) ?? null;
}
