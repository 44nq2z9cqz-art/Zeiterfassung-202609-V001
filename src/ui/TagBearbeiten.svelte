<script lang="ts">
  import {
    ARTEN,
    ORTE,
    istLeer,
    loeschePause,
    setzeArbeitsort,
    setzeArt,
    setzeGehen,
    setzeKommen,
    setzeKommentar,
    setzePause,
    setzeSoll,
    type Ergebnis
  } from '../core/bearbeiten';
  import { gueltigAm } from '../core/einstellungen';
  import type { Arbeitsort, Tag, Tagesart } from '../core/modell';
  import { bewerteTag, sollMinuten } from '../core/regeln';
  import { leererTag } from '../core/stempeln';
  import { WOCHENTAGE, type Datum, datumDE, dauer, parseUhrzeit, uhrzeit, wochentag } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';
  import { symbole } from './symbole';

  let { datum, heute, schliessen }: { datum: Datum; heute: Datum; schliessen: () => void } = $props();

  const tag = $derived(speicher.tage.get(datum) ?? leererTag(datum));
  const e = $derived(speicher.einstellungen);
  const erg = $derived(bewerteTag(datum, speicher.tage.get(datum), e, heute));
  const standardSoll = $derived(sollMinuten(datum, { ...tag, sollAbweichung: undefined }, e));

  let fehler = $state<string | null>(null);
  let anlass = $state('');
  let kommentar = $state('');
  $effect(() => {
    // Eingabefelder nur beim Öffnen bzw. Tageswechsel aus dem gespeicherten Tag füllen
    datum;
    anlass = speicher.tage.get(datum)?.anlass ?? '';
    kommentar = speicher.tage.get(datum)?.kommentar ?? '';
  });

  const jetztIso = () => new Date().toISOString();

  async function speichern(neu: Tag) {
    fehler = null;
    if (istLeer(neu)) await speicher.loescheTag(datum);
    else await speicher.speichereTag(neu);
  }
  async function anwenden(r: Ergebnis): Promise<boolean> {
    if (r.fehler) {
      fehler = r.fehler;
      return false;
    }
    await speichern(r.tag!);
    return true;
  }

  // ─── Zeit-Blatt ──────────────────────────────────────────────────────────
  type Bearbeitung =
    | { art: 'kommen' | 'gehen' | 'soll'; wert: string }
    | { art: 'pause'; id: string | null; beginn: string; ende: string };
  let blatt = $state<Bearbeitung | null>(null);

  function oeffne(b: Bearbeitung) {
    fehler = null;
    blatt = b;
  }

  async function blattSichern() {
    if (!blatt) return;
    const am = jetztIso();
    if (blatt.art === 'pause') {
      const b = parseUhrzeit(blatt.beginn);
      const en = parseUhrzeit(blatt.ende);
      if (b === null || en === null) return (fehler = 'Bitte Beginn und Ende eintragen.');
      if (await anwenden(setzePause(tag, blatt.id, b, en, am))) blatt = null;
      return;
    }
    const m = parseUhrzeit(blatt.wert);
    if (m === null) return (fehler = 'Bitte eine Uhrzeit eintragen.');
    if (blatt.art === 'soll') {
      await speichern(setzeSoll(tag, m, am));
      blatt = null;
    } else if (await anwenden(blatt.art === 'kommen' ? setzeKommen(tag, m, am) : setzeGehen(tag, m, am))) {
      blatt = null;
    }
  }

  async function blattLeeren() {
    if (!blatt) return;
    const am = jetztIso();
    if (blatt.art === 'pause' && blatt.id) await speichern(loeschePause(tag, blatt.id, am));
    else if (blatt.art === 'soll') await speichern(setzeSoll(tag, null, am));
    else if (blatt.art === 'gehen') await anwenden(setzeGehen(tag, null, am));
    else if (blatt.art === 'kommen') {
      if (tag.gehen !== null || tag.pausen.length) return (fehler = 'Bitte zuerst Gehen und Pausen entfernen.');
      await anwenden(setzeKommen(tag, null, am));
    }
    blatt = null;
  }

  const wandel = (m: number | null) => (m === null ? '' : uhrzeit(m));

  // ─── Sonstiges ───────────────────────────────────────────────────────────
  const artWaehlen = (art: Tagesart) => art !== tag.art && speichern(setzeArt(tag, art, jetztIso()));
  const ortWaehlen = (ort: Arbeitsort) => speichern(setzeArbeitsort(tag, ort, ort === 'buero' ? '' : anlass, jetztIso()));
  const anlassSichern = () => anlass.trim() !== (tag.anlass ?? '') && speichern(setzeArbeitsort(tag, tag.arbeitsort, anlass, jetztIso()));
  const kommentarSichern = () => kommentar.trim() !== (tag.kommentar ?? '') && speichern(setzeKommentar(tag, kommentar, jetztIso()));

  let loeschenFragen = $state(false);
  let protokollOffen = $state(false);
  async function tagLoeschen() {
    await speicher.loescheTag(datum);
    loeschenFragen = false;
    schliessen();
  }

  const QUELLE: Record<string, string> = { live: 'live gestempelt', manuell: 'nachgetragen', import: 'aus alter App' };
  const fenster = $derived(erg.fenster);
  const hatInhalt = $derived(speicher.tage.has(datum));
  const einzelMin = $derived(gueltigAm(e.pausenregel, datum).mindestEinzel);
  // Pausen zusammengefasst, aufklappbar (abgeschlossene Pausen zählen in die Summe)
  let pausenOffen = $state(false);
  const pausenSumme = $derived(tag.pausen.reduce((s, p) => s + (p.ende !== null ? p.ende - p.beginn : 0), 0));
  const pauseLaeuft = $derived(tag.pausen.some((p) => p.ende === null));
</script>

<div class="seite" role="dialog" aria-modal="true" aria-label="Tag bearbeiten">
  <div class="inhalt">
    <div class="leiste">
      <button type="button" class="zurueck" onclick={schliessen}>‹ Kalender</button>
      <span class="t">{WOCHENTAGE[wochentag(datum)].slice(0, 2)}, {datumDE(datum)}</span>
      <span></span>
    </div>

    <div class="trio">
      <div><span>Ist</span><b class="num">{erg.ist !== null ? dauer(erg.ist) : '–'}</b></div>
      <div><span>Soll</span><b class="num">{dauer(erg.soll)}</b></div>
      <div><span>Saldo</span><b class="num" class:plus={erg.saldo > 0} class:minus={erg.saldo < 0}>{dauer(erg.saldo, true)}</b></div>
    </div>
    {#if erg.feiertag}<p class="hinweistext">{erg.feiertag}</p>{/if}

    <div class="segmente">
      {#each Object.entries(ARTEN) as [id, name] (id)}
        <button type="button" aria-pressed={tag.art === id} onclick={() => artWaehlen(id as Tagesart)}>{name}</button>
      {/each}
    </div>

    {#if tag.art === 'arbeit'}
      <h2 class="abschnitt">Arbeitsort</h2>
      <div class="segmente">
        {#each Object.entries(ORTE) as [id, name] (id)}
          <button type="button" aria-pressed={tag.arbeitsort === id} onclick={() => ortWaehlen(id as Arbeitsort)}>{name}</button>
        {/each}
      </div>
      {#if tag.arbeitsort !== 'buero'}
        <div class="gruppe">
          <label class="zeile">
            <span class="l">Anlass</span>
            <input class="feld" id="anlass" placeholder="z. B. Seminar" bind:value={anlass} onblur={anlassSichern} />
          </label>
        </div>
      {/if}

      <h2 class="abschnitt">Stempelungen</h2>
      <div class="gruppe">
        <button type="button" class="zeile" onclick={() => oeffne({ art: 'kommen', wert: wandel(tag.kommen) })}>
          <span class="l"><span>Kommen{#if tag.kommenQuelle}<small>{QUELLE[tag.kommenQuelle]}</small>{/if}</span></span>
          <span class="w stark">{tag.kommen !== null ? uhrzeit(tag.kommen) : 'eintragen'} <span class="pfeil">›</span></span>
        </button>
        {#if tag.pausen.length}
          <!-- Summe aller Pausen, die einzelnen Pausen klappen darunter auf -->
          <button type="button" class="zeile" aria-expanded={pausenOffen} onclick={() => (pausenOffen = !pausenOffen)}>
            <span class="l"><span>Pausen insgesamt<small>{tag.pausen.length} {tag.pausen.length === 1 ? 'Pause' : 'Pausen'}{pauseLaeuft ? ' · eine läuft' : ''}</small></span></span>
            <span class="w stark">{dauer(pausenSumme)} <span class="pfeil" style="transform:rotate({pausenOffen ? -90 : 90}deg)">›</span></span>
          </button>
        {/if}
        {#each pausenOffen ? tag.pausen : [] as p (p.id)}
          {@const laenge = (p.ende ?? p.beginn) - p.beginn}
          <button type="button" class="zeile einzelpause" onclick={() => oeffne({ art: 'pause', id: p.id, beginn: uhrzeit(p.beginn), ende: p.ende === null ? '' : uhrzeit(p.ende) })}>
            <span class="l">
              {@html p.ende !== null && laenge >= einzelMin ? `<span class="ok">${symbole.haken}</span>` : '<span class="offen"></span>'}
              Pause {uhrzeit(p.beginn)} – {p.ende === null ? 'läuft' : uhrzeit(p.ende)}
            </span>
            <span class="w">{p.ende === null ? '' : `${laenge} Min`} <span class="pfeil">›</span></span>
          </button>
        {/each}
        <button type="button" class="zeile" onclick={() => oeffne({ art: 'gehen', wert: wandel(tag.gehen) })}>
          <span class="l"><span>Gehen{#if tag.gehenQuelle}<small>{QUELLE[tag.gehenQuelle]}</small>{/if}</span></span>
          <span class="w stark">{tag.gehen !== null ? uhrzeit(tag.gehen) + (tag.gehen >= 1440 ? ' (+1 Tag)' : '') : 'eintragen'} <span class="pfeil">›</span></span>
        </button>
        {#if tag.kommen !== null}
          <button type="button" class="zeile aktion" onclick={() => oeffne({ art: 'pause', id: null, beginn: '', ende: '' })}>
            <span class="l">+ Pause hinzufügen</span>
          </button>
        {/if}
      </div>

      {#if fenster && fenster.greift}
        <div class="gruppe">
          {#if fenster.zuschlag > 0}
            <div class="zeile">
              <span class="l"><span class="plakette">!</span><span>Pausenzeitverletzung<small>{fenster.imFenster} von 30 Min im Regelzeitraum, längste Pause {fenster.laengste} Min</small></span></span>
              <span class="w stark">{dauer(-fenster.zuschlag, true)}</span>
            </div>
          {:else}
            <div class="zeile"><span class="l"><span class="ok">{@html symbole.haken}</span>Pausenregel erfüllt</span><span class="w">{fenster.imFenster} Min im Regelzeitraum</span></div>
          {/if}
        </div>
      {/if}
      {#if erg.gesetz?.erreicht}
        <div class="gruppe">
          {#if erg.gesetz.zuschlag > 0}
            <div class="zeile">
              <span class="l"><span class="plakette">!</span><span>Gesetzliche Pause ab 9 Std.<small>{erg.gesetz.pause} von 45 Min Pause</small></span></span>
              <span class="w stark">{dauer(-erg.gesetz.zuschlag, true)}</span>
            </div>
          {:else}
            <div class="zeile"><span class="l"><span class="ok">{@html symbole.haken}</span>Gesetzliche Pause erfüllt</span><span class="w">{erg.gesetz.pause} von 45 Min</span></div>
          {/if}
        </div>
      {/if}
    {/if}

    {#if fehler && !blatt}<p class="fehler" role="alert">{fehler}</p>{/if}

    <div class="gruppe">
      <button type="button" class="zeile" onclick={() => oeffne({ art: 'soll', wert: uhrzeit(erg.soll) })}>
        <span class="l"><span>Sollzeit{#if tag.sollAbweichung !== undefined}<small>abweichend, Standard {dauer(standardSoll)}</small>{/if}</span></span>
        <span class="w">{dauer(erg.soll)} <span class="pfeil">›</span></span>
      </button>
    </div>

    <h2 class="abschnitt">Kommentar</h2>
    <div class="gruppe">
      <textarea class="kommentar" id="kommentar" rows="2" placeholder="Kommentar hinzufügen" bind:value={kommentar} onblur={kommentarSichern}></textarea>
    </div>

    {#if tag.protokoll.length}
      <div class="gruppe">
        <button type="button" class="zeile" aria-expanded={protokollOffen} onclick={() => (protokollOffen = !protokollOffen)}>
          <span class="l">Änderungen</span><span class="w">{tag.protokoll.length} <span class="pfeil" style="display:inline-block;transform:rotate({protokollOffen ? -90 : 90}deg)">›</span></span>
        </button>
        {#if protokollOffen}
          {#each [...tag.protokoll].reverse() as p, i (i)}
            <div class="zeile klein">
              <span class="l"><span>{p.feld}<small>{new Date(p.am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small></span></span>
              <span class="w">{p.alt ?? '–'} → {p.neu ?? '–'}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    {#if hatInhalt}
      <div class="gruppe"><button type="button" class="zeile loeschen" onclick={() => (loeschenFragen = true)}><span class="l">Tag löschen</span></button></div>
    {/if}
  </div>
</div>

{#if blatt}
  <Blatt titel={blatt.art === 'pause' ? (blatt.id ? 'Pause ändern' : 'Pause hinzufügen') : blatt.art === 'soll' ? 'Sollzeit' : blatt.art === 'kommen' ? 'Kommen' : 'Gehen'} schliessen={() => (blatt = null)}>
    <div class="gruppe">
      {#if blatt.art === 'pause'}
        <label class="zeile"><span class="l">Beginn</span><input class="zeit" type="time" id="p-beginn" bind:value={blatt.beginn} /></label>
        <label class="zeile"><span class="l">Ende</span><input class="zeit" type="time" id="p-ende" bind:value={blatt.ende} /></label>
      {:else}
        <label class="zeile"><span class="l">{blatt.art === 'soll' ? 'Stunden' : 'Uhrzeit'}</span><input class="zeit" type="time" id="z-wert" bind:value={blatt.wert} /></label>
      {/if}
    </div>
    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <button type="button" class="knopf haupt" onclick={blattSichern}>Sichern</button>
    {#if (blatt.art === 'pause' && blatt.id) || (blatt.art === 'gehen' && tag.gehen !== null) || (blatt.art === 'kommen' && tag.kommen !== null)}
      <button type="button" class="knopf neben rot" onclick={blattLeeren}>{blatt.art === 'pause' ? 'Pause löschen' : 'Zeit entfernen'}</button>
    {:else if blatt.art === 'soll' && tag.sollAbweichung !== undefined}
      <button type="button" class="knopf neben" onclick={blattLeeren}>Standard {dauer(standardSoll)} verwenden</button>
    {/if}
  </Blatt>
{/if}

{#if loeschenFragen}
  <Blatt titel="Tag löschen?" schliessen={() => (loeschenFragen = false)}>
    <p class="hinweistext mitte">Alle Stempelungen, Pausen und der Kommentar vom {datumDE(datum)} werden gelöscht.</p>
    <button type="button" class="knopf haupt rot-voll" onclick={tagLoeschen}>Tag löschen</button>
    <button type="button" class="knopf neben" onclick={() => (loeschenFragen = false)}>Abbrechen</button>
  </Blatt>
{/if}

<style>
  .pfeil {
    display: inline-block;
    transition: transform 0.2s ease;
  }
  /* Einzelne Pausen eingerückt unter „Pausen insgesamt“ */
  .einzelpause {
    padding-left: 32px;
    font-size: 15px;
  }
  .seite {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--bg);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .inhalt {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--inhalt-oben) 16px calc(var(--unten) + 40px);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .leiste {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 40px;
  }
  .zurueck {
    justify-self: start;
    font-size: 17px;
    font-weight: 500;
  }
  .leiste .t {
    font-weight: 600;
    font-size: 17px;
  }
  .trio {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--group);
    border-radius: 14px;
    padding: 10px 0;
    text-align: center;
  }
  .trio div + div {
    border-left: 1px solid var(--sep);
  }
  .trio span {
    display: block;
    font-size: 12px;
    color: var(--label2);
    font-weight: 600;
  }
  .trio b {
    font-size: 21px;
  }
  .feld {
    flex: 1;
    min-width: 0;
    text-align: right;
    font: inherit;
    border: none;
    background: transparent;
    color: var(--label);
  }
  .zeit {
    font: inherit;
    font-weight: 600;
    font-size: 17px;
    border: none;
    background: var(--fill);
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--label);
    min-width: 100px;
    text-align: center;
  }
  .kommentar {
    display: block;
    width: 100%;
    border: none;
    resize: vertical;
    font: inherit;
    padding: 12px 16px;
    background: transparent;
    color: var(--label);
  }
  .zeile.klein {
    font-size: 14px;
  }
  .loeschen {
    justify-content: center;
  }
  .loeschen .l {
    color: var(--minus);
    font-weight: 600;
  }
  .rot {
    color: var(--minus);
  }
  .rot-voll {
    background: var(--minus);
    color: #fff;
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
</style>
