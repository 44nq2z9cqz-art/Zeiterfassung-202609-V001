<script lang="ts">
  import { BEHALTEN, GRUND_TEXT, type Sicherung } from '../core/sicherungen';
  import { speicher } from '../lib/speicher.svelte';

  let { zurueck, waehlen }: { zurueck: () => void; waehlen: (s: Sicherung) => void } = $props();

  let liste = $state.raw<Sicherung[] | null>(null);
  let fehler = $state<string | null>(null);
  speicher
    .sicherungen()
    .then((l) => (liste = l))
    .catch((e) => (fehler = e instanceof Error ? e.message : String(e)));

  const zeitpunkt = (s: Sicherung) =>
    new Date(s.id).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<div class="leiste"><button type="button" class="zurueck" onclick={zurueck}>‹ Einstellungen</button></div>
<header class="titel"><div><small>Daten</small><h1>Automatische Sicherungen</h1></div></header>

<p class="hinweistext">
  Die App legt beim ersten Öffnen jedes Tages eine Sicherung an und behält die letzten {BEHALTEN.taeglich}. Dazu kommt je eine vor jedem Wiederherstellen
  oder Import. Ein Tipp zeigt, was die Sicherung enthält, und bietet das Wiederherstellen an.
</p>

<div class="gruppe">
  {#if fehler}
    <div class="zeile"><span class="l fehler">{fehler}</span></div>
  {:else if liste === null}
    <div class="zeile"><span class="l leise">Wird geladen …</span></div>
  {:else}
    {#each liste as s (s.id)}
      <button type="button" class="zeile" onclick={() => waehlen(s)}>
        <span class="l"><span>{zeitpunkt(s)}<small>{GRUND_TEXT[s.grund]} · {s.tage} Tage · {s.buchungen} {s.buchungen === 1 ? 'Buchung' : 'Buchungen'} · {s.antraege} {s.antraege === 1 ? 'Antrag' : 'Anträge'}</small></span></span>
        <span class="pfeil">›</span>
      </button>
    {:else}
      <div class="zeile"><span class="l leise">Noch keine Sicherung. Die erste entsteht beim nächsten Öffnen der App.</span></div>
    {/each}
  {/if}
</div>

<p class="hinweistext">
  Diese Sicherungen liegen nur auf diesem iPhone. Sie helfen bei Bedienfehlern, aber nicht, wenn das Gerät verloren geht oder die App gelöscht wird.
  Dafür bleibt das Backup in iCloud Drive wichtig.
</p>

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
  .fehler {
    color: var(--minus);
  }
</style>
