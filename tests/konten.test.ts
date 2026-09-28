import { describe, expect, it } from 'vitest';
import { aufteilung, tagesreihe, urlaubskonto, urlaubszeitraeume, zeitkontoSaldo } from '../src/core/konten';
import type { Buchung, Tag } from '../src/core/modell';
import { tageVonBis } from '../src/core/zeit';
import { arbeitstag, bestand, tagesart } from './hilfen';

const HEUTE = '2026-09-28';

describe('B3 Zeitkonto', () => {
  it('Minusstunden bringen das Konto ins Minus', () => {
    // Woche mit 5 Tagen à 7:00 → −5:00
    const tage = [...tageVonBis('2026-08-03', '2026-08-07')].map((d) => arbeitstag(d, '08:00', '15:30', ['12:00-12:30']));
    const daten = bestand('2026-08-03', tage);
    expect(zeitkontoSaldo(daten, '2026-08-09', HEUTE)).toBe(-300);
  });

  it('Buchungen wirken ab ihrem Datum, auch ein Vortrag vor dem App-Start', () => {
    const buchungen: Buchung[] = [
      { id: 'v', konto: 'zeit', art: 'vortrag', datum: '2026-03-08', betrag: 538 * 60 + 16 },
      { id: 'a', konto: 'zeit', art: 'auszahlung', datum: '2026-08-15', betrag: -600 }
    ];
    const daten = bestand('2026-08-10', [], buchungen);
    // 10.–14.08. ohne Eintrag: 5 × −8:00
    expect(zeitkontoSaldo(daten, '2026-08-14', HEUTE)).toBe(538 * 60 + 16 - 2400);
    expect(zeitkontoSaldo(daten, '2026-08-16', HEUTE)).toBe(538 * 60 + 16 - 2400 - 600);
  });

  it('Aufteilung Sockel / auszahlbar wie im Konzept', () => {
    expect(aufteilung(52 * 60, 2400)).toEqual({ sockel: 2400, auszahlbar: 12 * 60 });
    expect(aufteilung(25 * 60 + 30, 2400)).toEqual({ sockel: 25 * 60 + 30, auszahlbar: 0 });
    expect(aufteilung(-180, 2400)).toEqual({ sockel: -180, auszahlbar: 0 });
  });

  it('Tagesreihe liefert laufenden Saldo mit Vorwert', () => {
    const tage: Tag[] = [arbeitstag('2026-08-03', '08:00', '17:00', ['12:00-12:30']), arbeitstag('2026-08-04', '08:00', '16:00', ['12:00-12:30'])];
    const r = tagesreihe(bestand('2026-08-03', tage), '2026-08-04', '2026-08-04', HEUTE);
    expect(r.saldoVorher).toBe(30);
    expect(r.zeilen[0].saldo).toBe(-30);
    expect(r.saldoNachher).toBe(0);
  });
});

describe('B4 Urlaubskonto', () => {
  it('Beispiel aus dem Konzept: 21.12.2026 – 04.01.2027 = 8 Tage', () => {
    const tage = [...tageVonBis('2026-12-21', '2027-01-04')].map((d) => tagesart(d, 'urlaub'));
    const daten = bestand('2026-01-01', tage);
    const k26 = urlaubskonto(daten, 2026, HEUTE);
    const k27 = urlaubskonto(daten, 2027, HEUTE);
    expect(k26.geplant + k27.geplant).toBe(8);
    expect(k26.geplant).toBe(7);
  });

  it('Rest mit Resturlaub, Sonderurlaub und Übertrag ins Folgejahr', () => {
    const buchungen: Buchung[] = [
      { id: 'r', konto: 'urlaub', art: 'resturlaub', datum: '2026-01-01', betrag: 19 },
      { id: 's', konto: 'urlaub', art: 'sonderurlaub', datum: '2026-05-01', betrag: 1 }
    ];
    const tage = [tagesart('2026-01-02', 'urlaub'), tagesart('2026-11-02', 'urlaub')];
    const daten = bestand('2026-01-01', tage, buchungen);
    const k = urlaubskonto(daten, 2026, HEUTE);
    expect(k).toMatchObject({ gesamt: 51, genommen: 1, geplant: 1, rest: 49 });
    expect(urlaubskonto(daten, 2027, HEUTE)).toMatchObject({ uebertrag: 49, jahresanspruch: 31, gesamt: 80 });
  });
});

describe('Kalender vor dem App-Start', () => {
  it('zeigt Tage vor dem Start nicht als „ohne Eintrag“', () => {
    const r = tagesreihe(bestand('2026-03-09'), '2026-03-05', '2026-03-10', HEUTE);
    expect(r.zeilen.map((z) => z.status)).toEqual(['frei', 'frei', 'frei', 'frei', 'ohneEintrag', 'ohneEintrag']);
    expect(r.saldoNachher).toBe(-960);
  });
});

describe('B4 Urlaubszeiträume', () => {
  it('fasst zusammenhängende Urlaubstage zu Zeiträumen zusammen', () => {
    const tage = [
      '2026-01-02',
      ...['2026-06-19', '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06'],
      '2026-09-28', '2026-09-29'
    ].map((d) => tagesart(d, 'urlaub'));
    const z = urlaubszeitraeume(bestand('2026-01-01', tage), 2026, HEUTE);
    expect(z).toEqual([
      { von: '2026-01-02', bis: '2026-01-02', tage: 1, geplant: false },
      { von: '2026-06-19', bis: '2026-07-06', tage: 12, geplant: false },
      { von: '2026-09-28', bis: '2026-09-28', tage: 1, geplant: false },
      { von: '2026-09-29', bis: '2026-09-29', tage: 1, geplant: true }
    ]);
  });
});
