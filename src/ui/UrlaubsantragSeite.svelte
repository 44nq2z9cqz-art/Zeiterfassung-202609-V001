<script lang="ts">
  import type { Urlaubsantrag } from '../core/modell';
  import { anspruch, antragsliste, type Antragszeile } from '../core/urlaubsantrag';
  import { type Datum, datumDE, jahrVon } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import AntragBlatt from './AntragBlatt.svelte';
  import Blatt from './Blatt.svelte';

  let { jahr, heute, schliessen }: { jahr: number; heute: Datum; schliessen: () => void } = $props();

  const a = $derived(anspruch(speicher.daten, jahr, heute));
  const liste = $derived(antragsliste(speicher.daten, jahr, heute));
  // neueste oben
  const umgekehrt = $derived([...liste].reverse());
  const rest = $derived(liste.filter((z) => z.status !== 'gestrichen').at(-1)?.rest ?? a.gesamt);

  // Anträge für spätere Jahre (z. B. Anfang Januar) sind schon sichtbar, zählen aber erst dort
  const spaeter = $derived(
    [...new Set(speicher.antraege.map((x) => jahrVon(x.von)).filter((j) => j > jahr))]
      .sort()
      .map((j) => ({ jahr: j, zeilen: antragsliste(speicher.daten, j, heute).reverse() }))
  );

  let blatt = $state<{ vorhanden?: Urlaubsantrag } | null>(null);
  let meldung = $state<string | null>(null);
  let arbeitet = $state(false);

  async function pdf(hervorheben?: Urlaubsantrag) {
    if (arbeitet) return;
    arbeitet = true;
    meldung = null;
    try {
      const { pdfUrlaubsantrag } = await import('../lib/pdf');
      // Ein Antrag für ein späteres Jahr kommt in den Urlaubsschein seines Jahres
      const j = hervorheben ? jahrVon(hervorheben.von) : jahr;
      const inhalt = pdfUrlaubsantrag(speicher.daten, j, heute, hervorheben?.id);
      const r = await teileDatei(inhalt, `urlaubsantrag-${j}-${heute}.pdf`);
      meldung = r === 'abgebrochen' ? null : r === 'geteilt' ? 'Urlaubsantrag geteilt' : 'Urlaubsantrag gespeichert';
    } catch (e) {
      meldung = `Das PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    } finally {
      arbeitet = false;
    }
  }

  const zahl = (n: number) => String(n).replace('.', ',');
  const zeitraum = (von: Datum, bis: Datum) => (von === bis ? datumDE(von) : `${datumDE(von).slice(0, 6)} – ${datumDE(bis)}`);
</script>

{#snippet zeile(z: Antragszeile)}
  <button type="button" class="zeile" class:gestrichen={z.status === 'gestrichen'} onclick={() => (blatt = { vorhanden: z.antrag })}>
    <span class="l">
      <span><span class="datum">{zeitraum(z.antrag.von, z.antrag.bis)}</span>
        <small>{[z.status === 'gestrichen' ? `gestrichen am ${datumDE(z.antrag.gestrichen!.am)}` : z.antrag.sonstiges, z.antrag.vertretung ? `Vertretung ${z.antrag.vertretung}` : ''].filter(Boolean).join(' · ') || ' '}</small>
      </span>
    </span>
    <span class="status">
      <span class="chip {z.status}">{z.status}</span>
      <b class="num">{zahl(z.tage)}</b>
      <span class="pfeil">›</span>
    </span>
  </button>
{/snippet}

<Blatt titel="Urlaubsantrag {jahr}" {schliessen}>
  <div class="gruppe">
    <div class="zeile"><span class="l">Resturlaub aus {jahr - 1}</span><span class="w">{zahl(a.resturlaub)}</span></div>
    <div class="zeile"><span class="l">Jahresurlaub {jahr}</span><span class="w">{zahl(a.jahresurlaub)}</span></div>
    <div class="zeile"><span class="l">Sonderurlaub {jahr}</span><span class="w">{zahl(a.sonderurlaub)}</span></div>
    <div class="zeile"><span class="l"><b>Gesamtanspruch</b></span><span class="w stark">{zahl(a.gesamt)}</span></div>
  </div>

  <h2 class="abschnitt">Anträge</h2>
  <div class="gruppe">
    {#each umgekehrt as z (z.antrag.id)}
      {@render zeile(z)}
    {:else}
      <div class="zeile"><span class="l leise">Noch keine Anträge für {jahr}</span></div>
    {/each}
    <button type="button" class="zeile aktion" onclick={() => (blatt = {})}><span class="l">+ Urlaub planen</span><span class="pfeil">›</span></button>
  </div>

  <div class="gruppe">
    <div class="zeile"><span class="l"><b>Resturlaub</b></span><span class="w stark">{zahl(rest)} {rest === 1 ? 'Tag' : 'Tage'}</span></div>
  </div>
  {#each spaeter as s (s.jahr)}
    <h2 class="abschnitt">Anträge {s.jahr}</h2>
    <div class="gruppe">
      {#each s.zeilen as z (z.antrag.id)}
        {@render zeile(z)}
      {/each}
    </div>
    <p class="hinweistext">Zählt erst im Urlaub {s.jahr}, nicht im Rest {jahr}.</p>
  {/each}

  <p class="hinweistext">Neuer Urlaub ist zunächst nur „geplant“: So lassen sich Varianten durchspielen, und bis zur Genehmigung lässt sich ein Eintrag spurlos löschen. Danach bleibt nur das Streichen, das sichtbar bleibt. „Beantragen und PDF“ macht daraus einen Antrag. Geplant und beantragt verringern den Rest schon, im Kalender steht der Urlaub erst nach der Genehmigung. Pläne erscheinen nicht im PDF, das PDF trägt das heutige Datum als Antragsdatum.</p>

  {#if meldung}<p class="hinweistext" role="status">{meldung}</p>{/if}
  <button type="button" class="knopf haupt" disabled={arbeitet} onclick={() => pdf()}>{arbeitet ? 'PDF wird erstellt …' : 'PDF erstellen'}</button>
</Blatt>

{#if blatt}
  <AntragBlatt vorhanden={blatt.vorhanden} {heute} schliessen={() => (blatt = null)} pdf={(x) => pdf(x)} />
{/if}

<style>
  .status {
    display: grid;
    grid-template-columns: 88px 30px 10px;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .status b {
    text-align: right;
  }
  .chip {
    justify-self: start;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border-radius: 6px;
    padding: 2px 7px;
  }
  .chip.genehmigt {
    background: var(--night);
    color: var(--lemon);
  }
  .chip.geplant {
    border: 1px dashed var(--label3);
    color: var(--label2);
    padding: 1px 6px;
  }
  .chip.beantragt {
    background: var(--fill);
    color: var(--label2);
  }
  .chip.gestrichen {
    background: #f6e3e1;
    color: var(--minus);
  }
  .gestrichen .datum {
    text-decoration: line-through;
    color: var(--label3);
  }
  .gestrichen b {
    color: var(--label3);
  }
  .pfeil {
    color: var(--label3);
  }
</style>
