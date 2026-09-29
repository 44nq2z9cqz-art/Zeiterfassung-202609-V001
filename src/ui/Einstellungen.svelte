<script lang="ts">
  import { untrack } from 'svelte';
  import { tageSeitBackup } from '../core/backup';
  import { gueltigAm } from '../core/einstellungen';
  import { type Datum, datumDE, dauer, uhrzeit } from '../core/zeit';
  import { backupSichern } from '../lib/sichern';
  import { speicher } from '../lib/speicher.svelte';
  import { aktualisierung } from '../lib/update.svelte';
  import EinstellungBlatt, { type Art } from './EinstellungBlatt.svelte';
  import ImportAltApp from './ImportAltApp.svelte';
  import Wiederherstellen from './Wiederherstellen.svelte';

  let { schliessen, zuKonten, heute }: { schliessen: () => void; zuKonten: () => void; heute: Datum } = $props();

  let ansicht = $state<'haupt' | 'import' | 'wiederherstellen'>('haupt');
  let blatt = $state<Art | null>(null);
  let suche = $state<'bereit' | 'laeuft' | 'fertig'>('bereit');
  let backupStatus = $state<string | null>(null);

  const e = $derived(speicher.einstellungen);
  let name = $state(untrack(() => speicher.einstellungen.name));
  let personalnummer = $state(untrack(() => speicher.einstellungen.personalnummer));
  let genehmiger = $state(untrack(() => speicher.einstellungen.genehmiger ?? 'CHE'));
  async function personSichern() {
    const n = name.trim();
    const p = personalnummer.trim();
    const g = genehmiger.trim().toUpperCase() || 'CHE';
    genehmiger = g;
    if (n === e.name && p === e.personalnummer && g === (e.genehmiger ?? 'CHE')) return;
    await speicher.speichereEinstellungen({ ...e, name: n, personalnummer: p, genehmiger: g });
  }

  const regel = $derived(gueltigAm(e.pausenregel, heute));
  const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const tageText = $derived(regel.wochentage.map((w) => WT[w]).join(', '));
  const kurz = (m: number) => (m % 60 === 0 ? String(m / 60) : uhrzeit(m));
  const spaeter = <T,>(liste: { ab: Datum; wert: T }[]) => liste.find((g) => g.ab > heute);

  const seitBackup = $derived(tageSeitBackup(speicher.letztesBackup));
  const backupText = $derived(
    seitBackup === null ? 'noch nie' : seitBackup === 0 ? 'heute' : seitBackup === 1 ? 'gestern' : `vor ${seitBackup} Tagen`
  );
  const h = $derived(e.hinweise);
  const hinweisText = $derived(
    [h.pausenfenster.aktiv ? `Pausenregel ab ${uhrzeit(h.pausenfenster.uhrzeit)}` : '', h.pauseNach.aktiv ? `Pause nach ${dauer(h.pauseNach.minuten)} h` : '', h.arbeitsende.aktiv ? `Ende ${uhrzeit(h.arbeitsende.uhrzeit)}` : '']
      .filter(Boolean)
      .join(' · ') || 'aus'
  );

  async function sichern() {
    backupStatus = 'wird erstellt …';
    try {
      const r = await backupSichern();
      backupStatus = r === 'abgebrochen' ? null : 'gesichert';
    } catch (err) {
      backupStatus = `Fehler: ${err instanceof Error ? err.message : err}`;
    }
  }

  async function nachUpdateSuchen() {
    suche = 'laeuft';
    await aktualisierung.suchen();
    suche = 'fertig';
  }

  const build = new Date(__BUILD_ZEIT__).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
</script>

<div class="blatt" role="dialog" aria-modal="true" aria-label="Einstellungen">
  <div class="inhalt">
    {#if ansicht === 'import'}
      <ImportAltApp zurueck={() => (ansicht = 'haupt')} fertig={zuKonten} {heute} />
    {:else if ansicht === 'wiederherstellen'}
      <Wiederherstellen zurueck={() => (ansicht = 'haupt')} fertig={zuKonten} {heute} />
    {:else}
      <div class="leiste">
        <span></span>
        <span class="t">Einstellungen</span>
        <button type="button" class="fertig" onclick={schliessen}>Fertig</button>
      </div>

      <h2 class="abschnitt">Arbeitszeit</h2>
      <div class="gruppe">
        <button type="button" class="zeile" onclick={() => (blatt = 'wochenstunden')}>
          <span class="l"><span>Wochenstunden<small>Mo–Fr{spaeter(e.wochenstunden) ? ` · ab ${datumDE(spaeter(e.wochenstunden)!.ab)} ${dauer(spaeter(e.wochenstunden)!.wert)}` : ''}</small></span></span>
          <span class="w">{dauer(gueltigAm(e.wochenstunden, heute))} <span class="pfeil">›</span></span>
        </button>
        <button type="button" class="zeile" onclick={() => (blatt = 'halbtag')}>
          <span class="l">Soll 24.12. und 31.12.</span><span class="w">{dauer(gueltigAm(e.sollHalbtag, heute))} <span class="pfeil">›</span></span>
        </button>
      </div>

      <h2 class="abschnitt">Pausenregel</h2>
      <div class="gruppe">
        <button type="button" class="zeile" onclick={() => (blatt = 'pausenregel')}>
          <span class="l">
            <span>Pausenregel {kurz(regel.fensterBeginn)}–{kurz(regel.fensterEnde)} Uhr<small>{regel.aktiv ? `${regel.mindestGesamt} Min, davon eine ab ${regel.mindestEinzel} Min · ${tageText}` : 'ausgeschaltet'}{spaeter(e.pausenregel) ? ` · Änderung ab ${datumDE(spaeter(e.pausenregel)!.ab)}` : ''}</small></span>
          </span>
          <span class="w">{regel.aktiv ? 'aktiv' : 'aus'} <span class="pfeil">›</span></span>
        </button>
      </div>

      <h2 class="abschnitt">Konten</h2>
      <div class="gruppe">
        <button type="button" class="zeile" onclick={() => (blatt = 'sockel')}>
          <span class="l">Sockel Zeitkonto</span><span class="w">{dauer(e.sockel)} <span class="pfeil">›</span></span>
        </button>
        <button type="button" class="zeile" onclick={() => (blatt = 'urlaubsanspruch')}>
          <span class="l"><span>Urlaubsanspruch pro Jahr{#if spaeter(e.urlaubsanspruch)}<small>ab {datumDE(spaeter(e.urlaubsanspruch)!.ab)}: {spaeter(e.urlaubsanspruch)!.wert} Tage</small>{/if}</span></span>
          <span class="w">{gueltigAm(e.urlaubsanspruch, heute)} Tage <span class="pfeil">›</span></span>
        </button>
        <div class="zeile"><span class="l">Zeitkonto rechnet ab</span><span class="w">{datumDE(e.appStart)}</span></div>
      </div>

      <h2 class="abschnitt">Hinweise</h2>
      <div class="gruppe">
        <button type="button" class="zeile" onclick={() => (blatt = 'hinweise')}>
          <span class="l"><span>Hinweise bei geöffneter App<small>{hinweisText}</small></span></span><span class="pfeil">›</span>
        </button>
      </div>

      <h2 class="abschnitt">Daten</h2>
      <div class="gruppe">
        <button type="button" class="zeile aktion" onclick={sichern}>
          <span class="l"><span>Backup sichern<small>letztes Backup: {backupText}</small></span></span>
          <span class="w">{backupStatus ?? ''} <span class="pfeil">›</span></span>
        </button>
        <button type="button" class="zeile aktion" onclick={() => (ansicht = 'wiederherstellen')}>
          <span class="l">Backup wiederherstellen</span><span class="pfeil">›</span>
        </button>
        <button type="button" class="zeile aktion" onclick={() => (ansicht = 'import')}>
          <span class="l"><span>Daten der alten App importieren<small>Datensicherung „Zeiterfassung Pro“</small></span></span>
          <span class="pfeil">›</span>
        </button>
        <div class="zeile">
          <span class="l">Dauerhafter Speicher</span>
          <span class="w">{speicher.dauerhaft === true ? 'bestätigt' : speicher.dauerhaft === false ? 'nicht bestätigt' : 'unbekannt'}</span>
        </div>
      </div>
      <p class="hinweistext">Das Backup wird über das Teilen-Menü gesichert, am besten unter „In Dateien sichern“ → iCloud Drive.</p>

      <h2 class="abschnitt">Für Berichte</h2>
      <div class="gruppe">
        <label class="zeile"><span class="l">Name</span><input class="eingabe" id="e-name" autocomplete="name" placeholder="optional" bind:value={name} onblur={personSichern} /></label>
        <label class="zeile"><span class="l">Personalnummer</span><input class="eingabe" id="e-pnr" inputmode="numeric" placeholder="optional" bind:value={personalnummer} onblur={personSichern} /></label>
        <label class="zeile"><span class="l">Urlaub genehmigt von</span><input class="eingabe" id="e-genehmiger" maxlength="6" autocapitalize="characters" placeholder="Kürzel" bind:value={genehmiger} onblur={personSichern} /></label>
      </div>
      <p class="hinweistext">Name und Personalnummer erscheinen oben rechts auf jedem PDF-Bericht, das Kürzel bei genehmigten Urlaubsanträgen. Bleibt nur auf diesem Gerät.</p>

      <h2 class="abschnitt">App</h2>
      <div class="gruppe">
        <div class="zeile"><span class="l">Version</span><span class="w">{__APP_VERSION__} · {build}</span></div>
        <button type="button" class="zeile aktion" onclick={nachUpdateSuchen} disabled={suche === 'laeuft'}>
          <span class="l">Nach Update suchen</span>
          <span class="w">{suche === 'laeuft' ? 'sucht …' : suche === 'fertig' ? (aktualisierung.verfuegbar ? 'Update bereit' : 'aktuell') : ''}</span>
        </button>
        <div class="zeile"><span class="l">Offline nutzbar</span><span class="w">{aktualisierung.offlineBereit || navigator.serviceWorker?.controller ? 'ja' : 'wird eingerichtet'}</span></div>
        <div class="zeile"><span class="l">Gespeicherte Tage</span><span class="w">{speicher.tage.size}</span></div>
      </div>
    {/if}
  </div>
</div>

{#if blatt}
  <EinstellungBlatt art={blatt} {heute} schliessen={() => (blatt = null)} />
{/if}

<style>
  .blatt {
    position: fixed;
    inset: 0;
    z-index: 20;
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
    gap: 18px;
  }
  .leiste {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 40px;
  }
  .leiste .t {
    font-weight: 600;
    font-size: 17px;
  }
  .eingabe {
    flex: 1;
    min-width: 0;
    max-width: 60%;
    text-align: right;
    font: inherit;
    border: none;
    background: transparent;
    color: var(--label);
  }
  .fertig {
    justify-self: end;
    font-weight: 700;
    font-size: 17px;
  }
</style>
