// Wiederverwendbare Bausteine für mehrere Bildschirme.

import { h, icon } from '../ui.js';
import { categoryName } from '../data.js';
import { formatDate, formatSigned, formatMoney, formatBalance } from '../format.js';
import { openBookingForm } from './form.js';

/** Seitenkopf: großer Titel links, Einstellungen (Zahnrad) oben rechts */
export function pageHeader(title, { active = false } = {}) {
  return h('div', { class: 'page-head' },
    h('h1', { class: 'page-title' }, title),
    h('a', {
      href: '#/einstellungen',
      class: 'round-btn settings-btn',
      'data-route': 'einstellungen',
      'aria-label': 'Einstellungen',
      'aria-current': active ? 'page' : null,
    }, icon('gear', 23)));
}

/** Eine Zeile in der Buchungsliste – Tippen öffnet die Buchung zum Bearbeiten. */
export function bookingRow(b) {
  const cat = categoryName(b.categoryId);
  const title = b.description || cat;
  const sub = [formatDate(b.date)];
  if (title !== cat) sub.push(cat);
  const kind = b.type === 'income' ? 'Einnahme' : 'Ausgabe';
  return h('button', {
    type: 'button',
    class: 'row',
    'aria-label': `${kind} ${formatMoney(b.amountCents)}, ${title}, ${formatDate(b.date)}. Bearbeiten`,
    onclick: () => openBookingForm(b),
  },
  h('div', { class: 'row-main' },
    h('div', { class: 'row-title' }, title),
    h('div', { class: 'row-sub' }, h('span', { class: 'ell' }, sub.join(' · ')), b.receiptId ? icon('receipt', 16) : null)),
  h('div', { class: `amt ${b.type}` }, formatSigned(b.amountCents, b.type)));
}

/** Einnahmen / Ausgaben / Saldo als Block */
export function statBlock(sums) {
  return [
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Einnahmen'),
      h('span', { class: 'stat-value pos' }, formatSigned(sums.income, 'income'))),
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Ausgaben'),
      h('span', { class: 'stat-value neg' }, formatSigned(sums.expense, 'expense'))),
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, 'Saldo'),
      h('span', { class: `stat-value ${sums.balance < 0 ? 'neg' : ''}` }, formatBalance(sums.balance))),
  ];
}

/** Auswahl als Klappliste; options: [[Wert, Text], …] */
export function selectField(options, value, onChange, { label }) {
  const select = h('select', { class: 'field', 'aria-label': label, onchange: (e) => onChange(e.target.value) },
    options.map(([v, text]) => h('option', { value: String(v) }, text)));
  select.value = String(value);
  return select;
}

/** Jahresauswahl als Klappliste */
export function yearSelect(years, value, onChange, { withAll = false, label = 'Jahr' } = {}) {
  const options = years.map((y) => [y, String(y)]);
  if (withAll) options.unshift(['all', 'Alle Jahre']);
  return selectField(options, value, onChange, { label });
}
