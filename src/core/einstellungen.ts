import type { Einstellungen, Gueltig, Pausenregel } from './modell';
import type { Datum } from './zeit';

export const STANDARD_PAUSENREGEL: Pausenregel = {
  aktiv: true,
  fensterBeginn: 11 * 60,
  fensterEnde: 14 * 60,
  mindestGesamt: 30,
  mindestEinzel: 15,
  wochentage: [1, 2, 3, 4, 5]
};

const IMMER: Datum = '2000-01-01';

export function standardEinstellungen(appStart: Datum): Einstellungen {
  return {
    appStart,
    wochenstunden: [{ ab: IMMER, wert: 40 * 60 }],
    sollHalbtag: [{ ab: IMMER, wert: 4 * 60 }],
    pausenregel: [{ ab: IMMER, wert: { ...STANDARD_PAUSENREGEL } }],
    sockel: 40 * 60,
    urlaubsanspruch: [{ ab: IMMER, wert: 31 }],
    name: '',
    personalnummer: '',
    hinweise: {
      pausenfenster: { aktiv: true, uhrzeit: 13 * 60 + 30 },
      pauseNach: { aktiv: true, minuten: 5 * 60 + 15 },
      arbeitsende: { aktiv: false, uhrzeit: 18 * 60 + 15 },
      backupNachTagen: 7
    }
  };
}

/** Der am Datum gültige Wert: der letzte Eintrag mit ab ≤ datum, sonst der früheste. */
export function gueltigAm<T>(liste: Gueltig<T>[], datum: Datum): T {
  const sortiert = [...liste].sort((a, b) => a.ab.localeCompare(b.ab));
  let wert = sortiert[0].wert;
  for (const eintrag of sortiert) if (eintrag.ab <= datum) wert = eintrag.wert;
  return wert;
}
