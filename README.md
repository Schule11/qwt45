# Haushaltsbuch

Eine kleine App für den eigenen Haushalt mit zwei Aufgaben:

1. **Einnahmen und Ausgaben** des Alltags erfassen – und für jeden Monat und jedes Jahr sehen,
   was hereinkam, was ausgegeben wurde und wohin das Geld ging.
2. **Überstunden** im Blick behalten: Je Monat trägst du die tatsächlich gearbeiteten und die ausbezahlten
   Stunden ein, die App zeigt dir jederzeit, wie viele Überstunden du noch hast.

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
> Mach deshalb vorher immer ein Backup (Abschnitt 4).

## 2. Einnahmen und Ausgaben

| Bereich | Was du dort machst |
|---|---|
| **+ (runder Knopf neben der Menüleiste)** | Neue Buchung: Ausgabe oder Einnahme, Betrag, Kategorie, Beschreibung, Datum, Beleg (Foto oder PDF, optional). Oben rechts ✓ speichert, ✕ bricht ab. |
| **Übersicht** | Einnahmen, Ausgaben und Saldo für den aktuellen Monat und das gewählte Jahr, dazu dein Überstunden-Stand und die zuletzt erfassten Buchungen |
| **Menüleiste unten** | Drei Reiter: Übersicht, Finanzen, Stunden – daneben der **+**-Knopf |
| **Finanzen** | Oben der Umschalter **Buchungen \| Monat \| Jahr**. *Buchungen:* alle Buchungen nach Monaten (mit Saldo je Monat). Oben die **Suche** und daneben der **Filter-Knopf** (Art, Zeitraum, Kategorie); aktive Filter stehen als kleine Schilder unter der Suche und lassen sich dort mit ✕ entfernen, der Knopf zeigt ihre Anzahl. Mit Suche oder Filter erscheint die Summe der Treffer. Antippen zum Bearbeiten oder Löschen. Oben rechts (⟲) die **Daueraufträge**. *Monat:* mit ‹ › blättern (ein Tipp auf den Monatsnamen springt direkt), Ergebnis, Ring **„Wohin ging das Geld?“** mit den Ausgaben-Kategorien, Einnahmen nach Kategorie. *Jahr:* Ergebnis mit **Exportieren** (PDF, CSV), Diagramm umschaltbar „Je Monat“/„Saldo im Verlauf“ (mit Vorjahr), Liste der Monate (antippen öffnet den Monat), Ring und Kategorien |
| **Einstellungen** (Zahnrad oben rechts) | Kategorien, Überstunden (Übertrag, Anzeige), Backup, hell/dunkel |

- **Saldo** = Einnahmen minus Ausgaben. Ein Minus zeigt die App rot.
- Neue Buchungen starten als **Ausgabe** (das Häufigste im Alltag); die zuletzt gewählte Art merkt sich die App.
- **Kategorien** sind vorbelegt (z. B. Gehalt, Lebensmittel, Miete & Wohnen) und unter *Einstellungen → Kategorien*
  frei änderbar: umbenennen, sortieren, neue anlegen, löschen (die Buchungen wandern dann in eine andere Kategorie).
  Im Formular stehen die zuletzt benutzten Kategorien in der Liste ganz oben; nach der Auswahl schließt sich die
  Tastatur, damit du gleich speichern kannst (die Beschreibung ist freiwillig).
- Ein Tipp auf eine Kategorie (Finanzen → Monat oder Jahr) zeigt alle Buchungen dieser Kategorie im gewählten Monat bzw. Jahr.
- **Ring „Wohin ging das Geld?“:** Die sechs Kategorien, für die du insgesamt am meisten ausgibst, haben eine feste Farbe
  (gleich in jedem Monat und Jahr); alle übrigen sind grau als „Weitere“ zusammengefasst. Ein Tipp auf den Ring zeigt in
  der Mitte Name, Betrag und Anteil; die Liste darunter nennt alle Kategorien mit genauen Beträgen.

### Daueraufträge (wiederkehrende Zahlungen)

Für gleichbleibende Zahlungen wie Miete, Krankenversicherung, Abos oder das Gehalt:

1. **+** tippen, Betrag, Kategorie und Beschreibung eingeben und den Schalter **„Wiederholen (Dauerauftrag)“** einschalten
   (oder *Finanzen* → oben rechts ⟲ *Daueraufträge* → *Neuer Dauerauftrag*).
2. **Rhythmus** wählen: monatlich, vierteljährlich, halbjährlich oder jährlich.
3. **Endet:** *Unbegrenzt* oder *Nach Anzahl Zahlungen* (z. B. 24 – die App zeigt, wann die letzte Zahlung ist).
4. **Erste Zahlung am:** Dieses Datum legt auch den Tag fest, an dem jedes Mal gebucht wird. Gibt es den Tag in einem
   Monat nicht (z. B. der 31.), wird am Monatsende gebucht.

So funktioniert es:

- Die App bucht fällige Zahlungen **automatisch beim Öffnen** (ohne Server geht es nicht zu einer festen Uhrzeit).
  War die App ein paar Tage zu, werden verpasste Termine nachgeholt; ein kurzer Hinweis zeigt, was gebucht wurde.
- Liegt die erste Zahlung in der Vergangenheit, fragt die App, ob die vergangenen Termine **nachgetragen** werden sollen.
- Gebuchte Zahlungen sind normale Buchungen (mit kleinem ⟲-Symbol) – du kannst sie einzeln ändern oder löschen;
  eine gelöschte Zahlung wird nicht noch einmal angelegt.
- **Ändern** (z. B. Mieterhöhung): *Finanzen* → oben rechts ⟲ *Daueraufträge* → antippen. Die Änderung gilt ab der
  „nächsten Zahlung“, bereits gebuchte Zahlungen bleiben unverändert. Auch aus einer gebuchten Zahlung kommst du
  über „Dauerauftrag bearbeiten“ dorthin.
- **Beenden** stoppt weitere Zahlungen; **Löschen** entfernt den Dauerauftrag – gebuchte Zahlungen bleiben jeweils erhalten.

## 3. Überstunden

Unten in der Menüleiste auf **Stunden** tippen. Auf diesem Bildschirm erfasst der **+**-Knopf einen Monat
(statt einer Buchung).

1. **Monat erfassen:** Monat wählen, die **tatsächlich gearbeiteten** Stunden und die **ausbezahlten** Stunden
   (laut Lohnabrechnung) eintragen, optional eine Notiz (z. B. „3 Tage Urlaub“).
   Die App schlägt den richtigen Monat vor (meist den Vormonat) und übernimmt die ausbezahlten Stunden vom
   letzten erfassten Monat – bitte mit der Lohnabrechnung vergleichen.
2. Schon beim Tippen zeigt das Formular die **Überstunden des Monats** und den **Stand danach**.

So rechnet die App:

- **Überstunden des Monats** = gearbeitet − ausbezahlt
- **Stand** = Übertrag + alle Monate zusammen
- **Freizeitausgleich** (Überstunden abgebaut): Du hast weniger gearbeitet als ausbezahlt – der Stand sinkt von selbst.
- **Überstunden ausbezahlt bekommen:** Sie gehören zu den ausbezahlten Stunden des Monats – der Stand sinkt entsprechend.
- **Übertrag:** Hattest du schon Überstunden, bevor du hier Monate erfasst? Trag den Stand unter
  *Einstellungen → Überstunden* ein (Minusstunden mit Minus davor, z. B. `-4`).

Eingeben kannst du Stunden als `172,5` oder `172:30`. Ob die App sie als **12,5 Std.** oder **12:30 Std.** anzeigt,
stellst du unter *Einstellungen → Überstunden* ein.

Der Bildschirm zeigt den aktuellen Stand, je Jahr die Summen (gearbeitet, ausbezahlt, Überstunden, Stand am
Jahresende), ein Diagramm und alle Monate mit laufendem Stand. **Fehlt ein Monat** (z. B. der Vormonat), erscheint
ein Hinweis – auch auf der Übersicht; ein Tipp darauf öffnet genau diesen Monat. Einen Monat korrigierst oder löschst
du, indem du ihn in der Liste antippst.

**Export:** Alle Monate mit Stand als **PDF** (z. B. für ein Gespräch mit dem Arbeitgeber) oder **CSV**.

## 4. Backup (bitte regelmäßig!)

Deine Daten liegen nur auf dem Handy. Die App erinnert dich regelmäßig an ein Backup
(einstellbar unter *Einstellungen → An Backup erinnern*).

**Backup erstellen:** *Einstellungen → Backup erstellen → Sichern …* und im Teilen-Menü
**In Dateien sichern → iCloud Drive** wählen. Die Datei heißt z. B. `haushaltsbuch-backup-2026-11-22.json` und
enthält alle Buchungen, Daueraufträge, Überstunden, Kategorien, Einstellungen und Belegfotos.

**Backup einspielen** (neues Handy, nach Neuinstallation, am Laptop): *Einstellungen → Backup einspielen*.
**Zusammenführen** (empfohlen): Neues kommt dazu, nichts wird doppelt, das jeweils Neuere gilt.
**Alles ersetzen**: Die Daten auf diesem Gerät werden durch das Backup ersetzt.

Backups der Hundeschule-App lassen sich hier nicht einspielen (und umgekehrt) – die App erkennt sie und sagt Bescheid.

## 5. Updates

Neue Versionen werden in dieses GitHub-Repository hochgeladen. Die App holt sie sich beim nächsten Öffnen
von selbst und zeigt kurz „App aktualisiert“ an. Deine Daten bleiben dabei erhalten.
Falls nichts passiert: die App im App-Umschalter wegwischen und neu öffnen.

## 6. Am Laptop lokal starten (optional)

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

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Grundgerüst und Gestaltung (Farben als Variablen, hell/dunkel) |
| `js/app.js` | Start, Navigation, +-Knopf, Updates |
| `js/config.js` | App-Kennung (`APP_ID`), Version, Backup-Format |
| `js/db.js` | Datenbank im Browser (IndexedDB), Versionen und Umbauten |
| `js/data.js` | Buchungen, Kategorien, Überstunden, Einstellungen; Beträge immer in **Cent**, Stunden in **Minuten** (ganze Zahlen) |
| `js/defaults.js` | Vorbelegte Kategorien und Einstellungen |
| `js/recurring.js` | Daueraufträge: Zeitplan (Tag im Monat, Monatsende, Rhythmus, Anzahl), fällige Zahlungen buchen, ändern, beenden |
| `js/hours.js` | Überstunden: Rechnen (Stand, Jahre, fehlende Monate), Eingabe lesen (`172,5`/`172:30`), Anzeige |
| `js/yearReport.js`, `js/exports.js`, `js/pdf.js` | Auswertung je Monat/Jahr, CSV, PDF (auch für Überstunden) |
| `js/backup.js` | Backup erstellen, prüfen, zusammenführen |
| `js/notices.js` | Backup-Erinnerung |
| `js/views/*.js` | Die Bildschirme (`finances.js`: Reiter „Finanzen“ mit Buchungsliste `bookings.js` und Auswertung `report.js`; `recurringList.js`: Daueraufträge; `hours.js`: Überstunden und Formular „Monat erfassen“; `form.js`: Buchung und Dauerauftrag) |
| `js/views/charts.js` | Diagramme (SVG, ohne Bibliothek; Farben in `css/app.css` als `--chart-…`) |
| `sw.js` | Offline-Modus (Liste aller Dateien) |

Überstunden werden je Monat mit fester ID `h-JJJJ-MM` gespeichert. So entsteht beim Zusammenführen zweier Geräte
nie ein Monat doppelt – es gilt der zuletzt geänderte. Ebenso bekommt jede Zahlung aus einem Dauerauftrag eine feste
ID aus Dauerauftrag und Datum (`b-<Dauerauftrag>-JJJJ-MM-TT`): Bucht dieselbe Zahlung auf zwei Geräten, ist sie nach
dem Zusammenführen trotzdem nur einmal da.

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

Für neue Bereiche in der Datenbank `DB_VERSION` in `js/db.js` erhöhen und dort einen Block
`if (oldVersion < 2) { … }` ergänzen – vorhandene Daten bleiben erhalten. Ändert sich der Aufbau der
Backup-Datei, `BACKUP_FORMAT` in `js/config.js` erhöhen.
