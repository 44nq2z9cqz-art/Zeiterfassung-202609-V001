// Zeitkonto und Urlaubskonto (Konzept B3, B4).
import { gueltigAm } from './einstellungen';
import type { Datenbestand } from './modell';
import { bewerteTag, type Tagesergebnis } from './regeln';
import { type Datum, type Minuten, datumAus, jahrVon, plusTage, tageVonBis } from './zeit';

export interface Tageszeile extends Tagesergebnis {
  /** Zeitkonto-Buchungen an diesem Tag */
  buchungen: Minuten;
  /** Saldo des Zeitkontos am Ende dieses Tages */
  laufend: Minuten;
}

function zeitbuchungen(daten: Datenbestand, von: Datum | null, bis: Datum): Minuten {
  let summe = 0;
  for (const b of daten.buchungen) {
    if (b.konto !== 'zeit' || b.datum > bis) continue;
    if (von !== null && b.datum < von) continue;
    summe += b.betrag;
  }
  return summe;
}

/**
 * Saldo des Zeitkontos am Ende von `bis`.
 * Gezählt werden alle Tage ab dem App-Start und alle Zeitkonto-Buchungen bis `bis`
 * (auch ein Vortrag vor dem App-Start).
 */
export function zeitkontoSaldo(daten: Datenbestand, bis: Datum, heuteDatum: Datum): Minuten {
  let saldo = zeitbuchungen(daten, null, bis);
  const start = daten.einstellungen.appStart;
  if (bis < start) return saldo;
  for (const d of tageVonBis(start, bis)) saldo += bewerteTag(d, daten.tage.get(d), daten.einstellungen, heuteDatum).saldo;
  return saldo;
}

/** Tagesweise Auswertung mit laufendem Saldo – Grundlage aller Berichte. */
export function tagesreihe(daten: Datenbestand, von: Datum, bis: Datum, heuteDatum: Datum) {
  const saldoVorher = zeitkontoSaldo(daten, plusTage(von, -1), heuteDatum);
  const start = daten.einstellungen.appStart;
  let laufend = saldoVorher;
  const zeilen: Tageszeile[] = [];
  for (const d of tageVonBis(von, bis)) {
    const ergebnis = bewerteTag(d, daten.tage.get(d), daten.einstellungen, heuteDatum);
    const zaehlt = d >= start;
    const buchungen = zeitbuchungen(daten, d, d);
    const tagesSaldo = zaehlt ? ergebnis.saldo : 0;
    // Vor dem App-Start gibt es keine „Tage ohne Eintrag“ – dort wurde schlicht nicht erfasst
    const status = !zaehlt && (ergebnis.status === 'ohneEintrag' || ergebnis.status === 'unvollstaendig') ? 'frei' : ergebnis.status;
    laufend += tagesSaldo + buchungen;
    zeilen.push({ ...ergebnis, status, saldo: tagesSaldo, buchungen, laufend });
  }
  return { saldoVorher, zeilen, saldoNachher: laufend };
}

/** Aufteilung für die Anzeige: Sockel und auszahlbarer Teil (rein optisch). */
/**
 * Brutto-Stundenlohn aus dem Monatsbrutto: Ein Monat hat im Schnitt 13/3 Wochen
 * (52 Wochen / 12 Monate), bei 40 Std. also 173,3 Stunden.
 */
export function stundenlohn(bruttoMonat: number, wochenMinuten: Minuten): number {
  const stundenMonat = (wochenMinuten / 60) * (13 / 3);
  return stundenMonat > 0 ? bruttoMonat / stundenMonat : 0;
}

/** Zeit in Euro (brutto), auf ganze Euro gerundet. */
export function inEuro(minuten: Minuten, bruttoMonat: number, wochenMinuten: Minuten): number {
  return Math.round((minuten / 60) * stundenlohn(bruttoMonat, wochenMinuten));
}

export function aufteilung(saldo: Minuten, sockel: Minuten) {
  return { sockel: Math.min(saldo, sockel), auszahlbar: Math.max(0, saldo - sockel) };
}

export interface Urlaubskonto {
  jahr: number;
  /** Rest aus dem Vorjahr (automatisch, Urlaub verfällt nicht) */
  uebertrag: number;
  jahresanspruch: number;
  /** Resturlaub-, Sonderurlaub- und Korrekturbuchungen dieses Jahres */
  buchungen: number;
  gesamt: number;
  genommen: number;
  geplant: number;
  rest: number;
}

export interface Urlaubszeitraum {
  von: Datum;
  bis: Datum;
  tage: number;
  geplant: boolean;
}

/**
 * Alle Urlaubszeiträume eines Jahres. Aufeinanderfolgende Urlaubstage bilden einen Zeitraum,
 * auch wenn nur Wochenenden oder Feiertage dazwischen liegen.
 */
export function urlaubszeitraeume(daten: Datenbestand, jahr: number, heuteDatum: Datum): Urlaubszeitraum[] {
  const tage = [...daten.tage.values()]
    .filter((t) => t.art === 'urlaub' && jahrVon(t.datum) === jahr)
    .map((t) => ({ datum: t.datum, wert: bewerteTag(t.datum, t, daten.einstellungen, heuteDatum).urlaubstage }))
    .filter((t) => t.wert > 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const liste: Urlaubszeitraum[] = [];
  for (const t of tage) {
    const letzter = liste.at(-1);
    const geplant = t.datum > heuteDatum;
    let luecke = false;
    if (letzter) {
      for (let d = plusTage(letzter.bis, 1); d < t.datum; d = plusTage(d, 1)) {
        if (bewerteTag(d, undefined, daten.einstellungen, heuteDatum).soll > 0) {
          luecke = true;
          break;
        }
      }
    }
    if (letzter && !luecke && letzter.geplant === geplant) {
      letzter.bis = t.datum;
      letzter.tage += t.wert;
    } else {
      liste.push({ von: t.datum, bis: t.datum, tage: t.wert, geplant });
    }
  }
  return liste;
}

export function urlaubskonto(daten: Datenbestand, jahr: number, heuteDatum: Datum): Urlaubskonto {
  const startJahr = jahrVon(daten.einstellungen.appStart);
  const leer: Urlaubskonto = { jahr, uebertrag: 0, jahresanspruch: 0, buchungen: 0, gesamt: 0, genommen: 0, geplant: 0, rest: 0 };
  if (jahr < startJahr) return leer;

  const uebertrag = jahr > startJahr ? urlaubskonto(daten, jahr - 1, heuteDatum).rest : 0;
  const jahresanspruch = gueltigAm(daten.einstellungen.urlaubsanspruch, datumAus(jahr, 1, 1));
  const buchungen = daten.buchungen
    .filter((b) => b.konto === 'urlaub' && jahrVon(b.datum) === jahr)
    .reduce((s, b) => s + b.betrag, 0);

  let genommen = 0;
  let geplant = 0;
  for (const tag of daten.tage.values()) {
    if (tag.art !== 'urlaub' || jahrVon(tag.datum) !== jahr) continue;
    const wert = bewerteTag(tag.datum, tag, daten.einstellungen, heuteDatum).urlaubstage;
    if (tag.datum <= heuteDatum) genommen += wert;
    else geplant += wert;
  }
  const gesamt = uebertrag + jahresanspruch + buchungen;
  return { jahr, uebertrag, jahresanspruch, buchungen, gesamt, genommen, geplant, rest: gesamt - genommen - geplant };
}
