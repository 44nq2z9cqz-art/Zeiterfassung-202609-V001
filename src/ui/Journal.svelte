<script lang="ts">
  // „Buchungen und Anträge“: Journal je Konto wie ein Kontoauszug, mit Vorgängen (Planung, Auszahlung),
  // die über „Weiterführen“ Schritt für Schritt abgeschlossen werden. Eigene Farbwelt (Papier/Orange).
  import { untrack } from 'svelte';
  import { ART_NAMEN } from '../core/buchungen';
  import { aufteilung } from '../core/konten';
  import { type Journaleintrag, auszahlungOffen, journalUrlaub, journalZeit, planOffen } from '../core/journal';
  import { monatText } from '../core/auszahlung';
  import type { Buchung, Buchungsart, Urlaubsantrag } from '../core/modell';
  import { type Datum, datumDE, dauer, jahrVon } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import AntragBlatt from './AntragBlatt.svelte';
  import AuszahlungNeu from './AuszahlungNeu.svelte';
  import BuchungBlatt from './BuchungBlatt.svelte';
  import VorgangAuszahlung from './VorgangAuszahlung.svelte';
  import VorgangUrlaub from './VorgangUrlaub.svelte';

  let { heute, start = 'zeit', schliessen }: { heute: Datum; start?: 'zeit' | 'urlaub'; schliessen: () => void } = $props();

  let konto = $state<'zeit' | 'urlaub'>(untrack(() => start));
  let jahr = $state(jahrVon(untrack(() => heute)));
  let filter = $state<'alle' | 'offen'>('alle');
  let aufgeklappt = $state<string | null>(null);

  // Blätter
  let buchung = $state<{ art: Buchungsart; vorhanden?: Buchung } | null>(null);
  let neuAuszahlung = $state(false);
  let neuPlan = $state(false);
  let planBearbeiten = $state<Urlaubsantrag | null>(null);
  let vorgangAuszahlung = $state<string | null>(null);
  let vorgangPlan = $state<string | null>(null);
  let meldung = $state<string | null>(null);

  const zeit = $derived(journalZeit(speicher.daten, jahr, heute));
  const urlaub = $derived(journalUrlaub(speicher.daten, jahr, heute));
  const monate = $derived(konto === 'zeit' ? zeit.monate : urlaub.monate);

  const istOffen = (e: Journaleintrag) => (e.art === 'auszahlung' && auszahlungOffen(e.status)) || (e.art === 'plan' && planOffen(e.status));
  const sichtbar = $derived(
    monate.map((m) => ({ ...m, eintraege: filter === 'offen' ? m.eintraege.filter(istOffen) : m.eintraege })).filter((m) => m.eintraege.length)
  );
  const anzahlOffen = $derived(monate.reduce((s, m) => s + m.eintraege.filter(istOffen).length, 0));
  const auszahlbar = $derived(aufteilung(zeit.saldo, speicher.einstellungen.sockel).auszahlbar);

  const tage = (n: number, vz = true) => `${vz && n > 0 ? '+' : n < 0 ? '−' : ''}${String(Math.abs(n)).replace('.', ',')}`;
  const betrag = (e: { betrag: number }) => (konto === 'zeit' ? dauer(e.betrag, true) : tage(e.betrag));
  const stand = (n: number) => (konto === 'zeit' ? dauer(n, true) : String(n).replace('.', ','));
  const kurz = (d: Datum) => datumDE(d).slice(0, 6);
  const zeitraum = (von: Datum, bis: Datum) => (von === bis ? datumDE(von) : `${kurz(von)} – ${datumDE(bis)}`);
  const ARTNAME = (b: Buchung) => (b.art === 'abgleich' ? 'Abgleich TiMaS' : ART_NAMEN[b.art]);
  const buchungstext = (b: Buchung) =>
    b.art === 'abgleich' && b.abgleich ? `TiMaS ${dauer(b.abgleich.firma, true)}, App ${dauer(b.abgleich.app, true)}${b.kommentar ? ` · ${b.kommentar}` : ''}` : (b.kommentar ?? '');

  const PLAN_SCHRITTE = ['geplant', 'beantragt', 'genehmigt', 'genommen'] as const;
  const AUSZ_SCHRITTE = ['beantragt', 'genehmigt', 'teilweise', 'ausgezahlt'] as const;
  const AUSZ_NAME: Record<string, string> = { beantragt: 'Beantragt', genehmigt: 'Genehmigt', teilweise: 'Teilzahlung', ausgezahlt: 'Ausgezahlt' };
  const PLAN_NAME: Record<string, string> = { geplant: 'Geplant', beantragt: 'Beantragt', genehmigt: 'Genehmigt', genommen: 'Genommen', gestrichen: 'Gestrichen' };
  /** Statusleiste: erledigt dunkel, aktuell orange, offen grau */
  const schritte = (liste: readonly string[], status: string) => {
    const i = liste.indexOf(status);
    return liste.map((s, n) => ({ s, klasse: n < i || (n === i && n === liste.length - 1) ? 'fertig' : n === i ? 'jetzt' : 'kommt' }));
  };

  async function urlaubsschein() {
    try {
      const { pdfUrlaubsantrag } = await import('../lib/pdf');
      const r = await teileDatei(pdfUrlaubsantrag(speicher.daten, jahr, heute), `urlaubsantrag-${jahr}-${heute}.pdf`);
      meldung = r === 'abgebrochen' ? null : 'Urlaubsschein erstellt';
    } catch (e) {
      meldung = `Das PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    }
  }

  async function urlaubsscheinFuer(a: Urlaubsantrag) {
    const { pdfUrlaubsantrag } = await import('../lib/pdf');
    await teileDatei(pdfUrlaubsantrag(speicher.daten, jahrVon(a.von), heute, a.id), `urlaubsantrag-${jahrVon(a.von)}-${heute}.pdf`);
  }

  /** „+“: bei Buchungstypen das Buchungsblatt, bei Vorgängen das passende Formular */
  function neu() {
    buchung = { art: konto === 'zeit' ? 'vortrag' : 'sonderurlaub' };
  }
  function vorgangWaehlen(typ: 'auszahlung' | 'planung') {
    buchung = null;
    if (typ === 'auszahlung') neuAuszahlung = true;
    else neuPlan = true;
  }
</script>

<div class="journal papier" role="dialog" aria-modal="true" aria-label="Buchungen und Anträge">
  <div class="inhalt">
    <div class="leiste">
      <button type="button" class="zurueck" onclick={schliessen}>‹ Konten</button>
      <span class="jahr">
        <button type="button" aria-label="Voriges Jahr" onclick={() => jahr--}>‹</button>
        <b>{jahr}</b>
        <button type="button" aria-label="Nächstes Jahr" onclick={() => jahr++}>›</button>
      </span>
    </div>
    <h1>Buchungen &amp; Anträge</h1>

    <div class="reiter" role="tablist">
      <button type="button" role="tab" aria-selected={konto === 'zeit'} onclick={() => (konto = 'zeit')}>Zeitkonto</button>
      <button type="button" role="tab" aria-selected={konto === 'urlaub'} onclick={() => (konto = 'urlaub')}>Urlaub</button>
    </div>

    <div class="saldo">
      {#if konto === 'zeit'}
        <span class="sp"><small>SALDO {datumDE(heute)}</small><b class="num">{dauer(zeit.saldo, true)}</b></span>
        <span class="rechts">davon auszahlbar<br /><b class="num">{dauer(auszahlbar)}</b></span>
      {:else}
        <span class="sp"><small>REST {jahr}</small><b class="num">{tage(urlaub.rest, false)} Tage</b></span>
        <button type="button" class="pdf" onclick={urlaubsschein}>Urlaubsschein {jahr} ↗</button>
      {/if}
    </div>

    <div class="filter">
      <button type="button" aria-pressed={filter === 'alle'} onclick={() => (filter = 'alle')}>Alle</button>
      <button type="button" aria-pressed={filter === 'offen'} onclick={() => (filter = 'offen')}>Offen{#if anzahlOffen}<span class="zahl">{' · '}{anzahlOffen}</span>{/if}</button>
    </div>
    {#if meldung}<p class="hinweistext" role="status">{meldung}</p>{/if}

    {#each sichtbar as m (m.schluessel)}
      <div class="monat"><span>{m.name.toUpperCase()}</span><span class="num">{konto === 'zeit' ? 'Saldo' : 'Rest'} {stand(m.saldoEnde)}</span></div>
      {#each m.eintraege as e, i (e.art + e.datum + i)}
        {#if e.art === 'auszahlung'}
          <section class="karte">
            <div class="kopf">
              <span><small class="typ">AUSZAHLUNG ÜBERSTUNDEN</small><b>{dauer(e.antrag.stunden)} Std. beantragt am {kurz(e.antrag.antragsdatum)}</b></span>
              <span class="status {e.status}">{AUSZ_NAME[e.status].toUpperCase()}</span>
            </div>
            <div class="schritte">
              {#each schritte(AUSZ_SCHRITTE, e.status) as s (s.s)}<span class={s.klasse}><i></i>{AUSZ_NAME[s.s]}</span>{/each}
            </div>
            {#each e.raten as r (r.monat + r.stunden)}
              <div class="kind"><span>{r.buchung ? kurz(r.buchung.datum) : ''} · Abrechnung {monatText(r.monat)}</span><span class="num"><b>{dauer(-r.stunden, true)}</b> <small>{dauer(r.saldo, true)}</small></span></div>
            {/each}
            <div class="fuss">
              <span class="leise">{e.offen ? 'noch offen ' : 'vollständig ausgezahlt'}{#if e.offen}<b class="num">{dauer(e.offen)}</b>{/if}</span>
              <button type="button" class="weiter" onclick={() => (vorgangAuszahlung = e.antrag.id)}>Weiterführen ›</button>
            </div>
          </section>
        {:else if e.art === 'plan' && (e.status === 'geplant' || e.status === 'beantragt' || e.status === 'genehmigt')}
          <section class="karte">
            <div class="kopf">
              <span><small class="typ">PLANUNG</small><b>{zeitraum(e.antrag.von, e.antrag.bis)}{e.antrag.sonstiges ? ` · ${e.antrag.sonstiges}` : ''}</b></span>
              <span class="rechts"><span class="status {e.status}">{PLAN_NAME[e.status].toUpperCase()}</span><b class="num">{tage(-e.tage)}</b></span>
            </div>
            <div class="schritte">
              {#each schritte(PLAN_SCHRITTE, e.status) as s (s.s)}<span class={s.klasse}><i></i>{PLAN_NAME[s.s]}</span>{/each}
            </div>
            <div class="fuss">
              <span class="leise">{e.antrag.vertretung ? `Vertretung ${e.antrag.vertretung} · ` : ''}Rest danach {stand(e.rest)}</span>
              <button type="button" class="weiter" onclick={() => (vorgangPlan = e.antrag.id)}>Weiterführen ›</button>
            </div>
          </section>
        {:else}
          <div class="liste">
            {#if e.art === 'buchung'}
              <button type="button" class="eintrag" onclick={() => (buchung = { art: e.buchung.art, vorhanden: e.buchung })}>
                <span class="datum num">{kurz(e.datum)}</span>
                <span class="text"><small class="typ">{ARTNAME(e.buchung).toUpperCase()}</small>{buchungstext(e.buchung)}</span>
                <span class="betrag num"><b>{betrag(e)}</b><small>{stand(e.saldo)}</small></span>
              </button>
            {:else if e.art === 'monat'}
              <button type="button" class="eintrag auto" aria-expanded={aufgeklappt === m.schluessel} onclick={() => (aufgeklappt = aufgeklappt === m.schluessel ? null : m.schluessel)}>
                <span class="datum num">{m.name.slice(0, 3)}.</span>
                <span class="text"><small class="typ">AUTOMATISCH</small><span>{e.text}<span class="pfeil" class:auf={aufgeklappt === m.schluessel}>›</span></span></span>
                <span class="betrag num"><b>{dauer(e.betrag, true)}</b><small>{dauer(e.saldo, true)}</small></span>
              </button>
              {#if aufgeklappt === m.schluessel}
                <div class="details num">Ist {dauer(e.ist)} · Soll {dauer(e.soll)}{e.zuschlag ? ` · Zuschläge ${dauer(-e.zuschlag, true)}` : ''}</div>
              {/if}
            {:else if e.art === 'auto'}
              <div class="eintrag auto">
                <span class="datum num">{kurz(e.datum)}</span>
                <span class="text"><small class="typ">AUTOMATISCH</small>{e.text}</span>
                <span class="betrag num"><b>{tage(e.betrag)}</b><small>{stand(e.saldo)}</small></span>
              </div>
            {:else if e.art === 'kalender'}
              <div class="eintrag">
                <span class="datum num">{kurz(e.von)}</span>
                <span class="text"><small class="typ">URLAUB LAUT KALENDER</small>{zeitraum(e.von, e.bis)} · ohne Planung</span>
                <span class="betrag num"><b>{tage(-e.tage)}</b><small>{stand(e.rest)}</small></span>
              </div>
            {:else if e.art === 'plan'}
              <button type="button" class="eintrag" class:gestrichen={e.status === 'gestrichen'} onclick={() => (vorgangPlan = e.antrag.id)}>
                <span class="datum num">{kurz(e.antrag.von)}</span>
                <span class="text"><small class="typ">PLANUNG · {PLAN_NAME[e.status].toUpperCase()}{e.status === 'gestrichen' ? ` ${kurz(e.antrag.gestrichen!.am)}` : ''}</small><span class="zr">{zeitraum(e.antrag.von, e.antrag.bis)}</span>{e.antrag.genehmigtAm && e.status === 'genommen' ? ` · genehmigt ${kurz(e.antrag.genehmigtAm)}` : ''}</span>
                <span class="betrag num"><b>{e.status === 'gestrichen' ? tage(-e.tage) : tage(-e.tage)}</b><small>{stand(e.rest)}</small></span>
              </button>
            {/if}
          </div>
        {/if}
      {/each}
    {:else}
      <p class="hinweistext">{filter === 'offen' ? 'Keine offenen Vorgänge.' : 'Noch keine Einträge in diesem Jahr.'}</p>
    {/each}
  </div>

  <button type="button" class="plus" aria-label="Neuer Eintrag" onclick={neu}>+</button>

  {#if buchung}
    <BuchungBlatt konto={konto} art={buchung.art} vorhanden={buchung.vorhanden} {heute} schliessen={() => (buchung = null)} vorgang={vorgangWaehlen} />
  {/if}
  {#if neuAuszahlung}
    <AuszahlungNeu {heute} schliessen={() => (neuAuszahlung = false)} fertig={(id) => ((neuAuszahlung = false), (vorgangAuszahlung = id))} />
  {/if}
  {#if neuPlan}
    <AntragBlatt {heute} schliessen={() => (neuPlan = false)} pdf={urlaubsscheinFuer} />
  {/if}
  {#if planBearbeiten}
    <AntragBlatt vorhanden={planBearbeiten} {heute} schliessen={() => (planBearbeiten = null)} pdf={urlaubsscheinFuer} />
  {/if}
  {#if vorgangAuszahlung}
    <VorgangAuszahlung id={vorgangAuszahlung} {heute} schliessen={() => (vorgangAuszahlung = null)} />
  {/if}
  {#if vorgangPlan}
    <VorgangUrlaub id={vorgangPlan} {heute} schliessen={() => (vorgangPlan = null)} bearbeiten={(a) => ((vorgangPlan = null), (planBearbeiten = a))} />
  {/if}
</div>

<style>
  .journal {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .inhalt {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--inhalt-oben) 16px calc(var(--unten) + 110px);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .leiste {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 40px;
  }
  .zurueck {
    color: var(--label2);
    font-size: 17px;
  }
  .jahr {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--label2);
  }
  .jahr button {
    width: 32px;
    height: 32px;
    font-size: 20px;
    color: var(--label2);
  }
  .jahr b {
    color: var(--label);
    font-variant-numeric: tabular-nums;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.02em;
  }
  .reiter {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-bottom: 1px solid var(--sep);
  }
  .reiter button {
    padding: 9px 0;
    color: var(--label2);
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
  }
  .reiter button[aria-selected='true'] {
    color: var(--label);
    font-weight: 600;
    border-bottom-color: var(--orange);
  }
  .saldo {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    background: var(--group);
    border-radius: 12px;
    padding: 12px 14px;
  }
  .sp {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sp small,
  .monat,
  .typ {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--label3);
  }
  .sp b {
    font-size: 26px;
  }
  .rechts {
    font-size: 13px;
    color: var(--label2);
    text-align: right;
  }
  .rechts b {
    color: var(--label);
  }
  .pdf {
    font-size: 13px;
    font-weight: 600;
    color: var(--orange-text);
  }
  .filter {
    display: flex;
    gap: 8px;
  }
  .filter button {
    border-radius: 99px;
    padding: 6px 13px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--sep);
    color: var(--label);
  }
  .filter button[aria-pressed='true'] {
    background: var(--label);
    color: var(--group);
    border-color: var(--label);
  }
  .zahl {
    color: var(--orange);
  }
  .monat {
    display: flex;
    justify-content: space-between;
    margin: 8px 2px -4px;
  }
  .karte {
    background: var(--group);
    border-radius: 12px;
    box-shadow: 0 0 0 1px var(--sep);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .kopf {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }
  .kopf > span:first-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kopf .typ {
    color: var(--orange-text);
    font-weight: 700;
  }
  .kopf .rechts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    color: var(--label);
  }
  .status {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 3px 7px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .status.geplant {
    border: 1px dashed var(--label3);
    color: var(--label2);
    padding: 2px 6px;
  }
  .status.beantragt,
  .status.teilweise {
    background: var(--orange-glow);
    color: var(--orange-text);
  }
  .status.genehmigt {
    background: var(--label);
    color: var(--group);
  }
  .status.ausgezahlt,
  .status.genommen {
    background: var(--leer);
    color: var(--label2);
  }
  .schritte {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    font-size: 10.5px;
    color: var(--label2);
  }
  .schritte span {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .schritte i {
    height: 4px;
    border-radius: 2px;
    background: var(--leer);
  }
  .schritte .fertig i {
    background: var(--label);
  }
  .schritte .jetzt {
    color: var(--label);
    font-weight: 600;
  }
  .schritte .jetzt i {
    background: var(--orange);
  }
  .kind {
    display: flex;
    justify-content: space-between;
    font-size: 13.5px;
    color: var(--label2);
    padding-top: 8px;
    border-top: 1px solid var(--sep);
  }
  .kind b {
    color: var(--label);
  }
  .kind small {
    color: var(--label3);
    font-size: 11.5px;
  }
  .fuss {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .leise {
    color: var(--label2);
  }
  .leise b {
    color: var(--label);
  }
  .weiter {
    color: var(--orange-text);
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
  }
  .liste {
    background: var(--group);
    border-radius: 12px;
  }
  .eintrag {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 11px 14px;
    width: 100%;
    text-align: left;
    color: var(--label);
    font-size: 15px;
  }
  .eintrag.auto {
    color: var(--label2);
  }
  .datum {
    font-size: 13px;
    color: var(--label2);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .betrag {
    text-align: right;
    display: flex;
    flex-direction: column;
  }
  .betrag small {
    font-size: 11.5px;
    color: var(--label3);
  }
  .gestrichen .zr,
  .gestrichen .betrag b {
    text-decoration: line-through;
    color: var(--label3);
  }
  .details {
    padding: 0 14px 11px 72px;
    font-size: 13px;
    color: var(--label2);
  }
  .pfeil {
    display: inline-block;
    margin-left: 6px;
    font-size: 16px;
    color: var(--label3);
    transform: rotate(90deg);
    transition: transform 0.2s;
  }
  .pfeil.auf {
    transform: rotate(-90deg);
  }
  .plus {
    position: fixed;
    right: max(20px, calc(50% - 260px));
    bottom: calc(var(--unten) + 24px);
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: var(--orange);
    color: #fff;
    font-size: 32px;
    font-weight: 300;
    line-height: 1;
    box-shadow: 0 0 0 8px var(--orange-glow), 0 8px 20px rgba(21, 21, 21, 0.18);
    z-index: 21;
  }
</style>
