<script lang="ts">
  import { onMount } from 'svelte';
  import { heute as heuteBerechnen } from './core/zeit';
  import { speicher } from './lib/speicher.svelte';
  import { aktualisierung } from './lib/update.svelte';
  import Berichte from './ui/Berichte.svelte';
  import Einstellungen from './ui/Einstellungen.svelte';
  import Heute from './ui/Heute.svelte';
  import Kalender from './ui/Kalender.svelte';
  import Konten from './ui/Konten.svelte';
  import { symbole } from './ui/symbole';

  type Reiter = 'heute' | 'kalender' | 'konten' | 'berichte';
  const reiterListe: { id: Reiter; titel: string }[] = [
    { id: 'heute', titel: 'Heute' },
    { id: 'kalender', titel: 'Kalender' },
    { id: 'konten', titel: 'Konten' },
    { id: 'berichte', titel: 'Berichte' }
  ];

  let reiter = $state<Reiter>('heute');
  let einstellungenOffen = $state(false);
  let heute = $state(heuteBerechnen());

  onMount(() => {
    speicher.laden();
    aktualisierung.starten();
    // Datum aktuell halten, falls die App über Mitternacht offen bleibt
    const takt = setInterval(() => (heute = heuteBerechnen()), 30_000);
    return () => clearInterval(takt);
  });

  // Darstellung hell/dunkel; „auto“ folgt der iPhone-Einstellung, auch beim Umschalten am Abend
  let systemDunkel = $state(matchMedia('(prefers-color-scheme: dark)').matches);
  onMount(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const wechsel = () => (systemDunkel = mq.matches);
    mq.addEventListener('change', wechsel);
    return () => mq.removeEventListener('change', wechsel);
  });
  $effect(() => {
    const d = speicher.einstellungen.darstellung ?? 'hell';
    const dunkel = d === 'dunkel' || (d === 'auto' && systemDunkel);
    document.documentElement.dataset.theme = dunkel ? 'dunkel' : 'hell';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? '#0B0D12' : '#F4F5F0');
  });

  const oeffneEinstellungen = () => (einstellungenOffen = true);

  /** Reiter wechseln und nach oben scrollen – bei erneutem Tippen sanft, wie bei iOS */
  function reiterWaehlen(id: Reiter) {
    const gleich = reiter === id;
    reiter = id;
    window.scrollTo({ top: 0, behavior: gleich ? 'smooth' : 'instant' });
  }
</script>

{#if aktualisierung.verfuegbar}
  <div class="update" role="status">
    <span>Neue Version verfügbar</span>
    <button type="button" onclick={() => aktualisierung.jetztAktualisieren()}>Aktualisieren</button>
  </div>
{/if}

<div class="statusband" aria-hidden="true"></div>

<main>
  {#if speicher.fehler}
    <p class="hinweistext">Die Daten konnten nicht geladen werden: {speicher.fehler}</p>
  {:else if !speicher.geladen}
    <p class="hinweistext">Daten werden geladen …</p>
  {:else if reiter === 'konten'}
    <Konten {heute} {oeffneEinstellungen} />
  {:else if reiter === 'heute'}
    <Heute {oeffneEinstellungen} />
  {:else if reiter === 'kalender'}
    <Kalender {heute} {oeffneEinstellungen} />
  {:else}
    <Berichte {heute} {oeffneEinstellungen} />
  {/if}
</main>

<nav class="tabs" aria-label="Bereiche">
  {#each reiterListe as r (r.id)}
    <button type="button" class:an={reiter === r.id} aria-current={reiter === r.id ? 'page' : undefined} onclick={() => reiterWaehlen(r.id)}>
      {@html symbole[r.id]}
      <span>{r.titel}</span>
    </button>
  {/each}
</nav>

{#if einstellungenOffen}
  <Einstellungen schliessen={() => (einstellungenOffen = false)} zuKonten={() => ((einstellungenOffen = false), (reiter = 'konten'))} {heute} />
{/if}

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--inhalt-oben) 16px calc(var(--unten) + 110px);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .tabs {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--unten) + 10px);
    width: min(528px, calc(100% - 32px));
    height: 64px;
    border-radius: 32px;
    background: var(--glas);
    backdrop-filter: blur(20px) saturate(1.6);
    -webkit-backdrop-filter: blur(20px) saturate(1.6);
    box-shadow:
      0 10px 28px -12px rgba(16, 19, 26, 0.38),
      inset 0 0 0 1px var(--glas-rand);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 6px;
    z-index: 10;
  }
  .tabs button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--label2);
    border-radius: 26px;
  }
  .tabs button.an {
    background: var(--flaeche);
    color: var(--lemon);
  }
  .tabs :global(svg) {
    width: 23px;
    height: 23px;
  }

  .update {
    position: fixed;
    top: calc(var(--oben) + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: min(528px, calc(100% - 32px));
    z-index: 55; /* über dem Statusstreifen */
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 18px;
    border-radius: 999px;
    background: var(--flaeche);
    color: #fff;
    font-weight: 600;
    font-size: 15px;
    box-shadow: 0 10px 28px -12px rgba(16, 19, 26, 0.5);
  }
  .update button {
    background: var(--lemon);
    color: var(--night);
    border-radius: 999px;
    padding: 8px 14px;
    font-weight: 700;
  }
</style>
