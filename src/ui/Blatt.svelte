<script lang="ts">
  // Unteres Blatt wie bei iOS (für Zeiten, Zeiträume und Rückfragen)
  import type { Snippet } from 'svelte';

  let { titel, schliessen, children }: { titel: string; schliessen: () => void; children: Snippet } = $props();
</script>

<div class="abdunkeln" role="presentation" onclick={schliessen}></div>
<div class="blatt" role="dialog" aria-modal="true" aria-label={titel}>
  <div class="griff" aria-hidden="true"></div>
  <h2>{titel}</h2>
  {@render children()}
</div>

<style>
  .abdunkeln {
    position: fixed;
    inset: 0;
    background: rgba(16, 19, 26, 0.38);
    z-index: 40;
  }
  .blatt {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0;
    width: min(560px, 100%);
    max-height: 92vh;
    max-height: 92dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    background: var(--bg);
    border-radius: 26px 26px 0 0;
    padding: 8px 16px calc(var(--unten) + 16px);
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  /* Inhalte nie zusammenstauchen – ist das Blatt zu hoch, wird es scrollbar */
  .blatt > :global(*) {
    flex-shrink: 0;
  }
  .griff {
    width: 38px;
    height: 5px;
    border-radius: 3px;
    background: #c9cbc4;
    margin: 0 auto;
    flex: none;
  }
  h2 {
    margin: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
  }
</style>
