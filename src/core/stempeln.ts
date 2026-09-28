// Stempeln am laufenden Tag (Konzept C): Kommen, Pause, Gehen – als reine Funktionen.
// Jede Aktion liefert einen neuen Tag zurück und schreibt das Änderungsprotokoll (Konzept D).
import type { Einstellungen, Tag } from './modell';
import { pausenMinuten, pruefePausenfenster, regelAm, sollMinuten, type Pausenfenster } from './regeln';
import { type Datum, type Minuten, heute as heuteBerechnen, minutenJetzt, plusTage, uhrzeit } from './zeit';

/** Pausen, die kürzer sind, gelten als versehentliches Doppeltippen und werden verworfen. */
export const MINDEST_PAUSE_SEKUNDEN = 60;
/** Ein über Mitternacht offener Tag bleibt höchstens so lange der „laufende“ Tag. */
const MAX_OFFEN_UEBER_MITTERNACHT = 12 * 60;

export interface Zeitpunkt {
  /** Datum des Arbeitstages, zu dem gestempelt wird */
  datum: Datum;
  /** Minuten seit Mitternacht dieses Arbeitstages (über Mitternacht ≥ 1440) */
  minute: Minuten;
  /** Echter Zeitpunkt, sekundengenau */
  iso: string;
}

export function leererTag(datum: Datum): Tag {
  return { datum, art: 'arbeit', kommen: null, gehen: null, pausen: [], arbeitsort: 'buero', protokoll: [] };
}

function protokolliere(tag: Tag, iso: string, feld: string, alt: Minuten | null, neu: Minuten | null): Tag['protokoll'] {
  const text = (m: Minuten | null) => (m === null ? null : uhrzeit(m));
  return [...tag.protokoll, { am: iso, feld, alt: text(alt), neu: text(neu) }];
}

/**
 * Welcher Tag gerade läuft: normalerweise heute. Ist gestern noch offen (Kommen ohne Gehen)
 * und liegt das nicht länger als 12 Stunden nach Mitternacht, läuft der gestrige Tag weiter.
 */
export function laufenderTag(tage: Map<Datum, Tag>, jetzt: Date = new Date()): { datum: Datum; minute: Minuten } {
  const heute = heuteBerechnen(jetzt);
  const min = minutenJetzt(jetzt);
  const gestern = tage.get(plusTage(heute, -1));
  const heuteTag = tage.get(heute);
  const heuteBegonnen = heuteTag?.kommen !== null && heuteTag?.kommen !== undefined;
  if (!heuteBegonnen && gestern && gestern.art === 'arbeit' && gestern.kommen !== null && gestern.gehen === null && min <= MAX_OFFEN_UEBER_MITTERNACHT) {
    return { datum: gestern.datum, minute: min + 1440 };
  }
  return { datum: heute, minute: min };
}

export function kommen(tag: Tag | undefined, z: Zeitpunkt): Tag {
  const t = tag ?? leererTag(z.datum);
  if (t.kommen !== null) return t;
  return { ...t, art: 'arbeit', kommen: z.minute, kommenQuelle: 'live', protokoll: protokolliere(t, z.iso, 'kommen', null, z.minute) };
}

export function laufendePause(tag: Tag | undefined) {
  return tag?.pausen.find((p) => p.ende === null) ?? null;
}

export function pauseStarten(tag: Tag, z: Zeitpunkt): Tag {
  if (tag.kommen === null || tag.gehen !== null || laufendePause(tag)) return tag;
  const pause = { id: crypto.randomUUID(), beginn: z.minute, ende: null, quelle: 'live' as const, gestartetAm: z.iso };
  return { ...tag, pausen: [...tag.pausen, pause], protokoll: protokolliere(tag, z.iso, 'pause beginn', null, z.minute) };
}

export interface PausenEnde {
  tag: Tag;
  /** true, wenn die Pause wegen Doppeltippens verworfen wurde */
  verworfen: boolean;
}

export function pauseBeenden(tag: Tag, z: Zeitpunkt): PausenEnde {
  const offen = laufendePause(tag);
  if (!offen) return { tag, verworfen: false };
  const sekunden = offen.gestartetAm ? (Date.parse(z.iso) - Date.parse(offen.gestartetAm)) / 1000 : Infinity;
  if (sekunden < MINDEST_PAUSE_SEKUNDEN) {
    return {
      tag: { ...tag, pausen: tag.pausen.filter((p) => p.id !== offen.id), protokoll: protokolliere(tag, z.iso, 'pause verworfen', offen.beginn, null) },
      verworfen: true
    };
  }
  const ende = Math.max(z.minute, offen.beginn);
  return {
    tag: {
      ...tag,
      pausen: tag.pausen.map((p) => (p.id === offen.id ? { ...p, ende } : p)),
      protokoll: protokolliere(tag, z.iso, 'pause ende', null, ende)
    },
    verworfen: false
  };
}

/** Gehen beendet auch eine laufende Pause. */
export function gehen(tag: Tag, z: Zeitpunkt): Tag {
  if (tag.kommen === null || tag.gehen !== null) return tag;
  const ohnePause = pauseBeenden(tag, z).tag;
  const ende = Math.max(z.minute, tag.kommen);
  return { ...ohnePause, gehen: ende, gehenQuelle: 'live', protokoll: protokolliere(ohnePause, z.iso, 'gehen', null, ende) };
}

/** Versehentliches Gehen zurücknehmen: der Tag läuft weiter. */
export function fortsetzen(tag: Tag, z: Zeitpunkt): Tag {
  if (tag.gehen === null) return tag;
  return { ...tag, gehen: null, gehenQuelle: undefined, protokoll: protokolliere(tag, z.iso, 'gehen', tag.gehen, null) };
}

export interface LiveStand {
  soll: Minuten;
  /** Arbeitszeit bis jetzt bzw. bis Gehen */
  ist: Minuten;
  pausen: Minuten;
  /** Pausenfenster bis jetzt; null, wenn heute keine Pausenregel gilt */
  fenster: Pausenfenster | null;
  /** Saldo des Tages, wenn jetzt gegangen würde (inkl. absehbarem Zuschlag) */
  saldo: Minuten;
  /** Minuten ohne Pause seit Kommen bzw. seit der letzten Pause */
  ohnePause: Minuten;
}

/** Stand des laufenden Tages zur Minute `jetzt`. */
export function liveStand(datum: Datum, tag: Tag | undefined, e: Einstellungen, jetzt: Minuten): LiveStand | null {
  if (!tag || tag.art !== 'arbeit' || tag.kommen === null) return null;
  const bis = tag.gehen ?? Math.max(jetzt, tag.kommen);
  const offen = tag.pausen.map((p) => (p.ende === null ? { ...p, ende: Math.max(bis, p.beginn) } : p));
  const pausen = pausenMinuten(offen, tag.kommen, bis);
  const ist = bis - tag.kommen - pausen;
  const soll = sollMinuten(datum, tag, e);
  const regel = regelAm(datum, soll, e);
  const fenster = regel ? pruefePausenfenster(offen, tag.kommen, bis, regel) : null;
  const zuschlag = fenster?.zuschlag ?? 0;
  const laufend = laufendePause(tag);
  const letztesEnde = Math.max(tag.kommen, ...tag.pausen.filter((p) => p.ende !== null).map((p) => p.ende as number));
  const ohnePause = laufend || tag.gehen !== null ? 0 : Math.max(0, bis - letztesEnde);
  return { soll, ist, pausen, fenster, saldo: ist - zuschlag - soll, ohnePause };
}

/** Pausenregel, die heute gilt – für die Anzeige des Fensters auch vor dem ersten Stempeln. */
export function regelHeute(datum: Datum, tag: Tag | undefined, e: Einstellungen) {
  return regelAm(datum, sollMinuten(datum, tag, e), e);
}
