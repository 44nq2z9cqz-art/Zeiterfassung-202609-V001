import { describe, expect, it } from 'vitest';
import { urlaubskonto } from '../src/core/konten';
import type { Buchung, Urlaubsantrag } from '../src/core/modell';
import { anspruch, antragTage, antraegeAusKalender, antragsliste, kalenderFuer, offeneTage, pruefeAntrag } from '../src/core/urlaubsantrag';
import { tageVonBis } from '../src/core/zeit';
import { arbeitstag, bestand, tagesart } from './hilfen';

const HEUTE = '2026-09-29';
const AM = '2026-09-29T08:00:00Z';
const rest19: Buchung = { id: 'r', konto: 'urlaub', art: 'resturlaub', datum: '2026-01-01', betrag: 19 };
const antrag = (von: string, bis: string, x: Partial<Urlaubsantrag> = {}): Urlaubsantrag => ({ id: von, von, bis, genehmigt: false, erstelltAm: AM, ...x });

describe('Urlaubsantrag', () => {
  it('zählt Urlaubstage ohne Wochenenden und Feiertage, 24./31.12. je ½', () => {
    expect(antragTage('2026-11-02', '2026-11-13')).toBe(10);
    expect(antragTage('2026-12-21', '2026-12-31')).toBe(7);
    expect(antragTage('2026-12-25', '2026-12-27')).toBe(0);
  });

  it('Liste mit laufender Rechnung wie im Urlaubsschein, gestrichene zählen nicht', () => {
    const daten = bestand('2026-01-01', [], [rest19]);
    daten.antraege = [
      antrag('2026-11-02', '2026-11-13'),
      antrag('2026-01-02', '2026-01-02', { genehmigt: true }),
      antrag('2026-12-24', '2026-12-31', { gestrichen: { am: '2026-09-29' } }),
      antrag('2026-06-19', '2026-07-06', { genehmigt: true, genehmigtAm: '2026-01-21', vertretung: 'ABC' })
    ];
    const l = antragsliste(daten, 2026, HEUTE);
    expect(l.map((z) => [z.antrag.von, z.status, z.tage, z.anspruch, z.rest])).toEqual([
      ['2026-01-02', 'genehmigt', 1, 50, 49],
      ['2026-06-19', 'genehmigt', 12, 49, 37],
      ['2026-11-02', 'beantragt', 10, 37, 27],
      // 24.12. ½ + 28.–30.12. je 1 + 31.12. ½ = 4
      ['2026-12-24', 'gestrichen', 4, 27, 27]
    ]);
    expect(offeneTage(daten, 2026)).toBe(10);
    expect(anspruch(daten, 2026, HEUTE)).toEqual({ resturlaub: 19, jahresurlaub: 31, sonderurlaub: 0, gesamt: 50 });
  });

  it('prüft Zeitraum, Jahreswechsel und Überschneidungen', () => {
    const alle = [antrag('2026-11-02', '2026-11-13')];
    expect(pruefeAntrag(antrag('2026-11-10', '2026-11-20', { id: 'x' }), alle)).toMatch(/überschneidet sich mit dem Antrag 02.11.2026/);
    expect(pruefeAntrag(antrag('2026-12-28', '2027-01-04', { id: 'y' }), alle)).toMatch(/Jahreswechsel/);
    expect(pruefeAntrag(antrag('2026-11-14', '2026-11-15', { id: 'z' }), alle)).toMatch(/kein Arbeitstag/);
    expect(pruefeAntrag(antrag('2026-11-16', '2026-11-20', { id: 'w' }), alle)).toBeNull();
    // gestrichene Anträge blockieren nichts
    expect(pruefeAntrag(antrag('2026-11-02', '2026-11-03', { id: 'v' }), [antrag('2026-11-02', '2026-11-13', { gestrichen: { am: '2026-09-29' } })])).toBeNull();
  });
});

describe('Urlaubsantrag und Kalender', () => {
  it('erst die Genehmigung trägt den Urlaub in den Kalender ein', () => {
    const a = antrag('2026-11-02', '2026-11-13');
    expect(kalenderFuer(new Map(), null, a, AM).speichern).toHaveLength(0);
    const g = { ...a, genehmigt: true, genehmigtAm: '2026-09-30' };
    const r = kalenderFuer(new Map(), a, g, AM);
    expect(r.speichern.map((t) => t.datum)).toEqual([...tageVonBis('2026-11-02', '2026-11-13')].filter((d) => ![0, 6].includes(new Date(d + 'T12:00Z').getUTCDay())));
    expect(r.speichern.every((t) => t.art === 'urlaub')).toBe(true);
  });

  it('Streichen entfernt den Urlaub wieder, gestempelte Arbeit bleibt', () => {
    const g = antrag('2026-11-02', '2026-11-04', { genehmigt: true });
    const tage = new Map([
      ['2026-11-02', tagesart('2026-11-02', 'urlaub')],
      ['2026-11-03', arbeitstag('2026-11-03', '08:00', '16:00')],
      ['2026-11-04', tagesart('2026-11-04', 'urlaub')]
    ]);
    const r = kalenderFuer(tage, g, { ...g, gestrichen: { am: '2026-10-01' } }, AM);
    expect(r.loeschen.sort()).toEqual(['2026-11-02', '2026-11-04']);
    expect(r.speichern).toHaveLength(0);
  });

  it('Zeitraum eines genehmigten Antrags verschieben', () => {
    const g = antrag('2026-11-02', '2026-11-03', { genehmigt: true });
    const tage = new Map([['2026-11-02', tagesart('2026-11-02', 'urlaub')], ['2026-11-03', tagesart('2026-11-03', 'urlaub')]]);
    const r = kalenderFuer(tage, g, { ...g, von: '2026-11-03', bis: '2026-11-04' }, AM);
    expect(r.loeschen).toEqual(['2026-11-02']);
    expect(r.speichern.map((t) => t.datum).sort()).toEqual(['2026-11-03', '2026-11-04']);
  });

  it('legt für vorhandenen Urlaub einmalig genehmigte Anträge an', () => {
    const tage = ['2026-01-02', '2026-06-19', '2026-06-22', '2026-06-23', '2026-09-28', '2026-09-29'].map((d) => tagesart(d, 'urlaub'));
    const daten = bestand('2026-01-01', tage, [rest19]);
    const a = antraegeAusKalender(daten, AM);
    expect(a.map((x) => [x.von, x.bis, x.genehmigt])).toEqual([
      ['2026-01-02', '2026-01-02', true],
      ['2026-06-19', '2026-06-23', true],
      ['2026-09-28', '2026-09-29', true]
    ]);
    // Zahlen bleiben gleich: Rest laut Anträgen = Rest laut Urlaubskonto
    daten.antraege = a;
    expect(antragsliste(daten, 2026, HEUTE).at(-1)!.rest).toBe(urlaubskonto(daten, 2026, HEUTE).rest);
  });
});
