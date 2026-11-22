// Berechnet die Jahresauswertung – genutzt vom Bildschirm "Auswertung",
// vom CSV- und vom PDF-Export. So stimmen alle drei immer überein.

import { state, categoryById, sumBookings, contactById, contactLabel, isOpen, euerYear } from './data.js';
import { euerPostenFor, euerOrder } from './defaults.js';

/**
 * Ergebnis:
 * {
 *   year, bookings (chronologisch), totals: {income, expense, profit},
 *   categories: { income: [...], expense: [...] }  je { id, name, type, count, cents, km, posten }
 *   posten: [{ name, type, cents, categories: [Namen] }]
 *   months: [12 × {income, expense, profit, count}]
 * }
 */
export function yearReport(year) {
  year = Number(year);
  const y = String(year);
  // Nur bezahlte Buchungen – offene Einnahmen zählen erst im Jahr der Zahlung.
  // Zuordnung zum Jahr inkl. 10-Tage-Regel (siehe euerYear)
  const bookings = state.bookings
    .filter((b) => !isOpen(b) && euerYear(b) === year)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt < b.createdAt ? -1 : 1)));

  const totals = sumBookings(bookings);

  // Pro Kategorie
  const byCat = new Map();
  for (const b of bookings) {
    const cat = categoryById(b.categoryId);
    const key = cat ? cat.id : `unknown-${b.type}`;
    if (!byCat.has(key)) {
      byCat.set(key, {
        id: cat?.id || null,
        name: cat?.name || 'Ohne Kategorie',
        type: b.type,
        order: cat ? cat.order : 9999,
        posten: euerPostenFor(cat),
        count: 0,
        cents: 0,
        km: 0,
      });
    }
    const entry = byCat.get(key);
    entry.count += 1;
    entry.cents += b.amountCents;
    if (b.km) entry.km += b.km;
  }
  const cats = [...byCat.values()].sort((a, b) => a.order - b.order);
  const categories = {
    income: cats.filter((c) => c.type === 'income'),
    expense: cats.filter((c) => c.type === 'expense'),
  };

  // Pro EÜR-Posten
  const byPosten = new Map();
  for (const c of cats) {
    const key = `${c.type}|${c.posten}`;
    if (!byPosten.has(key)) byPosten.set(key, { name: c.posten, type: c.type, cents: 0, categories: [] });
    const p = byPosten.get(key);
    p.cents += c.cents;
    p.categories.push(c.name);
  }
  const posten = [...byPosten.values()].sort((a, b) =>
    (a.type !== b.type ? (a.type === 'income' ? -1 : 1) : (euerOrder(a.name) - euerOrder(b.name) || a.name.localeCompare(b.name, 'de'))));

  // Pro Monat
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, profit: 0, count: 0 }));
  for (const b of bookings) {
    // Per 10-Tage-Regel aus dem Nachbarjahr: in den Dezember bzw. Januar einordnen
    const dy = Number(b.date.slice(0, 4));
    const m = months[dy < year ? 0 : dy > year ? 11 : Number(b.date.slice(5, 7)) - 1];
    if (b.type === 'income') m.income += b.amountCents;
    else m.expense += b.amountCents;
    m.count += 1;
  }
  for (const m of months) m.profit = m.income - m.expense;

  // Einnahmen pro Kund:in (nur wenn überhaupt Namen zugeordnet sind)
  const byPerson = new Map();
  for (const b of bookings) {
    if (b.type !== 'income') continue;
    const contact = contactById(b.personId);
    const key = contact ? contact.id : 'none';
    if (!byPerson.has(key)) byPerson.set(key, { id: key, label: contact ? contactLabel(contact) : 'Ohne Kund:in', count: 0, cents: 0 });
    const p = byPerson.get(key);
    p.count += 1;
    p.cents += b.amountCents;
  }
  const persons = byPerson.size && [...byPerson.keys()].some((k) => k !== 'none')
    ? [...byPerson.values()].sort((a, b) => (a.id === 'none') - (b.id === 'none') || b.cents - a.cents)
    : [];

  // Offene Einnahmen mit Stunde in diesem Jahr (nur zur Info, nicht enthalten)
  const openList = state.bookings.filter((b) => isOpen(b) && (b.serviceDate || b.date).startsWith(y));
  const open = { count: openList.length, cents: openList.reduce((s, b) => s + b.amountCents, 0) };

  return { year: Number(year), bookings, totals, categories, posten, months, persons, open };
}
