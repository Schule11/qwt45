// Zahl am App-Symbol (Home-Bildschirm): Anzahl offener Zahlungen.
// iPhone: ab iOS 16.4, nur in der installierten App. iOS verlangt dafür die
// Erlaubnis für Mitteilungen – die App verschickt aber keine Mitteilungen.

import { state, openBookings, updateLocal } from './data.js';

export function badgeSupported() {
  return 'setAppBadge' in navigator;
}

export function updateBadge() {
  if (!badgeSupported()) return;
  try {
    const n = state.local.appBadge ? openBookings().length : 0;
    const p = n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    p?.catch?.(() => {});
  } catch { /* nicht unterstützt */ }
}

/** Ein-/Ausschalten. Muss direkt im Tipp aufgerufen werden (Erlaubnis-Abfrage). */
export async function enableBadge(on) {
  if (on && 'Notification' in window && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }
  await updateLocal({ appBadge: on }, { silent: true });
  updateBadge();
  return true;
}
