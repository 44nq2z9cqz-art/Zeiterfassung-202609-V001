// Datenmodell der App (Konzept B, C, D).
import type { Datum, Minuten } from './zeit';

export type Tagesart = 'arbeit' | 'urlaub' | 'krank' | 'gleittag';
export type Arbeitsort = 'buero' | 'homeoffice' | 'ausser_haus';
/** Wie eine Zeit erfasst wurde – für den Tagesnachweis (Konzept D). */
export type Quelle = 'live' | 'manuell' | 'import';

export interface Aenderung {
  /** Zeitpunkt der Änderung (ISO) */
  am: string;
  feld: string;
  alt: string | null;
  neu: string | null;
}

export interface Pause {
  id: string;
  beginn: Minuten;
  /** null, solange die Pause läuft */
  ende: Minuten | null;
  quelle: Quelle;
  /** Sekundengenauer Start einer live gestempelten Pause (ISO), für den Schutz vor Doppeltippen */
  gestartetAm?: string;
}

export interface Tag {
  datum: Datum;
  art: Tagesart;
  kommen: Minuten | null;
  gehen: Minuten | null;
  kommenQuelle?: Quelle;
  gehenQuelle?: Quelle;
  pausen: Pause[];
  arbeitsort: Arbeitsort;
  anlass?: string;
  kommentar?: string;
  /** Abweichende Sollzeit nur für diesen Tag */
  sollAbweichung?: Minuten;
  protokoll: Aenderung[];
}

export type Konto = 'zeit' | 'urlaub';
export type Buchungsart =
  | 'vortrag'
  | 'abgleich'
  | 'auszahlung'
  | 'korrektur'
  | 'resturlaub'
  | 'sonderurlaub';

export interface Buchung {
  id: string;
  konto: Konto;
  art: Buchungsart;
  datum: Datum;
  /** Zeitkonto: Minuten (±). Urlaubskonto: Tage (±, auch 0,5). */
  betrag: number;
  kommentar?: string;
  /** Beim Abgleich: Saldo laut Firma und laut App zum Stichtag */
  abgleich?: { firma: Minuten; app: Minuten };
}

/** Ein Wert, der ab einem Datum gilt (Konzept B1: Änderungen wirken nicht rückwirkend). */
export interface Gueltig<T> {
  ab: Datum;
  wert: T;
}

export interface Pausenregel {
  aktiv: boolean;
  fensterBeginn: Minuten;
  fensterEnde: Minuten;
  mindestGesamt: Minuten;
  mindestEinzel: Minuten;
  /** Wochentage, an denen die Regel gilt (1 = Mo … 5 = Fr) */
  wochentage: number[];
}

export interface Hinweise {
  pausenfenster: { aktiv: boolean; uhrzeit: Minuten };
  pauseNach: { aktiv: boolean; minuten: Minuten };
  arbeitsende: { aktiv: boolean; uhrzeit: Minuten };
  backupNachTagen: number;
}

export interface Einstellungen {
  /** Erster Tag, ab dem das Zeitkonto rechnet */
  appStart: Datum;
  /** Sollarbeitszeit pro Woche in Minuten, verteilt auf Mo–Fr */
  wochenstunden: Gueltig<Minuten>[];
  /** Soll am 24.12. und 31.12., wenn Werktag */
  sollHalbtag: Gueltig<Minuten>[];
  pausenregel: Gueltig<Pausenregel>[];
  /** Sockel des Zeitkontos (nur Anzeige, Konzept B3) */
  sockel: Minuten;
  urlaubsanspruch: Gueltig<number>[];
  name: string;
  personalnummer: string;
  hinweise: Hinweise;
  /** Kürzel, das bei genehmigten Urlaubsanträgen erscheint */
  genehmiger?: string;
}

/** Elektronischer Urlaubsantrag (wie der Urlaubsschein der Firma) */
export interface Urlaubsantrag {
  id: string;
  von: Datum;
  bis: Datum;
  /** kurzes Stichwort, z. B. „Brückentag“ */
  sonstiges?: string;
  /** Kürzel der Vertretung */
  vertretung?: string;
  /** Erst genehmigte Anträge stehen als Urlaub im Kalender */
  genehmigt: boolean;
  genehmigtAm?: Datum;
  /** Nachträglich gestrichen – bleibt sichtbar, zählt aber nicht mehr */
  gestrichen?: { am: Datum; grund?: string };
  erstelltAm: string;
}

export interface Datenbestand {
  tage: Map<Datum, Tag>;
  buchungen: Buchung[];
  einstellungen: Einstellungen;
  antraege?: Urlaubsantrag[];
}
