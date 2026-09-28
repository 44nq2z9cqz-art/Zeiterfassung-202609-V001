import { describe, expect, it } from 'vitest';
import { standardEinstellungen } from '../src/core/einstellungen';
import { bewerteTag, sollMinuten, urlaubstagWert } from '../src/core/regeln';
import { arbeitstag, tagesart } from './hilfen';

const e = standardEinstellungen('2026-03-09');
const HEUTE = '2026-09-28';

describe('B1 Sollarbeitszeit', () => {
  it('Mo–Fr 8:00, Wochenende und Feiertag 0:00', () => {
    expect(sollMinuten('2026-08-31', undefined, e)).toBe(480);
    expect(sollMinuten('2026-08-01', undefined, e)).toBe(0);
    expect(sollMinuten('2026-08-02', undefined, e)).toBe(0);
    expect(sollMinuten('2026-05-14', undefined, e)).toBe(0);
  });

  it('24.12. und 31.12. nur als Werktag 4:00', () => {
    expect(sollMinuten('2026-12-24', undefined, e)).toBe(240);
    expect(sollMinuten('2026-12-31', undefined, e)).toBe(240);
    expect(sollMinuten('2027-12-25', undefined, e)).toBe(0);
    expect(sollMinuten('2022-12-24', undefined, e)).toBe(0); // Samstag
  });

  it('eine geänderte Sollzeit gilt erst ab ihrem Datum', () => {
    const e2 = standardEinstellungen('2026-03-09');
    e2.wochenstunden = [...e2.wochenstunden, { ab: '2026-10-01', wert: 35 * 60 }];
    expect(sollMinuten('2026-09-30', undefined, e2)).toBe(480);
    expect(sollMinuten('2026-10-01', undefined, e2)).toBe(420);
  });

  it('abweichende Sollzeit für einen einzelnen Tag', () => {
    const t = { ...arbeitstag('2026-08-31', '08:00', '12:00'), sollAbweichung: 240 };
    expect(bewerteTag('2026-08-31', t, e, HEUTE).saldo).toBe(0);
  });
});

describe('B2 Pausenregel – Beispiele aus dem Konzept', () => {
  const d = '2026-08-31'; // Montag
  const fall = (pausen: string[]) => bewerteTag(d, arbeitstag(d, '08:00', '17:00', pausen), e, HEUTE);

  it.each([
    [['12:00-12:30'], 30, 30, 0],
    [['12:00-12:20'], 20, 20, 10],
    [['11:30-11:40', '13:00-13:10', '13:30-13:40'], 30, 10, 5],
    [['12:00-12:10', '13:00-13:05'], 15, 10, 15],
    [[], 0, 0, 30],
    [['13:50-14:20'], 10, 10, 20]
  ])('Pausen %j → im Fenster %i, längste %i, Zuschlag %i', (pausen, imFenster, laengste, zuschlag) => {
    const r = fall(pausen as string[]);
    expect(r.fenster?.imFenster).toBe(imFenster);
    expect(r.fenster?.laengste).toBe(laengste);
    expect(r.zuschlag).toBe(zuschlag);
  });

  it('31.08.2026 wie im Firmenjournal: 8:22 Anwesenheit, 9 Min Zuschlag, +0:13', () => {
    const t = arbeitstag(d, '08:46', '18:07', ['12:02-12:23', '14:44-14:56', '16:10-16:23', '17:23-17:36']);
    const r = bewerteTag(d, t, e, HEUTE);
    expect(r.ist).toBe(502);
    expect(r.zuschlag).toBe(9);
    expect(r.saldo).toBe(13);
  });

  it('greift nicht, wenn das Fenster nicht vollständig abgedeckt ist', () => {
    expect(bewerteTag(d, arbeitstag(d, '11:03', '17:00'), e, HEUTE).zuschlag).toBe(0);
    expect(bewerteTag(d, arbeitstag(d, '08:00', '13:00'), e, HEUTE).zuschlag).toBe(0);
  });

  it('gilt nicht am Wochenende und an Feiertagen (Soll 0)', () => {
    expect(bewerteTag('2026-08-01', arbeitstag('2026-08-01', '08:00', '16:00'), e, HEUTE).zuschlag).toBe(0);
    expect(bewerteTag('2026-05-14', arbeitstag('2026-05-14', '08:00', '16:00'), e, HEUTE).zuschlag).toBe(0);
  });

  it('Freitag lässt sich abschalten', () => {
    const e2 = standardEinstellungen('2026-03-09');
    e2.pausenregel = [{ ab: '2000-01-01', wert: { ...e2.pausenregel[0].wert, wochentage: [1, 2, 3, 4] } }];
    const fr = '2026-08-28';
    expect(bewerteTag(fr, arbeitstag(fr, '08:00', '17:00'), e, HEUTE).zuschlag).toBe(30);
    expect(bewerteTag(fr, arbeitstag(fr, '08:00', '17:00'), e2, HEUTE).zuschlag).toBe(0);
  });

  it('wirkt erst ab dem Datum, ab dem sie eingeschaltet ist', () => {
    const e2 = standardEinstellungen('2026-03-09');
    e2.pausenregel = [
      { ab: '2000-01-01', wert: { ...e2.pausenregel[0].wert, aktiv: false } },
      { ab: '2026-09-01', wert: { ...e2.pausenregel[0].wert, aktiv: true } }
    ];
    expect(bewerteTag(d, arbeitstag(d, '08:00', '17:00'), e2, HEUTE).zuschlag).toBe(0);
    expect(bewerteTag('2026-09-01', arbeitstag('2026-09-01', '08:00', '17:00'), e2, HEUTE).zuschlag).toBe(30);
  });
});

describe('B5 Tagesarten', () => {
  it('Urlaub und Krank: Soll erfüllt, Saldo 0', () => {
    expect(bewerteTag('2026-06-22', tagesart('2026-06-22', 'urlaub'), e, HEUTE).saldo).toBe(0);
    expect(bewerteTag('2026-06-22', tagesart('2026-06-22', 'krank'), e, HEUTE).saldo).toBe(0);
  });

  it('Gleittag und vergangener Werktag ohne Eintrag: −8:00', () => {
    expect(bewerteTag('2026-07-22', tagesart('2026-07-22', 'gleittag'), e, HEUTE).saldo).toBe(-480);
    const r = bewerteTag('2026-07-23', undefined, e, HEUTE);
    expect(r.status).toBe('ohneEintrag');
    expect(r.saldo).toBe(-480);
  });

  it('heutiger und künftiger Tag ohne Eintrag zählen nicht', () => {
    expect(bewerteTag(HEUTE, undefined, e, HEUTE).saldo).toBe(0);
    expect(bewerteTag('2026-09-30', undefined, e, HEUTE).saldo).toBe(0);
  });

  it('Samstagsarbeit zählt voll als Plus', () => {
    expect(bewerteTag('2026-08-01', arbeitstag('2026-08-01', '11:03', '15:55', ['12:24-12:41', '15:09-15:21']), e, HEUTE).saldo).toBe(263);
  });

  it('Arbeit über Mitternacht', () => {
    const t = arbeitstag('2026-08-31', '20:00', '02:00');
    t.gehen! += 1440;
    expect(bewerteTag('2026-08-31', t, e, HEUTE).ist).toBe(360);
  });
});

describe('B4 Urlaubstage', () => {
  it('Werktag 1, 24.12./31.12. 0,5, Wochenende und Feiertag 0', () => {
    expect(urlaubstagWert('2026-12-21')).toBe(1);
    expect(urlaubstagWert('2026-12-24')).toBe(0.5);
    expect(urlaubstagWert('2026-12-25')).toBe(0);
    expect(urlaubstagWert('2026-12-26')).toBe(0);
    expect(urlaubstagWert('2027-01-01')).toBe(0);
  });
});
