<script lang="ts">
  import { symbole } from './symbole';

  let { titel, unter = '', oeffneEinstellungen }: { titel: string; unter?: string; oeffneEinstellungen: () => void } = $props();
</script>

<header class="titel">
  <div>
    {#if unter}<small>{unter}</small>{/if}
    <h1>{titel}</h1>
  </div>
  <button type="button" class="zahnrad" aria-label="Einstellungen" onclick={oeffneEinstellungen}>{@html symbole.zahnrad}</button>
</header>

<style>
  .zahnrad {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--group);
    display: grid;
    place-items: center;
    box-shadow: 0 1px 3px rgba(16, 19, 26, 0.12);
    flex: none;
  }
  .zahnrad :global(svg) {
    width: 21px;
    height: 21px;
  }
</style>
