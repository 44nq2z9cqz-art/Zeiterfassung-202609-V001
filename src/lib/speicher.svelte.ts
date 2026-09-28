// Zustand der App im Speicher, geladen aus IndexedDB.
import { standardEinstellungen } from '../core/einstellungen';
import type { Pruefbericht } from '../core/import-altapp';
import type { Buchung, Datenbestand, Einstellungen, Tag } from '../core/modell';
import { type Datum, heute } from '../core/zeit';
import { META, db, exportiereAlles, leseMeta, schreibeMeta } from './db';

class Speicher {
  geladen = $state(false);
  fehler = $state<string | null>(null);
  tage = $state.raw(new Map<Datum, Tag>());
  buchungen = $state.raw<Buchung[]>([]);
  einstellungen = $state.raw<Einstellungen>(standardEinstellungen(heute()));
  dauerhaft = $state<boolean | null>(null);

  get daten(): Datenbestand {
    return { tage: this.tage, buchungen: this.buchungen, einstellungen: this.einstellungen };
  }

  get hatDaten(): boolean {
    return this.tage.size > 0 || this.buchungen.length > 0;
  }

  async laden() {
    try {
      const [tage, buchungen, einstellungen] = await Promise.all([
        db.tage.toArray(),
        db.buchungen.toArray(),
        leseMeta<Einstellungen>(META.einstellungen)
      ]);
      this.tage = new Map(tage.sort((a, b) => a.datum.localeCompare(b.datum)).map((t) => [t.datum, t]));
      this.buchungen = buchungen;
      if (einstellungen) {
        this.einstellungen = einstellungen;
      } else {
        await schreibeMeta(META.einstellungen, this.einstellungen);
      }
      this.geladen = true;
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e);
    }
    this.speicherSichern();
  }

  /** iOS bitten, die Daten dauerhaft zu behalten (Konzept F). */
  private async speicherSichern() {
    try {
      if (!navigator.storage?.persist) return;
      this.dauerhaft = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch {
      this.dauerhaft = null;
    }
  }

  /** Ersetzt alle Daten durch den Import. Vorher wird eine Sicherheitskopie angelegt. */
  async importieren(daten: Datenbestand, bericht: Pruefbericht) {
    const kopie = await exportiereAlles();
    await db.transaction('rw', db.tage, db.buchungen, db.meta, async () => {
      await db.meta.put({ schluessel: META.sicherungVorImport, wert: kopie });
      await db.tage.clear();
      await db.buchungen.clear();
      await db.tage.bulkPut([...daten.tage.values()]);
      await db.buchungen.bulkPut(daten.buchungen);
      await db.meta.put({ schluessel: META.einstellungen, wert: daten.einstellungen });
      await db.meta.put({ schluessel: META.letzterImport, wert: { am: new Date().toISOString(), bericht } });
    });
    await this.laden();
  }
}

export const speicher = new Speicher();
