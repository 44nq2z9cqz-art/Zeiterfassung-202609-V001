import { describe, expect, it } from 'vitest';
import { arbeitsorte } from '../src/core/berichte';
import type { Tag } from '../src/core/modell';
import { arbeitstag, bestand, tagesart } from './hilfen';

const ort = (t: Tag, arbeitsort: Tag['arbeitsort'], anlass?: string): Tag => ({ ...t, arbeitsort, anlass });

describe('Arbeitsorte', () => {
  it('zählt gearbeitete Tage je Monat nach Büro, Homeoffice und Außer Haus', () => {
    const daten = bestand('2026-01-01', [
      arbeitstag('2026-09-29', '08:00', '16:30'),
      ort(arbeitstag('2026-09-30', '08:00', '16:30'), 'homeoffice'),
      ort(arbeitstag('2026-10-01', '08:00', '16:30'), 'ausser_haus', 'Seminar'),
      arbeitstag('2026-10-02', '08:00', '16:30'),
      tagesart('2026-10-05', 'urlaub')
    ]);
    const o = arbeitsorte(daten, '2026-01-01', '2026-12-31', '2026-10-06');
    expect(o.monate.map((m) => [m.name, m.buero, m.homeoffice, m.ausser_haus, m.arbeitstage])).toEqual([
      ['September 2026', 1, 1, 0, 2],
      ['Oktober 2026', 1, 0, 1, 2]
    ]);
    expect(o.summe).toMatchObject({ buero: 2, homeoffice: 1, ausser_haus: 1, arbeitstage: 4 });
    expect(o.auswaerts).toEqual([
      { datum: '2026-09-30', ort: 'Homeoffice', anlass: '' },
      { datum: '2026-10-01', ort: 'Außer Haus', anlass: 'Seminar' }
    ]);
  });
});

describe('Überstunden in Geld', () => {
  it('rechnet über 13/3 Wochen je Monat', async () => {
    const { inEuro, stundenlohn } = await import('../src/core/konten');
    // 4000 € bei 40 Std./Woche: 173,33 Std. im Monat → 23,08 €/Std.
    expect(stundenlohn(4000, 40 * 60)).toBeCloseTo(23.077, 2);
    expect(inEuro(90, 4000, 40 * 60)).toBe(35);
    expect(inEuro(-60, 4000, 40 * 60)).toBe(-23);
    expect(stundenlohn(4000, 0)).toBe(0);
  });
});

describe('Netto-Schätzung', () => {
  it('zieht die Abzugsquote ab', async () => {
    const { nettoSchaetzung } = await import('../src/core/konten');
    expect(nettoSchaetzung(1000, 50)).toBe(500);
    expect(nettoSchaetzung(35, 47.5)).toBe(18);
    expect(nettoSchaetzung(100, 0)).toBe(100);
  });
});
