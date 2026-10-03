import { describe, expect, it } from 'vitest';
import {
  ausgezahlt,
  letzterAbgleich,
  monatsletzter,
  monatText,
  neuerAntrag,
  offen,
  pruefeAuszahlung,
  pruefeRate,
  rateMitBuchung,
  standardStichtag,
  stichtagWerte
} from '../src/core/auszahlung';
import { bestand } from './hilfen';

describe('Antrag auf Auszahlung von Überstunden', () => {
  const daten = bestand('2026-08-01', [], [
    { id: 'v', konto: 'zeit', art: 'vortrag', datum: '2026-08-01', betrag: 72 * 60 + 30 },
    { id: 'a1', konto: 'zeit', art: 'abgleich', datum: '2026-08-31', betrag: 0, abgleich: { firma: 0, app: 0 } },
    { id: 'a2', konto: 'zeit', art: 'abgleich', datum: '2026-09-05', betrag: 0, abgleich: { firma: 0, app: 0 } }
  ]);

  it('Saldo über dem Sockel am Stichtag', () => {
    // Stichtag ist ein Sonntag direkt nach dem Vortrag – noch kein Werktag ohne Eintrag
    expect(stichtagWerte(daten, '2026-08-02', '2026-10-02')).toEqual({ saldo: 72 * 60 + 30, sockel: 40 * 60, ueber: 32 * 60 + 30 });
  });

  it('Vorschläge und Monate', () => {
    expect(standardStichtag('2026-10-02')).toBe('2026-09-30');
    expect(standardStichtag('2026-01-15')).toBe('2025-12-31');
    expect(letzterAbgleich(daten)).toBe('2026-09-05');
    expect(monatText('2026-10')).toBe('Oktober 2026');
    expect(monatsletzter('2026-02')).toBe('2026-02-28');
    expect(monatsletzter('2026-12')).toBe('2026-12-31');
    expect(pruefeAuszahlung({ stunden: 0, ueber: 600 })).toMatch(/Stunden/);
    expect(pruefeAuszahlung({ stunden: 700, ueber: 600 })).toMatch(/nur 10:00/);
  });

  it('beantragt 100 Std., ausgezahlt in zwei Monaten', () => {
    let a = neuerAntrag({ stichtag: '2026-09-30', saldo: 150 * 60, sockel: 40 * 60, ueber: 110 * 60, stunden: 100 * 60, abrechnung: '2026-10' }, '2026-10-03');
    expect(offen(a)).toBe(6000);
    const r1 = rateMitBuchung(a, '2026-10', 60 * 60);
    expect(r1.buchung).toMatchObject({ art: 'auszahlung', datum: '2026-10-31', betrag: -3600, kommentar: 'Abrechnung Oktober 2026, laut Antrag vom 03.10.2026' });
    expect(r1.rate.buchungId).toBe(r1.buchung.id);
    a = r1.antrag;
    expect(pruefeRate(a, '2026-11', 50 * 60)).toMatch(/nur noch 40:00/);
    a = rateMitBuchung(a, '2026-11', 40 * 60).antrag;
    expect(ausgezahlt(a)).toBe(6000);
    expect(offen(a)).toBe(0);
    expect(a.auszahlungen.map((r) => r.monat)).toEqual(['2026-10', '2026-11']);
  });
});
