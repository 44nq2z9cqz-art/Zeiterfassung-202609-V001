// Antrag auf Auszahlung von Überstunden: Zeitkonto über dem Sockel zu einem Stichtag.
import { zeitkontoSaldo } from './konten';
import type { Buchung, Datenbestand } from './modell';
import { type Datum, type Minuten, MONATE, datumDE, dauer, plusTage, zerlege } from './zeit';

export interface Auszahlungsantrag {
  stichtag: Datum;
  /** Saldo des Zeitkontos am Ende des Stichtags */
  saldo: Minuten;
  sockel: Minuten;
  /** Saldo über dem Sockel am Stichtag */
  ueber: Minuten;
  /** Datum des Abgleichs mit der TiMaS Zeiterfassung */
  abgleichAm?: Datum;
  /** Stunden zur Auszahlung in Minuten */
  stunden: Minuten;
  /** Monat der Gehaltsabrechnung, z. B. „2026-10“ */
  abrechnung?: string;
  bemerkung?: string;
}

/** Zeitkonto, Sockel und der Teil darüber am Ende des Stichtags. */
export function stichtagWerte(daten: Datenbestand, stichtag: Datum, heute: Datum) {
  const saldo = zeitkontoSaldo(daten, stichtag, heute);
  const sockel = daten.einstellungen.sockel;
  return { saldo, sockel, ueber: Math.max(0, saldo - sockel) };
}

/** Vorschlag für den Stichtag: der letzte Tag des Vormonats. */
export function standardStichtag(heute: Datum): Datum {
  const [j, m] = zerlege(heute);
  return plusTage(`${j}-${String(m).padStart(2, '0')}-01`, -1);
}

/** Datum der jüngsten Buchung „Abgleich Firmensystem“, falls vorhanden. */
export function letzterAbgleich(daten: Datenbestand): Datum | undefined {
  return daten.buchungen
    .filter((b) => b.konto === 'zeit' && b.art === 'abgleich')
    .map((b) => b.datum)
    .sort()
    .at(-1);
}

/** „2026-10“ → „Oktober 2026“ */
export function monatText(monat: string): string {
  const [j, m] = monat.split('-').map(Number);
  return j && m ? `${MONATE[m - 1]} ${j}` : '';
}

export function pruefeAuszahlung(a: Pick<Auszahlungsantrag, 'stunden' | 'ueber'>): string | null {
  if (!(a.stunden > 0)) return 'Bitte die Stunden zur Auszahlung eintragen, z. B. 20:00.';
  if (a.stunden > a.ueber) return `Über dem Sockel stehen am Stichtag nur ${dauer(a.ueber)} Std. zur Verfügung.`;
  return null;
}

/** Nach der Genehmigung: die Stunden als Auszahlung vom Zeitkonto abbuchen. */
export function auszahlungsBuchung(a: Auszahlungsantrag, datum: Datum, antragsdatum: Datum): Buchung {
  const teile = [`laut Antrag vom ${datumDE(antragsdatum)}`, a.abrechnung ? `Abrechnung ${monatText(a.abrechnung)}` : ''];
  return { id: crypto.randomUUID(), konto: 'zeit', art: 'auszahlung', datum, betrag: -a.stunden, kommentar: teile.filter(Boolean).join(', ') };
}
