# Zeiterfassung

Persönliche Arbeitszeiterfassung als Web-App für das iPhone: Stempeln mit Pausen, Zeitkonto mit Sockel,
Urlaubskonto, Pausenregel des Arbeitgebers und Berichte als PDF und CSV. Die App läuft offline und speichert
alle Daten nur auf dem Gerät.

**App:** https://44nq2z9cqz-art.github.io/Zeiterfassung-202609-V001/
(in Safari öffnen → Teilen → „Zum Home-Bildschirm“)

Alle fachlichen Regeln stehen in [docs/KONZEPT.md](docs/KONZEPT.md). Jede Regel dort ist durch Tests abgesichert.

## Stand

| Meilenstein | Inhalt | Stand |
|---|---|---|
| M1 | Grundgerüst, Rechenkern mit Tests, Import der alten App | ✅ |
| M2 | Heute: Stempeln, Pausen, Pausenfenster live | ✅ |
| M3 | Kalender und Korrekturen | ✅ |
| M4 | Konten und Buchungen | ✅ |
| M5 | Berichte als PDF und CSV | ✅ |
| M6 | Einstellungen und Backup | ✅ |
| M7 | Feinschliff und Umstieg | – |

## Entwicklung

```bash
npm install
npm run dev       # Entwicklungsserver
npm test          # Tests des Rechenkerns
npm run check     # Typprüfung
npm run build     # Produktionsversion in dist/
npm run icons     # App-Symbole neu erzeugen
```

Aufbau:

- `src/core/` – Rechenkern ohne Oberfläche: Zeit, Feiertage Berlin, Tagesbewertung und Pausenregel, Zeitkonto und Urlaub, Import der alten App
- `src/lib/` – Datenbank (IndexedDB), App-Zustand, Offline und Updates
- `src/ui/` – Oberfläche (Svelte)
- `tests/` – Tests; `tests/privat.test.ts` prüft zusätzlich gegen eine echte Datensicherung, wenn sie lokal unter `privat/` liegt

Persönliche Daten gehören nie ins Repository. Der Ordner `privat/` und Backup-Dateien sind per `.gitignore` gesperrt.

Jede Änderung auf `main` wird von GitHub Actions geprüft (Tests, Typprüfung, Build) und nur bei Erfolg auf GitHub Pages veröffentlicht.
