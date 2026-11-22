// Buchungsliste (Teil von "Finanzen"): nach Monaten, mit Suche und Filtern.

import { h, mount } from '../ui.js';
import { state, categoriesFor, categoryName, sortBookings, sumBookings, bookingYears } from '../data.js';
import { formatSigned, formatBalance, formatDate, centsToInput, monthLabel, normalizeText } from '../format.js';
import { bookingRow, yearSelect } from './components.js';

// Filter bleiben erhalten, solange die App offen ist
const filters = {
  year: String(new Date().getFullYear()),
  month: null, // "JJJJ-MM": nur dieser Monat (aus der Auswertung)
  type: 'all',
  category: 'all',
  q: '',
};

/** Liste mit Filter öffnen (z. B. aus der Auswertung: "alle Buchungen dieser Kategorie") */
export function showBookings({ year = 'all', month = null, type = 'all', category = 'all' } = {}) {
  if (month) year = month.slice(0, 4);
  Object.assign(filters, { year: String(year), month, type, category, q: '' });
  location.hash = '#/finanzen/buchungen';
}

export function renderList(root) {
  const results = h('div', { 'aria-live': 'polite' });

  const search = h('input', {
    class: 'field field-search',
    type: 'search',
    placeholder: 'Suchen …',
    'aria-label': 'Buchungen durchsuchen',
    enterkeyhint: 'search',
    autocomplete: 'off',
    value: filters.q,
    oninput: (e) => { filters.q = e.target.value; renderResults(); },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });

  const years = bookingYears();
  if (filters.year !== 'all' && !years.includes(Number(filters.year))) filters.year = String(years[0]);
  const yearSel = yearSelect(years, filters.year, (v) => {
    filters.year = v;
    if (filters.month && filters.month.slice(0, 4) !== v) { filters.month = null; renderMonthPill(); }
    renderResults();
  }, { withAll: true });

  // Art als kleine Chips (ein Tipp, alles sichtbar) – bewusst anders als der Hauptumschalter oben
  const typeFilter = h('div', { class: 'chips type-filter', role: 'group', 'aria-label': 'Art' },
    [['all', 'Alle'], ['income', 'Einnahmen'], ['expense', 'Ausgaben']].map(([value, label]) =>
      h('button', {
        type: 'button',
        class: 'chip',
        'data-type': value,
        'aria-pressed': String(filters.type === value),
        onclick: () => {
          filters.type = value;
          for (const b of typeFilter.children) b.setAttribute('aria-pressed', String(b.dataset.type === value));
          if (filters.category !== 'all' && !matchesCategoryType(filters.category)) filters.category = 'all';
          fillCategories();
          renderResults();
        },
      }, label)));

  const catSel = h('select', {
    class: 'field',
    'aria-label': 'Kategorie',
    onchange: (e) => { filters.category = e.target.value; renderResults(); },
  });

  function matchesCategoryType(catId) {
    if (filters.type === 'all') return true;
    return categoriesFor(filters.type).some((c) => c.id === catId);
  }

  function fillCategories() {
    const groups = [];
    const add = (type, label) => {
      const cats = categoriesFor(type);
      if (!cats.length) return;
      groups.push(h('optgroup', { label }, cats.map((c) => h('option', { value: c.id }, c.name))));
    };
    if (filters.type !== 'expense') add('income', 'Einnahmen');
    if (filters.type !== 'income') add('expense', 'Ausgaben');
    catSel.replaceChildren(h('option', { value: 'all' }, 'Alle Kategorien'), ...groups);
    catSel.value = filters.category;
    if (catSel.value !== filters.category) { filters.category = 'all'; catSel.value = 'all'; }
  }

  // Aktiver Monatsfilter als entfernbares Schild
  const monthPill = h('div', { class: 'chips filter-chips' });
  function renderMonthPill() {
    // Ohne Filter leer lassen (replaceChildren(null) würde den Text "null" einfügen)
    monthPill.replaceChildren(...!filters.month ? [] : [
      h('div', { class: 'filter-pill' },
        h('span', { class: 'filter-pill-name' }, `Nur ${monthLabel(filters.month)}`),
        h('button', {
          type: 'button',
          class: 'pill-clear',
          'aria-label': 'Monatsfilter entfernen',
          onclick: () => { filters.month = null; renderMonthPill(); renderResults(); },
        }, '✕'))]);
  }

  function filtered() {
    const q = normalizeText(filters.q);
    return state.bookings.filter((b) => {
      if (filters.month ? !b.date.startsWith(filters.month) : (filters.year !== 'all' && b.date.slice(0, 4) !== filters.year)) return false;
      if (filters.type !== 'all' && b.type !== filters.type) return false;
      if (filters.category !== 'all' && b.categoryId !== filters.category) return false;
      if (q) {
        const hay = normalizeText([
          b.description,
          categoryName(b.categoryId),
          centsToInput(b.amountCents),
          formatDate(b.date),
        ].join(' '));
        if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
      }
      return true;
    });
  }

  function renderResults() {
    const list = sortBookings(filtered());
    const isFiltered = Boolean(filters.q || filters.type !== 'all' || filters.category !== 'all' || filters.month);

    if (!state.bookings.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Buchungen'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'));
      return;
    }
    if (!list.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Nichts gefunden'),
        isFiltered ? 'Versuche einen anderen Suchbegriff oder Filter.' : 'In diesem Jahr gibt es noch keine Buchungen.'));
      return;
    }

    // Nach Monat gruppieren (Liste ist schon nach Datum sortiert)
    const groups = new Map();
    for (const b of list) {
      const ym = b.date.slice(0, 7);
      if (!groups.has(ym)) groups.set(ym, []);
      groups.get(ym).push(b);
    }

    // Mit Suche oder Filter: eine Zeile mit der Summe der Treffer.
    // Jeder Monat zeigt rechts seinen Saldo.
    results.replaceChildren(
      ...(isFiltered ? [filterSummary(list)] : []),
      ...[...groups].map(([ym, items]) => {
        const sums = sumBookings(items);
        return h('section', { 'aria-label': monthLabel(ym) },
          h('div', { class: 'month-head' },
            h('h2', null, monthLabel(ym)),
            h('span', { class: `small num ${sums.balance < 0 ? 'neg' : 'muted'}` }, formatBalance(sums.balance))),
          h('div', { class: 'rows' }, items.map(bookingRow)));
      }),
    );
  }

  /** Summe der gefundenen Buchungen, z. B. "3 Buchungen · zusammen −180,00 €" */
  function filterSummary(list) {
    const join = (parts) => parts.flatMap((p, i) => (i ? [' · ', p] : [p]));
    const total = sumBookings(list);
    const amounts = [];
    if (total.income) amounts.push(h('span', { class: 'num pos' }, formatSigned(total.income, 'income')));
    if (total.expense) amounts.push(h('span', { class: 'num neg' }, formatSigned(total.expense, 'expense')));
    const parts = [`${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'}`];
    if (amounts.length === 1) parts.push(h('span', null, 'zusammen ', amounts[0]));
    else parts.push(...amounts);
    return h('p', { class: 'list-summary' }, join(parts));
  }

  fillCategories();
  renderMonthPill();
  mount(root,
    h('div', { class: 'filters' },
      search,
      typeFilter,
      h('div', { class: 'filter-row' }, yearSel, catSel),
      monthPill),
    results,
  );

  renderResults();
}
