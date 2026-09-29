<script lang="ts">
  import { aufteilung, urlaubskonto, urlaubszeitraeume, zeitkontoSaldo } from '../core/konten';
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
  const sockelProzent = $derived(Math.max(0, Math.min(100, (teile.sockel / speicher.einstellungen.sockel) * 100)));

  const jahr = $derived(jahrVon(heute));
  const urlaub = $derived(urlaubskonto(speicher.daten, jahr, heute));
  // beantragt, aber noch nicht genehmigt: verringert den Rest, steht noch nicht im Kalender
  const offen = $derived(offeneTage(speicher.daten, jahr));
  const rest = $derived(urlaub.rest - offen);
  let antraegeOffen = $state(false);
  const antraegeJahr = $derived(speicher.antraege.filter((a) => jahrVon(a.von) === jahr));
  const anzahlOffen = $derived(antraegeJahr.filter((a) => !a.genehmigt && !a.gestrichen).length);
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
    <span class="l"><span class="num rest">{zahl(rest)}</span><span class="leise">Tage Rest</span></span>
    <span class="w">{String(urlaub.gesamt).replace('.', ',')} gesamt</span>
  </div>
  <div class="zeile">
    <div class="urlaubsbalken" role="img" aria-label="genommen, geplant und Rest">
      <i style="width:{anteil(urlaub.genommen)}%;background:var(--night)"></i>
      <i style="width:{anteil(urlaub.geplant)}%;background:var(--label3)"></i>
      {#if offen}<i class="schraffur" style="width:{anteil(offen)}%"></i>{/if}
      <i style="flex:1;background:var(--lemon)"></i>
    </div>
  </div>
  <button type="button" class="zeile" onclick={() => (uebersichtOffen = true)}>
    <span class="l leise">{zahl(urlaub.genommen)} genommen · {zahl(urlaub.geplant)} geplant{offen ? ` · ${zahl(offen)} beantragt` : ''}</span><span class="pfeil">›</span>
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
          <span class="l"><span>{z.von === z.bis ? datumDE(z.von) : `${datumDE(z.von).slice(0, 6)} – ${datumDE(z.bis)}`}<small>{z.geplant ? 'geplant' : 'genommen'}</small></span></span>
          <span class="w stark">{zahl(z.tage)} {z.tage === 1 ? 'Tag' : 'Tage'}</span>
        </div>
      {:else}
        <div class="zeile"><span class="l leise">Noch kein Urlaub eingetragen</span></div>
      {/each}
      {#if offen}<div class="zeile"><span class="l"><span>Beantragt<small>noch nicht genehmigt, nicht im Kalender</small></span></span><span class="w stark">{zahl(offen)} Tage</span></div>{/if}
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
    <span class="w">{anzahlOffen ? `${anzahlOffen} offen · ` : ''}{antraegeJahr.length} <span class="pfeil">›</span></span>
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
  .schraffur {
    background: repeating-linear-gradient(135deg, var(--label3) 0 2px, var(--group) 2px 5px);
  }
</style>
