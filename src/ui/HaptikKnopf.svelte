<script lang="ts">
  // Knopf mit haptischem Tick auf dem iPhone: iOS erzeugt die Haptik nur, wenn der Finger selbst
  // einen Schalter umlegt (<input type="checkbox" switch>, ab iOS 18). Der Knopf ist deshalb ein
  // Label um einen unsichtbaren Schalter; die Aktion läuft beim Umlegen. Ohne Haptik: normaler Knopf.
  import type { Snippet } from 'svelte';

  let {
    klasse,
    disabled = false,
    haptik = true,
    aktion,
    children
  }: { klasse: string; disabled?: boolean; haptik?: boolean; aktion: () => void; children: Snippet } = $props();

  // Das Schalter-Attribut kennen die Svelte-Typen noch nicht
  const SCHALTER: Record<string, string> = { switch: '' };
</script>

{#if haptik}
  <label class="{klasse} haptik" class:gesperrt={disabled}>
    <input type="checkbox" {...SCHALTER} class="unsichtbar" {disabled} onchange={aktion} />
    {@render children()}
  </label>
{:else}
  <button type="button" class={klasse} {disabled} onclick={aktion}>{@render children()}</button>
{/if}

<style>
  .haptik {
    position: relative;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .gesperrt {
    opacity: 0.45;
    pointer-events: none;
  }
  .unsichtbar {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
