# Haushaltsbuch

Eine kleine App für den eigenen Haushalt: tägliche **Einnahmen und Ausgaben** erfassen und für jeden Monat
und jedes Jahr sehen, was hereinkam und was ausgegeben wurde. Dazu kommen die **Überstunden**.

- läuft im Browser und lässt sich auf dem iPhone wie eine App installieren
- funktioniert auch ohne Internet
- **alle Daten bleiben auf deinem Gerät**: kein Server, keine Anmeldung, keine Kosten

**Adresse der App:** https://schule11.github.io/qwt45/

> Die App ist aus der Hundeschule-App (`Schule11/hundeschule`) entstanden und ist jetzt eine eigenständige App
> mit eigenem Speicher. Die beiden Apps sehen gegenseitig keine Daten (siehe unten „Getrennt von anderen Apps“).

---

## 1. App auf dem iPhone installieren

1. Die Adresse oben in **Safari** öffnen.
2. Auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben, bei neuem iOS erst auf „•••“).
3. **Zum Home-Bildschirm** wählen und dann **Hinzufügen**. Unter dem Symbol steht „Haushalt“.
4. Ab jetzt die App immer über das Symbol auf dem Home-Bildschirm öffnen.

> **Wichtig:** Die installierte App hat ihren **eigenen Speicher**, getrennt vom Safari-Tab.
> Trage alles nur in der installierten App ein.
>
> **Löschst du die App vom Home-Bildschirm, löscht das iPhone auch ihre Daten.**
> Mach deshalb vorher immer ein Backup (*Einstellungen → Backup erstellen*).

## 2. Backup

Deine Daten liegen nur auf dem Handy. *Einstellungen → Backup erstellen → Sichern …* und im Teilen-Menü
**In Dateien sichern → iCloud Drive** wählen. Die Datei heißt z. B. `haushaltsbuch-backup-2026-11-22.json`.
Einspielen: *Einstellungen → Backup einspielen*.

Backups der Hundeschule-App lassen sich hier nicht einspielen (und umgekehrt) – die App erkennt sie und sagt Bescheid.

## 3. Updates

Neue Versionen werden in dieses GitHub-Repository hochgeladen. Die App holt sie sich beim nächsten Öffnen
von selbst und zeigt kurz „App aktualisiert“ an. Deine Daten bleiben dabei erhalten.
Falls nichts passiert: die App im App-Umschalter wegwischen und neu öffnen.

## 4. Am Laptop lokal starten (optional)

Nur nötig, wenn du am Code etwas ausprobieren willst. Im Terminal im Projektordner:

```bash
python3 -m http.server 8000
```

Dann im Browser http://localhost:8000 öffnen. Beenden mit `Strg + C`.
(Ein Doppelklick auf `index.html` reicht nicht, weil Browser Offline-Modus und Datenbank nur über eine
Webadresse erlauben.)

---

## Für später: Aufbau des Codes

Reines HTML, CSS und JavaScript, ohne Build-Werkzeuge und ohne fremde Bibliotheken.

### Getrennt von anderen Apps

Alle Apps unter `schule11.github.io` laufen unter **derselben Web-Adresse (Origin)**. Der Browser gibt ihnen
deshalb denselben Speicher: dieselbe Datenbank (IndexedDB), dieselben Caches des Offline-Modus und denselben
`localStorage`. Damit sich die Apps nicht in die Quere kommen, trägt alles, was diese App speichert, die
Kennung **`haushaltsbuch`**:

| Was | Name in dieser App | Wo im Code |
|---|---|---|
| Datenbank (IndexedDB) | `haushaltsbuch` | `js/db.js` (aus `APP_ID` in `js/config.js`) |
| Caches (Offline-Modus) | `haushaltsbuch-<Version>` | `sw.js` (`PREFIX`) |
| localStorage / sessionStorage | `haushaltsbuch.theme`, `haushaltsbuch.lastType`, … | `storageKey()` in `js/config.js`, `index.html` |
| Backup-Datei | `"app": "haushaltsbuch"`, `haushaltsbuch-backup-….json` | `js/backup.js` |

Der Service Worker löscht beim Aktualisieren nur **eigene** alte Caches (`haushaltsbuch-…`). Aus dem Cache der
Hundeschule-App entfernt er einmalig nur die Dateien, die die erste Kopie dieser App dort unter ihrer eigenen
Adresse (`/qwt45/`) abgelegt hatte – die Dateien der Hundeschule-App bleiben unangetastet.

**Neue App aus dieser kopieren?** Dann `APP_ID` in `js/config.js`, `PREFIX` in `sw.js`, den Theme-Schlüssel in
`index.html` sowie Name und Beschreibung in `manifest.webmanifest` und `index.html` ändern.

**Repository umbenennen?** Dann ändert sich die Adresse der App (`…github.io/<neuer-name>/`). Vorher ein Backup
machen, die App unter der neuen Adresse neu zum Home-Bildschirm hinzufügen und das Backup dort einspielen.

### Versionen

**Bei jeder Änderung** die Versionsnummer in `js/config.js` (`APP_VERSION`) **und** `sw.js` (`VERSION`) erhöhen,
damit Handys die neue Version laden. Neue Dateien in die Liste in `sw.js` eintragen.
