<script lang="ts">
  import { aufteilung, inEuro, nettoSchaetzung, urlaubskonto, zeitkontoSaldo } from '../core/konten';
  import { gueltigAm } from '../core/einstellungen';
  import Journal from './Journal.svelte';
  import { offeneVorgaenge } from '../core/journal';
  import { offeneTage } from '../core/urlaubsantrag';
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
  // Überstunden in Geld: nach einem Tipp 10 Sekunden lang in Euro (brutto)
  let geld = $state(false);
  let geldTimer: ReturnType<typeof setTimeout> | undefined;
  function geldZeigen() {
    clearTimeout(geldTimer);
    geld = !geld;
    if (geld) geldTimer = setTimeout(() => (geld = false), 10_000);
  }
  $effect(() => () => clearTimeout(geldTimer));
  const brutto = $derived(speicher.einstellungen.bruttolohn ?? 0);
  const abzug = $derived(speicher.einstellungen.abzugsquote);
  const wochenMinuten = $derived(gueltigAm(speicher.einstellungen.wochenstunden, heute));
  const euro = (min: number, vorzeichen = true) => {
    const b = inEuro(min, brutto, wochenMinuten);
    return `${b > 0 && vorzeichen ? '+' : b < 0 ? '−' : ''}${Math.abs(b).toLocaleString('de-DE')} €`;
  };
  const sockelProzent =$derived(Math.max(0, Math.min(100, (teile.sockel / speicher.einstellungen.sockel) * 100)));

  const jahr = $derived(jahrVon(heute));
  const urlaub = $derived(urlaubskonto(speicher.daten, jahr, heute));
  // beantragt, aber noch nicht genehmigt: verringert den Rest, steht noch nicht im Kalender
  const offen = $derived(offeneTage(speicher.daten, jahr));
  // geplant: Simulation, zählt aber ebenfalls schon mit
  const plan = $derived(offeneTage(speicher.daten, jahr, 'geplant'));
  const rest = $derived(urlaub.rest - offen - plan);
  // Kurzinfo zu offenen Vorgängen und das Journal „Buchungen und Anträge“
  const offeneV = $derived(offeneVorgaenge(speicher.daten, heute));
  const offenText = $derived(
    [offeneV.beantragt ? `${offeneV.beantragt} Urlaubsantrag offen` : '', offeneV.geplant ? `${offeneV.geplant} geplant` : '', offeneV.auszahlung ? `${dauer(offeneV.auszahlung)} Std. Auszahlung offen` : ''].filter(Boolean).join(' · ')
  );
  let journal = $state<'zeit' | 'urlaub' | null>(null);
  const anteil = (wert: number) => (urlaub.gesamt > 0 ? Math.max(0, (wert / urlaub.gesamt) * 100) : 0);

  const zahl = (t: number) => String(t).replace('.', ',');
</script>

<Titel titel="Konten" unter={`Stand Ende ${datumDE(gestern)}`} {oeffneEinstellungen} />

{#if !speicher.hatDaten}
  <div class="gruppe leer">
    <p><b>Noch keine Daten.</b> Übernimm zuerst die Datensicherung der alten App.</p>
    <button type="button" class="knopf haupt" onclick={oeffneEinstellungen}>Zu den Einstellungen</button>
  </div>
{/if}

<!-- Ein Tipp blättert die Zeiten für 10 Sekunden in Euro (brutto) um -->
<button type="button" class="kachel zeitkonto" aria-label="Zeitkonto, antippen für den Betrag in Euro" onclick={geldZeigen}>
  <span class="etikett">{geld ? 'Auszahlbar in Euro brutto' : 'Zeitkonto'}</span>
  {#key geld}
    <span class="dreh">
      {#if geld}
        <!-- Nur der Teil über dem Sockel, der ausgezahlt werden kann -->
        <span class="gross num">{brutto ? euro(teile.auszahlbar, false) : '– €'}</span>
        <span class="unter">
          {#if !brutto}Bruttolohn in den Einstellungen eintragen
          {:else if abzug !== undefined}netto ≈ <b>{nettoSchaetzung(inEuro(teile.auszahlbar, brutto, wochenMinuten), abzug).toLocaleString('de-DE')} €</b>
          {:else}Abzüge in den Einstellungen eintragen für eine Netto-Schätzung{/if}
        </span>
      {:else}
        <span class="gross num">{dauer(saldoGestern, true)}</span>
        <span class="unter">inkl. heute <b>{dauer(saldoHeute, true)}</b></span>
      {/if}
    </span>
  {/key}
  <div class="balken" role="img" aria-label="Sockel {sockelProzent.toFixed(0)} Prozent gefüllt"><i style="width:{sockelProzent}%"></i></div>
  {#key geld}
    <span class="unter dreh">
      {#if geld && brutto}
        aus <b>{dauer(teile.auszahlbar)}</b> Std. über dem Sockel von {dauer(speicher.einstellungen.sockel)}
      {:else}
        Sockel <b>{dauer(teile.sockel)}</b> / {dauer(speicher.einstellungen.sockel)} · auszahlbar <b>{dauer(teile.auszahlbar)}</b>
      {/if}
    </span>
  {/key}
</button>

<section class="kachel urlaub" aria-label="Urlaub {jahr}">
  <span class="etikett">Urlaub {jahr}</span>
  <div class="kopfzeile">
    <span class="restzahl"><span class="gross num">{zahl(rest)}</span><span>Tage Rest</span></span>
    <span class="gesamt">{zahl(urlaub.gesamt)} gesamt</span>
  </div>
  <!-- Balken in weißer Rinne: genommen, genehmigt, beantragt/geplant (schraffiert); der Rest bleibt weiß -->
  <div class="urlaubsbalken" role="img" aria-label="genommen, genehmigt, beantragt, geplant und Rest">
    {#if urlaub.genommen}<i style="width:{anteil(urlaub.genommen)}%;background:var(--night)"></i>{/if}
    {#if urlaub.geplant}<i style="width:{anteil(urlaub.geplant)}%;background:var(--label2)"></i>{/if}
    {#if offen + plan}<i class="schraffur" style="width:{anteil(offen + plan)}%"></i>{/if}
  </div>
  <button type="button" class="fusszeile" onclick={() => (journal = 'urlaub')}>
    <span>{zahl(urlaub.genommen)} genommen · {zahl(urlaub.geplant)} genehmigt{offen ? ` · ${zahl(offen)} beantragt` : ''}{plan ? ` · ${zahl(plan)} geplant` : ''}</span><span class="pfeil">›</span>
  </button>
</section>

<!-- Alle Buchungen und Vorgänge (Planung, Auszahlung) im Journal -->
<button type="button" class="gruppe journalknopf" onclick={() => (journal = 'zeit')}>
  <span class="l"><b>Buchungen und Anträge</b>{#if offenText}<small>{offenText}</small>{/if}</span>
  <span class="pfeil">›</span>
</button>

{#if journal}
  <Journal {heute} start={journal} schliessen={() => (journal = null)} />
{/if}

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
  /* Zeitkonto: ganze Kachel ist ein Knopf, Tipp blättert in Euro um */
  .zeitkonto {
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    border: none;
    cursor: pointer;
  }
  .dreh {
    display: flex;
    flex-direction: column;
    gap: 10px;
    transform-origin: 50% 50%;
    animation: blaettern 0.45s ease;
  }
  span.unter.dreh {
    display: block;
  }
  @keyframes blaettern {
    from {
      transform: perspective(400px) rotateX(-90deg);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  /* Urlaubskachel in Lemon mit dunkler Schrift (Entwurf „Vorschlag B“) */
  .kachel.urlaub {
    background: var(--lemon);
    color: var(--night);
  }
  .urlaub .etikett {
    color: rgba(16, 19, 26, 0.62);
  }
  .kopfzeile {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .restzahl {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-weight: 500;
  }
  .urlaub .gross {
    color: var(--night);
  }
  .gesamt {
    color: rgba(16, 19, 26, 0.62);
  }
  .urlaubsbalken {
    display: flex;
    gap: 2px;
    height: 12px;
    box-sizing: border-box;
    padding: 2px;
    border-radius: 99px;
    overflow: hidden;
    background: #fff;
    box-shadow: inset 0 0 0 1px rgba(16, 19, 26, 0.1);
  }
  .urlaubsbalken i {
    display: block;
    height: 100%;
  }
  .urlaubsbalken i:first-child {
    border-radius: 99px 0 0 99px;
  }
  .fusszeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(16, 19, 26, 0.14);
    font-size: 15px;
    color: var(--night);
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .fusszeile .pfeil {
    color: rgba(16, 19, 26, 0.55);
  }
  .pfeil {
    display: inline-block;
  }
  .journalknopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    width: 100%;
    text-align: left;
    color: var(--label);
  }
  .journalknopf .l {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .journalknopf small {
    color: var(--label2);
    font-size: 13px;
  }
  .schraffur {
    background: repeating-linear-gradient(135deg, var(--label2) 0 2px, #fff 2px 5px);
  }
</style>
