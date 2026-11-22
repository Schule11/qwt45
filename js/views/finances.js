// Bildschirm "Finanzen": Buchungen und Auswertung in einem Reiter.
// Oben ein Umschalter Buchungen | Monat | Jahr; die gewählte Ansicht steht in
// der Adresse (#/finanzen/buchungen, …/monat, …/jahr). So springen z. B. ein Tipp
// auf eine Kategorie in die gefilterte Liste und ein Monat der Jahrestabelle in
// die Monatsansicht.

import { h, mount } from '../ui.js';
import { pageHeader } from './components.js';
import { renderList } from './bookings.js';
import { renderMonth, renderYear } from './report.js';

const MODES = [
  ['buchungen', 'Buchungen'],
  ['monat', 'Monat'],
  ['jahr', 'Jahr'],
];

// Zuletzt gewählte Ansicht (gilt, wenn nur "#/finanzen" aufgerufen wird, z. B. über den Reiter)
let last = 'buchungen';

export function render(root, sub = null) {
  const mode = MODES.some(([key]) => key === sub) ? sub : last;
  last = mode;
  const rerender = () => { root.replaceChildren(); render(root, mode); };

  const switcher = h('div', { class: 'segmented segmented-3 period-switch', role: 'group', 'aria-label': 'Ansicht' },
    MODES.map(([key, label]) => h('button', {
      type: 'button',
      'data-mode': key,
      'aria-pressed': String(key === mode),
      onclick: () => { if (key !== mode) location.hash = `#/finanzen/${key}`; },
    }, label)));

  mount(root, pageHeader('Finanzen'), switcher);
  if (mode === 'buchungen') renderList(root);
  else if (mode === 'monat') renderMonth(root, rerender);
  else renderYear(root, rerender);
}
