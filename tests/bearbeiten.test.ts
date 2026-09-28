import { describe, expect, it } from 'vitest';
import {
  istLeer,
  loeschePause,
  setzeArbeitsort,
  setzeArt,
  setzeGehen,
  setzeKommen,
  setzeKommentar,
  setzePause,
  setzeSoll,
  zeitraumSetzen
} from '../src/core/bearbeiten';
import { standardEinstellungen } from '../src/core/einstellungen';
import { bewerteTag } from '../src/core/regeln';
import { leererTag } from '../src/core/stempeln';
import { parseUhrzeit } from '../src/core/zeit';
import { arbeitstag, tagesart } from './hilfen';

const AM = '2026-09-29T10:00:00.000Z';
const u = (t: string) => parseUhrzeit(t)!;
const e = standardEinstellungen('2026-03-09');

describe('C Tag bearbeiten', () => {
  it('Kommen und Gehen nachtragen, mit Quelle „manuell“ und Protokoll', () => {
    let t = setzeKommen(leererTag('2026-04-21'), u('09:30'), AM).tag!;
    t = setzeGehen(t, u('16:30'), AM).tag!;
    expect(t).toMatchObject({ kommen: 570, gehen: 990, kommenQuelle: 'manuell', gehenQuelle: 'manuell' });
    expect(t.protokoll).toEqual([
      { am: AM, feld: 'kommen', alt: null, neu: '09:30' },
      { am: AM, feld: 'gehen', alt: null, neu: '16:30' }
    ]);
  });

  it('Gehen vor Kommen gilt als über Mitternacht', () => {
    const t = setzeGehen(setzeKommen(leererTag('2026-08-31'), u('20:00'), AM).tag!, u('02:00'), AM).tag!;
    expect(t.gehen).toBe(1440 + 120);
  });

  it('lehnt unsinnige Zeiten mit verständlicher Meldung ab', () => {
    expect(setzeGehen(leererTag('2026-08-31'), u('17:00'), AM).fehler).toMatch(/Kommen-Zeit/);
    const t = arbeitstag('2026-08-31', '08:46', '18:07', ['12:02-12:23']);
    expect(setzeKommen(t, u('18:30'), AM).fehler).toMatch(/vor Gehen/);
    expect(setzePause(t, null, u('12:10'), u('12:30'), AM).fehler).toMatch(/überschneidet sich mit 12:02–12:23/);
    expect(setzePause(t, null, u('07:00'), u('07:30'), AM).fehler).toMatch(/zwischen Kommen \(08:46\) und Gehen \(18:07\)/);
    expect(setzePause(t, null, u('13:00'), u('13:00'), AM).fehler).toMatch(/nach dem Beginn/);
  });

  it('Pause ändern verändert die Pausenregel – 31.08. mit 30 Min Pause ohne Zuschlag', () => {
    const t = arbeitstag('2026-08-31', '08:46', '18:07', ['12:02-12:23']);
    const id = t.pausen[0].id;
    const neu = setzePause(t, id, u('12:02'), u('12:32'), AM).tag!;
    expect(neu.pausen).toHaveLength(1);
    expect(neu.pausen[0]).toMatchObject({ id, beginn: u('12:02'), ende: u('12:32'), quelle: 'manuell' });
    expect(bewerteTag('2026-08-31', neu, e, '2026-09-29').zuschlag).toBe(0);
    expect(neu.protokoll.at(-1)).toMatchObject({ feld: 'pause', alt: '12:02–12:23', neu: '12:02–12:32' });
  });

  it('Pausen hinzufügen und löschen', () => {
    let t = arbeitstag('2026-08-31', '08:00', '17:00');
    t = setzePause(t, null, u('12:00'), u('12:30'), AM).tag!;
    t = setzePause(t, null, u('10:00'), u('10:10'), AM).tag!;
    expect(t.pausen.map((p) => p.beginn)).toEqual([600, 720]);
    t = loeschePause(t, t.pausen[0].id, AM);
    expect(t.pausen).toHaveLength(1);
    expect(t.protokoll.at(-1)).toMatchObject({ alt: '10:00–10:10', neu: null });
  });

  it('Tagesart, Arbeitsort, Anlass, Kommentar und Soll', () => {
    let t = setzeArt(leererTag('2026-04-21'), 'urlaub', AM);
    expect(t.art).toBe('urlaub');
    t = setzeArbeitsort(t, 'ausser_haus', ' Regional-Info-Tag ', AM);
    expect(t).toMatchObject({ arbeitsort: 'ausser_haus', anlass: 'Regional-Info-Tag' });
    t = setzeKommentar(t, 'Seminar', AM);
    t = setzeSoll(t, 360, AM);
    expect(t.sollAbweichung).toBe(360);
    t = setzeSoll(t, null, AM);
    expect('sollAbweichung' in t).toBe(false);
    expect(t.protokoll.map((p) => p.feld)).toEqual(['tagesart', 'arbeitsort', 'anlass', 'kommentar', 'soll', 'soll']);
  });

  it('erkennt leere Tage', () => {
    expect(istLeer(leererTag('2026-04-21'))).toBe(true);
    expect(istLeer(tagesart('2026-04-21', 'urlaub'))).toBe(false);
  });
});

describe('C Urlaub für einen Zeitraum', () => {
  it('02.–13.11.2026: 10 Werktage, Wochenenden frei', () => {
    const r = zeitraumSetzen(new Map(), '2026-11-02', '2026-11-13', 'urlaub', AM);
    expect(r.geaendert).toHaveLength(10);
    expect(r.frei).toBe(2);
    expect(r.geaendert.every((t) => t.art === 'urlaub')).toBe(true);
    const nochmal = zeitraumSetzen(new Map(r.geaendert.map((t) => [t.datum, t])), '2026-11-02', '2026-11-13', 'urlaub', AM);
    expect(nochmal).toMatchObject({ bereits: 10, geaendert: [] });
  });

  it('überschreibt keine Tage mit gestempelter Arbeit', () => {
    const tage = new Map([['2026-11-03', arbeitstag('2026-11-03', '08:00', '16:00')]]);
    const r = zeitraumSetzen(tage, '2026-11-02', '2026-11-04', 'urlaub', AM);
    expect(r.geaendert.map((t) => t.datum)).toEqual(['2026-11-02', '2026-11-04']);
    expect(r.uebersprungen).toEqual(['2026-11-03']);
  });

  it('Feiertag im Zeitraum zählt nicht (02.01.2026 ja, 01.01. nein)', () => {
    const r = zeitraumSetzen(new Map(), '2026-01-01', '2026-01-02', 'urlaub', AM);
    expect(r.geaendert.map((t) => t.datum)).toEqual(['2026-01-02']);
  });
});

describe('C Zeitraum wieder entfernen', () => {
  it('nimmt versehentlich eingetragenen Urlaub zurück und löscht leere Tage', () => {
    const falsch = zeitraumSetzen(new Map(), '2026-01-02', '2026-02-11', 'urlaub', AM).geaendert;
    expect(falsch).toHaveLength(29);
    const tage = new Map(falsch.map((t) => [t.datum, t]));
    tage.set('2026-01-05', setzeKommentar(tage.get('2026-01-05')!, 'bleibt', AM));
    const r = zeitraumSetzen(tage, '2026-01-01', '2026-03-08', 'entfernen', AM);
    expect(r.geloescht).toHaveLength(28);
    expect(r.geaendert.map((t) => [t.datum, t.art])).toEqual([['2026-01-05', 'arbeit']]);
  });
});
