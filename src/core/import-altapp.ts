// Import der Datensicherung aus der alten App „Zeiterfassung Pro“ (Format 2.0.0), Konzept G.
// Alle Stempelungen werden so übernommen, wie sie erfasst sind.
import { standardEinstellungen } from './einstellungen';
import { feiertag } from './feiertage';
import { zeitkontoSaldo } from './konten';
import type { Buchung, Datenbestand, Einstellungen, Pause, Tag } from './modell';
import { bewerteTag } from './regeln';
import { type Datum, type Minuten, parseUhrzeit, plusTage, tageVonBis, wochentag } from './zeit';

interface AltPause {
  start?: string;
  end?: string;
  dauer?: number;
  dauerSek?: number;
  id?: number;
}

interface AltEintrag {
  dateStr?: string;
  start?: string | null;
  end?: string | null;
  pausen?: AltPause[];
  tagTyp?: string | null;
  kommentar?: string;
  sollOverrideMinuten?: number;
  anpassungMinuten?: number;
}

interface AltEntnahme {
  id?: number;
  datum: string;
  betragMin: number;
  grund?: string;
  buchungstyp?: string;
}

interface AltSettings {
  sollarbeitszeitMinuten?: number;
  sollUrlaubKrankMinuten?: number;
  sollFeiertageHalbMinuten?: number;
  ueberstundenSockelLimit?: number;
}

export interface AltBackup {
  version?: string;
  app?: string;
  exportedAt?: string;
  data: { eintraege: Record<string, AltEintrag>; settings?: AltSettings; entnahmen?: AltEntnahme[] };
}

export interface Pruefbericht {
  exportiertAm: string | null;
  von: Datum;
  bis: Datum;
  eintraege: number;
  arbeitstage: number;
  pausen: number;
  urlaubstage: number;
  krankheitstage: number;
  gleittage: number;
  buchungen: number;
  leereEintraege: number;
  /** Tage, an denen in der alten App „Feiertag“ von Hand gesetzt war */
  feiertagVonHand: Datum[];
  /** Pausen unter 1 Minute (versehentliches Doppeltippen) */
  doppeltipp: { datum: Datum; uhrzeit: string }[];
  /** Stichtag des Saldovergleichs (Ende gestern) */
  stichtag: Datum;
  saldoAlt: Minuten;
  saldoNeu: Minuten;
  /** Minuten, die die alte App durch Abrunden jeder einzelnen Pause zu viel gutgeschrieben hat */
  pausenrundung: Minuten;
  zuschlaege: { tage: number; minuten: Minuten };
  hinweise: string[];
}

export interface Importergebnis {
  daten: Datenbestand;
  bericht: Pruefbericht;
}

export function istAltBackup(json: unknown): json is AltBackup {
  const b = json as AltBackup;
  return !!b && typeof b === 'object' && b.app === 'Zeiterfassung Pro' && !!b.data && typeof b.data.eintraege === 'object';
}

function uhr(text: string | null | undefined): Minuten | null {
  return parseUhrzeit(text ?? null);
}

export function importiereAltBackup(json: unknown, heuteDatum: Datum): Importergebnis {
  if (!istAltBackup(json)) {
    throw new Error('Die Datei ist keine Datensicherung der alten App „Zeiterfassung Pro“.');
  }
  const alt = json;
  const hinweise: string[] = [];
  const tage = new Map<Datum, Tag>();
  const doppeltipp: Pruefbericht['doppeltipp'] = [];
  const feiertagVonHand: Datum[] = [];
  let leer = 0;
  let pausenAnzahl = 0;

  for (const [schluessel, e] of Object.entries(alt.data.eintraege)) {
    const datum = e.dateStr ?? schluessel;
    const kommen = uhr(e.start);
    const gehen0 = uhr(e.end);
    const art = e.tagTyp === 'urlaub' || e.tagTyp === 'krank' || e.tagTyp === 'gleittag' ? e.tagTyp : 'arbeit';
    const altPausen = (e.pausen ?? []).filter((p) => uhr(p.start) !== null && uhr(p.end) !== null);

    if (e.tagTyp === 'feiertag') feiertagVonHand.push(datum);
    const hatInhalt = kommen !== null || gehen0 !== null || art !== 'arbeit' || !!e.kommentar || altPausen.length > 0;
    if (!hatInhalt) {
      leer++;
      continue;
    }

    // Arbeitsende vor Beginn bedeutet: über Mitternacht gearbeitet
    const gehen = kommen !== null && gehen0 !== null && gehen0 < kommen ? gehen0 + 1440 : gehen0;
    const pausen: Pause[] = altPausen.map((p, i) => {
      let beginn = uhr(p.start)!;
      let ende = uhr(p.end)!;
      if (kommen !== null && beginn < kommen) beginn += 1440;
      if (ende < beginn) ende += 1440;
      if ((p.dauerSek ?? (ende - beginn) * 60) < 60) doppeltipp.push({ datum, uhrzeit: p.start! });
      return { id: `${datum}-p${i + 1}`, beginn, ende, quelle: 'import' };
    });
    pausen.sort((a, b) => a.beginn - b.beginn);
    pausenAnzahl += pausen.length;

    const tag: Tag = {
      datum,
      art,
      kommen,
      gehen,
      kommenQuelle: kommen !== null ? 'import' : undefined,
      gehenQuelle: gehen !== null ? 'import' : undefined,
      pausen,
      arbeitsort: 'buero',
      protokoll: []
    };
    if (e.kommentar) tag.kommentar = e.kommentar;
    if (typeof e.sollOverrideMinuten === 'number') tag.sollAbweichung = e.sollOverrideMinuten;
    if (e.anpassungMinuten) hinweise.push(`${datum}: Zeitanpassung von ${e.anpassungMinuten} Min wurde nicht übernommen.`);
    tage.set(datum, tag);
  }

  const buchungen: Buchung[] = (alt.data.entnahmen ?? []).map((en, i) => ({
    id: `import-b${i + 1}`,
    konto: 'zeit',
    // Alte App: positiver Betrag = Abzug, negativer Betrag = Gutschrift
    art: en.betragMin > 0 ? 'auszahlung' : 'korrektur',
    datum: en.datum,
    betrag: -en.betragMin,
    kommentar: [en.buchungstyp, en.grund].filter(Boolean).join(' – ') || undefined
  }));

  const daten = sortiert(tage);
  const erster = [...daten.keys()][0] ?? heuteDatum;
  const letzter = [...daten.keys()].at(-1) ?? heuteDatum;
  const einstellungen = einstellungenAus(alt.data.settings, erster);
  const bestand: Datenbestand = { tage: daten, buchungen, einstellungen };

  const stichtag = plusTage(heuteDatum, -1);
  let zuschlagTage = 0;
  let zuschlagMinuten = 0;
  for (const d of tageVonBis(erster, stichtag)) {
    const r = bewerteTag(d, daten.get(d), einstellungen, heuteDatum);
    if (r.zuschlag > 0) {
      zuschlagTage++;
      zuschlagMinuten += r.zuschlag;
    }
  }

  // Unterschied zwischen „Ende − Beginn“ (neue Rechnung) und der abgerundeten Pausendauer der alten App
  let pausenrundung = 0;
  for (const [d, e] of Object.entries(alt.data.eintraege)) {
    if (d > stichtag || !e.start || !e.end) continue;
    for (const p of e.pausen ?? []) {
      const b = uhr(p.start);
      const en = uhr(p.end);
      if (b !== null && en !== null) pausenrundung += (en >= b ? en - b : en + 1440 - b) - (p.dauer ?? 0);
    }
  }

  if (feiertagVonHand.length) hinweise.push('Von Hand gesetzte Feiertage werden jetzt automatisch erkannt; die Tagesart wurde entfernt.');
  if (leer) hinweise.push(`${leer} leere Einträge ohne Zeiten wurden übersprungen.`);

  const werte = [...daten.values()];
  const bericht: Pruefbericht = {
    exportiertAm: alt.exportedAt ?? null,
    von: erster,
    bis: letzter,
    eintraege: daten.size,
    arbeitstage: werte.filter((t) => t.art === 'arbeit' && t.kommen !== null && t.gehen !== null).length,
    pausen: pausenAnzahl,
    urlaubstage: werte.filter((t) => t.art === 'urlaub').length,
    krankheitstage: werte.filter((t) => t.art === 'krank').length,
    gleittage: werte.filter((t) => t.art === 'gleittag').length,
    buchungen: buchungen.length,
    leereEintraege: leer,
    feiertagVonHand,
    doppeltipp,
    stichtag,
    saldoAlt: altSaldo(alt, stichtag),
    saldoNeu: zeitkontoSaldo(bestand, stichtag, heuteDatum),
    pausenrundung: Math.round(pausenrundung),
    zuschlaege: { tage: zuschlagTage, minuten: zuschlagMinuten },
    hinweise
  };
  return { daten: bestand, bericht };
}

function sortiert(tage: Map<Datum, Tag>): Map<Datum, Tag> {
  return new Map([...tage.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function einstellungenAus(s: AltSettings | undefined, appStart: Datum): Einstellungen {
  const e = standardEinstellungen(appStart);
  if (s?.sollarbeitszeitMinuten) e.wochenstunden = [{ ab: '2000-01-01', wert: s.sollarbeitszeitMinuten * 5 }];
  if (s?.sollFeiertageHalbMinuten) e.sollHalbtag = [{ ab: '2000-01-01', wert: s.sollFeiertageHalbMinuten }];
  if (s?.ueberstundenSockelLimit) e.sockel = s.ueberstundenSockelLimit;
  return e;
}

// ─── Nachbildung der alten Rechnung – nur für den Vergleich im Prüfbericht ──────────────

function altSoll(datum: Datum, e: AltEintrag | undefined, s: AltSettings): Minuten {
  if (e && typeof e.sollOverrideMinuten === 'number') return e.sollOverrideMinuten;
  if (e?.tagTyp === 'urlaub' || e?.tagTyp === 'krank') return s.sollUrlaubKrankMinuten ?? 0;
  const wt = wochentag(datum);
  // Die alte App kannte zusätzlich Oster- und Pfingstsonntag; an Sonntagen ist das Soll ohnehin 0.
  if (feiertag(datum)) return 0;
  const md = datum.slice(5);
  if ((md === '12-24' || md === '12-31') && wt >= 1 && wt <= 5) return 240; // alte App: fest 4 h
  if (wt === 0 || wt === 6) return 0;
  return s.sollarbeitszeitMinuten || 480;
}

/** Saldo, wie ihn die alte App angezeigt hätte (inkl. ihrer Fehler). */
export function altSaldo(alt: AltBackup, bis: Datum): Minuten {
  const s = alt.data.settings ?? {};
  const limit = s.ueberstundenSockelLimit ?? 2400;
  let sockel = 0;
  let ueber = 0;
  const eintraege = alt.data.eintraege;
  const entnahmen = alt.data.entnahmen ?? [];
  const daten = [...new Set([...Object.keys(eintraege), ...entnahmen.map((e) => e.datum)])].filter((d) => d <= bis).sort();
  for (const d of daten) {
    const e = eintraege[d];
    if (e) {
      const soll = altSoll(d, e, s);
      let ist: number | null = null;
      const b = uhr(e.start);
      const en = uhr(e.end);
      if (b !== null && en !== null && en > b) {
        ist = en - b - (e.pausen ?? []).reduce((a, p) => a + (p.dauer ?? 0), 0) + (e.anpassungMinuten ?? 0);
      }
      const diff = ist === null ? (soll > 0 ? -soll : 0) : ist - soll;
      if (diff > 0) {
        const raum = Math.max(0, limit - sockel);
        sockel += Math.min(diff, raum);
        ueber += diff - Math.min(diff, raum);
      } else if (diff < 0) {
        const abzug = -diff;
        const ausSockel = Math.min(abzug, sockel);
        sockel -= ausSockel;
        ueber -= Math.min(abzug - ausSockel, ueber); // Rest ging verloren
      }
    }
    for (const en of entnahmen.filter((x) => x.datum === d)) {
      if (en.betragMin > 0) {
        const ausUeber = Math.min(en.betragMin, Math.max(0, ueber));
        ueber -= ausUeber;
        sockel -= en.betragMin - ausUeber;
      } else if (en.betragMin < 0) {
        const g = -en.betragMin;
        const raum = Math.max(0, limit - sockel);
        sockel += Math.min(g, raum);
        ueber += g - Math.min(g, raum);
      }
    }
  }
  return sockel + ueber;
}
