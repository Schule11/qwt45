// Wiederverwendbare Bausteine für mehrere Bildschirme.

import { h, icon, toast, alertDialog } from '../ui.js';
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

/** Einnahmen / Ausgaben / Saldo als Block; key (z. B. "month") kennzeichnet die Werte (data-k) */
export function statBlock(sums, { key = null } = {}) {
  const k = (name) => (key ? `${key}-${name}` : null);
  return [
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Einnahmen'),
      h('span', { class: 'stat-value pos', 'data-k': k('income') }, formatSigned(sums.income, 'income'))),
    h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, 'Ausgaben'),
      h('span', { class: 'stat-value neg', 'data-k': k('expense') }, formatSigned(sums.expense, 'expense'))),
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, 'Saldo'),
      h('span', { class: `stat-value ${sums.balance < 0 ? 'neg' : ''}`, 'data-k': k('balance') }, formatBalance(sums.balance))),
  ];
}

/** Kopf eines Kastens: Symbol im farbigen Feld, Titel, rechts optional › */
export function cardHead(iconName, title, { chevron = false } = {}) {
  return h('div', { class: 'ov-head' },
    h('span', { class: 'ov-icon' }, icon(iconName, 22)),
    h('span', { class: 'ov-title' }, title),
    chevron ? h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›') : null);
}

/** Kasten; mit onClick ist er als Ganzes antippbar (z. B. auf der Übersicht) */
export function tapCard({ onClick = null, className = '', id = null, label = null }, ...children) {
  const cls = `card ${className}`.trim();
  if (!onClick) return h('section', { class: cls, id, 'aria-label': label }, children);
  return h('button', { type: 'button', class: `${cls} tap-card`, id, onclick: onClick }, children);
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

/** Eingabefeld, das beim Verlassen prüft und speichert */
export function settingField({ id, label, value, unit, inputmode = 'text', placeholder = '', hint = null, onSave }) {
  const input = h('input', {
    class: 'field', id, type: 'text', inputmode, autocomplete: 'off', value, placeholder,
    enterkeyhint: 'done',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } },
    onchange: async () => {
      const result = await onSave(input.value.trim());
      if (result === false) { input.value = value; return; } // ungültig → alter Wert
      if (typeof result === 'string') input.value = result;   // schön formatiert
      value = input.value;
      toast('Gespeichert');
    },
  });
  return [
    h('label', { class: 'lbl', for: id }, label),
    unit ? h('div', { class: 'unit-field' }, input, h('span', { class: 'unit' }, unit)) : input,
    hint ? h('p', { class: 'hint' }, hint) : null,
  ];
}

export function invalid(msg) {
  alertDialog({ title: 'Ungültige Eingabe', text: msg });
  return false;
}

/** Zeile wie in den iPhone-Einstellungen: Titel links, Wert rechts, Pfeil */
export function navRow(label, value, onClick, { id = null } = {}) {
  return h('button', { type: 'button', class: 'row nav-row', id, onclick: onClick },
    h('span', { class: 'nav-label' }, label),
    value != null ? h('span', { class: 'nav-value' }, value) : null,
    h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
}
