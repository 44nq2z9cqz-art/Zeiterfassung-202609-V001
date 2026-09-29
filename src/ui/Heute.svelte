<script lang="ts">
  import { onMount } from 'svelte';
  import { bewerteTag } from '../core/regeln';
  import {
    fortsetzen,
    gehen,
    kommen,
    laufenderTag,
    laufendePause,
    liveStand,
    pauseBeenden,
    pauseStarten,
    pausenbalken,
    regelHeute,
    type Zeitpunkt
  } from '../core/stempeln';
  import type { Tag } from '../core/modell';
  import { MONATE, WOCHENTAGE, type Datum, dauer, uhrzeit, wochentag, zerlege } from '../core/zeit';
  import { speicher } from '../lib/speicher.svelte';
  import { tageSeitBackup } from '../core/backup';
  import { backupSichern } from '../lib/sichern';
  import Ring from './Ring.svelte';
  import { symbole } from './symbole';
  import Titel from './Titel.svelte';

  let { oeffneEinstellungen }: { oeffneEinstellungen: () => void } = $props();

  let jetzt = $state(new Date());
  onMount(() => {
    const takt = setInterval(() => (jetzt = new Date()), 1000);
    return () => clearInterval(takt);
  });

  const lauf = $derived(laufenderTag(speicher.tage, jetzt));
  const tag = $derived(speicher.tage.get(lauf.datum));
  const e = $derived(speicher.einstellungen);
  const stand = $derived(liveStand(lauf.datum, tag, e, lauf.minute));
  const regel = $derived(regelHeute(lauf.datum, tag, e));
  const soll = $derived(bewerteTag(lauf.datum, tag, e, lauf.datum).soll);
  const pause = $derived(laufendePause(tag));
  const art = $derived(tag?.art ?? 'arbeit');
  const beendet = $derived(tag?.gehen !== null && tag?.gehen !== undefined);
  const begonnen = $derived(tag?.kommen !== null && tag?.kommen !== undefined);
  const feiertag = $derived(bewerteTag(lauf.datum, undefined, e, lauf.datum).feiertag);

  const untertitel = $derived.by(() => {
    const [, m, t] = zerlege(lauf.datum);
    const text = `${WOCHENTAGE[wochentag(lauf.datum)]}, ${t}. ${MONATE[m - 1]}`;
    if (lauf.minute >= 1440) return `${text} · über Mitternacht`;
    if (feiertag) return `${text} · ${feiertag}`;
    return text;
  });

  // Pausen mit Live-Ende für die Anzeige
  const pausenListe = $derived(
    (tag?.pausen ?? []).map((p) => ({ ...p, bis: p.ende ?? lauf.minute })).sort((a, b) => b.beginn - a.beginn)
  );
  const einzelMin = $derived(regel?.mindestEinzel ?? 15);
  const imFenster = (b: number, en: number) => !!regel && Math.min(en, regel.fensterEnde) > Math.max(b, regel.fensterBeginn);

  const pauseSekunden = $derived(pause?.gestartetAm ? Math.max(0, Math.floor((jetzt.getTime() - Date.parse(pause.gestartetAm)) / 1000)) : null);
  const kurz = (m: number) => (m % 60 === 0 ? String(m / 60) : uhrzeit(m));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Zeitbalken der Pausenregel
  const fenster = $derived(stand?.fenster ?? null);
  const balken = $derived(regel ? pausenbalken(tag, regel, lauf.minute) : []);
  const fensterLaenge = $derived(regel ? regel.fensterEnde - regel.fensterBeginn : 1);
  const pos = (m: number) => (regel ? Math.max(0, Math.min(100, ((m - regel.fensterBeginn) / fensterLaenge) * 100)) : 0);
  const fensterVorbei = $derived(!!regel && begonnen && (beendet || lauf.minute >= regel.fensterEnde));
  const fehlend = $derived(fenster ? Math.max(fenster.fehlendGesamt, fenster.fehlendEinzel) : regel ? regel.mindestGesamt : 0);
  const greiftNicht = $derived(!!regel && begonnen && tag!.kommen! > regel.fensterBeginn);

  const hinweisFenster = $derived(
    !!regel && begonnen && !beendet && !pause && !greiftNicht && e.hinweise.pausenfenster.aktiv &&
      lauf.minute >= e.hinweise.pausenfenster.uhrzeit && lauf.minute < regel.fensterEnde && fehlend > 0
  );
  const hinweisPause = $derived(!!stand && e.hinweise.pauseNach.aktiv && stand.ohnePause >= e.hinweise.pauseNach.minuten);
  const hinweisEnde = $derived(begonnen && !beendet && e.hinweise.arbeitsende.aktiv && lauf.minute >= e.hinweise.arbeitsende.uhrzeit);

  // Backup-Erinnerung (Konzept A3)
  const seitBackup = $derived(tageSeitBackup(speicher.letztesBackup, jetzt));
  const backupFaellig = $derived(speicher.hatDaten && (seitBackup === null || seitBackup >= e.hinweise.backupNachTagen));
  let backupLaeuft = $state(false);
  async function jetztSichern() {
    backupLaeuft = true;
    try {
      const r = await backupSichern();
      if (r !== 'abgebrochen') zeige('Backup gesichert');
    } catch (err) {
      zeige(`Backup nicht gesichert: ${err instanceof Error ? err.message : err}`);
    } finally {
      backupLaeuft = false;
    }
  }

  // ─── Aktionen ────────────────────────────────────────────────────────────
  let beschaeftigt = $state(false);
  let gehenFragen = $state(false);
  let meldung = $state<string | null>(null);
  let meldungTimer: ReturnType<typeof setTimeout> | undefined;

  function zeige(text: string) {
    meldung = text;
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(() => (meldung = null), 4000);
  }

  function zeitpunkt(): Zeitpunkt {
    const d = new Date();
    const l = laufenderTag(speicher.tage, d);
    return { datum: l.datum, minute: l.minute, iso: d.toISOString() };
  }

  async function ausfuehren(aktion: (z: Zeitpunkt, t: Tag | undefined) => { tag: Tag; text: string } | null) {
    if (beschaeftigt) return; // Schutz vor Doppeltippen
    beschaeftigt = true;
    try {
      const z = zeitpunkt();
      const ergebnis = aktion(z, speicher.tage.get(z.datum));
      if (ergebnis) {
        await speicher.speichereTag(ergebnis.tag);
        zeige(ergebnis.text);
      }
    } catch (err) {
      zeige(`Nicht gespeichert: ${err instanceof Error ? err.message : err}`);
    } finally {
      setTimeout(() => (beschaeftigt = false), 700);
    }
  }

  const aufKommen = () => ausfuehren((z, t) => ({ tag: kommen(t, z), text: `Kommen ${uhrzeit(z.minute)} gestempelt` }));
  const aufPauseStart = () => ausfuehren((z, t) => (t ? { tag: pauseStarten(t, z), text: `Pause seit ${uhrzeit(z.minute)}` } : null));
  const aufPauseEnde = () =>
    ausfuehren((z, t) => {
      if (!t) return null;
      const r = pauseBeenden(t, z);
      return { tag: r.tag, text: r.verworfen ? 'Pause unter 1 Minute verworfen' : `Pause beendet ${uhrzeit(z.minute)}` };
    });
  const aufGehen = () => {
    gehenFragen = false;
    ausfuehren((z, t) => (t ? { tag: gehen(t, z), text: `Gehen ${uhrzeit(z.minute)} gestempelt` } : null));
  };
  const aufFortsetzen = () => ausfuehren((z, t) => (t ? { tag: fortsetzen(t, z), text: 'Arbeitstag läuft weiter' } : null));

  const ARTEN: Record<string, string> = { urlaub: 'Urlaub', krank: 'Krank', gleittag: 'Gleittag' };
</script>

<Titel titel="Heute" unter={untertitel} {oeffneEinstellungen} />

{#if backupFaellig}
  <div class="hinweis backup" role="status">
    <span>
      <b>Backup fällig.</b>
      {seitBackup === null ? 'Es wurde noch kein Backup gesichert.' : `Das letzte Backup ist ${seitBackup} Tage alt.`}
    </span>
    <button type="button" class="knopf haupt klein" disabled={backupLaeuft} onclick={jetztSichern}>Sichern</button>
  </div>
{/if}

{#if art !== 'arbeit'}
  <div class="gruppe karte">
    <span class="marke">{ARTEN[art]}</span>
    <p>Heute ist als {ARTEN[art]} eingetragen, deshalb wird nicht gestempelt. Ändern lässt sich das im Kalender.</p>
  </div>
{:else}
  {#if hinweisFenster || hinweisPause || hinweisEnde}
    <div class="hinweis" role="status">
      <span class="plakette">!</span>
      <span>
        {#if hinweisFenster}Noch <b>{fehlend} Min</b> Pause bis {uhrzeit(regel!.fensterEnde)} nötig, sonst Zuschlag.<br />{/if}
        {#if hinweisPause}Seit <b>{dauer(stand!.ohnePause)} Std.</b> ohne Pause.<br />{/if}
        {#if hinweisEnde}Es ist nach {uhrzeit(e.hinweise.arbeitsende.uhrzeit)} – Gehen stempeln?{/if}
      </span>
    </div>
  {/if}

  <section class="kachel held" aria-label="Arbeitszeit heute">
    <div class="text">
      <span class="etikett">Arbeitszeit</span>
      <span class="gross num">{dauer(stand?.ist ?? 0)}</span>
      {#if !begonnen}
        <span class="unter">Soll <b>{dauer(soll)}</b>{soll === 0 ? ' · freier Tag' : ''}</span>
      {:else}
        <span class="unter">Kommen <b>{uhrzeit(tag!.kommen!)}</b>{beendet ? ' · Gehen ' : ''}{#if beendet}<b>{uhrzeit(tag!.gehen!)}</b>{/if}</span>
        <span class="unter">
          {#if soll > 0 && stand!.ist < soll && !beendet}noch <b>{dauer(soll - stand!.ist)}</b> bis Soll {dauer(soll)}
          {:else}Saldo <b class:plus-hell={stand!.saldo > 0}>{dauer(stand!.saldo, true)}</b>{/if}
        </span>
      {/if}
    </div>
    {#if soll > 0}
      <Ring anteil={(stand?.ist ?? 0) / soll} text={`${Math.round(((stand?.ist ?? 0) / soll) * 100)} %`} />
    {/if}
  </section>

  {#if regel}
    <section class="gruppe" aria-label="Pausenregel">
      <div class="fenster">
        <div class="kopf">
          <b>Pausenregel {kurz(regel.fensterBeginn)}–{kurz(regel.fensterEnde)} Uhr</b>
          <span>{fenster?.imFenster ?? 0} von {regel.mindestGesamt} Min</span>
        </div>
        <div class="balken-wrap" role="img" aria-label="Zeitbalken: gearbeitet, Pausen ab {regel.mindestEinzel} Minuten und kürzere Pausen">
          <div class="leiste">
            {#each balken as s (s.von)}
              <div class={s.art} style="left:{pos(s.von)}%;width:{pos(s.bis) - pos(s.von)}%"></div>
            {/each}
          </div>
          {#if !beendet && lauf.minute > regel.fensterBeginn && lauf.minute < regel.fensterEnde}
            <div class="jetzt" style="left:{pos(lauf.minute)}%"></div>
          {/if}
        </div>
        <div class="skala"><span>{uhrzeit(regel.fensterBeginn)}</span><span>{uhrzeit(regel.fensterBeginn + 60)}</span><span>{uhrzeit(regel.fensterBeginn + 120)}</span><span>{uhrzeit(regel.fensterEnde)}</span></div>
        <div class="bedingungen">
          <span>{@html (fenster?.fehlendEinzel ?? regel.mindestEinzel) === 0 ? `<span class="ok">${symbole.haken}</span>` : '<span class="offen"></span>'}Pause ab {regel.mindestEinzel} Min</span>
          <span>
            {@html (fenster?.fehlendGesamt ?? regel.mindestGesamt) === 0 ? `<span class="ok">${symbole.haken}</span>` : '<span class="offen"></span>'}{regel.mindestGesamt} Min
            {#if (fenster?.fehlendGesamt ?? regel.mindestGesamt) > 0}· <b>{fensterVorbei ? `${fenster?.fehlendGesamt} Min fehlen` : `noch ${fenster?.fehlendGesamt ?? regel.mindestGesamt} Min`}</b>{/if}
          </span>
        </div>
      </div>
      {#if greiftNicht}
        <div class="zeile"><span class="l leise">Heute greift die Regel nicht, weil nach {uhrzeit(regel.fensterBeginn)} gekommen.</span></div>
      {:else if fensterVorbei && fenster && fenster.greift && fenster.zuschlag > 0}
        <div class="zeile"><span class="l"><span class="plakette">!</span>Pausenzeitverletzung</span><span class="w stark">{dauer(-fenster.zuschlag, true)}</span></div>
      {/if}
    </section>
  {/if}

  {#if pausenListe.length}
    <h2 class="abschnitt">Pausen heute · neueste oben</h2>
    <section class="gruppe" aria-label="Pausen heute">
      {#each pausenListe as p (p.id)}
        <div class="zeile">
          <span class="l">
            {@html p.bis - p.beginn >= einzelMin ? `<span class="ok">${symbole.haken}</span>` : '<span class="offen"></span>'}
            {#if p.ende === null}seit {uhrzeit(p.beginn)}{:else}{uhrzeit(p.beginn)} – {uhrzeit(p.ende)}{/if}
            {#if imFenster(p.beginn, p.bis)}<span class="etikette">Regel</span>{/if}
          </span>
          <span class="w" class:stark={p.ende === null}>
            {#if p.ende === null && pauseSekunden !== null}{mmss(pauseSekunden)} Min{:else}{p.bis - p.beginn} Min{/if}
          </span>
        </div>
      {/each}
      <div class="zeile"><span class="l leise">Gesamt</span><span class="w stark">{dauer(stand?.pausen ?? 0)}</span></div>
    </section>
  {/if}

  <div class="knoepfe" class:einzeln={!begonnen || beendet}>
    {#if !begonnen}
      <button type="button" class="knopf haupt gross-knopf" disabled={beschaeftigt} onclick={aufKommen}>Kommen</button>
    {:else if beendet}
      <button type="button" class="knopf neben" disabled={beschaeftigt} onclick={aufFortsetzen}>Arbeitstag fortsetzen</button>
    {:else}
      {#if pause}
        <button type="button" class="knopf haupt" disabled={beschaeftigt} onclick={aufPauseEnde}>Pause beenden</button>
      {:else}
        <button type="button" class="knopf haupt" disabled={beschaeftigt} onclick={aufPauseStart}>Pause starten</button>
      {/if}
      <button type="button" class="knopf neben" disabled={beschaeftigt} onclick={() => (gehenFragen = true)}>Gehen</button>
    {/if}
  </div>
{/if}

{#if meldung}
  <div class="meldung" role="status">{meldung}</div>
{/if}

{#if gehenFragen}
  <div class="abdunkeln" role="presentation" onclick={() => (gehenFragen = false)}></div>
  <div class="frage" role="dialog" aria-modal="true" aria-label="Arbeitstag beenden">
    <p><b>Arbeitstag beenden?</b><br />Gehen um {uhrzeit(lauf.minute)} stempeln{pause ? ', die laufende Pause wird beendet' : ''}.</p>
    <button type="button" class="knopf haupt" onclick={aufGehen}>Gehen</button>
    <button type="button" class="knopf neben" onclick={() => (gehenFragen = false)}>Abbrechen</button>
  </div>
{/if}

<style>
  .karte {
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .karte p {
    margin: 0;
    line-height: 1.45;
    color: var(--label2);
  }
  .marke {
    background: var(--night);
    color: var(--lemon);
    font-weight: 700;
    font-size: 13px;
    border-radius: 7px;
    padding: 3px 8px;
  }
  .hinweis {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    background: var(--group);
    border-radius: 14px;
    padding: 12px 16px;
    font-size: 15px;
    line-height: 1.4;
  }
  .hinweis.backup {
    align-items: center;
    justify-content: space-between;
  }
  .knopf.klein {
    width: auto;
    padding: 9px 16px;
    font-size: 15px;
    flex: none;
  }
  .hinweis .plakette {
    margin-top: 1px;
  }
  .held {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  .held .text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .plus-hell {
    color: var(--lemon) !important;
  }
  .fenster {
    padding: 14px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .kopf b {
    font-weight: 600;
  }
  .kopf span {
    color: var(--label2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .balken-wrap {
    position: relative;
  }
  .leiste {
    position: relative;
    height: 14px;
    border-radius: 99px;
    background: var(--fill);
    overflow: hidden;
    /* feine Kontur, damit Lemon auf Hell sichtbar bleibt */
    box-shadow: inset 0 0 0 1px rgba(16, 19, 26, 0.12);
  }
  .leiste > div {
    position: absolute;
    top: 0;
    bottom: 0;
  }
  .leiste .arbeit {
    background: var(--lemon);
    box-shadow: inset 0 1px 0 rgba(16, 19, 26, 0.12), inset 0 -1px 0 rgba(16, 19, 26, 0.12);
  }
  .leiste .pause {
    background: var(--night);
  }
  .leiste .kurz {
    background: repeating-linear-gradient(135deg, var(--night) 0 2px, #fff 2px 5px);
  }
  .jetzt {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--night);
  }
  .bedingungen {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    padding-top: 2px;
  }
  .bedingungen > span {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .bedingungen b {
    font-weight: 600;
  }
  .skala {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--label3);
    font-variant-numeric: tabular-nums;
  }
  :global(.ok) {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--night);
    color: var(--lemon);
    display: inline-grid;
    place-items: center;
    flex: none;
  }
  :global(.ok svg) {
    width: 13px;
    height: 13px;
  }
  :global(.offen) {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--label3);
    flex: none;
  }
  .etikette {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    background: var(--fill);
    color: var(--label2);
    border-radius: 5px;
    padding: 2px 6px;
  }
  /* Knöpfe bleiben über der Tab-Leiste sichtbar */
  .knoepfe {
    position: sticky;
    bottom: calc(var(--unten) + 84px);
    z-index: 5;
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 10px;
    margin-top: 4px;
    padding-top: 14px;
    background: linear-gradient(to bottom, rgba(244, 245, 240, 0), var(--bg) 14px);
  }
  .knoepfe.einzeln {
    grid-template-columns: 1fr;
  }
  .gross-knopf {
    padding: 19px 12px;
    font-size: 19px;
  }
  .meldung {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: calc(var(--oben) + 10px);
    background: var(--night);
    color: #fff;
    border-radius: 999px;
    padding: 10px 18px;
    font-weight: 600;
    font-size: 15px;
    z-index: 55; /* über dem Statusstreifen */
    white-space: nowrap;
    box-shadow: 0 10px 28px -12px rgba(16, 19, 26, 0.5);
  }
  .abdunkeln {
    position: fixed;
    inset: 0;
    background: rgba(16, 19, 26, 0.38);
    z-index: 25;
  }
  .frage {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--unten) + 12px);
    width: min(528px, calc(100% - 24px));
    background: var(--bg);
    border-radius: 24px;
    padding: 18px 16px 16px;
    z-index: 26;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .frage p {
    margin: 0 0 4px;
    text-align: center;
    line-height: 1.45;
    color: var(--label2);
  }
  .frage p b {
    color: var(--label);
    font-size: 17px;
  }
</style>
