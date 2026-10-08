// Journal „Buchungen und Anträge“: eine chronologische Sicht auf beide Konten wie ein Kontoauszug.
// Grundlage sind die vorhandenen Daten – Buchungen, Urlaubsanträge (Vorgang „Planung“) und Anträge auf
// Auszahlung von Überstunden (Vorgang „Auszahlung“). Dazu kommen automatische Zeilen: je Monat die
// Arbeitszeit im Zeitkonto, im Urlaubskonto Jahresanspruch und Übertrag am 1. Januar.
import { type Auszahlungsstatus, auszahlungsstatus, offen } from './auszahlung';
import { berichtTage } from './berichte';
import { urlaubskonto, zeitkontoSaldo } from './konten';
import type { Auszahlungsantrag, Buchung, Datenbestand, Urlaubsantrag } from './modell';
import { urlaubstagWert } from './regeln';
import { type Antragsstatus, antragsstatus, antragTage } from './urlaubsantrag';
import { type Datum, type Minuten, MONATE, plusTage, zerlege } from './zeit';

export type Planstatus = Antragsstatus | 'genommen';

export type Journaleintrag =
  | { art: 'buchung'; datum: Datum; buchung: Buchung; betrag: number; saldo: number }
  | { art: 'monat'; datum: Datum; text: string; betrag: Minuten; saldo: Minuten; ist: Minuten; soll: Minuten; zuschlag: Minuten }
  | { art: 'auto'; datum: Datum; text: string; betrag: number; saldo: number }
  | { art: 'auszahlung'; datum: Datum; antrag: Auszahlungsantrag; status: Auszahlungsstatus; offen: Minuten; raten: { buchung: Buchung | undefined; monat: string; stunden: Minuten; saldo: Minuten }[] }
  | { art: 'plan'; datum: Datum; antrag: Urlaubsantrag; status: Planstatus; tage: number; rest: number }
  | { art: 'kalender'; datum: Datum; von: Datum; bis: Datum; tage: number; rest: number };

export interface Journalmonat {
  /** „2026-10“ */
  schluessel: string;
  name: string;
  /** Saldo bzw. Rest am Monatsende (bis heute) */
  saldoEnde: number;
  /** neueste zuerst */
  eintraege: Journaleintrag[];
}

const monatsende = (j: number, m: number): Datum => plusTage(m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`, -1);
const schluesselVon = (d: Datum) => d.slice(0, 7);

/** Status einer Urlaubsplanung inkl. „genommen“: genehmigt und der letzte Tag ist vorbei. */
export function planstatus(a: Urlaubsantrag, heute: Datum): Planstatus {
  const s = antragsstatus(a);
  return s === 'genehmigt' && a.bis < heute ? 'genommen' : s;
}

/** Offen heißt: der Vorgang braucht noch einen Schritt. */
export const planOffen = (s: Planstatus) => s === 'geplant' || s === 'beantragt';
export const auszahlungOffen = (s: Auszahlungsstatus) => s !== 'ausgezahlt';

function gruppiere<T extends { datum: Datum }>(eintraege: T[], saldoEnde: (schluessel: string) => number): { schluessel: string; name: string; saldoEnde: number; eintraege: T[] }[] {
  const monate = new Map<string, T[]>();
  for (const e of eintraege) {
    const k = schluesselVon(e.datum);
    if (!monate.has(k)) monate.set(k, []);
    monate.get(k)!.push(e);
  }
  return [...monate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([k, liste]) => {
      const [j, m] = k.split('-').map(Number);
      return { schluessel: k, name: `${MONATE[m - 1]} ${j}`, saldoEnde: saldoEnde(k), eintraege: liste.map((e, i) => ({ e, i })).sort((x, y) => y.e.datum.localeCompare(x.e.datum) || y.i - x.i).map((x) => x.e) };
    });
}

// ─── Zeitkonto ───────────────────────────────────────────────────────────

export function journalZeit(daten: Datenbestand, jahr: number, heute: Datum): { saldo: Minuten; monate: Journalmonat[] } {
  const bisHeute = (d: Datum) => (d < heute ? d : heute);
  const saldoAm = (d: Datum) => zeitkontoSaldo(daten, d, heute);
  const start = daten.einstellungen.appStart;
  const eintraege: Journaleintrag[] = [];

  // Auszahlungsanträge mit ihren Raten; deren Buchungen erscheinen nur am Vorgang
  const ratenIds = new Set<string>();
  for (const a of daten.auszahlungen ?? []) {
    for (const r of a.auszahlungen) ratenIds.add(r.buchungId);
    if (Number(a.antragsdatum.slice(0, 4)) !== jahr) continue;
    const raten = a.auszahlungen.map((r) => {
      const buchung = daten.buchungen.find((b) => b.id === r.buchungId);
      return { buchung, monat: r.monat, stunden: r.stunden, saldo: buchung ? saldoAm(buchung.datum) : 0 };
    });
    eintraege.push({ art: 'auszahlung', datum: a.antragsdatum, antrag: a, status: auszahlungsstatus(a), offen: offen(a), raten });
  }

  // Einzelne Buchungen
  for (const b of daten.buchungen) {
    if (b.konto !== 'zeit' || Number(b.datum.slice(0, 4)) !== jahr || ratenIds.has(b.id)) continue;
    eintraege.push({ art: 'buchung', datum: b.datum, buchung: b, betrag: b.betrag, saldo: saldoAm(b.datum) });
  }

  // Je Monat die Arbeitszeit laut Kalender (Saldoänderung ohne die Buchungen des Monats)
  for (let m = 1; m <= 12; m++) {
    const von = `${jahr}-${String(m).padStart(2, '0')}-01`;
    if (von > heute) break;
    const bis = bisHeute(monatsende(jahr, m));
    if (bis < start) continue;
    const vorher = saldoAm(plusTage(von, -1));
    const nachher = saldoAm(bis);
    const buchungen = daten.buchungen.filter((b) => b.konto === 'zeit' && b.datum >= von && b.datum <= bis).reduce((s, b) => s + b.betrag, 0);
    const s = berichtTage(daten, von < start ? start : von, bis, heute).summen;
    eintraege.push({ art: 'monat', datum: bis, text: `Arbeitszeit ${MONATE[m - 1]}`, betrag: nachher - vorher - buchungen, saldo: nachher, ist: s.ist, soll: s.soll, zuschlag: s.zuschlag });
  }

  const monate = gruppiere(eintraege, (k) => {
    const [j, m] = k.split('-').map(Number);
    return saldoAm(bisHeute(monatsende(j, m)));
  });
  return { saldo: saldoAm(heute), monate };
}

// ─── Urlaubskonto ────────────────────────────────────────────────────────

export function journalUrlaub(daten: Datenbestand, jahr: number, heute: Datum): { rest: number; monate: Journalmonat[] } {
  const k = urlaubskonto(daten, jahr, heute);
  const neujahr = `${jahr}-01-01`;
  type Roh = { datum: Datum; reihe: number; betrag: number; eintrag: (rest: number) => Journaleintrag };
  const roh: Roh[] = [];

  if (k.uebertrag) roh.push({ datum: neujahr, reihe: 0, betrag: k.uebertrag, eintrag: (rest) => ({ art: 'auto', datum: neujahr, text: `Übertrag aus ${jahr - 1}`, betrag: k.uebertrag, saldo: rest }) });
  if (k.jahresanspruch) roh.push({ datum: neujahr, reihe: 1, betrag: k.jahresanspruch, eintrag: (rest) => ({ art: 'auto', datum: neujahr, text: `Jahresanspruch ${jahr}`, betrag: k.jahresanspruch, saldo: rest }) });

  for (const b of daten.buchungen) {
    if (b.konto !== 'urlaub' || Number(b.datum.slice(0, 4)) !== jahr) continue;
    roh.push({ datum: b.datum, reihe: 2, betrag: b.betrag, eintrag: (rest) => ({ art: 'buchung', datum: b.datum, buchung: b, betrag: b.betrag, saldo: rest }) });
  }

  // Urlaubsplanungen (Anträge); gestrichene bleiben sichtbar, zählen aber nicht
  const antraege = (daten.antraege ?? []).filter((a) => Number(a.von.slice(0, 4)) === jahr);
  for (const a of antraege) {
    const status = planstatus(a, heute);
    const tage = antragTage(a.von, a.bis);
    roh.push({ datum: a.von, reihe: 3, betrag: status === 'gestrichen' ? 0 : -tage, eintrag: (rest) => ({ art: 'plan', datum: a.von, antrag: a, status, tage, rest }) });
  }

  // Urlaub, der nur im Kalender steht (ohne genehmigte Planung), damit der Rest zum Urlaubskonto passt
  const abgedeckt = (d: Datum) => antraege.some((a) => a.genehmigt && !a.gestrichen && a.von <= d && d <= a.bis);
  const kalenderTage = [...daten.tage.values()]
    .filter((t) => t.art === 'urlaub' && Number(t.datum.slice(0, 4)) === jahr && urlaubstagWert(t.datum) > 0 && !abgedeckt(t.datum))
    .map((t) => t.datum)
    .sort();
  for (const block of bloecke(kalenderTage)) {
    const tage = block.reduce((s, d) => s + urlaubstagWert(d), 0);
    const von = block[0];
    const bis = block.at(-1)!;
    roh.push({ datum: von, reihe: 3, betrag: -tage, eintrag: (rest) => ({ art: 'kalender', datum: von, von, bis, tage, rest }) });
  }

  roh.sort((a, b) => a.datum.localeCompare(b.datum) || a.reihe - b.reihe);
  let rest = 0;
  const eintraege = roh.map((r) => {
    rest += r.betrag;
    return r.eintrag(rest);
  });
  const restEnde = new Map<string, number>();
  for (const e of eintraege) restEnde.set(schluesselVon(e.datum), 'rest' in e ? e.rest : (e as { saldo: number }).saldo);
  return { rest, monate: gruppiere(eintraege, (s) => restEnde.get(s) ?? 0) };
}

/** Urlaubstage zu Blöcken zusammenfassen; dazwischen dürfen nur Wochenenden und Feiertage liegen. */
function bloecke(daten: Datum[]): Datum[][] {
  const ergebnis: Datum[][] = [];
  for (const d of daten) {
    const letzter = ergebnis.at(-1)?.at(-1);
    let anschluss = false;
    if (letzter) {
      anschluss = true;
      for (let x = plusTage(letzter, 1); x < d; x = plusTage(x, 1)) if (urlaubstagWert(x) > 0) anschluss = false;
    }
    if (anschluss) ergebnis.at(-1)!.push(d);
    else ergebnis.push([d]);
  }
  return ergebnis;
}

/** Kurzinfo für die Konten-Seite: offene Urlaubsanträge/-pläne und offene Auszahlungsstunden. */
export function offeneVorgaenge(daten: Datenbestand, heute: Datum) {
  const plaene = (daten.antraege ?? []).map((a) => planstatus(a, heute));
  const auszahlung = (daten.auszahlungen ?? []).filter((a) => auszahlungOffen(auszahlungsstatus(a))).reduce((s, a) => s + offen(a), 0);
  return { beantragt: plaene.filter((s) => s === 'beantragt').length, geplant: plaene.filter((s) => s === 'geplant').length, auszahlung };
}

