import { describe, expect, it } from 'vitest';
import { standardEinstellungen } from '../src/core/einstellungen';
import { bewerteTag } from '../src/core/regeln';
import { fortsetzen, gehen, kommen, laufenderTag, liveStand, pauseBeenden, pauseStarten, type Zeitpunkt } from '../src/core/stempeln';
import { parseUhrzeit } from '../src/core/zeit';
import { arbeitstag } from './hilfen';

const e = standardEinstellungen('2026-03-09');
const D = '2026-08-06'; // Donnerstag

/** Zeitpunkt am 06.08.2026, z. B. zp('09:02') oder zp('09:02:30') */
function zp(uhr: string, datum = D, minutenVersatz = 0): Zeitpunkt {
  const [h, m, s = '00'] = uhr.split(':');
  return { datum, minute: Number(h) * 60 + Number(m) + minutenVersatz, iso: `${datum}T${h}:${m}:${s}+02:00` };
}

describe('C Stempeln', () => {
  it('Kommen, zwei Pausen, Gehen – mit Protokoll', () => {
    let t = kommen(undefined, zp('09:02'));
    t = pauseStarten(t, zp('10:45'));
    t = pauseBeenden(t, zp('10:59')).tag;
    t = pauseStarten(t, zp('12:19'));
    t = pauseBeenden(t, zp('12:36')).tag;
    t = gehen(t, zp('17:30'));
    expect(t.kommen).toBe(parseUhrzeit('09:02'));
    expect(t.gehen).toBe(parseUhrzeit('17:30'));
    expect(t.pausen.map((p) => [p.beginn, p.ende])).toEqual([[645, 659], [739, 756]]);
    expect(t.pausen.every((p) => p.quelle === 'live')).toBe(true);
    expect(t.protokoll.map((p) => p.feld)).toEqual(['kommen', 'pause beginn', 'pause ende', 'pause beginn', 'pause ende', 'gehen']);
    expect(bewerteTag(D, t, e, '2026-09-28').ist).toBe(508 - 31);
  });

  it('verwirft eine Pause unter einer Minute (Doppeltippen)', () => {
    let t = kommen(undefined, zp('09:00'));
    t = pauseStarten(t, zp('12:00:10'));
    const r = pauseBeenden(t, zp('12:00:40'));
    expect(r.verworfen).toBe(true);
    expect(r.tag.pausen).toHaveLength(0);
  });

  it('Gehen beendet eine laufende Pause', () => {
    let t = kommen(undefined, zp('09:00'));
    t = pauseStarten(t, zp('12:00'));
    t = gehen(t, zp('12:30'));
    expect(t.pausen[0].ende).toBe(750);
    expect(t.gehen).toBe(750);
  });

  it('doppeltes Kommen oder Pause ohne Kommen ändert nichts', () => {
    const t = kommen(undefined, zp('09:00'));
    expect(kommen(t, zp('09:05')).kommen).toBe(540);
    const leer = { ...t, kommen: null };
    expect(pauseStarten(leer, zp('10:00')).pausen).toHaveLength(0);
  });

  it('versehentliches Gehen lässt sich zurücknehmen', () => {
    let t = gehen(kommen(undefined, zp('09:00')), zp('10:00'));
    t = fortsetzen(t, zp('10:01'));
    expect(t.gehen).toBeNull();
    expect(t.protokoll.at(-1)).toMatchObject({ feld: 'gehen', alt: '10:00', neu: null });
  });
});

describe('C Live-Stand', () => {
  it('06.08. um 13:10: 3:37 gearbeitet, 17 von 30 Min im Fenster, 15-Min-Pause erfüllt', () => {
    const t = arbeitstag(D, '09:02', '00:00', ['10:45-10:59', '12:19-12:36']);
    t.gehen = null;
    const s = liveStand(D, t, e, parseUhrzeit('13:10')!)!;
    expect(s.ist).toBe(3 * 60 + 37);
    expect(s.fenster).toMatchObject({ imFenster: 17, laengste: 17, fehlendGesamt: 13, fehlendEinzel: 0, greift: false, zuschlag: 0 });
    expect(s.ohnePause).toBe(34);
  });

  it('eine laufende Pause zählt live mit', () => {
    const t = arbeitstag(D, '09:00', '00:00');
    t.gehen = null;
    t.pausen = [{ id: 'p', beginn: parseUhrzeit('12:00')!, ende: null, quelle: 'live' }];
    const s = liveStand(D, t, e, parseUhrzeit('12:20')!)!;
    expect(s.pausen).toBe(20);
    expect(s.fenster?.imFenster).toBe(20);
    expect(s.ohnePause).toBe(0);
  });

  it('nach 14:00 zeigt der Live-Stand den Zuschlag', () => {
    const t = arbeitstag(D, '08:00', '00:00', ['12:00-12:20']);
    t.gehen = null;
    const s = liveStand(D, t, e, parseUhrzeit('16:00')!)!;
    expect(s.fenster?.zuschlag).toBe(10);
    expect(s.saldo).toBe(480 - 20 - 10 - 480);
  });
});

describe('C Laufender Tag über Mitternacht', () => {
  it('bleibt beim gestrigen Tag, solange er offen ist', () => {
    const gestern = arbeitstag('2026-08-06', '20:00', '00:00');
    gestern.gehen = null;
    const tage = new Map([[gestern.datum, gestern]]);
    expect(laufenderTag(tage, new Date(2026, 7, 7, 1, 30))).toEqual({ datum: '2026-08-06', minute: 1440 + 90 });
    expect(laufenderTag(new Map(), new Date(2026, 7, 7, 1, 30))).toEqual({ datum: '2026-08-07', minute: 90 });
  });
});
