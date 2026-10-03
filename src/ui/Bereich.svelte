<script lang="ts">
  // Aufklappbarer Bereich der Einstellungen: Kopf mit Titel und Kurzinfo, Inhalt erst nach dem Antippen
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';

  let { titel, info = '', offen, umschalten, children }: { titel: string; info?: string; offen: boolean; umschalten: () => void; children: Snippet } = $props();
</script>

<section class="bereich" class:aufgeklappt={offen}>
  <button type="button" class="kopf" aria-expanded={offen} onclick={umschalten}>
    <span class="text"><b>{titel}</b>{#if info && !offen}<small>{info}</small>{/if}</span>
    <span class="pfeil" aria-hidden="true">›</span>
  </button>
  {#if offen}
    <div class="koerper" transition:slide={{ duration: 220 }}>
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .bereich {
    display: flex;
    flex-direction: column;
  }
  .kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 10px 16px;
    background: var(--group);
    border-radius: 14px;
    text-align: left;
    width: 100%;
    color: var(--label);
  }
  .aufgeklappt .kopf {
    background: transparent;
    padding: 6px 16px 2px;
    min-height: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .text b {
    font-size: 17px;
    font-weight: 600;
  }
  .aufgeklappt .text b {
    font-size: 13px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--label2);
  }
  .text small {
    color: var(--label2);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pfeil {
    color: var(--label3);
    font-size: 22px;
    line-height: 1;
    transform: rotate(90deg);
    transition: transform 0.2s ease;
  }
  .aufgeklappt .pfeil {
    transform: rotate(-90deg);
  }
  .koerper {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 8px;
  }
</style>
