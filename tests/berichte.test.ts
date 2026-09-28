import { describe, expect, it } from 'vitest';
import {
  anwesenheit,
  berichtTage,
  blaettere,
  csvJahr,
  csvKonten,
  csvTage,
  jahresuebersicht,
  kalenderwoche,
  stempelungen,
  zeitraumFuer
} from '../src/core/berichte';
import { setzeArbeitsort } from '../src/core/bearbeiten';
import type { Buchung } from '../src/core/modell';
import { arbeitstag, bestand, tagesart } from './hilfen';

const HEUTE = '2026-09-28';

describe('D Zeiträume', () => {
  it('Kalenderwochen nach ISO', () => {
    expect(kalenderwoche('2026-08-24')).toBe(35);
    expect(kalenderwoche('2026-01-01')).toBe(1);
    expect(kalenderwoche('2027-01-01')).toBe(53);
    expect(kalenderwoche('2026-12-31')).toBe(53);
  });

  it('Woche Mo–So, Monat, Jahr', () => {
    expect(zeitraumFuer('woche', '2026-08-27')).toMatchObject({ von: '2026-08-24', bis: '2026-08-30', titel: 'KW 35 · 24.08. – 30.08.2026' });
    expect(zeitraumFuer('monat', '2026-02-10')).toMatchObject({ von: '2026-02-01', bis: '2026-02-28', titel: 'Februar 2026' });
    expect(zeitraumFuer('jahr', '2026-05-05')).toMatchObject({ von: '2026-01-01', bis: '2026-12-31' });
    expect(zeitraumFuer('tag', '2026-04-21').titel).toBe('Di, 21.04.2026');
  });

  it('blättert über Monats- und Jahresgrenzen', () => {
    expect(blaettere('monat', '2026-01-31', -1)).toBe('2025-12-28');
    expect(blaettere('monat', '2026-12-15', 1)).toBe('2027-01-15');
    expect(blaettere('woche', '2026-08-24', 1)).toBe('2026-08-31');
  });
});

describe('D Tagesnachweis', () => {
  const t = arbeitstag('2026-04-21', '09:30', '16:30', ['12:30-13:00']);

  it('Buchungen im Kommen/Gehen-Format wie im Firmensystem', () => {
    expect(stempelungen(t).map((s) => `${s.zeit} ${s.art}`)).toEqual(['570 K', '750 G', '780 K', '990 G']);
    expect(anwesenheit(t)).toEqual([{ von: 570, bis: 750 }, { von: 780, bis: 990 }]);
  });

  it('Bemerkung mit Arbeitsort und Anlass', () => {
    const mitOrt = setzeArbeitsort(t, 'ausser_haus', 'Regional-Info-Tag', '');
    const { zeilen } = berichtTage(bestand('2026-03-09', [mitOrt]), '2026-04-21', '2026-04-21', HEUTE);
    expect(zeilen[0]).toMatchObject({ ist: 390, soll: 480, saldo: -90, bemerkung: 'Außer Haus: Regional-Info-Tag' });
  });
});

describe('D Monats- und Jahresberichte', () => {
  const tage = [
    arbeitstag('2026-08-31', '08:46', '18:07', ['12:02-12:23', '14:44-14:56', '16:10-16:23', '17:23-17:36']),
    arbeitstag('2026-08-01', '11:03', '15:55', ['12:24-12:41', '15:09-15:21']),
    tagesart('2026-08-14', 'urlaub')
  ];
  const b: Buchung[] = [{ id: 'a', konto: 'zeit', art: 'auszahlung', datum: '2026-08-20', betrag: -600, kommentar: 'Juli' }];
  const daten = bestand('2026-08-01', tage, b);

  it('Summen eines Monats', () => {
    const { summen } = berichtTage(daten, '2026-08-01', '2026-08-31', HEUTE);
    expect(summen.ist).toBe(502 + 263);
    expect(summen.zuschlag).toBe(9);
    expect(summen.zuschlagTage).toBe(1);
    expect(summen.anwesenheitstage).toBe(2);
    expect(summen.urlaubstage).toBe(1);
    // 21 Werktage, davon 1 Urlaub → 20 × 8:00 Soll
    expect(summen.soll).toBe(20 * 480);
    expect(summen.buchungen).toBe(-600);
    expect(summen.saldoNachher - summen.saldoVorher).toBe(502 - 9 + 263 - 20 * 480 - 600);
  });

  it('Jahresübersicht bis zum aktuellen Monat', () => {
    const j = jahresuebersicht(daten, 2026, HEUTE);
    expect(j).toHaveLength(9);
    expect(j[0].vorStart).toBe(true);
    expect(j[7]).toMatchObject({ name: 'August', anwesenheitstage: 2, zuschlag: 9, urlaub: 1, samstage: 1 });
  });

  it('CSV mit Semikolon, BOM, Minuten und h:mm', () => {
    const csv = csvTage(daten, '2026-08-31', '2026-08-31', HEUTE);
    expect(csv.startsWith('﻿Datum;Wochentag;')).toBe(true);
    const zeile = csv.split('\r\n')[1].split(';');
    expect(zeile.slice(0, 7)).toEqual(['2026-08-31', 'Mo', 'Arbeitstag', 'Büro', '', '08:46', '18:07']);
    expect(zeile[7]).toBe('08:46 K 12:02 G 12:23 K 14:44 G 14:56 K 16:10 G 16:23 K 17:23 G 17:36 K 18:07 G');
    expect(zeile.slice(10, 15)).toEqual(['8:22', '502', '480', '9', '13']);
    expect(csvJahr(daten, 2026, HEUTE).split('\r\n')[8]).toContain('August;2;');
    expect(csvKonten(daten, '2026-08-01', '2026-08-31', HEUTE)).toContain('Zeitkonto;2026-08-20;Auszahlung;-10:00;h:mm;Auszahlung · Juli');
  });
});
