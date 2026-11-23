// Vorbelegte Kategorien und Einstellungen.
//
// Die vorbelegten Kategorien haben feste IDs ("cat-<key>"). Dadurch entstehen
// beim Zusammenführen von Backups zweier Geräte keine doppelten Kategorien.

// Sehr alter Zeitstempel für vorbelegte Daten: Jede echte Änderung ist
// "neuer" und gewinnt beim Zusammenführen.
export const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES = [
  // Einnahmen
  { key: 'gehalt', type: 'income', name: 'Gehalt' },
  { key: 'nebeneinkuenfte', type: 'income', name: 'Nebeneinkünfte' },
  { key: 'erstattungen', type: 'income', name: 'Erstattungen' },
  { key: 'geschenke-einnahmen', type: 'income', name: 'Geschenke' },
  { key: 'zinsen', type: 'income', name: 'Zinsen & Erträge' },
  { key: 'verkaeufe', type: 'income', name: 'Verkäufe' },
  { key: 'sonstiges-einnahmen', type: 'income', name: 'Sonstiges' },
  // Ausgaben
  { key: 'lebensmittel', type: 'expense', name: 'Lebensmittel' },
  { key: 'wohnen', type: 'expense', name: 'Miete & Wohnen' },
  { key: 'nebenkosten', type: 'expense', name: 'Strom & Nebenkosten' },
  { key: 'versicherungen', type: 'expense', name: 'Versicherungen' },
  { key: 'mobilitaet', type: 'expense', name: 'Auto & Mobilität' },
  { key: 'telefon', type: 'expense', name: 'Telefon & Internet' },
  { key: 'abos', type: 'expense', name: 'Abos & Mitgliedschaften' },
  { key: 'gesundheit', type: 'expense', name: 'Gesundheit & Pflege' },
  { key: 'kleidung', type: 'expense', name: 'Kleidung' },
  { key: 'freizeit', type: 'expense', name: 'Freizeit & Hobby' },
  { key: 'essen-gehen', type: 'expense', name: 'Essen gehen' },
  { key: 'urlaub', type: 'expense', name: 'Urlaub & Reisen' },
  { key: 'geschenke-ausgaben', type: 'expense', name: 'Geschenke & Spenden' },
  { key: 'haushalt', type: 'expense', name: 'Haushalt & Einrichtung' },
  { key: 'sonstiges-ausgaben', type: 'expense', name: 'Sonstiges' },
];

export function defaultCategoryRecords() {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat-${c.key}`,
    key: c.key,
    type: c.type,
    name: c.name,
    order: i,
    updatedAt: EPOCH,
  }));
}

// Alle Geldbeträge in Cent (ganze Zahlen).
export const DEFAULT_SETTINGS = {
  backupReminderDays: 30, // 0 = keine Erinnerung
  hoursStartSec: 0,       // Überstunden-Übertrag vor dem ersten erfassten Monat (Sekunden, auch negativ)
  updatedAt: EPOCH,
};
