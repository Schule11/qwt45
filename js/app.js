// Start der App: Daten laden, Bildschirme anzeigen, Offline-Modus einrichten.

import { load, onChange } from './data.js';
import { h, toast, applyTheme } from './ui.js';
import { APP_VERSION, storageKey } from './config.js';
import { openBookingForm } from './views/form.js';
import { isFormOpen, onFormClosed } from './views/formState.js';
import * as overview from './views/overview.js';
import * as finances from './views/finances.js';
import * as settings from './views/settings.js';
import * as hours from './views/hours.js';
import { runRecurring } from './recurring.js';
import { formatSigned } from './format.js';

const routes = {
  uebersicht: overview,
  finanzen: finances, // Buchungen und Auswertung (Unteransicht: buchungen | monat | jahr)
  stunden: hours,
  einstellungen: settings,
};

// Frühere Adressen (vor der Zusammenlegung) weiter verstehen
const OLD_ROUTES = { buchungen: ['finanzen', 'buchungen'], auswertung: ['finanzen', 'monat'] };

const view = document.getElementById('view');

/** "#/finanzen/monat" → { name: 'finanzen', sub: 'monat' } */
function currentRoute() {
  let [name, sub = null] = location.hash.replace(/^#\/?/, '').split('/');
  if (OLD_ROUTES[name]) [name, sub] = OLD_ROUTES[name];
  return routes[name] ? { name, sub } : { name: 'uebersicht', sub: null };
}

function render({ keepScroll = false } = {}) {
  const { name, sub } = currentRoute();
  const y = window.scrollY;
  view.replaceChildren();
  routes[name].render(view, sub);
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  // Der +-Knopf erfasst auf "Stunden" einen Monat, sonst eine Buchung
  document.getElementById('fab').setAttribute('aria-label', name === 'stunden' ? 'Monat erfassen' : 'Neue Buchung');
  window.scrollTo(0, keepScroll ? y : 0);
}

async function boot() {
  applyTheme();
  try {
    await load();
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('div', { class: 'card' },
      h('h2', { class: 'card-title' }, 'Speicher nicht verfügbar'),
      h('p', null, 'Die App kann ihre Daten auf diesem Gerät nicht öffnen. '
        + 'Im privaten Modus von Safari funktioniert das nicht – bitte normal öffnen.'),
      h('p', { class: 'muted small' }, String(err.message || err))));
    return;
  }

  render();
  window.addEventListener('hashchange', () => render());
  onChange(() => render({ keepScroll: true }));

  // Daueraufträge: fällige Zahlungen buchen – jetzt und bei jeder Rückkehr in die App
  bookDuePayments();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bookDuePayments();
  });

  // Großer Plus-Button: Formular sofort öffnen (ohne Verzögerung, wegen iPhone-Tastatur)
  document.getElementById('fab').addEventListener('click', () => {
    if (currentRoute().name === 'stunden') hours.openHoursForm();
    else openBookingForm();
  });

  // Gerade erst aktualisiert?
  try {
    if (sessionStorage.getItem(storageKey('justUpdated'))) {
      sessionStorage.removeItem(storageKey('justUpdated'));
      toast(`App aktualisiert auf Version ${APP_VERSION}`);
    }
  } catch { /* egal */ }

  registerServiceWorker();
}

// ---------- Daueraufträge ----------

let booking = false;

/** Fällige Zahlungen aus Daueraufträgen buchen und kurz Bescheid geben */
async function bookDuePayments() {
  if (booking) return;
  booking = true;
  try {
    const created = await runRecurring();
    if (created.length === 1) {
      const b = created[0];
      toast(`Dauerauftrag gebucht: ${b.description || 'Zahlung'} ${formatSigned(b.amountCents, b.type)}`);
    } else if (created.length > 1) {
      toast(`${created.length} Zahlungen aus Daueraufträgen gebucht`);
    }
  } catch (err) {
    console.error('Daueraufträge:', err);
  } finally {
    booking = false;
  }
}

// ---------- Offline-Modus & Updates ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let waitingWorker = null;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Erste Installation: nicht neu laden. Nur bei Updates.
    if (!hadController || reloading) return;
    reloading = true;
    try { sessionStorage.setItem(storageKey('justUpdated'), '1'); } catch { /* egal */ }
    location.reload();
  });

  // Update erst einspielen, wenn gerade kein Formular offen ist
  const applyUpdate = () => {
    if (!waitingWorker || isFormOpen()) return;
    waitingWorker.postMessage('skipWaiting');
    waitingWorker = null;
  };
  onFormClosed(applyUpdate);

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const onWaiting = (worker) => { waitingWorker = worker; applyUpdate(); };
    if (reg.waiting && navigator.serviceWorker.controller) onWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) onWaiting(worker);
      });
    });
    // Beim Zurückkehren in die App nach Updates schauen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Offline-Modus nicht verfügbar:', err));
}

boot();
