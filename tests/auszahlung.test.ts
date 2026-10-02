import { describe, expect, it } from 'vitest';
import { auszahlungsBuchung, letzterAbgleich, monatText, pruefeAuszahlung, standardStichtag, stichtagWerte } from '../src/core/auszahlung';
import { bestand } from './hilfen';

describe('Antrag auf Auszahlung von Überstunden', () => {
  const daten = bestand('2026-08-01', [], [
    { id: 'v', konto: 'zeit', art: 'vortrag', datum: '2026-08-01', betrag: 72 * 60 + 30 },
    { id: 'a1', konto: 'zeit', art: 'abgleich', datum: '2026-08-31', betrag: 0, abgleich: { firma: 0, app: 0 } },
    { id: 'a2', konto: 'zeit', art: 'abgleich', datum: '2026-09-05', betrag: 0, abgleich: { firma: 0, app: 0 } }
  ]);
  // August ohne Einträge zählt –Soll; für den Test reicht ein Wochenende als Stichtag direkt nach dem Vortrag
  it('Saldo über dem Sockel am Stichtag', () => {
    const w = stichtagWerte(daten, '2026-08-02', '2026-10-02');
    expect(w).toEqual({ saldo: 72 * 60 + 30, sockel: 40 * 60, ueber: 32 * 60 + 30 });
  });

  it('Vorschläge: Stichtag Ende Vormonat, letzter TiMaS-Abgleich, Monatsname', () => {
    expect(standardStichtag('2026-10-02')).toBe('2026-09-30');
    expect(standardStichtag('2026-01-15')).toBe('2025-12-31');
    expect(letzterAbgleich(daten)).toBe('2026-09-05');
    expect(monatText('2026-10')).toBe('Oktober 2026');
  });

  it('prüft die Stunden und bucht die Auszahlung ab', () => {
    expect(pruefeAuszahlung({ stunden: 0, ueber: 600 })).toMatch(/Stunden/);
    expect(pruefeAuszahlung({ stunden: 700, ueber: 600 })).toMatch(/nur 10:00/);
    expect(pruefeAuszahlung({ stunden: 600, ueber: 600 })).toBeNull();
    const b = auszahlungsBuchung({ stichtag: '2026-08-31', saldo: 0, sockel: 0, ueber: 0, stunden: 1200, abrechnung: '2026-10' }, '2026-10-20', '2026-10-02');
    expect(b).toMatchObject({ konto: 'zeit', art: 'auszahlung', datum: '2026-10-20', betrag: -1200, kommentar: 'laut Antrag vom 02.10.2026, Abrechnung Oktober 2026' });
  });
});
