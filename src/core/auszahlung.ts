// Antrag auf Auszahlung von Überstunden: Zeitkonto über dem Sockel zu einem Stichtag.
// Beim Erstellen des PDFs wird der Antrag als „beantragt“ gespeichert; Auszahlungen – auch in
// Teilbeträgen über mehrere Monate – werden später dagegen gebucht, jeweils zum Monatsletzten.
import { zeitkontoSaldo } from './konten';
import type { Auszahlungsantrag, Auszahlungsrate, Buchung, Datenbestand } from './modell';
import { type Datum, type Minuten, MONATE, datumDE, dauer, plusTage, zerlege } from './zeit';

/** Die Angaben des Formulars – daraus entsteht das PDF und der gespeicherte Antrag. */
export type Antragsangaben = Omit<Auszahlungsantrag, 'id' | 'antragsdatum' | 'auszahlungen'>;

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

/** „2026-10“ → „2026-10-31“ */
export function monatsletzter(monat: string): Datum {
  const [j, m] = monat.split('-').map(Number);
  const folge = m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`;
  return plusTage(folge, -1);
}

export function pruefeAuszahlung(a: Pick<Antragsangaben, 'stunden' | 'ueber'>): string | null {
  if (!(a.stunden > 0)) return 'Bitte die Stunden zur Auszahlung eintragen, z. B. 20:00.';
  if (a.stunden > a.ueber) return `Über dem Sockel stehen am Stichtag nur ${dauer(a.ueber)} Std. zur Verfügung.`;
  return null;
}

/** Aus den Formularangaben wird beim Erstellen des PDFs ein gespeicherter Antrag. */
export function neuerAntrag(angaben: Antragsangaben, antragsdatum: Datum): Auszahlungsantrag {
  return { ...angaben, id: crypto.randomUUID(), antragsdatum, auszahlungen: [] };
}

export const ausgezahlt = (a: Auszahlungsantrag): Minuten => a.auszahlungen.reduce((s, r) => s + r.stunden, 0);
export const offen = (a: Auszahlungsantrag): Minuten => Math.max(0, a.stunden - ausgezahlt(a));

export function pruefeRate(a: Auszahlungsantrag, monat: string, stunden: Minuten): string | null {
  if (!/^\d{4}-\d{2}$/.test(monat)) return 'Bitte den Abrechnungsmonat wählen.';
  if (!(stunden > 0)) return 'Bitte die ausgezahlten Stunden eintragen.';
  if (stunden > offen(a)) return `Aus diesem Antrag sind nur noch ${dauer(offen(a))} Std. offen.`;
  return null;
}

/** Eine Auszahlung erfassen: Rate am Antrag plus Buchung „Auszahlung“ zum Monatsletzten. */
export function rateMitBuchung(a: Auszahlungsantrag, monat: string, stunden: Minuten): { rate: Auszahlungsrate; buchung: Buchung; antrag: Auszahlungsantrag } {
  const buchung: Buchung = {
    id: crypto.randomUUID(),
    konto: 'zeit',
    art: 'auszahlung',
    datum: monatsletzter(monat),
    betrag: -stunden,
    kommentar: `Abrechnung ${monatText(monat)}, laut Antrag vom ${datumDE(a.antragsdatum)}`
  };
  const rate: Auszahlungsrate = { id: crypto.randomUUID(), monat, stunden, buchungId: buchung.id };
  return { rate, buchung, antrag: { ...a, auszahlungen: [...a.auszahlungen, rate].sort((x, y) => x.monat.localeCompare(y.monat)) } };
}
