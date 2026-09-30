import { describe, expect, it } from 'vitest';
import { erstelleBackup, pruefeBackup, tageSeitBackup } from '../src/core/backup';
import { entferneAb, gueltigAm, setzeAb } from '../src/core/einstellungen';
import { zeitkontoSaldo } from '../src/core/konten';
import { arbeitstag, bestand, tagesart } from './hilfen';

const HEUTE = '2026-09-28';

describe('F Backup', () => {
  const daten = bestand('2026-08-03', [arbeitstag('2026-08-03', '08:00', '17:00', ['12:00-12:30']), tagesart('2026-08-04', 'urlaub')], [
    { id: 'v', konto: 'zeit', art: 'vortrag', datum: '2026-08-02', betrag: 600 }
  ]);
  daten.einstellungen.name = 'Test';

  it('Sichern und Wiederherstellen ergibt denselben Datenbestand', () => {
    const json = JSON.parse(JSON.stringify(erstelleBackup(daten, '0.6.0', new Date('2026-09-28T10:00:00Z'))));
    const r = pruefeBackup(json);
    expect(r.fehler).toBeUndefined();
    expect(r.vorschau).toMatchObject({ tage: 2, arbeitstage: 1, buchungen: 1, von: '2026-08-03', bis: '2026-08-04', appVersion: '0.6.0' });
    expect(zeitkontoSaldo(r.daten!, '2026-08-04', HEUTE)).toBe(zeitkontoSaldo(daten, '2026-08-04', HEUTE));
    expect(r.daten!.einstellungen.name).toBe('Test');
  });

  it('erkennt fremde, alte, neuere und beschädigte Dateien', () => {
    expect(pruefeBackup({ foo: 1 }).fehler).toMatch(/kein Backup/);
    expect(pruefeBackup({ app: 'Zeiterfassung Pro', data: {} })).toMatchObject({ altApp: true });
    const neu = { ...JSON.parse(JSON.stringify(erstelleBackup(daten, '9'))), schema: 99 };
    expect(pruefeBackup(neu).fehler).toMatch(/neueren App-Version/);
    const kaputt = JSON.parse(JSON.stringify(erstelleBackup(daten, '0.6.0')));
    kaputt.tage[0].datum = 'gestern';
    expect(pruefeBackup(kaputt).fehler).toMatch(/beschädigt/);
  });

  it('ergänzt fehlende Einstellungen mit Standardwerten', () => {
    const b = JSON.parse(JSON.stringify(erstelleBackup(daten, '0.6.0')));
    delete b.einstellungen.hinweise.backupNachTagen;
    expect(pruefeBackup(b).daten!.einstellungen.hinweise.backupNachTagen).toBe(7);
  });

  it('Tage seit dem letzten Backup', () => {
    expect(tageSeitBackup(undefined)).toBeNull();
    expect(tageSeitBackup('2026-09-20T10:00:00Z', new Date('2026-09-28T09:00:00Z'))).toBe(8);
    // Kalendertage statt 24-Stunden-Blöcke: gestern Abend ist heute früh „gestern“
    expect(tageSeitBackup(new Date(2026, 8, 29, 18, 0).toISOString(), new Date(2026, 8, 30, 8, 0))).toBe(1);
    expect(tageSeitBackup(new Date(2026, 8, 30, 7, 0).toISOString(), new Date(2026, 8, 30, 23, 0))).toBe(0);
  });
});

describe('B1 Einstellungen mit „gültig ab“', () => {
  it('neuer Wert ab Datum, alter bleibt für die Vergangenheit', () => {
    let l = [{ ab: '2000-01-01', wert: 2400 }];
    l = setzeAb(l, '2026-10-01', 2100);
    expect(gueltigAm(l, '2026-09-30')).toBe(2400);
    expect(gueltigAm(l, '2026-10-01')).toBe(2100);
    l = setzeAb(l, '2026-10-01', 2000);
    expect(l).toHaveLength(2);
    expect(entferneAb(l, '2026-10-01')).toEqual([{ ab: '2000-01-01', wert: 2400 }]);
    expect(entferneAb(l, '2000-01-01')).toHaveLength(2);
  });
});
