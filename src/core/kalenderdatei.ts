// Kalenderdatei (iCalendar, RFC 5545) für einen Urlaubsantrag – zum Übernehmen in den iOS-Kalender.
import type { Urlaubsantrag } from './modell';
import { type Datum, plusTage } from './zeit';

/** Sonderzeichen im Text nach RFC 5545 maskieren. */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const tag = (d: Datum) => d.replace(/-/g, '');
const zeitstempel = (jetzt: Date) => jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Zeilen länger als 75 Byte umbrechen (Folgezeilen beginnen mit einem Leerzeichen). */
function falten(zeile: string): string {
  const teile: string[] = [];
  let rest = zeile;
  const enc = new TextEncoder();
  while (enc.encode(rest).length > 75) {
    let n = 74;
    while (enc.encode(rest.slice(0, n)).length > 74) n--;
    teile.push(rest.slice(0, n));
    rest = ' ' + rest.slice(n);
  }
  teile.push(rest);
  return teile.join('\r\n');
}

export function kalenderTitel(a: Urlaubsantrag): string {
  return a.genehmigt ? 'Urlaub' : 'Urlaub beantragt';
}

/**
 * Ganztägiger Termin über den Zeitraum des Antrags. Die UID bleibt je Antrag gleich und die
 * SEQUENCE steigt mit der Genehmigung – so kann der Kalender den Termin aktualisieren statt ihn zu verdoppeln.
 */
export function icsFuerAntrag(a: Urlaubsantrag, jetzt = new Date()): string {
  const notiz = [a.sonstiges, a.vertretung ? `Vertretung ${a.vertretung}` : ''].filter(Boolean).join(' · ');
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zeiterfassung//Urlaubsantrag//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:urlaub-${a.id}@zeiterfassung`,
    `SEQUENCE:${a.genehmigt ? 1 : 0}`,
    `DTSTAMP:${zeitstempel(jetzt)}`,
    `DTSTART;VALUE=DATE:${tag(a.von)}`,
    // Ende ist bei ganztägigen Terminen exklusiv
    `DTEND;VALUE=DATE:${tag(plusTage(a.bis, 1))}`,
    `SUMMARY:${text(kalenderTitel(a))}`,
    ...(notiz ? [`DESCRIPTION:${text(notiz)}`] : []),
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return zeilen.map(falten).join('\r\n') + '\r\n';
}
