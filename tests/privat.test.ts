// Abgleich mit der echten Datensicherung. Datensicherung und Sollwerte liegen nur lokal im Ordner privat/
// (per .gitignore gesperrt). Fehlen sie – etwa auf GitHub –, wird dieser Test übersprungen.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importiereAltBackup } from '../src/core/import-altapp';
import { tagesreihe, zeitkontoSaldo } from '../src/core/konten';

interface Erwartung {
  datei: string;
  heute: string;
  appStart: string;
  saldoAlt: number;
  saldoNeu: number;
  zuschlaege: { tage: number; minuten: number };
  pausenrundung: number;
  arbeitstage: number;
  pausen: number;
  doppeltipp: number;
  monat: { von: string; bis: string; ist: number; saldo: number; saldoEnde: number };
  tage: { datum: string; zuschlag: number }[];
}

const pfad = new URL('../privat/erwartung.json', import.meta.url);
const erwartung: Erwartung | null = existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf-8')) : null;

describe.skipIf(!erwartung)('Echte Datensicherung (nur lokal)', () => {
  const e = erwartung!;
  const json = erwartung ? JSON.parse(readFileSync(new URL(`../privat/${e.datei}`, import.meta.url), 'utf-8')) : null;
  const { daten, bericht } = erwartung ? importiereAltBackup(json, e.heute) : ({} as never);

  it('Prüfbericht', () => {
    expect(daten.einstellungen.appStart).toBe(e.appStart);
    expect(bericht.saldoAlt).toBe(e.saldoAlt);
    expect(bericht.saldoNeu).toBe(e.saldoNeu);
    expect(bericht.zuschlaege).toEqual(e.zuschlaege);
    expect(bericht.pausenrundung).toBe(e.pausenrundung);
    expect(bericht.arbeitstage).toBe(e.arbeitstage);
    expect(bericht.pausen).toBe(e.pausen);
    expect(bericht.doppeltipp).toHaveLength(e.doppeltipp);
  });

  it('Monat wie im Firmenjournal', () => {
    const r = tagesreihe(daten, e.monat.von, e.monat.bis, e.heute);
    expect(r.zeilen.reduce((s, z) => s + (z.ist ?? 0), 0)).toBe(e.monat.ist);
    expect(r.saldoNachher - r.saldoVorher).toBe(e.monat.saldo);
    expect(zeitkontoSaldo(daten, e.monat.bis, e.heute)).toBe(e.monat.saldoEnde);
    for (const t of e.tage) expect(r.zeilen.find((z) => z.datum === t.datum)?.zuschlag).toBe(t.zuschlag);
  });
});
