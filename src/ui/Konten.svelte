<script lang="ts">
  import { aufteilung, inEuro, nettoSchaetzung, urlaubskonto, urlaubszeitraeume, zeitkontoSaldo } from '../core/konten';
  import { gueltigAm } from '../core/einstellungen';
  import type { Buchung, Buchungsart, Konto } from '../core/modell';
  import BuchungBlatt from './BuchungBlatt.svelte';
  import UrlaubsantragSeite from './UrlaubsantragSeite.svelte';
  import { offeneTage } from '../core/urlaubsantrag';
  import { laufenderTag, liveStand } from '../core/stempeln';
  import { type Datum, datumDE, dauer, jahrVon, plusTage } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';
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
  let antraegeOffen = $state(false);
  const antraegeJahr = $derived(speicher.antraege.filter((a) => jahrVon(a.von) === jahr));
  const anzahlOffen = $derived(antraegeJahr.filter((a) => !a.genehmigt && !a.gestrichen && !a.plan).length);
  const anzahlPlan = $derived(antraegeJahr.filter((a) => !a.genehmigt && !a.gestrichen && a.plan).length);
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
  let bearbeiten = $state<{ konto: Konto; art: Buchungsart; vorhanden?: Buchung } | null>(null);
  const NEU_ZEIT: [Buchungsart, string][] = [
    ['vortrag', 'Vortrag erfassen'],
    ['abgleich', 'Abgleich mit Firmensystem'],
    ['auszahlung', 'Auszahlung'],
    ['korrektur', 'Korrektur']
  ];
  const NEU_URLAUB: [Buchungsart, string][] = [
    ['resturlaub', 'Resturlaub Vorjahre'],
    ['sonderurlaub', 'Sonderurlaub'],
    ['korrektur', 'Korrektur']
  ];
  let uebersichtOffen = $state(false);
  const zeitraeume = $derived(urlaubszeitraeume(speicher.daten, jahr, heute));
  const zahl = (t: number) => String(t).replace('.', ',');
  const tageText = (t: number) => `${t > 0 ? '+' : ''}${String(t).replace('.', ',')} T`;
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
  <button type="button" class="fusszeile" onclick={() => (uebersichtOffen = true)}>
    <span>{zahl(urlaub.genommen)} genommen · {zahl(urlaub.geplant)} genehmigt{offen ? ` · ${zahl(offen)} beantragt` : ''}{plan ? ` · ${zahl(plan)} geplant` : ''}</span><span class="pfeil">›</span>
  </button>
</section>

{#if uebersichtOffen}
  <Blatt titel="Urlaub {jahr}" schliessen={() => (uebersichtOffen = false)}>
    <div class="gruppe">
      {#if urlaub.uebertrag}<div class="zeile"><span class="l">Übertrag aus {jahr - 1}</span><span class="w">{zahl(urlaub.uebertrag)}</span></div>{/if}
      <div class="zeile"><span class="l">Jahresanspruch</span><span class="w">{zahl(urlaub.jahresanspruch)}</span></div>
      {#if urlaub.buchungen}<div class="zeile"><span class="l">Buchungen (Resturlaub, Sonderurlaub)</span><span class="w">{urlaub.buchungen > 0 ? '+' : ''}{zahl(urlaub.buchungen)}</span></div>{/if}
      <div class="zeile"><span class="l"><b>Anspruch gesamt</b></span><span class="w stark">{zahl(urlaub.gesamt)}</span></div>
    </div>
    <h2 class="abschnitt">Urlaubstage</h2>
    <div class="gruppe">
      {#each zeitraeume as z (z.von)}
        <div class="zeile">
          <span class="l"><span>{z.von === z.bis ? datumDE(z.von) : `${datumDE(z.von).slice(0, 6)} – ${datumDE(z.bis)}`}<small>{z.geplant ? 'genehmigt' : 'genommen'}</small></span></span>
          <span class="w stark">{zahl(z.tage)} {z.tage === 1 ? 'Tag' : 'Tage'}</span>
        </div>
      {:else}
        <div class="zeile"><span class="l leise">Noch kein Urlaub eingetragen</span></div>
      {/each}
      {#if offen}<div class="zeile"><span class="l"><span>Beantragt<small>noch nicht genehmigt, nicht im Kalender</small></span></span><span class="w stark">{zahl(offen)} Tage</span></div>{/if}
      {#if plan}<div class="zeile"><span class="l"><span>Geplant<small>noch nicht beantragt, nicht im Kalender</small></span></span><span class="w stark">{zahl(plan)} Tage</span></div>{/if}
      <div class="zeile"><span class="l"><b>Rest</b></span><span class="w stark">{zahl(rest)}</span></div>
    </div>
    <p class="hinweistext">Ein falscher Eintrag lässt sich im Kalender korrigieren: Tag öffnen und die Tagesart ändern, oder „Zeitraum“ → „Entfernen“.</p>
  </Blatt>
{/if}

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
      <button type="button" class="zeile" onclick={() => (bearbeiten = { konto: b.konto, art: b.art, vorhanden: b })}>
        <span class="l">
          <span>{ARTEN[b.art]}
            <small>{datumDE(b.datum)}{b.abgleich ? ` · Firma ${dauer(b.abgleich.firma, true)}, App ${dauer(b.abgleich.app, true)}` : ''}{b.kommentar ? ` · ${b.kommentar}` : ''}</small>
          </span>
        </span>
        <span class="w stark">{b.konto === 'zeit' ? dauer(b.betrag, true) : tageText(b.betrag)} <span class="pfeil">›</span></span>
      </button>
    {:else}
      <div class="zeile"><span class="l leise">Noch keine Buchungen</span></div>
    {/each}
    {#if kontoAnsicht === 'urlaub' && urlaub.jahresanspruch > 0}
      <div class="zeile">
        <span class="l"><span>Jahresanspruch {jahr}<small>01.01.{jahr} · automatisch</small></span></span>
        <span class="w stark">{tageText(urlaub.jahresanspruch)}</span>
      </div>
    {/if}
    {#each kontoAnsicht === 'zeit' ? NEU_ZEIT : NEU_URLAUB as [art, text] (art)}
      <button type="button" class="zeile aktion" onclick={() => (bearbeiten = { konto: kontoAnsicht, art })}>
        <span class="l">+ {text}</span><span class="pfeil">›</span>
      </button>
    {/each}
  {/if}
</section>

<section class="gruppe" aria-label="Urlaubsantrag">
  <button type="button" class="zeile" onclick={() => (antraegeOffen = true)}>
    <span class="l"><b>Urlaubsantrag</b></span>
    <span class="w">{anzahlPlan ? `${anzahlPlan} geplant · ` : ''}{anzahlOffen ? `${anzahlOffen} offen · ` : ''}{antraegeJahr.length} <span class="pfeil">›</span></span>
  </button>
</section>

{#if antraegeOffen}
  <UrlaubsantragSeite {jahr} {heute} schliessen={() => (antraegeOffen = false)} />
{/if}

{#if bearbeiten}
  <BuchungBlatt konto={bearbeiten.konto} art={bearbeiten.art} vorhanden={bearbeiten.vorhanden} {heute} schliessen={() => (bearbeiten = null)} />
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
  .schraffur {
    background: repeating-linear-gradient(135deg, var(--label2) 0 2px, #fff 2px 5px);
  }
</style>
