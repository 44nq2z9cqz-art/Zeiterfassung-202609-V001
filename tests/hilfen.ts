import { standardEinstellungen } from '../src/core/einstellungen';
import type { Buchung, Datenbestand, Tag } from '../src/core/modell';
import { parseUhrzeit } from '../src/core/zeit';

const u = (t: string) => parseUhrzeit(t)!;

/** Arbeitstag aus Uhrzeiten, z. B. arbeitstag('2026-08-31', '08:46', '18:07', ['12:02-12:23']) */
export function arbeitstag(datum: string, kommen: string, gehen: string, pausen: string[] = []): Tag {
  return {
    datum,
    art: 'arbeit',
    kommen: u(kommen),
    gehen: u(gehen),
    pausen: pausen.map((p, i) => {
      const [b, e] = p.split('-');
      return { id: `${datum}-${i}`, beginn: u(b), ende: u(e), quelle: 'manuell' };
    }),
    arbeitsort: 'buero',
    protokoll: []
  };
}

export function tagesart(datum: string, art: Tag['art']): Tag {
  return { datum, art, kommen: null, gehen: null, pausen: [], arbeitsort: 'buero', protokoll: [] };
}

export function bestand(appStart: string, tage: Tag[] = [], buchungen: Buchung[] = []): Datenbestand {
  return {
    tage: new Map(tage.map((t) => [t.datum, t])),
    buchungen,
    einstellungen: standardEinstellungen(appStart)
  };
}
