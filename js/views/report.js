// Auswertung (Teil von "Finanzen"): Einnahmen, Ausgaben und Saldo für einen Monat
// oder ein Jahr, mit Kategorien, Diagrammen und Export (CSV, PDF).

import { h, mount, icon, toast, alertDialog } from '../ui.js';
import { bookingYears, bookingMonths } from '../data.js';
import { formatMoney, formatSigned, formatBalance, monthLabel, todayISO, MONTHS } from '../format.js';
import { yearReport, monthReport } from '../yearReport.js';
import { bookingsCsv, summaryCsv, reportPdf } from '../exports.js';
import { saveFile, prefersShare } from '../files.js';
import { statBlock, yearSelect, selectField } from './components.js';
import { showBookings } from './bookings.js';
import { monthlyChart, cumulativeChart, shareBar } from './charts.js';

// Auswahl bleibt erhalten, solange die App offen ist
const view = {
  month: todayISO().slice(0, 7),
  year: new Date().getFullYear(),
};

/** Kategorien mit Anteil (antippen = Buchungen dieser Kategorie zeigen) */
function categoryCard(list, total, filter) {
  return h('section', { class: 'card card-list' },
    list.map((c) => {
      const pct = total > 0 ? Math.round((c.cents / total) * 100) : 0;
      return h('button', {
        type: 'button',
        class: 'report-row report-link',
        onclick: () => showBookings({ ...filter, category: c.id || 'all' }),
      },
      h('div', { class: 'report-main' },
        h('div', { class: 'report-name' }, c.name),
        h('div', { class: 'report-sub' }, `${c.count} ${c.count === 1 ? 'Buchung' : 'Buchungen'} · ${pct} %`),
        list.length > 1 ? shareBar(c.cents, total, c.type) : null),
      h('div', { class: `report-amt ${c.type === 'income' ? 'pos' : 'neg'}` }, formatSigned(c.cents, c.type)));
    }));
}

function categorySections(r, filter) {
  return [
    r.categories.expense.length
      ? [h('h2', { class: 'section-title' }, 'Ausgaben nach Kategorie'), categoryCard(r.categories.expense, r.totals.expense, filter)]
      : null,
    r.categories.income.length
      ? [h('h2', { class: 'section-title' }, 'Einnahmen nach Kategorie'), categoryCard(r.categories.income, r.totals.income, filter)]
      : null,
  ];
}

// ---------- Monat ----------

/** Auswertung eines Monats; rerender baut den ganzen Bildschirm neu auf */
export function renderMonth(root, rerender) {
  const months = bookingMonths(todayISO().slice(0, 7));
  if (!months.includes(view.month)) view.month = months[0];
  const r = monthReport(view.month);

  const head = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, 'Ergebnis'),
      h('div', { class: 'head-select' },
        selectField(months.map((m) => [m, monthLabel(m)]), view.month, (v) => { view.month = v; rerender(); }, { label: 'Monat' }))),
    statBlock(r.totals));

  if (!r.bookings.length) {
    mount(root, head, h('div', { class: 'empty' },
      h('strong', null, `Keine Buchungen im ${monthLabel(view.month)}`),
      'Sobald du Einnahmen oder Ausgaben erfasst hast, siehst du hier, wohin das Geld geht.'));
    return;
  }

  mount(root,
    head,
    categorySections(r, { month: view.month }),
    h('p', { style: 'text-align:center; margin: 8px 0 0' },
      h('button', { type: 'button', class: 'btn-text', onclick: () => showBookings({ month: view.month }) },
        `Alle ${r.bookings.length} Buchungen im ${monthLabel(view.month)}`)),
  );
}

// ---------- Jahr ----------

/** Auswertung eines Jahres */
export function renderYear(root, rerender) {
  const years = bookingYears();
  if (!years.includes(view.year)) view.year = years[0];
  const r = yearReport(view.year);

  const head = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, 'Ergebnis'),
      h('div', { class: 'head-select' },
        yearSelect(years, view.year, (v) => { view.year = Number(v); rerender(); }))),
    statBlock(r.totals));

  if (!r.bookings.length) {
    mount(root, head, h('div', { class: 'empty' },
      h('strong', null, `Keine Buchungen in ${view.year}`),
      'Sobald du Einnahmen oder Ausgaben erfasst hast, siehst du hier die Summen des Jahres.'));
    return;
  }

  // --- Monate (Monat antippen = Auswertung dieses Monats) ---
  const openMonth = (i) => {
    view.month = `${view.year}-${String(i + 1).padStart(2, '0')}`;
    location.hash = '#/finanzen/monat';
  };
  const monthTable = h('section', { class: 'card' },
    h('div', { class: 'month-table' },
      h('span', { class: 'th' }, 'Monat'),
      h('span', { class: 'th' }, 'Einnahmen'),
      h('span', { class: 'th' }, 'Ausgaben'),
      h('span', { class: 'th' }, 'Saldo'),
      r.months.map((m, i) => (m.count ? [
        h('button', { type: 'button', class: 'month-link', 'aria-label': `Auswertung ${MONTHS[i]} ${view.year}`, onclick: () => openMonth(i) },
          MONTHS[i].slice(0, 3)),
        h('span', { class: 'pos' }, m.income ? formatMoney(m.income) : '–'),
        h('span', { class: 'neg' }, m.expense ? formatMoney(m.expense) : '–'),
        h('span', { class: m.balance < 0 ? 'neg' : '' }, formatBalance(m.balance)),
      ] : null))),
    h('p', { class: 'hint', style: 'margin-bottom: 0' }, 'Tippe auf einen Monat für seine Kategorien.'));

  // --- Diagramme ---
  const now = new Date();
  const prevReport = yearReport(view.year - 1);
  const lastMonth = view.year === now.getFullYear() ? now.getMonth() : view.year > now.getFullYear() ? 0 : 11;
  const chartCard = h('section', { class: 'card' }, monthlyChart(r.months, { year: view.year }));
  const compareCard = h('section', { class: 'card' }, cumulativeChart({
    year: view.year,
    current: r.months.map((m) => m.balance),
    previous: prevReport.bookings.length ? prevReport.months.map((m) => m.balance) : null,
    lastMonth,
  }));

  // --- Export ---
  const exportBtn = (label, iconName, make, primary = false) => h('button', {
    type: 'button',
    class: `btn block${primary ? ' primary' : ' btn-small'}`,
    onclick: () => {
      // Datei sofort im Tipp erzeugen und weitergeben (wichtig fürs iPhone)
      let file;
      try {
        file = make(view.year);
      } catch (err) {
        console.error(err);
        alertDialog({ title: 'Export fehlgeschlagen', text: err.message || String(err) });
        return;
      }
      const share = prefersShare(file);
      saveFile(file, (ok) => { if (ok && !share) toast(`${file.name} heruntergeladen`); });
    },
  }, iconName ? icon(iconName) : null, label);

  mount(root,
    head,
    h('h2', { class: 'section-title' }, 'Monate'),
    chartCard,
    monthTable,
    h('h2', { class: 'section-title' }, prevReport.bookings.length ? 'Saldo im Vergleich zum Vorjahr' : 'Saldo im Jahresverlauf'),
    compareCard,
    categorySections(r, { year: String(view.year) }),
    h('h2', { class: 'section-title' }, 'Export'),
    h('section', { class: 'card export-card', 'aria-label': 'Export' },
      exportBtn('PDF erstellen', 'download', reportPdf, true),
      h('div', { class: 'btn-pair' },
        exportBtn('Buchungen (CSV)', null, bookingsCsv),
        exportBtn('Summen (CSV)', null, summaryCsv)),
      h('p', { class: 'hint', style: 'margin-bottom: 0' },
        'PDF: Jahresübersicht mit allen Buchungen – zum Ablegen oder Ausdrucken. CSV: für Excel oder Numbers.')),
  );
}
