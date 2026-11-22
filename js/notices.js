// Erinnerung an ein Backup (Hinweis auf der Übersicht).

import { state } from './data.js';

const DAY = 24 * 60 * 60 * 1000;

/** Ist ein Backup fällig? Gibt null oder { last, ageDays } zurück. */
export function backupDue(now = Date.now()) {
  const days = state.settings.backupReminderDays;
  const all = [...state.bookings, ...state.hours]; // Buchungen und Überstunden
  if (!days || !all.length) return null;
  const { lastBackupAt: last, bookingsAtLastBackup, hoursAtLastBackup = 0, backupSnoozeUntil } = state.local;
  if (backupSnoozeUntil && Date.parse(backupSnoozeUntil) > now) return null;

  const changed = !last
    || state.bookings.length !== bookingsAtLastBackup
    || state.hours.length !== hoursAtLastBackup
    || all.some((x) => x.updatedAt > last);
  if (!changed) return null;

  // Ohne bisheriges Backup: Erinnerung eine Woche nach dem ersten Eintrag
  const reference = last || all.reduce((min, x) => (x.createdAt < min ? x.createdAt : min), all[0].createdAt);
  const ageDays = Math.floor((now - Date.parse(reference)) / DAY);
  if (ageDays < (last ? days : Math.min(7, days))) return null;
  return { last, ageDays };
}

export function snoozeUntil(days, now = Date.now()) {
  return new Date(now + days * DAY).toISOString();
}
