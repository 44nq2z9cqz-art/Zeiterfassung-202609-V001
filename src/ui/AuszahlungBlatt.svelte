<script lang="ts">
  // Antrag auf Auszahlung von Überstunden (Konten): Antrag als PDF erstellen – er wird dabei als „beantragt“
  // gespeichert – und unter „Beantragte Auszahlungen“ die tatsächlichen Auszahlungen je Abrechnungsmonat erfassen.
  import { untrack } from 'svelte';
  import {
    type Antragsangaben,
    ausgezahlt,
    letzterAbgleich,
    monatsletzter,
    monatText,
    neuerAntrag,
    offen,
    pruefeAuszahlung,
    pruefeRate,
    rateMitBuchung,
    standardStichtag,
    stichtagWerte
  } from '../core/auszahlung';
  import { parseStunden } from '../core/buchungen';
  import type { Auszahlungsantrag } from '../core/modell';
  import { type Datum, datumDE, dauer } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let { heute, schliessen }: { heute: Datum; schliessen: () => void } = $props();

  const start = untrack(() => heute);
  let reiter = $state<'neu' | 'beantragt'>(untrack(() => (speicher.auszahlungen.some((a) => offen(a) > 0) ? 'beantragt' : 'neu')));
  let fehler = $state<string | null>(null);
  let meldung = $state<string | null>(null);
  let arbeitet = $state(false);

  // ─── Neuer Antrag ──────────────────────────────────────────────────────
  let stichtag = $state<Datum>(standardStichtag(start));
  let abgleichAm = $state<Datum>(untrack(() => letzterAbgleich(speicher.daten)) ?? '');
  let stundenText = $state('');
  let abrechnung = $state(start.slice(0, 7));
  let bemerkung = $state('');

  const werte = $derived(stichtag && stichtag <= heute ? stichtagWerte(speicher.daten, stichtag, heute) : null);
  const stunden = $derived(parseStunden(stundenText) ?? 0);

  async function teilePdf(angaben: Antragsangaben, antragsdatum: Datum) {
    const { pdfAuszahlungsantrag } = await import('../lib/pdf');
    return teileDatei(pdfAuszahlungsantrag(speicher.daten, angaben, antragsdatum), `antrag-auszahlung-ueberstunden-${antragsdatum}.pdf`);
  }

  async function pdf() {
    fehler = null;
    meldung = null;
    if (!werte) return (fehler = 'Bitte einen Stichtag bis heute wählen.');
    const angaben: Antragsangaben = { stichtag, ...werte, abgleichAm: abgleichAm || undefined, stunden, abrechnung: abrechnung || undefined, bemerkung: bemerkung.trim() || undefined };
    const f = pruefeAuszahlung(angaben);
    if (f) return (fehler = f);
    if (arbeitet) return;
    arbeitet = true;
    try {
      const r = await teilePdf(angaben, heute);
      if (r === 'abgebrochen') return;
      // Erst wenn das PDF wirklich weitergegeben wurde, gilt der Antrag als gestellt
      const a = neuerAntrag(angaben, heute);
      await speicher.speichereAuszahlungsantrag(a);
      stundenText = '';
      bemerkung = '';
      reiter = 'beantragt';
      oeffne(a);
      meldung = `Antrag über ${dauer(a.stunden)} Std. als „beantragt“ gespeichert.`;
    } catch (e) {
      fehler = `Das PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    } finally {
      arbeitet = false;
    }
  }

  // ─── Beantragte Auszahlungen ───────────────────────────────────────────
  const liste = $derived([...speicher.auszahlungen].sort((a, b) => b.antragsdatum.localeCompare(a.antragsdatum) || b.id.localeCompare(a.id)));
  let gewaehlt = $state<string | null>(null);
  const antrag = $derived(speicher.auszahlungen.find((a) => a.id === gewaehlt) ?? null);
  let rateMonat = $state('');
  let rateText = $state('');
  let loeschenFragen = $state(false);
  // Zähler, damit das Stundenfeld nach jedem neuen Vorschlag frisch aufgebaut wird
  let eingabeNr = $state(0);

  /** Vorschlag für die nächste Auszahlung: Monat laut Antrag bzw. nach der letzten Auszahlung, Stunden = noch offen. */
  function oeffne(a: Auszahlungsantrag) {
    gewaehlt = a.id;
    fehler = null;
    meldung = null;
    loeschenFragen = false;
    const letzte = a.auszahlungen.at(-1)?.monat;
    rateMonat = letzte ? naechsterMonat(letzte) : (a.abrechnung ?? start.slice(0, 7));
    rateText = offen(a) ? dauer(offen(a)) : '';
    eingabeNr++;
  }
  function naechsterMonat(m: string) {
    const [j, mo] = m.split('-').map(Number);
    return mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, '0')}`;
  }

  async function rateBuchen() {
    if (!antrag) return;
    fehler = null;
    const min = parseStunden(rateText) ?? 0;
    const f = pruefeRate(antrag, rateMonat, min);
    if (f) return (fehler = f);
    const { buchung, antrag: neu } = rateMitBuchung(antrag, rateMonat, min);
    await speicher.speichereAuszahlungsantrag(neu, buchung);
    oeffne(neu);
    meldung = `${dauer(min)} Std. zum ${datumDE(buchung.datum)} vom Zeitkonto abgebucht.`;
  }

  async function rateZuruecknehmen(rateId: string) {
    if (!antrag) return;
    await speicher.loescheRate(antrag.id, rateId);
    meldung = 'Auszahlung zurückgenommen, die Buchung ist entfernt.';
  }

  async function antragLoeschen() {
    if (!antrag) return;
    await speicher.loescheAuszahlungsantrag(antrag.id);
    gewaehlt = null;
    loeschenFragen = false;
  }

  async function pdfErneut() {
    if (!antrag || arbeitet) return;
    arbeitet = true;
    try {
      await teilePdf(antrag, antrag.antragsdatum);
    } finally {
      arbeitet = false;
    }
  }
</script>

<Blatt titel="Auszahlung von Überstunden" {schliessen}>
  {#if !antrag}
    <div class="segmente">
      <button type="button" aria-pressed={reiter === 'neu'} onclick={() => ((reiter = 'neu'), (fehler = null))}>Antrag stellen</button>
      <button type="button" aria-pressed={reiter === 'beantragt'} onclick={() => ((reiter = 'beantragt'), (fehler = null))}>Beantragte Auszahlungen</button>
    </div>
  {/if}

  {#if antrag}
    <!-- Ein beantragter Antrag mit seinen Auszahlungen -->
    <button type="button" class="zurueck" onclick={() => (gewaehlt = null)}>‹ Beantragte Auszahlungen</button>
    <div class="gruppe">
      <div class="zeile"><span class="l"><span>Antrag vom {datumDE(antrag.antragsdatum)}<small>Stichtag {datumDE(antrag.stichtag)} · über dem Sockel {dauer(antrag.ueber)}{antrag.abrechnung ? ` · gewünscht ${monatText(antrag.abrechnung)}` : ''}</small></span></span></div>
      <div class="zeile"><span class="l leise">Beantragt</span><span class="w">{dauer(antrag.stunden)}</span></div>
      <div class="zeile"><span class="l leise">Ausgezahlt</span><span class="w">{dauer(ausgezahlt(antrag))}</span></div>
      <div class="zeile"><span class="l"><b>Saldo noch offen</b></span><span class="w stark">{dauer(offen(antrag))}</span></div>
    </div>

    <h2 class="abschnitt">Auszahlungen</h2>
    <div class="gruppe">
      {#each antrag.auszahlungen as r (r.id)}
        <div class="zeile">
          <span class="l"><span>Abrechnung {monatText(r.monat)}<small>vom Zeitkonto abgebucht zum {datumDE(monatsletzter(r.monat))}</small></span></span>
          <span class="w stark">{dauer(r.stunden)} <button type="button" class="entfernen" aria-label="Auszahlung {monatText(r.monat)} zurücknehmen" onclick={() => rateZuruecknehmen(r.id)}>✕</button></span>
        </div>
      {:else}
        <div class="zeile"><span class="l leise">Noch keine Auszahlung erfasst</span></div>
      {/each}
    </div>

    {#if offen(antrag) > 0}
      <h2 class="abschnitt">Auszahlung erfassen</h2>
      <div class="gruppe">
        <label class="zeile"><span class="l">Ausgezahlt mit Abrechnung</span><input class="feld" type="month" id="az-rate-monat" bind:value={rateMonat} /></label>
        <label class="zeile"><span class="l">Anzahl Stunden</span>{#key eingabeNr}<StundenEingabe id="az-rate-stunden" bind:wert={rateText} />{/key}</label>
        <div class="zeile"><span class="l leise">Saldo danach</span><span class="w">{dauer(Math.max(0, offen(antrag) - (parseStunden(rateText) ?? 0)))}</span></div>
      </div>
      <p class="hinweistext">Die Stunden werden zum Monatsletzten des Abrechnungsmonats als „Auszahlung“ vom Zeitkonto abgebucht.</p>
    {/if}
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
    {#if offen(antrag) > 0}<button type="button" class="knopf haupt" onclick={rateBuchen}>Auszahlung buchen</button>{/if}
    <button type="button" class="knopf neben" disabled={arbeitet} onclick={pdfErneut}>PDF erneut erstellen</button>
    {#if loeschenFragen}
      <p class="hinweistext mitte">Der Antrag wird gelöscht{antrag.auszahlungen.length ? ', ebenso die Buchungen seiner Auszahlungen' : ''}.</p>
      <button type="button" class="knopf neben rot" onclick={antragLoeschen}>Endgültig löschen</button>
    {:else}
      <button type="button" class="textknopf" onclick={() => (loeschenFragen = true)}>Antrag löschen</button>
    {/if}
  {:else if reiter === 'beantragt'}
    <div class="gruppe">
      {#each liste as a (a.id)}
        <button type="button" class="zeile" onclick={() => oeffne(a)}>
          <span class="l"><span>Antrag vom {datumDE(a.antragsdatum)}<small>{dauer(a.stunden)} beantragt{a.auszahlungen.length ? ` · ${dauer(ausgezahlt(a))} ausgezahlt` : ''}</small></span></span>
          <span class="w">
            <span class="chip" class:fertig={offen(a) === 0}>{offen(a) === 0 ? 'ausgezahlt' : 'beantragt'}</span>
            {#if offen(a) > 0}<b class="num">{dauer(offen(a))}</b>{/if}
            <span class="pfeil">›</span>
          </span>
        </button>
      {:else}
        <div class="zeile"><span class="l leise">Noch keine Anträge. Ein Antrag wird beim Erstellen des PDFs gespeichert.</span></div>
      {/each}
    </div>
    {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
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

    <p class="hinweistext">Das PDF trägt das heutige Datum als Antragsdatum ({datumDE(heute)}). Beim Erstellen wird der Antrag unter „Beantragte Auszahlungen“ gespeichert; dort erfasst du später die Auszahlungen.</p>
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <button type="button" class="knopf haupt" disabled={arbeitet} onclick={pdf}>{arbeitet ? 'PDF wird erstellt …' : 'PDF erstellen'}</button>
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
  .zurueck {
    align-self: flex-start;
    font-weight: 500;
    color: var(--label2);
    padding: 0 4px;
  }
  .chip {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border-radius: 6px;
    padding: 2px 7px;
    background: var(--fill);
    color: var(--label2);
  }
  .chip.fertig {
    background: var(--flaeche);
    color: var(--lemon);
  }
  .entfernen {
    color: var(--label3);
    font-size: 14px;
    padding: 4px 6px;
  }
  .rot {
    color: var(--minus);
  }
  .textknopf {
    color: var(--label2);
    font-size: 14px;
    padding: 4px;
  }
</style>
