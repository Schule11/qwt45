// Vorbelegte Kategorien und Einstellungen.
//
// Die vorbelegten Kategorien haben feste IDs ("cat-<key>"). Dadurch entstehen
// beim Zusammenführen von Backups zweier Geräte keine doppelten Kategorien.
// `icon` ist das Standard-Symbol (js/views/catIcons.js); gespeichert wird ein Symbol
// erst, wenn man es selbst auswählt.

// Sehr alter Zeitstempel für vorbelegte Daten: Jede echte Änderung ist
// "neuer" und gewinnt beim Zusammenführen.
export const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES = [
  // Einnahmen
  { key: 'gehalt', type: 'income', name: 'Gehalt', icon: 'briefcase' },
  { key: 'nebeneinkuenfte', type: 'income', name: 'Nebeneinkünfte', icon: 'coins' },
  { key: 'erstattungen', type: 'income', name: 'Erstattungen', icon: 'refund' },
  { key: 'geschenke-einnahmen', type: 'income', name: 'Geschenke', icon: 'gift' },
  { key: 'zinsen', type: 'income', name: 'Zinsen & Erträge', icon: 'trend' },
  { key: 'verkaeufe', type: 'income', name: 'Verkäufe', icon: 'tag' },
  { key: 'sonstiges-einnahmen', type: 'income', name: 'Sonstiges', icon: 'more' },
  // Ausgaben
  { key: 'lebensmittel', type: 'expense', name: 'Lebensmittel', icon: 'cart' },
  { key: 'wohnen', type: 'expense', name: 'Miete & Wohnen', icon: 'house' },
  { key: 'nebenkosten', type: 'expense', name: 'Strom & Nebenkosten', icon: 'bolt' },
  { key: 'versicherungen', type: 'expense', name: 'Versicherungen', icon: 'shield' },
  { key: 'mobilitaet', type: 'expense', name: 'Auto & Mobilität', icon: 'car' },
  { key: 'telefon', type: 'expense', name: 'Telefon & Internet', icon: 'phone' },
  { key: 'abos', type: 'expense', name: 'Abos & Mitgliedschaften', icon: 'play' },
  { key: 'gesundheit', type: 'expense', name: 'Gesundheit & Pflege', icon: 'health' },
  { key: 'kleidung', type: 'expense', name: 'Kleidung', icon: 'shirt' },
  { key: 'freizeit', type: 'expense', name: 'Freizeit & Hobby', icon: 'ticket' },
  { key: 'essen-gehen', type: 'expense', name: 'Essen gehen', icon: 'cutlery' },
  { key: 'urlaub', type: 'expense', name: 'Urlaub & Reisen', icon: 'plane' },
  { key: 'geschenke-ausgaben', type: 'expense', name: 'Geschenke & Spenden', icon: 'gift' },
  { key: 'haushalt', type: 'expense', name: 'Haushalt & Einrichtung', icon: 'sofa' },
  { key: 'sonstiges-ausgaben', type: 'expense', name: 'Sonstiges', icon: 'more' },
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
