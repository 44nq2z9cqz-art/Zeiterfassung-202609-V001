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
  /** Zeitpunkt des letzten Backups (ISO) */
  letztesBackup = $state<string | undefined>(undefined);

  get daten(): Datenbestand {
    return { tage: this.tage, buchungen: this.buchungen, einstellungen: this.einstellungen };
  }

  get hatDaten(): boolean {
    return this.tage.size > 0 || this.buchungen.length > 0;
  }

  async laden() {
    try {
      const [tage, buchungen, einstellungen, letztesBackup] = await Promise.all([
        db.tage.toArray(),
        db.buchungen.toArray(),
        leseMeta<Einstellungen>(META.einstellungen),
        leseMeta<string>(META.letztesBackup)
      ]);
      this.letztesBackup = letztesBackup;
      this.tage = new Map(tage.sort((a, b) => a.datum.localeCompare(b.datum)).map((t) => [t.datum, t]));
      this.buchungen = buchungen;
      if (einstellungen) {
        this.einstellungen = await this.umstellen(einstellungen);
      } else {
        await schreibeMeta(META.einstellungen, this.einstellungen);
      }
      this.geladen = true;
    } catch (e) {
      this.fehler = e instanceof Error ? e.message : String(e);
    }
    this.speicherSichern();
  }

  /** Einmalige Anpassungen gespeicherter Einstellungen an neue Standardwerte. */
  private async umstellen(e: Einstellungen): Promise<Einstellungen> {
    const erledigt = (await leseMeta<string[]>(META.umstellungen)) ?? [];
    let neu = e;
    // v0.3: Hinweis zum Pausenfenster ab 13:15 statt 13:30
    if (!erledigt.includes('hinweis-1315')) {
      if (neu.hinweise.pausenfenster.uhrzeit === 13 * 60 + 30) {
        neu = { ...neu, hinweise: { ...neu.hinweise, pausenfenster: { ...neu.hinweise.pausenfenster, uhrzeit: 13 * 60 + 15 } } };
        await schreibeMeta(META.einstellungen, neu);
      }
      await schreibeMeta(META.umstellungen, [...erledigt, 'hinweis-1315']);
    }
    // v0.7: Hinweis zur Pausenregel ab 13:00 (Nutzerwunsch), nur wenn noch der alte Standard eingestellt ist
    if (!erledigt.includes('hinweis-1300')) {
      if (neu.hinweise.pausenfenster.uhrzeit === 13 * 60 + 15) {
        neu = { ...neu, hinweise: { ...neu.hinweise, pausenfenster: { ...neu.hinweise.pausenfenster, uhrzeit: 13 * 60 } } };
        await schreibeMeta(META.einstellungen, neu);
      }
      await schreibeMeta(META.umstellungen, [...((await leseMeta<string[]>(META.umstellungen)) ?? []), 'hinweis-1300']);
    }
    return neu;
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

  /** Speichert einen Tag sofort in der Datenbank. */
  async speichereTag(tag: Tag) {
    const neu = new Map(this.tage);
    neu.set(tag.datum, tag);
    this.tage = new Map([...neu.entries()].sort(([a], [b]) => a.localeCompare(b)));
    await db.tage.put($state.snapshot(tag) as Tag);
  }

  /** Speichert mehrere Tage in einem Schritt (z. B. Urlaubszeitraum). */
  async speichereTage(liste: Tag[]) {
    const neu = new Map(this.tage);
    for (const t of liste) neu.set(t.datum, t);
    this.tage = new Map([...neu.entries()].sort(([a], [b]) => a.localeCompare(b)));
    await db.tage.bulkPut(liste.map((t) => $state.snapshot(t) as Tag));
  }

  async speichereEinstellungen(e: Einstellungen) {
    this.einstellungen = e;
    await schreibeMeta(META.einstellungen, $state.snapshot(e));
  }

  async speichereBuchung(b: Buchung) {
    this.buchungen = [...this.buchungen.filter((x) => x.id !== b.id), b];
    await db.buchungen.put($state.snapshot(b) as Buchung);
  }

  async loescheBuchung(id: string) {
    this.buchungen = this.buchungen.filter((x) => x.id !== id);
    await db.buchungen.delete(id);
  }

  async loescheTage(daten: Datum[]) {
    const neu = new Map(this.tage);
    for (const d of daten) neu.delete(d);
    this.tage = neu;
    await db.tage.bulkDelete(daten);
  }

  async loescheTag(datum: Datum) {
    const neu = new Map(this.tage);
    neu.delete(datum);
    this.tage = neu;
    await db.tage.delete(datum);
  }

  /** Merkt sich, dass gerade ein Backup gesichert wurde. */
  async backupGesichert(am = new Date().toISOString()) {
    this.letztesBackup = am;
    await schreibeMeta(META.letztesBackup, am);
  }

  /** Ersetzt alle Daten durch den Import der alten App. Vorher wird eine Sicherheitskopie angelegt. */
  async importieren(daten: Datenbestand, bericht: Pruefbericht) {
    await this.ersetzeAlles(daten, { schluessel: META.letzterImport, wert: { am: new Date().toISOString(), bericht } });
  }

  /** Stellt ein Backup wieder her. Vorher wird eine Sicherheitskopie angelegt. */
  async wiederherstellen(daten: Datenbestand) {
    await this.ersetzeAlles(daten, { schluessel: META.letzteWiederherstellung, wert: new Date().toISOString() });
  }

  private async ersetzeAlles(daten: Datenbestand, vermerk: { schluessel: string; wert: unknown }) {
    const kopie = await exportiereAlles();
    await db.transaction('rw', db.tage, db.buchungen, db.meta, async () => {
      await db.meta.put({ schluessel: META.sicherungVorImport, wert: kopie });
      await db.tage.clear();
      await db.buchungen.clear();
      await db.tage.bulkPut([...daten.tage.values()]);
      await db.buchungen.bulkPut(daten.buchungen);
      await db.meta.put({ schluessel: META.einstellungen, wert: daten.einstellungen });
      await db.meta.put(vermerk);
    });
    await this.laden();
  }
}

export const speicher = new Speicher();
