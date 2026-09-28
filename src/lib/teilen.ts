// Datei über das iOS-Teilen-Menü weitergeben (Dateien/iCloud Drive, Mail, AirDrop).
// Wo das nicht geht (z. B. am PC), wird die Datei heruntergeladen.
export async function teileDatei(inhalt: Blob, dateiname: string): Promise<'geteilt' | 'abgebrochen' | 'geladen'> {
  const datei = new File([inhalt], dateiname, { type: inhalt.type });
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: dateiname });
      return 'geteilt';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'abgebrochen';
      // sonst: auf Herunterladen ausweichen
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'geladen';
}
