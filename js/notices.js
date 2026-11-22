// Erinnerung an ein Backup (Hinweis auf der Übersicht).

import { state } from './data.js';

const DAY = 24 * 60 * 60 * 1000;

/** Ist ein Backup fällig? Gibt null oder { last, ageDays } zurück. */
export function backupDue(now = Date.now()) {
  const days = state.settings.backupReminderDays;
  if (!days || !state.bookings.length) return null;
  const { lastBackupAt: last, bookingsAtLastBackup, backupSnoozeUntil } = state.local;
  if (backupSnoozeUntil && Date.parse(backupSnoozeUntil) > now) return null;

  const changed = !last
    || state.bookings.length !== bookingsAtLastBackup
    || state.bookings.some((b) => b.updatedAt > last);
  if (!changed) return null;

  // Ohne bisheriges Backup: Erinnerung eine Woche nach der ersten Buchung
  const reference = last || state.bookings.reduce((min, b) => (b.createdAt < min ? b.createdAt : min), state.bookings[0].createdAt);
  const ageDays = Math.floor((now - Date.parse(reference)) / DAY);
  if (ageDays < (last ? days : Math.min(7, days))) return null;
  return { last, ageDays };
}

export function snoozeUntil(days, now = Date.now()) {
  return new Date(now + days * DAY).toISOString();
}
