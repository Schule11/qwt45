// Daten der App: Alles wird beim Start in den Arbeitsspeicher geladen
// (das sind auch nach Jahren nur ein paar tausend Einträge) und bei jeder
// Änderung sofort in die Datenbank auf dem Gerät geschrieben.
// Nur die Belegfotos bleiben in der Datenbank und werden bei Bedarf geladen.

import * as db from './db.js';
import { DEFAULT_SETTINGS, defaultCategoryRecords, defaultProductRecords, EPOCH } from './defaults.js';
import { todayISO } from './format.js';

/**
 * Buchung:
 * {
 *   id, type: 'income'|'expense', date: 'JJJJ-MM-TT' (Tag der Zahlung),
 *   amountCents: Integer, categoryId, description,
 *   payment: 'cash'|'transfer'|'paypal'|null,
 *   receiptId: ID des Belegfotos oder null,
 *   km: Zahl oder null, kmRateCents: Integer oder null   (nur Fahrtkosten),
 *   personId: ID der Kundin / des Kunden oder null,
 *   paid: false = Einnahme noch offen (fehlt/true = bezahlt). Offene Einnahmen zählen
 *         NICHT zu Summen, EÜR und Umsatz – erst wenn das Geld da ist (Zuflussprinzip).
 *   serviceDate: Datum der Stunde/Leistung (bei offenen Einnahmen), sonst null.
 *         Bei offenen Einnahmen ist `date` = Datum der Stunde, nach dem Abhaken = Zahlungsdatum.
 *   productId, quantity: aus der Preisliste (quantity = Anzahl 15-Minuten-Einheiten o. Ä.)
 *   fullAmountCents, businessPercent: Rechnungsbetrag und betrieblicher Anteil;
 *         amountCents ist dann nur der betriebliche Teil (zählt für die EÜR)
 *   tripTo, tripPurpose, roundTrip, kmEntered: Fahrten (Ziel, Zweck, Hin- und Rückfahrt,
 *         eingegebene km; km = kmEntered × 2 bei Hin- und Rückfahrt)
 *   createdAt, updatedAt
 * }
 */
export const state = {
  bookings: [],
  categories: [],
  contacts: [], // Kund:innen: { id, name, dog, createdAt, updatedAt }
  products: [], // Preisliste
  routes: [],   // häufige Strecken: { id, name, km, roundTrip, purpose }
  invoices: [], // Rechnungen & Quittungen
  vouchers: [], // Gutscheine
  cards: [],    // 10er-Karten
  courses: [],  // Gruppenkurse
  settings: { ...DEFAULT_SETTINGS },
  local: {}, // nur für dieses Gerät (z. B. Zeitpunkt des letzten Backups)
};

// ---------- Benachrichtigung bei Änderungen ----------

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange() {
  for (const fn of listeners) {
    try { fn(); } catch (err) { console.error(err); }
  }
}

// ---------- Hilfsfunktionen ----------

export function uid(prefix) {
  let hex;
  if (crypto.randomUUID) {
    hex = crypto.randomUUID().replace(/-/g, '');
  } else {
    hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  }
  return `${prefix}-${hex}`;
}

export const nowISO = () => new Date().toISOString();

// ---------- Laden ----------

const DATA_VERSION = 4;

/** Weitere Listen, die genauso gespeichert, gesichert und zusammengeführt werden */
export const RECORD_STORES = ['products', 'routes', 'invoices', 'vouchers', 'cards', 'courses'];

export async function load() {
  let [bookings, categories, contacts, meta, ...records] = await Promise.all([
    db.getAll('bookings'),
    db.getAll('categories'),
    db.getAll('contacts'),
    db.getAll('meta'),
    ...RECORD_STORES.map((name) => db.getAll(name)),
  ]);
  RECORD_STORES.forEach((name, i) => { state[name] = records[i]; });
  const m = Object.fromEntries(meta.map((x) => [x.key, x.value]));

  if (categories.length === 0) {
    categories = defaultCategoryRecords();
    await db.write(['categories'], (s) => { for (const c of categories) s.categories.put(c); });
  }

  state.bookings = bookings;
  state.categories = categories;
  state.contacts = contacts;
  state.settings = { ...DEFAULT_SETTINGS, ...(m.settings || {}) };
  state.local = m.local || {};

  await migrate(m.dataVersion || 0);
}

/** Datenanpassungen für neue App-Versionen laufen hier genau einmal. */
async function migrate(from) {
  if (from >= DATA_VERSION) return;
  // Version 2: Name der Hundeschule vorbelegen (vorher nur "Hundeschule")
  if (from < 2 && (!state.settings.businessName || state.settings.businessName === 'Hundeschule')) {
    state.settings = { ...state.settings, businessName: DEFAULT_SETTINGS.businessName };
    await db.write(['meta'], (s) => s.meta.put({ key: 'settings', value: state.settings }));
  }
  // Version 3: Kategorien "Beratung" und "Gutscheine", Preisliste vorbelegen
  if (from < 3) await ensureV3Defaults();
  // Version 4: 10er-Karte in der Preisliste; früher verkaufte Gutscheine als Gutscheine anlegen
  if (from < 4) await ensureV4Defaults();
  await db.write(['meta'], (s) => s.meta.put({ key: 'dataVersion', value: DATA_VERSION }));
}

/** 10er-Karte in der Preisliste ergänzen; Gutschein-Verkäufe ohne Gutschein nachtragen */
export async function ensureV4Defaults() {
  const card = defaultProductRecords().find((p) => p.id === 'prod-10er-karte');
  const products = [];
  if (card && !state.products.some((p) => p.id === card.id)) {
    products.push({ ...card, order: Math.max(-1, ...state.products.map((p) => p.order ?? -1)) + 1 });
  }
  // Gutscheine, die vor dieser Version über die Preisliste verkauft wurden
  const sales = state.bookings
    .filter((b) => b.productId === 'prod-gutschein' && !b.voucherId && b.type === 'income')
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const vouchers = [];
  const bookings = [];
  const counter = {};
  for (const v of state.vouchers) {
    const m = /^G-(\d{4})-(\d+)$/.exec(v.code || '');
    if (m) counter[m[1]] = Math.max(counter[m[1]] || 0, Number(m[2]));
  }
  const now = nowISO();
  for (const b of sales) {
    const year = b.date.slice(0, 4);
    counter[year] = (counter[year] || 0) + 1;
    const v = {
      id: uid('gs'), code: `G-${year}-${String(counter[year]).padStart(3, '0')}`, valueCents: b.amountCents, soldDate: b.date,
      validUntil: `${Number(year) + 3}-12-31`, bookingId: b.id, buyerPersonId: b.personId || null, recipientName: '',
      redemptions: [], cancelled: false, order: 0, createdAt: now, updatedAt: now,
    };
    vouchers.push(v);
    bookings.push({ ...b, voucherId: v.id, updatedAt: now });
  }
  await db.write(['products', 'vouchers', 'bookings'], (s) => {
    for (const p of products) s.products.put(p);
    for (const v of vouchers) s.vouchers.put(v);
    for (const b of bookings) s.bookings.put(b);
  });
  state.products.push(...products);
  state.vouchers.push(...vouchers);
  for (const b of bookings) replaceInState(state.bookings, b);
}

/** Kategorien "Beratung"/"Gutscheine" und die Preisliste ergänzen, falls sie fehlen */
export async function ensureV3Defaults() {
  {
    const byId = (id) => state.categories.find((c) => c.id === id);
    const income = state.categories.filter((c) => c.type === 'income');
    const maxOrder = Math.max(0, ...income.map((c) => c.order));
    const added = [];
    if (!byId('cat-beratung')) {
      const after = byId('cat-einzeltraining');
      added.push({ id: 'cat-beratung', key: 'beratung', type: 'income', name: 'Beratung', euer: '', mileage: false,
        businessPercent: 100, order: after ? after.order + 0.5 : maxOrder + 1, updatedAt: EPOCH });
    }
    if (!byId('cat-gutscheine')) {
      const before = byId('cat-sonstiges-einnahmen');
      added.push({ id: 'cat-gutscheine', key: 'gutscheine', type: 'income', name: 'Gutscheine', euer: '', mileage: false,
        businessPercent: 100, order: before ? before.order - 0.5 : maxOrder + 2, updatedAt: EPOCH });
    }
    const products = state.products.length ? [] : defaultProductRecords();
    await db.write(['categories', 'products'], (s) => {
      for (const c of added) s.categories.put(c);
      for (const p of products) s.products.put(p);
    });
    state.categories.push(...added);
    state.products.push(...products);
  }
}

// ---------- Kategorien ----------

export function categoryById(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function categoryName(id) {
  return categoryById(id)?.name || 'Ohne Kategorie';
}

/**
 * Kategorien eines Typs. Mit recentFirst stehen die zuletzt benutzten
 * (höchstens 4) vorne, der Rest bleibt in der gewohnten Reihenfolge.
 */
export function categoriesFor(type, { recentFirst = false } = {}) {
  const cats = state.categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.order - b.order);
  if (!recentFirst) return cats;

  const lastUsed = new Map();
  for (const b of state.bookings) {
    if (b.type !== type) continue;
    const prev = lastUsed.get(b.categoryId);
    if (!prev || prev < b.createdAt) lastUsed.set(b.categoryId, b.createdAt);
  }
  const recent = cats
    .filter((c) => lastUsed.has(c.id))
    .sort((a, b) => (lastUsed.get(b.id) > lastUsed.get(a.id) ? 1 : -1))
    .slice(0, 4);
  const rest = cats.filter((c) => !recent.includes(c));
  return [...recent, ...rest];
}

/** Die zuletzt benutzten Kategorien eines Typs (IDs, neueste zuerst) */
export function recentCategoryIds(type, limit = 3) {
  const lastUsed = new Map();
  for (const b of state.bookings) {
    if (b.type !== type) continue;
    const prev = lastUsed.get(b.categoryId);
    if (!prev || prev < b.createdAt) lastUsed.set(b.categoryId, b.createdAt);
  }
  return [...lastUsed.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, limit).map(([id]) => id);
}

export function bookingCount(categoryId) {
  return state.bookings.filter((b) => b.categoryId === categoryId).length;
}

function replaceInState(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

/** Neue oder geänderte Kategorie speichern */
export async function saveCategory(input) {
  const existing = input.id ? categoryById(input.id) : null;
  const sameType = state.categories.filter((c) => c.type === input.type);
  const cat = {
    key: null,
    euer: '',
    mileage: false,
    ...existing,
    ...input,
    id: existing?.id || uid('cat'),
    order: existing ? existing.order : Math.max(-1, ...sameType.map((c) => c.order)) + 1,
    updatedAt: nowISO(),
  };
  await db.write(['categories'], (s) => s.categories.put(cat));
  replaceInState(state.categories, cat);
  emitChange();
  return cat;
}

/** Kategorie in der Reihenfolge nach oben (-1) oder unten (+1) schieben */
export async function moveCategory(id, direction) {
  const cat = categoryById(id);
  if (!cat) return;
  const list = categoriesFor(cat.type);
  const i = list.findIndex((c) => c.id === id);
  const j = i + direction;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const now = nowISO();
  const changed = [];
  list.forEach((c, idx) => { if (c.order !== idx) changed.push({ ...c, order: idx, updatedAt: now }); });
  await db.write(['categories'], (s) => { for (const c of changed) s.categories.put(c); });
  for (const c of changed) replaceInState(state.categories, c);
  emitChange();
}

/** Kategorie löschen; vorhandene Buchungen wandern in moveToId */
export async function deleteCategory(id, moveToId = null) {
  const now = nowISO();
  const moved = state.bookings
    .filter((b) => b.categoryId === id)
    .map((b) => ({ ...b, categoryId: moveToId, updatedAt: now }));
  if (moved.length && !categoryById(moveToId)) throw new Error('Bitte eine Kategorie wählen, in die die Buchungen verschoben werden.');
  await db.write(['categories', 'bookings', 'tombstones'], (s) => {
    s.categories.delete(id);
    s.tombstones.put({ id, kind: 'category', deletedAt: now });
    for (const b of moved) s.bookings.put(b);
  });
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const b of moved) replaceInState(state.bookings, b);
  emitChange();
  return moved.length;
}

// ---------- Kund:innen ----------

export function contactById(id) {
  return id ? state.contacts.find((c) => c.id === id) || null : null;
}

/** "Anna Müller (Bello)" */
export function contactLabel(contact) {
  if (!contact) return '';
  return contact.dog ? `${contact.name} (${contact.dog})` : contact.name;
}

export function contactsSorted() {
  return [...state.contacts].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

/** Zuletzt benutzte Kund:innen zuerst, danach neu angelegte */
export function recentContacts(limit = 6) {
  const lastUsed = new Map();
  for (const b of state.bookings) {
    if (!b.personId) continue;
    const prev = lastUsed.get(b.personId);
    if (!prev || prev < b.createdAt) lastUsed.set(b.personId, b.createdAt);
  }
  return [...state.contacts]
    .sort((a, b) => ((lastUsed.get(b.id) || b.createdAt) > (lastUsed.get(a.id) || a.createdAt) ? 1 : -1))
    .slice(0, limit);
}

export function findContactByName(name) {
  const n = String(name || '').trim().toLocaleLowerCase('de');
  return state.contacts.find((c) => c.name.toLocaleLowerCase('de') === n) || null;
}

export function contactStats(id) {
  const list = state.bookings.filter((b) => b.personId === id);
  return { count: list.length, ...sumBookings(list), open: sumOpen(list) };
}

export async function saveContact(input, { silent = false } = {}) {
  const existing = contactById(input.id);
  const now = nowISO();
  const contact = {
    dog: '',
    ...existing,
    ...input,
    name: String(input.name ?? existing?.name ?? '').trim(),
    dog: String(input.dog ?? existing?.dog ?? '').trim(),
    id: existing?.id || uid('p'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.write(['contacts'], (s) => s.contacts.put(contact));
  replaceInState(state.contacts, contact);
  if (!silent) emitChange();
  return contact;
}

/** Kund:in löschen – die Buchungen bleiben, nur die Verknüpfung entfällt */
export async function deleteContact(id) {
  const now = nowISO();
  const unlinked = state.bookings
    .filter((b) => b.personId === id)
    .map((b) => ({ ...b, personId: null, updatedAt: now }));
  await db.write(['contacts', 'bookings', 'tombstones'], (s) => {
    s.contacts.delete(id);
    s.tombstones.put({ id, kind: 'contact', deletedAt: now });
    for (const b of unlinked) s.bookings.put(b);
  });
  state.contacts = state.contacts.filter((c) => c.id !== id);
  for (const b of unlinked) replaceInState(state.bookings, b);
  emitChange();
  return unlinked.length;
}

// ---------- Allgemeine Listen (Preisliste, Strecken, Rechnungen, …) ----------

const PREFIX = { products: 'prod', routes: 'route', invoices: 'inv', vouchers: 'gs', cards: 'card', courses: 'course' };

export function recordById(name, id) {
  return id ? state[name].find((x) => x.id === id) || null : null;
}

/** Eintrag in einer der Listen speichern (neu oder geändert) */
export async function saveRecord(name, input, { silent = false } = {}) {
  const existing = recordById(name, input.id);
  const now = nowISO();
  const sameGroup = state[name];
  const record = {
    ...existing,
    ...input,
    id: existing?.id || input.id || uid(PREFIX[name]),
    order: existing?.order ?? input.order ?? Math.max(-1, ...sameGroup.map((x) => x.order ?? -1)) + 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.write([name], (s) => s[name].put(record));
  replaceInState(state[name], record);
  if (!silent) emitChange();
  return record;
}

export async function deleteRecord(name, id) {
  const now = nowISO();
  await db.write([name, 'tombstones'], (s) => {
    s[name].delete(id);
    s.tombstones.put({ id, kind: name, deletedAt: now });
  });
  state[name] = state[name].filter((x) => x.id !== id);
  emitChange();
}

/** Reihenfolge ändern (direction -1 = nach oben, +1 = nach unten) innerhalb von list */
export async function moveRecord(name, list, id, direction) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  const reordered = [...list];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  const now = nowISO();
  const changed = [];
  reordered.forEach((x, idx) => { if (x.order !== idx) changed.push({ ...x, order: idx, updatedAt: now }); });
  await db.write([name], (s) => { for (const x of changed) s[name].put(x); });
  for (const x of changed) replaceInState(state[name], x);
  emitChange();
}

// ---------- Preisliste ----------

export function productsFor(type) {
  return state.products.filter((p) => (p.type || 'income') === type).sort((a, b) => a.order - b.order);
}

// ---------- Häufige Strecken ----------

export function routesSorted() {
  return [...state.routes].sort((a, b) => a.order - b.order);
}

// ---------- Belege ----------

/** Ausgaben ohne Beleg (Fahrtkosten brauchen keinen Beleg) */
export function needsReceipt(b) {
  return b.type === 'expense' && !b.receiptId && !categoryById(b.categoryId)?.mileage;
}

/**
 * Jahr, zu dem eine Buchung in der EÜR zählt. Normalerweise das Jahr der Zahlung.
 * 10-Tage-Regel: Regelmäßig wiederkehrende Zahlungen kurz vor oder nach dem
 * Jahreswechsel (22.12.–10.01.) können dem Nachbarjahr zugeordnet sein (Feld euerYear).
 */
export function euerYear(b) {
  const y = Number(b.date.slice(0, 4));
  const md = b.date.slice(5);
  if (b.euerYear === y - 1 && md <= '01-10') return y - 1;
  if (b.euerYear === y + 1 && md >= '12-22') return y + 1;
  return y;
}

/** Wurde die Buchung per 10-Tage-Regel ins Nachbarjahr verschoben? */
export function isShiftedYear(b) {
  return euerYear(b) !== Number(b.date.slice(0, 4));
}

// ---------- Umsatz (für die Kleinunternehmergrenze) ----------

/** Umsatz eines Jahres: von Hand eingetragen, sonst Summe der Einnahmen in der App */
export function revenueFor(year) {
  const manual = state.settings.manualRevenue?.[String(year)];
  if (Number.isSafeInteger(manual)) return { cents: manual, manual: true };
  const cents = state.bookings
    .filter((b) => b.type === 'income' && !isOpen(b) && b.date.startsWith(String(year)))
    .reduce((sum, b) => sum + b.amountCents, 0);
  return { cents, manual: false };
}

// ---------- Buchungen ----------

/** Neueste zuerst (nach Datum, bei gleichem Datum nach Erfassungszeit) */
export function sortBookings(list) {
  return list.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------- Offene Zahlungen ----------

/** Einnahme, die noch nicht bezahlt ist */
export function isOpen(b) {
  return b.type === 'income' && b.paid === false;
}

/** Alle offenen Einnahmen, älteste zuerst */
export function openBookings() {
  return state.bookings
    .filter(isOpen)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt < b.createdAt ? -1 : 1)));
}

/** Seit wie vielen Tagen ist die Einnahme offen (ab Datum der Stunde)? */
export function daysOpen(b, today = todayISO()) {
  const from = Date.UTC(...(b.serviceDate || b.date).split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  const to = Date.UTC(...today.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.max(0, Math.round((to - from) / 86400000));
}

export function isOverdue(b) {
  return isOpen(b) && daysOpen(b) >= (state.settings.paymentReminderDays || 14);
}

/** Summe offener Einnahmen in Cent */
export function sumOpen(list) {
  return list.reduce((sum, b) => sum + (isOpen(b) ? b.amountCents : 0), 0);
}

/**
 * Als bezahlt abhaken: Zahlungsdatum = heute (änderbar in der Buchung).
 * Gibt den vorherigen Stand zurück (für "Rückgängig").
 */
export async function markPaid(id, date = todayISO()) {
  const b = state.bookings.find((x) => x.id === id);
  if (!b || !isOpen(b)) return null;
  const previous = { ...b };
  await saveBooking({ id, paid: true, serviceDate: b.serviceDate || b.date, date });
  return previous;
}

/** Summen einer Liste: { income, expense, profit } in Cent – ohne offene Einnahmen */
export function sumBookings(list) {
  let income = 0;
  let expense = 0;
  for (const b of list) {
    if (isOpen(b)) continue;
    if (b.type === 'income') income += b.amountCents;
    else expense += b.amountCents;
  }
  return { income, expense, profit: income - expense };
}

export function bookingYears() {
  const years = new Set(state.bookings.map((b) => Number(b.date.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/**
 * Speichert eine neue oder geänderte Buchung.
 * receiptChange: { add: { data, type, width, height } } | { remove: true } | null
 */
export async function saveBooking(input, receiptChange = null) {
  const existing = input.id ? state.bookings.find((b) => b.id === input.id) : null;
  const now = nowISO();
  const booking = {
    km: null,
    kmRateCents: null,
    receiptId: null,
    personId: null,
    paid: true,
    serviceDate: null,
    ...existing,
    ...input,
    id: existing?.id || uid('b'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  let newReceipt = null;
  let oldReceiptId = null;
  if (receiptChange?.add) {
    newReceipt = { ...receiptChange.add, id: uid('r'), createdAt: now };
    oldReceiptId = existing?.receiptId || null;
    booking.receiptId = newReceipt.id;
  } else if (receiptChange?.remove) {
    oldReceiptId = existing?.receiptId || null;
    booking.receiptId = null;
  }

  await db.write(['bookings', 'receipts', 'tombstones'], (s) => {
    s.bookings.put(booking);
    if (newReceipt) s.receipts.put(newReceipt);
    if (oldReceiptId) {
      s.receipts.delete(oldReceiptId);
      s.tombstones.put({ id: oldReceiptId, kind: 'receipt', deletedAt: now });
    }
  });

  const i = state.bookings.findIndex((b) => b.id === booking.id);
  if (i >= 0) state.bookings[i] = booking;
  else state.bookings.push(booking);

  requestPersistentStorage();
  emitChange();
  return booking;
}

export async function deleteBooking(id) {
  const existing = state.bookings.find((b) => b.id === id);
  if (!existing) return;
  const now = nowISO();
  await db.write(['bookings', 'receipts', 'tombstones'], (s) => {
    s.bookings.delete(id);
    s.tombstones.put({ id, kind: 'booking', deletedAt: now });
    if (existing.receiptId) {
      s.receipts.delete(existing.receiptId);
      s.tombstones.put({ id: existing.receiptId, kind: 'receipt', deletedAt: now });
    }
  });
  state.bookings = state.bookings.filter((b) => b.id !== id);
  emitChange();
}

// ---------- Belegfotos ----------

export function getReceipt(id) {
  return db.get('receipts', id);
}

export function receiptToBlob(receipt) {
  return new Blob([receipt.data], { type: receipt.type || 'image/jpeg' });
}

// ---------- Einstellungen ----------

/** silent: Bildschirm nicht neu aufbauen (z. B. beim Tippen in den Einstellungen) */
export async function updateSettings(patch, { silent = false } = {}) {
  state.settings = { ...state.settings, ...patch, updatedAt: nowISO() };
  await db.write(['meta'], (s) => s.meta.put({ key: 'settings', value: state.settings }));
  if (!silent) emitChange();
}

/** Nur für dieses Gerät (wird nicht ins Backup übernommen) */
export async function updateLocal(patch, { silent = false } = {}) {
  state.local = { ...state.local, ...patch };
  await db.write(['meta'], (s) => s.meta.put({ key: 'local', value: state.local }));
  if (!silent) emitChange();
}

// ---------- Dauerhafter Speicher ----------

let persistAsked = false;

/** Bittet den Browser, die Daten nicht von selbst zu löschen. */
export function requestPersistentStorage() {
  if (persistAsked || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}

export async function storageIsPersistent() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
