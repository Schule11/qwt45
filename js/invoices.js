// Rechnungen und Quittungen: Nummern, Anlegen, Stornieren.
//
// Jede Rechnung/Quittung gehört zu genau einer Einnahme-Buchung:
// - Rechnung  → die Buchung ist (meist) eine offene Zahlung, bis abgehakt wird
// - Quittung  → die Buchung ist bezahlt (bar oder per Überweisung)
// Eine erstellte Rechnung wird nicht mehr verändert. Bei Fehlern: stornieren
// und neu erstellen – so bleiben die Nummern lückenlos.

import { state, uid, nowISO, saveRecord, saveBooking, saveContact, contactById } from './data.js';

export const KIND_LABEL = { invoice: 'Rechnung', receipt: 'Quittung' };

/** Nächste freie Nummer im Jahr, z. B. "2026-004" (gemeinsam für Rechnungen und Quittungen) */
export function nextInvoiceNumber(year) {
  let max = 0;
  for (const inv of state.invoices) {
    const m = /^(\d{4})-(\d+)$/.exec(inv.number || '');
    if (m && Number(m[1]) === Number(year)) max = Math.max(max, Number(m[2]));
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`;
}

/** Fehlende Pflichtangaben in den Geschäftsdaten */
export function missingBusinessData() {
  const s = state.settings;
  const missing = [];
  if (!s.ownerName && !s.businessName) missing.push('Name');
  if (!s.street) missing.push('Straße');
  if (!s.zip || !s.city) missing.push('PLZ und Ort');
  return missing;
}

/** Geschäftsdaten zum Zeitpunkt der Rechnung festhalten */
function sellerSnapshot() {
  const s = state.settings;
  const keys = ['businessName', 'ownerName', 'street', 'zip', 'city', 'phone', 'email', 'website', 'taxNumber', 'bankHolder', 'iban', 'bic', 'bankName', 'invoiceNote'];
  return Object.fromEntries(keys.map((k) => [k, s[k] || '']));
}

export function invoiceBooking(inv) {
  return state.bookings.find((b) => b.id === inv.bookingId) || null;
}

/** 'open' | 'paid' | 'cancelled' */
export function invoiceStatus(inv) {
  if (inv.cancelled) return 'cancelled';
  const b = invoiceBooking(inv);
  if (!b) return inv.kind === 'receipt' ? 'paid' : 'open';
  return b.paid === false ? 'open' : 'paid';
}

export const STATUS_LABEL = { open: 'offen', paid: 'bezahlt', cancelled: 'storniert' };

export function invoicesSorted() {
  return [...state.invoices].sort((a, b) => (a.number < b.number ? 1 : -1));
}

export function lineTotal(item) {
  return Math.round((Number(item.quantity) || 0) * (item.unitPriceCents || 0));
}

/**
 * Rechnung oder Quittung erstellen.
 * data: { kind, booking?, personId?, newPersonName?, recipient: {name, street, zip, city},
 *         items: [{text, quantity, unitPriceCents}], date, serviceDate, dueDate?, payment?, paymentDate?,
 *         note?, categoryId? (nur ohne Buchung) }
 */
export async function createInvoice(data) {
  const { kind, booking = null, recipient } = data;
  const items = data.items.map((it) => ({ ...it, totalCents: lineTotal(it) }));
  const totalCents = items.reduce((sum, it) => sum + it.totalCents, 0);

  // Kund:in anlegen oder Anschrift bei der Kund:in speichern
  let personId = data.personId || null;
  const address = { street: recipient.street || '', zip: recipient.zip || '', city: recipient.city || '' };
  if (!personId && data.newPersonName) {
    personId = (await saveContact({ name: data.newPersonName, ...address }, { silent: true })).id;
  } else if (personId) {
    const c = contactById(personId);
    if (c && (c.street !== address.street || c.zip !== address.zip || c.city !== address.city) && (address.street || address.city)) {
      await saveContact({ id: personId, ...address }, { silent: true });
    }
  }

  const id = uid('inv');
  const number = nextInvoiceNumber(Number(data.date.slice(0, 4)));
  const isReceipt = kind === 'receipt';

  // Buchung anpassen oder neu anlegen
  let bookingId;
  if (booking) {
    const patch = { id: booking.id, amountCents: totalCents, personId: personId || booking.personId || null, invoiceId: id };
    if (isReceipt && booking.paid === false) {
      Object.assign(patch, { paid: true, serviceDate: booking.serviceDate || booking.date, date: data.paymentDate, payment: data.payment || null });
    } else if (isReceipt && data.payment) {
      patch.payment = data.payment;
    }
    // Privatanteil/Preisliste spielen bei Einnahmen keine Rolle; Betrag folgt der Rechnung
    bookingId = (await saveBooking(patch)).id;
  } else {
    const b = await saveBooking({
      type: 'income',
      categoryId: data.categoryId,
      amountCents: totalCents,
      description: items.length > 1 ? `${items[0].text} + ${items.length - 1} weitere` : (items[0]?.text || `${KIND_LABEL[kind]} ${number}`),
      personId,
      paid: isReceipt,
      date: isReceipt ? data.paymentDate : data.serviceDate,
      serviceDate: isReceipt ? (data.serviceDate !== data.paymentDate ? data.serviceDate : null) : data.serviceDate,
      payment: isReceipt ? (data.payment || null) : null,
      invoiceId: id,
    });
    bookingId = b.id;
  }

  return saveRecord('invoices', {
    id,
    kind,
    number,
    date: data.date,
    serviceDate: data.serviceDate,
    dueDate: isReceipt ? null : data.dueDate,
    payment: isReceipt ? (data.payment || null) : null,
    paymentDate: isReceipt ? data.paymentDate : null,
    personId,
    recipient: { name: recipient.name, ...address },
    items,
    totalCents,
    note: data.note || '',
    seller: sellerSnapshot(),
    bookingId,
    cancelled: false,
  });
}

/** Stornieren: Nummer bleibt bestehen, die Buchung wird von der Rechnung gelöst */
export async function cancelInvoice(inv) {
  const b = invoiceBooking(inv);
  if (b && b.invoiceId === inv.id) await saveBooking({ id: b.id, invoiceId: null });
  return saveRecord('invoices', { id: inv.id, cancelled: true, cancelledAt: nowISO() });
}
