// Automatische Sicherungen in der App: täglich ein Schnappschuss, dazu einer vor jedem Ersetzen der Daten.
// Sie schützen vor Bedienfehlern, nicht vor dem Verlust des Geräts – dafür bleibt das Backup in iCloud Drive.
import type { Backup } from './backup';
import type { Datum } from './zeit';

export type Sicherungsgrund = 'taeglich' | 'vor-wiederherstellung' | 'vor-import';

export interface Sicherung {
  /** Zeitpunkt als ISO-Text, zugleich der Schlüssel */
  id: string;
  /** Kalendertag der Sicherung (lokal) */
  datum: Datum;
  grund: Sicherungsgrund;
  tage: number;
  buchungen: number;
  antraege: number;
  backup: Backup;
}

export const BEHALTEN: Record<Sicherungsgrund, number> = {
  taeglich: 14,
  'vor-wiederherstellung': 5,
  'vor-import': 5
};

export const GRUND_TEXT: Record<Sicherungsgrund, string> = {
  taeglich: 'täglich',
  'vor-wiederherstellung': 'vor dem Wiederherstellen',
  'vor-import': 'vor dem Import'
};

type Kopf = Pick<Sicherung, 'id' | 'datum' | 'grund'>;

/** Ist heute schon eine tägliche Sicherung angelegt? */
export function taeglichFaellig(vorhanden: Kopf[], heute: Datum): boolean {
  return !vorhanden.some((s) => s.grund === 'taeglich' && s.datum === heute);
}

/** Welche Sicherungen wegfallen: je Grund bleiben nur die neuesten. */
export function ueberzaehlig(vorhanden: Kopf[]): string[] {
  const weg: string[] = [];
  for (const grund of Object.keys(BEHALTEN) as Sicherungsgrund[]) {
    const liste = vorhanden.filter((s) => s.grund === grund).sort((a, b) => b.id.localeCompare(a.id));
    weg.push(...liste.slice(BEHALTEN[grund]).map((s) => s.id));
  }
  return weg;
}
