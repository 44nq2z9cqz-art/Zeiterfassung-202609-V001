<script lang="ts">
  import Titel from './Titel.svelte';

  let { titel, meilenstein, text, oeffneEinstellungen }: { titel: string; meilenstein: string; text: string; oeffneEinstellungen: () => void } = $props();
</script>

<Titel {titel} unter="Im Aufbau" {oeffneEinstellungen} />

<div class="gruppe karte">
  <span class="marke">{meilenstein}</span>
  <p>{text}</p>
</div>

<style>
  .karte {
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .marke {
    background: var(--night);
    color: var(--lemon);
    font-weight: 700;
    font-size: 13px;
    border-radius: 7px;
    padding: 3px 8px;
  }
  p {
    margin: 0;
    line-height: 1.45;
    color: var(--label2);
  }
</style>
