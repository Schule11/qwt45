// Auswertung (Teil von "Finanzen"): Einnahmen, Ausgaben und Saldo für einen Monat
// oder ein Jahr – mit Blättern (‹ ›), Ring "Wohin ging das Geld?", Kategorien,
// Diagrammen und Export (CSV, PDF).

import { h, mount, icon, toast, alertDialog, choiceDialog } from '../ui.js';
import { state, bookingYears } from '../data.js';
import { formatMoney, formatSigned, formatBalance, monthLabel, todayISO, MONTHS } from '../format.js';
import { yearReport, monthReport, categorySlots } from '../yearReport.js';
import { bookingsCsv, summaryCsv, reportPdf } from '../exports.js';
import { saveFile, prefersShare } from '../files.js';
import { shiftMonth } from '../hours.js';
import { statBlock } from './components.js';
import { showBookings } from './bookings.js';
import { monthlyChart, cumulativeChart, shareBar, ringChart, swatch } from './charts.js';

// Auswahl bleibt erhalten, solange die App offen ist
const view = {
  month: todayISO().slice(0, 7),
  year: new Date().getFullYear(),
  chart: 'months', // Jahr: 'months' (je Monat) | 'cumulative' (aufsummiert)
};

/** Finanzen → Monat mit diesem Monat ("JJJJ-MM") öffnen, z. B. von der Übersicht */
export function showMonth(ym) {
  view.month = ym;
  location.hash = '#/finanzen/monat';
}

/** Finanzen → Jahr mit diesem Jahr öffnen */
export function showYear(year) {
  view.year = Number(year);
  location.hash = '#/finanzen/jahr';
}

// ---------- Bausteine ----------

/**
 * Kopf zum Blättern: ‹ [Auswahl] ›. options: [[Wert, Text], …] in Reihenfolge alt → neu.
 * Die Mitte ist eine Klappliste (zum Springen), die Pfeile blättern um eins.
 */
function periodNav({ options, value, label, onChange }) {
  const i = options.findIndex(([v]) => String(v) === String(value));
  // Sichtbar ist nur der Text mit ⌄; die (unsichtbare) Klappliste liegt darüber und öffnet beim Tippen
  const select = h('select', { class: 'period-select', 'aria-label': `${label} wählen`, onchange: (e) => onChange(e.target.value) },
    [...options].reverse().map(([v, text]) => h('option', { value: String(v) }, text)));
  select.value = String(value);
  const arrow = (dir, aria, disabled) => h('button', {
    type: 'button', class: 'round-btn nav-arrow', 'aria-label': aria, disabled,
    onclick: () => onChange(options[i + dir][0]),
  }, icon(dir < 0 ? 'back' : 'forward', 20));
  return h('div', { class: 'period-nav' },
    arrow(-1, label === 'Monat' ? 'Vorheriger Monat' : 'Vorheriges Jahr', i <= 0),
    h('div', { class: 'period-select-wrap' },
      h('span', { class: 'period-label', 'aria-hidden': 'true' }, options[i]?.[1] ?? String(value), icon('chevronDown', 18)),
      select),
    arrow(1, label === 'Monat' ? 'Nächster Monat' : 'Nächstes Jahr', i >= options.length - 1));
}

/** Ring "Wohin ging das Geld?" mit Liste der Ausgaben-Kategorien (Farbpunkt = Teil im Ring) */
function expenseCard(r, filter) {
  const list = r.categories.expense;
  const slots = categorySlots('expense');
  const parts = list.map((c) => ({ id: c.id || 'none', name: c.name, cents: c.cents, slot: slots.get(c.id) || 0 }));
  return [
    h('h2', { class: 'section-title' }, 'Wohin ging das Geld?'),
    h('section', { class: 'card card-list ring-card' },
      ringChart(parts, { caption: 'Ausgaben' }),
      list.map((c, i) => categoryRow(c, r.totals.expense, filter, { swatchSlot: parts[i].slot }))),
  ];
}

/** Zeile einer Kategorie (antippen = Buchungen dieser Kategorie zeigen) */
function categoryRow(c, total, filter, { swatchSlot = null, bar = false } = {}) {
  const pct = total > 0 ? Math.round((c.cents / total) * 100) : 0;
  return h('button', {
    type: 'button',
    class: 'report-row report-link',
    onclick: () => showBookings({ ...filter, category: c.id || 'all' }),
  },
  swatchSlot != null ? swatch(swatchSlot) : null,
  h('div', { class: 'report-main' },
    h('div', { class: 'report-name' }, c.name),
    h('div', { class: 'report-sub' }, `${c.count} ${c.count === 1 ? 'Buchung' : 'Buchungen'} · ${pct} %`),
    bar ? shareBar(c.cents, total, c.type) : null),
  h('div', { class: `report-amt ${c.type === 'income' ? 'pos' : 'neg'}` }, formatSigned(c.cents, c.type)));
}

function incomeCard(r, filter) {
  const list = r.categories.income;
  if (!list.length) return null;
  return [
    h('h2', { class: 'section-title' }, 'Einnahmen nach Kategorie'),
    h('section', { class: 'card card-list' }, list.map((c) => categoryRow(c, r.totals.income, filter, { bar: list.length > 1 }))),
  ];
}

// ---------- Monat ----------

/** Alle Monate vom ersten mit Buchungen bis zum aktuellen (bzw. letzten mit Buchungen), alt → neu */
function monthRange() {
  const cur = todayISO().slice(0, 7);
  const used = state.bookings.map((b) => b.date.slice(0, 7));
  const first = used.reduce((m, x) => (x < m ? x : m), cur);
  const last = used.reduce((m, x) => (x > m ? x : m), cur);
  const list = [];
  for (let ym = first; ym <= last; ym = shiftMonth(ym, 1)) list.push(ym);
  return list;
}

/** Auswertung eines Monats; rerender baut den ganzen Bildschirm neu auf */
export function renderMonth(root, rerender) {
  const months = monthRange();
  if (!months.includes(view.month)) view.month = todayISO().slice(0, 7);
  const r = monthReport(view.month);
  const go = (ym) => { view.month = ym; rerender(); };

  const head = h('section', { class: 'card' },
    periodNav({ options: months.map((m) => [m, monthLabel(m)]), value: view.month, label: 'Monat', onChange: go }),
    statBlock(r.totals, { key: 'report' }));

  if (!r.bookings.length) {
    mount(root, head, h('div', { class: 'empty' },
      h('strong', null, `Keine Buchungen im ${monthLabel(view.month)}`),
      'Sobald du Einnahmen oder Ausgaben erfasst hast, siehst du hier, wohin das Geld geht.'));
    return;
  }

  const filter = { month: view.month };
  mount(root,
    head,
    r.categories.expense.length ? expenseCard(r, filter) : null,
    incomeCard(r, filter),
    h('p', { style: 'text-align:center; margin: 8px 0 0' },
      h('button', { type: 'button', class: 'btn-text', onclick: () => showBookings({ month: view.month }) },
        `Alle ${r.bookings.length} Buchungen im ${monthLabel(view.month)}`)),
  );
}

// ---------- Jahr ----------

/** Export als Auswahl: PDF oder CSV. Die Datei entsteht direkt im Tipp (wichtig fürs iPhone). */
function openExport(year) {
  const run = (make) => {
    let file;
    try {
      file = make(year);
    } catch (err) {
      console.error(err);
      alertDialog({ title: 'Export fehlgeschlagen', text: err.message || String(err) });
      return;
    }
    const share = prefersShare(file);
    saveFile(file, (ok) => { if (ok && !share) toast(`${file.name} heruntergeladen`); });
  };
  choiceDialog({
    title: `Export ${year}`,
    text: 'PDF: Jahresübersicht mit allen Buchungen – zum Ablegen oder Ausdrucken. CSV: für Excel oder Numbers.',
    buttons: [
      { label: 'PDF-Jahresübersicht', kind: 'primary', onClick: () => run(reportPdf) },
      { label: 'Buchungen als CSV', onClick: () => run(bookingsCsv) },
      { label: 'Summen als CSV', onClick: () => run(summaryCsv) },
      { label: 'Abbrechen' },
    ],
  });
}

/** Auswertung eines Jahres */
export function renderYear(root, rerender) {
  const years = bookingYears(); // neu → alt
  if (!years.includes(view.year)) view.year = years[0];
  const r = yearReport(view.year);
  const allYears = [];
  for (let y = years[years.length - 1]; y <= years[0]; y += 1) allYears.push([y, String(y)]);

  const head = h('section', { class: 'card' },
    periodNav({ options: allYears, value: view.year, label: 'Jahr', onChange: (v) => { view.year = Number(v); rerender(); } }),
    statBlock(r.totals, { key: 'report' }),
    r.bookings.length
      ? h('div', { class: 'card-foot' },
        h('button', { type: 'button', class: 'btn-text export-btn', onclick: () => openExport(view.year) }, icon('download', 20), 'Exportieren'))
      : null);

  if (!r.bookings.length) {
    mount(root, head, h('div', { class: 'empty' },
      h('strong', null, `Keine Buchungen in ${view.year}`),
      'Sobald du Einnahmen oder Ausgaben erfasst hast, siehst du hier die Summen des Jahres.'));
    return;
  }

  // --- Diagramm: je Monat oder aufsummiert (umschaltbar) ---
  const now = new Date();
  const prevReport = yearReport(view.year - 1);
  const lastMonth = view.year === now.getFullYear() ? now.getMonth() : view.year > now.getFullYear() ? 0 : 11;
  const chartBox = h('div');
  const drawChart = () => chartBox.replaceChildren(view.chart === 'months'
    ? monthlyChart(r.months, { year: view.year })
    : cumulativeChart({
      year: view.year,
      current: r.months.map((m) => m.balance),
      previous: prevReport.bookings.length ? prevReport.months.map((m) => m.balance) : null,
      lastMonth,
    }));
  const chartSwitch = h('div', { class: 'segmented chart-switch', role: 'group', 'aria-label': 'Diagramm' },
    [['months', 'Je Monat'], ['cumulative', 'Saldo im Verlauf']].map(([key, label]) => h('button', {
      type: 'button',
      'aria-pressed': String(view.chart === key),
      onclick: (e) => {
        view.chart = key;
        for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        drawChart();
      },
    }, label)));
  drawChart();

  // --- Monate als Liste (antippen = Auswertung dieses Monats) ---
  const monthRows = r.months
    .map((m, i) => ({ ...m, i }))
    .filter((m) => m.count)
    .reverse()
    .map((m) => h('button', {
      type: 'button',
      class: 'row month-row',
      'aria-label': `${MONTHS[m.i]} ${view.year}: Saldo ${formatBalance(m.balance)}. Auswertung öffnen`,
      onclick: () => showMonth(`${view.year}-${String(m.i + 1).padStart(2, '0')}`),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, MONTHS[m.i]),
      h('div', { class: 'row-sub' },
        h('span', { class: 'pos' }, formatSigned(m.income, 'income')),
        h('span', null, '·'),
        h('span', { class: 'neg' }, formatSigned(m.expense, 'expense')))),
    h('div', { class: `amt ${m.balance < 0 ? 'neg' : ''}` }, formatBalance(m.balance)),
    h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')));

  const filter = { year: String(view.year) };
  mount(root,
    head,
    h('section', { class: 'card' }, chartSwitch, chartBox),
    h('h2', { class: 'section-title' }, 'Monate'),
    h('div', { class: 'rows' }, monthRows),
    r.categories.expense.length ? expenseCard(r, filter) : null,
    incomeCard(r, filter),
  );
}
