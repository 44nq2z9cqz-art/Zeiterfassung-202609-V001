// Backup über das Teilen-Menü sichern (z. B. in iCloud Drive) und den Zeitpunkt merken.
import { backupDateiname, erstelleBackup } from '../core/backup';
import { speicher } from './speicher.svelte';
import { teileDatei } from './teilen';

export async function backupSichern(): Promise<'geteilt' | 'abgebrochen' | 'geladen'> {
  const backup = erstelleBackup(speicher.daten, __APP_VERSION__);
  const inhalt = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const ergebnis = await teileDatei(inhalt, backupDateiname());
  if (ergebnis !== 'abgebrochen') await speicher.backupGesichert(backup.erstelltAm);
  return ergebnis;
}
