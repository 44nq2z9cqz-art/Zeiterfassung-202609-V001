# Zeiterfassung – Konzept

**Version:** 1.0 · **Stand:** 28.09.2026
**Status:** Konzept vollständig abgestimmt

Dieses Dokument ist die verbindliche Grundlage für den Neuaufbau. Jede Regel, die hier steht,
wird später als automatischer Test umgesetzt. Was hier nicht steht, wird nicht gebaut.

Legende: ✅ entschieden · ❓ offen / Rückfrage · 💡 Vorschlag, bitte bestätigen

---

## A – Rahmen ✅

| # | Thema | Entscheidung |
|---|---|---|
| A1 | Nutzer | Nur eine Person. Keine Anmeldung, keine Benutzerverwaltung. |
| A2 | Gerät | iPhone 17, als App auf dem Home-Bildschirm. Das Layout ist für Handy-Hochformat optimiert (inkl. Dynamic Island und Home-Leiste). Am PC soll die App nur lesbar sein, sie wird dafür nicht optimiert. |
| A3 | Speicherort | Nur auf dem Gerät, keine Cloud-Synchronisierung. Die Sicherung läuft über Backup-Dateien, die in iCloud Drive abgelegt werden. |
| A4 | Feiertage | Nur Berlin, fest eingebaut. |

💡 **Backup:** Für die Sicherung soll das iOS-Teilen-Menü genutzt werden. Damit kann die Datei direkt in „Dateien → iCloud Drive“ gespeichert werden.
Beim Öffnen der App erscheint ein Hinweis, wenn das letzte Backup älter als X Tage ist (einstellbar).

---

## B – Fachlogik ✅

### B1 Sollarbeitszeit

Einmalig in den Einstellungen: **40 Stunden pro Woche, Montag bis Freitag, also 8:00 Stunden pro Tag.**

| Tag | Soll |
|---|---|
| Mo–Fr | 8:00 |
| Sa, So | 0:00 (Arbeit am Wochenende zählt voll als Plus, ohne Pausenregel) |
| Feiertag Berlin | 0:00 |
| 24.12. und 31.12., wenn Werktag | 4:00 (einstellbar, die Einstellung wirkt jetzt wirklich) |
| Manuelle Abweichung für einen einzelnen Tag | wie eingetragen |

- **Änderungen gelten ab einem Datum.** Wenn z. B. die Wochenstunden geändert werden, bekommt die neue Einstellung ein „gültig ab“.
  Vergangene Tage behalten ihre alte Sollzeit.
- **Ein vergangener Werktag ohne Eintrag** zählt wie ein Gleittag (−Soll) und wird im Kalender deutlich als
  „ohne Eintrag“ markiert. Der heutige Tag und zukünftige Tage sind davon nicht betroffen.

### B2 Pausenregel (Arbeitgebervorgabe)

Die Regel „Pausenfenster“ wurde am Monatsjournal August bestätigt (siehe G3). **Sie ist aktiv und gilt
rückwirkend für alle Daten ab dem Start der App (09.03.2026).** Die erfassten Pausen selbst bleiben unverändert.
Der Zuschlag wird zusätzlich und getrennt ausgewiesen.

**Sichtbarkeit der „Pausenzeitverletzung“ (Pflicht):**

- **Kalender:** Tage mit Zuschlag bekommen ein eigenes, deutlich erkennbares Symbol.
- **Tagesansicht:** Es erscheint eine eigene Zeile „Pausenzeitverletzung 11–14 Uhr: 21 von 30 Min → Zuschlag −0:09“.
- **Heute-Ansicht (live):** Während des Arbeitstages zeigt die App, wie viel Pause im Fenster noch fehlt, z. B. „Noch 9 Min Pause bis 14:00 nötig“.
  So lässt sich ein Zuschlag vermeiden.
- **Auswertungen:** Der Zuschlag steht in einer eigenen Spalte bzw. Zeile „Zuschlag Pausenzeitverletzung“, und die Monatssumme der Zuschläge wird ausgewiesen.
- **Zeitkonto:** Die Summe aller Zuschläge ist im Kontenverlauf nachvollziehbar.

| Einstellung | Standard |
|---|---|
| Regel aktiv | ja, ab 09.03.2026 |
| Gilt an Wochentagen | Mo–Fr (❓ Freitag unklar, per Einstellung abschaltbar) |
| Zeitfenster | 11:00–14:00 |
| Mindestpause im Fenster, gesamt | 30 Min |
| Davon mindestens eine Einzelpause von | 15 Min (❓ bisher nicht am Firmensystem bestätigt) |

- Alle Werte sind in den Einstellungen änderbar, jeweils mit „gültig ab“, und das Regelwerk ist so gebaut, dass später weitere Regeln hinzukommen können.

**Berechnung:**

1. Gezählt werden nur die Pausenminuten **innerhalb des Fensters**. Von einer Pause 13:50–14:20 zählen also 10 Minuten.
2. Die Regel greift nur, wenn die Anwesenheit das **gesamte Fenster abdeckt**, also Kommen vor 11:00 und Gehen nach 14:00.
   Sie gilt **nicht an Tagen mit Soll 0:00**, also Samstag, Sonntag und Feiertagen.
3. Fehlende Gesamtpause = 30 − Pause im Fenster
4. Fehlende Einzelpause = 15 − längste Einzelpause im Fenster
5. **Pausen-Zuschlag = der größere der beiden Werte** (mindestens 0). Er wird von der Arbeitszeit abgezogen.

| Gestempelte Pausen | Im Fenster | Längste | Zuschlag |
|---|---|---|---|
| 12:00–12:30 | 30 | 30 | 0 |
| 12:00–12:20 | 20 | 20 | 10 |
| 11:30–11:40, 13:00–13:10, 13:30–13:40 | 30 | 10 | 5 |
| 12:00–12:10, 13:00–13:05 | 15 | 10 | 15 |
| keine | 0 | 0 | 30 |
| 13:50–14:20 | 10 | 10 | 20 |

- **Gesetzliche Mindestpausen** (30 Minuten ab 6 Stunden, 45 Minuten ab 9 Stunden Arbeit): Sie erzeugen nur einen **Hinweis** und keinen Abzug. Ein Abzug lässt sich in den Einstellungen zuschalten.
- **Rundung:** Stempelzeiten werden auf volle Minuten abgeschnitten. Eine Pause dauert „Ende − Beginn“ in Minuten.
  Die Pausenlänge wird damit genauso berechnet wie die Arbeitszeit. Die bisherige zusätzliche Abrundung jeder einzelnen Pause entfällt (siehe G).

### B3 Zeitkonto

**Es gibt ein einziges Zeitkonto.**

> Saldo = Summe aller Tagesdifferenzen (Ist − Soll − Pausen-Zuschläge) + Summe aller Buchungen

Der Saldo darf negativ werden.

**Die Aufteilung ist rein optisch:** Der Sockel von 40 Stunden ist für flexible Arbeitszeit gedacht,
was darüber liegt, kann ausgezahlt werden. Der Sockelwert ist einstellbar.

| Saldo | „Sockel (flexibel)“ | „Auszahlbar“ |
|---|---|---|
| +52:00 | 40:00 / 40:00 | 12:00 |
| +25:30 | 25:30 / 40:00 | 0:00 |
| −3:00 | −3:00 / 40:00 | 0:00 |

**Anzeige:** Die Hauptzahl zeigt den **Stand Ende gestern**. Darunter steht klein „inkl. heute: …“ und läuft live mit.

**Buchungsarten:** Startsaldo / Übertrag (±), Auszahlung (−), Korrektur (±), jeweils mit Datum und Kommentar.

**Abgleich mit dem Firmensystem zum Stichtag:**
Du gibst ein Datum und den Saldo laut Firmensystem ein, z. B. „31.08.2026: +70:12“. Die App zeigt ihren eigenen Saldo zum selben Stichtag
und die Differenz. Nach deiner Bestätigung bucht sie automatisch eine **Korrekturbuchung „Abgleich Firmensystem“** über genau diese Differenz.
Ab diesem Stichtag stimmen beide Salden überein. Alle Abgleiche bleiben im Kontenverlauf sichtbar.

### B4 Urlaubskonto

- **Jahresanspruch:** 31 Tage. Er wird am 1.1. jedes Jahres automatisch gutgeschrieben (einstellbar, mit „gültig ab“).
- **Urlaub verfällt nicht.** Der Rest wird unbegrenzt ins Folgejahr übertragen.
- **Startsaldo:** Einmalig lassen sich Resttage aus Vorjahren erfassen.
- **Sonderurlaub:** Eine Buchung „+ X Tage“ mit Grund, z. B. „Jubiläum“.
- **Genommener Urlaub** wird automatisch aus dem Kalender ermittelt.
  - Nur Werktage (Mo–Fr) zählen. Wochenenden und Berliner Feiertage im Urlaubszeitraum werden nicht abgezogen.
  - Der **24.12. und 31.12.** zählen als **0,5 Tage**, wenn sie auf einen Werktag fallen. Andere halbe Urlaubstage gibt es nicht.
- Urlaub kann **im Voraus eingetragen** werden, auch als Zeitraum von bis. Er erscheint dann als „geplant“.

| Kachel | Bedeutung |
|---|---|
| Resturlaub | Anspruch gesamt − genommen − geplant |
| Genommen (laufendes Jahr) | Urlaubstage bis heute |
| Geplant | eingetragene Urlaubstage in der Zukunft |

Beispiel: Urlaub Mo 21.12.2026 – Mo 04.01.2027 ergibt Mo 21. (1) + Di 22. (1) + Mi 23. (1) + Do 24. (0,5) + Mo 28. (1) + Di 29. (1) + Mi 30. (1) + Do 31. (0,5) + Mo 04.01. (1) = **8 Tage**.
Nicht mitgezählt werden: Fr 25.12. (Feiertag), Sa/So 26./27.12., Fr 01.01. (Neujahr) und Sa/So 02./03.01.

### B5 Tagesarten

| Tagesart | Soll | Wirkung auf das Zeitkonto | Wirkung auf den Urlaub |
|---|---|---|---|
| Arbeitstag | 8:00 | Ist − Soll − Zuschlag Pausenzeitverletzung | – |
| Urlaub | erfüllt | 0 | −1 bzw. −0,5 Tag |
| Krank | erfüllt | 0 | – |
| Gleittag | 8:00 | −8:00 | – |
| Ohne Eintrag (vergangener Werktag) | 8:00 | −8:00, markiert | – |
| Feiertag (automatisch aus dem Kalender) | 0:00 | 0 | – |

Weitere Tagesarten werden derzeit nicht benötigt. Das Datenmodell lässt spätere Ergänzungen zu.
Die Tagesart „Feiertag“ lässt sich nicht mehr von Hand setzen, weil die Berliner Feiertage automatisch erkannt werden.

---

## C – Erfassung und Bedienung (Entwurf, siehe Artifact Version 3)

**Navigation:** Unten eine Tab-Leiste mit Heute, Kalender, Konten und Berichte. Die Einstellungen öffnen sich über das Zahnrad oben rechts.
Tag im Kalender antippen → Tag bearbeiten → jede Stempelung einzeln antippen → iOS-Zeitrad.

**Heute:** Jede Pause zeigt einen Haken, wenn sie mindestens 15 Minuten dauert (wie in der alten App).
Das Pausenfenster zeigt beide Bedingungen einzeln: „Eine Pause ab 15 Min“ und „30 Min im Fenster“, jeweils mit Haken, sobald sie erfüllt sind,
dazu die noch fehlenden Minuten.

**Tag bearbeiten:** Tagesart (Arbeit, Urlaub, Krank, Gleittag), alle Stempelungen der Reihe nach, Pause hinzufügen oder löschen,
Kommentar. Die Pausenzeitverletzung wird nach jeder Änderung sofort neu berechnet.

**Konten:** Zeitkonto und Urlaub stehen untereinander. Darunter lässt sich der Bereich „Buchungen“ aufklappen, mit einem Reiter für jedes Konto:
- Zeitkonto: Vortrag, Abgleich mit dem Firmensystem, Auszahlung, Korrektur
- Urlaub: Jahresanspruch (automatisch), Resturlaub Vorjahre, Sonderurlaub, Korrektur

Alle Buchungen lassen sich später ändern oder löschen.

**Einstellungen:** Arbeitszeit, Pausenregel (inkl. Schalter für Freitag), Sockel, Urlaubsanspruch, Backup sichern und wiederherstellen, Import aus der alten App.

- Die Zeiten werden als **echte Zeitstempel mit Datum** gespeichert. Damit ist Arbeit über Mitternacht möglich, und es gibt keine Zeitzonenfehler mehr.
- Die Stoppuhr erfasst Kommen, Pause Beginn, Pause Ende und Gehen. Jede Stempelung ist nachträglich einzeln bearbeitbar.
- 💡 **Schutz vor Doppeltipp:** Die Datensicherung enthält sechs „Pausen“ von 0 bis 1 Sekunde, die durch versehentliches Doppeltippen entstanden sind.
  Die neue App ignoriert Pausen unter X Sekunden oder fragt vorher nach.
- ✅ Die bisherige Verzögerungskorrektur beim Stempeln (±2 Sekunden) **entfällt**. Sie hat nicht wirklich zur Genauigkeit beigetragen.

## D – Auswertungen ✅ (siehe Artifact „Zeiterfassung Berichte“)

✅ **Jeder Bericht gibt es als PDF und als CSV.** Die Berichte werden im Reiter „Berichte“ erzeugt. Dort wählt man Tag, Woche, Monat oder Jahr,
dann den Zeitraum und den Bericht. Das PDF wird in der App erzeugt und über das iOS-Teilen-Menü weitergegeben (Dateien, Mail, AirDrop).

| Zeitraum | Bericht | Inhalt |
|---|---|---|
| Tag | **Tagesnachweis** | Nachweis für Homeoffice oder Termine außer Haus: Arbeitsort, Anlass, Buchungen im Kommen/Gehen-Format zum Nachtragen im Firmensystem, Anwesenheitsblöcke, Ist/Soll/Saldo, Prüfung der Pausenregel, Art der Erfassung und Änderungen, optional Unterschriftsfelder |
| Woche | Wochenübersicht | eine Zeile pro Tag, Wochensummen, Saldo Vorwoche → Saldo Ende |
| Monat | Monatsjournal kompakt | eine Zeile pro Tag: Beginn, Ende, Pausen, Ist, Soll, Zuschlag, Saldo Tag, Saldo laufend; Summen; Vortrag → Übertrag; Urlaub |
| Monat | Monatsjournal detailliert | wie das Firmensystem: alle Buchungen als K/G je Tag, Zuschläge mit Begründung |
| Monat/Jahr | Kontenverlauf | Zeitkonto und Urlaubskonto mit allen Buchungen |
| Jahr | Jahresübersicht | je Monat Anwesenheitstage, Ist, Soll, Zuschläge, Saldo, Urlaub; Zeitkonto- und Urlaubsbilanz |

💡 **Freier Zeitraum:** Als fünfte Auswahl neben Tag, Woche, Monat und Jahr lässt sich „Zeitraum“ mit Von und Bis wählen,
z. B. für ein Quartal oder die Wochen rund um einen Urlaub. Dafür gibt es dieselben Berichte wie beim Monat.

✅ **Format:** Alle PDFs im Format **A4 Hochformat**, wie das Monatsjournal des Firmensystems. Lange Berichte laufen über mehrere Seiten,
die Tabellenköpfe werden auf jeder Seite wiederholt, und im Fuß stehen Seitenzahl und Erstellungsdatum.

**Gestaltung PDF:** Night Shift auf Weiß, gut lesbar im Schwarz-Weiß-Druck. Eine Pausenzeitverletzung wird mit der Plakette „!“ markiert
und im Detailbericht mit Begründung erklärt.

**CSV:** Semikolon als Trennzeichen, UTF-8 mit BOM, damit Excel und Numbers die Datei direkt öffnen. Zeiten stehen doppelt drin, als h:mm und in Minuten.

**Zusätzliche Anforderungen aus dem Tagesnachweis (bestätigt):**
- ✅ **Arbeitsort je Tag:** Büro (Standard), Homeoffice, Außer Haus, dazu ein Feld „Anlass“, z. B. „Regional-Info-Tag“.
- ✅ **Änderungsprotokoll:** Jede Stempelung merkt sich, ob sie live gestempelt oder nachgetragen wurde, und jede spätere Änderung mit Zeitpunkt
  und altem Wert. Das macht den Nachweis belastbar.
- ✅ **Name und Personalnummer** in den Einstellungen, für den Kopf der Berichte.

## E – Design (in Abstimmung)

- ✅ **Heller Modus.**
- ✅ **Farbschema:** Night Shift `#10131A` und Laser Lemon `#EFFF4F` (Entwurf B). Grundfläche `#F4F5F0`, Listen weiß.
  Laser Lemon steht nur auf dunklen Flächen oder als Knopffarbe mit dunkler Schrift, weil Gelb auf Weiß nicht lesbar ist.
- ✅ **Stil:** elegant und nah an Apple (iOS 26). San Francisco als Schrift, große Titel, gruppierte Listen, runde Knöpfe, schwebende Tab-Leiste.
- 💡 **Pausenzeitverletzung ohne Fremdfarbe:** eine dunkle Plakette mit gelbem „!“ im Kalender, in der Tagesansicht und in den Konten.
  Die Zeitleiste für das Pausenfenster ist in Night Shift gehalten, die noch fehlende Pause wird schraffiert dargestellt.
- 💡 Grün und Rot nur gedämpft und nur für Plus- und Minuszahlen.
- Entwurf: Artifact „Zeiterfassung Farbwelten“ (Version 2)

## F – Technik ✅

**Grundlage**
- TypeScript und Vite, dazu Svelte als schlankes Oberflächen-Framework.
- **Die Rechenlogik ist ein eigener Kern ohne Oberfläche:** Soll, Pausenregel, Zeitkonto, Urlaub und Feiertage.
  Jede Regel und jedes Beispiel aus diesem Konzept wird ein automatischer Test (Vitest).
  Zusätzlich gibt es einen Test gegen die echte Datensicherung. Er läuft nur lokal, weil die Datei im Ordner privat/ liegt und nie hochgeladen wird.

**Offline und Updates**
- Die Programmdateien werden versioniert auf dem Gerät gespeichert (vite-plugin-pwa / Workbox). Die App startet damit auch im Flugmodus.
- Gibt es eine neue Version, erscheint der Hinweis „Neue Version verfügbar – Aktualisieren“. **Das Update startet erst nach dem Tippen**,
  damit nie mitten im Stempeln neu geladen wird. Die Versionsnummer steht in den Einstellungen.
- Die Daten bleiben bei jedem Update unberührt. Ändert sich das Datenschema, werden die Daten beim Start automatisch umgestellt,
  vorher legt die App eine Sicherheitskopie an.

**Daten**
- IndexedDB (eine Datenbank im Browser) über Dexie, mit Versionsnummer im Datenschema.
- Die App bittet iOS, den Speicher dauerhaft zu behalten („persistent storage“). Apps auf dem Home-Bildschirm sind von der automatischen Löschung durch Safari ausgenommen.
  Die Backup-Erinnerung bleibt trotzdem die wichtigste Absicherung.
- **Backup:** JSON-Datei mit Schema-Version, Speichern über das Teilen-Menü in iCloud Drive.
  Beim Wiederherstellen zeigt die App zuerst eine Vorschau und legt vor dem Überschreiben eine Sicherheitskopie an.

**PDF und CSV**
- Die PDFs werden direkt auf dem Gerät erzeugt (A4 Hochformat) und funktionieren damit auch offline. Die Weitergabe läuft über das Teilen-Menü.

**Veröffentlichung**
- GitHub Pages aus dem Repository `Zeiterfassung-202609-V001`. Die Adresse lautet voraussichtlich `https://44nq2z9cqz-art.github.io/Zeiterfassung-202609-V001/`.
- Eine GitHub Action baut die App bei jeder Änderung. **Sie veröffentlicht nur, wenn alle Tests grün sind.**
- Das Repository ist öffentlich: Der Code ist sichtbar, deine Daten nie. Sie liegen nur auf dem iPhone und in deinen Backups.
- Die neue App hat eine neue Adresse und wird als eigenes Symbol auf dem Home-Bildschirm installiert. Die alte App bleibt parallel nutzbar, bis du umsteigst.
  Die Daten kommen über die Backup-Datei hinüber.

✅ **F1 Erinnerungen nur bei geöffneter App.** Die App wird zu Arbeitsbeginn ohnehin gestartet. Es gibt keinen Server und keine Push-Nachrichten bei geschlossener App.
Solange die App geöffnet ist oder im Hintergrund noch läuft, erscheinen Hinweise, soweit iOS es zulässt als Systembenachrichtigung, sonst als Banner in der App.
Die Hinweise sind einzeln abschaltbar:
- Pausenfenster: z. B. um 13:30, wenn noch Pause im Fenster fehlt (Uhrzeit einstellbar)
- Pause: nach 5:15 Stunden ohne Pause (wie in der alten App)
- Arbeitsende: zur eingestellten Uhrzeit, wenn noch nicht gegangen
- Backup: beim Öffnen, wenn das letzte Backup älter als X Tage ist

✅ **F2 Keine Testversion.** Getestet wird in der echten App. Vor jedem Test legst du ein Backup an, und alle Buchungen lassen sich wieder löschen.

## H – Vorgehen beim Bau (Meilensteine)

Jeder Meilenstein endet mit einer lauffähigen Version, die du auf dem iPhone testest und abnimmst.

| # | Meilenstein | Ergebnis |
|---|---|---|
| M1 | Grundgerüst und Rechenkern | App installierbar und offline-fähig, Update-Hinweis, Rechenkern mit allen Tests, Import der alten Datensicherung mit Prüfbericht |
| M2 | Heute | Stempeln, Pausen, Pausenfenster live |
| M3 | Kalender und Korrektur | Monatsansicht, Tag bearbeiten, Pausen ändern, Tagesarten, Arbeitsort, Änderungsprotokoll |
| M4 | Konten | Zeitkonto, Urlaub, Buchungen, Abgleich mit dem Firmensystem |
| M5 | Berichte | alle Berichte als PDF und CSV |
| M6 | Einstellungen und Backup | alle Einstellungen, Backup und Wiederherstellung, Backup-Erinnerung |
| M7 | Feinschliff und Umstieg | Detailarbeit am Design, Abgleich mit dem Firmensystem, Umstieg von der alten App |

## G – Datenübernahme

**Quelle:** das Backup der alten App (Format „Zeiterfassung Pro“, Version 2.0.0).
Echte Daten werden **nie** ins öffentliche Repository hochgeladen (Sperre per `.gitignore`).
Der ausführliche Abgleich mit den echten Daten (Datensicherung, Monatsjournal des Firmensystems, Urlaubsantrag)
liegt nur lokal unter `privat/KONZEPT-vollstaendig.md`.

**Unterschiede zur alten App, die beim Import sichtbar werden:**

1. **Pausenrundung:** Die alte App hat jede Pause einzeln auf ganze Minuten abgerundet und damit die Arbeitszeit
   zu hoch gerechnet. Die neue App rechnet jede Pause als „Ende − Beginn“ in Minuten, genau wie die Arbeitszeit.
2. **Pausenzeitverletzungen:** Zuschläge aus der Pausenregel (B2) gelten rückwirkend ab dem Start der App
   und werden sichtbar ausgewiesen.
3. **Minusstunden** gehen nicht mehr verloren, und vergangene Werktage ohne Eintrag zählen −Soll.

**Import-Ablauf:**

1. Datei wählen.
2. Prüfbericht ansehen: Anzahl der Tage und Pausen, Saldo alt und neu, und woher die Differenz kommt
   (Pausenrundung, Pausenzeitverletzungen, Sonstiges).
3. Optional den Resturlaub aus Vorjahren eintragen, dann bestätigen. Vorhandene Daten werden ersetzt,
   vorher legt die App eine Sicherheitskopie an.

Alle Stempelungen werden **so übernommen, wie sie erfasst sind**. Die Zuschläge aus der Pausenregel werden getrennt davon berechnet und ausgewiesen.
Pausen unter einer Minute (versehentliches Doppeltippen) bleiben erhalten, wirken sich mit 0 Minuten nicht aus und werden im Prüfbericht aufgeführt.
Von Hand gesetzte „Feiertage“ der alten App entfallen, weil Feiertage jetzt automatisch erkannt werden.
Weicht das Firmensystem ab, wird die Differenz über den Abgleich zum Stichtag korrigiert (siehe B3).

✅ **G1 Vortrag Zeitkonto:** Das Zeitkonto hat beim Start der App nicht bei 0:00 begonnen. Der Vortragssaldo muss deshalb
**jederzeit nachträglich** als Buchung „Vortrag“ erfassbar und änderbar sein, mit Datum vor dem ersten Arbeitstag.
Bis dahin rechnet die App ab 0:00. Alternativ bringt ein Abgleich mit dem Firmensystem zum Stichtag beide Salden auf denselben Stand.

✅ **G2 Resturlaub:** Der Resturlaub aus Vorjahren wird beim Import als Buchung „Resturlaub Vorjahre“ zum 01.01. erfasst.
Urlaubstage aus der Zeit vor dem Start der App und bereits geplante Urlaube, die in der alten App fehlen,
werden nach dem Import im Kalender nachgetragen (ab M3).

### G3 Erkenntnisse aus dem Abgleich mit dem Firmensystem

- **Keine Rundung.** Die Ist-Zeit ist exakt die Summe der Anwesenheitsblöcke (Kommen bis Gehen) in ganzen Minuten.
  Damit ist die Rechenweise der neuen App (Minutenstempel, Pause = Ende − Beginn) richtig.
- **Die Pausenregel wird genau wie in B2 beschrieben angewendet** (bestätigt an einem Tag mit 21 von 30 Minuten
  im Fenster: 9 Minuten Abzug).
- **Kein Abzug, wenn das Fenster nicht vollständig abgedeckt ist** (Arbeitsbeginn nach 11 Uhr).
- **Samstagsarbeit** (Soll 0:00) wird voll als Plus gezählt.
- **Dienstgang:** Das Firmensystem zählt ihn als Arbeitszeit. Die App braucht dafür keine eigene Funktion,
  während eines Dienstgangs wird einfach keine Pause gestartet.
- Die Abweichungen zwischen App und Chip sind sehr klein (wenige Minuten im Monat).
- Die Urlaubsangaben im Firmenjournal sind nicht maßgeblich. Maßgeblich ist das Urlaubskonto der App.

---

## Offene Fragen – Übersicht

| Nr. | Frage |
|---|---|
| B2 | Gilt die Pausenregel auch freitags? Standard: ja, per Einstellung abschaltbar |
