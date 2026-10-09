<script lang="ts">
  // Vorgang „Auszahlung Überstunden“ anlegen oder bearbeiten. „Sichern“ speichert (neu als Entwurf),
  // „Beantragen“ setzt den Status mit dem heutigen Antragsdatum. Das PDF ist optional und ändert nichts.
  import { untrack } from 'svelte';
  import { type Antragsangaben, ausgezahlt, letzterAbgleich, neuerAntrag, pruefeAuszahlung, standardStichtag, stichtagWerte } from '../core/auszahlung';
  import { parseStunden } from '../core/buchungen';
  import type { Auszahlungsantrag } from '../core/modell';
  import { type Datum, datumDE, dauer } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let { heute, vorhanden, schliessen, fertig }: { heute: Datum; vorhanden?: Auszahlungsantrag; schliessen: () => void; fertig: (id: string | null) => void } = $props();

  const a0 = untrack(() => vorhanden);
  const start = untrack(() => heute);
  let stichtag = $state<Datum>(a0?.stichtag ?? standardStichtag(start));
  let abgleichAm = $state<Datum>(a0 ? (a0.abgleichAm ?? '') : (untrack(() => letzterAbgleich(speicher.daten)) ?? ''));
  let stundenText = $state(a0 ? dauer(a0.stunden) : '');
  let abrechnung = $state(a0?.abrechnung ?? start.slice(0, 7));
  let bemerkung = $state(a0?.bemerkung ?? '');
  let genehmigtAm = $state<Datum>(a0?.genehmigtAm ?? '');
  let fehler = $state<string | null>(null);
  let meldung = $state<string | null>(null);
  let loeschenFragen = $state(false);

  const istEntwurf = !a0 || !!a0.entwurf;
  const werte = $derived(stichtag && stichtag <= heute ? stichtagWerte(speicher.daten, stichtag, heute) : null);
  const stunden = $derived(parseStunden(stundenText) ?? 0);
  const schonAusgezahlt = a0 ? ausgezahlt(a0) : 0;

  function angaben(): Antragsangaben | null {
    fehler = null;
    if (!werte) return (fehler = 'Bitte einen Stichtag bis heute wählen.'), null;
    const x: Antragsangaben = { stichtag, ...werte, abgleichAm: abgleichAm || undefined, stunden, abrechnung: abrechnung || undefined, bemerkung: bemerkung.trim() || undefined };
    const f = pruefeAuszahlung(x) ?? (stunden < schonAusgezahlt ? `Es sind schon ${dauer(schonAusgezahlt)} Std. ausgezahlt.` : null);
    return f ? ((fehler = f), null) : x;
  }

  async function speichern(beantragen: boolean) {
    const x = angaben();
    if (!x) return;
    const basis = a0 ?? neuerAntrag(x, heute, true);
    const neu: Auszahlungsantrag = {
      ...basis,
      ...x,
      genehmigtAm: genehmigtAm || undefined,
      ...(beantragen ? { entwurf: undefined, antragsdatum: heute } : {})
    };
    await speicher.speichereAuszahlungsantrag(neu);
    fertig(neu.id);
  }

  async function pdf() {
    const x = angaben();
    if (!x) return;
    // Antragsdatum, sobald beantragt – sonst das heutige Datum
    const datum = a0 && !a0.entwurf ? a0.antragsdatum : heute;
    const { pdfAuszahlungsantrag } = await import('../lib/pdf');
    const r = await teileDatei(pdfAuszahlungsantrag(speicher.daten, x, datum), `antrag-auszahlung-ueberstunden-${datum}.pdf`);
    meldung = r === 'abgebrochen' ? null : 'PDF erstellt';
  }

  async function loeschen() {
    if (!a0) return;
    await speicher.loescheAuszahlungsantrag(a0.id);
    fertig(null);
  }
</script>

<Blatt titel={a0 ? 'Auszahlung bearbeiten' : 'Auszahlung Überstunden'} {schliessen}>
  <div class="gruppe">
    <label class="zeile"><span class="l">Stichtag</span><input class="feld" type="date" id="az-stichtag" max={heute} bind:value={stichtag} /></label>
    <div class="zeile"><span class="l leise">Zeitkonto am Stichtag</span><span class="w">{werte ? dauer(werte.saldo, true) : '–'}</span></div>
    <div class="zeile"><span class="l"><b>Über dem Sockel</b></span><span class="w stark">{werte ? dauer(werte.ueber) : '–'}</span></div>
  </div>

  <div class="gruppe">
    <label class="zeile">
      <span class="l"><span>TiMaS-Abgleich am<small>{letzterAbgleich(speicher.daten) ? 'aus der letzten Buchung „Abgleich“' : 'Datum des Abgleichs'}</small></span></span>
      <input class="feld" type="date" id="az-abgleich" bind:value={abgleichAm} />
    </label>
    <label class="zeile"><span class="l">Stunden zur Auszahlung</span><StundenEingabe id="az-stunden" bind:wert={stundenText} /></label>
    <div class="zeile"><span class="l leise">Über dem Sockel danach</span><span class="w">{werte ? dauer(werte.ueber - stunden, werte.ueber < stunden) : '–'}</span></div>
  </div>

  <div class="gruppe">
    <label class="zeile"><span class="l">Mit Abrechnung für</span><input class="feld" type="month" id="az-abrechnung" bind:value={abrechnung} /></label>
    <label class="zeile"><span class="l">Bemerkung</span><input class="feld text" id="az-bemerkung" placeholder="optional" bind:value={bemerkung} /></label>
    {#if a0 && !a0.entwurf}
      <label class="zeile"><span class="l"><span>Genehmigt am<small>leer = noch nicht genehmigt</small></span></span><input class="feld" type="date" id="az-genehmigt" bind:value={genehmigtAm} /></label>
    {/if}
  </div>

  <p class="hinweistext">
    {istEntwurf ? '„Sichern“ legt einen Entwurf an, „Beantragen“ setzt den Status mit dem heutigen Datum.' : `Beantragt am ${datumDE(a0!.antragsdatum)}.`} Das PDF ist optional und ändert keinen Status.
  </p>
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
  {#if meldung}<p class="hinweistext" role="status">{meldung}</p>{/if}
  <button type="button" class="knopf haupt" onclick={() => speichern(false)}>Sichern</button>
  {#if istEntwurf}<button type="button" class="knopf neben" onclick={() => speichern(true)}>Beantragen</button>{/if}
  <button type="button" class="knopf neben" onclick={pdf}>Antrag als PDF</button>
  {#if a0}
    {#if loeschenFragen}
      <button type="button" class="knopf haupt rot-voll" onclick={loeschen}>Endgültig löschen{a0.auszahlungen.length ? ' (mit Zahlungen)' : ''}</button>
    {:else}
      <button type="button" class="knopf neben rot" onclick={() => (loeschenFragen = true)}>Löschen</button>
    {/if}
  {/if}
</Blatt>

<style>
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
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
  .rot {
    color: var(--minus);
  }
  .rot-voll {
    background: var(--minus) !important;
    color: #fff;
  }
</style>
