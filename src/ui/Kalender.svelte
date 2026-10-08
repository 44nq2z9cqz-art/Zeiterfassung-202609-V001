<script lang="ts">
  import { untrack } from 'svelte';
  import { tagesreihe } from '../core/konten';
  import { urlaubstagWert } from '../core/regeln';
  import { MONATE, WOCHENTAGE_KURZ, type Datum, datumAus, datumDE, dauer, plusTage, tageVonBis, uhrzeit, wochentag, zerlege } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import TagBearbeiten from './TagBearbeiten.svelte';
  import Titel from './Titel.svelte';
  import Zeitraum from './Zeitraum.svelte';

  let { heute, oeffneEinstellungen }: { heute: Datum; oeffneEinstellungen: () => void } = $props();

  // Startmonat ist der aktuelle Monat, danach wird frei geblättert
  const [hj, hm] = zerlege(untrack(() => heute));
  let jahr = $state(hj);
  let monat = $state(hm); // 1–12
  let gewaehlt = $state<Datum>(untrack(() => heute));
  let ansicht = $state<'monat' | 'liste'>('monat');
  let bearbeiten = $state<Datum | null>(null);
  let zeitraumOffen = $state(false);

  const erster = $derived(datumAus(jahr, monat, 1));
  const letzter = $derived(plusTage(datumAus(monat === 12 ? jahr + 1 : jahr, monat === 12 ? 1 : monat + 1, 1), -1));
  const reihe = $derived(tagesreihe(speicher.daten, erster, letzter, heute));
  const zeilen = $derived(reihe.zeilen);
  const leerFelder = $derived((wochentag(erster) + 6) % 7);

  const summe = $derived.by(() => {
    let ist = 0, soll = 0, zuschlag = 0, zuschlagTage = 0, urlaub = 0;
    for (const z of zeilen) {
      if (z.datum > heute) continue;
      ist += z.ist ?? 0;
      if (z.status !== 'urlaub' && z.status !== 'krank' && z.status !== 'offen') soll += z.soll;
      if (z.zuschlag) { zuschlag += z.zuschlag; zuschlagTage++; }
      urlaub += z.urlaubstage;
    }
    return { ist, soll, zuschlag, zuschlagTage, urlaub, saldo: reihe.saldoNachher - reihe.saldoVorher };
  });

  function blaettern(richtung: number) {
    let m = monat + richtung;
    let j = jahr;
    if (m < 1) { m = 12; j--; }
    if (m > 12) { m = 1; j++; }
    monat = m;
    jahr = j;
    // Die Auswahl wandert mit, damit z. B. „Zeitraum eintragen“ im sichtbaren Monat beginnt
    const [hj2, hm2] = zerlege(heute);
    gewaehlt = j === hj2 && m === hm2 ? heute : datumAus(j, m, 1);
  }
  function zuHeute() {
    [jahr, monat] = zerlege(heute);
    gewaehlt = heute;
  }

  // Geplanter und beantragter Urlaub (noch nicht genehmigt) erscheint im Kalender erkennbar anders
  const planTage = $derived.by(() => {
    const m = new Map<Datum, { status: 'geplant' | 'beantragt'; von: Datum; bis: Datum }>();
    for (const a of speicher.antraege) {
      if (a.genehmigt || a.gestrichen) continue;
      for (const d of tageVonBis(a.von, a.bis)) if (urlaubstagWert(d) > 0) m.set(d, { status: a.plan ? 'geplant' : 'beantragt', von: a.von, bis: a.bis });
    }
    return m;
  });
  const planGewaehlt = $derived(planTage.get(gewaehlt));

  const zeile = $derived(zeilen.find((z) => z.datum === gewaehlt));
  const tag = $derived(speicher.tage.get(gewaehlt));

  function kurztext(z: (typeof zeilen)[number]): { text: string; klasse: string } {
    // Feiertag ohne Arbeit: „Feiertag“ statt leer (an Feiertagen mit Arbeit zählt der Saldo)
    if (z.feiertag && z.status !== 'arbeit') return { text: 'Feiertag', klasse: 'art' };
    switch (z.status) {
      case 'urlaub': return { text: z.urlaubstage ? 'Urlaub' : '', klasse: 'art' };
      case 'krank': return { text: 'Krank', klasse: 'art' };
      case 'gleittag': return { text: 'Gleittag', klasse: 'art' };
      case 'ohneEintrag':
      case 'unvollstaendig': return { text: dauer(z.saldo, true), klasse: 'minus' };
      case 'arbeit': return { text: dauer(z.saldo, true), klasse: z.saldo < 0 ? 'minus' : z.saldo > 0 ? 'plus' : 'leise' };
      default: return { text: '', klasse: '' };
    }
  }

  const STATUS: Record<string, string> = {
    arbeit: 'Arbeitstag', urlaub: 'Urlaub', krank: 'Krank', gleittag: 'Gleittag', ohneEintrag: 'Ohne Eintrag',
    unvollstaendig: 'Unvollständig – Gehen fehlt', offen: 'Läuft', frei: 'Frei', zukunft: 'Noch nicht erfasst'
  };
  const arbeitsTage = $derived(zeilen.filter((z) => z.status !== 'frei' && z.status !== 'zukunft' && !(z.status === 'urlaub' && !z.urlaubstage)).slice().reverse());
</script>

<Titel titel={MONATE[monat - 1]} unter={String(jahr)} {oeffneEinstellungen} />

<div class="steuerung">
  <button type="button" class="rund" aria-label="Voriger Monat" onclick={() => blaettern(-1)}>‹</button>
  <div class="segmente">
    <button type="button" aria-pressed={ansicht === 'monat'} onclick={() => (ansicht = 'monat')}>Monat</button>
    <button type="button" aria-pressed={ansicht === 'liste'} onclick={() => (ansicht = 'liste')}>Liste</button>
  </div>
  <button type="button" class="rund" aria-label="Nächster Monat" onclick={() => blaettern(1)}>›</button>
  <button type="button" class="heute-knopf" onclick={zuHeute}>Heute</button>
</div>

{#if ansicht === 'monat'}
  <div class="kal gruppe" role="grid" aria-label="{MONATE[monat - 1]} {jahr}">
    {#each ['M', 'D', 'M', 'D', 'F', 'S', 'S'] as w, i (i)}<div class="wt" aria-hidden="true">{w}</div>{/each}
    {#each Array(leerFelder) as _, i (i)}<div></div>{/each}
    {#each zeilen as z (z.datum)}
      {@const k = kurztext(z)}
      {@const wt = wochentag(z.datum)}
      {@const p = z.status !== 'urlaub' ? planTage.get(z.datum) : undefined}
      <button
        type="button"
        class="tag"
        class:we={wt === 0 || wt === 6 || !!z.feiertag}
        class:gewaehlt={z.datum === gewaehlt}
        class:heute={z.datum === heute}
        class:zukunft={z.datum > heute}
        class:geplant={p?.status === 'geplant'}
        class:beantragt={p?.status === 'beantragt'}
        aria-label="{datumDE(z.datum)}, {STATUS[z.status]}{k.text ? ', ' + k.text : ''}"
        onclick={() => (gewaehlt === z.datum ? (bearbeiten = z.datum) : (gewaehlt = z.datum))}
      >
        <b>{zerlege(z.datum)[2]}</b>
        <em class={p && !k.text ? 'art' : k.klasse}>{p && !k.text ? p.status : k.text}</em>
        {#if z.zuschlag > 0}<span class="plakette mini">!</span>{/if}
        {#if z.status === 'ohneEintrag' || z.status === 'unvollstaendig'}<span class="punkt"></span>{/if}
      </button>
    {/each}
  </div>
  <div class="legende">
    <span><span class="plakette mini statisch">!</span> Pausenzeitverletzung</span>
    <span><span class="punkt statisch"></span> Ohne Eintrag</span>
    <span><span class="muster geplant"></span> geplant</span>
    <span><span class="muster beantragt"></span> beantragt</span>
  </div>

  {#if zeile}
    <section class="gruppe">
      <button type="button" class="zeile" onclick={() => (bearbeiten = gewaehlt)}>
        <span class="l"><span><b>{WOCHENTAGE_KURZ[wochentag(gewaehlt)]}, {datumDE(gewaehlt)}</b><small>{zeile.feiertag ?? STATUS[zeile.status]}{tag?.arbeitsort && tag.arbeitsort !== 'buero' ? ` · ${tag.arbeitsort === 'homeoffice' ? 'Homeoffice' : 'Außer Haus'}` : ''}</small></span></span>
        <span class="w stark">{zeile.status === 'arbeit' || zeile.saldo ? dauer(zeile.saldo, true) : ''} <span class="pfeil">›</span></span>
      </button>
      {#if tag?.kommen !== null && tag?.kommen !== undefined}
        <div class="zeile">
          <span class="l">{uhrzeit(tag.kommen)} – {tag.gehen !== null ? uhrzeit(tag.gehen) : '…'} · {tag.pausen.length} {tag.pausen.length === 1 ? 'Pause' : 'Pausen'}</span>
          <span class="w">{zeile.ist !== null ? `Ist ${dauer(zeile.ist)}` : ''}</span>
        </div>
      {/if}
      {#if planGewaehlt && zeile.status !== 'urlaub'}
        <div class="zeile"><span class="l"><span>Urlaub {planGewaehlt.status}<small>{datumDE(planGewaehlt.von).slice(0, 6)} – {datumDE(planGewaehlt.bis)} · weiter unter Konten → Buchungen und Anträge</small></span></span></div>
      {/if}
      {#if zeile.zuschlag > 0}
        <div class="zeile"><span class="l"><span class="plakette">!</span>Pausenzeitverletzung</span><span class="w stark">{dauer(-zeile.zuschlag, true)}</span></div>
      {/if}
      {#if tag?.kommentar}<div class="zeile"><span class="l leise">{tag.kommentar}</span></div>{/if}
    </section>
  {/if}
{:else}
  <section class="gruppe">
    {#each arbeitsTage as z (z.datum)}
      {@const t = speicher.tage.get(z.datum)}
      <button type="button" class="zeile" onclick={() => (bearbeiten = z.datum)}>
        <span class="l">
          <span>{WOCHENTAGE_KURZ[wochentag(z.datum)]}, {datumDE(z.datum).slice(0, 6)}
            <small>{t?.kommen !== null && t?.kommen !== undefined ? `${uhrzeit(t.kommen)} – ${t.gehen !== null ? uhrzeit(t.gehen) : '…'}` : STATUS[z.status]}</small>
          </span>
          {#if z.zuschlag > 0}<span class="plakette">!</span>{/if}
        </span>
        <span class="w stark {kurztext(z).klasse}">{z.status === 'urlaub' || z.status === 'krank' ? STATUS[z.status] : dauer(z.saldo, true)} <span class="pfeil">›</span></span>
      </button>
    {:else}
      <div class="zeile"><span class="l leise">Keine Einträge in diesem Monat</span></div>
    {/each}
  </section>
{/if}

<h2 class="abschnitt">{MONATE[monat - 1]} gesamt</h2>
<section class="gruppe">
  <div class="zeile"><span class="l">Ist</span><span class="w">{dauer(summe.ist)}</span></div>
  <div class="zeile"><span class="l">Soll</span><span class="w">{dauer(summe.soll)}</span></div>
  {#if summe.zuschlag}<div class="zeile"><span class="l"><span class="plakette">!</span>Zuschläge ({summe.zuschlagTage} {summe.zuschlagTage === 1 ? 'Tag' : 'Tage'})</span><span class="w">{dauer(-summe.zuschlag, true)}</span></div>{/if}
  <div class="zeile"><span class="l"><b>Saldo Monat</b></span><span class="w stark" class:plus={summe.saldo > 0} class:minus={summe.saldo < 0}>{dauer(summe.saldo, true)}</span></div>
  {#if summe.urlaub}<div class="zeile"><span class="l">Urlaubstage</span><span class="w">{String(summe.urlaub).replace('.', ',')}</span></div>{/if}
</section>

<section class="gruppe">
  <button type="button" class="zeile aktion" onclick={() => (zeitraumOffen = true)}>
    <span class="l">Urlaub oder Krankheit für Zeitraum eintragen</span><span class="pfeil">›</span>
  </button>
</section>

{#if bearbeiten}
  <TagBearbeiten datum={bearbeiten} {heute} schliessen={() => (bearbeiten = null)} />
{/if}
{#if zeitraumOffen}
  <Zeitraum schliessen={() => (zeitraumOffen = false)} vorschlag={gewaehlt} />
{/if}

<style>
  .steuerung {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 8px;
    align-items: center;
    margin-top: -6px;
  }
  .rund {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--group);
    font-size: 22px;
    line-height: 1;
    box-shadow: 0 1px 3px rgba(16, 19, 26, 0.12);
  }
  .heute-knopf {
    font-weight: 600;
    padding: 0 6px;
  }
  .kal {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: 4px;
    padding: 10px 4px;
  }
  .wt {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--label3);
    padding-bottom: 2px;
  }
  .tag {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 2px 0 3px;
    border-radius: 10px;
    font-variant-numeric: tabular-nums;
  }
  .tag b {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 500;
  }
  .tag em {
    font-style: normal;
    font-size: 10px;
    font-weight: 600;
    height: 12px;
    line-height: 12px;
    white-space: nowrap;
  }
  .tag em.art {
    color: var(--label2);
  }
  .tag.we b {
    color: var(--label3);
  }
  .tag.zukunft em.art {
    color: var(--label3);
  }
  .tag.heute b {
    box-shadow: inset 0 0 0 2px var(--label);
  }
  .tag.gewaehlt b {
    background: var(--flaeche);
    color: var(--lemon);
    font-weight: 700;
  }
  .plakette.mini {
    position: absolute;
    top: 0;
    right: 3px;
    width: 14px;
    height: 14px;
    font-size: 9px;
    box-shadow: 0 0 0 1.5px var(--group);
  }
  .plakette.mini.statisch {
    position: static;
    box-shadow: none;
  }
  .punkt {
    position: absolute;
    top: 3px;
    right: 6px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--minus);
  }
  .punkt.statisch {
    position: static;
    display: inline-block;
  }
  /* Urlaub geplant: gestrichelter Rahmen, beantragt: schraffiert */
  .tag.geplant {
    outline: 1.5px dashed var(--label3);
    outline-offset: -2px;
  }
  .tag.beantragt {
    background: repeating-linear-gradient(135deg, var(--fill) 0 3px, transparent 3px 7px);
  }
  .muster {
    width: 14px;
    height: 14px;
    border-radius: 4px;
  }
  .muster.geplant {
    outline: 1.5px dashed var(--label3);
    outline-offset: -1.5px;
  }
  .muster.beantragt {
    background: repeating-linear-gradient(135deg, var(--label3) 0 2px, transparent 2px 5px);
  }
  .legende {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--label2);
    padding: 0 6px;
    margin-top: -8px;
  }
  .legende > span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
