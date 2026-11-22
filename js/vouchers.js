// Gutscheine und 10er-Karten.
//
// Verkauf = normale Einnahme (zählt sofort, das Geld fließt beim Kauf).
// Einlösen/Abbuchen = KEINE neue Einnahme; es wird nur der Restwert bzw. die
// Zahl der übrigen Stunden verringert. Nur ein Restbetrag, der über den
// Gutschein hinausgeht, ist eine neue Einnahme.

import { state, uid, nowISO, saveRecord, recordById, contactById } from './data.js';
import { todayISO } from './format.js';

// ---------- Nummern ----------

function nextCode(list, prefix, year) {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`);
  for (const x of list) {
    const m = re.exec(x.code || '');
    if (m && Number(m[1]) === Number(year)) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

/** Gutscheine gelten 3 Jahre, gerechnet ab dem Ende des Kaufjahres (gesetzliche Verjährung) */
export function defaultValidUntil(soldDate) {
  return `${Number(soldDate.slice(0, 4)) + 3}-12-31`;
}

// ---------- Gutscheine ----------

export function voucherRedeemed(v) {
  return (v.redemptions || []).reduce((s, r) => s + r.cents, 0);
}

export function voucherRemaining(v) {
  return Math.max(0, v.valueCents - voucherRedeemed(v));
}

/** 'active' | 'redeemed' | 'expired' | 'cancelled' */
export function voucherState(v, today = todayISO()) {
  if (v.cancelled) return 'cancelled';
  if (voucherRemaining(v) <= 0) return 'redeemed';
  if (v.validUntil && v.validUntil < today) return 'expired';
  return 'active';
}

export const VOUCHER_STATE_LABEL = { active: 'gültig', redeemed: 'eingelöst', expired: 'abgelaufen', cancelled: 'storniert' };

export function activeVouchers() {
  return state.vouchers.filter((v) => voucherState(v) === 'active').sort((a, b) => (a.code < b.code ? -1 : 1));
}

export function vouchersSorted() {
  return [...state.vouchers].sort((a, b) => (a.code < b.code ? 1 : -1));
}

/** Gutschein zu einer Verkaufs-Buchung anlegen */
export async function createVoucherForBooking(booking, { recipientName = '' } = {}) {
  const soldDate = booking.date;
  return saveRecord('vouchers', {
    id: uid('gs'),
    code: nextCode(state.vouchers, 'G', soldDate.slice(0, 4)),
    valueCents: booking.amountCents,
    soldDate,
    validUntil: defaultValidUntil(soldDate),
    bookingId: booking.id,
    buyerPersonId: booking.personId || null,
    recipientName,
    redemptions: [],
    cancelled: false,
  });
}

/** Einlösen (ganz oder teilweise). Gibt den eingelösten Betrag zurück. */
export async function redeemVoucher(voucherId, { date = todayISO(), cents, note = '', personId = null, bookingId = null }) {
  const v = recordById('vouchers', voucherId);
  if (!v) throw new Error('Gutschein nicht gefunden.');
  const amount = Math.min(cents, voucherRemaining(v));
  if (amount <= 0) throw new Error('Auf diesem Gutschein ist kein Betrag mehr übrig.');
  const redemption = { id: uid('red'), date, cents: amount, note, personId, bookingId, createdAt: nowISO() };
  await saveRecord('vouchers', { id: v.id, redemptions: [...(v.redemptions || []), redemption] });
  return amount;
}

export async function undoRedemption(voucherId, redemptionId) {
  const v = recordById('vouchers', voucherId);
  if (!v) return;
  await saveRecord('vouchers', { id: v.id, redemptions: (v.redemptions || []).filter((r) => r.id !== redemptionId) });
}

// ---------- 10er-Karten ----------

export function cardRemaining(c) {
  return Math.max(0, (c.size || 10) - (c.uses || []).length);
}

/** 'active' | 'used' | 'cancelled' */
export function cardState(c) {
  if (c.cancelled) return 'cancelled';
  return cardRemaining(c) > 0 ? 'active' : 'used';
}

export const CARD_STATE_LABEL = { active: 'aktiv', used: 'aufgebraucht', cancelled: 'storniert' };

export function cardsSorted() {
  return [...state.cards].sort((a, b) => (a.code < b.code ? 1 : -1));
}

/** Aktive Karten einer Kund:in, die für die Leistung (Preisliste) gelten */
export function activeCardsFor(personId, productId = null) {
  if (!personId) return [];
  return state.cards
    .filter((c) => c.personId === personId && cardState(c) === 'active' && (!productId || !c.productId || c.productId === productId))
    .sort((a, b) => (a.soldDate < b.soldDate ? -1 : 1)); // älteste zuerst aufbrauchen
}

/** 10er-Karte zu einer Verkaufs-Buchung anlegen */
export async function createCardForBooking(booking, product) {
  return saveRecord('cards', {
    id: uid('card'),
    code: nextCode(state.cards, 'K', booking.date.slice(0, 4)),
    personId: booking.personId,
    productId: product.coversProductId || null,
    title: product.name,
    size: product.cardSize || 10,
    priceCents: booking.amountCents,
    soldDate: booking.date,
    bookingId: booking.id,
    uses: [],
    cancelled: false,
  });
}

export async function useCard(cardId, { date = todayISO(), note = '' } = {}) {
  const c = recordById('cards', cardId);
  if (!c) throw new Error('10er-Karte nicht gefunden.');
  if (cardRemaining(c) <= 0) throw new Error('Auf dieser Karte sind keine Stunden mehr übrig.');
  const use = { id: uid('use'), date, note, createdAt: nowISO() };
  await saveRecord('cards', { id: c.id, uses: [...(c.uses || []), use] });
  return cardRemaining({ ...c, uses: [...(c.uses || []), use] });
}

export async function undoCardUse(cardId, useId) {
  const c = recordById('cards', cardId);
  if (!c) return;
  await saveRecord('cards', { id: c.id, uses: (c.uses || []).filter((u) => u.id !== useId) });
}

export function cardLabel(c) {
  const who = contactById(c.personId)?.name || 'Kund:in';
  return `${who} · ${c.title || '10er-Karte'}`;
}
