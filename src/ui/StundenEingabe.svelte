<script lang="ts">
  // Stunden und Minuten in zwei Feldern – die iPhone-Zahlentastatur hat keinen Doppelpunkt.
  // Nach außen als Text „h:mm“ (leer, solange nichts eingegeben ist).
  import { untrack } from 'svelte';

  let { wert = $bindable(''), id }: { wert?: string; id: string } = $props();

  const [h0, m0] = untrack(() => wert).split(':');
  let stunden = $state(h0 ?? '');
  let minuten = $state(m0 ?? '');

  $effect(() => {
    const h = stunden.replace(/\D/g, '');
    const m = minuten.replace(/\D/g, '');
    wert = h === '' && m === '' ? '' : `${h || '0'}:${(m || '0').padStart(2, '0')}`;
  });
</script>

<span class="eingabe">
  <input
    {id}
    class="teil stunden"
    inputmode="numeric"
    pattern="[0-9]*"
    maxlength="4"
    placeholder="0"
    aria-label="Stunden"
    bind:value={stunden}
  />
  <span class="doppelpunkt" aria-hidden="true">:</span>
  <input
    class="teil minuten"
    inputmode="numeric"
    pattern="[0-9]*"
    maxlength="2"
    placeholder="00"
    aria-label="Minuten"
    bind:value={minuten}
  />
</span>

<style>
  .eingabe {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--fill);
    border-radius: 8px;
    padding: 2px 6px;
  }
  .teil {
    font: inherit;
    font-weight: 600;
    font-size: 17px;
    border: none;
    background: transparent;
    color: var(--label);
    text-align: right;
    font-variant-numeric: tabular-nums;
    padding: 4px 2px;
  }
  .stunden {
    width: 3.2em;
  }
  .minuten {
    width: 1.8em;
    text-align: left;
  }
  .doppelpunkt {
    font-weight: 700;
  }
</style>
