// Bildschirm "Übersicht": Kennzahlen (Monat | Jahr), offene Zahlungen, Hinweise, zuletzt erfasst.

import { h, mount, icon } from '../ui.js';
import { isIOS, isStandalone } from '../ui.js';
import { state, sumBookings, bookingYears, updateLocal, openBookings, sumOpen, isOverdue, needsReceipt } from '../data.js';
import { formatMoney } from '../format.js';
import { showBookings } from './bookings.js';
import { smallBusinessStatus, tradeTaxStatus, backupDue, snoozeUntil } from '../notices.js';
import { openContactList } from './contacts.js';
import { openInvoiceList } from './invoices.js';
import { openVoucherList } from './vouchers.js';
import { openCardList } from './cards.js';
import { openCourseList } from './courses.js';
import { courseStats } from '../courses.js';
import { openBookingForm } from './form.js';
import { activeVouchers, voucherRemaining, cardState } from '../vouchers.js';
import { invoiceStatus } from '../invoices.js';
import { doExport, openTradeTaxPage } from './settings.js';
import { MONTHS, todayISO } from '../format.js';
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
  const big = [monthSums, yearSums].some((x) => Math.max(Math.abs(x.income), Math.abs(x.expense), Math.abs(x.profit)) >= 1000000);
  const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const money = (c) => (big ? eur0.format(Math.round(c / 100)) : formatMoney(c));
  const signed = (c, type) => (type === 'income' ? '+' : '\u2212') + money(Math.abs(c));
  const profit = (c) => (c < 0 ? '\u2212' + money(-c) : money(c));

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
        kpiRow('Gewinn', 'profit', profit(monthSums.profit), profit(yearSums.profit), 'kpi-total')),
      big ? h('p', { class: 'kpi-note' }, 'Auf volle Euro gerundet – genaue Beträge in der Auswertung.') : null),

    tiles(),
    receiptHint(curYear),
    openPayments(),
    limitNotices(),
    backupNotice(),

    h('h2', { class: 'section-title' }, 'Zuletzt erfasst'),
    recent.length
      ? [h('div', { class: 'rows' }, recent.map(bookingRow)),
        h('p', { style: 'text-align:center; margin: 8px 0 0' }, h('a', { href: '#/buchungen', class: 'btn-text', style: 'display:inline-block' }, 'Alle Buchungen'))]
      : h('div', { class: 'empty' },
        h('strong', null, 'Noch nichts erfasst'),
        'Tippe unten rechts auf +, um die erste Buchung einzutragen.'),
  );
  // Verlust rot färben
  for (const el of root.querySelectorAll('.kpi-total')) if (el.textContent.startsWith('\u2212')) el.classList.add('neg');
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

/** Kacheln zu den Bereichen Kund:innen, Rechnungen (später auch Kurse, Gutscheine, 10er-Karten) */
function tiles() {
  const openInvoices = state.invoices.filter((i) => invoiceStatus(i) === 'open').length;
  const tile = (id, title, value, iconName, onClick) => h('button', { type: 'button', class: 'tile', id, onclick: onClick },
    h('span', { class: 'tile-icon' }, icon(iconName, 24)),
    h('span', { class: 'tile-title' }, title),
    h('span', { class: 'tile-value' }, value));
  const vouchers = activeVouchers();
  const voucherSum = vouchers.reduce((s, v) => s + voucherRemaining(v), 0);
  const cards = state.cards.filter((c) => cardState(c) === 'active').length;
  return h('div', { class: 'tiles' },
    tile('tile-contacts', 'Kund:innen', `${state.contacts.length} gespeichert`, 'people', () => openContactList()),
    tile('tile-invoices', 'Rechnungen', openInvoices ? `${openInvoices} offen` : `${state.invoices.length} erstellt`, 'doc', () => openInvoiceList()),
    tile('tile-vouchers', 'Gutscheine', vouchers.length ? `${vouchers.length} gültig · ${formatMoney(voucherSum)}` : 'keine offen', 'gift',
      () => openVoucherList(null, { onSell: () => openBookingForm(null, { productId: 'prod-gutschein' }) })),
    tile('tile-cards', '10er-Karten', cards ? `${cards} aktiv` : 'keine aktiv', 'ticket',
      () => openCardList(null, { onSell: () => openBookingForm(null, { productId: 'prod-10er-karte' }) })),
    tile('tile-courses', 'Kurse', coursesValue(), 'calendar', () => openCourseList()));
}

function coursesValue() {
  const current = state.courses.filter((c) => !c.finished);
  if (!current.length) return 'keine aktuellen';
  const open = current.reduce((s, c) => s + courseStats(c).open, 0);
  return `${current.length} aktuell${open ? ` · ${open} offen` : ''}`;
}

/** Dezente Zeile: Ausgaben dieses Jahres, zu denen noch ein Beleg fehlt */
function receiptHint(year) {
  const n = state.bookings.filter((b) => needsReceipt(b) && b.date.startsWith(String(year))).length;
  if (!n) return null;
  return h('button', {
    type: 'button',
    class: 'hint-row',
    onclick: () => showBookings({ year: String(year), type: 'expense', noReceipt: true }),
  },
  icon('receipt', 20),
  h('span', null, `${n} ${n === 1 ? 'Ausgabe' : 'Ausgaben'} ohne Beleg`),
  h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
}

/** Offene Zahlungen zum Abhaken – ganz oben, überfällige rot markiert */
function openPayments() {
  const list = openBookings();
  if (!list.length) return null;
  const overdue = list.filter(isOverdue).length;
  const days = state.settings.paymentReminderDays || 14;
  const shown = list.slice(0, 5);
  return h('section', { class: 'open-section', 'aria-label': 'Offene Zahlungen' },
    h('div', { class: 'open-head' },
      h('h2', null, `Offene Zahlungen (${list.length})`),
      h('span', { class: 'amt open' }, formatMoney(sumOpen(list)))),
    overdue
      ? h('p', { class: 'overdue-note' },
        `${overdue} ${overdue === 1 ? 'Zahlung ist' : 'Zahlungen sind'} seit ${days} Tagen oder länger offen – Zeit für eine Erinnerung.`)
      : h('p', { class: 'hint', style: 'margin: 0 4px 10px' }, 'Kreis antippen, sobald bezahlt wurde.'),
    h('div', { class: 'rows' }, shown.map(bookingRow)),
    list.length > shown.length
      ? h('p', { style: 'text-align:center; margin: 8px 0 0' },
        h('button', { type: 'button', class: 'btn-text', onclick: () => showBookings({ type: 'open' }) }, `Alle ${list.length} offenen anzeigen`))
      : null);
}

/** Dezenter Hinweis, wenn sich der Umsatz der Kleinunternehmergrenze nähert */
function limitNotices() {
  const list = smallBusinessStatus().notices.map((n) => h('div', { class: `notice${n.level === 'alert' ? ' alert' : ''}` },
    h('strong', null, n.title),
    h('p', null, n.text),
    h('a', { href: '#/einstellungen', class: 'btn-text', style: 'display:inline-block' }, 'Grenzen in den Einstellungen')));
  const tt = tradeTaxStatus().notice;
  if (tt) {
    list.push(h('div', { class: 'notice', id: 'tradetax-notice' },
      h('strong', null, tt.title),
      h('p', null, tt.text),
      h('button', { type: 'button', class: 'btn-text', style: 'display:inline-block', onclick: () => openTradeTaxPage() }, 'Mehr zur Gewerbesteuer')));
  }
  return list;
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
    h('p', null, 'Wichtig: Die installierte App hat ihren eigenen Speicher. Trage deine Buchungen nur dort ein – nicht hier im Safari-Tab.'),
    h('button', { type: 'button', class: 'btn-text', onclick: () => updateLocal({ installHintDismissed: true }) }, 'Verstanden'));
}
