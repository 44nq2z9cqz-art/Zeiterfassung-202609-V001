// Daten für alle Berichte (Konzept D). Reine Funktionen – PDF und CSV bauen darauf auf.
import { ART_NAMEN } from './buchungen';
import { ORTE } from './bearbeiten';
import { tagesreihe, type Tageszeile, urlaubskonto, urlaubszeitraeume, zeitkontoSaldo } from './konten';
import type { Buchung, Datenbestand, Tag } from './modell';
import {
  type Datum,
  MONATE,
  WOCHENTAGE_KURZ,
  datumAus,
  datumDE,
  dauer,
  jahrVon,
  plusTage,
  uhrzeit,
  wochentag,
  zerlege
} from './zeit';

export type Zeitraumart = 'tag' | 'woche' | 'monat' | 'jahr' | 'zeitraum';

export interface Zeitraum {
  von: Datum;
  bis: Datum;
  titel: string;
}

/** ISO-Kalenderwoche */
export function kalenderwoche(datum: Datum): number {
  const donnerstag = plusTage(datum, 3 - ((wochentag(datum) + 6) % 7));
  const jahr = jahrVon(donnerstag);
  const ersterDonnerstag = plusTage(datumAus(jahr, 1, 4), 3 - ((wochentag(datumAus(jahr, 1, 4)) + 6) % 7));
  const [j1, m1, t1] = zerlege(ersterDonnerstag);
  const [j2, m2, t2] = zerlege(donnerstag);
  const tage = (Date.UTC(j2, m2 - 1, t2) - Date.UTC(j1, m1 - 1, t1)) / 86_400_000;
  return 1 + Math.round(tage / 7);
}

/** Zeitraum zu einem Bezugsdatum, z. B. die Woche (Mo–So) oder den Monat, in dem es liegt. */
export function zeitraumFuer(art: Exclude<Zeitraumart, 'zeitraum'>, bezug: Datum): Zeitraum {
  const [j, m] = zerlege(bezug);
  if (art === 'tag') return { von: bezug, bis: bezug, titel: `${WOCHENTAGE_KURZ[wochentag(bezug)]}, ${datumDE(bezug)}` };
  if (art === 'woche') {
    const von = plusTage(bezug, -((wochentag(bezug) + 6) % 7));
    const bis = plusTage(von, 6);
    return { von, bis, titel: `KW ${kalenderwoche(von)} · ${datumDE(von).slice(0, 6)} – ${datumDE(bis)}` };
  }
  if (art === 'monat') {
    const bis = plusTage(m === 12 ? datumAus(j + 1, 1, 1) : datumAus(j, m + 1, 1), -1);
    return { von: datumAus(j, m, 1), bis, titel: `${MONATE[m - 1]} ${j}` };
  }
  return { von: datumAus(j, 1, 1), bis: datumAus(j, 12, 31), titel: String(j) };
}

/** Den nächsten bzw. vorigen Zeitraum derselben Art. */
export function blaettere(art: Exclude<Zeitraumart, 'zeitraum'>, bezug: Datum, richtung: 1 | -1): Datum {
  const [j, m, t] = zerlege(bezug);
  if (art === 'tag') return plusTage(bezug, richtung);
  if (art === 'woche') return plusTage(bezug, 7 * richtung);
  if (art === 'monat') {
    const neu = m + richtung;
    const jj = neu < 1 ? j - 1 : neu > 12 ? j + 1 : j;
    const mm = neu < 1 ? 12 : neu > 12 ? 1 : neu;
    return datumAus(jj, mm, Math.min(t, 28));
  }
  return datumAus(j + richtung, m, Math.min(t, 28));
}

export interface Stempelung {
  zeit: number;
  art: 'K' | 'G';
  text: string;
  quelle: string;
}

const QUELLE: Record<string, string> = { live: 'live gestempelt', manuell: 'nachgetragen', import: 'aus alter App' };

/** Kommen/Gehen-Buchungen wie im Firmensystem: Pausenbeginn = Gehen, Pausenende = Kommen. */
export function stempelungen(tag: Tag | undefined): Stempelung[] {
  if (!tag || tag.kommen === null) return [];
  const liste: Stempelung[] = [{ zeit: tag.kommen, art: 'K', text: 'Kommen', quelle: QUELLE[tag.kommenQuelle ?? ''] ?? '' }];
  for (const p of [...tag.pausen].sort((a, b) => a.beginn - b.beginn)) {
    if (p.ende === null || p.ende <= p.beginn) continue;
    liste.push({ zeit: p.beginn, art: 'G', text: 'Gehen (Pause)', quelle: QUELLE[p.quelle] ?? '' });
    liste.push({ zeit: p.ende, art: 'K', text: 'Kommen', quelle: QUELLE[p.quelle] ?? '' });
  }
  if (tag.gehen !== null) liste.push({ zeit: tag.gehen, art: 'G', text: 'Gehen', quelle: QUELLE[tag.gehenQuelle ?? ''] ?? '' });
  return liste;
}

/** Anwesenheitsblöcke zwischen Kommen und Gehen. */
export function anwesenheit(tag: Tag | undefined): { von: number; bis: number }[] {
  const s = stempelungen(tag);
  const bloecke: { von: number; bis: number }[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) if (s[i].art === 'K' && s[i + 1].art === 'G') bloecke.push({ von: s[i].zeit, bis: s[i + 1].zeit });
  return bloecke;
}

export interface Berichtszeile extends Tageszeile {
  wt: string;
  tag: Tag | undefined;
  bemerkung: string;
}

const STATUS_TEXT: Record<string, string> = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  gleittag: 'Gleittag',
  ohneEintrag: 'ohne Eintrag',
  unvollstaendig: 'Gehen fehlt',
  offen: 'läuft'
};

export function bemerkung(z: Tageszeile, tag: Tag | undefined): string {
  const teile: string[] = [];
  if (z.feiertag) teile.push(z.feiertag);
  if (STATUS_TEXT[z.status]) teile.push(STATUS_TEXT[z.status]);
  if (tag && tag.arbeitsort !== 'buero') teile.push(ORTE[tag.arbeitsort] + (tag.anlass ? `: ${tag.anlass}` : ''));
  if (tag?.kommentar) teile.push(tag.kommentar);
  return teile.join(' · ');
}

export interface Summen {
  ist: number;
  soll: number;
  pausen: number;
  zuschlag: number;
  zuschlagTage: number;
  buchungen: number;
  saldoVorher: number;
  saldoNachher: number;
  anwesenheitstage: number;
  urlaubstage: number;
  krankheitstage: number;
}

export function berichtTage(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum) {
  const r = tagesreihe(daten, von, bis, heute);
  const zeilen: Berichtszeile[] = r.zeilen.map((z) => {
    const tag = daten.tage.get(z.datum);
    return { ...z, wt: WOCHENTAGE_KURZ[wochentag(z.datum)], tag, bemerkung: bemerkung(z, tag) };
  });
  const summen: Summen = {
    ist: 0, soll: 0, pausen: 0, zuschlag: 0, zuschlagTage: 0, buchungen: 0,
    saldoVorher: r.saldoVorher, saldoNachher: r.saldoNachher, anwesenheitstage: 0, urlaubstage: 0, krankheitstage: 0
  };
  for (const z of zeilen) {
    if (z.datum > heute) continue;
    summen.ist += z.ist ?? 0;
    summen.pausen += z.pausen;
    if (z.status !== 'urlaub' && z.status !== 'krank' && z.status !== 'offen' && z.status !== 'frei') summen.soll += z.soll;
    if (z.zuschlag) {
      summen.zuschlag += z.zuschlag;
      summen.zuschlagTage++;
    }
    summen.buchungen += z.buchungen;
    if (z.ist !== null) summen.anwesenheitstage++;
    summen.urlaubstage += z.urlaubstage;
    if (z.status === 'krank') summen.krankheitstage++;
  }
  return { zeilen, summen };
}

export interface Monatszeile {
  monat: number;
  name: string;
  anwesenheitstage: number;
  ist: number;
  soll: number;
  zuschlag: number;
  buchungen: number;
  saldo: number;
  saldoEnde: number;
  urlaub: number;
  krank: number;
  gleittage: number;
  samstage: number;
  vorStart: boolean;
}

export function jahresuebersicht(daten: Datenbestand, jahr: number, heute: Datum): Monatszeile[] {
  const liste: Monatszeile[] = [];
  for (let m = 1; m <= 12; m++) {
    const z = zeitraumFuer('monat', datumAus(jahr, m, 1));
    if (z.von > heute) break;
    const { zeilen, summen } = berichtTage(daten, z.von, z.bis < heute ? z.bis : heute, heute);
    liste.push({
      monat: m,
      name: MONATE[m - 1],
      anwesenheitstage: summen.anwesenheitstage,
      ist: summen.ist,
      soll: summen.soll,
      zuschlag: summen.zuschlag,
      buchungen: summen.buchungen,
      saldo: summen.saldoNachher - summen.saldoVorher,
      saldoEnde: summen.saldoNachher,
      urlaub: summen.urlaubstage,
      krank: summen.krankheitstage,
      gleittage: zeilen.filter((x) => x.status === 'gleittag').length,
      samstage: zeilen.filter((x) => x.ist !== null && x.soll === 0).length,
      vorStart: z.bis < daten.einstellungen.appStart
    });
  }
  return liste;
}

// ─── Arbeitsorte (Büro- und Homeoffice-Tage, z. B. für die Steuererklärung) ──

export interface Ortezeile {
  /** Monatsname bzw. Zeitraum */
  name: string;
  buero: number;
  homeoffice: number;
  ausser_haus: number;
  /** Tage mit gestempelter Arbeitszeit */
  arbeitstage: number;
}

export interface Arbeitsorte {
  monate: Ortezeile[];
  summe: Ortezeile;
  /** Tage außerhalb des Büros mit Anlass, für den Nachweis */
  auswaerts: { datum: Datum; ort: string; anlass: string }[];
}

/** Zählt gearbeitete Tage (mit Kommen und Gehen) nach Arbeitsort, je Monat. */
export function arbeitsorte(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum): Arbeitsorte {
  const ende = bis < heute ? bis : heute;
  const leer = (name: string): Ortezeile => ({ name, buero: 0, homeoffice: 0, ausser_haus: 0, arbeitstage: 0 });
  const summe = leer('Summe');
  const monate = new Map<string, Ortezeile>();
  const auswaerts: Arbeitsorte['auswaerts'] = [];
  if (von > ende) return { monate: [], summe, auswaerts };
  for (const z of berichtTage(daten, von, ende, heute).zeilen) {
    if (z.ist === null || !z.tag) continue;
    const [j, m] = zerlege(z.datum);
    const schluessel = `${j}-${m}`;
    if (!monate.has(schluessel)) monate.set(schluessel, leer(`${MONATE[m - 1]} ${j}`));
    for (const zeile of [monate.get(schluessel)!, summe]) {
      zeile[z.tag.arbeitsort]++;
      zeile.arbeitstage++;
    }
    if (z.tag.arbeitsort !== 'buero') auswaerts.push({ datum: z.datum, ort: ORTE[z.tag.arbeitsort], anlass: z.tag.anlass ?? '' });
  }
  return { monate: [...monate.values()], summe, auswaerts };
}

export function kontenverlauf(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum) {
  const zeit = daten.buchungen.filter((b) => b.konto === 'zeit' && b.datum >= von && b.datum <= bis).sort((a, b) => a.datum.localeCompare(b.datum));
  const jahr = jahrVon(bis);
  const urlaub = urlaubskonto(daten, jahr, heute);
  const urlaubBuchungen = daten.buchungen.filter((b) => b.konto === 'urlaub' && jahrVon(b.datum) === jahr).sort((a, b) => a.datum.localeCompare(b.datum));
  return {
    saldoVorher: zeitkontoSaldo(daten, plusTage(von, -1), heute),
    saldoNachher: zeitkontoSaldo(daten, bis < heute ? bis : heute, heute),
    zeitBuchungen: zeit,
    urlaub,
    urlaubBuchungen,
    urlaubszeitraeume: urlaubszeitraeume(daten, jahr, heute)
  };
}

export function buchungstext(b: Buchung): string {
  const teile = [ART_NAMEN[b.art]];
  if (b.abgleich) teile.push(`Firma ${dauer(b.abgleich.firma, true)}, App ${dauer(b.abgleich.app, true)}`);
  if (b.kommentar) teile.push(b.kommentar);
  return teile.join(' · ');
}

// ─── CSV ─────────────────────────────────────────────────────────────────

const zelle = (v: string | number | null | undefined) => {
  const t = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
/** Für Excel: normales Minuszeichen statt typografischem */
const hm = (m: number | null, vz = false) => (m === null ? '' : dauer(m, vz).replace('−', '-'));

export function csvTage(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum): string {
  const { zeilen } = berichtTage(daten, von, bis, heute);
  const kopf = [
    'Datum', 'Wochentag', 'Tagesart', 'Arbeitsort', 'Anlass', 'Beginn', 'Ende', 'Buchungen K/G',
    'Pausen (h:mm)', 'Pausen (Min)', 'Ist (h:mm)', 'Ist (Min)', 'Soll (Min)', 'Zuschlag (Min)',
    'Saldo Tag (Min)', 'Buchungen Zeitkonto (Min)', 'Saldo laufend (h:mm)', 'Saldo laufend (Min)', 'Bemerkung'
  ];
  const zeilenText = zeilen.map((z) => {
    const t = z.tag;
    return [
      z.datum, z.wt, STATUS_TEXT[z.status] ?? (z.status === 'arbeit' ? 'Arbeitstag' : ''), t ? ORTE[t.arbeitsort] : '', t?.anlass ?? '',
      t?.kommen !== null && t?.kommen !== undefined ? uhrzeit(t.kommen) : '', t?.gehen !== null && t?.gehen !== undefined ? uhrzeit(t.gehen) : '',
      stempelungen(t).map((s) => `${uhrzeit(s.zeit)} ${s.art}`).join(' '),
      z.pausen ? hm(z.pausen) : '', z.pausen || '', hm(z.ist), z.ist ?? '', z.soll, z.zuschlag || '',
      z.saldo, z.buchungen || '', hm(z.laufend, true), z.laufend, z.bemerkung
    ].map(zelle).join(';');
  });
  return '﻿' + [kopf.join(';'), ...zeilenText].join('\r\n') + '\r\n';
}

export function csvJahr(daten: Datenbestand, jahr: number, heute: Datum): string {
  const kopf = ['Monat', 'Anwesenheitstage', 'Ist (h:mm)', 'Soll (h:mm)', 'Zuschläge (Min)', 'Buchungen (h:mm)', 'Saldo Monat (h:mm)', 'Saldo Ende (h:mm)', 'Urlaubstage', 'Krankheitstage', 'Gleittage'];
  const zeilen = jahresuebersicht(daten, jahr, heute).map((m) =>
    [m.name, m.anwesenheitstage, hm(m.ist), hm(m.soll), m.zuschlag, hm(m.buchungen, true), hm(m.saldo, true), hm(m.saldoEnde, true), String(m.urlaub).replace('.', ','), m.krank, m.gleittage].map(zelle).join(';')
  );
  return '﻿' + [kopf.join(';'), ...zeilen].join('\r\n') + '\r\n';
}

export function csvOrte(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum): string {
  const o = arbeitsorte(daten, von, bis, heute);
  const kopf = ['Monat', 'Büro', 'Homeoffice', 'Außer Haus', 'Arbeitstage'];
  const zeilen = [...o.monate, o.summe].map((r) => [r.name, r.buero, r.homeoffice, r.ausser_haus, r.arbeitstage].map(zelle).join(';'));
  return '﻿' + [kopf.join(';'), ...zeilen].join('\r\n') + '\r\n';
}

export function csvKonten(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum): string {
  const k = kontenverlauf(daten, von, bis, heute);
  const kopf = ['Konto', 'Datum', 'Art', 'Betrag', 'Einheit', 'Kommentar'];
  const zeilen = [
    ...k.zeitBuchungen.map((b) => ['Zeitkonto', b.datum, ART_NAMEN[b.art], hm(b.betrag, true), 'h:mm', buchungstext(b)]),
    ...k.urlaubBuchungen.map((b) => ['Urlaub', b.datum, ART_NAMEN[b.art], String(b.betrag).replace('.', ','), 'Tage', b.kommentar ?? '']),
    ...k.urlaubszeitraeume.map((z) => ['Urlaub', z.von, z.geplant ? 'Urlaub genehmigt' : 'Urlaub genommen', String(-z.tage).replace('.', ','), 'Tage', `${datumDE(z.von)} – ${datumDE(z.bis)}`])
  ].map((r) => r.map(zelle).join(';'));
  return '﻿' + [kopf.join(';'), ...zeilen].join('\r\n') + '\r\n';
}
