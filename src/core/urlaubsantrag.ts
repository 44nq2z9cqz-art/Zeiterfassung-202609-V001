// Elektronischer Urlaubsantrag: geplant → beantragt → genehmigt (erst dann im Kalender) → ggf. gestrichen.
import { zeitraumSetzen } from './bearbeiten';
import { urlaubskonto, urlaubszeitraeume } from './konten';
import type { Datenbestand, Tag, Urlaubsantrag } from './modell';
import { urlaubstagWert } from './regeln';
import { type Datum, datumDE, jahrVon, tageVonBis } from './zeit';

export type Antragsstatus = 'geplant' | 'beantragt' | 'genehmigt' | 'gestrichen';

export function antragsstatus(a: Urlaubsantrag): Antragsstatus {
  if (a.gestrichen) return 'gestrichen';
  if (a.genehmigt) return 'genehmigt';
  return a.plan ? 'geplant' : 'beantragt';
}

/** Urlaubstage eines Zeitraums: ohne Wochenenden und Feiertage, 24.12./31.12. je ½. */
export function antragTage(von: Datum, bis: Datum): number {
  if (!von || !bis || von > bis) return 0;
  let summe = 0;
  for (const d of tageVonBis(von, bis)) summe += urlaubstagWert(d);
  return summe;
}

const zaehlt = (a: Urlaubsantrag) => !a.gestrichen;

export interface Antragszeile {
  antrag: Urlaubsantrag;
  status: Antragsstatus;
  tage: number;
  /** Anspruch vor diesem Antrag */
  anspruch: number;
  /** Rest nach diesem Antrag */
  rest: number;
}

/** Der Anspruch eines Jahres wie im Kopf des Urlaubsscheins. */
export function anspruch(daten: Datenbestand, jahr: number, heute: Datum) {
  const k = urlaubskonto(daten, jahr, heute);
  const buchungen = daten.buchungen.filter((b) => b.konto === 'urlaub' && jahrVon(b.datum) === jahr);
  const resturlaub = k.uebertrag + buchungen.filter((b) => b.art === 'resturlaub').reduce((s, b) => s + b.betrag, 0);
  const sonder = buchungen.filter((b) => b.art !== 'resturlaub').reduce((s, b) => s + b.betrag, 0);
  return { resturlaub, jahresurlaub: k.jahresanspruch, sonderurlaub: sonder, gesamt: k.gesamt };
}

/** Alle Anträge eines Jahres in zeitlicher Reihenfolge mit laufender Rechnung wie im Urlaubsschein. */
export function antragsliste(daten: Datenbestand, jahr: number, heute: Datum): Antragszeile[] {
  let rest = anspruch(daten, jahr, heute).gesamt;
  return (daten.antraege ?? [])
    .filter((a) => jahrVon(a.von) === jahr)
    .sort((a, b) => a.von.localeCompare(b.von) || a.erstelltAm.localeCompare(b.erstelltAm))
    .map((antrag) => {
      const tage = antragTage(antrag.von, antrag.bis);
      const vorher = rest;
      if (zaehlt(antrag)) rest -= tage;
      return { antrag, status: antragsstatus(antrag), tage, anspruch: vorher, rest };
    });
}

/** Geplante oder beantragte, noch nicht genehmigte Tage eines Jahres (stehen noch nicht im Kalender). */
export function offeneTage(daten: Datenbestand, jahr: number, status: 'beantragt' | 'geplant' = 'beantragt'): number {
  return (daten.antraege ?? [])
    .filter((a) => jahrVon(a.von) === jahr && antragsstatus(a) === status)
    .reduce((s, a) => s + antragTage(a.von, a.bis), 0);
}

/** Prüft einen Antrag vor dem Speichern. */
export function pruefeAntrag(a: Urlaubsantrag, alle: Urlaubsantrag[]): string | null {
  if (!a.von || !a.bis) return 'Bitte Von und Bis wählen.';
  if (a.von > a.bis) return 'Das Enddatum muss am oder nach dem Beginn liegen.';
  if (jahrVon(a.von) !== jahrVon(a.bis)) return 'Bitte über den Jahreswechsel zwei Anträge anlegen, je einen pro Jahr.';
  if (antragTage(a.von, a.bis) === 0) return 'Im Zeitraum liegt kein Arbeitstag.';
  const ueberschneidung = alle.find((b) => b.id !== a.id && !b.gestrichen && b.von <= a.bis && a.von <= b.bis);
  if (ueberschneidung) return `Der Zeitraum überschneidet sich mit dem Antrag ${datumDE(ueberschneidung.von)} – ${datumDE(ueberschneidung.bis)}.`;
  return null;
}

export interface Kalenderaenderung {
  speichern: Tag[];
  loeschen: Datum[];
}

/**
 * Welche Kalendertage sich ändern, wenn ein Antrag von `alt` auf `neu` wechselt.
 * Nur genehmigte, nicht gestrichene Anträge stehen als Urlaub im Kalender.
 */
export function kalenderFuer(tage: Map<Datum, Tag>, alt: Urlaubsantrag | null, neu: Urlaubsantrag | null, am: string): Kalenderaenderung {
  const imKalender = (a: Urlaubsantrag | null) => !!a && a.genehmigt && !a.gestrichen;
  const arbeit = new Map(tage);
  const speichern = new Map<Datum, Tag>();
  const loeschen = new Set<Datum>();
  if (imKalender(alt)) {
    const r = zeitraumSetzen(arbeit, alt!.von, alt!.bis, 'entfernen', am);
    for (const t of r.geaendert) {
      arbeit.set(t.datum, t);
      speichern.set(t.datum, t);
    }
    for (const d of r.geloescht) {
      arbeit.delete(d);
      loeschen.add(d);
    }
  }
  if (imKalender(neu)) {
    const r = zeitraumSetzen(arbeit, neu!.von, neu!.bis, 'urlaub', am);
    for (const t of r.geaendert) {
      speichern.set(t.datum, t);
      loeschen.delete(t.datum);
    }
  }
  return { speichern: [...speichern.values()], loeschen: [...loeschen] };
}

/** Einmalig: für bereits eingetragenen Urlaub genehmigte Anträge anlegen (ohne Genehmigungsdatum). */
export function antraegeAusKalender(daten: Datenbestand, am: string): Urlaubsantrag[] {
  const jahre = new Set([...daten.tage.values()].filter((t) => t.art === 'urlaub').map((t) => jahrVon(t.datum)));
  const neu: Urlaubsantrag[] = [];
  for (const jahr of [...jahre].sort()) {
    // Mit „heute“ weit in der Zukunft gilt alles als genommen – so entstehen zusammenhängende Zeiträume
    for (const z of urlaubszeitraeume(daten, jahr, '9999-12-31')) {
      neu.push({ id: `kalender-${z.von}`, von: z.von, bis: z.bis, genehmigt: true, erstelltAm: am });
    }
  }
  return neu;
}
