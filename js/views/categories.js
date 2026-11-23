// Kategorien verwalten: anlegen, umbenennen, sortieren, löschen.

import { h, mount, toast, openSheet, choiceDialog, confirmDialog, alertDialog } from '../ui.js';
import {
  onChange, categoriesFor, bookingCount, recurringCount, saveCategory, moveCategory, deleteCategory,
} from '../data.js';

const TYPE_LABEL = { income: 'Einnahmen', expense: 'Ausgaben' };

/** Liste der Kategorien eines Typs */
export function openCategoryList(type, onClose = null) {
  const list = h('div', { class: 'rows' });
  let unsubscribe = null;
  const { body } = openSheet({
    title: `Kategorien ${TYPE_LABEL[type]}`,
    onClose: () => { unsubscribe?.(); onClose?.(); },
  });

  function render() {
    const cats = categoriesFor(type);
    list.replaceChildren(...cats.map((c, i) => {
      const count = bookingCount(c.id);
      return h('div', { class: 'cat-row' },
        h('button', { type: 'button', class: 'cat-main', onclick: () => openCategoryEditor({ type, category: c }) },
          h('div', { class: 'row-title' }, c.name),
          h('div', { class: 'row-sub' }, `${count} ${count === 1 ? 'Buchung' : 'Buchungen'}`)),
        h('div', { class: 'cat-move' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name} nach oben`, disabled: i === 0, onclick: () => moveCategory(c.id, -1) }, '↑'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name} nach unten`, disabled: i === cats.length - 1, onclick: () => moveCategory(c.id, 1) }, '↓')));
    }));
  }

  mount(body,
    h('p', { class: 'hint', style: 'margin: 0 2px 14px' },
      'Tippe auf eine Kategorie, um sie umzubenennen oder zu löschen. Mit den Pfeilen änderst du die Reihenfolge im '
      + 'Buchungsformular (die zuletzt benutzten stehen dort zusätzlich vorne).'),
    list,
    h('div', { style: 'margin-top: 16px' },
      h('button', { type: 'button', class: 'btn block', onclick: () => openCategoryEditor({ type }) }, '+ Neue Kategorie')),
  );
  render();
  unsubscribe = onChange(render);
}

/** Eine Kategorie bearbeiten oder neu anlegen */
export function openCategoryEditor({ type, category = null }) {
  const isNew = !category;
  const nameInput = h('input', {
    class: 'field', id: 'cat-name', type: 'text', maxlength: 60, autocomplete: 'off', autocapitalize: 'sentences',
    value: category?.name || '', placeholder: type === 'income' ? 'z. B. Kindergeld' : 'z. B. Haustier',
    enterkeyhint: 'done',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } },
  });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({
    title: isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten',
    cancel: true,
    onConfirm: () => save(),
  });

  async function save() {
    const name = nameInput.value.trim();
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    if (!name) return fail('Bitte einen Namen eingeben.');
    const duplicate = categoriesFor(type).some((c) => c.id !== category?.id && c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
    if (duplicate) return fail(`Eine Kategorie „${name}“ gibt es bei den ${TYPE_LABEL[type]} schon.`);
    try {
      await saveCategory({ id: category?.id, type, name });
      close();
      toast(isNew ? 'Kategorie angelegt' : 'Kategorie gespeichert');
    } catch (err) {
      fail(`Speichern hat nicht geklappt: ${err.message || err}`);
    }
  }

  async function remove() {
    const others = categoriesFor(type).filter((c) => c.id !== category.id);
    if (!others.length) {
      alertDialog({ title: 'Nicht möglich', text: `Mindestens eine Kategorie für ${TYPE_LABEL[type]} muss bleiben.` });
      return;
    }
    const count = bookingCount(category.id);
    const recCount = recurringCount(category.id);
    let moveTo = null;
    if (count || recCount) {
      const target = h('select', { class: 'field', 'aria-label': 'Buchungen verschieben nach' },
        others.map((c) => h('option', { value: c.id }, c.name)));
      const sonstiges = others.find((c) => /^sonstig/i.test(c.name));
      if (sonstiges) target.value = sonstiges.id;
      const choice = await choiceDialog({
        title: `„${category.name}“ löschen?`,
        text: h('div', null,
          h('p', null, `${[
            count ? `${count} ${count === 1 ? 'Buchung' : 'Buchungen'}` : null,
            recCount ? `${recCount} ${recCount === 1 ? 'Dauerauftrag' : 'Daueraufträge'}` : null,
          ].filter(Boolean).join(' und ')} ${count + recCount === 1 ? 'gehört' : 'gehören'} zu dieser Kategorie. Wohin sollen sie verschoben werden?`),
          target),
        buttons: [
          { label: 'Löschen und verschieben', value: 'delete', kind: 'danger' },
          { label: 'Abbrechen' },
        ],
      });
      if (choice !== 'delete') return;
      moveTo = target.value;
    } else {
      const ok = await confirmDialog({
        title: `„${category.name}“ löschen?`,
        text: 'Die Kategorie wird nicht mehr zur Auswahl angeboten.',
        confirmLabel: 'Löschen',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const moved = await deleteCategory(category.id, moveTo);
      close();
      toast(moved ? `Gelöscht – ${moved} Buchungen verschoben` : 'Kategorie gelöscht');
    } catch (err) {
      alertDialog({ title: 'Löschen nicht möglich', text: err.message || String(err) });
    }
  }

  mount(body,
    h('label', { class: 'lbl', for: 'cat-name', style: 'margin-top: 4px' }, 'Name'),
    nameInput,
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Kategorie löschen') : null),
  );
  if (isNew) nameInput.focus();
}
