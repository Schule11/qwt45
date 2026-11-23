// Buchungsliste (Teil von "Finanzen"): nach Monaten, mit Suche und Filtern.
// Oben nur Suche und ein Filter-Knopf; die Filter (Art, Jahr, Kategorie) liegen in
// einem eigenen Fenster. Aktive Filter stehen als kleine Schilder unter der Suche
// und lassen sich dort mit einem Tipp entfernen.

import { h, mount, icon, openSheet } from '../ui.js';
import { state, categoriesFor, categoryName, categoryById, sortBookings, sumBookings, bookingYears } from '../data.js';
import { formatSigned, formatBalance, formatDate, centsToInput, monthLabel, normalizeText } from '../format.js';
import { bookingRow, selectField } from './components.js';

const TYPE_LABEL = { income: 'Einnahmen', expense: 'Ausgaben' };

// Filter bleiben erhalten, solange die App offen ist
const filters = {
  year: 'all',
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

/** Buchungen, die zu den Filtern (ohne Suche) und optional zur Suche passen */
function filtered({ withSearch = true } = {}) {
  const q = withSearch ? normalizeText(filters.q) : '';
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

/** Aktive Filter als Liste: [{ key, label, clear }] */
function activeFilters() {
  const list = [];
  if (filters.type !== 'all') list.push({ key: 'type', label: TYPE_LABEL[filters.type], clear: () => { filters.type = 'all'; } });
  if (filters.month) list.push({ key: 'month', label: monthLabel(filters.month), clear: () => { filters.month = null; filters.year = 'all'; } });
  else if (filters.year !== 'all') list.push({ key: 'year', label: filters.year, clear: () => { filters.year = 'all'; } });
  if (filters.category !== 'all') {
    list.push({ key: 'category', label: categoryById(filters.category)?.name || 'Kategorie', clear: () => { filters.category = 'all'; } });
  }
  return list;
}

export function renderList(root) {
  const results = h('div', { 'aria-live': 'polite' });
  const pills = h('div', { class: 'chips filter-chips' });

  // Unbekanntes Jahr oder gelöschte Kategorie? Dann diesen Filter zurücksetzen
  if (filters.year !== 'all' && !bookingYears().includes(Number(filters.year))) filters.year = 'all';
  if (filters.category !== 'all' && !categoryById(filters.category)) filters.category = 'all';

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

  const badge = h('span', { class: 'filter-badge', 'aria-hidden': 'true' });
  const filterBtn = h('button', {
    type: 'button', class: 'filter-btn', id: 'filter-open',
    onclick: () => openFilterSheet(update),
  }, icon('sliders', 22), badge);

  /** Schilder, Filter-Knopf und Liste neu aufbauen */
  function update() {
    const active = activeFilters();
    pills.replaceChildren(...active.map((f) => h('div', { class: 'filter-pill', 'data-key': f.key },
      h('span', { class: 'filter-pill-name' }, f.label),
      h('button', {
        type: 'button', class: 'pill-clear', 'aria-label': `Filter „${f.label}“ entfernen`,
        onclick: () => { f.clear(); update(); },
      }, '✕'))));
    badge.textContent = active.length ? String(active.length) : '';
    filterBtn.classList.toggle('active', active.length > 0);
    filterBtn.setAttribute('aria-label', active.length ? `Filter (${active.length} aktiv)` : 'Filter');
    renderResults();
  }

  function renderResults() {
    const list = sortBookings(filtered());
    const isFiltered = Boolean(filters.q) || activeFilters().length > 0;

    if (!state.bookings.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Buchungen'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'));
      return;
    }
    if (!list.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Nichts gefunden'),
        'Versuche einen anderen Suchbegriff oder Filter.'));
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

  mount(root,
    h('div', { class: 'filters' },
      h('div', { class: 'search-row' }, search, filterBtn),
      pills),
    results,
  );
  update();
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

// ---------- Filter-Fenster ----------

/** Filter wählen: Art, Jahr (bzw. Monat) und Kategorie; Änderungen gelten sofort */
function openFilterSheet(onChange) {
  const { body, close } = openSheet({ title: 'Filter', onClose: onChange });

  const typeChips = h('div', { class: 'chips type-filter', role: 'group', 'aria-label': 'Art' },
    [['all', 'Alle'], ['income', 'Einnahmen'], ['expense', 'Ausgaben']].map(([value, label]) => h('button', {
      type: 'button', class: 'chip', 'data-type': value,
      onclick: () => {
        filters.type = value;
        // Kategorie passt nicht mehr zur Art? Dann zurücksetzen
        if (filters.category !== 'all' && value !== 'all' && categoryById(filters.category)?.type !== value) filters.category = 'all';
        refresh();
      },
    }, label)));

  const yearBox = h('div');
  const catSel = h('select', {
    class: 'field', id: 'filter-category', 'aria-label': 'Kategorie',
    onchange: (e) => { filters.category = e.target.value; refresh(); },
  });
  const showBtn = h('button', { type: 'button', class: 'btn primary block', id: 'filter-apply', onclick: () => close() });
  const resetBtn = h('button', {
    type: 'button', class: 'btn-text', id: 'filter-reset',
    onclick: () => { Object.assign(filters, { year: 'all', month: null, type: 'all', category: 'all' }); refresh(); },
  }, 'Filter zurücksetzen');

  function refresh() {
    for (const b of typeChips.children) b.setAttribute('aria-pressed', String(b.dataset.type === filters.type));

    // Jahr (ein Monatsfilter aus der Auswertung erscheint hier mit)
    const years = bookingYears();
    const options = [['all', 'Alle Jahre'], ...years.map((y) => [String(y), String(y)])];
    if (filters.month) options.unshift([`m:${filters.month}`, `Nur ${monthLabel(filters.month)}`]);
    const yearSel = selectField(options, filters.month ? `m:${filters.month}` : filters.year, (v) => {
      if (!v.startsWith('m:')) { filters.month = null; filters.year = v; }
      refresh();
    }, { label: 'Zeitraum' });
    yearSel.id = 'filter-year';
    yearBox.replaceChildren(yearSel);

    // Kategorien passend zur Art
    const groups = [];
    for (const type of ['income', 'expense']) {
      if (filters.type !== 'all' && filters.type !== type) continue;
      const cats = categoriesFor(type);
      if (cats.length) groups.push(h('optgroup', { label: TYPE_LABEL[type] }, cats.map((c) => h('option', { value: c.id }, c.name))));
    }
    catSel.replaceChildren(h('option', { value: 'all' }, 'Alle Kategorien'), ...groups);
    catSel.value = filters.category;

    const n = filtered({ withSearch: false }).length;
    showBtn.textContent = n === 1 ? '1 Buchung anzeigen' : `${n} Buchungen anzeigen`;
    resetBtn.hidden = activeFilters().length === 0;
  }

  mount(body,
    h('div', { class: 'lbl', style: 'margin-top: 4px' }, 'Art'),
    typeChips,
    h('label', { class: 'lbl', for: 'filter-year' }, 'Zeitraum'),
    yearBox,
    h('label', { class: 'lbl', for: 'filter-category' }, 'Kategorie'),
    catSel,
    h('div', { class: 'form-actions' }, showBtn, resetBtn));
  refresh();
}
