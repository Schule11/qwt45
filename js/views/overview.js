// Bildschirm "Übersicht": Kennzahlen (Monat | Jahr), Hinweise, zuletzt erfasst.

import { h, mount } from '../ui.js';
import { isIOS, isStandalone } from '../ui.js';
import { state, sumBookings, bookingYears, updateLocal } from '../data.js';
import { formatMoney, MONTHS, todayISO } from '../format.js';
import { backupDue, snoozeUntil } from '../notices.js';
import { doExport } from './settings.js';
import { bookingRow, pageHeader } from './components.js';

let selectedYear = new Date().getFullYear();

export function render(root) {
  const today = todayISO();
  const ym = today.slice(0, 7);

  const monthSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(ym)));

  const years = bookingYears();
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const yearSums = sumBookings(state.bookings.filter((b) => b.date.startsWith(String(selectedYear))));

  const recent = [...state.bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

  // Monatsname; steht im Jahr ein anderes Jahr, zur Klarheit mit Jahreszahl
  const curYear = Number(ym.slice(0, 4));
  const monthName = MONTHS[Number(ym.slice(5, 7)) - 1] + (selectedYear !== curYear ? ` ${curYear}` : '');
  const yearSel = h('select', {
    class: 'kpi-year',
    'aria-label': 'Jahr wählen',
    onchange: (e) => { selectedYear = Number(e.target.value); rerender(root); },
  }, years.map((y) => h('option', { value: String(y) }, String(y))));
  yearSel.value = String(selectedYear);

  // Ab 10.000 € zeigt die Übersicht volle Euro (genaue Beträge: Auswertung)
  const big = [monthSums, yearSums].some((x) => Math.max(Math.abs(x.income), Math.abs(x.expense), Math.abs(x.balance)) >= 1000000);
  const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const money = (c) => (big ? eur0.format(Math.round(c / 100)) : formatMoney(c));
  const signed = (c, type) => (type === 'income' ? '+' : '−') + money(Math.abs(c));
  const balance = (c) => (c < 0 ? '−' + money(-c) : c > 0 ? '+' + money(c) : money(0));

  const kpiRow = (label, key, m, y, cls = '') => [
    h('span', { class: 'kpi-label' }, label),
    h('span', { class: `kpi-val ${cls}`, 'data-k': `month-${key}` }, m),
    h('span', { class: `kpi-val ${cls}`, 'data-k': `year-${key}` }, y),
  ];

  mount(root,
    pageHeader('Übersicht'),
    installHint(),

    // Kennzahlen: aktueller Monat und gewähltes Jahr nebeneinander
    h('section', { class: 'card kpi', 'aria-label': 'Kennzahlen' },
      h('div', { class: 'kpi-grid' },
        h('span'),
        h('span', { class: 'kpi-head' }, monthName),
        h('span', { class: 'kpi-head' }, yearSel),
        kpiRow('Einnahmen', 'income', signed(monthSums.income, 'income'), signed(yearSums.income, 'income'), 'pos'),
        kpiRow('Ausgaben', 'expense', signed(monthSums.expense, 'expense'), signed(yearSums.expense, 'expense'), 'neg'),
        h('span', { class: 'kpi-sep' }),
        kpiRow('Saldo', 'balance', balance(monthSums.balance), balance(yearSums.balance), 'kpi-total')),
      big ? h('p', { class: 'kpi-note' }, 'Auf volle Euro gerundet – genaue Beträge in der Auswertung.') : null),

    backupNotice(),

    h('h2', { class: 'section-title' }, 'Zuletzt erfasst'),
    recent.length
      ? [h('div', { class: 'rows' }, recent.map(bookingRow)),
        h('p', { style: 'text-align:center; margin: 8px 0 0' }, h('a', { href: '#/buchungen', class: 'btn-text', style: 'display:inline-block' }, 'Alle Buchungen'))]
      : h('div', { class: 'empty' },
        h('strong', null, 'Noch nichts erfasst'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'),
  );
  // Negativen Saldo rot färben
  for (const el of root.querySelectorAll('.kpi-total')) if (el.textContent.startsWith('−')) el.classList.add('neg');
  fitKpi(root.querySelector('.kpi-grid'));
}

/**
 * Große Beträge (z. B. über 10.000 €) passen nicht immer in die Spalten.
 * Dann werden alle Zahlen der Karte gleichmäßig etwas kleiner.
 */
function fitKpi(grid) {
  if (!grid) return;
  grid.style.removeProperty('--kpi-scale');
  let scale = 1;
  for (const el of grid.querySelectorAll('.kpi-val')) {
    if (el.scrollWidth > el.clientWidth) scale = Math.min(scale, el.clientWidth / el.scrollWidth);
  }
  if (scale < 1) grid.style.setProperty('--kpi-scale', Math.max(0.55, scale * 0.97).toFixed(3));
}

window.addEventListener('resize', () => fitKpi(document.querySelector('.kpi-grid')));

function rerender(root) {
  root.replaceChildren();
  render(root);
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
