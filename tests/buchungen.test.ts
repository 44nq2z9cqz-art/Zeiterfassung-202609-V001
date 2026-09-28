import { describe, expect, it } from 'vitest';
import { appSaldoAm, baueBuchung, parseStunden, parseTage, type Eingabe } from '../src/core/buchungen';
import { urlaubskonto, zeitkontoSaldo } from '../src/core/konten';
import { tageVonBis } from '../src/core/zeit';
import { arbeitstag, bestand } from './hilfen';

const HEUTE = '2026-09-28';
// Beispiel: fünf Tage à 9:00 mit 30 Min Pause → je +0:30, zusammen +2:30
const tage = [...tageVonBis('2026-08-03', '2026-08-07')].map((d) => arbeitstag(d, '08:00', '17:00', ['12:00-12:30']));
const daten = bestand('2026-08-03', tage);
const eingabe = (e: Partial<Eingabe>): Eingabe => ({ konto: 'zeit', art: 'korrektur', datum: '2026-08-07', wert: 0, vorzeichen: 1, kommentar: '', ...e });

describe('Eingaben lesen', () => {
  it('Stunden als h:mm', () => {
    expect(parseStunden('123:45')).toBe(123 * 60 + 45);
    expect(parseStunden('8')).toBe(480);
    expect(parseStunden(' 0:30 ')).toBe(30);
    expect(parseStunden('1:75')).toBeNull();
    expect(parseStunden('abc')).toBeNull();
  });

  it('Tage, auch halbe', () => {
    expect(parseTage('2')).toBe(2);
    expect(parseTage('2,5')).toBe(2.5);
    expect(parseTage('0.5')).toBe(0.5);
    expect(parseTage('1,3')).toBeNull();
  });
});

describe('B3 Buchungen Zeitkonto', () => {
  it('Vortrag, Auszahlung und Korrektur mit Vorzeichen', () => {
    expect(baueBuchung(eingabe({ art: 'vortrag', datum: '2026-08-02', wert: 600, vorzeichen: 1 }), daten, HEUTE).buchung?.betrag).toBe(600);
    expect(baueBuchung(eingabe({ art: 'auszahlung', wert: 720, vorzeichen: 1 }), daten, HEUTE).buchung?.betrag).toBe(-720);
    expect(baueBuchung(eingabe({ art: 'korrektur', wert: 15, vorzeichen: -1 }), daten, HEUTE).buchung?.betrag).toBe(-15);
    expect(baueBuchung(eingabe({ wert: 0 }), daten, HEUTE).fehler).toMatch(/Betrag/);
  });

  it('Abgleich: bucht die Differenz, danach stimmt der Saldo mit der Firma überein', () => {
    expect(appSaldoAm(daten, '2026-08-07', HEUTE)).toBe(150);
    const r = baueBuchung(eingabe({ art: 'abgleich', firma: 500 * 60 + 15 }), daten, HEUTE);
    expect(r.buchung).toMatchObject({ art: 'abgleich', betrag: 500 * 60 + 15 - 150, abgleich: { firma: 500 * 60 + 15, app: 150 } });
    const nachher = { ...daten, buchungen: [r.buchung!] };
    expect(zeitkontoSaldo(nachher, '2026-08-07', HEUTE)).toBe(500 * 60 + 15);
  });

  it('Abgleich ändern rechnet ohne die eigene Buchung', () => {
    const erste = baueBuchung(eingabe({ art: 'abgleich', firma: 1000 }), daten, HEUTE).buchung!;
    const mit = { ...daten, buchungen: [erste] };
    const neu = baueBuchung(eingabe({ id: erste.id, art: 'abgleich', firma: 1200 }), mit, HEUTE).buchung!;
    expect(neu.betrag).toBe(1200 - 150);
  });

  it('Abgleich lehnt Zukunft und Gleichstand ab', () => {
    expect(baueBuchung(eingabe({ art: 'abgleich', datum: '2026-10-01', firma: 0 }), daten, HEUTE).fehler).toMatch(/Zukunft/);
    expect(baueBuchung(eingabe({ art: 'abgleich', firma: 150 }), daten, HEUTE).fehler).toMatch(/schon überein/);
  });
});

describe('B4 Buchungen Urlaubskonto', () => {
  it('Resturlaub und Sonderurlaub zählen immer positiv, Korrektur mit Vorzeichen', () => {
    const b1 = baueBuchung(eingabe({ konto: 'urlaub', art: 'resturlaub', datum: '2026-01-01', wert: 19, vorzeichen: -1 }), daten, HEUTE).buchung!;
    const b2 = baueBuchung(eingabe({ konto: 'urlaub', art: 'sonderurlaub', datum: '2026-05-01', wert: 1, kommentar: 'Jubiläum' }), daten, HEUTE).buchung!;
    const b3 = baueBuchung(eingabe({ konto: 'urlaub', art: 'korrektur', datum: '2026-06-01', wert: 0.5, vorzeichen: -1 }), daten, HEUTE).buchung!;
    expect([b1.betrag, b2.betrag, b3.betrag]).toEqual([19, 1, -0.5]);
    const k = urlaubskonto({ ...bestand('2026-01-01'), buchungen: [b1, b2, b3] }, 2026, HEUTE);
    expect(k.gesamt).toBe(31 + 19 + 1 - 0.5);
  });
});
