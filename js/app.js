// Start der App: Daten laden, Bildschirme anzeigen, Offline-Modus einrichten.

import { load, onChange } from './data.js';
import { h, toast, applyTheme } from './ui.js';
import { APP_VERSION } from './config.js';
import { updateBadge } from './badge.js';
import { preloadLogo } from './logo.js';
import { openBookingForm, isFormOpen, onFormClosed } from './views/form.js';
import * as overview from './views/overview.js';
import * as bookings from './views/bookings.js';
import * as report from './views/report.js';
import * as settings from './views/settings.js';

const routes = {
  uebersicht: overview,
  buchungen: bookings,
  auswertung: report,
  einstellungen: settings,
};

const view = document.getElementById('view');

function currentRoute() {
  const name = location.hash.replace(/^#\/?/, '');
  return routes[name] ? name : 'uebersicht';
}

function render({ keepScroll = false } = {}) {
  const name = currentRoute();
  const y = window.scrollY;
  view.replaceChildren();
  routes[name].render(view);
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
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
  updateBadge();
  preloadLogo(); // für PDFs (Auswertung, Rechnungen)
  window.addEventListener('hashchange', () => render());
  onChange(() => { render({ keepScroll: true }); updateBadge(); });

  // Großer Plus-Button: Formular sofort öffnen (ohne Verzögerung, wegen iPhone-Tastatur)
  document.getElementById('fab').addEventListener('click', () => openBookingForm());

  // Gerade erst aktualisiert?
  try {
    if (sessionStorage.getItem('justUpdated')) {
      sessionStorage.removeItem('justUpdated');
      toast(`App aktualisiert auf Version ${APP_VERSION}`);
    }
  } catch { /* egal */ }

  registerServiceWorker();
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
    try { sessionStorage.setItem('justUpdated', '1'); } catch { /* egal */ }
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
