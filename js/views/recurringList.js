// Liste "Daueraufträge": alle wiederkehrenden Zahlungen mit Rhythmus und nächster Zahlung.
// Antippen öffnet den Dauerauftrag zum Ändern, Beenden oder Löschen.

import { h, mount, icon, openSheet } from '../ui.js';
import { state, onChange, categoryName } from '../data.js';
import { formatSigned, formatDate } from '../format.js';
import { recurringSorted, nextDate, describeRhythm, describeStatus } from '../recurring.js';
import { openBookingForm } from './form.js';

/** Kurzinfo für die Zeile in der Buchungsliste: "3 aktiv · nächste 01.12.2026" */
export function recurringSummary() {
  const active = state.recurring.filter((r) => nextDate(r));
  if (!active.length) return state.recurring.length ? 'keine aktiven' : 'z. B. Miete, Abos';
  const next = active.map(nextDate).sort()[0];
  return `${active.length} aktiv · nächste ${formatDate(next).slice(0, 6)}`; // Datum ohne Jahr, z. B. 25.11.
}

export function openRecurringList(onClose = null) {
  const list = h('div');
  let unsubscribe = null;
  const { body } = openSheet({
    title: 'Daueraufträge',
    onClose: () => { unsubscribe?.(); onClose?.(); },
  });

  const row = (r) => {
    const ended = !nextDate(r);
    return h('button', {
      type: 'button',
      class: `row rec-row${ended ? ' ended' : ''}`,
      onclick: () => openBookingForm(null, { recurring: r }),
    },
    h('span', { class: 'rec-icon' }, icon('repeat', 18)),
    h('div', { class: 'row-main' },
      // Titel und Betrag in einer Zeile, darunter Rhythmus und Status in voller Breite
      h('div', { class: 'rec-head' },
        h('span', { class: 'row-title' }, r.description || categoryName(r.categoryId)),
        h('span', { class: `amt ${r.type}` }, formatSigned(r.amountCents, r.type))),
      h('div', { class: 'row-sub' }, `${describeRhythm(r)} · ${categoryName(r.categoryId)}`),
      h('div', { class: 'row-sub' }, describeStatus(r))));
  };

  function render() {
    const all = recurringSorted();
    const active = all.filter((r) => nextDate(r));
    const ended = all.filter((r) => !nextDate(r));
    list.replaceChildren();
    if (!all.length) {
      mount(list, h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Daueraufträge'),
        'Lege wiederkehrende Zahlungen wie Miete, Versicherung oder Abos einmal an – die App bucht sie dann von selbst.'));
      return;
    }
    mount(list,
      active.length ? [h('h2', { class: 'section-title' }, 'Aktiv'), h('div', { class: 'rows' }, active.map(row))] : null,
      ended.length ? [h('h2', { class: 'section-title' }, 'Beendet'), h('div', { class: 'rows' }, ended.map(row))] : null);
  }

  mount(body,
    h('p', { class: 'hint', style: 'margin: 0 2px 4px' },
      'Die App bucht fällige Zahlungen automatisch, sobald du sie öffnest – auch Termine, an denen sie nicht offen war.'),
    h('div', { style: 'margin-top: 14px' },
      h('button', { type: 'button', class: 'btn primary block', id: 'rec-add', onclick: () => openBookingForm(null, { repeat: true }) },
        icon('repeat'), 'Neuer Dauerauftrag')),
    list);
  render();
  unsubscribe = onChange(render);
}
