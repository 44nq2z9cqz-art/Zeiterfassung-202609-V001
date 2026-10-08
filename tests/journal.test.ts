import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { neuerAntrag, rateMitBuchung } from '../src/core/auszahlung';
import { importiereAltBackup } from '../src/core/import-altapp';
import { journalUrlaub, journalZeit, offeneVorgaenge, planstatus } from '../src/core/journal';
import { urlaubskonto, zeitkontoSaldo } from '../src/core/konten';
import type { Datenbestand, Urlaubsantrag } from '../src/core/modell';
import { offeneTage } from '../src/core/urlaubsantrag';
import { arbeitstag, bestand, tagesart } from './hilfen';

const HEUTE = '2026-10-08';
const AM = '2026-09-01T08:00:00Z';
const antrag = (von: string, bis: string, x: Partial<Urlaubsantrag> = {}): Urlaubsantrag => ({ id: von, von, bis, genehmigt: false, erstelltAm: AM, ...x });

function beispiel(): Datenbestand {
  const tage = [arbeitstag('2026-09-01', '08:00', '17:00', ['12:00-12:30']), tagesart('2026-09-14', 'urlaub'), tagesart('2026-09-15', 'urlaub'), tagesart('2026-10-02', 'urlaub')];
  const daten = bestand('2026-09-01', tage, [
    { id: 'v', konto: 'zeit', art: 'vortrag', datum: '2026-08-31', betrag: 50 * 60 },
    { id: 'k', konto: 'zeit', art: 'korrektur', datum: '2026-09-15', betrag: 120 },
    { id: 'r', konto: 'urlaub', art: 'resturlaub', datum: '2026-01-01', betrag: 4 }
  ]);
  daten.antraege = [
    antrag('2026-09-14', '2026-09-15', { genehmigt: true }),
    antrag('2026-11-02', '2026-11-06'),
    antrag('2026-12-28', '2026-12-30', { plan: true }),
    antrag('2026-06-19', '2026-06-23', { genehmigt: true, gestrichen: { am: '2026-06-01' } })
  ];
  let a = neuerAntrag({ stichtag: '2026-09-30', saldo: 0, sockel: 0, ueber: 6000, stunden: 600 }, '2026-10-02');
  const r = rateMitBuchung(a, '2026-10', 300);
  a = r.antrag;
  daten.buchungen.push(r.buchung);
  daten.auszahlungen = [a];
  return daten;
}

describe('Journal Zeitkonto', () => {
  it('Saldo und Monatsenden stimmen mit dem Zeitkonto überein', () => {
    const daten = beispiel();
    const j = journalZeit(daten, 2026, HEUTE);
    expect(j.saldo).toBe(zeitkontoSaldo(daten, HEUTE, HEUTE));
    const sep = j.monate.find((m) => m.schluessel === '2026-09')!;
    expect(sep.saldoEnde).toBe(zeitkontoSaldo(daten, '2026-09-30', HEUTE));
    // Monatszeile + Buchungen ergeben die Saldoänderung des Monats
    const summe = sep.eintraege.reduce((s, e) => s + ('betrag' in e && (e.art === 'monat' || e.art === 'buchung') ? e.betrag : 0), 0);
    expect(summe).toBe(sep.saldoEnde - zeitkontoSaldo(daten, '2026-08-31', HEUTE));
  });

  it('Auszahlungsbuchungen stehen nur am Vorgang, nicht doppelt', () => {
    const j = journalZeit(beispiel(), 2026, HEUTE);
    const alle = j.monate.flatMap((m) => m.eintraege);
    const vorgang = alle.find((e) => e.art === 'auszahlung');
    expect(vorgang).toMatchObject({ status: 'teilweise', offen: 300 });
    expect(alle.some((e) => e.art === 'buchung' && e.buchung.art === 'auszahlung')).toBe(false);
  });
});

describe('Journal Urlaub', () => {
  it('Rest entspricht dem Urlaubskonto abzüglich beantragter und geplanter Tage', () => {
    const daten = beispiel();
    const j = journalUrlaub(daten, 2026, HEUTE);
    const k = urlaubskonto(daten, 2026, HEUTE);
    expect(j.rest).toBe(k.rest - offeneTage(daten, 2026) - offeneTage(daten, 2026, 'geplant'));
    const alle = j.monate.flatMap((m) => m.eintraege);
    // 02.10. steht nur im Kalender (ohne Antrag)
    expect(alle.find((e) => e.art === 'kalender')).toMatchObject({ von: '2026-10-02', tage: 1 });
    expect(alle.filter((e) => e.art === 'auto').map((e) => (e as { text: string }).text)).toEqual(['Jahresanspruch 2026']);
  });

  it('Status „genommen“ ergibt sich aus dem Zeitablauf', () => {
    expect(planstatus(antrag('2026-09-14', '2026-09-15', { genehmigt: true }), HEUTE)).toBe('genommen');
    expect(planstatus(antrag('2026-11-02', '2026-11-06', { genehmigt: true }), HEUTE)).toBe('genehmigt');
    expect(offeneVorgaenge(beispiel(), HEUTE)).toEqual({ beantragt: 1, geplant: 1, auszahlung: 300 });
  });
});

// Gegenprobe mit der echten Datensicherung (nur lokal, liegt in privat/)
const pfad = new URL('../privat/erwartung.json', import.meta.url);
describe.skipIf(!existsSync(pfad))('Journal mit echten Daten (nur lokal)', () => {
  it('Journal-Salden passen zu Zeitkonto und Urlaubskonto', () => {
    const e = JSON.parse(readFileSync(pfad, 'utf-8'));
    const { daten } = importiereAltBackup(JSON.parse(readFileSync(new URL(`../privat/${e.datei}`, import.meta.url), 'utf-8')), e.heute);
    const jahr = Number(e.heute.slice(0, 4));
    expect(journalZeit(daten, jahr, e.heute).saldo).toBe(zeitkontoSaldo(daten, e.heute, e.heute));
    const k = urlaubskonto(daten, jahr, e.heute);
    expect(journalUrlaub(daten, jahr, e.heute).rest).toBe(k.rest - offeneTage(daten, jahr) - offeneTage(daten, jahr, 'geplant'));
  });
});
