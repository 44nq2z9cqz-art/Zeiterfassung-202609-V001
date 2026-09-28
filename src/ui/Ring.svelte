<script lang="ts">
  // Fortschrittsring wie die Aktivitätsringe der Apple Watch
  let { anteil, text }: { anteil: number; text: string } = $props();

  const UMFANG = 2 * Math.PI * 32;
  const strich = $derived(Math.max(0, Math.min(1, anteil)) * UMFANG);
</script>

<svg class="ring" viewBox="0 0 76 76" role="img" aria-label="{text} des Solls">
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
  <text x="38" y="42.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">{text}</text>
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
