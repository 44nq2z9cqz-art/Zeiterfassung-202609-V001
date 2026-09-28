<script lang="ts">
  import { type Pruefergebnis, pruefeBackup } from '../core/backup';
  import { zeitkontoSaldo } from '../core/konten';
  import { type Datum, datumDE, dauer, plusTage } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';

  let { zurueck, fertig, heute }: { zurueck: () => void; fertig: () => void; heute: Datum } = $props();

  let pruefung = $state.raw<Pruefergebnis | null>(null);
  let schritt = $state<'datei' | 'vorschau' | 'laeuft' | 'fertig'>('datei');
  let fehler = $state<string | null>(null);
  let dateiname = $state('');

  async function dateiGewaehlt(ereignis: Event) {
    const datei = (ereignis.currentTarget as HTMLInputElement).files?.[0];
    if (!datei) return;
    fehler = null;
    dateiname = datei.name;
    try {
      const r = pruefeBackup(JSON.parse(await datei.text()));
      if (r.fehler) {
        fehler = r.fehler;
        return;
      }
      pruefung = r;
      schritt = 'vorschau';
    } catch {
      fehler = 'Die Datei ist keine gültige JSON-Datei.';
    }
  }

  const v = $derived(pruefung?.vorschau);
  const gestern = $derived(plusTage(heute, -1));
  const saldoBackup = $derived(pruefung?.daten ? zeitkontoSaldo(pruefung.daten, gestern, heute) : 0);
  const saldoJetzt = $derived(zeitkontoSaldo(speicher.daten, gestern, heute));

  async function herstellen() {
    if (!pruefung?.daten) return;
    schritt = 'laeuft';
    try {
      await speicher.wiederherstellen(pruefung.daten);
      schritt = 'fertig';
    } catch (e) {
      fehler = e instanceof Error ? e.message : String(e);
      schritt = 'vorschau';
    }
  }
</script>

<div class="leiste"><button type="button" class="zurueck" onclick={zurueck}>‹ Einstellungen</button></div>
<header class="titel"><div><small>Daten</small><h1>Backup wiederherstellen</h1></div></header>

{#if schritt === 'datei'}
  <p class="hinweistext">Wähle eine Backup-Datei dieser App, z. B. aus iCloud Drive. Vor dem Wiederherstellen siehst du, was die Datei enthält.</p>
  <label class="knopf haupt datei">
    Backup-Datei wählen
    <input type="file" accept=".json,application/json" onchange={dateiGewaehlt} />
  </label>
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
{:else if schritt === 'fertig'}
  <div class="gruppe erfolg">
    <p><b>Wiederhergestellt.</b> {speicher.tage.size} Tage und {speicher.buchungen.length} {speicher.buchungen.length === 1 ? 'Buchung' : 'Buchungen'} sind geladen.</p>
    <button type="button" class="knopf haupt" onclick={fertig}>Zu den Konten</button>
  </div>
{:else if v}
  <h2 class="abschnitt">Backup</h2>
  <div class="gruppe">
    <div class="zeile"><span class="l">Datei</span><span class="w klein">{dateiname}</span></div>
    {#if v.erstelltAm}<div class="zeile"><span class="l">Erstellt am</span><span class="w">{new Date(v.erstelltAm).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{/if}
    {#if v.von && v.bis}<div class="zeile"><span class="l">Zeitraum</span><span class="w">{datumDE(v.von)} – {datumDE(v.bis)}</span></div>{/if}
    <div class="zeile"><span class="l">Tage / davon gearbeitet</span><span class="w stark">{v.tage} / {v.arbeitstage}</span></div>
    <div class="zeile"><span class="l">Buchungen</span><span class="w stark">{v.buchungen}</span></div>
  </div>

  <h2 class="abschnitt">Zeitkonto Ende {datumDE(gestern)}</h2>
  <div class="gruppe">
    <div class="zeile"><span class="l">Jetzt in der App</span><span class="w">{dauer(saldoJetzt, true)}</span></div>
    <div class="zeile"><span class="l"><b>Nach Wiederherstellen</b></span><span class="w stark num">{dauer(saldoBackup, true)}</span></div>
  </div>

  <p class="warnung">Alle Daten in der App werden durch das Backup ersetzt. Vorher legt die App automatisch eine Sicherheitskopie an.</p>
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
  <div class="knoepfe">
    <button type="button" class="knopf haupt" disabled={schritt === 'laeuft'} onclick={herstellen}>{schritt === 'laeuft' ? 'Wird wiederhergestellt …' : 'Ersetzen und wiederherstellen'}</button>
    <button type="button" class="knopf neben" onclick={() => ((schritt = 'datei'), (pruefung = null))}>Andere Datei wählen</button>
  </div>
{/if}

<style>
  .leiste {
    min-height: 40px;
    display: flex;
    align-items: center;
  }
  .zurueck {
    font-size: 17px;
    font-weight: 500;
  }
  .datei {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .datei input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .klein {
    font-size: 13px;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fehler {
    margin: 0;
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
  .warnung {
    margin: 0;
    background: var(--group);
    border-radius: 14px;
    padding: 12px 16px;
    font-size: 14px;
    line-height: 1.45;
  }
  .erfolg {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .erfolg p {
    margin: 0;
    line-height: 1.45;
  }
  .knoepfe {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
