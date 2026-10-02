<script lang="ts">
  import { untrack } from 'svelte';
  import { ORTE, setzeArbeitsort } from '../core/bearbeiten';
  import { berichtTage, blaettere, csvJahr, csvKonten, csvOrte, csvTage, type Zeitraumart, zeitraumFuer } from '../core/berichte';
  import type { Arbeitsort } from '../core/modell';
  import { type Datum, datumDE, dauer, jahrVon, uhrzeit } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { teileDatei } from '../lib/teilen';
  import type { Teilbericht } from '../lib/pdf';
  import { symbole } from './symbole';
  import Titel from './Titel.svelte';

  let { heute, oeffneEinstellungen }: { heute: Datum; oeffneEinstellungen: () => void } = $props();

  type Bericht = 'nachweis' | 'kompakt' | 'detail' | 'konten' | 'jahr' | 'orte';
  const BERICHTE: Record<Zeitraumart, [Bericht, string, string][]> = {
    // Reihenfolge = Reihenfolge im Sammelbericht (Kontenverlauf zuerst, Wunsch des Nutzers)
    tag: [['nachweis', 'Tagesnachweis', 'zum Nachtragen im Firmensystem']],
    woche: [
      ['konten', 'Kontenverlauf', 'Zeitkonto und Urlaub mit Buchungen'],
      ['kompakt', 'Wochenübersicht', 'eine Zeile pro Tag'],
      ['detail', 'Detailnachweis', 'alle Stempelungen Kommen/Gehen']
    ],
    monat: [
      ['konten', 'Kontenverlauf', 'Zeitkonto und Urlaub mit Buchungen'],
      ['kompakt', 'Monatsjournal kompakt', 'eine Zeile pro Tag'],
      ['detail', 'Monatsjournal detailliert', 'alle Stempelungen Kommen/Gehen'],
      ['orte', 'Arbeitsorte', 'Büro- und Homeoffice-Tage']
    ],
    jahr: [
      ['konten', 'Kontenverlauf', 'Zeitkonto und Urlaub mit Buchungen'],
      ['jahr', 'Jahresübersicht', 'je Monat; allein gewählt mit Konten'],
      ['orte', 'Arbeitsorte', 'Büro- und Homeoffice-Tage, z. B. für die Steuer']
    ],
    zeitraum: [
      ['konten', 'Kontenverlauf', 'Zeitkonto und Urlaub mit Buchungen'],
      ['kompakt', 'Übersicht kompakt', 'eine Zeile pro Tag'],
      ['detail', 'Detailnachweis', 'alle Stempelungen Kommen/Gehen'],
      ['orte', 'Arbeitsorte', 'Büro- und Homeoffice-Tage']
    ]
  };
  const STANDARD: Record<Zeitraumart, Bericht[]> = { tag: ['nachweis'], woche: ['kompakt'], monat: ['kompakt'], jahr: ['jahr'], zeitraum: ['kompakt'] };
  const ARTEN: [Zeitraumart, string][] = [['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat'], ['jahr', 'Jahr'], ['zeitraum', 'Zeitraum']];

  let art = $state<Zeitraumart>('monat');
  let bezug = $state<Datum>(untrack(() => heute));
  let von = $state<Datum>(untrack(() => zeitraumFuer('monat', heute).von));
  let bis = $state<Datum>(untrack(() => heute));
  let gewaehlt = $state<Bericht[]>(['kompakt']);
  let unterschrift = $state(true);
  let protokoll = $state(false);
  let meldung = $state<string | null>(null);
  let arbeitet = $state(false);

  function artWaehlen(a: Zeitraumart) {
    art = a;
    gewaehlt = [...STANDARD[a]];
    meldung = null;
  }

  const zeitraum = $derived(
    art === 'zeitraum' ? { von, bis, titel: `${datumDE(von)} – ${datumDE(bis)}` } : zeitraumFuer(art, bezug)
  );
  const gueltig = $derived(!!zeitraum.von && !!zeitraum.bis && zeitraum.von <= zeitraum.bis);
  const bisAuswertung = $derived(zeitraum.bis < heute ? zeitraum.bis : heute);
  const summen = $derived(gueltig && zeitraum.von <= heute ? berichtTage(speicher.daten, zeitraum.von, bisAuswertung, heute).summen : null);

  // Tagesnachweis: Arbeitsort und Anlass direkt hier pflegen
  const tag = $derived(art === 'tag' ? speicher.tage.get(bezug) : undefined);
  let anlass = $state('');
  $effect(() => {
    bezug;
    anlass = untrack(() => speicher.tage.get(bezug)?.anlass ?? '');
  });
  async function ortSetzen(ort: Arbeitsort) {
    if (!tag) return;
    await speicher.speichereTag(setzeArbeitsort(tag, ort, ort === 'buero' ? '' : anlass, new Date().toISOString()));
  }
  async function anlassSichern() {
    if (!tag || anlass.trim() === (tag.anlass ?? '')) return;
    await speicher.speichereTag(setzeArbeitsort(tag, tag.arbeitsort, anlass, new Date().toISOString()));
  }

  const TITEL: Record<Bericht, string> = {
    nachweis: 'Arbeitszeitnachweis',
    kompakt: 'Übersicht',
    detail: 'Detailnachweis',
    konten: 'Kontenverlauf',
    jahr: 'Jahresübersicht',
    orte: 'Arbeitsorte'
  };
  const titelFuer = (b: Bericht) =>
    b === 'kompakt' ? (art === 'woche' ? 'Wochenübersicht' : art === 'monat' ? 'Monatsjournal kompakt' : 'Übersicht') : b === 'detail' && art === 'monat' ? 'Monatsjournal detailliert' : TITEL[b];
  // Mehrere Häkchen ergeben einen Sammelbericht in der Reihenfolge der Liste
  const auswahl = $derived(BERICHTE[art].map(([id]) => id).filter((id) => gewaehlt.includes(id)));
  const einzeln = $derived(auswahl.length === 1 ? auswahl[0] : null);
  const berichtTitel = $derived(einzeln ? titelFuer(einzeln) : 'Sammelbericht');
  function umschalten(id: Bericht) {
    gewaehlt = gewaehlt.includes(id) ? gewaehlt.filter((x) => x !== id) : [...gewaehlt, id];
    meldung = null;
  }
  const dateiname = (endung: string) =>
    `zeiterfassung-${berichtTitel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]+/g, '-')}-${zeitraum.von}${zeitraum.bis !== zeitraum.von ? `-bis-${zeitraum.bis}` : ''}.${endung}`;

  async function exportieren(format: 'pdf' | 'csv') {
    if (!gueltig || arbeitet || !auswahl.length || (format === 'csv' && !einzeln)) return;
    arbeitet = true;
    meldung = null;
    try {
      const d = speicher.daten;
      const { von: v, bis: b, titel } = zeitraum;
      let inhalt: Blob;
      if (format === 'pdf') {
        // PDF-Bibliothek erst bei Bedarf laden – hält den App-Start schnell
        const { pdfSammlung, pdfTagesnachweis } = await import('../lib/pdf');
        if (einzeln === 'nachweis') inhalt = pdfTagesnachweis(d, v, heute, { unterschrift, protokoll });
        else {
          const teile: Teilbericht[] = auswahl.map((x) =>
            x === 'detail' ? { art: 'detail', titel: titelFuer(x), protokoll } : x === 'jahr' ? { art: 'jahr', jahr: jahrVon(v) } : x === 'konten' ? { art: 'konten' } : x === 'orte' ? { art: 'orte' } : { art: 'kompakt', titel: titelFuer(x) }
          );
          inhalt = pdfSammlung(d, v, b, heute, titel, teile);
        }
      } else {
        const bericht = einzeln!;
        const text = bericht === 'jahr' ? csvJahr(d, jahrVon(v), heute) : bericht === 'konten' ? csvKonten(d, v, b, heute) : bericht === 'orte' ? csvOrte(d, v, b, heute) : csvTage(d, v, b, heute);
        inhalt = new Blob([text], { type: 'text/csv;charset=utf-8' });
      }
      const r = await teileDatei(inhalt, dateiname(format));
      meldung = r === 'abgebrochen' ? null : r === 'geteilt' ? 'Bericht geteilt' : 'Bericht gespeichert';
    } catch (e) {
      meldung = `Der Bericht konnte nicht erstellt werden: ${e instanceof Error ? e.message : e}`;
    } finally {
      arbeitet = false;
    }
  }
</script>

<Titel titel="Berichte" unter="Auswertungen" {oeffneEinstellungen} />

<div class="segmente">
  {#each ARTEN as [id, name] (id)}
    <button type="button" aria-pressed={art === id} onclick={() => artWaehlen(id)}>{name}</button>
  {/each}
</div>

{#if art === 'zeitraum'}
  <div class="gruppe">
    <label class="zeile"><span class="l">Von</span><input class="datum" type="date" id="bericht-von" bind:value={von} /></label>
    <label class="zeile"><span class="l">Bis</span><input class="datum" type="date" id="bericht-bis" bind:value={bis} min={von} /></label>
  </div>
  {#if !gueltig}<p class="fehler" role="alert">Das Enddatum muss am oder nach dem Beginn liegen.</p>{/if}
{:else}
  <div class="stepper">
    <button type="button" aria-label="Zurück" onclick={() => (bezug = blaettere(art as Exclude<Zeitraumart, 'zeitraum'>, bezug, -1))}>‹</button>
    <span>{zeitraum.titel}</span>
    <button type="button" aria-label="Weiter" onclick={() => (bezug = blaettere(art as Exclude<Zeitraumart, 'zeitraum'>, bezug, 1))}>›</button>
  </div>
{/if}

{#if summen}
  <section class="kachel werte" aria-label="Kennzahlen">
    <div><span class="etikett">Ist</span><b class="num">{dauer(summen.ist)}</b></div>
    <div><span class="etikett">Soll</span><b class="num">{dauer(summen.soll)}</b></div>
    <div><span class="etikett">Saldo</span><b class="num">{dauer(summen.saldoNachher - summen.saldoVorher, true)}</b></div>
    <div><span class="etikett">Zuschläge</span><b class="num">{dauer(-summen.zuschlag, true)}</b></div>
  </section>
{/if}

{#if art === 'tag'}
  {#if tag && tag.kommen !== null}
    <h2 class="abschnitt">Arbeitsort</h2>
    <div class="segmente">
      {#each Object.entries(ORTE) as [id, name] (id)}
        <button type="button" aria-pressed={tag.arbeitsort === id} onclick={() => ortSetzen(id as Arbeitsort)}>{name}</button>
      {/each}
    </div>
    <div class="gruppe">
      {#if tag.arbeitsort !== 'buero'}
        <label class="zeile"><span class="l">Anlass</span><input class="text" id="bericht-anlass" placeholder="z. B. Seminar" bind:value={anlass} onblur={anlassSichern} /></label>
      {/if}
      <div class="zeile"><span class="l">{uhrzeit(tag.kommen)} – {tag.gehen !== null ? uhrzeit(tag.gehen) : '…'}</span><span class="w">{tag.pausen.length} {tag.pausen.length === 1 ? 'Pause' : 'Pausen'}</span></div>
    </div>
  {:else}
    <p class="hinweistext">Für diesen Tag ist keine Arbeitszeit erfasst. Der Nachweis enthält dann nur Soll und Tagesart.</p>
  {/if}
{/if}

<h2 class="abschnitt">{BERICHTE[art].length > 1 ? 'Berichte · mehrere wählbar' : 'Bericht'}</h2>
<div class="gruppe">
  {#each BERICHTE[art] as [id, name, info] (id)}
    <button type="button" class="zeile" aria-pressed={gewaehlt.includes(id)} onclick={() => umschalten(id)}>
      <span class="l">
        {@html gewaehlt.includes(id) ? `<span class="ok">${symbole.haken}</span>` : '<span class="offen"></span>'}
        <span>{name}<small>{info}</small></span>
      </span>
    </button>
  {/each}
  {#if auswahl.includes('nachweis')}
    <label class="zeile">
      <span class="l">Mit Unterschriftsfeldern</span>
      <input type="checkbox" class="schalter" id="bericht-unterschrift" bind:checked={unterschrift} />
    </label>
  {/if}
  {#if auswahl.includes('nachweis') || auswahl.includes('detail')}
    <label class="zeile">
      <span class="l"><span>Änderungsprotokoll einbeziehen<small>wann welche Zeit geändert wurde</small></span></span>
      <input type="checkbox" class="schalter" id="bericht-protokoll" bind:checked={protokoll} />
    </label>
  {/if}
</div>

<div class="knoepfe">
  <button type="button" class="knopf haupt" disabled={!gueltig || arbeitet || !auswahl.length} onclick={() => exportieren('pdf')}>{arbeitet ? 'Wird erstellt …' : 'PDF'}</button>
  <button type="button" class="knopf neben" disabled={!gueltig || arbeitet || !einzeln} onclick={() => exportieren('csv')}>CSV</button>
</div>
{#if auswahl.length > 1}<p class="hinweistext mitte">{auswahl.length} Berichte in einem PDF, jeder ab einer neuen Seite. CSV nur für einen einzelnen Bericht.</p>{:else if !auswahl.length}<p class="hinweistext mitte">Bitte mindestens einen Bericht wählen.</p>{/if}
{#if meldung}<p class="hinweistext mitte" role="status">{meldung}</p>{/if}
<p class="hinweistext">PDF im Format A4 Hochformat. Über das Teilen-Menü lässt sich der Bericht in „Dateien“ sichern, per Mail senden oder drucken.</p>

<style>
  .stepper {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    background: var(--group);
    border-radius: 14px;
    text-align: center;
    font-weight: 600;
    min-height: 46px;
  }
  .stepper button {
    font-size: 24px;
    height: 46px;
    color: var(--label2);
  }
  .werte {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
    padding: 14px 18px;
  }
  .werte div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .werte b {
    font-size: 24px;
    color: var(--lemon);
  }
  .datum,
  .text {
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
    max-width: 65%;
    text-align: right;
    font-weight: 500;
  }
  .knoepfe {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
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
