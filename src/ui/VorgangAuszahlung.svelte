<script lang="ts">
  // Vorgang „Auszahlung Überstunden“ weiterführen: beantragt → genehmigt → Teilzahlungen → ausgezahlt.
  import { untrack } from 'svelte';
  import { auszahlungsstatus, ausgezahlt, monatsletzter, monatText, offen, pruefeRate, rateMitBuchung } from '../core/auszahlung';
  import { parseStunden } from '../core/buchungen';
  import { type Datum, datumDE, dauer } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let { id, heute, schliessen }: { id: string; heute: Datum; schliessen: () => void } = $props();

  const a = $derived(speicher.auszahlungen.find((x) => x.id === id));
  const status = $derived(a ? auszahlungsstatus(a) : 'beantragt');
  const genehmiger = $derived(speicher.einstellungen.genehmiger || 'CHE');

  let genehmigtAm = $state<Datum>(untrack(() => heute));
  let fehler = $state<string | null>(null);
  let meldung = $state<string | null>(null);
  let loeschenFragen = $state(false);
  // Vorschlag für die nächste Teilzahlung: Monat laut Antrag bzw. nach der letzten Zahlung, Stunden = offen
  let rateMonat = $state('');
  let rateText = $state('');
  let eingabeNr = $state(0);
  function vorschlagen() {
    if (!a) return;
    const letzte = a.auszahlungen.at(-1)?.monat;
    rateMonat = letzte ? naechsterMonat(letzte) : (a.abrechnung ?? heute.slice(0, 7));
    rateText = offen(a) ? dauer(offen(a)) : '';
    eingabeNr++;
  }
  function naechsterMonat(m: string) {
    const [j, mo] = m.split('-').map(Number);
    return mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, '0')}`;
  }
  $effect(() => {
    if (a && !rateMonat) untrack(vorschlagen);
  });

  async function genehmigen() {
    if (!a) return;
    await speicher.speichereAuszahlungsantrag({ ...a, genehmigtAm: genehmigtAm || heute });
    meldung = 'Genehmigung erfasst.';
  }

  async function rateBuchen() {
    if (!a) return;
    fehler = null;
    const min = parseStunden(rateText) ?? 0;
    const f = pruefeRate(a, rateMonat, min);
    if (f) return (fehler = f);
    const { buchung, antrag } = rateMitBuchung(a, rateMonat, min);
    await speicher.speichereAuszahlungsantrag(antrag, buchung);
    rateMonat = '';
    vorschlagen();
    meldung = `${dauer(min)} Std. zum ${datumDE(buchung.datum)} vom Zeitkonto abgebucht.`;
  }

  async function pdf() {
    if (!a) return;
    const { pdfAuszahlungsantrag } = await import('../lib/pdf');
    await teileDatei(pdfAuszahlungsantrag(speicher.daten, a, a.antragsdatum), `antrag-auszahlung-ueberstunden-${a.antragsdatum}.pdf`);
  }

  async function loeschen() {
    if (!a) return;
    await speicher.loescheAuszahlungsantrag(a.id);
    schliessen();
  }
</script>

<div class="antragsdunkel">
  <Blatt titel="Auszahlung Überstunden" {schliessen}>
    {#if a}
      <div class="kopf">
        <small>Stichtag {datumDE(a.stichtag)} · über dem Sockel {dauer(a.ueber)}</small>
        <b>{dauer(a.stunden)} Std. beantragt</b>
      </div>

      <div class="zahlen">
        <div><small>BEANTRAGT</small><b class="num">{dauer(a.stunden)}</b></div>
        <div><small>AUSGEZAHLT</small><b class="num">{dauer(ausgezahlt(a))}</b></div>
        <div class="orange"><small>OFFEN</small><b class="num">{dauer(offen(a))}</b></div>
      </div>

      <ol class="ablauf">
        <li class="fertig"><i>✓</i><span>Beantragt</span><button type="button" class="link" onclick={pdf}>{datumDE(a.antragsdatum)} · PDF ↗</button></li>
        <li class={status === 'beantragt' ? 'jetzt' : 'fertig'}><i>{status === 'beantragt' ? '' : '✓'}</i><span>Genehmigt</span><span class="info">{a.genehmigtAm ? `${datumDE(a.genehmigtAm)} · ${genehmiger}` : a.auszahlungen.length ? 'ohne Datum' : ''}</span></li>
        <li class={status === 'teilweise' ? 'jetzt' : status === 'ausgezahlt' ? 'fertig' : ''}><i>{status === 'ausgezahlt' ? '✓' : ''}</i><span>Teilweise ausgezahlt</span><span class="info">{a.auszahlungen.length} {a.auszahlungen.length === 1 ? 'Zahlung' : 'Zahlungen'}</span></li>
        <li class={status === 'ausgezahlt' ? 'fertig' : ''}><i>{status === 'ausgezahlt' ? '✓' : ''}</i><span>Vollständig ausgezahlt</span><span class="info">automatisch</span></li>
      </ol>

      {#if a.auszahlungen.length}
        <div class="gruppe">
          {#each a.auszahlungen as r (r.id)}
            <div class="zeile">
              <span class="l"><span>Abrechnung {monatText(r.monat)}<small>abgebucht zum {datumDE(monatsletzter(r.monat))}</small></span></span>
              <span class="w stark">{dauer(r.stunden)} <button type="button" class="entfernen" aria-label="Zahlung {monatText(r.monat)} zurücknehmen" onclick={() => speicher.loescheRate(a!.id, r.id)}>✕</button></span>
            </div>
          {/each}
        </div>
      {/if}

      {#if status === 'beantragt'}
        <h2 class="abschnitt">Nächster Schritt · Genehmigung erfassen</h2>
        <div class="gruppe">
          <div class="zeile"><span class="l">Genehmigt von</span><span class="w stark">{genehmiger}</span></div>
          <label class="zeile"><span class="l">am</span><input class="feld" type="date" id="va-genehmigt" bind:value={genehmigtAm} /></label>
        </div>
        {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
        <button type="button" class="knopf haupt" onclick={genehmigen}>Genehmigt</button>
      {:else if status !== 'ausgezahlt'}
        <h2 class="abschnitt">Nächster Schritt · Teilauszahlung</h2>
        <div class="gruppe">
          <label class="zeile"><span class="l">Abrechnungsmonat</span><input class="feld" type="month" id="va-monat" bind:value={rateMonat} /></label>
          <label class="zeile"><span class="l">Stunden</span>{#key eingabeNr}<StundenEingabe id="va-stunden" bind:wert={rateText} />{/key}</label>
        </div>
        <p class="hinweistext">Wird zum {rateMonat ? datumDE(monatsletzter(rateMonat)) : 'Monatsletzten'} vom Zeitkonto abgebucht.</p>
        {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
        {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
        <button type="button" class="knopf haupt" onclick={rateBuchen}>Auszahlung buchen</button>
      {:else}
        {#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
        <p class="hinweistext mitte">Vollständig ausgezahlt.</p>
      {/if}

      {#if loeschenFragen}
        <p class="hinweistext mitte">Der Antrag wird gelöscht{a.auszahlungen.length ? ', ebenso die Buchungen seiner Zahlungen' : ''}.</p>
        <button type="button" class="knopf neben rot" onclick={loeschen}>Endgültig löschen</button>
      {:else}
        <button type="button" class="textknopf" onclick={() => (loeschenFragen = true)}>Antrag löschen</button>
      {/if}
    {/if}
  </Blatt>
</div>

<style>
  .kopf {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kopf small {
    color: var(--label2);
    font-size: 13px;
  }
  .kopf b {
    font-size: 24px;
  }
  .zahlen {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid var(--sep);
    border-radius: 12px;
  }
  .zahlen div {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
  }
  .zahlen div + div {
    border-left: 1px solid var(--sep);
  }
  .zahlen small {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--label2);
  }
  .zahlen b {
    font-size: 18px;
  }
  .orange,
  .orange small {
    color: var(--orange) !important;
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
  .info,
  .link {
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
  .entfernen {
    color: var(--label3);
    font-size: 14px;
    padding: 4px 6px;
  }
  .mitte {
    text-align: center;
  }
  .fehler {
    margin: 0;
    color: var(--orange-text);
    padding: 0 16px;
    font-size: 14px;
  }
  .rot {
    color: #ff6b60;
  }
  .textknopf {
    color: var(--label2);
    font-size: 14px;
    padding: 4px;
  }
</style>
