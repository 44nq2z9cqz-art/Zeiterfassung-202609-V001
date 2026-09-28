import { describe, expect, it } from 'vitest';
import { altSaldo, importiereAltBackup } from '../src/core/import-altapp';

// Erfundene Beispieldaten im Format der alten App (keine echten Daten)
const beispiel = {
  version: '2.0.0',
  app: 'Zeiterfassung Pro',
  exportedAt: '2026-09-10T08:00:00.000Z',
  data: {
    eintraege: {
      '2026-08-31': { dateStr: '2026-08-31', tagTyp: null },
      '2026-09-01': {
        dateStr: '2026-09-01', start: '08:00', end: '17:00',
        pausen: [
          { start: '12:00', end: '12:20', dauer: 19, dauerSek: 1190, id: 1 },
          { start: '15:00', end: '15:00', dauer: 0, dauerSek: 0, id: 2 }
        ]
      },
      '2026-09-02': { dateStr: '2026-09-02', start: '08:00', end: '16:30', pausen: [{ start: '12:00', end: '12:30', dauer: 30, dauerSek: 1800 }], kommentar: 'Seminar' },
      '2026-09-03': { dateStr: '2026-09-03', tagTyp: 'urlaub' },
      '2026-09-04': { dateStr: '2026-09-04', tagTyp: 'gleittag' },
      '2026-10-03': { dateStr: '2026-10-03', tagTyp: 'feiertag' }
    },
    settings: { sollarbeitszeitMinuten: 480, sollUrlaubKrankMinuten: 0, sollFeiertageHalbMinuten: 240, ueberstundenSockelLimit: 2400 },
    entnahmen: [{ id: 5, datum: '2026-09-02', betragMin: 60, grund: 'Auszahlung', buchungstyp: '' }]
  }
};

describe('G Import der alten Datensicherung', () => {
  const { daten, bericht } = importiereAltBackup(beispiel, '2026-09-08');

  it('übernimmt Tage, Pausen und Tagesarten', () => {
    expect(daten.einstellungen.appStart).toBe('2026-09-01');
    // leerer Eintrag 31.08. und reiner „Feiertag“-Eintrag 03.10. ohne Zeiten
    expect(bericht.leereEintraege).toBe(2);
    expect(bericht.arbeitstage).toBe(2);
    expect(bericht.pausen).toBe(3);
    expect(daten.tage.get('2026-09-02')?.kommentar).toBe('Seminar');
    expect(daten.tage.get('2026-09-03')?.art).toBe('urlaub');
    expect(daten.tage.get('2026-09-04')?.art).toBe('gleittag');
    expect(daten.tage.get('2026-10-03')).toBeUndefined();
    expect(bericht.feiertagVonHand).toEqual(['2026-10-03']);
    expect(daten.tage.get('2026-09-01')?.pausen[0]).toMatchObject({ beginn: 720, ende: 740, quelle: 'import' });
  });

  it('meldet Doppeltipp-Pausen, behält sie aber', () => {
    expect(bericht.doppeltipp).toEqual([{ datum: '2026-09-01', uhrzeit: '15:00' }]);
    expect(daten.tage.get('2026-09-01')?.pausen).toHaveLength(2);
  });

  it('wandelt Entnahmen in Zeitkonto-Buchungen um (Abzug = negativ)', () => {
    expect(daten.buchungen).toEqual([
      expect.objectContaining({ konto: 'zeit', art: 'auszahlung', datum: '2026-09-02', betrag: -60 })
    ]);
  });

  it('vergleicht alten und neuen Saldo', () => {
    // 01.09.: 9:00 − 0:20 Pause = 8:40 → +0:40, Pausenregel: 20 im Fenster → −0:10 → +0:30
    // 02.09.: 8:30 − 0:30 = 8:00 → 0, Buchung −1:00; 03.09. Urlaub 0; 04.09. Gleittag −8:00; 07.09. ohne Eintrag −8:00
    expect(bericht.saldoNeu).toBe(30 - 60 - 480 - 480);
    // alte App: +0:41 (Pause abgerundet), −1:00 Buchung, Gleittag −8:00 ging im leeren Konto verloren,
    // Tage ganz ohne Eintrag zählten nicht → 0:00
    expect(altSaldo(beispiel, '2026-09-07')).toBe(0);
    expect(bericht.saldoAlt).toBe(0);
    expect(bericht.zuschlaege).toEqual({ tage: 1, minuten: 10 });
  });

  it('lehnt fremde Dateien ab', () => {
    expect(() => importiereAltBackup({ foo: 1 }, '2026-09-08')).toThrow(/keine Datensicherung/);
  });
});
