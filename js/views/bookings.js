// Bildschirm "Buchungen": Liste nach Monaten, mit Suche und Filtern.

import { h, mount } from '../ui.js';
import { state, categoriesFor, categoryName, sortBookings, sumBookings, bookingYears, contactById, contactLabel, isOpen, sumOpen, needsReceipt } from '../data.js';
import { paymentLabel } from '../defaults.js';
import { formatSigned, formatMoney, formatDate, centsToInput, monthLabel, normalizeText } from '../format.js';
import { bookingRow, yearSelect, pageHeader } from './components.js';

// Filter bleiben erhalten, solange die App offen ist
const filters = {
  year: String(new Date().getFullYear()),
  type: 'all',
  category: 'all',
  person: null, // nur Buchungen einer Kund:in (aus Auswertung/Kundenliste)
  noReceipt: false, // nur Ausgaben ohne Beleg
  q: '',
};

/** Liste mit Filter öffnen (z. B. aus der Auswertung: "alle Buchungen dieser Kategorie") */
export function showBookings({ year = 'all', type = 'all', category = 'all', person = null, noReceipt = false } = {}) {
  if (type === 'open') year = 'all';
  Object.assign(filters, { year, type, category, person, noReceipt, q: '' });
  location.hash = '#/buchungen';
}

export function render(root) {
  const results = h('div', { 'aria-live': 'polite' });
  let updateReceiptChip = null;

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
  const yearSel = yearSelect(years, filters.year, (v) => { filters.year = v; renderResults(); }, { withAll: true });

  // Art als Umschalter (statt Klappliste): ein Tipp, alles sichtbar
  const typeFilter = h('div', { class: 'segmented segmented-4 type-filter', role: 'group', 'aria-label': 'Art' },
    [['all', 'Alle'], ['income', 'Einnahmen'], ['expense', 'Ausgaben'], ['open', 'Offen']].map(([value, label]) =>
      h('button', {
        type: 'button',
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

  // "Offen" sind immer Einnahmen
  const catType = () => (filters.type === 'open' ? 'income' : filters.type);

  function matchesCategoryType(catId) {
    if (filters.type === 'all') return true;
    return categoriesFor(catType()).some((c) => c.id === catId);
  }

  function fillCategories() {
    const groups = [];
    const add = (type, label) => {
      const cats = categoriesFor(type);
      if (!cats.length) return;
      groups.push(h('optgroup', { label }, cats.map((c) => h('option', { value: c.id }, c.name))));
    };
    if (catType() !== 'expense') add('income', 'Einnahmen');
    if (catType() !== 'income') add('expense', 'Ausgaben');
    catSel.replaceChildren(h('option', { value: 'all' }, 'Alle Kategorien'), ...groups);
    catSel.value = filters.category;
    if (catSel.value !== filters.category) { filters.category = 'all'; catSel.value = 'all'; }
  }

  function filtered() {
    const q = normalizeText(filters.q);
    return state.bookings.filter((b) => {
      if (filters.year !== 'all' && b.date.slice(0, 4) !== filters.year) return false;
      if (filters.type === 'open' ? !isOpen(b) : (filters.type !== 'all' && b.type !== filters.type)) return false;
      if (filters.category !== 'all' && b.categoryId !== filters.category) return false;
      if (filters.person && (b.personId || 'none') !== filters.person) return false;
      if (filters.noReceipt && !needsReceipt(b)) return false;
      if (q) {
        const hay = normalizeText([
          b.description,
          categoryName(b.categoryId),
          contactLabel(contactById(b.personId)),
          b.tripTo,
          b.tripPurpose,
          centsToInput(b.amountCents),
          formatDate(b.date),
          paymentLabel(b.payment),
        ].join(' '));
        if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
      }
      return true;
    });
  }

  function renderResults() {
    updateReceiptChip?.();
    const list = sortBookings(filtered());
    const isFiltered = Boolean(filters.q || filters.type !== 'all' || filters.category !== 'all' || filters.person || filters.noReceipt);

    if (!state.bookings.length) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Buchungen'),
        'Tippe unten rechts auf +, um die erste Einnahme oder Ausgabe einzutragen.'));
      return;
    }
    if (!list.length && filters.type === 'open' && !filters.q && filters.category === 'all' && !filters.person) {
      results.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Keine offenen Zahlungen'),
        'Alles bezahlt.'));
      return;
    }
    if (!list.length && filters.noReceipt) {
      results.replaceChildren(h('div', { class: 'empty' }, h('strong', null, 'Alle Belege vorhanden'), 'Zu jeder Ausgabe gibt es ein Foto oder PDF.'));
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

    // Ohne Filter: nur die Liste (Summen stehen auf Übersicht und Auswertung).
    // Mit Suche oder Filter: eine Zeile mit der Summe der Treffer.
    results.replaceChildren(
      ...(isFiltered ? [filterSummary(list)] : []),
      ...[...groups].map(([ym, items]) => h('section', { 'aria-label': monthLabel(ym) },
        h('div', { class: 'month-head' }, h('h2', null, monthLabel(ym))),
        h('div', { class: 'rows' }, items.map(bookingRow)))),
    );
  }

  /** Summe der gefundenen Buchungen, z. B. "3 Buchungen · zusammen +180,00 €" */
  function filterSummary(list) {
    const join = (parts) => parts.flatMap((p, i) => (i ? [' · ', p] : [p]));
    const openTotal = sumOpen(list);
    if (filters.type === 'open') {
      return h('p', { class: 'list-summary' }, join([
        `${list.length} ${list.length === 1 ? 'offene Zahlung' : 'offene Zahlungen'}`,
        h('span', null, 'zusammen ', h('span', { class: 'num amt open' }, formatMoney(openTotal))),
      ]));
    }
    const total = sumBookings(list);
    const amounts = [];
    if (total.income) amounts.push(h('span', { class: 'num pos' }, formatSigned(total.income, 'income')));
    if (total.expense) amounts.push(h('span', { class: 'num neg' }, formatSigned(total.expense, 'expense')));
    if (openTotal) amounts.push(h('span', { class: 'num amt open' }, `${formatMoney(openTotal)} offen`));
    const parts = [`${list.length} ${list.length === 1 ? 'Buchung' : 'Buchungen'}`];
    if (amounts.length === 1) parts.push(h('span', null, 'zusammen ', amounts[0]));
    else parts.push(...amounts);
    return h('p', { class: 'list-summary' }, join(parts));
  }

  // Gelöschte Kund:in? Dann Filter zurücksetzen
  if (filters.person && filters.person !== 'none' && !contactById(filters.person)) filters.person = null;

  // Aktiver Kund:innen-Filter als entfernbares Schild
  let personChip = null;
  if (filters.person) {
    const label = filters.person === 'none' ? 'ohne Kund:in' : (contactLabel(contactById(filters.person)) || 'unbekannt');
    personChip = h('div', { class: 'person-pill filter-pill' },
      h('span', { class: 'person-pill-name' }, `Kund:in: ${label}`),
      h('button', {
        type: 'button',
        class: 'pill-clear',
        'aria-label': 'Filter entfernen',
        onclick: () => { filters.person = null; personChip.remove(); renderResults(); },
      }, '✕'));
  }

  // Schalter "Ohne Beleg": zeigt Ausgaben, bei denen noch Foto oder PDF fehlt
  const receiptCount = () => state.bookings
    .filter((b) => needsReceipt(b) && (filters.year === 'all' || b.date.startsWith(filters.year))).length;
  const receiptChip = h('button', {
    type: 'button',
    class: 'chip filter-chip',
    'aria-pressed': String(filters.noReceipt),
    onclick: () => {
      filters.noReceipt = !filters.noReceipt;
      if (filters.noReceipt && filters.type !== 'expense') {
        filters.type = 'expense';
        for (const b of typeFilter.children) b.setAttribute('aria-pressed', String(b.dataset.type === 'expense'));
        fillCategories();
      }
      receiptChip.setAttribute('aria-pressed', String(filters.noReceipt));
      renderResults();
    },
  });
  updateReceiptChip = () => {
    const n = receiptCount();
    receiptChip.textContent = `Ohne Beleg (${n})`;
    receiptChip.hidden = n === 0 && !filters.noReceipt;
  };

  fillCategories();
  mount(root,
    pageHeader('Buchungen'),
    h('div', { class: 'filters' },
      search,
      typeFilter,
      h('div', { class: 'filter-row' }, yearSel, catSel),
      h('div', { class: 'chips filter-chips' }, receiptChip, personChip)),
    results,
  );

  renderResults();
}
