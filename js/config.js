// Kennung der App. Mehrere Apps laufen unter derselben Adresse (schule11.github.io)
// und teilen sich dort Datenbank, Caches und localStorage. Alles, was diese App
// speichert, trägt deshalb diese Kennung im Namen – so kommt sie keiner anderen
// App in die Quere (z. B. der Hundeschule-App, aus der sie entstanden ist).
// Steht auch in sw.js (Cache-Name) und index.html (Darstellung) – dort mit ändern.
export const APP_ID = 'haushaltsbuch';

/** Schlüssel für localStorage/sessionStorage, z. B. "haushaltsbuch.theme" */
export const storageKey = (name) => `${APP_ID}.${name}`;

// Versionsnummer der App. Bei jeder Änderung auch in sw.js (VERSION) erhöhen,
// damit Handys die neue Version laden.
export const APP_VERSION = '1.4.0';
export const APP_STAGE = '';

// Format der Backup-Datei. Wird erhöht, wenn sich der Aufbau ändert.
export const BACKUP_FORMAT = 4; // 2: Daueraufträge, 3: AZK-Auszahlung, 4: Überstunden in Sekunden
