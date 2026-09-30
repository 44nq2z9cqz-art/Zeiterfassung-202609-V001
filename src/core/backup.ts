// Backup und Wiederherstellung (Konzept A3, F): eine JSON-Datei mit allen Daten und Schema-Version.
import { standardEinstellungen } from './einstellungen';
import type { Buchung, Datenbestand, Einstellungen, Tag, Urlaubsantrag } from './modell';
import { type Datum, heute, jahrVon } from './zeit';

export const BACKUP_FORMAT = 'zeiterfassung-202609';
export const BACKUP_SCHEMA = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schema: number;
  erstelltAm: string;
  appVersion?: string;
  tage: Tag[];
  buchungen: Buchung[];
  /** ab App-Version 0.8 */
  antraege?: Urlaubsantrag[];
  einstellungen: Einstellungen;
}

export function erstelleBackup(daten: Datenbestand, appVersion: string, jetzt = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    schema: BACKUP_SCHEMA,
    erstelltAm: jetzt.toISOString(),
    appVersion,
    tage: [...daten.tage.values()],
    buchungen: daten.buchungen,
    antraege: daten.antraege ?? [],
    einstellungen: daten.einstellungen
  };
}

export function backupDateiname(jetzt = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `zeiterfassung-backup-${jetzt.getFullYear()}-${z(jetzt.getMonth() + 1)}-${z(jetzt.getDate())}-${z(jetzt.getHours())}${z(jetzt.getMinutes())}.json`;
}

export interface Backupvorschau {
  erstelltAm: string;
  appVersion?: string;
  tage: number;
  arbeitstage: number;
  buchungen: number;
  von: Datum | null;
  bis: Datum | null;
}

export type Pruefergebnis =
  | { daten: Datenbestand; vorschau: Backupvorschau; fehler?: undefined; altApp?: undefined }
  | { fehler: string; altApp?: boolean; daten?: undefined; vorschau?: undefined };

const istDatum = (d: unknown): d is Datum => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Prüft eine Backup-Datei gründlich, bevor irgendetwas überschrieben wird. */
export function pruefeBackup(json: unknown): Pruefergebnis {
  const b = json as Partial<Backup> & { app?: string };
  if (!b || typeof b !== 'object') return { fehler: 'Die Datei enthält keine Daten.' };
  if (b.app === 'Zeiterfassung Pro') {
    return { altApp: true, fehler: 'Das ist eine Sicherung der alten App. Bitte über „Daten der alten App importieren“ übernehmen.' };
  }
  if (b.format !== BACKUP_FORMAT) return { fehler: 'Die Datei ist kein Backup dieser Zeiterfassung.' };
  if (typeof b.schema !== 'number' || b.schema > BACKUP_SCHEMA) {
    return { fehler: 'Das Backup stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.' };
  }
  if (!Array.isArray(b.tage) || !Array.isArray(b.buchungen) || !b.einstellungen) return { fehler: 'Das Backup ist unvollständig.' };

  const tage = b.tage.filter((t) => t && istDatum(t.datum) && Array.isArray(t.pausen));
  if (tage.length !== b.tage.length) return { fehler: `${b.tage.length - tage.length} Tage im Backup sind beschädigt. Es wurde nichts verändert.` };
  const buchungen = b.buchungen.filter((x) => x && typeof x.id === 'string' && istDatum(x.datum) && typeof x.betrag === 'number');
  if (buchungen.length !== b.buchungen.length) return { fehler: 'Einige Buchungen im Backup sind beschädigt. Es wurde nichts verändert.' };

  // Fehlende Felder späterer Versionen mit Standardwerten ergänzen
  const standard = standardEinstellungen(b.einstellungen.appStart ?? tage[0]?.datum ?? `${jahrVon(new Date().toISOString().slice(0, 10))}-01-01`);
  const einstellungen: Einstellungen = { ...standard, ...b.einstellungen, hinweise: { ...standard.hinweise, ...b.einstellungen.hinweise } };

  const sortiert = [...tage].sort((a, x) => a.datum.localeCompare(x.datum));
  return {
    daten: { tage: new Map(sortiert.map((t) => [t.datum, t])), buchungen, einstellungen, antraege: Array.isArray(b.antraege) ? b.antraege.filter((a) => a && typeof a.id === 'string' && istDatum(a.von) && istDatum(a.bis)) : [] },
    vorschau: {
      erstelltAm: b.erstelltAm ?? '',
      appVersion: b.appVersion,
      tage: tage.length,
      arbeitstage: tage.filter((t) => t.kommen !== null && t.gehen !== null).length,
      buchungen: buchungen.length,
      von: sortiert[0]?.datum ?? null,
      bis: sortiert.at(-1)?.datum ?? null
    }
  };
}

/** Kalendertage seit dem letzten Backup (null = noch nie gesichert). Gestern 18 Uhr zählt heute früh als „gestern“. */
export function tageSeitBackup(letztesBackup: string | undefined, jetzt = new Date()): number | null {
  if (!letztesBackup) return null;
  const tag = (d: Date) => Date.parse(heute(d) + 'T00:00:00Z');
  return Math.round((tag(jetzt) - tag(new Date(letztesBackup))) / 86_400_000);
}
