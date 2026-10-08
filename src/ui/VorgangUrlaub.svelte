<script lang="ts">
  // Vorgang „Planung“ (Urlaub) weiterführen: geplant → beantragt → genehmigt (Kalender) → genommen,
  // gestrichen bleibt sichtbar. Die Regeln entsprechen dem bisherigen Urlaubsantrag.
  import { untrack } from 'svelte';
  import { journalUrlaub, planstatus } from '../core/journal';
  import type { Urlaubsantrag } from '../core/modell';
  import { antragTage, kalenderFuer, pruefeAntrag } from '../core/urlaubsantrag';
  import { type Datum, datumDE, jahrVon, plusTage } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';

  let { id, heute, schliessen, bearbeiten }: { id: string; heute: Datum; schliessen: () => void; bearbeiten: (a: Urlaubsantrag) => void } = $props();

  const a = $derived(speicher.antraege.find((x) => x.id === id));
  const status = $derived(a ? planstatus(a, heute) : 'geplant');
  const tage = $derived(a ? antragTage(a.von, a.bis) : 0);
  // Rest wie im Journal (inkl. Urlaub, der nur im Kalender steht)
  const rest = $derived.by(() => {
    if (!a) return undefined;
    const e = journalUrlaub(speicher.daten, jahrVon(a.von), heute).monate.flatMap((m) => m.eintraege).find((x) => x.art === 'plan' && x.antrag.id === a!.id);
    return e && e.art === 'plan' ? e.rest : undefined;
  });
  const genehmiger = $derived(speicher.einstellungen.genehmiger || 'CHE');

  let datum = $state<Datum>(untrack(() => heute));
  let grund = $state('');
  let fehler = $state<string | null>(null);
  let loeschenFragen = $state(false);

  const zahl = (n: number) => String(n).replace('.', ',');
  const zeitraum = (x: Urlaubsantrag) => (x.von === x.bis ? datumDE(x.von) : `${datumDE(x.von).slice(0, 6)} – ${datumDE(x.bis)}`);
  const jetzt = () => new Date().toISOString();

  async function speichern(neu: Urlaubsantrag) {
    if (!a) return;
    await speicher.speichereAntrag(neu, kalenderFuer(speicher.tage, a, neu, jetzt()));
  }
  async function urlaubsschein(x: Urlaubsantrag) {
    const { pdfUrlaubsantrag } = await import('../lib/pdf');
    return teileDatei(pdfUrlaubsantrag(speicher.daten, jahrVon(x.von), heute, x.id), `urlaubsantrag-${jahrVon(x.von)}-${heute}.pdf`);
  }

  async function beantragen() {
    if (!a) return;
    const neu: Urlaubsantrag = { ...a, plan: undefined, beantragtAm: heute };
    await speichern(neu);
    await urlaubsschein(neu);
  }
  async function genehmigen() {
    if (!a) return;
    await speichern({ ...a, plan: undefined, genehmigt: true, genehmigtAm: datum || heute });
  }
  async function streichen() {
    if (!a) return;
    await speichern({ ...a, gestrichen: { am: datum || heute, grund: grund.trim() || undefined } });
  }
  async function aufheben() {
    if (!a) return;
    fehler = null;
    const neu: Urlaubsantrag = { ...a, gestrichen: undefined };
    const f = pruefeAntrag(neu, speicher.antraege);
    if (f) return (fehler = f);
    await speichern(neu);
  }
  async function loeschen() {
    if (!a) return;
    await speicher.loescheAntrag(a.id, kalenderFuer(speicher.tage, a, null, jetzt()));
    schliessen();
  }
</script>

<div class="antragsdunkel">
  <Blatt titel="Planung Urlaub" {schliessen}>
    {#if a}
      <div class="kopf">
        <small>{[a.sonstiges, a.vertretung ? `Vertretung ${a.vertretung}` : ''].filter(Boolean).join(' · ') || 'Urlaub'}</small>
        <b class:durch={status === 'gestrichen'}>{zeitraum(a)}</b>
        <small class="num">{zahl(tage)} {tage === 1 ? 'Urlaubstag' : 'Urlaubstage'}{rest !== undefined && status !== 'gestrichen' ? ` · Rest danach ${zahl(rest)}` : ''}</small>
      </div>

      {#if status === 'gestrichen'}
        <p class="warnung">Gestrichen am {datumDE(a.gestrichen!.am)}{a.gestrichen!.grund ? ` – ${a.gestrichen!.grund}` : ''}. Die Tage zählen nicht mehr.</p>
      {:else}
        <ol class="ablauf">
          <li class="fertig"><i>✓</i><span>Geplant</span><span class="info">{datumDE(a.erstelltAm.slice(0, 10))}</span></li>
          <li class={status === 'geplant' ? 'jetzt' : 'fertig'}><i>{status === 'geplant' ? '' : '✓'}</i><span>Beantragt</span>
            {#if status !== 'geplant'}<button type="button" class="info" onclick={() => urlaubsschein(a!)}>{a.beantragtAm ? datumDE(a.beantragtAm) + ' · ' : ''}Urlaubsschein ↗</button>{:else}<span></span>{/if}
          </li>
          <li class={status === 'beantragt' ? 'jetzt' : status === 'genehmigt' || status === 'genommen' ? 'fertig' : ''}><i>{status === 'genehmigt' || status === 'genommen' ? '✓' : ''}</i><span>Genehmigt</span><span class="info">{a.genehmigtAm ? `${datumDE(a.genehmigtAm)} · ${genehmiger}` : '→ Kalender'}</span></li>
          <li class={status === 'genehmigt' ? 'jetzt' : status === 'genommen' ? 'fertig' : ''}><i>{status === 'genommen' ? '✓' : ''}</i><span>Genommen</span><span class="info">{status === 'genommen' ? 'erledigt' : `automatisch ab ${datumDE(plusTage(a.bis, 1))}`}</span></li>
        </ol>
      {/if}

      {#if status === 'geplant'}
        <h2 class="abschnitt">Nächster Schritt · Antrag stellen</h2>
        <p class="hinweistext">Erstellt den Urlaubsschein als PDF mit dem heutigen Datum. Bis dahin zählt der Plan im Rest mit und steht gestrichelt im Kalender.</p>
        <button type="button" class="knopf haupt" onclick={beantragen}>Antrag stellen (PDF)</button>
      {:else if status === 'beantragt'}
        <h2 class="abschnitt">Nächster Schritt · Genehmigung erfassen</h2>
        <div class="gruppe">
          <div class="zeile"><span class="l">Genehmigt von</span><span class="w stark">{genehmiger}</span></div>
          <label class="zeile"><span class="l">am</span><input class="feld" type="date" id="vu-genehmigt" bind:value={datum} /></label>
        </div>
        <p class="hinweistext">Danach stehen die Tage voll eingetragen im Kalender.</p>
        <button type="button" class="knopf haupt" onclick={genehmigen}>Genehmigt</button>
      {:else if status === 'genehmigt' || status === 'genommen'}
        <h2 class="abschnitt">Streichen</h2>
        <div class="gruppe">
          <label class="zeile"><span class="l">Grund</span><input class="feld text" id="vu-grund" placeholder="optional" bind:value={grund} /></label>
          <label class="zeile"><span class="l">gestrichen am</span><input class="feld" type="date" id="vu-gestrichen" bind:value={datum} /></label>
        </div>
        <p class="hinweistext">Der Vorgang bleibt durchgestrichen sichtbar, die Tage gehen zurück aufs Konto und verschwinden aus dem Kalender.</p>
        <button type="button" class="knopf neben rot" onclick={streichen}>Streichen</button>
      {:else}
        {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
        <button type="button" class="knopf neben" onclick={aufheben}>Streichung aufheben</button>
      {/if}

      <div class="unten">
        {#if status === 'geplant' || status === 'beantragt'}
          <button type="button" class="textknopf" onclick={() => bearbeiten(a!)}>Bearbeiten</button>
          {#if loeschenFragen}
            <button type="button" class="textknopf rot" onclick={loeschen}>Wirklich löschen</button>
          {:else}
            <button type="button" class="textknopf" onclick={() => (loeschenFragen = true)}>{status === 'geplant' ? 'Plan löschen' : 'Antrag löschen'}</button>
          {/if}
        {:else if status !== 'gestrichen'}
          <button type="button" class="textknopf" onclick={() => urlaubsschein(a!)}>Urlaubsschein erneut</button>
        {/if}
      </div>
    {/if}
  </Blatt>
</div>

<style>
  .kopf {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .kopf small {
    color: var(--label2);
    font-size: 13px;
  }
  .kopf b {
    font-size: 24px;
  }
  .durch {
    text-decoration: line-through;
    color: var(--label2);
  }
  .warnung {
    margin: 0;
    background: var(--orange-glow);
    color: var(--orange-text);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
  }
  .ablauf {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ablauf li {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 9px 0;
    color: var(--label2);
  }
  .ablauf li + li {
    border-top: 1px solid var(--sep);
  }
  .ablauf i {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--sep);
    box-sizing: border-box;
    display: grid;
    place-items: center;
    font-style: normal;
    font-size: 11px;
    font-weight: 800;
  }
  .ablauf .fertig {
    color: var(--label);
  }
  .ablauf .fertig i {
    background: var(--label);
    border-color: var(--label);
    color: var(--bg);
  }
  .ablauf .jetzt {
    color: var(--label);
    font-weight: 600;
  }
  .ablauf .jetzt i {
    background: var(--orange);
    border-color: var(--orange);
    box-shadow: 0 0 0 5px var(--orange-glow);
  }
  .info {
    font-size: 13px;
    color: var(--label2);
    font-weight: 400;
  }
  .feld {
    font: inherit;
    font-weight: 600;
    border: none;
    background: var(--fill);
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--label);
  }
  .text {
    flex: 1;
    min-width: 0;
    max-width: 55%;
    text-align: right;
    font-weight: 500;
  }
  .fehler {
    margin: 0;
    color: var(--orange-text);
    padding: 0 16px;
    font-size: 14px;
  }
  .unten {
    display: flex;
    justify-content: space-between;
  }
  .textknopf {
    color: var(--label2);
    font-size: 14px;
    padding: 4px;
  }
  .rot {
    color: #ff6b60;
  }
</style>
