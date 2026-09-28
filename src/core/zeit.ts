// Datums- und Zeitfunktionen.
// Ein Datum ist immer ein String „JJJJ-MM-TT“ im lokalen Kalender. Gerechnet wird über UTC,
// damit Sommerzeit und Zeitzone nie einen Tag verschieben (Fehler der alten App).
// Uhrzeiten sind Minuten seit Mitternacht des jeweiligen Tages (Werte ≥ 1440 = nach Mitternacht).

export type Datum = string;
export type Minuten = number;

export const MINUS = '−';

const zwei = (n: number) => String(n).padStart(2, '0');

export function datumAus(jahr: number, monat: number, tag: number): Datum {
  return `${jahr}-${zwei(monat)}-${zwei(tag)}`;
}

export function zerlege(datum: Datum): [number, number, number] {
  const [j, m, t] = datum.split('-').map(Number);
  return [j, m, t];
}

export function plusTage(datum: Datum, tage: number): Datum {
  const [j, m, t] = zerlege(datum);
  const d = new Date(Date.UTC(j, m - 1, t + tage));
  return datumAus(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 0 = Sonntag … 6 = Samstag */
export function wochentag(datum: Datum): number {
  const [j, m, t] = zerlege(datum);
  return new Date(Date.UTC(j, m - 1, t)).getUTCDay();
}

export function jahrVon(datum: Datum): number {
  return Number(datum.slice(0, 4));
}

/** Heutiges Datum im lokalen Kalender des Geräts. */
export function heute(jetzt: Date = new Date()): Datum {
  return datumAus(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate());
}

export function minutenJetzt(jetzt: Date = new Date()): Minuten {
  return jetzt.getHours() * 60 + jetzt.getMinutes();
}

/** Alle Tage von `von` bis `bis` einschließlich. */
export function* tageVonBis(von: Datum, bis: Datum): Generator<Datum> {
  for (let d = von; d <= bis; d = plusTage(d, 1)) yield d;
}

/** „08:46“ → 526. Ungültige Eingaben ergeben null. */
export function parseUhrzeit(text: string | null | undefined): Minuten | null {
  if (!text) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 526 → „08:46“ (Uhrzeit, nach Mitternacht wieder ab 00:00). */
export function uhrzeit(min: Minuten): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${zwei(Math.floor(m / 60))}:${zwei(m % 60)}`;
}

/** Dauer als h:mm, z. B. 526 → „8:46“, mit Vorzeichen „+0:13“ bzw. „−0:09“. */
export function dauer(min: Minuten, mitVorzeichen = false): string {
  const a = Math.abs(min);
  const text = `${Math.floor(a / 60)}:${zwei(a % 60)}`;
  if (min < 0) return MINUS + text;
  if (mitVorzeichen && min > 0) return '+' + text;
  return text;
}

/** „2026-08-31“ → „31.08.2026“ */
export function datumDE(datum: Datum): string {
  const [j, m, t] = zerlege(datum);
  return `${zwei(t)}.${zwei(m)}.${j}`;
}

export const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
