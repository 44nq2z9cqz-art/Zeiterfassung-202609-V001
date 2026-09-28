<script lang="ts">
  import { untrack } from 'svelte';
  import { zeitraumSetzen } from '../core/bearbeiten';
  import { WOCHENTAGE_KURZ, type Datum, datumDE, wochentag } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import Blatt from './Blatt.svelte';

  let { schliessen, vorschlag }: { schliessen: () => void; vorschlag: Datum } = $props();

  type Art = 'urlaub' | 'krank' | 'entfernen';
  let art = $state<Art>('urlaub');
  // Startwert aus dem gewählten Kalendertag, danach frei änderbar
  let von = $state(untrack(() => vorschlag));
  let bis = $state(untrack(() => vorschlag));
  let fertig = $state<string | null>(null);

  // „Bis“ folgt „Von“: Ein neuer Beginn setzt das Ende mit, wenn es davor liegt oder bisher gleich war
  let letztesVon = untrack(() => vorschlag);
  $effect(() => {
    const v = von;
    untrack(() => {
      if (v && (!bis || bis < v || bis === letztesVon)) bis = v;
      letztesVon = v;
    });
  });

  const gueltig = $derived(!!von && !!bis && von <= bis);
  const vorschau = $derived(gueltig ? zeitraumSetzen(speicher.tage, von, bis, art, '') : null);
  const anzahl = $derived(vorschau ? (art === 'entfernen' ? vorschau.geaendert.length + vorschau.geloescht.length : vorschau.geaendert.length) : 0);
  const wort = $derived(art === 'krank' ? (anzahl === 1 ? 'Krankheitstag' : 'Krankheitstage') : anzahl === 1 ? 'Urlaubstag' : 'Urlaubstage');
  const lang = (d: Datum) => `${WOCHENTAGE_KURZ[wochentag(d)]} ${datumDE(d)}`;
  const kurzListe = (liste: Datum[]) => (liste.length <= 3 ? liste.map(datumDE).join(', ') : `${liste.slice(0, 3).map(datumDE).join(', ')} und ${liste.length - 3} weitere`);

  async function sichern() {
    const echt = zeitraumSetzen(speicher.tage, von, bis, art, new Date().toISOString());
    if (echt.geaendert.length) await speicher.speichereTage(echt.geaendert);
    if (echt.geloescht.length) await speicher.loescheTage(echt.geloescht);
    const n = echt.geaendert.length + echt.geloescht.length;
    fertig =
      art === 'entfernen'
        ? `Bei ${n} ${n === 1 ? 'Tag' : 'Tagen'} wurde Urlaub bzw. Krankheit entfernt.`
        : `${n} ${n === 1 ? 'Tag' : 'Tage'} als ${art === 'urlaub' ? 'Urlaub' : 'Krank'} eingetragen (${datumDE(von)} – ${datumDE(bis)}).`;
  }
</script>

<Blatt titel="Zeitraum" {schliessen}>
  {#if fertig}
    <p class="hinweistext mitte">{fertig}</p>
    <button type="button" class="knopf haupt" onclick={schliessen}>Fertig</button>
  {:else}
    <div class="segmente">
      <button type="button" aria-pressed={art === 'urlaub'} onclick={() => (art = 'urlaub')}>Urlaub</button>
      <button type="button" aria-pressed={art === 'krank'} onclick={() => (art = 'krank')}>Krank</button>
      <button type="button" aria-pressed={art === 'entfernen'} onclick={() => (art = 'entfernen')}>Entfernen</button>
    </div>
    <div class="gruppe">
      <label class="zeile"><span class="l">Von</span><input class="datum" type="date" id="zr-von" bind:value={von} /></label>
      <label class="zeile"><span class="l">Bis</span><input class="datum" type="date" id="zr-bis" bind:value={bis} min={von} /></label>
    </div>

    {#if !gueltig}
      <p class="fehler" role="alert">Das Enddatum muss am oder nach dem Beginn liegen.</p>
    {:else if vorschau}
      <div class="gruppe">
        <div class="zeile"><span class="l">Zeitraum</span><span class="w">{von === bis ? lang(von) : `${lang(von)} – ${lang(bis)}`}</span></div>
        {#if art === 'entfernen'}
          <div class="zeile"><span class="l"><b>Urlaub/Krank entfernen</b></span><span class="w stark">{anzahl} {anzahl === 1 ? 'Tag' : 'Tage'}</span></div>
          <p class="hinweistext innen">Die Tage werden wieder zu normalen Tagen. Gestempelte Zeiten bleiben erhalten.</p>
        {:else}
          <div class="zeile"><span class="l"><b>Wird eingetragen</b></span><span class="w stark">{anzahl} {wort}</span></div>
          {#if vorschau.bereits}<div class="zeile"><span class="l leise">Schon eingetragen</span><span class="w">{vorschau.bereits}</span></div>{/if}
          {#if vorschau.frei}<div class="zeile"><span class="l leise">Wochenenden/Feiertage, zählen nicht</span><span class="w">{vorschau.frei}</span></div>{/if}
          {#if vorschau.uebersprungen.length}
            <div class="zeile"><span class="l leise"><span>Mit Arbeitszeit, bleiben unverändert<small>{kurzListe(vorschau.uebersprungen)}</small></span></span><span class="w">{vorschau.uebersprungen.length}</span></div>
          {/if}
        {/if}
      </div>
      {#if anzahl > 25 && art !== 'entfernen'}
        <p class="warnung" role="alert">Das sind ungewöhnlich viele Tage. Bitte prüfe Von und Bis.</p>
      {/if}
    {/if}

    <button type="button" class="knopf haupt" disabled={!gueltig || anzahl === 0} onclick={sichern}>
      {art === 'entfernen' ? 'Entfernen' : 'Eintragen'}
    </button>
    <button type="button" class="knopf neben" onclick={schliessen}>Abbrechen</button>
  {/if}
</Blatt>

<style>
  .datum {
    font: inherit;
    font-weight: 600;
    border: none;
    background: var(--fill);
    border-radius: 8px;
    padding: 6px 10px;
    color: var(--label);
  }
  .mitte {
    text-align: center;
  }
  .innen {
    padding: 4px 16px 12px;
  }
  .fehler {
    margin: 0;
    color: var(--minus);
    padding: 0 16px;
    font-size: 14px;
  }
  .warnung {
    margin: 0;
    background: var(--group);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--minus);
  }
</style>
