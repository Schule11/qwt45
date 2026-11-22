// Vorbelegte Kategorien und Einstellungen.
//
// Die vorbelegten Kategorien haben feste IDs ("cat-<key>"). Dadurch entstehen
// beim Zusammenführen von Backups zweier Geräte keine doppelten Kategorien.

// Sehr alter Zeitstempel für vorbelegte Daten: Jede echte Änderung ist
// "neuer" und gewinnt beim Zusammenführen.
export const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_CATEGORIES = [
  // Einnahmen
  { key: 'einzeltraining', type: 'income', name: 'Einzeltraining' },
  { key: 'beratung', type: 'income', name: 'Beratung' },
  { key: 'gruppenkurse', type: 'income', name: 'Gruppenkurse' },
  { key: 'welpenkurse', type: 'income', name: 'Welpenkurse' },
  { key: 'workshops', type: 'income', name: 'Workshops/Seminare' },
  { key: 'gutscheine', type: 'income', name: 'Gutscheine' },
  { key: 'sonstiges-einnahmen', type: 'income', name: 'Sonstiges' },
  // Ausgaben
  { key: 'platzmiete', type: 'expense', name: 'Platzmiete' },
  { key: 'material', type: 'expense', name: 'Trainingsmaterial & Zubehör' },
  { key: 'leckerlis', type: 'expense', name: 'Leckerlis/Futter' },
  { key: 'versicherungen', type: 'expense', name: 'Versicherungen' },
  { key: 'fortbildung', type: 'expense', name: 'Fortbildung' },
  { key: 'werbung', type: 'expense', name: 'Werbung/Website' },
  { key: 'telefon', type: 'expense', name: 'Telefon & Internet' },
  { key: 'fahrtkosten', type: 'expense', name: 'Fahrtkosten', mileage: true },
  { key: 'buero', type: 'expense', name: 'Büromaterial' },
  { key: 'gebuehren', type: 'expense', name: 'Gebühren & Beiträge' },
  { key: 'sonstiges-ausgaben', type: 'expense', name: 'Sonstiges' },
];

export function defaultCategoryRecords() {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat-${c.key}`,
    key: c.key,
    type: c.type,
    name: c.name,
    euer: '',              // Posten der Anlage EÜR; leer = Standard (siehe euerPostenFor)
    mileage: !!c.mileage,  // Fahrtkosten: Betrag = km × Pauschale
    businessPercent: 100,  // betrieblicher Anteil in % (z. B. Handy 50 %)
    order: i,
    updatedAt: EPOCH,
  }));
}

// ---------- Preisliste ----------
//
// unit: 'fixed' = fester Preis, 'quarter' = Preis je angefangene 15 Minuten,
//       'free' = freier Betrag (priceCents = Mindestbetrag)
// kind: 'service' = Leistung, 'voucher' = Gutschein, 'card' = 10er-Karte
export const DEFAULT_PRODUCTS = [
  { key: 'erstberatung', name: 'Erstberatung', priceCents: 8000, unit: 'fixed', category: 'beratung' },
  { key: 'einzelstunde', name: 'Einzelstunde', priceCents: 8000, unit: 'fixed', category: 'einzeltraining' },
  { key: 'telefonberatung', name: 'Telefonberatung', priceCents: 2000, unit: 'quarter', category: 'beratung' },
  { key: 'gruppenstunde', name: 'Gruppenstunde', priceCents: 2000, unit: 'fixed', category: 'gruppenkurse' },
  { key: 'schnupperstunde', name: 'Schnupperstunde', priceCents: 2000, unit: 'fixed', category: 'gruppenkurse' },
  { key: 'onlineberatung', name: 'Onlineberatung', priceCents: 8000, unit: 'fixed', category: 'beratung' },
  { key: 'gutschein', name: 'Gutschein', priceCents: 1000, unit: 'free', kind: 'voucher', category: 'gutscheine' },
  { key: '10er-karte', name: '10er-Karte Gruppenstunde', priceCents: 20000, unit: 'fixed', kind: 'card', category: 'gruppenkurse',
    cardSize: 10, covers: 'gruppenstunde' },
];

export function defaultProductRecords() {
  return DEFAULT_PRODUCTS.map((p, i) => ({
    id: `prod-${p.key}`,
    key: p.key,
    type: 'income',
    kind: p.kind || 'service',
    name: p.name,
    priceCents: p.priceCents,
    unit: p.unit,
    categoryId: `cat-${p.category}`,
    ...(p.kind === 'card' ? { cardSize: p.cardSize, coversProductId: `prod-${p.covers}` } : {}),
    order: i,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }));
}

/** "80,00 €", "20,00 € / 15 Min", "ab 10,00 €" – für Knöpfe und Listen */
export function productPriceLabel(p, formatMoney) {
  if (p.unit === 'quarter') return `${formatMoney(p.priceCents)} / 15 Min`;
  if (p.unit === 'free') return p.priceCents ? `ab ${formatMoney(p.priceCents)}` : 'freier Betrag';
  return formatMoney(p.priceCents);
}

// Alle Geldbeträge in Cent (ganze Zahlen).
export const DEFAULT_SETTINGS = {
  businessName: 'Hundeschule Marburg',
  kmRateCents: 30,                 // 0,30 € pro gefahrenem Kilometer
  limitPrevYearCents: 2500000,     // 25.000 € Umsatz im Vorjahr
  limitCurrentYearCents: 10000000, // 100.000 € Umsatz im laufenden Jahr
  warnPercent: 80,                 // Hinweis ab 80 % der Grenze
  manualRevenue: {},               // Umsatz von Hand je Jahr, z. B. { "2025": 1200000 }
  backupReminderDays: 30,          // 0 = keine Erinnerung
  paymentReminderDays: 14,         // offene Zahlung gilt danach als überfällig
  tradeTaxAllowanceCents: 2450000, // Gewerbesteuer-Freibetrag für Einzelunternehmen (24.500 €)
  tradeTaxRatePercent: 420,        // Hebesatz der Gemeinde (Marburg ab 2026: 420 %)
  tradeTaxHint: true,              // Hinweis auf der Übersicht anzeigen
  closing: {},                     // Jahresabschluss je Jahr, z. B. { "2026": { ack: { open: true }, exportedAt } }
  // Geschäftsdaten für Rechnungen und Quittungen
  ownerName: '',                   // Inhaber:in (Vor- und Nachname)
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  taxNumber: '',                   // Steuernummer vom Finanzamt
  bankHolder: '',
  iban: '',
  bic: '',
  bankName: '',
  paymentTermDays: 14,             // Zahlungsziel für Rechnungen
  invoiceNote: '',                 // Schlusstext auf Rechnungen (optional)
  updatedAt: EPOCH,
};

// ---------- Anlage EÜR ----------
//
// Bezeichnungen der Posten in der Anlage EÜR, in der Reihenfolge des Formulars.
// Bewusst ohne Zeilennummern: Die ändern sich fast jedes Jahr, die Bezeichnungen
// bleiben. Bitte vor der Abgabe mit dem aktuellen Formular abgleichen.

export const EUER_INCOME = 'Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer';
export const EUER_OTHER_EXPENSES = 'Übrige unbeschränkt abziehbare Betriebsausgaben';

export const EUER_POSTEN = [
  { type: 'income', name: EUER_INCOME },
  { type: 'expense', name: 'Waren, Roh- und Hilfsstoffe einschließlich der Nebenkosten' },
  { type: 'expense', name: 'Bezogene Fremdleistungen' },
  { type: 'expense', name: 'Aufwendungen für geringwertige Wirtschaftsgüter' },
  { type: 'expense', name: 'Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke' },
  { type: 'expense', name: 'Aufwendungen für Telekommunikation (z. B. Telefon, Internet)' },
  { type: 'expense', name: 'Übernachtungs- und Reisenebenkosten bei Geschäftsreisen' },
  { type: 'expense', name: 'Fortbildungskosten (ohne Reisekosten)' },
  { type: 'expense', name: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)' },
  { type: 'expense', name: 'Werbekosten (z. B. Inserate, Werbespots, Plakate)' },
  { type: 'expense', name: 'Fahrtkosten für nicht betriebliche Fahrzeuge (Nutzungseinlage)' },
  { type: 'expense', name: EUER_OTHER_EXPENSES },
];

// Vorschlag je vorbelegter Kategorie (änderbar in den Einstellungen, Schritt 3)
const EUER_DEFAULTS = {
  platzmiete: 'Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke',
  versicherungen: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)',
  gebuehren: 'Beiträge, Gebühren, Abgaben und Versicherungen (ohne solche für Gebäude und Kfz)',
  fortbildung: 'Fortbildungskosten (ohne Reisekosten)',
  werbung: 'Werbekosten (z. B. Inserate, Werbespots, Plakate)',
  telefon: 'Aufwendungen für Telekommunikation (z. B. Telefon, Internet)',
  fahrtkosten: 'Fahrtkosten für nicht betriebliche Fahrzeuge (Nutzungseinlage)',
};

/** EÜR-Posten einer Kategorie: eigene Angabe, sonst Vorschlag, sonst Sammelposten */
export function euerPostenFor(category) {
  if (!category) return 'Nicht zugeordnet';
  if (category.euer) return category.euer;
  if (category.type === 'income') return EUER_INCOME;
  return EUER_DEFAULTS[category.key] || EUER_OTHER_EXPENSES;
}

export function euerOrder(name) {
  const i = EUER_POSTEN.findIndex((p) => p.name === name);
  return i < 0 ? 999 : i;
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Bar' },
  { value: 'transfer', label: 'Überweisung' },
];

// Auch nicht mehr angebotene Zahlungsarten (z. B. PayPal) bei alten Buchungen anzeigen
const PAYMENT_LABELS = { cash: 'Bar', transfer: 'Überweisung', paypal: 'PayPal' };

export function paymentLabel(value) {
  return PAYMENT_LABELS[value] || '';
}
