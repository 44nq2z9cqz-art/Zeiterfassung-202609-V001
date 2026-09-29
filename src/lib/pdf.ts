// PDF-Berichte im Format A4 Hochformat, direkt auf dem Gerät erzeugt (Konzept D, F).
import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';
import { ART_NAMEN } from '../core/buchungen';
import { ARTEN, ORTE } from '../core/bearbeiten';
import {
  anwesenheit,
  type Berichtszeile,
  berichtTage,
  buchungstext,
  jahresuebersicht,
  kontenverlauf,
  stempelungen,
  type Summen
} from '../core/berichte';
import { gueltigAm } from '../core/einstellungen';
import type { Datenbestand } from '../core/modell';
import { WOCHENTAGE, type Datum, datumDE, dauer, uhrzeit, wochentag } from '../core/zeit';

const NACHT: [number, number, number] = [16, 19, 26];
const GRAU: [number, number, number] = [107, 111, 120];
const MARKE: [number, number, number] = [233, 234, 228];
const RAND = 14;
const BREITE = 210 - 2 * RAND;

/** Helvetica kennt kein typografisches Minus und keine Pfeile. */
const t = (s: string) => s.replace(/−/g, '-').replace(/→/g, '->');
const hm = (m: number | null | undefined, vz = false) => (m === null || m === undefined ? '' : t(dauer(m, vz)));
const kurzDatum = (d: Datum) => datumDE(d).slice(0, 6);

interface Kopf {
  titel: string;
  unter: string;
}

function neuesDokument(daten: Datenbestand, kopf: Kopf) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({ title: `${kopf.titel} – ${kopf.unter}`, creator: 'Zeiterfassung' });
  doc.setTextColor(...GRAU);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ZEITERFASSUNG', RAND, 16);
  doc.setTextColor(...NACHT);
  doc.setFontSize(17);
  doc.text(t(kopf.titel), RAND, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAU);
  doc.text(t(kopf.unter), RAND, 29);
  const { name, personalnummer } = daten.einstellungen;
  doc.setFontSize(9);
  if (name) {
    doc.setTextColor(...NACHT);
    doc.text(t(name), 210 - RAND, 23, { align: 'right' });
  }
  if (personalnummer) {
    doc.setTextColor(...GRAU);
    doc.text(`Personalnummer ${t(personalnummer)}`, 210 - RAND, 29, { align: 'right' });
  }
  doc.setDrawColor(...NACHT);
  doc.setLineWidth(0.6);
  doc.line(RAND, 32.5, 210 - RAND, 32.5);
  return doc;
}

function abschliessen(doc: jsPDF, fussLinks?: string): Blob {
  const erstellt = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(218, 219, 213);
    doc.setLineWidth(0.2);
    doc.line(RAND, 285, 210 - RAND, 285);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAU);
    doc.text(t(fussLinks ?? `Erstellt am ${erstellt}`), RAND, 289);
    doc.text(`Seite ${i} von ${n}`, 210 - RAND, 289, { align: 'right' });
  }
  return doc.output('blob');
}

const ende = (doc: jsPDF): number => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

function tabelle(doc: jsPDF, optionen: Parameters<typeof autoTable>[1]) {
  const spalten = (optionen.columnStyles ?? {}) as Record<number, { halign?: 'left' | 'right' | 'center' }>;
  const eigene = optionen.didParseCell;
  autoTable(doc, {
    theme: 'plain',
    margin: { left: RAND, right: RAND, top: 16, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 }, textColor: NACHT, lineColor: [218, 219, 213], lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: NACHT, textColor: 255, fontStyle: 'bold', fontSize: 7.3, lineWidth: 0 },
    footStyles: { fillColor: MARKE, fontStyle: 'bold', lineWidth: 0 },
    showHead: 'everyPage',
    ...optionen,
    // Kopf- und Summenzeile wie die Spalte ausrichten (Zahlen rechtsbündig)
    didParseCell: (d) => {
      if (d.section !== 'body') {
        const h = spalten[d.column.index]?.halign;
        if (h) d.cell.styles.halign = h;
      }
      eigene?.(d);
    }
  });
}

/** Kennzahlen als Kästchenreihe */
/** Text in eine Breite einpassen: erst kleiner, dann mit „…“ kürzen. */
function eingepasst(doc: jsPDF, text: string, breite: number, groesse: number, mindest = 7): string {
  let g = groesse;
  doc.setFontSize(g);
  while (doc.getTextWidth(text) > breite && g > mindest) {
    g -= 0.5;
    doc.setFontSize(g);
  }
  if (doc.getTextWidth(text) <= breite) return text;
  let kurz = text;
  while (kurz.length > 1 && doc.getTextWidth(kurz + '…') > breite) kurz = kurz.slice(0, -1);
  return kurz.trimEnd() + '…';
}

/** Kennzahlen als Kästchenreihe; `gewichte` verteilt die Breite (z. B. breiter für lange Texte). */
function kaestchen(doc: jsPDF, y: number, werte: [string, string][], gewichte?: number[]): number {
  const g = gewichte ?? werte.map(() => 1);
  const summe = g.reduce((a, b) => a + b, 0);
  doc.setDrawColor(218, 219, 213);
  doc.setLineWidth(0.25);
  doc.roundedRect(RAND, y, BREITE, 13, 1.5, 1.5, 'S');
  let x = RAND;
  werte.forEach(([l, v], i) => {
    const w = (BREITE * g[i]) / summe;
    if (i) doc.line(x, y, x, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAU);
    doc.text(eingepasst(doc, t(l.toUpperCase()), w - 5, 6.5, 5.5), x + 2.5, y + 4.6);
    doc.setTextColor(...NACHT);
    doc.text(eingepasst(doc, t(v), w - 5, 11), x + 2.5, y + 10.4);
    x += w;
  });
  return y + 13;
}

function absatz(doc: jsPDF, y: number, text: string, fett?: string): number {
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8.5);
  doc.setTextColor(...NACHT);
  let x = RAND;
  if (fett) {
    doc.setFont('helvetica', 'bold');
    doc.text(t(fett), x, y);
    x += doc.getTextWidth(t(fett)) + 1.5;
  }
  doc.setFont('helvetica', 'normal');
  const zeilen = doc.splitTextToSize(t(text), BREITE - (x - RAND));
  doc.text(zeilen, x, y);
  return y + zeilen.length * 3.8 + 1.5;
}

function zwischentitel(doc: jsPDF, y: number, text: string): number {
  if (y > 262) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NACHT);
  doc.text(t(text.toUpperCase()), RAND, y);
  return y + 2;
}

/** Zeilen mit Pausenzeitverletzung grau hinterlegen */
function markiere(zeilen: Berichtszeile[]) {
  return (d: CellHookData) => {
    if (d.section === 'body' && zeilen[d.row.index]?.zuschlag) d.cell.styles.fillColor = MARKE;
    if (d.section === 'body' && zeilen[d.row.index] && (zeilen[d.row.index].wt === 'Sa' || zeilen[d.row.index].wt === 'So') && zeilen[d.row.index].ist === null) d.cell.styles.textColor = [154, 158, 166];
  };
}

function summenKaestchen(doc: jsPDF, y: number, s: Summen, mitVortrag = true): number {
  const werte: [string, string][] = [];
  if (mitVortrag) werte.push(['Saldo vorher', hm(s.saldoVorher, true)]);
  werte.push(['Ist', hm(s.ist)], ['Soll', hm(s.soll)], ['Zuschläge', hm(-s.zuschlag, true)]);
  if (s.buchungen) werte.push(['Buchungen', hm(s.buchungen, true)]);
  werte.push(['Saldo Zeitraum', hm(s.saldoNachher - s.saldoVorher, true)], ['Saldo Ende', hm(s.saldoNachher, true)]);
  return kaestchen(doc, y, werte);
}

// ─── Tagesnachweis ───────────────────────────────────────────────────────

export interface Optionen {
  unterschrift?: boolean;
  /** Änderungsprotokoll in den Bericht aufnehmen */
  protokoll?: boolean;
}

export function pdfTagesnachweis(daten: Datenbestand, datum: Datum, heute: Datum, { unterschrift = false, protokoll = false }: Optionen = {}): Blob {
  const { zeilen } = berichtTage(daten, datum, datum, heute);
  const z = zeilen[0];
  const tag = z.tag;
  const doc = neuesDokument(daten, { titel: 'Arbeitszeitnachweis', unter: `${WOCHENTAGE[wochentag(datum)]}, ${datumDE(datum)}` });

  let y = kaestchen(doc, 38, [
    ['Arbeitsort', tag ? ORTE[tag.arbeitsort] : 'Büro'],
    ['Anlass', tag?.anlass ?? '-'],
    ['Tagesart', tag ? ARTEN[tag.art] : 'Arbeit'],
    ['Sollzeit', hm(z.soll)]
  ], [1, 1.9, 0.8, 0.7]);

  const s = stempelungen(tag);
  tabelle(doc, {
    startY: y + 7,
    margin: { left: RAND, right: 210 / 2 + 3 },
    head: [['Uhrzeit', 'Buchung zum Nachtragen', 'Erfassung']],
    body: s.length ? s.map((x) => [uhrzeit(x.zeit), x.text, x.quelle]) : [['', 'keine Stempelungen', '']]
  });
  const links = ende(doc);
  const bloecke = anwesenheit(tag);
  tabelle(doc, {
    startY: y + 7,
    margin: { left: 210 / 2 + 3, right: RAND },
    head: [['Von', 'Bis', 'Dauer']],
    body: bloecke.map((b) => [uhrzeit(b.von), uhrzeit(b.bis), hm(b.bis - b.von)]),
    foot: [['Ist-Zeit', '', hm(z.ist ?? 0)]],
    columnStyles: { 2: { halign: 'right' } }
  });
  y = Math.max(links, ende(doc)) + 6;

  y = kaestchen(doc, y, [
    ['Ist', hm(z.ist ?? 0)],
    ['Pausen', hm(z.pausen)],
    ['Soll', hm(z.soll)],
    ['Zuschlag', hm(-z.zuschlag, true)],
    ['Saldo Tag', hm(z.saldo, true)],
    ['Saldo lfd.', hm(z.laufend, true)]
  ]) + 7;

  const regel = gueltigAm(daten.einstellungen.pausenregel, datum);
  if (z.fenster) {
    const f = z.fenster;
    const text = !f.greift
      ? `Der Zeitraum ${uhrzeit(regel.fensterBeginn)}-${uhrzeit(regel.fensterEnde)} Uhr war nicht vollständig abgedeckt, die Regel greift nicht.`
      : f.zuschlag
        ? `Pausenzeitverletzung: ${f.imFenster} von ${regel.mindestGesamt} Min im Regelzeitraum, längste Pause ${f.laengste} Min. Zuschlag ${hm(-f.zuschlag, true)}.`
        : `erfüllt – ${f.imFenster} von ${regel.mindestGesamt} Min im Regelzeitraum, längste Pause ${f.laengste} Min.`;
    y = absatz(doc, y, text, `Pausenregel ${uhrzeit(regel.fensterBeginn)}-${uhrzeit(regel.fensterEnde)} Uhr:`);
  }
  if (tag?.kommentar) y = absatz(doc, y, tag.kommentar, 'Kommentar:');

  const quellen = new Set(s.map((x) => x.quelle));
  y = absatz(doc, y, quellen.size ? [...quellen].join(', ') + '.' : '-', 'Erfassung:');
  if (protokoll && tag?.protokoll.length) {
    y = zwischentitel(doc, y + 3, 'Änderungen');
    tabelle(doc, {
      startY: y + 1,
      head: [['Zeitpunkt', 'Feld', 'Alt', 'Neu']],
      body: tag.protokoll.map((p) => [new Date(p.am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }), p.feld, p.alt ?? '-', p.neu ?? '-']),
      styles: { fontSize: 7.5, textColor: NACHT, cellPadding: 1.1, lineColor: [218, 219, 213], lineWidth: { bottom: 0.15 } }
    });
    y = ende(doc);
  }

  if (unterschrift) {
    y = Math.max(y + 22, 245);
    if (y > 270) {
      doc.addPage();
      y = 40;
    }
    doc.setDrawColor(...NACHT);
    doc.setLineWidth(0.3);
    doc.line(RAND, y, RAND + 80, y);
    doc.line(210 - RAND - 80, y, 210 - RAND, y);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAU);
    doc.text('Datum, Unterschrift Mitarbeiter/in', RAND, y + 4);
    doc.text('Datum, Unterschrift Vorgesetzte/r', 210 - RAND - 80, y + 4);
  }
  return abschliessen(doc);
}

// ─── Kompakt (Woche, Monat, Zeitraum) ────────────────────────────────────

export function pdfKompakt(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum, titel: string, unter: string): Blob {
  const { zeilen, summen } = berichtTage(daten, von, bis, heute);
  const doc = neuesDokument(daten, { titel, unter });
  const sichtbar = zeilen.filter((z) => z.datum <= heute);
  tabelle(doc, {
    startY: 37,
    head: [['Datum', 'Tag', 'Beginn', 'Ende', 'Pausen', 'Ist', 'Soll', 'Zuschl.', 'Saldo', 'Saldo lfd.', 'Bemerkung']],
    body: sichtbar.map((z) => [
      kurzDatum(z.datum),
      z.wt,
      z.tag?.kommen != null ? uhrzeit(z.tag.kommen) : '',
      z.tag?.gehen != null ? uhrzeit(z.tag.gehen) : '',
      z.pausen ? hm(z.pausen) : '',
      z.ist !== null ? hm(z.ist) : '',
      z.soll ? hm(z.soll) : '',
      z.zuschlag ? `! ${hm(-z.zuschlag, true)}` : '',
      z.saldo || z.ist !== null ? hm(z.saldo, true) : '',
      hm(z.laufend, true),
      t(z.bemerkung)
    ]),
    foot: [['Summe', '', '', '', hm(summen.pausen), hm(summen.ist), hm(summen.soll), summen.zuschlag ? hm(-summen.zuschlag, true) : '', hm(summen.saldoNachher - summen.saldoVorher, true), hm(summen.saldoNachher, true), `${summen.anwesenheitstage} Anwesenheitstage`]],
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { cellWidth: 44, fontSize: 7 } },
    didParseCell: markiere(sichtbar)
  });
  let y = summenKaestchen(doc, ende(doc) + 6, summen) + 6;
  y = zeitBuchungen(doc, daten, von, bis, heute, y);
  if (summen.urlaubstage || summen.krankheitstage) {
    absatz(doc, y, `${String(summen.urlaubstage).replace('.', ',')} Urlaubstage, ${summen.krankheitstage} Krankheitstage im Zeitraum.`, 'Abwesenheit:');
  }
  return abschliessen(doc);
}

function zeitBuchungen(doc: jsPDF, daten: Datenbestand, von: Datum, bis: Datum, heute: Datum, y: number): number {
  const k = kontenverlauf(daten, von, bis, heute);
  if (!k.zeitBuchungen.length) return y;
  y = zwischentitel(doc, y + 2, 'Buchungen Zeitkonto');
  tabelle(doc, {
    startY: y + 1,
    head: [['Datum', 'Buchung', 'Betrag']],
    body: k.zeitBuchungen.map((b) => [datumDE(b.datum), t(buchungstext(b)), hm(b.betrag, true)]),
    columnStyles: { 2: { halign: 'right' } }
  });
  return ende(doc) + 6;
}

// ─── Detailliert ─────────────────────────────────────────────────────────

export function pdfDetail(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum, titel: string, unter: string, { protokoll = false }: Optionen = {}): Blob {
  const { zeilen, summen } = berichtTage(daten, von, bis, heute);
  const doc = neuesDokument(daten, { titel, unter });
  const sichtbar = zeilen.filter((z) => z.datum <= heute && (z.ist !== null || z.status !== 'frei'));
  const kg = (z: Berichtszeile) => {
    const s = stempelungen(z.tag).map((x) => `${uhrzeit(x.zeit)} ${x.art}`);
    const paare: string[] = [];
    for (let i = 0; i < s.length; i += 2) paare.push(s.slice(i, i + 2).join('   '));
    return paare.join('\n') || t(z.bemerkung);
  };
  tabelle(doc, {
    startY: 37,
    head: [['Datum', 'Buchungen', 'Anfang', 'Ende', 'Pausen', 'Ist', 'Soll', 'Zuschl.', 'Saldo', 'Saldo lfd.']],
    body: sichtbar.map((z) => [
      `${kurzDatum(z.datum)} ${z.wt}`,
      kg(z),
      z.tag?.kommen != null ? uhrzeit(z.tag.kommen) : '',
      z.tag?.gehen != null ? uhrzeit(z.tag.gehen) : '',
      z.pausen ? hm(z.pausen) : '',
      z.ist !== null ? hm(z.ist) : '',
      z.soll ? hm(z.soll) : '',
      z.zuschlag ? `! ${hm(-z.zuschlag, true)}` : '',
      hm(z.saldo, true),
      hm(z.laufend, true)
    ]),
    foot: [['Summe', `${summen.anwesenheitstage} Anwesenheitstage`, '', '', hm(summen.pausen), hm(summen.ist), hm(summen.soll), summen.zuschlag ? hm(-summen.zuschlag, true) : '', hm(summen.saldoNachher - summen.saldoVorher, true), hm(summen.saldoNachher, true)]],
    columnStyles: { 1: { cellWidth: 40, fontSize: 7.5 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
    didParseCell: markiere(sichtbar)
  });
  let y = summenKaestchen(doc, ende(doc) + 6, summen) + 6;
  const verletzungen = sichtbar.filter((z) => z.zuschlag && z.fenster);
  if (verletzungen.length) {
    y = zwischentitel(doc, y + 1, 'Pausenzeitverletzungen');
    y += 4;
    for (const z of verletzungen) {
      y = absatz(doc, y, `${z.fenster!.imFenster} von 30 Min Pause im Regelzeitraum, längste Pause ${z.fenster!.laengste} Min. Zuschlag ${hm(-z.zuschlag, true)}.`, `${kurzDatum(z.datum)} ${z.wt}:`);
    }
  }
  y = zeitBuchungen(doc, daten, von, bis, heute, y + 2);
  if (protokoll) {
    const aenderungen = sichtbar.flatMap((z) => (z.tag?.protokoll ?? []).map((p) => [`${kurzDatum(z.datum)} ${z.wt}`, new Date(p.am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }), p.feld, p.alt ?? '-', p.neu ?? '-']));
    if (aenderungen.length) {
      y = zwischentitel(doc, y + 2, 'Änderungen');
      tabelle(doc, {
        startY: y + 1,
        head: [['Tag', 'Zeitpunkt', 'Feld', 'Alt', 'Neu']],
        body: aenderungen.map((r) => r.map((x) => t(x))),
        styles: { fontSize: 7.5, textColor: NACHT, cellPadding: 1.1, lineColor: [218, 219, 213], lineWidth: { bottom: 0.15 } }
      });
    }
  }
  return abschliessen(doc, `K = Kommen · G = Gehen · Erstellt am ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`);
}

// ─── Jahr ────────────────────────────────────────────────────────────────

export function pdfJahr(daten: Datenbestand, jahr: number, heute: Datum): Blob {
  const monate = jahresuebersicht(daten, jahr, heute);
  const doc = neuesDokument(daten, { titel: 'Jahresübersicht', unter: String(jahr) });
  const summe = monate.reduce(
    (s, m) => ({ tage: s.tage + m.anwesenheitstage, ist: s.ist + m.ist, soll: s.soll + m.soll, zuschlag: s.zuschlag + m.zuschlag, urlaub: s.urlaub + m.urlaub, saldo: s.saldo + m.saldo }),
    { tage: 0, ist: 0, soll: 0, zuschlag: 0, urlaub: 0, saldo: 0 }
  );
  const bem = (m: (typeof monate)[number]) =>
    [m.vorStart ? 'vor App-Start' : '', m.samstage ? `${m.samstage} Samstag${m.samstage > 1 ? 'e' : ''}` : '', m.gleittage ? `${m.gleittage} Gleittag${m.gleittage > 1 ? 'e' : ''}` : '', m.krank ? `${m.krank} krank` : '']
      .filter(Boolean)
      .join(', ');
  tabelle(doc, {
    startY: 37,
    head: [['Monat', 'Anw.-Tage', 'Ist', 'Soll', 'Zuschläge', 'Buchungen', 'Saldo Monat', 'Saldo Ende', 'Urlaub', 'Bemerkung']],
    body: monate.map((m) => [m.name, m.vorStart ? '' : String(m.anwesenheitstage), m.vorStart ? '' : hm(m.ist), m.vorStart ? '' : hm(m.soll), m.zuschlag ? hm(-m.zuschlag, true) : '', m.buchungen ? hm(m.buchungen, true) : '', m.vorStart ? '' : hm(m.saldo, true), hm(m.saldoEnde, true), m.urlaub ? String(m.urlaub).replace('.', ',') : '', bem(m)]),
    foot: [['Summe', String(summe.tage), hm(summe.ist), hm(summe.soll), summe.zuschlag ? hm(-summe.zuschlag, true) : '', '', hm(summe.saldo, true), monate.length ? hm(monate.at(-1)!.saldoEnde, true) : '', String(summe.urlaub).replace('.', ','), '']],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { fontSize: 7 } }
  });
  kontenTeil(doc, daten, `${jahr}-01-01`, `${jahr}-12-31`, heute, ende(doc) + 8);
  return abschliessen(doc);
}

// ─── Kontenverlauf ───────────────────────────────────────────────────────

export function pdfKonten(daten: Datenbestand, von: Datum, bis: Datum, heute: Datum, unter: string): Blob {
  const doc = neuesDokument(daten, { titel: 'Kontenverlauf', unter });
  kontenTeil(doc, daten, von, bis, heute, 40);
  return abschliessen(doc);
}

function kontenTeil(doc: jsPDF, daten: Datenbestand, von: Datum, bis: Datum, heute: Datum, y: number) {
  const k = kontenverlauf(daten, von, bis, heute);
  y = zwischentitel(doc, y, 'Zeitkonto');
  tabelle(doc, {
    startY: y + 1,
    head: [['Datum', 'Vorgang', 'Betrag', 'Saldo']],
    body: [
      [datumDE(von), 'Saldo zu Beginn', '', hm(k.saldoVorher, true)],
      ...k.zeitBuchungen.map((b) => [datumDE(b.datum), t(buchungstext(b)), hm(b.betrag, true), '']),
      [datumDE(bis < heute ? bis : heute), 'Saldo am Ende (inkl. aller Arbeitstage)', '', hm(k.saldoNachher, true)]
    ],
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } }
  });
  const e = daten.einstellungen;
  y = kaestchen(doc, ende(doc) + 4, [
    ['Saldo', hm(k.saldoNachher, true)],
    ['Sockel', `${hm(Math.min(k.saldoNachher, e.sockel))} / ${hm(e.sockel)}`],
    ['Auszahlbar', hm(Math.max(0, k.saldoNachher - e.sockel))]
  ]);

  const u = k.urlaub;
  y = zwischentitel(doc, y + 9, `Urlaub ${u.jahr}`);
  const tage = (n: number) => String(n).replace('.', ',');
  tabelle(doc, {
    startY: y + 1,
    head: [['Datum', 'Vorgang', 'Tage']],
    body: [
      ...(u.uebertrag ? [['01.01.' + u.jahr, `Übertrag aus ${u.jahr - 1}`, tage(u.uebertrag)]] : []),
      ['01.01.' + u.jahr, 'Jahresanspruch', tage(u.jahresanspruch)],
      ...k.urlaubBuchungen.map((b) => [datumDE(b.datum), t([ART_NAMEN[b.art], b.kommentar].filter(Boolean).join(' · ')), (b.betrag > 0 ? '+' : '') + tage(b.betrag)]),
      ...k.urlaubszeitraeume.map((z) => [z.von === z.bis ? datumDE(z.von) : `${kurzDatum(z.von)} - ${datumDE(z.bis)}`, z.geplant ? 'Urlaub geplant' : 'Urlaub genommen', '-' + tage(z.tage)])
    ],
    foot: [['', `Rest (Anspruch ${tage(u.gesamt)}, genommen ${tage(u.genommen)}, geplant ${tage(u.geplant)})`, tage(u.rest)]],
    columnStyles: { 2: { halign: 'right' } }
  });
}
