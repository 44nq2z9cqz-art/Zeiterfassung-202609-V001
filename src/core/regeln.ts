// Tagesbewertung: Soll, Ist, Pausenregel und Tagessaldo (Konzept B1, B2, B5).
import { gueltigAm } from './einstellungen';
import { feiertag } from './feiertage';
import type { Einstellungen, Pause, Pausenregel, Tag } from './modell';
import { type Datum, type Minuten, wochentag } from './zeit';

export type Tagesstatus =
  | 'arbeit'
  | 'urlaub'
  | 'krank'
  | 'gleittag'
  /** vergangener Werktag ohne Eintrag: zählt −Soll (Konzept B1) */
  | 'ohneEintrag'
  /** vergangener Tag mit Kommen, aber ohne Gehen: zählt −Soll, wird markiert */
  | 'unvollstaendig'
  /** heutiger Tag, noch nicht abgeschlossen */
  | 'offen'
  /** vergangener Tag ohne Soll und ohne Arbeit */
  | 'frei'
  | 'zukunft';

export interface Pausenfenster {
  /** Pausenminuten innerhalb des Fensters */
  imFenster: Minuten;
  /** längste einzelne Pause innerhalb des Fensters */
  laengste: Minuten;
  fehlendGesamt: Minuten;
  fehlendEinzel: Minuten;
  /** true, wenn die Anwesenheit das ganze Fenster abdeckt und die Regel damit greift */
  greift: boolean;
  /** Abzug in Minuten (0, wenn erfüllt oder die Regel nicht greift) */
  zuschlag: Minuten;
}

export interface Tagesergebnis {
  datum: Datum;
  soll: Minuten;
  ist: Minuten | null;
  pausen: Minuten;
  zuschlag: Minuten;
  /** Veränderung des Zeitkontos durch diesen Tag */
  saldo: Minuten;
  status: Tagesstatus;
  feiertag: string | null;
  fenster: Pausenfenster | null;
  /** Gesetzliche Pause ab 9 Stunden (nur an Arbeitstagen mit Kommen und Gehen) */
  gesetz?: GesetzPause;
  /** Urlaubstage, die dieser Tag verbraucht (0, 0,5 oder 1) */
  urlaubstage: number;
}

function istHalbtag(datum: Datum): boolean {
  const md = datum.slice(5);
  return md === '12-24' || md === '12-31';
}

function istWerktag(datum: Datum): boolean {
  const wt = wochentag(datum);
  return wt >= 1 && wt <= 5 && !feiertag(datum);
}

/** Sollzeit eines Tages ohne Berücksichtigung der Tagesart. */
export function sollMinuten(datum: Datum, tag: Tag | undefined, e: Einstellungen): Minuten {
  if (tag?.sollAbweichung !== undefined && tag.sollAbweichung !== null) return tag.sollAbweichung;
  if (!istWerktag(datum)) return 0;
  if (istHalbtag(datum)) return gueltigAm(e.sollHalbtag, datum);
  return Math.round(gueltigAm(e.wochenstunden, datum) / 5);
}

/** Urlaubstage, die ein Urlaub an diesem Datum verbraucht (Konzept B4). */
export function urlaubstagWert(datum: Datum): number {
  if (!istWerktag(datum)) return 0;
  return istHalbtag(datum) ? 0.5 : 1;
}

/** Abgeschlossene Pausen, auf die Anwesenheit [kommen, gehen] begrenzt. */
export function pausenMinuten(pausen: Pause[], kommen: Minuten, gehen: Minuten): Minuten {
  let summe = 0;
  for (const p of pausen) {
    if (p.ende === null) continue;
    const b = Math.max(p.beginn, kommen);
    const e = Math.min(p.ende, gehen);
    if (e > b) summe += e - b;
  }
  return summe;
}

/**
 * Prüft die Pausenregel (Konzept B2).
 * `bis` ist das Arbeitsende oder – bei einem laufenden Tag – die aktuelle Uhrzeit.
 */
export function pruefePausenfenster(
  pausen: Pause[],
  kommen: Minuten,
  bis: Minuten,
  regel: Pausenregel,
  jetzt?: Minuten
): Pausenfenster {
  let imFenster = 0;
  let laengste = 0;
  for (const p of pausen) {
    const ende = p.ende ?? jetzt ?? null;
    if (ende === null) continue;
    const ueberlappung = Math.max(0, Math.min(ende, regel.fensterEnde) - Math.max(p.beginn, regel.fensterBeginn));
    imFenster += ueberlappung;
    laengste = Math.max(laengste, ueberlappung);
  }
  const fehlendGesamt = Math.max(0, regel.mindestGesamt - imFenster);
  const fehlendEinzel = Math.max(0, regel.mindestEinzel - laengste);
  const greift = kommen <= regel.fensterBeginn && bis >= regel.fensterEnde;
  const zuschlag = greift ? Math.max(fehlendGesamt, fehlendEinzel) : 0;
  return { imFenster, laengste, fehlendGesamt, fehlendEinzel, greift, zuschlag };
}

// ─── Gesetzliche Pause ab 9 Stunden (§ 4 ArbZG) ─────────────────────────

export const GESETZ_AB: Minuten = 9 * 60;
export const GESETZ_PAUSE: Minuten = 45;

export interface GesetzPause {
  /** Arbeitszeit ab 9 Stunden erreicht (nach Abzug der Pausenregel) */
  erreicht: boolean;
  /** zählende Pause: alle Pausen des Tages plus Zuschlag der Pausenregel */
  pause: Minuten;
  fehlend: Minuten;
  /** Abzug, höchstens bis die Arbeitszeit wieder bei 9 Stunden liegt; 0 wenn der Zuschlag ausgeschaltet ist */
  zuschlag: Minuten;
}

/** Ist der Zuschlag für die gesetzliche Pause an diesem Tag eingeschaltet? */
export function gesetzAktiv(datum: Datum, e: Einstellungen): boolean {
  return !!e.pausenGesetz?.length && gueltigAm(e.pausenGesetz, datum);
}

/**
 * Gesetzliche Mindestpause: Bei mehr als 9 Stunden Arbeitszeit sind 45 Minuten Pause nötig.
 * Gezählt werden alle Pausen zusammen – so rechnet nach dem Abgleich mit dem Firmenjournal August auch das
 * Firmensystem (Tage mit über 9 Std. und vielen kurzen Pausen blieben dort ohne Abzug).
 * Der Zuschlag der Pausenregel 11–14 Uhr zählt dabei schon als Pause. Fehlt Pause, wird die
 * Arbeitszeit gekürzt – aber nie unter 9 Stunden (wie die übliche Pausenautomatik).
 */
export function pruefeGesetzPause(pausen: Pause[], kommen: Minuten, bis: Minuten, fensterZuschlag: Minuten, aktiv: boolean, jetzt?: Minuten): GesetzPause {
  let alle = 0;
  for (const p of pausen) {
    const ende = p.ende ?? jetzt ?? null;
    if (ende === null) continue;
    const laenge = Math.max(0, Math.min(ende, bis) - Math.max(p.beginn, kommen));
    alle += laenge;
  }
  const ist = bis - kommen - alle - fensterZuschlag;
  const pause = alle + fensterZuschlag;
  const fehlend = Math.max(0, GESETZ_PAUSE - pause);
  const erreicht = ist >= GESETZ_AB;
  const zuschlag = aktiv && ist > GESETZ_AB ? Math.min(fehlend, ist - GESETZ_AB) : 0;
  return { erreicht, pause, fehlend, zuschlag };
}

/** Die an diesem Tag anzuwendende Pausenregel oder null, wenn keine gilt. */
export function regelAm(datum: Datum, soll: Minuten, e: Einstellungen): Pausenregel | null {
  const regel = gueltigAm(e.pausenregel, datum);
  if (!regel.aktiv || soll === 0) return null;
  if (!regel.wochentage.includes(wochentag(datum))) return null;
  return regel;
}

export function bewerteTag(datum: Datum, tag: Tag | undefined, e: Einstellungen, heuteDatum: Datum): Tagesergebnis {
  const soll = sollMinuten(datum, tag, e);
  const basis: Tagesergebnis = {
    datum,
    soll,
    ist: null,
    pausen: 0,
    zuschlag: 0,
    saldo: 0,
    status: 'frei',
    feiertag: feiertag(datum),
    fenster: null,
    urlaubstage: 0
  };

  if (tag?.art === 'urlaub') return { ...basis, status: 'urlaub', urlaubstage: urlaubstagWert(datum) };
  if (tag?.art === 'krank') return { ...basis, status: 'krank' };
  if (tag?.art === 'gleittag') return { ...basis, status: 'gleittag', saldo: -soll };

  if (tag && tag.kommen !== null && tag.gehen !== null && tag.gehen > tag.kommen) {
    const pausen = pausenMinuten(tag.pausen, tag.kommen, tag.gehen);
    const ist = tag.gehen - tag.kommen - pausen;
    const regel = regelAm(datum, soll, e);
    const fenster = regel ? pruefePausenfenster(tag.pausen, tag.kommen, tag.gehen, regel) : null;
    const gesetz = pruefeGesetzPause(tag.pausen, tag.kommen, tag.gehen, fenster?.zuschlag ?? 0, gesetzAktiv(datum, e));
    const zuschlag = (fenster?.zuschlag ?? 0) + gesetz.zuschlag;
    return { ...basis, status: 'arbeit', ist, pausen, fenster, gesetz, zuschlag, saldo: ist - zuschlag - soll };
  }

  if (datum > heuteDatum) return { ...basis, status: 'zukunft' };
  if (datum === heuteDatum) return { ...basis, status: 'offen' };
  if (tag && tag.kommen !== null) return { ...basis, status: 'unvollstaendig', saldo: -soll };
  return { ...basis, status: soll > 0 ? 'ohneEintrag' : 'frei', saldo: -soll };
}
