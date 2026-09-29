<script lang="ts">
  // Einstellung ändern. Werte mit „gültig ab“ wirken nie rückwirkend (Konzept B1).
  import { untrack } from 'svelte';
  import { parseStunden } from '../core/buchungen';
  import { entferneAb, gueltigAm, setzeAb } from '../core/einstellungen';
  import type { Einstellungen, Gueltig, Hinweise, Pausenregel } from '../core/modell';
  import { type Datum, datumDE, dauer, parseUhrzeit, uhrzeit } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';
  import StundenEingabe from './StundenEingabe.svelte';

  export type Art = 'wochenstunden' | 'halbtag' | 'urlaubsanspruch' | 'pausenregel' | 'sockel' | 'hinweise';
  let { art, heute, schliessen }: { art: Art; heute: Datum; schliessen: () => void } = $props();

  const e0 = untrack(() => speicher.einstellungen);
  const TITEL: Record<Art, string> = {
    wochenstunden: 'Wochenstunden',
    halbtag: 'Soll 24.12. und 31.12.',
    urlaubsanspruch: 'Urlaubsanspruch',
    pausenregel: 'Pausenregel',
    sockel: 'Sockel Zeitkonto',
    hinweise: 'Hinweise'
  };

  const stundenText = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const heuteWert = <T,>(l: Gueltig<T>[]) => gueltigAm(l, heute);

  // Gemeinsame Felder
  let ab = $state<Datum>(untrack(() => (art === 'urlaubsanspruch' ? `${Number(heute.slice(0, 4)) + 1}-01-01` : heute)));
  let fehler = $state<string | null>(null);

  // Stunden bzw. Tage
  const art0 = untrack(() => art);
  let stunden = $state(
    art0 === 'wochenstunden' ? stundenText(heuteWert(e0.wochenstunden)) : art0 === 'halbtag' ? stundenText(heuteWert(e0.sollHalbtag)) : art0 === 'sockel' ? stundenText(e0.sockel) : ''
  );
  let tage = $state(String(heuteWert(e0.urlaubsanspruch)));

  // Pausenregel
  const r0 = heuteWert(e0.pausenregel);
  let regel = $state({ ...r0, beginn: uhrzeit(r0.fensterBeginn), ende: uhrzeit(r0.fensterEnde) });

  // Hinweise
  let hinweise = $state({
    ...e0.hinweise,
    fensterUhr: uhrzeit(e0.hinweise.pausenfenster.uhrzeit),
    pauseNachText: stundenText(e0.hinweise.pauseNach.minuten),
    endeUhr: uhrzeit(e0.hinweise.arbeitsende.uhrzeit)
  });

  const liste = $derived(
    art === 'wochenstunden'
      ? speicher.einstellungen.wochenstunden.map((g) => ({ ab: g.ab, text: `${dauer(g.wert)} pro Woche` }))
      : art === 'halbtag'
        ? speicher.einstellungen.sollHalbtag.map((g) => ({ ab: g.ab, text: dauer(g.wert) }))
        : art === 'urlaubsanspruch'
          ? speicher.einstellungen.urlaubsanspruch.map((g) => ({ ab: g.ab, text: `${g.wert} Tage` }))
          : art === 'pausenregel'
            ? speicher.einstellungen.pausenregel.map((g) => ({
                ab: g.ab,
                text: g.wert.aktiv ? `${uhrzeit(g.wert.fensterBeginn)}–${uhrzeit(g.wert.fensterEnde)}, ${g.wert.mindestGesamt}/${g.wert.mindestEinzel} Min, ${g.wert.wochentage.map((w) => WT[w]).join(' ')}` : 'aus'
              }))
            : []
  );
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const abText = (d: Datum) => (d <= '2000-01-01' ? 'von Anfang an' : `ab ${datumDE(d)}`);

  async function speichern(neu: Einstellungen) {
    await speicher.speichereEinstellungen(neu);
    schliessen();
  }

  async function sichern() {
    fehler = null;
    const e = speicher.einstellungen;
    if (art !== 'sockel' && art !== 'hinweise' && !ab) return (fehler = 'Bitte ein Datum für „gültig ab“ wählen.');

    if (art === 'wochenstunden' || art === 'halbtag' || art === 'sockel') {
      const m = parseStunden(stunden);
      if (m === null || m <= 0) return (fehler = 'Bitte Stunden und Minuten eingeben, Minuten höchstens 59.');
      if (art === 'wochenstunden' && m > 60 * 60) return (fehler = 'Mehr als 60 Wochenstunden sind nicht vorgesehen.');
      if (art === 'wochenstunden') return speichern({ ...e, wochenstunden: setzeAb(e.wochenstunden, ab, m) });
      if (art === 'halbtag') return speichern({ ...e, sollHalbtag: setzeAb(e.sollHalbtag, ab, m) });
      return speichern({ ...e, sockel: m });
    }
    if (art === 'urlaubsanspruch') {
      const n = Number(tage.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 60 || (n * 2) % 1 !== 0) return (fehler = 'Bitte ganze oder halbe Tage eingeben, z. B. 31.');
      return speichern({ ...e, urlaubsanspruch: setzeAb(e.urlaubsanspruch, ab, n) });
    }
    if (art === 'pausenregel') {
      const b = parseUhrzeit(regel.beginn);
      const en = parseUhrzeit(regel.ende);
      if (b === null || en === null || en <= b) return (fehler = 'Der Zeitraum der Pausenregel braucht einen Beginn vor dem Ende.');
      if (!(regel.mindestGesamt >= 0) || !(regel.mindestEinzel >= 0)) return (fehler = 'Bitte Minuten als Zahl eingeben.');
      if (regel.mindestEinzel > regel.mindestGesamt) return (fehler = 'Die Mindest-Einzelpause kann nicht länger sein als die Mindestpause gesamt.');
      const wert: Pausenregel = {
        aktiv: regel.aktiv,
        fensterBeginn: b,
        fensterEnde: en,
        mindestGesamt: Math.round(regel.mindestGesamt),
        mindestEinzel: Math.round(regel.mindestEinzel),
        wochentage: [...regel.wochentage].sort()
      };
      return speichern({ ...e, pausenregel: setzeAb(e.pausenregel, ab, wert) });
    }
    // Hinweise
    const fu = parseUhrzeit(hinweise.fensterUhr);
    const eu = parseUhrzeit(hinweise.endeUhr);
    const pn = parseStunden(hinweise.pauseNachText);
    if (fu === null || eu === null || pn === null) return (fehler = 'Bitte alle Uhrzeiten vollständig eintragen.');
    const neu: Hinweise = {
      pausenfenster: { aktiv: hinweise.pausenfenster.aktiv, uhrzeit: fu },
      pauseNach: { aktiv: hinweise.pauseNach.aktiv, minuten: pn },
      arbeitsende: { aktiv: hinweise.arbeitsende.aktiv, uhrzeit: eu },
      backupNachTagen: Math.max(1, Math.round(Number(hinweise.backupNachTagen) || 7))
    };
    return speichern({ ...e, hinweise: neu });
  }

  async function eintragEntfernen(datum: Datum) {
    const e = speicher.einstellungen;
    if (art === 'wochenstunden') await speicher.speichereEinstellungen({ ...e, wochenstunden: entferneAb(e.wochenstunden, datum) });
    if (art === 'halbtag') await speicher.speichereEinstellungen({ ...e, sollHalbtag: entferneAb(e.sollHalbtag, datum) });
    if (art === 'urlaubsanspruch') await speicher.speichereEinstellungen({ ...e, urlaubsanspruch: entferneAb(e.urlaubsanspruch, datum) });
    if (art === 'pausenregel') await speicher.speichereEinstellungen({ ...e, pausenregel: entferneAb(e.pausenregel, datum) });
  }

  function tagUmschalten(w: number) {
    regel.wochentage = regel.wochentage.includes(w) ? regel.wochentage.filter((x) => x !== w) : [...regel.wochentage, w];
  }
</script>

<Blatt titel={TITEL[art]} {schliessen}>
  {#if liste.length}
    <h2 class="abschnitt">Verlauf</h2>
    <div class="gruppe">
      {#each liste as g, i (g.ab)}
        <div class="zeile">
          <span class="l"><span>{g.text}<small>{abText(g.ab)}</small></span></span>
          {#if i > 0}<button type="button" class="entfernen" aria-label="Eintrag {abText(g.ab)} entfernen" onclick={() => eintragEntfernen(g.ab)}>Entfernen</button>{/if}
        </div>
      {/each}
    </div>
    <h2 class="abschnitt">Neuer Wert</h2>
  {/if}

  <div class="gruppe">
    {#if art === 'wochenstunden' || art === 'halbtag' || art === 'sockel'}
      <div class="zeile"><span class="l">{art === 'wochenstunden' ? 'Stunden pro Woche' : 'Stunden'}</span><StundenEingabe id="es-stunden" bind:wert={stunden} /></div>
    {:else if art === 'urlaubsanspruch'}
      <label class="zeile"><span class="l">Tage pro Jahr</span><input class="feld" id="es-tage" inputmode="decimal" bind:value={tage} /></label>
    {:else if art === 'pausenregel'}
      <label class="zeile"><span class="l">Regel aktiv</span><input type="checkbox" class="schalter" id="es-regel-aktiv" bind:checked={regel.aktiv} /></label>
      {#if regel.aktiv}
        <label class="zeile"><span class="l">Zeitraum von</span><input class="feld" type="time" id="es-fenster-beginn" bind:value={regel.beginn} /></label>
        <label class="zeile"><span class="l">Zeitraum bis</span><input class="feld" type="time" id="es-fenster-ende" bind:value={regel.ende} /></label>
        <label class="zeile"><span class="l">Mindestpause gesamt</span><span class="w"><input class="feld zahl" type="number" inputmode="numeric" min="0" id="es-min-gesamt" bind:value={regel.mindestGesamt} /> Min</span></label>
        <label class="zeile"><span class="l">davon eine Pause ab</span><span class="w"><input class="feld zahl" type="number" inputmode="numeric" min="0" id="es-min-einzel" bind:value={regel.mindestEinzel} /> Min</span></label>
        <div class="zeile">
          <span class="l">Gilt an</span>
          <span class="tage">
            {#each [1, 2, 3, 4, 5] as w (w)}
              <button type="button" class="tag" aria-pressed={regel.wochentage.includes(w)} onclick={() => tagUmschalten(w)}>{WT[w]}</button>
            {/each}
          </span>
        </div>
      {/if}
    {:else if art === 'hinweise'}
      <label class="zeile"><span class="l"><span>Pausenregel<small>wenn im Regelzeitraum noch Pause fehlt</small></span></span><input type="checkbox" class="schalter" id="h-fenster" bind:checked={hinweise.pausenfenster.aktiv} /></label>
      {#if hinweise.pausenfenster.aktiv}<label class="zeile"><span class="l leise">ab</span><input class="feld" type="time" id="h-fenster-uhr" bind:value={hinweise.fensterUhr} /></label>{/if}
      <label class="zeile"><span class="l"><span>Pause fällig<small>nach langer Arbeit ohne Pause</small></span></span><input type="checkbox" class="schalter" id="h-pause" bind:checked={hinweise.pauseNach.aktiv} /></label>
      {#if hinweise.pauseNach.aktiv}<div class="zeile"><span class="l leise">nach</span><StundenEingabe id="h-pause-nach" bind:wert={hinweise.pauseNachText} /></div>{/if}
      <label class="zeile"><span class="l"><span>Arbeitsende<small>wenn noch nicht gegangen</small></span></span><input type="checkbox" class="schalter" id="h-ende" bind:checked={hinweise.arbeitsende.aktiv} /></label>
      {#if hinweise.arbeitsende.aktiv}<label class="zeile"><span class="l leise">um</span><input class="feld" type="time" id="h-ende-uhr" bind:value={hinweise.endeUhr} /></label>{/if}
      <label class="zeile"><span class="l"><span>Backup-Erinnerung<small>wenn das letzte Backup älter ist als</small></span></span><span class="w"><input class="feld zahl" type="number" inputmode="numeric" min="1" id="h-backup" bind:value={hinweise.backupNachTagen} /> Tage</span></label>
    {/if}

    {#if art !== 'sockel' && art !== 'hinweise'}
      <label class="zeile"><span class="l"><span>Gültig ab<small>vergangene Tage bleiben unverändert</small></span></span><input class="feld" type="date" id="es-ab" bind:value={ab} /></label>
    {/if}
  </div>

  {#if art === 'pausenregel'}<p class="hinweistext">Eine geänderte Regel gilt erst ab dem gewählten Datum. Zuschläge für frühere Tage bleiben, wie sie sind.</p>{/if}
  {#if art === 'sockel'}<p class="hinweistext">Der Sockel teilt das Zeitkonto nur optisch in „Sockel“ und „auszahlbar“. Der Saldo selbst ändert sich nicht.</p>{/if}
  {#if art === 'hinweise'}<p class="hinweistext">Hinweise erscheinen, solange die App geöffnet ist.</p>{/if}
  {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
  <button type="button" class="knopf haupt" onclick={sichern}>Sichern</button>
  <button type="button" class="knopf neben" onclick={schliessen}>Abbrechen</button>
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
  .zahl {
    width: 64px;
    text-align: right;
  }
  .tage {
    display: flex;
    gap: 4px;
  }
  .tag {
    width: 34px;
    height: 32px;
    border-radius: 8px;
    background: var(--fill);
    font-size: 13px;
    font-weight: 600;
    color: var(--label2);
  }
  .tag[aria-pressed='true'] {
    background: var(--night);
    color: var(--lemon);
  }
  .entfernen {
    color: var(--minus);
    font-weight: 600;
    font-size: 14px;
  }
  .fehler {
    margin: 0;
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
</style>
