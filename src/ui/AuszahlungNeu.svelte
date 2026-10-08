<script lang="ts">
  // Neuer Vorgang „Auszahlung Überstunden“: Formular ausfüllen, PDF erstellen – dabei wird der Antrag
  // als „beantragt“ gespeichert. Weiter geht es im Journal über „Weiterführen“.
  import { untrack } from 'svelte';
  import { type Antragsangaben, letzterAbgleich, neuerAntrag, pruefeAuszahlung, standardStichtag, stichtagWerte } from '../core/auszahlung';
  import { parseStunden } from '../core/buchungen';
  import { type Datum, datumDE, dauer } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let { heute, schliessen, fertig }: { heute: Datum; schliessen: () => void; fertig: (id: string) => void } = $props();

  const start = untrack(() => heute);
  let stichtag = $state<Datum>(standardStichtag(start));
  let abgleichAm = $state<Datum>(untrack(() => letzterAbgleich(speicher.daten)) ?? '');
  let stundenText = $state('');
  let abrechnung = $state(start.slice(0, 7));
  let bemerkung = $state('');
  let fehler = $state<string | null>(null);
  let arbeitet = $state(false);

  const werte = $derived(stichtag && stichtag <= heute ? stichtagWerte(speicher.daten, stichtag, heute) : null);
  const stunden = $derived(parseStunden(stundenText) ?? 0);

  async function antragStellen() {
    fehler = null;
    if (!werte) return (fehler = 'Bitte einen Stichtag bis heute wählen.');
    const angaben: Antragsangaben = { stichtag, ...werte, abgleichAm: abgleichAm || undefined, stunden, abrechnung: abrechnung || undefined, bemerkung: bemerkung.trim() || undefined };
    const f = pruefeAuszahlung(angaben);
    if (f) return (fehler = f);
    if (arbeitet) return;
    arbeitet = true;
    try {
      const { pdfAuszahlungsantrag } = await import('../lib/pdf');
      const r = await teileDatei(pdfAuszahlungsantrag(speicher.daten, angaben, heute), `antrag-auszahlung-ueberstunden-${heute}.pdf`);
      // Erst wenn das PDF wirklich weitergegeben wurde, gilt der Antrag als gestellt
      if (r === 'abgebrochen') return;
      const a = neuerAntrag(angaben, heute);
      await speicher.speichereAuszahlungsantrag(a);
      fertig(a.id);
    } catch (e) {
      fehler = `Das PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    } finally {
      arbeitet = false;
    }
  }
</script>

<Blatt titel="Auszahlung Überstunden" {schliessen}>
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

  <p class="hinweistext">Das PDF trägt das heutige Datum als Antragsdatum ({datumDE(heute)}). Danach steht der Vorgang als „beantragt“ im Journal.</p>
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
  <button type="button" class="knopf haupt" disabled={arbeitet} onclick={antragStellen}>{arbeitet ? 'PDF wird erstellt …' : 'Antrag stellen (PDF)'}</button>
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
</style>
