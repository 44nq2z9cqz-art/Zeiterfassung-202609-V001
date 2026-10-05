// Haptisches Feedback auf dem iPhone. Safari kennt navigator.vibrate nicht; seit iOS 18 erzeugt aber das
// Umschalten eines Schalter-Elements (<input type="checkbox" switch>) einen leichten Tick der Systemhaptik.
// Diesen Effekt lösen wir mit einem unsichtbaren Schalter aus. Wo es nicht greift, passiert einfach nichts.

export type Haptikmuster = 'einfach' | 'doppel' | 'fehler';

const TICKS: Record<Haptikmuster, number> = { einfach: 1, doppel: 2, fehler: 3 };
const ABSTAND_MS = 110;

function tick() {
  try {
    // Android & Co.: echte Vibration, falls vorhanden
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
      return;
    }
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const schalter = document.createElement('input');
    schalter.type = 'checkbox';
    schalter.setAttribute('switch', '');
    label.appendChild(schalter);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Haptik ist nur eine Zugabe – Fehler hier dürfen nie das Stempeln stören
  }
}

/** Ein Muster aus kurzen Ticks; der erste kommt sofort (noch im Tipp-Ereignis). */
export function haptik(muster: Haptikmuster, aktiv = true) {
  if (!aktiv) return;
  for (let i = 0; i < TICKS[muster]; i++) {
    if (i === 0) tick();
    else setTimeout(tick, i * ABSTAND_MS);
  }
}
