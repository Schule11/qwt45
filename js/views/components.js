// Wiederverwendbare Bausteine für mehrere Bildschirme.

import { h, icon, toast } from '../ui.js';
import { categoryName, contactById, contactLabel, isOpen, daysOpen, isOverdue, markPaid, saveBooking, recordById, isShiftedYear, euerYear } from '../data.js';
import { paymentLabel } from '../defaults.js';
import { formatDate, formatSigned, formatMoney, formatProfit, formatKm } from '../format.js';
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

/** Offene Einnahme abhaken – mit "Rückgängig" */
export async function tickPaid(b) {
  const previous = await markPaid(b.id);
  if (!previous) return;
  toast('Als bezahlt markiert', { action: { label: 'Rückgängig', onClick: () => saveBooking(previous) } });
}

/** Zeile für eine offene Einnahme: links zum Abhaken, rechts zum Bearbeiten */
function openRow(b, title, cat, person) {
  const days = daysOpen(b);
  const overdue = isOverdue(b);
  const sub = [formatDate(b.serviceDate || b.date)];
  if (title !== cat) sub.push(cat);
  if (person && title !== person) sub.push(person);
  const inv = recordById('invoices', b.invoiceId);
  if (inv && !inv.cancelled) sub.push(`Rechnung ${inv.number}`);
  const age = days === 0 ? 'seit heute offen' : days === 1 ? 'seit 1 Tag offen' : `seit ${days} Tagen offen`;
  return h('div', { class: `row open-row${overdue ? ' overdue' : ''}` },
    h('button', {
      type: 'button',
      class: 'check',
      'aria-label': `${title}, ${formatMoney(b.amountCents)}: als bezahlt abhaken`,
      onclick: () => tickPaid(b),
    }),
    h('button', {
      type: 'button',
      class: 'row-body',
      'aria-label': `Offene Einnahme ${formatMoney(b.amountCents)}, ${title}, ${age}. Bearbeiten`,
      onclick: () => openBookingForm(b),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, title),
      h('div', { class: 'row-sub' }, h('span', { class: 'ell' }, sub.join(' · '))),
      h('div', { class: `row-age${overdue ? ' neg' : ''}` }, age)),
    h('div', { class: 'amt open' }, formatMoney(b.amountCents))));
}

/** Eine Zeile in der Buchungsliste – Tippen öffnet die Buchung zum Bearbeiten. */
export function bookingRow(b) {
  const cat = categoryName(b.categoryId);
  const person = contactLabel(contactById(b.personId));
  const title = b.description || (b.tripTo ? `Fahrt: ${b.tripTo}` : '') || person || cat;
  if (isOpen(b)) return openRow(b, title, cat, person);
  const sub = [formatDate(b.date)];
  if (title !== cat) sub.push(cat);
  if (person && title !== person) sub.push(person);
  if (b.km) sub.push(`${formatKm(b.km)} km`);
  if (b.businessPercent && b.businessPercent < 100) sub.push(`${b.businessPercent} % von ${formatMoney(b.fullAmountCents)}`);
  if (b.payment) sub.push(paymentLabel(b.payment));
  const inv = recordById('invoices', b.invoiceId);
  if (inv && !inv.cancelled) sub.push(`${inv.kind === 'receipt' ? 'Quittung' : 'Rechnung'} ${inv.number}`);
  if (isShiftedYear(b)) sub.push(`zählt für ${euerYear(b)}`);
  const kind = b.type === 'income' ? 'Einnahme' : 'Ausgabe';

  // Bezahlt: grüner Kreis mit Haken – an derselben Stelle wie der Kreis offener Zahlungen
  return h('button', {
    type: 'button',
    class: 'row paid-row',
    'aria-label': `${kind} ${formatMoney(b.amountCents)}, ${title}, ${formatDate(b.date)}, bezahlt. Bearbeiten`,
    onclick: () => openBookingForm(b),
  },
  h('span', { class: 'check done', 'aria-hidden': 'true' }, icon('check', 18)),
  h('div', { class: 'row-main' },
    h('div', { class: 'row-title' }, title),
    h('div', { class: 'row-sub' }, h('span', { class: 'ell' }, sub.join(' · ')), b.receiptId ? icon('receipt', 16) : null)),
  h('div', { class: `amt ${b.type}` }, formatSigned(b.amountCents, b.type)));
}

/** Einnahmen / Ausgaben / Gewinn als Block */
export function statBlock(sums, labels = {}) {
  return [
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, labels.income || 'Einnahmen'),
      h('span', { class: 'stat-value pos' }, formatSigned(sums.income, 'income'))),
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, labels.expense || 'Ausgaben'),
      h('span', { class: 'stat-value neg' }, formatSigned(sums.expense, 'expense'))),
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, sums.profit < 0 ? 'Verlust' : 'Gewinn'),
      h('span', { class: `stat-value ${sums.profit < 0 ? 'neg' : ''}` }, formatProfit(sums.profit))),
  ];
}

/** Jahresauswahl als Klappliste */
export function yearSelect(years, value, onChange, { withAll = false, label = 'Jahr' } = {}) {
  const select = h('select', { class: 'field', 'aria-label': label, onchange: (e) => onChange(e.target.value) },
    withAll ? h('option', { value: 'all' }, 'Alle Jahre') : null,
    years.map((y) => h('option', { value: String(y) }, String(y))));
  select.value = String(value);
  return select;
}
