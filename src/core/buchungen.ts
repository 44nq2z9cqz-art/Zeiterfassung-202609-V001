// Buchungen auf Zeitkonto und Urlaubskonto (Konzept B3, B4, G1).
import { zeitkontoSaldo } from './konten';
import type { Buchung, Buchungsart, Datenbestand, Konto } from './modell';
import { type Datum, type Minuten, datumDE, dauer } from './zeit';

export const ARTEN_ZEIT: Buchungsart[] = ['vortrag', 'abgleich', 'auszahlung', 'korrektur'];
export const ARTEN_URLAUB: Buchungsart[] = ['resturlaub', 'sonderurlaub', 'korrektur'];

export const ART_NAMEN: Record<Buchungsart, string> = {
  vortrag: 'Vortrag',
  abgleich: 'Abgleich Firmensystem',
  auszahlung: 'Auszahlung',
  korrektur: 'Korrektur',
  resturlaub: 'Resturlaub Vorjahre',
  sonderurlaub: 'Sonderurlaub'
};

/** „123:45“, „8“, „0:30“ → Minuten (ohne Vorzeichen). Ungültig → null. */
export function parseStunden(text: string): Minuten | null {
  const t = text.trim().replace(/\s/g, '');
  const m = /^(\d{1,4})(?::(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (min > 59) return null;
  return Number(m[1]) * 60 + min;
}

/** „2“, „2,5“, „0.5“ → Tage (ganze oder halbe). Ungültig → null. */
export function parseTage(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return (n * 2) % 1 === 0 ? n : null;
}

/** Saldo laut App am Ende des Stichtags – ohne die gerade bearbeitete Buchung. */
export function appSaldoAm(daten: Datenbestand, stichtag: Datum, heuteDatum: Datum, ohneId?: string): Minuten {
  const ohne = ohneId ? { ...daten, buchungen: daten.buchungen.filter((b) => b.id !== ohneId) } : daten;
  return zeitkontoSaldo(ohne, stichtag, heuteDatum);
}

export interface Eingabe {
  id?: string;
  konto: Konto;
  art: Buchungsart;
  datum: Datum;
  /** Minuten (Zeitkonto) bzw. Tage (Urlaub), ohne Vorzeichen */
  wert: number;
  /** −1 oder +1; bei Auszahlung immer −1, bei Resturlaub und Sonderurlaub immer +1 */
  vorzeichen: 1 | -1;
  kommentar: string;
  /** Nur beim Abgleich: Saldo laut Firmensystem (mit Vorzeichen) */
  firma?: Minuten;
}

export type Pruefung = { buchung: Buchung; fehler?: undefined } | { buchung?: undefined; fehler: string };

/** Prüft die Eingabe und baut daraus die Buchung. Beim Abgleich wird der Betrag berechnet. */
export function baueBuchung(e: Eingabe, daten: Datenbestand, heuteDatum: Datum): Pruefung {
  if (!e.datum) return { fehler: 'Bitte ein Datum wählen.' };
  const id = e.id ?? crypto.randomUUID();
  const kommentar = e.kommentar.trim() || undefined;

  if (e.art === 'abgleich') {
    if (e.firma === undefined || Number.isNaN(e.firma)) return { fehler: 'Bitte den Saldo laut Firmensystem eintragen.' };
    if (e.datum > heuteDatum) return { fehler: 'Der Stichtag darf nicht in der Zukunft liegen.' };
    const app = appSaldoAm(daten, e.datum, heuteDatum, e.id);
    const betrag = e.firma - app;
    if (betrag === 0) return { fehler: `App und Firmensystem stimmen am ${datumDE(e.datum)} schon überein (${dauer(app, true)}).` };
    return { buchung: { id, konto: 'zeit', art: 'abgleich', datum: e.datum, betrag, kommentar, abgleich: { firma: e.firma, app } } };
  }

  if (!(e.wert > 0)) return { fehler: e.konto === 'zeit' ? 'Bitte einen Betrag in Stunden eintragen, z. B. 12:30.' : 'Bitte die Anzahl der Tage eintragen, z. B. 2 oder 0,5.' };
  const vorzeichen = e.art === 'auszahlung' ? -1 : e.art === 'resturlaub' || e.art === 'sonderurlaub' ? 1 : e.vorzeichen;
  return { buchung: { id, konto: e.konto, art: e.art, datum: e.datum, betrag: vorzeichen * e.wert, kommentar } };
}
