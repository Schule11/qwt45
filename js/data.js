// Daten der App: Alles wird beim Start in den Arbeitsspeicher geladen
// (das sind auch nach Jahren nur ein paar tausend Einträge) und bei jeder
// Änderung sofort in die Datenbank auf dem Gerät geschrieben.
// Nur die Belegfotos bleiben in der Datenbank und werden bei Bedarf geladen.

import * as db from './db.js';
import { DEFAULT_SETTINGS, defaultCategoryRecords } from './defaults.js';

/**
 * Buchung:
 * {
 *   id, type: 'income'|'expense', date: 'JJJJ-MM-TT',
 *   amountCents: Integer, categoryId, description,
 *   receiptId: ID des Belegfotos oder null,
 *   recurringId: ID des Dauerauftrags, aus dem die Buchung entstanden ist (sonst fehlt das Feld),
 *   createdAt, updatedAt
 * }
 *
 * Daueraufträge (wiederkehrende Zahlungen) stehen in state.recurring – Aufbau und
 * Zeitplan siehe recurring.js.
 *
 * Überstunden (ein Eintrag je Monat, feste ID "h-JJJJ-MM" – so entstehen beim
 * Zusammenführen zweier Geräte keine doppelten Monate):
 * { id, month: 'JJJJ-MM', workedSec, paidSec, azkSec, note, createdAt, updatedAt }
 * Alle Stunden in Sekunden (ganze Zahlen): gearbeitet wird als Std:Min erfasst (1 Min = 60 s),
 * ausbezahlt und AZK als Kommazahl wie auf der Lohnabrechnung (0,01 Std = 36 s) – beides exakt.
 * azkSec = vom Arbeitszeitkonto ausbezahlt (fehlt die Angabe, zählt sie als 0).
 */
export const state = {
  bookings: [],
  categories: [],
  hours: [],
  recurring: [], // Daueraufträge
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

export function replaceInState(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

// ---------- Laden ----------

const DATA_VERSION = 2;

// ---------- Umrechnung älterer Überstunden-Daten (bis Version 1.2: ganze Minuten) ----------

/**
 * Bis Version 1.2 wurde in ganzen Minuten gespeichert. Die Umrechnung ist 1:1
 * (Minuten × 60), damit sich der bisherige Stand um keine Sekunde ändert.
 * (Die damals eingetippte Kommazahl lässt sich nicht immer zurückgewinnen:
 * 0,13 und 0,14 Stunden wurden z. B. beide als 8 Minuten gespeichert.)
 */
export const legacyMinutesToSec = (minutes) => minutes * 60;

/** Überstunden-Eintrag im alten Format (…Minutes) in das neue (…Sec) umrechnen */
export function legacyHoursToSec(rec) {
  if (Number.isSafeInteger(rec.workedSec)) return rec;
  const { workedMinutes, paidMinutes, azkMinutes, ...rest } = rec;
  return {
    ...rest,
    workedSec: legacyMinutesToSec(workedMinutes),
    paidSec: legacyMinutesToSec(paidMinutes),
    azkSec: legacyMinutesToSec(Number.isSafeInteger(azkMinutes) ? azkMinutes : 0),
  };
}

export async function load() {
  let [bookings, categories, hours, recurring, meta] = await Promise.all([
    db.getAll('bookings'),
    db.getAll('categories'),
    db.getAll('hours'),
    db.getAll('recurring'),
    db.getAll('meta'),
  ]);
  const m = Object.fromEntries(meta.map((x) => [x.key, x.value]));

  if (categories.length === 0) {
    categories = defaultCategoryRecords();
    await db.write(['categories'], (s) => { for (const c of categories) s.categories.put(c); });
  }

  state.bookings = bookings;
  state.categories = categories;
  state.hours = hours;
  state.recurring = recurring;
  state.settings = { ...DEFAULT_SETTINGS, ...(m.settings || {}) };
  state.local = m.local || {};

  await migrate(m.dataVersion || 0);
}

/** Datenanpassungen für neue App-Versionen laufen hier genau einmal. */
async function migrate(from) {
  if (from >= DATA_VERSION) return;
  // Version 2: Überstunden in Sekunden statt Minuten (exakt für Std:Min und Kommazahlen)
  if (from < 2) {
    const converted = state.hours.filter((x) => !Number.isSafeInteger(x.workedSec)).map(legacyHoursToSec);
    const settings = { ...state.settings };
    let settingsChanged = false;
    if (Number.isSafeInteger(settings.hoursStartMinutes)) {
      settings.hoursStartSec = legacyMinutesToSec(settings.hoursStartMinutes);
      settingsChanged = true;
    }
    if ('hoursStartMinutes' in settings || 'hoursFormat' in settings) {
      delete settings.hoursStartMinutes;
      delete settings.hoursFormat;
      settingsChanged = true;
    }
    await db.write(['hours', 'meta'], (s) => {
      for (const x of converted) s.hours.put(x);
      if (settingsChanged) s.meta.put({ key: 'settings', value: settings });
    });
    for (const x of converted) replaceInState(state.hours, x);
    state.settings = settings;
  }
  await db.write(['meta'], (s) => s.meta.put({ key: 'dataVersion', value: DATA_VERSION }));
}

// ---------- Kategorien ----------

export function categoryById(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function categoryName(id) {
  return categoryById(id)?.name || 'Ohne Kategorie';
}

/** Kategorien eines Typs in der gewählten Reihenfolge */
export function categoriesFor(type) {
  return state.categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.order - b.order);
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

export function recurringCount(categoryId) {
  return state.recurring.filter((r) => r.categoryId === categoryId).length;
}

/** Neue oder geänderte Kategorie speichern */
export async function saveCategory(input) {
  const existing = input.id ? categoryById(input.id) : null;
  const sameType = state.categories.filter((c) => c.type === input.type);
  const cat = {
    key: null,
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
  const movedRec = state.recurring
    .filter((r) => r.categoryId === id)
    .map((r) => ({ ...r, categoryId: moveToId, updatedAt: now }));
  if ((moved.length || movedRec.length) && !categoryById(moveToId)) throw new Error('Bitte eine Kategorie wählen, in die die Buchungen verschoben werden.');
  await db.write(['categories', 'bookings', 'recurring', 'tombstones'], (s) => {
    s.categories.delete(id);
    s.tombstones.put({ id, kind: 'category', deletedAt: now });
    for (const b of moved) s.bookings.put(b);
    for (const r of movedRec) s.recurring.put(r);
  });
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const b of moved) replaceInState(state.bookings, b);
  for (const r of movedRec) replaceInState(state.recurring, r);
  emitChange();
  return moved.length;
}

// ---------- Buchungen ----------

/** Neueste zuerst (nach Datum, bei gleichem Datum nach Erfassungszeit) */
export function sortBookings(list) {
  return list.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1));
}

/** Summen einer Liste: { income, expense, balance } in Cent */
export function sumBookings(list) {
  let income = 0;
  let expense = 0;
  for (const b of list) {
    if (b.type === 'income') income += b.amountCents;
    else expense += b.amountCents;
  }
  return { income, expense, balance: income - expense };
}

/** Alle Jahre mit Buchungen (und das aktuelle), neueste zuerst */
export function bookingYears() {
  const years = new Set(state.bookings.map((b) => Number(b.date.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Alle Monate mit Buchungen (und der aktuelle) als "JJJJ-MM", neueste zuerst */
export function bookingMonths(currentYm) {
  const months = new Set(state.bookings.map((b) => b.date.slice(0, 7)));
  months.add(currentYm);
  return [...months].sort().reverse();
}

/**
 * Speichert eine neue oder geänderte Buchung.
 * receiptChange: { add: { data, type, width, height } } | { remove: true } | null
 */
export async function saveBooking(input, receiptChange = null) {
  const existing = input.id ? state.bookings.find((b) => b.id === input.id) : null;
  const now = nowISO();
  const booking = {
    receiptId: null,
    description: '',
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

  replaceInState(state.bookings, booking);
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

// ---------- Überstunden ----------

/** Monat speichern (neu oder geändert): ym = "JJJJ-MM" */
export async function saveHours(ym, { workedSec, paidSec, azkSec = 0, note = '' }) {
  const id = `h-${ym}`;
  const existing = state.hours.find((x) => x.id === id);
  const now = nowISO();
  const rec = {
    id,
    month: ym,
    workedSec,
    paidSec,
    azkSec,
    note: String(note || '').trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.write(['hours'], (s) => s.hours.put(rec));
  replaceInState(state.hours, rec);
  requestPersistentStorage();
  emitChange();
  return rec;
}

export async function deleteHours(ym) {
  const id = `h-${ym}`;
  const now = nowISO();
  await db.write(['hours', 'tombstones'], (s) => {
    s.hours.delete(id);
    s.tombstones.put({ id, kind: 'hours', deletedAt: now });
  });
  state.hours = state.hours.filter((x) => x.id !== id);
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
