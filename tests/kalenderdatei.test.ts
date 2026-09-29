import { describe, expect, it } from 'vitest';
import { icsFuerAntrag } from '../src/core/kalenderdatei';
import type { Urlaubsantrag } from '../src/core/modell';

const a: Urlaubsantrag = { id: 'abc', von: '2026-12-28', bis: '2026-12-31', vertretung: 'XYZ', sonstiges: 'Jahresende; Rest', genehmigt: false, erstelltAm: '2026-09-29T08:00:00Z' };
const jetzt = new Date('2026-09-29T08:15:30.123Z');

describe('Kalenderdatei', () => {
  it('ganztägiger Termin, Ende exklusiv, Titel je nach Status', () => {
    const ics = icsFuerAntrag(a, jetzt);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261228\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('SUMMARY:Urlaub beantragt\r\n');
    expect(ics).toContain('DESCRIPTION:Jahresende\\; Rest · Vertretung XYZ\r\n');
    expect(ics).toContain('DTSTAMP:20260929T081530Z\r\n');
    expect(ics).toContain('SEQUENCE:0');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    const g = icsFuerAntrag({ ...a, genehmigt: true }, jetzt);
    expect(g).toContain('SUMMARY:Urlaub\r\n');
    expect(g).toContain('SEQUENCE:1');
    // gleiche UID, damit der Kalender aktualisieren kann
    expect(g.match(/UID:.*/)![0]).toBe(ics.match(/UID:.*/)![0]);
  });

  it('bricht lange Zeilen nach RFC 5545 um', () => {
    const ics = icsFuerAntrag({ ...a, sonstiges: 'x'.repeat(200) }, jetzt);
    for (const z of ics.split('\r\n')) expect(new TextEncoder().encode(z).length).toBeLessThanOrEqual(75);
  });
});
