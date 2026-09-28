<script lang="ts">
  import { untrack } from 'svelte';
  import { zeitraumSetzen } from '../core/bearbeiten';
  import { type Datum, datumDE } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';

  let { schliessen, vorschlag }: { schliessen: () => void; vorschlag: Datum } = $props();

  let art = $state<'urlaub' | 'krank'>('urlaub');
  // Startwert aus dem gewählten Kalendertag, danach frei änderbar
  let von = $state(untrack(() => vorschlag));
  let bis = $state(untrack(() => vorschlag));
  let fertig = $state<string | null>(null);

  const gueltig = $derived(!!von && !!bis && von <= bis);
  const vorschau = $derived(gueltig ? zeitraumSetzen(speicher.tage, von, bis, art, '') : null);
  const tage = $derived(vorschau ? vorschau.geaendert.length : 0);

  async function sichern() {
    if (!vorschau) return;
    const echt = zeitraumSetzen(speicher.tage, von, bis, art, new Date().toISOString());
    await speicher.speichereTage(echt.geaendert);
    fertig = `${echt.geaendert.length} ${echt.geaendert.length === 1 ? 'Tag' : 'Tage'} als ${art === 'urlaub' ? 'Urlaub' : 'Krank'} eingetragen.`;
  }
</script>

<Blatt titel="Zeitraum eintragen" {schliessen}>
  {#if fertig}
    <p class="hinweistext mitte">{fertig}</p>
    <button type="button" class="knopf haupt" onclick={schliessen}>Fertig</button>
  {:else}
    <div class="segmente">
      <button type="button" aria-pressed={art === 'urlaub'} onclick={() => (art = 'urlaub')}>Urlaub</button>
      <button type="button" aria-pressed={art === 'krank'} onclick={() => (art = 'krank')}>Krank</button>
    </div>
    <div class="gruppe">
      <label class="zeile"><span class="l">Von</span><input class="datum" type="date" id="zr-von" bind:value={von} /></label>
      <label class="zeile"><span class="l">Bis</span><input class="datum" type="date" id="zr-bis" bind:value={bis} min={von} /></label>
    </div>
    {#if !gueltig}
      <p class="fehler" role="alert">Das Enddatum muss am oder nach dem Beginn liegen.</p>
    {:else if vorschau}
      <p class="hinweistext">
        <b>{tage} {art === 'urlaub' ? (tage === 1 ? 'Urlaubstag' : 'Urlaubstage') : tage === 1 ? 'Krankheitstag' : 'Krankheitstage'}</b>
        {#if vorschau.bereits} · {vorschau.bereits} {vorschau.bereits === 1 ? 'Tag ist' : 'Tage sind'} schon eingetragen{/if}
        {#if vorschau.frei} · {vorschau.frei} Wochenend- oder Feiertage werden nicht gezählt{/if}
        {#if vorschau.uebersprungen.length}<br />Nicht überschrieben, weil dort gearbeitet wurde: {vorschau.uebersprungen.map(datumDE).join(', ')}{/if}
      </p>
    {/if}
    <button type="button" class="knopf haupt" disabled={!gueltig || tage === 0} onclick={sichern}>Eintragen</button>
    <button type="button" class="knopf neben" onclick={schliessen}>Abbrechen</button>
  {/if}
</Blatt>

<style>
  .datum {
    font: inherit;
    font-weight: 600;
    border: none;
    background: var(--fill);
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--label);
  }
  .mitte {
    text-align: center;
  }
  .fehler {
    margin: 0;
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
</style>
