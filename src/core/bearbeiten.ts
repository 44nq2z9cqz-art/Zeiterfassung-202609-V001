// Nachträgliches Bearbeiten eines Tages (Konzept C „Tag bearbeiten“).
// Alle Funktionen liefern einen neuen Tag und schreiben das Änderungsprotokoll (Konzept D).
import type { Arbeitsort, Pause, Tag, Tagesart } from './modell';
import { urlaubstagWert } from './regeln';
import { leererTag } from './stempeln';
import { type Datum, type Minuten, tageVonBis, uhrzeit } from './zeit';

export type Ergebnis = { tag: Tag; fehler?: undefined } | { tag?: undefined; fehler: string };

function eintrag(tag: Tag, am: string, feld: string, alt: string | null, neu: string | null): Tag['protokoll'] {
  if (alt === neu) return tag.protokoll;
  return [...tag.protokoll, { am, feld, alt, neu }];
}

const zeit = (m: Minuten | null | undefined) => (m === null || m === undefined ? null : uhrzeit(m));

/** Gehen vor Kommen bedeutet: über Mitternacht gearbeitet. */
function nachKommen(kommen: Minuten | null, m: Minuten): Minuten {
  return kommen !== null && m < kommen ? m + 1440 : m;
}

export function setzeKommen(tag: Tag, minute: Minuten | null, am: string): Ergebnis {
  if (minute !== null && tag.gehen !== null && minute >= tag.gehen && tag.gehen < 1440) {
    return { fehler: 'Kommen muss vor Gehen liegen.' };
  }
  return {
    tag: {
      ...tag,
      kommen: minute,
      kommenQuelle: minute === null ? undefined : 'manuell',
      // von Hand geändert: kein sekundengenauer Zeitpunkt mehr
      kommenAm: undefined,
      protokoll: eintrag(tag, am, 'kommen', zeit(tag.kommen), zeit(minute))
    }
  };
}

export function setzeGehen(tag: Tag, minute: Minuten | null, am: string): Ergebnis {
  if (minute !== null && tag.kommen === null) return { fehler: 'Bitte zuerst die Kommen-Zeit eintragen.' };
  const gehen = minute === null ? null : nachKommen(tag.kommen, minute);
  if (gehen !== null && gehen === tag.kommen) return { fehler: 'Gehen muss nach Kommen liegen.' };
  return {
    tag: {
      ...tag,
      gehen,
      gehenQuelle: gehen === null ? undefined : 'manuell',
      protokoll: eintrag(tag, am, 'gehen', zeit(tag.gehen), zeit(gehen))
    }
  };
}

/** Neue Pause (id = null) oder bestehende ändern. Zeiten als Uhrzeit des Tages. */
export function setzePause(tag: Tag, id: string | null, beginn: Minuten, ende: Minuten, am: string): Ergebnis {
  if (tag.kommen === null) return { fehler: 'Bitte zuerst die Kommen-Zeit eintragen.' };
  const b = nachKommen(tag.kommen, beginn);
  let e = nachKommen(tag.kommen, ende);
  if (e < b) e += 1440;
  if (e === b) return { fehler: 'Das Pausenende muss nach dem Beginn liegen.' };
  if (b < tag.kommen || (tag.gehen !== null && e > tag.gehen)) {
    return { fehler: `Die Pause muss zwischen Kommen (${uhrzeit(tag.kommen)})${tag.gehen !== null ? ` und Gehen (${uhrzeit(tag.gehen)})` : ''} liegen.` };
  }
  const andere = tag.pausen.filter((p) => p.id !== id);
  const ueberschneidung = andere.find((p) => b < (p.ende ?? Infinity) && e > p.beginn);
  if (ueberschneidung) {
    return { fehler: `Die Pause überschneidet sich mit ${uhrzeit(ueberschneidung.beginn)}–${ueberschneidung.ende === null ? 'jetzt' : uhrzeit(ueberschneidung.ende)}.` };
  }
  const alt = id ? tag.pausen.find((p) => p.id === id) : undefined;
  const pause: Pause = { id: id ?? crypto.randomUUID(), beginn: b, ende: e, quelle: 'manuell' };
  const pausen = [...andere, pause].sort((x, y) => x.beginn - y.beginn);
  const text = (p?: Pause) => (p ? `${uhrzeit(p.beginn)}–${p.ende === null ? '…' : uhrzeit(p.ende)}` : null);
  return { tag: { ...tag, pausen, protokoll: eintrag(tag, am, 'pause', text(alt), text(pause)) } };
}

export function loeschePause(tag: Tag, id: string, am: string): Tag {
  const p = tag.pausen.find((x) => x.id === id);
  if (!p) return tag;
  return {
    ...tag,
    pausen: tag.pausen.filter((x) => x.id !== id),
    protokoll: eintrag(tag, am, 'pause', `${uhrzeit(p.beginn)}–${p.ende === null ? '…' : uhrzeit(p.ende)}`, null)
  };
}

export const ARTEN: Record<Tagesart, string> = { arbeit: 'Arbeit', urlaub: 'Urlaub', krank: 'Krank', gleittag: 'Gleittag' };
export const ORTE: Record<Arbeitsort, string> = { buero: 'Büro', homeoffice: 'Homeoffice', ausser_haus: 'Außer Haus' };

export function setzeArt(tag: Tag, art: Tagesart, am: string): Tag {
  return { ...tag, art, protokoll: eintrag(tag, am, 'tagesart', ARTEN[tag.art], ARTEN[art]) };
}

export function setzeArbeitsort(tag: Tag, ort: Arbeitsort, anlass: string, am: string): Tag {
  const a = anlass.trim() || undefined;
  let protokoll = eintrag(tag, am, 'arbeitsort', ORTE[tag.arbeitsort], ORTE[ort]);
  protokoll = eintrag({ ...tag, protokoll }, am, 'anlass', tag.anlass ?? null, a ?? null);
  return { ...tag, arbeitsort: ort, anlass: a, protokoll };
}

export function setzeKommentar(tag: Tag, kommentar: string, am: string): Tag {
  const k = kommentar.trim() || undefined;
  return { ...tag, kommentar: k, protokoll: eintrag(tag, am, 'kommentar', tag.kommentar ?? null, k ?? null) };
}

export function setzeSoll(tag: Tag, soll: Minuten | null, am: string): Tag {
  const neu = { ...tag, protokoll: eintrag(tag, am, 'soll', zeit(tag.sollAbweichung), zeit(soll)) };
  if (soll === null) delete neu.sollAbweichung;
  else neu.sollAbweichung = soll;
  return neu;
}

/** Ob ein Tag nach dem Bearbeiten leer ist und gelöscht werden kann. */
export function istLeer(tag: Tag): boolean {
  return tag.art === 'arbeit' && tag.kommen === null && tag.gehen === null && tag.pausen.length === 0 && !tag.kommentar && !tag.anlass && tag.sollAbweichung === undefined && tag.arbeitsort === 'buero';
}

export interface Zeitraumergebnis {
  geaendert: Tag[];
  /** Tage mit gestempelter Arbeit, die nicht überschrieben wurden */
  uebersprungen: Datum[];
  /** Tage ohne Urlaubswert (Wochenende, Feiertag) */
  frei: number;
  /** Tage, die schon so eingetragen sind */
  bereits: number;
  /** Tage mit anderer Tagesart (Gleittag, Krank bzw. Urlaub), die unverändert bleiben */
  andereArt: Datum[];
  /** Nur beim Entfernen: Tage, die danach leer sind und gelöscht werden */
  geloescht: Datum[];
}

/**
 * Urlaub oder Krankheit für einen Zeitraum eintragen (z. B. 02.–13.11.),
 * oder mit „entfernen“ Urlaub und Krankheit im Zeitraum wieder zurücknehmen.
 */
export function zeitraumSetzen(
  tage: Map<Datum, Tag>,
  von: Datum,
  bis: Datum,
  art: 'urlaub' | 'krank' | 'entfernen',
  am: string
): Zeitraumergebnis {
  const ergebnis: Zeitraumergebnis = { geaendert: [], uebersprungen: [], frei: 0, bereits: 0, andereArt: [], geloescht: [] };
  if (art === 'entfernen') {
    for (const d of tageVonBis(von, bis)) {
      const vorhanden = tage.get(d);
      if (!vorhanden || (vorhanden.art !== 'urlaub' && vorhanden.art !== 'krank')) continue;
      const zurueck = setzeArt(vorhanden, 'arbeit', am);
      if (istLeer(zurueck)) ergebnis.geloescht.push(d);
      else ergebnis.geaendert.push(zurueck);
    }
    return ergebnis;
  }
  for (const d of tageVonBis(von, bis)) {
    if (urlaubstagWert(d) === 0) {
      ergebnis.frei++;
      continue;
    }
    const vorhanden = tage.get(d);
    if (vorhanden && vorhanden.kommen !== null) {
      ergebnis.uebersprungen.push(d);
      continue;
    }
    if (vorhanden?.art === art) {
      ergebnis.bereits++;
      continue;
    }
    // Eine andere Tagesart (z. B. Gleittag) wird nie stillschweigend überschrieben
    if (vorhanden && vorhanden.art !== 'arbeit') {
      ergebnis.andereArt.push(vorhanden.datum);
      continue;
    }
    ergebnis.geaendert.push(setzeArt(vorhanden ?? leererTag(d), art, am));
  }
  return ergebnis;
}
