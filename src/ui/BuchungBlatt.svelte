<script lang="ts">
  import { untrack } from 'svelte';
  import { ART_NAMEN, ARTEN_URLAUB, ARTEN_ZEIT, appSaldoAm, baueBuchung, parseStunden, parseTage } from '../core/buchungen';
  import type { Buchung, Buchungsart, Konto } from '../core/modell';
  import { type Datum, datumDE, dauer, plusTage } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  let {
    konto,
    art: startArt,
    vorhanden,
    heute,
    schliessen
  }: { konto: Konto; art: Buchungsart; vorhanden?: Buchung; heute: Datum; schliessen: () => void } = $props();

  const b0 = untrack(() => vorhanden);
  const stundenText = (m: number) => `${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
  const standardDatum = (a: Buchungsart): Datum => {
    const start = speicher.einstellungen.appStart;
    if (a === 'vortrag') return plusTage(start, -1);
    if (a === 'resturlaub') return `${heute.slice(0, 4)}-01-01`;
    return heute;
  };

  let art = $state<Buchungsart>(untrack(() => b0?.art ?? startArt));
  let datum = $state<Datum>(untrack(() => b0?.datum ?? standardDatum(startArt)));
  let vorzeichen = $state<1 | -1>(b0 && b0.art !== 'abgleich' && b0.betrag < 0 ? -1 : 1);
  let betrag = $state(b0 && b0.art !== 'abgleich' ? (b0.konto === 'zeit' ? stundenText(b0.betrag) : String(Math.abs(b0.betrag)).replace('.', ',')) : '');
  let firmaVorzeichen = $state<1 | -1>(b0?.abgleich && b0.abgleich.firma < 0 ? -1 : 1);
  let firma = $state(b0?.abgleich ? stundenText(b0.abgleich.firma) : '');
  let kommentar = $state(b0?.kommentar ?? '');
  let fehler = $state<string | null>(null);
  let loeschenFragen = $state(false);

  const arten = $derived(konto === 'zeit' ? ARTEN_ZEIT : ARTEN_URLAUB);
  const mitVorzeichen = $derived(art === 'vortrag' || art === 'korrektur');

  function artWaehlen(a: Buchungsart) {
    if (!b0) datum = standardDatum(a);
    art = a;
    fehler = null;
  }

  // Vorschau für den Abgleich
  const appSaldo = $derived(art === 'abgleich' && datum && datum <= heute ? appSaldoAm(speicher.daten, datum, heute, b0?.id) : null);
  const firmaMin = $derived(parseStunden(firma));
  const differenz = $derived(appSaldo !== null && firmaMin !== null ? firmaVorzeichen * firmaMin - appSaldo : null);

  async function sichern() {
    fehler = null;
    const wert = konto === 'zeit' ? parseStunden(betrag) : parseTage(betrag);
    if (art !== 'abgleich' && betrag.trim() && wert === null) {
      fehler = konto === 'zeit' ? 'Bitte Stunden und Minuten eingeben, Minuten höchstens 59.' : 'Bitte ganze oder halbe Tage eingeben, z. B. 2 oder 0,5.';
      return;
    }
    if (art === 'abgleich' && firma.trim() && firmaMin === null) {
      fehler = 'Bitte beim Saldo Stunden und Minuten eingeben, Minuten höchstens 59.';
      return;
    }
    const r = baueBuchung(
      { id: b0?.id, konto, art, datum, wert: wert ?? 0, vorzeichen, kommentar, firma: firmaMin === null ? undefined : firmaVorzeichen * firmaMin },
      speicher.daten,
      heute
    );
    if (r.fehler) {
      fehler = r.fehler;
      return;
    }
    await speicher.speichereBuchung(r.buchung!);
    schliessen();
  }

  async function loeschen() {
    if (b0) await speicher.loescheBuchung(b0.id);
    schliessen();
  }
</script>

<Blatt titel={b0 ? 'Buchung ändern' : konto === 'zeit' ? 'Buchung Zeitkonto' : 'Buchung Urlaubskonto'} {schliessen}>
  {#if loeschenFragen}
    <p class="hinweistext mitte">{ART_NAMEN[art]} vom {datumDE(datum)} wirklich löschen?</p>
    <button type="button" class="knopf haupt rot-voll" onclick={loeschen}>Buchung löschen</button>
    <button type="button" class="knopf neben" onclick={() => (loeschenFragen = false)}>Abbrechen</button>
  {:else}
    <div class="segmente klein">
      {#each arten as a (a)}
        <button type="button" aria-pressed={art === a} onclick={() => artWaehlen(a)}>{a === 'abgleich' ? 'Abgleich' : a === 'resturlaub' ? 'Resturlaub' : ART_NAMEN[a]}</button>
      {/each}
    </div>

    <div class="gruppe">
      <label class="zeile"><span class="l">{art === 'abgleich' ? 'Stichtag' : 'Datum'}</span><input class="feld" type="date" id="b-datum" bind:value={datum} /></label>

      {#if art === 'abgleich'}
        <div class="zeile">
          <span class="l">Saldo laut Firma</span>
          <span class="w">
            <button type="button" class="vz" onclick={() => (firmaVorzeichen = firmaVorzeichen === 1 ? -1 : 1)} aria-label="Vorzeichen wechseln">{firmaVorzeichen === 1 ? '+' : '−'}</button>
            <StundenEingabe id="b-firma" bind:wert={firma} />
          </span>
        </div>
        {#if appSaldo !== null}<div class="zeile"><span class="l leise">Saldo laut App</span><span class="w">{dauer(appSaldo, true)}</span></div>{/if}
      {:else}
        <div class="zeile">
          <span class="l">{konto === 'zeit' ? (art === 'auszahlung' ? 'Ausgezahlte Stunden' : 'Stunden') : 'Tage'}</span>
          <span class="w">
            {#if mitVorzeichen}
              <button type="button" class="vz" onclick={() => (vorzeichen = vorzeichen === 1 ? -1 : 1)} aria-label="Vorzeichen wechseln">{vorzeichen === 1 ? '+' : '−'}</button>
            {/if}
            {#if konto === 'zeit'}
              <StundenEingabe id="b-betrag" bind:wert={betrag} />
            {:else}
              <input class="feld zahl" id="b-betrag" inputmode="decimal" placeholder="1" bind:value={betrag} />
            {/if}
          </span>
        </div>
      {/if}

      <label class="zeile"><span class="l">Kommentar</span><input class="feld text" id="b-kommentar" placeholder={art === 'sonderurlaub' ? 'z. B. Jubiläum' : 'optional'} bind:value={kommentar} /></label>
    </div>

    {#if art === 'abgleich' && differenz !== null}
      <section class="kachel" aria-label="Korrekturbuchung">
        <span class="etikett">Korrekturbuchung</span>
        <span class="gross num">{dauer(differenz, true)}</span>
        <span class="unter">Danach stimmen App und Firma am {datumDE(datum)} überein.</span>
      </section>
    {/if}
    {#if art === 'vortrag'}<p class="hinweistext">Der Vortrag zählt ab seinem Datum. Am besten der Tag vor dem Start der App ({datumDE(plusTage(speicher.einstellungen.appStart, -1))}).</p>{/if}
    {#if art === 'abgleich'}<p class="hinweistext">Die App bucht die Differenz. Die Buchung bleibt im Verlauf sichtbar und lässt sich später ändern oder löschen.</p>{/if}

    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <button type="button" class="knopf haupt" onclick={sichern}>{b0 ? 'Sichern' : 'Buchen'}</button>
    {#if b0}<button type="button" class="knopf neben rot" onclick={() => (loeschenFragen = true)}>Buchung löschen</button>{/if}
    <button type="button" class="knopf neben" onclick={schliessen}>Abbrechen</button>
  {/if}
</Blatt>

<style>
  .segmente.klein {
    font-size: 13px;
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
  .zahl {
    width: 96px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .text {
    flex: 1;
    min-width: 0;
    max-width: 60%;
    text-align: right;
    font-weight: 500;
  }
  .vz {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--flaeche);
    color: var(--lemon);
    font-weight: 700;
    font-size: 18px;
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
  .rot {
    color: var(--minus);
  }
  .rot-voll {
    background: var(--minus);
    color: #fff;
  }
</style>
