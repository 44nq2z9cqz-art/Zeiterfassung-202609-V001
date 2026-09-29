import { describe, expect, it } from 'vitest';
import { type Sicherungsgrund, taeglichFaellig, ueberzaehlig } from '../src/core/sicherungen';
import { plusTage } from '../src/core/zeit';

const s = (datum: string, grund: Sicherungsgrund = 'taeglich', zeit = '08:00') => ({ id: `${datum}T${zeit}:00.000Z`, datum, grund });

describe('Automatische Sicherungen', () => {
  it('einmal am Tag', () => {
    expect(taeglichFaellig([], '2026-09-29')).toBe(true);
    expect(taeglichFaellig([s('2026-09-28')], '2026-09-29')).toBe(true);
    expect(taeglichFaellig([s('2026-09-29')], '2026-09-29')).toBe(false);
    // eine Sicherung vor dem Wiederherstellen ersetzt die tägliche nicht
    expect(taeglichFaellig([s('2026-09-29', 'vor-wiederherstellung')], '2026-09-29')).toBe(true);
  });

  it('behält die neuesten 14 täglichen und je 5 vor dem Ersetzen', () => {
    const taeglich = Array.from({ length: 20 }, (_, i) => s(plusTage('2026-09-01', i)));
    const vor = Array.from({ length: 7 }, (_, i) => s(plusTage('2026-09-01', i), 'vor-wiederherstellung', '12:00'));
    const weg = ueberzaehlig([...taeglich, ...vor]);
    expect(weg).toHaveLength(6 + 2);
    // die ältesten fallen weg
    expect(weg).toContain(taeglich[0].id);
    expect(weg).toContain(taeglich[5].id);
    expect(weg).not.toContain(taeglich[6].id);
    expect(weg).toContain(vor[0].id);
    expect(weg).not.toContain(vor[2].id);
  });
});
