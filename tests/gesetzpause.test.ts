import { describe, expect, it } from 'vitest';
import { setzeAb } from '../src/core/einstellungen';
import { bewerteTag, pruefeGesetzPause } from '../src/core/regeln';
import { arbeitstag, bestand } from './hilfen';

const HEUTE = '2026-10-02';

describe('Gesetzliche Pause ab 9 Stunden (45 Min)', () => {
  it('zieht fehlende Pause ab, aber nie unter 9 Stunden', () => {
    const e = bestand('2026-01-01').einstellungen;
    // 08:00–17:40 mit 30 Min Pause: Ist 9:10, 15 Min fehlen, Abzug nur 10 Min (bis 9:00)
    const r = bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '17:40', ['12:00-12:30']), e, HEUTE);
    expect(r.ist).toBe(9 * 60 + 10);
    expect(r.gesetz).toMatchObject({ erreicht: true, pause: 30, fehlend: 15, zuschlag: 10 });
    expect(r.zuschlag).toBe(10);
    // 08:00–18:30 mit 30 Min: Ist 10:00, volle 15 Min Abzug
    expect(bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '18:30', ['12:00-12:30']), e, HEUTE).gesetz?.zuschlag).toBe(15);
  });

  it('zählt alle Pausen zusammen, auch kurze (wie das Firmensystem)', () => {
    const e = bestand('2026-01-01').einstellungen;
    const r = bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '18:30', ['09:40-09:50', '12:00-12:30', '15:00-15:10']), e, HEUTE);
    expect(r.gesetz).toMatchObject({ pause: 50, fehlend: 0, zuschlag: 0 });
  });

  it('der Zuschlag der Pausenregel 11–14 Uhr zählt als Pause', () => {
    const e = bestand('2026-01-01').einstellungen;
    // 20 Min im Fenster → Fensterzuschlag 10; gesetzlich zählen 20 + 10 = 30, Ist nach Fenster 9:30 → Abzug 15
    const r = bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '18:00', ['12:00-12:20']), e, HEUTE);
    expect(r.fenster?.zuschlag).toBe(10);
    expect(r.gesetz).toMatchObject({ pause: 30, zuschlag: 15 });
    expect(r.zuschlag).toBe(25);
  });

  it('unter 9 Stunden kein Abzug; ausgeschaltet nur Anzeige', () => {
    const e = bestand('2026-01-01').einstellungen;
    expect(bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '17:00', ['12:00-12:30']), e, HEUTE).gesetz).toMatchObject({ erreicht: false, zuschlag: 0 });
    const aus = { ...e, pausenGesetz: setzeAb(e.pausenGesetz!, '2026-01-01', false) };
    const r = bewerteTag('2026-10-01', arbeitstag('2026-10-01', '08:00', '18:30', ['12:00-12:30']), aus, HEUTE);
    expect(r.gesetz).toMatchObject({ erreicht: true, fehlend: 15, zuschlag: 0 });
    // ohne Einstellung (ältere Daten): aus
    expect(pruefeGesetzPause([], 8 * 60, 18 * 60, 0, false).zuschlag).toBe(0);
  });
});
