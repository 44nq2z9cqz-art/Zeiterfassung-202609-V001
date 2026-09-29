// Lokale Datenbank (IndexedDB über Dexie), Konzept F.
import Dexie, { type Table } from 'dexie';
import type { Buchung, Einstellungen, Tag, Urlaubsantrag } from '../core/modell';
import type { Sicherung } from '../core/sicherungen';

export interface MetaEintrag {
  schluessel: string;
  wert: unknown;
}

export class ZeitDB extends Dexie {
  tage!: Table<Tag, string>;
  buchungen!: Table<Buchung, string>;
  meta!: Table<MetaEintrag, string>;
  antraege!: Table<Urlaubsantrag, string>;
  sicherungen!: Table<Sicherung, string>;

  constructor(name = 'zeiterfassung') {
    super(name);
    // Schema-Version 1. Spätere Änderungen bekommen eine neue Version mit Umstellung (upgrade).
    this.version(1).stores({
      tage: 'datum',
      buchungen: 'id, konto, datum',
      meta: 'schluessel'
    });
    // Version 2: Urlaubsanträge
    this.version(2).stores({
      antraege: 'id, von'
    });
    // Version 3: automatische Sicherungen in der App
    this.version(3).stores({
      sicherungen: 'id, grund, datum'
    });
  }
}

export const db = new ZeitDB();

export const META = {
  einstellungen: 'einstellungen',
  sicherungVorImport: 'sicherung-vor-import',
  letzterImport: 'letzter-import',
  letztesBackup: 'letztes-backup',
  umstellungen: 'umstellungen',
  letzteWiederherstellung: 'letzte-wiederherstellung'
} as const;

export async function leseMeta<T>(schluessel: string): Promise<T | undefined> {
  return (await db.meta.get(schluessel))?.wert as T | undefined;
}

export async function schreibeMeta(schluessel: string, wert: unknown): Promise<void> {
  await db.meta.put({ schluessel, wert });
}

/** Der ganze Datenbestand als JSON-fähiges Objekt (Grundlage für Backups und Sicherheitskopien). */
export async function exportiereAlles() {
  return {
    format: 'zeiterfassung-202609',
    schema: 1,
    erstelltAm: new Date().toISOString(),
    tage: await db.tage.toArray(),
    buchungen: await db.buchungen.toArray(),
    antraege: await db.antraege.toArray(),
    einstellungen: await leseMeta<Einstellungen>(META.einstellungen)
  };
}
