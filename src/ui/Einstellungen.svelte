<script lang="ts">
  import { gueltigAm } from '../core/einstellungen';
  import { type Datum, dauer, uhrzeit } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { aktualisierung } from '../lib/update.svelte';
  import ImportAltApp from './ImportAltApp.svelte';

  let { schliessen, zuKonten, heute }: { schliessen: () => void; zuKonten: () => void; heute: Datum } = $props();

  let ansicht = $state<'haupt' | 'import'>('haupt');
  let suche = $state<'bereit' | 'laeuft' | 'fertig'>('bereit');

  const e = $derived(speicher.einstellungen);
  const regel = $derived(gueltigAm(e.pausenregel, heute));
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const tageText = $derived(regel.wochentage.map((w) => WT[w]).join(', '));

  async function nachUpdateSuchen() {
    suche = 'laeuft';
    await aktualisierung.suchen();
    suche = 'fertig';
  }

  const build = new Date(__BUILD_ZEIT__).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
</script>

<div class="blatt" role="dialog" aria-modal="true" aria-label="Einstellungen">
  <div class="inhalt">
    {#if ansicht === 'import'}
      <ImportAltApp zurueck={() => (ansicht = 'haupt')} fertig={zuKonten} {heute} />
    {:else}
      <div class="leiste">
        <span></span>
        <span class="t">Einstellungen</span>
        <button type="button" class="fertig" onclick={schliessen}>Fertig</button>
      </div>

      <h2 class="abschnitt">Daten</h2>
      <div class="gruppe">
        <button type="button" class="zeile aktion" onclick={() => (ansicht = 'import')}>
          <span class="l"><span>Daten der alten App importieren<small>Datensicherung „Zeiterfassung Pro“ (JSON)</small></span></span>
          <span class="pfeil">›</span>
        </button>
        <div class="zeile">
          <span class="l">Dauerhafter Speicher</span>
          <span class="w">{speicher.dauerhaft === true ? 'bestätigt' : speicher.dauerhaft === false ? 'nicht bestätigt' : 'unbekannt'}</span>
        </div>
        <div class="zeile">
          <span class="l">Gespeicherte Tage</span>
          <span class="w">{speicher.tage.size}</span>
        </div>
      </div>

      <h2 class="abschnitt">Arbeitszeit</h2>
      <div class="gruppe">
        <div class="zeile"><span class="l"><span>Wochenstunden<small>Mo–Fr</small></span></span><span class="w">{dauer(gueltigAm(e.wochenstunden, heute))}</span></div>
        <div class="zeile"><span class="l">Soll 24.12. und 31.12.</span><span class="w">{dauer(gueltigAm(e.sollHalbtag, heute))}</span></div>
      </div>

      <h2 class="abschnitt">Pausenregel</h2>
      <div class="gruppe">
        <div class="zeile">
          <span class="l"><span>Pausenfenster {uhrzeit(regel.fensterBeginn)}–{uhrzeit(regel.fensterEnde)} Uhr<small>{regel.mindestGesamt} Min, davon eine ab {regel.mindestEinzel} Min · {tageText}</small></span></span>
          <span class="w">{regel.aktiv ? 'aktiv' : 'aus'}</span>
        </div>
      </div>

      <h2 class="abschnitt">Konten</h2>
      <div class="gruppe">
        <div class="zeile"><span class="l">Sockel Zeitkonto</span><span class="w">{dauer(e.sockel)}</span></div>
        <div class="zeile"><span class="l">Urlaubsanspruch pro Jahr</span><span class="w">{gueltigAm(e.urlaubsanspruch, heute)} Tage</span></div>
        <div class="zeile"><span class="l">Zeitkonto rechnet ab</span><span class="w">{e.appStart.split('-').reverse().join('.')}</span></div>
      </div>
      <p class="hinweistext">Die Werte lassen sich mit Meilenstein M6 bearbeiten.</p>

      <h2 class="abschnitt">App</h2>
      <div class="gruppe">
        <div class="zeile"><span class="l">Version</span><span class="w">{__APP_VERSION__} · {build}</span></div>
        <button type="button" class="zeile aktion" onclick={nachUpdateSuchen} disabled={suche === 'laeuft'}>
          <span class="l">Nach Update suchen</span>
          <span class="w">{suche === 'laeuft' ? 'sucht …' : suche === 'fertig' ? (aktualisierung.verfuegbar ? 'Update bereit' : 'aktuell') : ''}</span>
        </button>
        <div class="zeile"><span class="l">Offline nutzbar</span><span class="w">{aktualisierung.offlineBereit || navigator.serviceWorker?.controller ? 'ja' : 'wird eingerichtet'}</span></div>
      </div>
    {/if}
  </div>
</div>

<style>
  .blatt {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: var(--bg);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .inhalt {
    max-width: 560px;
    margin: 0 auto;
    padding: calc(var(--oben) + 10px) 16px calc(var(--unten) + 40px);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .leiste {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 40px;
  }
  .leiste .t {
    font-weight: 600;
    font-size: 17px;
  }
  .fertig {
    justify-self: end;
    font-weight: 700;
    font-size: 17px;
  }
</style>
