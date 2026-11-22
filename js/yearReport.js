// Berechnet die Auswertung eines Jahres oder Monats – genutzt vom Bildschirm
// "Auswertung", vom CSV- und vom PDF-Export. So stimmen alle drei immer überein.

import { state, categoryById, sumBookings } from './data.js';

/** Buchungen eines Zeitraums ("JJJJ" oder "JJJJ-MM"), chronologisch */
function bookingsIn(period) {
  return state.bookings
    .filter((b) => b.date.startsWith(period))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt < b.createdAt ? -1 : 1)));
}

/** Summen je Kategorie: { income: [...], expense: [...] } je { id, name, type, count, cents } */
function byCategory(bookings) {
  const byCat = new Map();
  for (const b of bookings) {
    const cat = categoryById(b.categoryId);
    const key = cat ? cat.id : `unknown-${b.type}`;
    if (!byCat.has(key)) {
      byCat.set(key, { id: cat?.id || null, name: cat?.name || 'Ohne Kategorie', type: b.type, count: 0, cents: 0 });
    }
    const entry = byCat.get(key);
    entry.count += 1;
    entry.cents += b.amountCents;
  }
  // Größte Posten zuerst – so sieht man sofort, wohin das Geld geht
  const cats = [...byCat.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, 'de'));
  return {
    income: cats.filter((c) => c.type === 'income'),
    expense: cats.filter((c) => c.type === 'expense'),
  };
}

/**
 * Ergebnis:
 * {
 *   year, bookings (chronologisch), totals: {income, expense, balance},
 *   categories: { income: [...], expense: [...] },
 *   months: [12 × {income, expense, balance, count}]
 * }
 */
export function yearReport(year) {
  year = Number(year);
  const bookings = bookingsIn(String(year));
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, balance: 0, count: 0 }));
  for (const b of bookings) {
    const m = months[Number(b.date.slice(5, 7)) - 1];
    if (b.type === 'income') m.income += b.amountCents;
    else m.expense += b.amountCents;
    m.count += 1;
  }
  for (const m of months) m.balance = m.income - m.expense;
  return { year, bookings, totals: sumBookings(bookings), categories: byCategory(bookings), months };
}

/** Wie yearReport, aber für einen Monat ("JJJJ-MM") – ohne Monatsaufteilung */
export function monthReport(ym) {
  const bookings = bookingsIn(ym);
  return { month: ym, bookings, totals: sumBookings(bookings), categories: byCategory(bookings) };
}
