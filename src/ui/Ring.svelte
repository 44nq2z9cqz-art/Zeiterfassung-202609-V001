<script lang="ts">
  // Fortschrittsring wie die Aktivitätsringe der Apple Watch: Bogen = Fortschritt zum Soll, Mitte = Tagessaldo
  let { anteil, text, beschreibung }: { anteil: number; text: string; beschreibung: string } = $props();

  const UMFANG = 2 * Math.PI * 32;
  const strich = $derived(Math.max(0, Math.min(1, anteil)) * UMFANG);
  // längere Werte wie „−10:00“ etwas kleiner, damit sie im Ring Platz haben
  const groesse = $derived(text.length > 5 ? 14 : 16);
</script>

<svg class="ring" viewBox="0 0 76 76" role="img" aria-label={beschreibung}>
  <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(239,255,79,.16)" stroke-width="9" />
  {#if strich > 0}
    <circle
      cx="38"
      cy="38"
      r="32"
      fill="none"
      stroke="var(--lemon)"
      stroke-width="9"
      stroke-linecap="round"
      stroke-dasharray="{strich} {UMFANG}"
      transform="rotate(-90 38 38)"
    />
  {/if}
  <text x="38" y="38" text-anchor="middle" dominant-baseline="central" fill="var(--lemon)" font-size={groesse} font-weight="700" class="num">{text}</text>
</svg>

<style>
  .ring {
    width: 84px;
    height: 84px;
    flex: none;
  }
  circle {
    transition: stroke-dasharray 0.6s ease;
  }
</style>
