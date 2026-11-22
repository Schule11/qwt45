// Bildschirm "Übersicht": je ein Kasten für den aktuellen Monat, das aktuelle Jahr
// und die Überstunden; darunter Hinweise und die zuletzt erfassten Buchungen.
// Ein Tipp auf einen Kasten öffnet die passende Auswertung.

import { h, mount } from '../ui.js';
import { isIOS, isStandalone } from '../ui.js';
import { state, sumBookings, updateLocal } from '../data.js';
import { monthLabel, todayISO } from '../format.js';
import { backupDue, snoozeUntil } from '../notices.js';
import { doExport } from './settings.js';
import { bookingRow, pageHeader, statBlock, cardHead, tapCard } from './components.js';
import { balanceCard, missingHint } from './hours.js';
import { showMonth, showYear } from './report.js';

export function render(root) {
  const ym = todayISO().slice(0, 7);
  const year = ym.slice(0, 4);
  const monthSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(ym)));
  const yearSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(year)));

  const recent = [...state.bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  mount(root,
    pageHeader('Übersicht'),
    installHint(),

    // 1. Aktueller Monat
    tapCard({ onClick: () => showMonth(ym), id: 'ov-month' },
      cardHead('calendar', monthLabel(ym), { chevron: true }),
      statBlock(monthSums, { key: 'month' })),

    // 2. Aktuelles Jahr
    tapCard({ onClick: () => showYear(year), id: 'ov-year' },
      cardHead('chart', `Jahr ${year}`, { chevron: true }),
      statBlock(yearSums, { key: 'year' })),

    // 3. Überstunden: aktueller Stand, fehlende Monate
    balanceCard({ onClick: () => { location.hash = '#/stunden'; } }),
    missingHint(),

    backupNotice(),

    h('h2', { class: 'section-title' }, 'Zuletzt erfasst'),
    recent.length
      ? [h('div', { class: 'rows' }, recent.map(bookingRow)),
        h('p', { style: 'text-align:center; margin: 8px 0 0' }, h('a', { href: '#/finanzen/buchungen', class: 'btn-text', style: 'display:inline-block' }, 'Alle Buchungen'))]
      : h('div', { class: 'empty' },
        h('strong', null, 'Noch nichts erfasst'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'),
  );
}

/** Erinnerung an ein Backup */
function backupNotice() {
  const due = backupDue();
  if (!due) return null;
  const btn = h('button', { type: 'button', class: 'btn primary', onclick: () => doExport(btn) }, 'Backup erstellen');
  return h('div', { class: 'notice' },
    h('strong', null, 'Zeit für ein Backup'),
    h('p', null, due.last
      ? `Dein letztes Backup ist ${due.ageDays} Tage alt und seitdem hat sich etwas geändert.`
      : 'Du hast noch kein Backup gemacht. Sichere deine Daten, damit nichts verloren geht.'),
    h('div', { class: 'notice-actions' },
      btn,
      h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ backupSnoozeUntil: snoozeUntil(3) }) }, 'Später')));
}

/** Auf dem iPhone im Safari-Tab: Hinweis, die App zum Home-Bildschirm hinzuzufügen. */
function installHint() {
  if (!isIOS() || isStandalone() || state.local.installHintDismissed) return null;
  return h('div', { class: 'notice' },
    h('strong', null, 'Als App installieren'),
    h('p', null, 'Tippe in Safari auf das Teilen-Symbol (Quadrat mit Pfeil, ggf. erst auf „•••“) und dann auf „Zum Home-Bildschirm“.'),
    h('p', null, 'Wichtig: Die installierte App hat ihren eigenen Speicher. Trage deine Daten nur dort ein – nicht hier im Safari-Tab.'),
    h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ installHintDismissed: true }) }, 'Verstanden'));
}
