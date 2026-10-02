<script lang="ts">
  // Antrag auf Auszahlung von Überstunden (Berichte): PDF erstellen und nach der Genehmigung abbuchen
  import { untrack } from 'svelte';
  import { type Auszahlungsantrag, auszahlungsBuchung, letzterAbgleich, pruefeAuszahlung, standardStichtag, stichtagWerte } from '../core/auszahlung';
  import { parseStunden } from '../core/buchungen';
  import { type Datum, datumDE, dauer } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let { heute, schliessen }: { heute: Datum; schliessen: () => void } = $props();

  const start = untrack(() => heute);
  let stichtag = $state<Datum>(standardStichtag(start));
  let abgleichAm = $state<Datum>(untrack(() => letzterAbgleich(speicher.daten)) ?? '');
  let stundenText = $state('');
  let abrechnung = $state(start.slice(0, 7));
  let bemerkung = $state('');
  let fehler = $state<string | null>(null);
  let meldung = $state<string | null>(null);
  let arbeitet = $state(false);
  let buchenFragen = $state(false);
  let buchungsdatum = $state<Datum>(start);

  const werte = $derived(stichtag && stichtag <= heute ? stichtagWerte(speicher.daten, stichtag, heute) : null);
  const stunden = $derived(parseStunden(stundenText) ?? 0);
  const antrag = $derived<Auszahlungsantrag | null>(
    werte ? { stichtag, ...werte, abgleichAm: abgleichAm || undefined, stunden, abrechnung: abrechnung || undefined, bemerkung: bemerkung.trim() || undefined } : null
  );

  function pruefen(): Auszahlungsantrag | null {
    fehler = null;
    if (!antrag) return (fehler = 'Bitte einen Stichtag bis heute wählen.'), null;
    const f = pruefeAuszahlung(antrag);
    return f ? ((fehler = f), null) : antrag;
  }

  async function pdf() {
    const a = pruefen();
    if (!a || arbeitet) return;
    arbeitet = true;
    meldung = null;
    try {
      const { pdfAuszahlungsantrag } = await import('../lib/pdf');
      const r = await teileDatei(pdfAuszahlungsantrag(speicher.daten, a, heute), `antrag-auszahlung-ueberstunden-${heute}.pdf`);
      meldung = r === 'abgebrochen' ? null : r === 'geteilt' ? 'Antrag geteilt' : 'Antrag gespeichert';
    } catch (e) {
      meldung = `Das PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    } finally {
      arbeitet = false;
    }
  }

  async function buchen() {
    const a = pruefen();
    if (!a) return;
    await speicher.speichereBuchung(auszahlungsBuchung(a, buchungsdatum || heute, heute));
    schliessen();
  }
</script>

<Blatt titel={buchenFragen ? 'Auszahlung buchen' : 'Antrag auf Auszahlung'} {schliessen}>
  {#if buchenFragen}
    <p class="hinweistext mitte"><b>{dauer(stunden)} Std.</b> werden als Auszahlung vom Zeitkonto abgebucht. Am besten erst, wenn der Antrag genehmigt und die Auszahlung in TiMaS gebucht ist.</p>
    <div class="gruppe">
      <label class="zeile"><span class="l">Buchen am</span><input class="feld" type="date" id="az-buchung" bind:value={buchungsdatum} /></label>
    </div>
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <button type="button" class="knopf haupt" onclick={buchen}>Abbuchen</button>
    <button type="button" class="knopf neben" onclick={() => (buchenFragen = false)}>Abbrechen</button>
  {:else}
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
    </div>

    <p class="hinweistext">Das PDF trägt das heutige Datum als Antragsdatum ({datumDE(heute)}). Nach der Genehmigung bucht „Auszahlung buchen“ die Stunden vom Zeitkonto ab.</p>
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
    <button type="button" class="knopf haupt" disabled={arbeitet} onclick={pdf}>{arbeitet ? 'PDF wird erstellt …' : 'PDF erstellen'}</button>
    <button type="button" class="knopf neben" onclick={() => pruefen() && (buchenFragen = true)}>Auszahlung buchen</button>
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
  .mitte {
    text-align: center;
  }
  .fehler {
    margin: 0;
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
</style>
