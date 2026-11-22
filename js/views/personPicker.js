// Auswahl der Kundin / des Kunden im Buchungsformular – als aufklappbare Liste.
// Oben ein Suchfeld, darunter die Namen (zuletzt benutzte zuerst).
// Ein neuer Name wird beim Speichern der Buchung automatisch angelegt.

import { h } from '../ui.js';
import { state, contactById, contactLabel, contactsSorted, recentContacts, findContactByName } from '../data.js';
import { normalizeText } from '../format.js';
import { disclosurePicker, pickerOption, pickerGroup } from './picker.js';

export function personPicker({ initialId = null, onChange = () => {}, idPrefix = 'person' } = {}) {
  let selectedId = contactById(initialId) ? initialId : null;
  let pendingNew = null; // neuer Name, wird beim Speichern angelegt

  const picker = disclosurePicker({ id: `${idPrefix}-picker`, placeholder: 'Kund:in wählen', label: 'Kund:in' });
  const input = h('input', {
    class: 'field field-search picker-search',
    id: idPrefix,
    type: 'search',
    maxlength: 80,
    autocomplete: 'off',
    autocapitalize: 'words',
    enterkeyhint: 'done',
    placeholder: 'Name suchen oder neu eingeben',
    oninput: () => { renderOptions(); onChange(); },
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const typed = input.value.trim();
      const matches = matching();
      if (matches.length === 1) select(matches[0].id);
      else if (typed && !findContactByName(typed)) takeNew(typed);
      else input.blur();
    },
  });
  const list = h('div', { class: 'picker-list', role: 'listbox', 'aria-label': 'Kund:innen' });
  picker.panel.append(input, list);
  picker.onOpen(() => renderOptions());

  const clearBtn = h('button', {
    type: 'button',
    class: 'pill-clear',
    'aria-label': 'Auswahl entfernen',
    hidden: true,
    onclick: () => { selectedId = null; pendingNew = null; input.value = ''; render(); onChange(); },
  }, '✕');
  const el = h('div', { class: 'picker-row' }, picker.el, clearBtn);

  function matching() {
    const q = normalizeText(input.value);
    if (!q) return [];
    const words = q.split(/\s+/);
    return contactsSorted().filter((c) => {
      const hay = normalizeText(`${c.name} ${c.dog || ''}`);
      return words.every((w) => hay.includes(w));
    });
  }

  function option(c) {
    return pickerOption({
      label: c.name,
      sub: c.dog ? `Hund: ${c.dog}` : null,
      selected: c.id === selectedId,
      onClick: () => select(c.id),
      data: { id: c.id },
    });
  }

  function renderOptions() {
    const typed = input.value.trim();
    const items = [];
    if (typed) {
      items.push(...matching().map(option));
      if (!findContactByName(typed)) {
        items.push(pickerOption({ label: `„${typed}“ als neue Kund:in übernehmen`, className: 'new', onClick: () => takeNew(typed) }));
      }
    } else if (state.contacts.length) {
      const recent = recentContacts(4);
      const rest = contactsSorted().filter((c) => !recent.includes(c));
      if (rest.length && recent.length) items.push(pickerGroup('Zuletzt verwendet'));
      items.push(...recent.map(option));
      if (rest.length) {
        items.push(pickerGroup('Alle (A–Z)'));
        items.push(...rest.map(option));
      }
    } else {
      items.push(h('p', { class: 'picker-empty' }, 'Noch keine Kund:innen – einfach den Namen oben eintippen.'));
    }
    list.replaceChildren(...items);
  }

  function select(id) {
    selectedId = id;
    pendingNew = null;
    input.value = '';
    picker.close();
    render();
    onChange();
  }

  function takeNew(name) {
    const existing = findContactByName(name);
    if (existing) { select(existing.id); return; }
    selectedId = null;
    pendingNew = name;
    input.value = '';
    picker.close();
    render();
    onChange();
  }

  function render() {
    const c = contactById(selectedId);
    const label = c ? contactLabel(c) : pendingNew ? `${pendingNew} (neu)` : null;
    picker.setValue(label);
    clearBtn.hidden = !label;
  }

  render();

  return {
    el,
    input,
    hasSelection: () => !!contactById(selectedId) || !!pendingNew,
    /** Liste aufklappen und gleich tippen lassen (z. B. wenn es noch keine Namen gibt) */
    openSearch() { picker.open(); input.focus(); },
    close: () => picker.close(),
    /** { personId } oder { newName } (neu anzulegen) oder { personId: null } */
    value() {
      if (contactById(selectedId)) return { personId: selectedId };
      const name = (pendingNew || input.value).trim();
      if (!name) return { personId: null };
      const match = findContactByName(name);
      return match ? { personId: match.id } : { newName: name };
    },
  };
}
