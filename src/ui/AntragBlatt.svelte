<script lang="ts">
  import { untrack } from 'svelte';
  import type { Urlaubsantrag } from '../core/modell';
  import { antragTage, antragsliste, kalenderFuer, pruefeAntrag } from '../core/urlaubsantrag';
  import { type Datum, datumDE, jahrVon } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';

  let { vorhanden, heute, schliessen, pdf }: { vorhanden?: Urlaubsantrag; heute: Datum; schliessen: () => void; pdf: (a: Urlaubsantrag) => void } = $props();

  const a0 = untrack(() => vorhanden);
  const start = untrack(() => heute);
  let von = $state<Datum>(a0?.von ?? start);
  let bis = $state<Datum>(a0?.bis ?? start);
  let sonstiges = $state(a0?.sonstiges ?? '');
  let vertretung = $state(a0?.vertretung ?? '');
  let genehmigt = $state(a0?.genehmigt ?? false);
  let genehmigtAm = $state<Datum>(a0?.genehmigtAm ?? '');
  let fehler = $state<string | null>(null);
  let ansicht = $state<'antrag' | 'streichen'>('antrag');
  let grund = $state(a0?.gestrichen?.grund ?? '');
  let gestrichenAm = $state<Datum>(start);

  // „Bis“ folgt „Von“, wie beim Zeitraum im Kalender
  let letztesVon = untrack(() => von);
  $effect(() => {
    const v = von;
    untrack(() => {
      if (v && (!bis || bis < v || bis === letztesVon)) bis = v;
      letztesVon = v;
    });
  });
  // Beim Einschalten der Genehmigung das heutige Datum vorschlagen
  $effect(() => {
    if (genehmigt && !untrack(() => genehmigtAm)) genehmigtAm = heute;
  });

  const kuerzel = $derived(speicher.einstellungen.genehmiger || 'CHE');
  const tage = $derived(antragTage(von, bis));
  const gestrichen = $derived(!!a0?.gestrichen);
  // Neue Einträge sind zunächst nur geplant (zum Durchspielen von Varianten)
  const istPlan = $derived(!genehmigt && (a0 ? !!a0.plan && !a0.genehmigt : true));
  const restDanach = $derived.by(() => {
    if (!von || !bis || von > bis) return null;
    const probe: Urlaubsantrag = { ...(a0 ?? { id: '__neu__', erstelltAm: '' }), von, bis, genehmigt, gestrichen: a0?.gestrichen };
    const daten = { ...speicher.daten, antraege: [...speicher.antraege.filter((a) => a.id !== probe.id), probe] };
    return antragsliste(daten, jahrVon(von), heute).find((z) => z.antrag.id === probe.id)?.rest ?? null;
  });

  function baue(plan = istPlan): Urlaubsantrag {
    return {
      id: a0?.id ?? crypto.randomUUID(),
      von,
      bis,
      sonstiges: sonstiges.trim() || undefined,
      vertretung: vertretung.trim().toUpperCase() || undefined,
      plan: plan && !genehmigt ? true : undefined,
      genehmigt,
      genehmigtAm: genehmigt ? genehmigtAm || undefined : undefined,
      gestrichen: a0?.gestrichen,
      erstelltAm: a0?.erstelltAm ?? new Date().toISOString()
    };
  }

  /** `beantragen`: aus dem Plan wird ein Antrag, danach das PDF */
  async function sichern(beantragen = false, mitPdf = beantragen) {
    fehler = null;
    const neu = baue(beantragen ? false : istPlan);
    const f = pruefeAntrag(neu, speicher.antraege);
    if (f) return (fehler = f);
    await speicher.speichereAntrag(neu, kalenderFuer(speicher.tage, a0 ?? null, neu, new Date().toISOString()));
    if (mitPdf) pdf(neu);
    schliessen();
  }

  async function streichen() {
    if (!a0) return;
    const neu: Urlaubsantrag = { ...baue(), gestrichen: { am: gestrichenAm || heute, grund: grund.trim() || undefined } };
    await speicher.speichereAntrag(neu, kalenderFuer(speicher.tage, a0, neu, new Date().toISOString()));
    schliessen();
  }

  async function wiederaufnehmen() {
    if (!a0) return;
    const neu: Urlaubsantrag = { ...baue(), gestrichen: undefined };
    const f = pruefeAntrag(neu, speicher.antraege);
    if (f) return (fehler = f);
    await speicher.speichereAntrag(neu, kalenderFuer(speicher.tage, a0, neu, new Date().toISOString()));
    schliessen();
  }

  async function loeschen() {
    if (!a0) return;
    await speicher.loescheAntrag(a0.id, kalenderFuer(speicher.tage, a0, null, new Date().toISOString()));
    schliessen();
  }

  const zahl = (n: number) => String(n).replace('.', ',');
</script>

<Blatt titel={ansicht === 'streichen' ? 'Antrag streichen' : !a0 ? 'Neuer Urlaub' : istPlan ? 'Urlaub geplant' : 'Urlaubsantrag'} {schliessen}>
  {#if ansicht === 'streichen'}
    <p class="hinweistext mitte">{datumDE(von)} – {datumDE(bis)} · {zahl(tage)} {tage === 1 ? 'Tag' : 'Tage'}</p>
    <div class="gruppe">
      <label class="zeile"><span class="l">Grund</span><input class="feld text" id="ua-grund" placeholder="optional" bind:value={grund} /></label>
      <label class="zeile"><span class="l">gestrichen am</span><input class="feld" type="date" id="ua-gestrichen" bind:value={gestrichenAm} /></label>
    </div>
    <p class="hinweistext">Der Antrag bleibt durchgestrichen in der Liste und im PDF. {a0?.genehmigt ? 'Die Tage werden aus dem Kalender entfernt, ' : ''}der Rest steigt wieder um {zahl(tage)} {tage === 1 ? 'Tag' : 'Tage'}.</p>
    <button type="button" class="knopf haupt rot-voll" onclick={streichen}>Streichen</button>
    <button type="button" class="knopf neben" onclick={() => (ansicht = 'antrag')}>Abbrechen</button>
  {:else}
    {#if gestrichen}
      <p class="warnung">Gestrichen am {datumDE(a0!.gestrichen!.am)}{a0!.gestrichen!.grund ? ` – ${a0!.gestrichen!.grund}` : ''}. Der Antrag zählt nicht mehr.</p>
    {/if}
    <div class="gruppe">
      <label class="zeile"><span class="l">Von</span><input class="feld" type="date" id="ua-von" bind:value={von} disabled={gestrichen} /></label>
      <label class="zeile"><span class="l">Bis</span><input class="feld" type="date" id="ua-bis" bind:value={bis} min={von} disabled={gestrichen} /></label>
      <div class="zeile">
        <span class="l leise">Urlaubstage</span>
        <span class="w"><b>{zahl(tage)}</b>{#if restDanach !== null && !gestrichen} · Rest danach {zahl(restDanach)}{/if}</span>
      </div>
    </div>
    <div class="gruppe">
      <label class="zeile"><span class="l">Sonstiges</span><input class="feld text" id="ua-sonstiges" maxlength="24" placeholder="z. B. Brückentag" bind:value={sonstiges} /></label>
      <label class="zeile"><span class="l">Vertretung</span><input class="feld kurz" id="ua-vertretung" maxlength="6" autocapitalize="characters" placeholder="Kürzel" bind:value={vertretung} /></label>
    </div>
    {#if !gestrichen}
      <div class="gruppe">
        <label class="zeile"><span class="l">Genehmigt</span><input type="checkbox" class="schalter" id="ua-genehmigt" bind:checked={genehmigt} /></label>
        {#if genehmigt}
          <div class="zeile"><span class="l leise">von</span><span class="w"><b>{kuerzel}</b></span></div>
          <label class="zeile"><span class="l leise">am</span><input class="feld" type="date" id="ua-genehmigt-am" bind:value={genehmigtAm} /></label>
        {/if}
      </div>
      <p class="hinweistext">
        {genehmigt
          ? 'Die Tage stehen als Urlaub im Kalender.'
          : istPlan
            ? 'Nur geplant: Die Tage verringern den Rest, sind aber noch nicht beantragt und stehen nicht im PDF. „Beantragen und PDF“ macht daraus einen Antrag.'
            : 'Noch nicht genehmigt: Die Tage verringern den Rest, stehen aber noch nicht im Kalender.'}
      </p>
    {/if}
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <button type="button" class="knopf haupt" onclick={() => sichern(false)}>Sichern</button>
    <button type="button" class="knopf neben" onclick={() => sichern(istPlan, true)}>{istPlan ? 'Beantragen und PDF' : 'Sichern und PDF'}</button>
    <!-- Bis zur Genehmigung lässt sich ein Eintrag spurlos löschen, danach nur noch streichen -->
    {#if a0 && !a0.genehmigt && !gestrichen}<button type="button" class="knopf neben rot" onclick={loeschen}>{a0.plan ? 'Plan löschen' : 'Antrag löschen'}</button>{/if}
    {#if a0 && a0.genehmigt && !gestrichen}<button type="button" class="knopf neben rot" onclick={() => (ansicht = 'streichen')}>Antrag streichen</button>{/if}
    {#if a0 && gestrichen}<button type="button" class="knopf neben" onclick={wiederaufnehmen}>Streichung aufheben</button>{/if}
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
    max-width: 60%;
    text-align: right;
    font-weight: 500;
  }
  .kurz {
    width: 90px;
    text-align: center;
    text-transform: uppercase;
  }
  .mitte {
    text-align: center;
  }
  .warnung {
    margin: 0;
    background: #f6e3e1;
    color: var(--minus);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
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
