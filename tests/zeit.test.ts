import { describe, expect, it } from 'vitest';
import { datumDE, dauer, parseUhrzeit, plusTage, uhrzeit, wochentag } from '../src/core/zeit';
import { feiertageBerlin, ostersonntag } from '../src/core/feiertage';

describe('Zeitfunktionen', () => {
  it('rechnet Tage über die Sommerzeitumstellung ohne Verschiebung', () => {
    expect(plusTage('2026-03-28', 1)).toBe('2026-03-29');
    expect(plusTage('2026-03-29', 1)).toBe('2026-03-30');
    expect(plusTage('2026-10-24', 2)).toBe('2026-10-26');
    expect(plusTage('2026-12-31', 1)).toBe('2027-01-01');
    expect(plusTage('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('erkennt Wochentage', () => {
    expect(wochentag('2026-08-31')).toBe(1); // Montag
    expect(wochentag('2026-08-01')).toBe(6); // Samstag
    expect(wochentag('2026-12-24')).toBe(4); // Donnerstag
  });

  it('liest und schreibt Uhrzeiten und Dauern', () => {
    expect(parseUhrzeit('08:46')).toBe(526);
    expect(parseUhrzeit('24:00')).toBeNull();
    expect(parseUhrzeit('abc')).toBeNull();
    expect(uhrzeit(526)).toBe('08:46');
    expect(uhrzeit(1440 + 30)).toBe('00:30');
    expect(dauer(526)).toBe('8:46');
    expect(dauer(13, true)).toBe('+0:13');
    expect(dauer(-9, true)).toBe('−0:09');
    expect(dauer(0, true)).toBe('0:00');
    expect(datumDE('2026-08-31')).toBe('31.08.2026');
  });
});

describe('Feiertage Berlin', () => {
  it('berechnet Ostern', () => {
    expect(ostersonntag(2026)).toBe('2026-04-05');
    expect(ostersonntag(2027)).toBe('2027-03-28');
  });

  it('kennt alle Feiertage 2026', () => {
    expect([...feiertageBerlin(2026).keys()].sort()).toEqual([
      '2026-01-01', '2026-03-08', '2026-04-03', '2026-04-06', '2026-05-01',
      '2026-05-14', '2026-05-25', '2026-10-03', '2026-12-25', '2026-12-26'
    ]);
  });
});
