<script lang="ts">
  import { aufteilung, urlaubskonto, zeitkontoSaldo } from '../core/konten';
  import type { Buchung } from '../core/modell';
  import { laufenderTag, liveStand } from '../core/stempeln';
  import { type Datum, datumDE, dauer, jahrVon, plusTage } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Titel from './Titel.svelte';

  let { heute, oeffneEinstellungen }: { heute: Datum; oeffneEinstellungen: () => void } = $props();

  let jetzt = $state(new Date());
  $effect(() => {
    const takt = setInterval(() => (jetzt = new Date()), 30_000);
    return () => clearInterval(takt);
  });

  const gestern = $derived(plusTage(heute, -1));
  const saldoGestern = $derived(zeitkontoSaldo(speicher.daten, gestern, heute));
  // „inkl. heute“ läuft live mit, solange heute gestempelt wird (Konzept B3)
  const saldoHeute = $derived.by(() => {
    const lauf = laufenderTag(speicher.tage, jetzt);
    const tag = speicher.tage.get(heute);
    // Nur solange der Tag offen ist; ein abgeschlossener Tag steckt schon in zeitkontoSaldo(heute)
    const live = lauf.datum === heute && tag?.gehen === null ? liveStand(heute, tag, speicher.einstellungen, lauf.minute) : null;
    return live ? saldoGestern + live.saldo + zeitkontoSaldo(speicher.daten, heute, heute) - zeitkontoSaldo(speicher.daten, gestern, heute) : zeitkontoSaldo(speicher.daten, heute, heute);
  });
  const teile = $derived(aufteilung(saldoGestern, speicher.einstellungen.sockel));
  const sockelProzent = $derived(Math.max(0, Math.min(100, (teile.sockel / speicher.einstellungen.sockel) * 100)));

  const jahr = $derived(jahrVon(heute));
  const urlaub = $derived(urlaubskonto(speicher.daten, jahr, heute));
  const anteil = (wert: number) => (urlaub.gesamt > 0 ? Math.max(0, (wert / urlaub.gesamt) * 100) : 0);

  let buchungenOffen = $state(false);
  let kontoAnsicht = $state<'zeit' | 'urlaub'>('zeit');
  const liste = $derived(
    speicher.buchungen.filter((b) => b.konto === kontoAnsicht).sort((a, b) => b.datum.localeCompare(a.datum))
  );

  const ARTEN: Record<Buchung['art'], string> = {
    vortrag: 'Vortrag',
    abgleich: 'Abgleich Firmensystem',
    auszahlung: 'Auszahlung',
    korrektur: 'Korrektur',
    resturlaub: 'Resturlaub Vorjahre',
    sonderurlaub: 'Sonderurlaub'
  };
  const tageText = (t: number) => `${t > 0 ? '+' : ''}${String(t).replace('.', ',')} T`;
</script>

<Titel titel="Konten" unter={`Stand Ende ${datumDE(gestern)}`} {oeffneEinstellungen} />

{#if !speicher.hatDaten}
  <div class="gruppe leer">
    <p><b>Noch keine Daten.</b> Übernimm zuerst die Datensicherung der alten App.</p>
    <button type="button" class="knopf haupt" onclick={oeffneEinstellungen}>Zu den Einstellungen</button>
  </div>
{/if}

<section class="kachel" aria-label="Zeitkonto">
  <span class="etikett">Zeitkonto</span>
  <span class="gross num">{dauer(saldoGestern, true)}</span>
  <span class="unter">inkl. heute <b>{dauer(saldoHeute, true)}</b></span>
  <div class="balken" role="img" aria-label="Sockel {sockelProzent.toFixed(0)} Prozent gefüllt"><i style="width:{sockelProzent}%"></i></div>
  <span class="unter">Sockel <b>{dauer(teile.sockel)}</b> / {dauer(speicher.einstellungen.sockel)} · auszahlbar <b>{dauer(teile.auszahlbar)}</b></span>
</section>

<section class="gruppe" aria-label="Urlaub {jahr}">
  <div class="zeile"><span class="etikett-hell">Urlaub {jahr}</span></div>
  <div class="zeile oben">
    <span class="l"><span class="num rest">{String(urlaub.rest).replace('.', ',')}</span><span class="leise">Tage Rest</span></span>
    <span class="w">{String(urlaub.gesamt).replace('.', ',')} gesamt</span>
  </div>
  <div class="zeile">
    <div class="urlaubsbalken" role="img" aria-label="genommen, geplant und Rest">
      <i style="width:{anteil(urlaub.genommen)}%;background:var(--night)"></i>
      <i style="width:{anteil(urlaub.geplant)}%;background:var(--label3)"></i>
      <i style="flex:1;background:var(--lemon)"></i>
    </div>
  </div>
  <div class="zeile"><span class="l leise">{String(urlaub.genommen).replace('.', ',')} genommen · {String(urlaub.geplant).replace('.', ',')} geplant</span></div>
</section>

<section class="gruppe" aria-label="Buchungen">
  <button type="button" class="zeile" aria-expanded={buchungenOffen} onclick={() => (buchungenOffen = !buchungenOffen)}>
    <span class="l"><b>Buchungen</b></span>
    <span class="w">{speicher.buchungen.length} <span class="pfeil" style="transform:rotate({buchungenOffen ? -90 : 90}deg)">›</span></span>
  </button>
  {#if buchungenOffen}
    <div class="zeile">
      <div class="segmente" style="flex:1">
        <button type="button" aria-pressed={kontoAnsicht === 'zeit'} onclick={() => (kontoAnsicht = 'zeit')}>Zeitkonto</button>
        <button type="button" aria-pressed={kontoAnsicht === 'urlaub'} onclick={() => (kontoAnsicht = 'urlaub')}>Urlaub</button>
      </div>
    </div>
    {#each liste as b (b.id)}
      <div class="zeile">
        <span class="l"><span>{ARTEN[b.art]}<small>{datumDE(b.datum)}{b.kommentar ? ` · ${b.kommentar}` : ''}</small></span></span>
        <span class="w stark">{b.konto === 'zeit' ? dauer(b.betrag, true) : tageText(b.betrag)}</span>
      </div>
    {:else}
      <div class="zeile"><span class="l leise">Noch keine Buchungen</span></div>
    {/each}
    {#if kontoAnsicht === 'urlaub' && urlaub.jahresanspruch > 0}
      <div class="zeile">
        <span class="l"><span>Jahresanspruch {jahr}<small>01.01.{jahr} · automatisch</small></span></span>
        <span class="w stark">{tageText(urlaub.jahresanspruch)}</span>
      </div>
    {/if}
    <div class="zeile"><span class="l leise">Buchungen erfassen folgt mit Meilenstein M4.</span></div>
  {/if}
</section>

<style>
  .leer {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .leer p {
    margin: 0;
    line-height: 1.45;
  }
  .etikett-hell {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--label2);
  }
  .zeile.oben {
    padding-top: 0;
  }
  .zeile.oben::before {
    display: none;
  }
  .rest {
    font-size: 36px;
  }
  .urlaubsbalken {
    flex: 1;
    display: flex;
    gap: 2px;
    height: 7px;
    border-radius: 99px;
    overflow: hidden;
    background: var(--fill);
  }
  .urlaubsbalken i {
    display: block;
    height: 100%;
  }
  .pfeil {
    display: inline-block;
  }
</style>
