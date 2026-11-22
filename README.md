# Hundeschule – Einnahmen & Ausgaben

Eine kleine App, um die Einnahmen und Ausgaben der **Hundeschule Marburg** zu erfassen.
Am Jahresende liefert sie die Summen für die **Anlage EÜR**, als CSV und als PDF.

- läuft im Browser und lässt sich auf dem iPhone wie eine App installieren
- funktioniert auch ohne Internet
- **alle Daten bleiben auf deinem Gerät**: kein Server, keine Anmeldung, keine Kosten
- Kleinunternehmer nach § 19 UStG: keine Umsatzsteuer, alle Beträge brutto

**Adresse der App:** https://schule11.github.io/hundeschule/

---

## 1. App auf dem iPhone installieren

1. Die Adresse oben in **Safari** öffnen.
2. Auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben, bei neuem iOS erst auf „•••“).
3. **Zum Home-Bildschirm** wählen und dann **Hinzufügen**.
4. Ab jetzt die App immer über das Symbol auf dem Home-Bildschirm öffnen.

> **Wichtig:** Die installierte App hat ihren **eigenen Speicher**, getrennt vom Safari-Tab.
> Trage Buchungen nur in der installierten App ein.
>
> **Löschst du die App vom Home-Bildschirm, löscht das iPhone auch ihre Daten.**
> Mach deshalb vorher immer ein Backup (siehe Abschnitt 3).

## 2. Die App benutzen

| Bereich | Was du dort machst |
|---|---|
| **+ (runder Knopf neben der Menüleiste)** | Neue Buchung (startet als Einnahme): Preisliste, Betrag, Kategorie und Kund:in (je als aufklappbare Liste), Beschreibung, Zahlung, Datum, Beleg. Oben rechts ✓ speichert, ✕ bricht ab. |
| **Menüleiste unten** | Übersicht, Buchungen, Auswertung |
| **Übersicht** | Einnahmen, Ausgaben und Gewinn (Monat und Jahr), Kacheln zu Kund:innen, Rechnungen, Gutscheinen, 10er-Karten und Kursen, offene Zahlungen zum Abhaken, Hinweise |
| **Buchungen** | Alle Buchungen nach Monaten; Suche und Filter (auch „Offen“) – mit Filter erscheint die Summe der Treffer; antippen zum Bearbeiten oder Löschen |
| **Auswertung** | Jahresabschluss-Assistent, Summen für die Anlage EÜR, Diagramme (Monate, Vorjahresvergleich), Kategorien und Kund:innen; Export als PDF (auch Fahrtenliste) und CSV |
| **Einstellungen** (Zahnrad oben rechts) | Kurze Liste wie in den iPhone-Einstellungen: Geschäftsdaten, Preisliste, Kategorien, Kund:innen, offene Zahlungen, Fahrtkosten, Kleinunternehmergrenze, Gewerbesteuer, Backup, hell/dunkel |

**Preisliste:** Oben im Formular stehen deine Leistungen (z. B. Einzelstunde 80 €, Telefonberatung 20 € pro 15 Min,
Gutschein ab 10 €). Ein Tipp füllt Betrag, Kategorie und Beschreibung aus; bei der Telefonberatung wählst du die Dauer
mit − und +. Ändern, sortieren, ergänzen (auch Vorlagen für Ausgaben wie die Platzmiete): *Einstellungen → Preisliste*.

**Fahrtkosten:** Wählst du die Kategorie „Fahrtkosten“, gibst du statt eines Betrags die gefahrenen Kilometer ein,
dazu **Ziel** und **Zweck** (das will das Finanzamt bei Rückfragen sehen) und ob es eine **Hin- und Rückfahrt** war
(die km werden dann verdoppelt). Häufige Strecken wählst du mit einem Tipp; neue merkst du dir direkt beim Erfassen
oder unter *Einstellungen → Fahrtkosten & Strecken*. Die App rechnet mit der Kilometerpauschale (Standard 0,30 €/km);
eine Änderung gilt nur für neue Fahrten. Die **Fahrtenliste als PDF** (Datum, Ziel, Zweck, Strecke, km, Betrag,
mit Summen) erstellst du in der *Auswertung* – fehlende Ziele oder Zwecke sind darin rot markiert.

**Privatanteil:** Nutzt du etwas auch privat (z. B. Handy und Internet), stellst du bei der Ausgaben-Kategorie den
betrieblichen Anteil ein (*Einstellungen → Kategorien Ausgaben*, z. B. 50 %). Du gibst dann den ganzen
Rechnungsbetrag ein; für die EÜR zählt nur der Anteil.

**Belege:** Zu jeder Buchung kannst du ein Foto oder ein PDF speichern (z. B. eine Rechnung aus einer Mail).
Fehlt bei Ausgaben noch ein Beleg, zeigt die Übersicht das an; in *Buchungen* filterst du mit „Ohne Beleg“.
Fahrten brauchen keinen Beleg.

**Kund:innen:** Bei einer Einnahme (und bei Fahrten) wählst du, um wen es geht. Ein Tipp auf „Kund:in wählen“
klappt die Liste auf: oben ein Suchfeld, darunter die zuletzt verwendeten Namen und alle anderen von A–Z.
Ein neuer Name wird beim Speichern automatisch angelegt. Unter *Einstellungen → Kund:innen* kannst du Namen
ändern, einen Hundenamen ergänzen (wird mit angezeigt und ist durchsuchbar) und alle Buchungen einer Person ansehen.
Die *Auswertung* zeigt außerdem „Einnahmen nach Kund:in“.

**Offene Zahlungen:** Bei einer Einnahme wählst du unter **„Zahlung“** die Zahlungsart (Bar oder Überweisung)
oder **„Noch offen“**. Ohne Auswahl gilt die Einnahme als bezahlt. Offene Einnahmen
stehen ganz oben auf der *Übersicht* unter „Offene Zahlungen“ – mit einem **orangen Kreis**. Sobald bezahlt wurde,
tippst du auf den Kreis („Rückgängig“ ist kurz möglich). Bezahlte Buchungen zeigen an derselben Stelle einen
**grünen Kreis mit Haken**. Ist eine Zahlung seit **14 Tagen** offen (einstellbar unter *Einstellungen →
Offene Zahlungen*), wird sie **rot** markiert. Optional zeigt das **App-Symbol** auf dem Home-Bildschirm die Zahl
offener Zahlungen (iOS fragt dafür einmal nach der Erlaubnis für Mitteilungen; die App verschickt aber keine).
Eine Push-Nachricht zu einem bestimmten Zeitpunkt ist ohne eigenen Server nicht möglich – die Erinnerung siehst
du deshalb beim Öffnen der App.

> **Steuerlich wichtig:** Offene Einnahmen zählen **noch nicht** zu Einnahmen, Gewinn, Anlage EÜR und
> Kleinunternehmergrenze – erst, wenn das Geld da ist (Zuflussprinzip). Beim Abhaken wird **heute** als
> Zahlungsdatum eingetragen; kam das Geld früher, änderst du das Datum in der Buchung. Eine Stunde im Dezember,
> die im Januar bezahlt wird, zählt im neuen Jahr.

**Rechnungen und Quittungen:** Trage einmal deine **Geschäftsdaten** ein (*Einstellungen → Geschäftsdaten*:
Name, Anschrift, Steuernummer, Bankverbindung, Zahlungsziel). Dann:
- **Aus einer Einnahme:** Buchung öffnen → **Rechnung erstellen** (Zahlung kommt noch) oder **Quittung erstellen**
  (Betrag schon erhalten, z. B. bar).
- **Neu:** Übersicht → Kachel **Rechnungen** → „+ Rechnung“ / „+ Quittung“. Dabei wird die Einnahme automatisch angelegt.
- Das PDF enthält Logo, fortlaufende Nummer (z. B. 2026-001), Leistungsdatum, deine Bankverbindung und den Hinweis
  „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet“. Teilen per WhatsApp, Mail oder „In Dateien sichern“.
- Eine Rechnung ist eine offene Zahlung, bis du sie abhakst (oder in der Rechnung „Als bezahlt markieren“).
- Erstellte Rechnungen werden nicht mehr geändert. Bei einem Fehler: **stornieren** und neu erstellen – die Nummer
  bleibt vergeben, damit die Nummern lückenlos sind.
- Die Anschrift der Kund:in wird gespeichert; ab 250 € gehört sie auf die Rechnung.

**Gutscheine:** Verkaufen über + → „Gutschein“ (freier Betrag ab 10 €) oder Übersicht → Kachel **Gutscheine** →
„+ Gutschein verkaufen“. Optional trägst du ein, für wen er ist; danach kannst du das **Gutschein-PDF** zum Verschenken
teilen. Gutscheine gelten 3 Jahre (bis zum Jahresende). **Einlösen** bei der Stunde: + → Leistung → Kund:in →
Zahlung **„Gutschein“** → Gutschein wählen. Der Verkauf war schon die Einnahme – beim Einlösen entsteht keine neue.
Reicht der Gutschein nicht, wird nur der Restbetrag als Einnahme gebucht. Teileinlösung ist möglich, der Restwert bleibt.

**10er-Karten:** Verkaufen über + → „10er-Karte Gruppenstunde“ (Kund:in auswählen) oder Kachel **10er-Karten**.
Bei der Gruppenstunde wählst du unter Zahlung **„10er-Karte (noch …)“** – eine Stunde wird abgebucht, ohne neue
Einnahme. Abbuchungen siehst du (und machst sie rückgängig) in der Kachel 10er-Karten oder bei der Kund:in.
Preis und Anzahl der Stunden änderst du in der Preisliste.

**Gruppenkurse:** Übersicht → Kachel **Kurse** → „+ Neuer Kurs“ (Name, Start, Termine, Zeit/Ort, Preis pro Person,
Plätze). Mit „+ Hinzufügen“ meldest du Kund:innen an – für jede Person entsteht eine Einnahme über den Kurspreis,
standardmäßig **offen** (mit Erinnerung nach 14 Tagen ab Kursbeginn). Abhaken per Kreis; ein Tipp auf den Namen bietet
Rechnung/Quittung, Buchung öffnen oder Entfernen. Wiederkehrende Kurse kopierst du mit „Als neuen Kurs kopieren“;
fertige Kurse schließt du ab.

**Datum = Tag der Zahlung.** Die EÜR zählt, wann das Geld geflossen ist, nicht wann die Rechnung kam.

## 3. Backup machen (bitte regelmäßig!)

Deine Daten liegen nur auf dem Handy. Ein Backup schützt vor Verlust, zum Beispiel bei einem Handywechsel,
einem Defekt oder wenn du die App versehentlich löschst. Die App erinnert dich automatisch
(einstellbar unter *Einstellungen → An Backup erinnern*).

**Backup erstellen:**
1. *Einstellungen → Backup erstellen → Sichern …*
2. Im Teilen-Menü **In Dateien sichern** wählen, dann **iCloud Drive** und **Sichern**.
   Die Datei heißt z. B. `hundeschule-backup-2026-11-17.json` und enthält alle Buchungen, Kategorien,
   Einstellungen und Belegfotos.

**Backup einspielen** (neues Handy, nach Neuinstallation, am Laptop):
1. *Einstellungen → Backup einspielen* und die Datei auswählen.
2. **Zusammenführen** (empfohlen): Buchungen aus dem Backup kommen dazu, nichts wird doppelt,
   das jeweils Neuere gilt. **Alles ersetzen**: Die Daten auf diesem Gerät werden durch das Backup ersetzt.

**Handy wechseln:** Auf dem alten Handy ein Backup in iCloud Drive sichern. Auf dem neuen Handy die App
installieren (Abschnitt 1) und das Backup einspielen.

**Am Laptop ansehen oder ausdrucken:** Die Adresse im Browser öffnen, das neueste Backup vom Handy einspielen,
dann unter *Auswertung* das PDF erstellen. Das Handy bleibt das Hauptgerät.

## 4. Steuererklärung (Anlage EÜR)

1. *Auswertung* öffnen und das Jahr wählen. Von Januar bis Mai ist automatisch das Vorjahr ausgewählt.
2. Unter **„Für die Anlage EÜR“** stehen die Summen je Posten des Formulars. Die Bezeichnungen entsprechen
   denen in der Anlage EÜR bzw. in ELSTER. **Die Zeilennummern ändern sich fast jedes Jahr**, deshalb nennt
   die App die Bezeichnungen.
3. Als Kleinunternehmer gehören **alle Einnahmen** in den Posten
   „Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer“ (im Formular 2025: Zeile 12).
   Ausgaben trägst du **brutto** ein, also so, wie du bezahlt hast.
4. **PDF erstellen** gibt dir eine Jahresübersicht mit allen Buchungen zum Ablegen oder für die Steuerberatung.
   **CSV** öffnet sich direkt in Excel oder Numbers. **Fahrtenliste (PDF)** zeigt alle Fahrten des Jahres.

**Jahresabschluss-Assistent:** Ganz oben in der *Auswertung* steht „Jahresabschluss 2026 – x von 8 erledigt“.
Ein Tipp öffnet eine Checkliste; ✓ heißt „passt“, ! heißt „bitte ansehen“. Jeder Punkt hat einen Knopf zum Erledigen:
- **Offene Zahlungen** des Jahres (abhaken oder bewusst als „kommt später“ markieren)
- **Belege**: Ausgaben ohne Foto/PDF (ergänzen oder „Eigenbelege liegen vor“)
- **Fahrten** ohne Ziel oder Zweck (antippen und ergänzen)
- **10-Tage-Regel** (siehe unten)
- **Kleinunternehmerregelung** und **Gewerbesteuer** für das Jahr
- **Backup** und **Unterlagen** (Jahres-PDF, Fahrtenliste, CSV)

Was du von Hand als erledigt markierst, wird gespeichert und ist im Backup enthalten.

**10-Tage-Regel:** Regelmäßig wiederkehrende Zahlungen (Platzmiete, Versicherung, Telefon, Beiträge …), die
zwischen dem 22.12. und dem 10.01. bezahlt werden und in dieser Zeit fällig sind, zählen für das Jahr, zu dem sie
gehören – z. B. die Dezember-Platzmiete, bezahlt am 5. Januar, noch fürs alte Jahr. Der Assistent findet solche
Zahlungen und du wählst je Zahlung das Jahr. Die Auswertung, das PDF und die CSV rechnen sie dann dem gewählten
Jahr zu (mit Hinweis „10-Tage-Regel“); in der Buchungsliste steht „zählt für …“. Einmalige Ausgaben zählen immer
im Jahr der Zahlung.

**Diagramme:** In der *Auswertung* zeigen Säulen Einnahmen und Ausgaben pro Monat; ein Tipp auf einen Monat zeigt
die genauen Beträge darunter. Eine Linie zeigt den aufsummierten Gewinn im Vergleich zum Vorjahr. Bei den Kategorien
zeigt ein Balken den Anteil an allen Einnahmen bzw. Ausgaben.

Welche Kategorie zu welchem Posten gehört, kannst du unter *Einstellungen → Kategorien Einnahmen/Ausgaben* ändern.

> Die App ersetzt keine Steuerberatung. Bitte prüfe die Zuordnung vor der Abgabe mit dem aktuellen Formular.
> Hinweise: Anschaffungen über 800 € netto (z. B. Geräte) müssen meist über mehrere Jahre abgeschrieben werden;
> das berechnet die App nicht. Bewahre die Original-Belege trotz Foto in der App auf (Aufbewahrungsfristen).

**Kleinunternehmergrenze:** Die App warnt dezent auf der Übersicht, wenn dein Umsatz sich den Grenzen nähert
(Standard: 25.000 € im Vorjahr, 100.000 € im laufenden Jahr, Hinweis ab 80 %). Die Werte kannst du in den
Einstellungen anpassen, falls sich das Gesetz ändert.

**Gewerbesteuer:** Eine Hundeschule ist meist ein Gewerbe. Gewerbesteuer fällt erst an, wenn der Gewinn im Jahr über
dem **Freibetrag von 24.500 €** liegt; dann ist auch eine Gewerbesteuererklärung nötig. Die App zeigt auf der
Übersicht einen Hinweis, sobald der Gewinn 80 % des Freibetrags erreicht, und schätzt die Steuer
(3,5 % × Hebesatz auf den Teil über dem Freibetrag; Marburg ab 2026: 420 %). Bis zum 4-Fachen des Messbetrags wird
sie auf die Einkommensteuer angerechnet. Freibetrag, Hebesatz und Hinweis: *Einstellungen → Gewerbesteuer*.
Die Schätzung ist vereinfacht – die genauen Zahlen klärt die Steuerberatung.

## 5. Updates

Neue Versionen werden in dieses GitHub-Repository hochgeladen. Die App holt sie sich beim nächsten Öffnen
von selbst und zeigt kurz „App aktualisiert“ an. Deine Daten bleiben dabei erhalten.
Falls nichts passiert: die App im App-Umschalter wegwischen und neu öffnen.

## 6. Kostenlos online stellen (GitHub Pages)

Das ist bereits erledigt. Falls du die App einmal in ein neues Repository umziehen willst:

1. Auf github.com ein neues, **öffentliches** Repository anlegen und alle Dateien dieses Ordners hochladen
   (*Add file → Upload files*). Öffentlich ist nur der Programmcode, **nie deine Buchungen**.
2. Im Repository *Settings → Pages* öffnen, bei *Source* **Deploy from a branch** wählen,
   *Branch* **main** und Ordner **/ (root)** einstellen und auf **Save** tippen.
3. Nach 1–2 Minuten ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.

## 7. Am Laptop lokal starten (optional)

Nur nötig, wenn du am Code etwas ausprobieren willst. Dafür brauchst du Python (kostenlos von python.org;
am Mac bietet macOS beim ersten Aufruf von `python3` die Installation an). Im Terminal im Projektordner:

```bash
cd hundeschule
```

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
| `js/app.js` | Start, Navigation, Updates |
| `js/db.js` | Datenbank im Browser (IndexedDB), Versionen und Umbauten |
| `js/data.js` | Buchungen, Kategorien, Einstellungen; Beträge immer in **Cent** (ganze Zahlen) |
| `js/defaults.js` | Vorbelegte Kategorien, Einstellungen, Posten der Anlage EÜR |
| `js/yearReport.js`, `js/exports.js`, `js/pdf.js` | Jahresauswertung, CSV, PDF |
| `js/backup.js` | Backup erstellen, prüfen, zusammenführen |
| `js/notices.js` | Kleinunternehmer- und Gewerbesteuer-Hinweis, Backup-Erinnerung |
| `js/closing.js`, `js/views/closing.js` | Jahresabschluss-Assistent und 10-Tage-Regel |
| `js/tripPdf.js` | Fahrtenliste als PDF |
| `js/views/charts.js` | Diagramme (SVG, ohne Bibliothek; Farben in `css/app.css` als `--chart-…`) |
| `js/badge.js` | Zahl offener Zahlungen am App-Symbol |
| `js/views/*.js` | Die einzelnen Bildschirme (u. a. `personPicker.js`: Kund:in-Auswahl, `contacts.js`: Kund:innen verwalten) |
| `sw.js` | Offline-Modus (Liste aller Dateien) |

**Bei jeder Änderung** die Versionsnummer in `js/config.js` **und** `sw.js` erhöhen, damit Handys die neue
Version laden. Neue Dateien in die Liste in `sw.js` eintragen.

**Rechnungen ergänzen (Idee):** In `js/db.js` die `DB_VERSION` erhöhen und einen neuen Speicher `invoices`
anlegen (das Beispiel steht dort schon als Kommentar). Kund:innen gibt es bereits (`contacts`), eine Rechnung
kann also direkt auf `personId` verweisen, und eine Buchung über ein Feld `invoiceId` auf ihre Rechnung.
Vorhandene Daten bleiben dabei erhalten. Das Backup-Format (`BACKUP_FORMAT` in `js/config.js`) entsprechend erweitern.
