// Offline-Betrieb und Update-Hinweis (Konzept F). Das Update startet erst nach Tippen.
import { registerSW } from 'virtual:pwa-register';

class Aktualisierung {
  verfuegbar = $state(false);
  offlineBereit = $state(false);
  private ausfuehren: ((neuLaden?: boolean) => Promise<void>) | null = null;
  private registrierung: ServiceWorkerRegistration | undefined;

  starten() {
    if (!('serviceWorker' in navigator)) return;
    this.ausfuehren = registerSW({
      onNeedRefresh: () => (this.verfuegbar = true),
      onOfflineReady: () => (this.offlineBereit = true),
      onRegisteredSW: (_url, registrierung) => {
        this.registrierung = registrierung;
        // Beim Zurückkehren in die App nach neuen Versionen sehen
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.suchen();
        });
      }
    });
  }

  async suchen() {
    try {
      await this.registrierung?.update();
    } catch {
      // offline – kein Problem
    }
  }

  async jetztAktualisieren() {
    await this.ausfuehren?.(true);
  }
}

export const aktualisierung = new Aktualisierung();
