// Daueraufträge: wiederkehrende Einnahmen und Ausgaben (z. B. Miete, Versicherung, Abos).
//
// Ein Dauerauftrag:
// {
//   id, type: 'income'|'expense', amountCents, categoryId, description,
//   startDate: 'JJJJ-MM-TT'  erste Zahlung des aktuellen Plans (legt auch den Tag im Monat fest),
//   interval: 1 | 3 | 6 | 12  alle wie viele Monate,
//   limit: Anzahl Zahlungen des Plans oder null (= unbegrenzt),
//   done: wie viele Zahlungen des Plans schon erledigt sind (gebucht oder bewusst übersprungen),
//   lastDate: Datum der zuletzt erledigten Zahlung oder null,
//   createdAt, updatedAt
// }
//
// Wird ein Dauerauftrag geändert (z. B. Mieterhöhung), beginnt ein neuer Plan ab der
// nächsten Zahlung: startDate = nächste Zahlung, limit = verbleibende Zahlungen, done = 0.
// Bereits gebuchte Zahlungen bleiben so, wie sie sind.
//
// Ohne Server kann die App nicht zu einer bestimmten Uhrzeit buchen. Fällige Zahlungen
// werden deshalb beim Öffnen der App gebucht (auch verpasste Termine). Jede erzeugte
// Buchung hat eine feste ID aus Dauerauftrag und Datum – so entsteht auch beim
// Zusammenführen zweier Geräte nie eine Zahlung doppelt.

import * as db from './db.js';
import { state, emitChange, uid, nowISO, replaceInState, requestPersistentStorage } from './data.js';
import { todayISO, formatDate, MONTHS } from './format.js';

export const INTERVALS = [
  [1, 'Monatlich'],
  [3, 'Vierteljährlich'],
  [6, 'Halbjährlich'],
  [12, 'Jährlich'],
];

const pad = (n) => String(n).padStart(2, '0');

// ---------- Zeitplan ----------

/**
 * Datum der n-ten Zahlung (ab 0) des Plans. Gibt es den Tag in einem Monat nicht
 * (z. B. 31. im April), wird am letzten Tag des Monats gebucht.
 */
export function dueDate(rec, n) {
  const [y, m, d] = rec.startDate.split('-').map(Number);
  const total = (m - 1) + n * rec.interval;
  const yy = y + Math.floor(total / 12);
  const mm = (total % 12) + 1;
  const lastDay = new Date(yy, mm, 0).getDate();
  return `${yy}-${pad(mm)}-${pad(Math.min(d, lastDay))}`;
}

export function isEnded(rec) {
  return rec.limit != null && rec.done >= rec.limit;
}

/** Nächste Zahlung (JJJJ-MM-TT) oder null, wenn der Dauerauftrag beendet ist */
export function nextDate(rec) {
  return isEnded(rec) ? null : dueDate(rec, rec.done);
}

/** Verbleibende Zahlungen oder null (unbegrenzt) */
export function remaining(rec) {
  return rec.limit == null ? null : Math.max(0, rec.limit - rec.done);
}

/** Letzte geplante Zahlung oder null (unbegrenzt) */
export function lastPlannedDate(rec) {
  return rec.limit == null || rec.limit === 0 ? null : dueDate(rec, rec.limit - 1);
}

/** Wie viele noch offene Zahlungen sind bis einschließlich `until` fällig? */
export function dueCount(rec, until = todayISO()) {
  let n = 0;
  while (!(rec.limit != null && rec.done + n >= rec.limit) && dueDate(rec, rec.done + n) <= until) {
    n += 1;
    if (n > 1000) break; // Sicherung gegen Endlosschleifen bei kaputten Daten
  }
  return n;
}

/** "Monatlich am 1." · "Jährlich am 15. März" · "Vierteljährlich am 31. (bzw. Monatsende)" */
export function describeRhythm(rec) {
  const day = Number(rec.startDate.slice(8, 10));
  const label = INTERVALS.find(([v]) => v === rec.interval)?.[1] || `Alle ${rec.interval} Monate`;
  if (rec.interval === 12) return `${label} am ${day}. ${MONTHS[Number(rec.startDate.slice(5, 7)) - 1]}`;
  return `${label} am ${day}.${day > 28 ? ' (bzw. Monatsende)' : ''}`;
}

/** Status in Worten: "Nächste Zahlung 01.12.2026 · unbegrenzt" / "… · noch 5 Zahlungen" / "Beendet" */
export function describeStatus(rec) {
  const next = nextDate(rec);
  if (!next) return rec.lastDate ? `Beendet · letzte Zahlung ${formatDate(rec.lastDate)}` : 'Beendet';
  const left = remaining(rec);
  return `Nächste Zahlung ${formatDate(next)} · ${left == null ? 'unbegrenzt' : `noch ${left} ${left === 1 ? 'Zahlung' : 'Zahlungen'}`}`;
}

/** Feste ID der Buchung, die ein Dauerauftrag an einem Tag erzeugt */
export function bookingIdFor(rec, date) {
  return `b-${rec.id}-${date}`;
}

export function recurringById(id) {
  return id ? state.recurring.find((r) => r.id === id) || null : null;
}

/** Aktive zuerst (nach nächster Zahlung), dann beendete */
export function recurringSorted() {
  return [...state.recurring].sort((a, b) => {
    const na = nextDate(a);
    const nb = nextDate(b);
    if (!!na !== !!nb) return na ? -1 : 1;
    if (na && nb && na !== nb) return na < nb ? -1 : 1;
    return (a.description || '').localeCompare(b.description || '', 'de');
  });
}

// ---------- Fällige Zahlungen buchen ----------

/**
 * Bucht alle fälligen Zahlungen aller Daueraufträge (bis einschließlich `today`).
 * Gibt die neu angelegten Buchungen zurück. Schon vorhandene oder auf diesem Gerät
 * gelöschte Buchungen werden nicht (noch einmal) angelegt.
 */
export async function runRecurring({ today = todayISO(), silent = false } = {}) {
  const due = state.recurring.filter((r) => dueCount(r, today) > 0);
  if (!due.length) return [];
  const tombstones = new Set(await db.getAllKeys('tombstones'));
  const existing = new Set(state.bookings.map((b) => b.id));
  const now = nowISO();
  const newBookings = [];
  const changed = [];
  for (const rec of due) {
    const n = dueCount(rec, today);
    let lastDate = rec.lastDate;
    for (let i = 0; i < n; i += 1) {
      const date = dueDate(rec, rec.done + i);
      const id = bookingIdFor(rec, date);
      lastDate = date;
      if (existing.has(id) || tombstones.has(id)) continue;
      existing.add(id);
      newBookings.push({
        id,
        type: rec.type,
        date,
        amountCents: rec.amountCents,
        categoryId: rec.categoryId,
        description: rec.description,
        receiptId: null,
        recurringId: rec.id,
        createdAt: now,
        updatedAt: now,
      });
    }
    changed.push({ ...rec, done: rec.done + n, lastDate, updatedAt: now });
  }
  await db.write(['bookings', 'recurring'], (s) => {
    for (const b of newBookings) s.bookings.put(b);
    for (const r of changed) s.recurring.put(r);
  });
  for (const b of newBookings) replaceInState(state.bookings, b);
  for (const r of changed) replaceInState(state.recurring, r);
  if (!silent) emitChange();
  return newBookings;
}

// ---------- Speichern, beenden, löschen ----------

/**
 * Neuen Dauerauftrag anlegen oder bestehenden ändern und fällige Zahlungen buchen.
 * input: { id?, type, amountCents, categoryId, description, startDate, interval, limit }
 *   startDate = erste Zahlung (neu) bzw. nächste Zahlung (ändern)
 *   limit = Anzahl Zahlungen ab startDate oder null (unbegrenzt)
 * skipPast: vergangene Termine (vor heute) nicht buchen, sondern überspringen.
 * Gibt { rec, created } zurück (created = neu angelegte Buchungen).
 */
export async function saveRecurring(input, { skipPast = false, today = todayISO() } = {}) {
  const existing = recurringById(input.id);
  const now = nowISO();
  let rec = {
    lastDate: null,
    ...existing,
    id: existing?.id || uid('rec'),
    type: input.type,
    amountCents: input.amountCents,
    categoryId: input.categoryId,
    description: String(input.description || '').trim(),
    startDate: input.startDate,
    interval: input.interval,
    limit: input.limit ?? null,
    done: 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (skipPast) {
    // Termine vor heute als erledigt markieren, ohne zu buchen
    const skip = dueCount(rec, shiftDay(today, -1));
    if (skip) rec = { ...rec, done: skip, lastDate: dueDate(rec, skip - 1) };
  }
  await db.write(['recurring'], (s) => s.recurring.put(rec));
  replaceInState(state.recurring, rec);
  requestPersistentStorage();
  const created = await runRecurring({ today, silent: true });
  emitChange();
  return { rec: recurringById(rec.id), created };
}

/** Beenden: keine weiteren Zahlungen (bereits gebuchte bleiben) */
export async function endRecurring(id) {
  const rec = recurringById(id);
  if (!rec) return;
  const ended = { ...rec, limit: rec.done, updatedAt: nowISO() };
  await db.write(['recurring'], (s) => s.recurring.put(ended));
  replaceInState(state.recurring, ended);
  emitChange();
}

/** Löschen: der Dauerauftrag verschwindet, bereits gebuchte Zahlungen bleiben */
export async function deleteRecurring(id) {
  const now = nowISO();
  await db.write(['recurring', 'tombstones'], (s) => {
    s.recurring.delete(id);
    s.tombstones.put({ id, kind: 'recurring', deletedAt: now });
  });
  state.recurring = state.recurring.filter((r) => r.id !== id);
  emitChange();
}

/** "2026-11-23", -1 → "2026-11-22" */
export function shiftDay(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + delta));
}
