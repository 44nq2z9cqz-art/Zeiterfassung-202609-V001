<script lang="ts">
  import { type Importergebnis, importiereAltBackup } from '../core/import-altapp';
  import { type Datum, datumDE, dauer, jahrVon } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';

  let { zurueck, fertig, heute }: { zurueck: () => void; fertig: () => void; heute: Datum } = $props();

  let ergebnis = $state.raw<Importergebnis | null>(null);
  let fehler = $state<string | null>(null);
  let resturlaub = $state('');
  let schritt = $state<'datei' | 'bericht' | 'laeuft' | 'fertig'>('datei');
  let dateiname = $state('');

  async function dateiGewaehlt(ereignis: Event) {
    const datei = (ereignis.currentTarget as HTMLInputElement).files?.[0];
    if (!datei) return;
    fehler = null;
    dateiname = datei.name;
    try {
      const json = JSON.parse(await datei.text());
      ergebnis = importiereAltBackup(json, heute);
      schritt = 'bericht';
    } catch (e) {
      fehler = e instanceof SyntaxError ? 'Die Datei ist keine gültige JSON-Datei.' : e instanceof Error ? e.message : String(e);
    }
  }

  const b = $derived(ergebnis?.bericht);
  const startJahr = $derived(ergebnis ? jahrVon(ergebnis.daten.einstellungen.appStart) : jahrVon(heute));
  const differenz = $derived(b ? b.saldoNeu - b.saldoAlt : 0);
  const sonstiges = $derived(b ? differenz + b.pausenrundung + b.zuschlaege.minuten : 0);
  const restZahl = $derived(Number(resturlaub.replace(',', '.')));
  const restGueltig = $derived(resturlaub.trim() === '' || (Number.isFinite(restZahl) && restZahl >= 0 && (restZahl * 2) % 1 === 0));

  async function importieren() {
    if (!ergebnis || !restGueltig) return;
    schritt = 'laeuft';
    const daten = { ...ergebnis.daten, buchungen: [...ergebnis.daten.buchungen] };
    if (resturlaub.trim() !== '' && restZahl > 0) {
      daten.buchungen.push({
        id: `import-resturlaub-${startJahr}`,
        konto: 'urlaub',
        art: 'resturlaub',
        datum: `${startJahr}-01-01`,
        betrag: restZahl,
        kommentar: 'beim Import erfasst'
      });
    }
    try {
      await speicher.importieren(daten, ergebnis.bericht);
      schritt = 'fertig';
    } catch (e) {
      fehler = e instanceof Error ? e.message : String(e);
      schritt = 'bericht';
    }
  }
</script>

<div class="leiste">
  <button type="button" class="zurueck" onclick={zurueck}>‹ Einstellungen</button>
</div>
<header class="titel"><div><small>Datenübernahme</small><h1>Alte App importieren</h1></div></header>

{#if schritt === 'datei'}
  <p class="hinweistext">
    Wähle die Backup-Datei der alten App, z. B. aus iCloud Drive. Bevor etwas gespeichert wird, zeigt die App einen Prüfbericht.
  </p>
  <label class="knopf haupt datei">
    Backup-Datei wählen
    <input type="file" accept=".json,application/json" onchange={dateiGewaehlt} />
  </label>
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
{:else if schritt === 'fertig'}
  <div class="gruppe erfolg">
    <p>
      <b>Import abgeschlossen.</b> {speicher.tage.size} Tage und {speicher.buchungen.length}
      {speicher.buchungen.length === 1 ? 'Buchung' : 'Buchungen'} sind jetzt in der neuen App gespeichert.
    </p>
    <button type="button" class="knopf haupt" onclick={fertig}>Zu den Konten</button>
  </div>
{:else if b}
  <h2 class="abschnitt">Datei</h2>
  <div class="gruppe">
    <div class="zeile"><span class="l">Datei</span><span class="w klein">{dateiname}</span></div>
    {#if b.exportiertAm}<div class="zeile"><span class="l">Erstellt am</span><span class="w">{new Date(b.exportiertAm).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>{/if}
    <div class="zeile"><span class="l">Zeitraum</span><span class="w">{datumDE(b.von)} – {datumDE(b.bis)}</span></div>
  </div>

  <h2 class="abschnitt">Inhalt</h2>
  <div class="gruppe">
    <div class="zeile"><span class="l">Arbeitstage</span><span class="w stark">{b.arbeitstage}</span></div>
    <div class="zeile"><span class="l">Pausen</span><span class="w stark">{b.pausen}</span></div>
    <div class="zeile"><span class="l">Urlaubstage</span><span class="w stark">{b.urlaubstage}</span></div>
    <div class="zeile"><span class="l">Gleittage</span><span class="w stark">{b.gleittage}</span></div>
    <div class="zeile"><span class="l">Krankheitstage</span><span class="w stark">{b.krankheitstage}</span></div>
    <div class="zeile"><span class="l">Zeitkonto-Buchungen</span><span class="w stark">{b.buchungen}</span></div>
  </div>

  <h2 class="abschnitt">Saldo Ende {datumDE(b.stichtag)}</h2>
  <div class="gruppe">
    <div class="zeile"><span class="l">Alte App</span><span class="w">{dauer(b.saldoAlt, true)}</span></div>
    <div class="zeile"><span class="l"><b>Neue App</b></span><span class="w stark num">{dauer(b.saldoNeu, true)}</span></div>
    <div class="zeile"><span class="l">Differenz</span><span class="w stark">{dauer(differenz, true)}</span></div>
    {#if b.pausenrundung}<div class="zeile"><span class="l"><span>Pausenrundung der alten App<small>jede Pause wurde einzeln abgerundet</small></span></span><span class="w">{dauer(-b.pausenrundung, true)}</span></div>{/if}
    {#if b.zuschlaege.minuten}<div class="zeile"><span class="l"><span class="plakette">!</span><span>Pausenzeitverletzungen<small>{b.zuschlaege.tage} Tage, Regel 11–14 Uhr</small></span></span><span class="w">{dauer(-b.zuschlaege.minuten, true)}</span></div>{/if}
    {#if sonstiges}<div class="zeile"><span class="l"><span>Sonstiges<small>z. B. Tage ohne Eintrag, verlorene Minusstunden</small></span></span><span class="w">{dauer(sonstiges, true)}</span></div>{/if}
  </div>
  <p class="hinweistext">Ohne Vortrag aus dem Firmensystem. Den Vortrag erfasst du später unter Konten.</p>

  {#if b.doppeltipp.length || b.hinweise.length}
    <h2 class="abschnitt">Hinweise</h2>
    <div class="gruppe">
      {#if b.doppeltipp.length}
        <div class="zeile"><span class="l"><span>{b.doppeltipp.length} Pausen unter 1 Minute<small>{b.doppeltipp.map((d) => `${datumDE(d.datum)} ${d.uhrzeit}`).join(' · ')} – bleiben erhalten, zählen 0 Min</small></span></span></div>
      {/if}
      {#each b.hinweise as h}<div class="zeile"><span class="l">{h}</span></div>{/each}
    </div>
  {/if}

  <h2 class="abschnitt">Urlaub</h2>
  <div class="gruppe">
    <label class="zeile">
      <span class="l"><span>Resturlaub aus Vorjahren<small>zum 01.01.{startJahr}, optional</small></span></span>
      <input class="eingabe" inputmode="decimal" placeholder="Tage" bind:value={resturlaub} aria-invalid={!restGueltig} />
    </label>
  </div>
  {#if !restGueltig}<p class="fehler" role="alert">Bitte eine Zahl in ganzen oder halben Tagen eingeben, z. B. 19 oder 2,5.</p>{/if}

  {#if speicher.hatDaten}
    <p class="warnung">In der neuen App sind bereits {speicher.tage.size} Tage gespeichert. Sie werden ersetzt. Vorher legt die App automatisch eine Sicherheitskopie an.</p>
  {/if}
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}

  <div class="knoepfe">
    <button type="button" class="knopf haupt" onclick={importieren} disabled={schritt === 'laeuft' || !restGueltig}>
      {schritt === 'laeuft' ? 'Wird importiert …' : speicher.hatDaten ? 'Ersetzen und importieren' : 'Importieren'}
    </button>
    <button type="button" class="knopf neben" onclick={() => ((schritt = 'datei'), (ergebnis = null))}>Andere Datei wählen</button>
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
  .eingabe {
    width: 90px;
    text-align: right;
    font: inherit;
    font-weight: 600;
    border: none;
    background: var(--fill);
    border-radius: 8px;
    padding: 6px 10px;
  }
  .eingabe[aria-invalid='true'] {
    outline: 2px solid var(--minus);
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
