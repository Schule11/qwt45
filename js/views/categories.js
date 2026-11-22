// Kategorien verwalten: anlegen, umbenennen, sortieren, EÜR-Posten zuordnen, löschen.

import { h, mount, toast, openSheet, choiceDialog, confirmDialog, alertDialog } from '../ui.js';
import {
  onChange, categoriesFor, bookingCount, saveCategory, moveCategory, deleteCategory,
} from '../data.js';
import { EUER_POSTEN, euerPostenFor } from '../defaults.js';

const TYPE_LABEL = { income: 'Einnahmen', expense: 'Ausgaben' };
const CUSTOM = '__custom__';

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
      const sub = [`${count} ${count === 1 ? 'Buchung' : 'Buchungen'}`];
      if (c.mileage) sub.push('Kilometer');
      if (c.businessPercent && c.businessPercent < 100) sub.push(`${c.businessPercent} % betrieblich`);
      return h('div', { class: 'cat-row' },
        h('button', { type: 'button', class: 'cat-main', onclick: () => openCategoryEditor({ type, category: c }) },
          h('div', { class: 'row-title' }, c.name),
          h('div', { class: 'row-sub' }, sub.join(' · ')),
          h('div', { class: 'cat-posten' }, euerPostenFor(c))),
        h('div', { class: 'cat-move' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name} nach oben`, disabled: i === 0, onclick: () => moveCategory(c.id, -1) }, '↑'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${c.name} nach unten`, disabled: i === cats.length - 1, onclick: () => moveCategory(c.id, 1) }, '↓')));
    }));
  }

  mount(body, 
    h('p', { class: 'hint', style: 'margin: 0 2px 14px' },
      'Tippe auf eine Kategorie, um sie zu bearbeiten. Mit den Pfeilen änderst du die Reihenfolge im Buchungsformular '
      + '(die zuletzt benutzten stehen dort zusätzlich vorne).'),
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
    value: category?.name || '', placeholder: type === 'income' ? 'z. B. Social Walk' : 'z. B. Hundeplatz-Pflege',
  });

  const posten = EUER_POSTEN.filter((p) => p.type === type).map((p) => p.name);
  const current = category ? euerPostenFor(category) : posten[posten.length - 1];
  const isCustom = !posten.includes(current);
  const postenSelect = h('select', { class: 'field', id: 'cat-euer', onchange: () => { customInput.hidden = postenSelect.value !== CUSTOM; } },
    posten.map((p) => h('option', { value: p }, p)),
    h('option', { value: CUSTOM }, 'Eigene Bezeichnung …'));
  postenSelect.value = isCustom ? CUSTOM : current;
  const customInput = h('input', {
    class: 'field', type: 'text', maxlength: 160, hidden: !isCustom, style: 'margin-top: 8px',
    value: isCustom ? current : '', placeholder: 'Bezeichnung wie in der Anlage EÜR', 'aria-label': 'Eigene EÜR-Bezeichnung',
  });

  const mileageBox = h('input', {
    type: 'checkbox', id: 'cat-km', checked: !!category?.mileage,
    onchange: () => { shareWrap.hidden = mileageBox.checked; },
  });
  const shareInput = h('input', {
    class: 'field', id: 'cat-share', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    value: String(category?.businessPercent ?? 100), placeholder: '100',
  });
  const shareWrap = h('div', { hidden: type !== 'expense' || !!category?.mileage },
    h('label', { class: 'lbl', for: 'cat-share' }, 'Betrieblicher Anteil'),
    h('div', { class: 'unit-field' }, shareInput, h('span', { class: 'unit' }, '%')),
    h('p', { class: 'hint' }, 'Nutzt du etwas auch privat (z. B. Handy und Internet), trägst du den betrieblichen Anteil ein, etwa 50 %. '
      + 'Beim Erfassen gibst du dann den ganzen Rechnungsbetrag ein, und nur der Anteil zählt für die EÜR. Den Anteil schätzt du selbst – er sollte nachvollziehbar sein.'));
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({
    title: isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten',
    cancel: true,
    onConfirm: () => save(),
  });

  async function save() {
    const name = nameInput.value.trim();
    const euer = postenSelect.value === CUSTOM ? customInput.value.trim() : postenSelect.value;
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    if (!name) return fail('Bitte einen Namen eingeben.');
    const duplicate = categoriesFor(type).some((c) => c.id !== category?.id && c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
    if (duplicate) return fail(`Eine Kategorie „${name}“ gibt es bei den ${TYPE_LABEL[type]} schon.`);
    if (!euer) return fail('Bitte eine Bezeichnung für die Anlage EÜR eingeben.');
    const share = Number(String(shareInput.value).replace(',', '.').replace('%', '').trim() || 100);
    if (!Number.isInteger(share) || share < 1 || share > 100) return fail('Bitte beim betrieblichen Anteil eine ganze Zahl von 1 bis 100 eingeben.');
    try {
      await saveCategory({
        id: category?.id,
        type,
        name,
        euer,
        mileage: type === 'expense' && mileageBox.checked,
        businessPercent: type === 'expense' && !mileageBox.checked ? share : 100,
      });
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
    let moveTo = null;
    if (count) {
      const target = h('select', { class: 'field', 'aria-label': 'Buchungen verschieben nach' },
        others.map((c) => h('option', { value: c.id }, c.name)));
      const sonstiges = others.find((c) => /^sonstig/i.test(c.name));
      if (sonstiges) target.value = sonstiges.id;
      const choice = await choiceDialog({
        title: `„${category.name}“ löschen?`,
        text: h('div', null,
          h('p', null, `${count} ${count === 1 ? 'Buchung gehört' : 'Buchungen gehören'} zu dieser Kategorie. Wohin sollen sie verschoben werden?`),
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
    h('label', { class: 'lbl', for: 'cat-euer' }, 'Posten in der Anlage EÜR'),
    postenSelect,
    customInput,
    h('p', { class: 'hint' }, type === 'income'
      ? 'Als Kleinunternehmer gehören alle Einnahmen in denselben Posten.'
      : 'Unter dieser Bezeichnung findest du das Feld in der Anlage EÜR bzw. in ELSTER. Im Zweifel: „Übrige unbeschränkt abziehbare Betriebsausgaben“.'),
    type === 'expense'
      ? h('label', { class: 'switch-row', for: 'cat-km' },
        h('span', null,
          h('strong', null, 'Kilometer statt Betrag'),
          h('span', { class: 'hint', style: 'display:block; margin: 2px 0 0' }, 'Für Fahrtkosten: Du gibst die gefahrenen Kilometer ein, der Betrag wird mit der Kilometerpauschale berechnet.')),
        mileageBox)
      : null,
    shareWrap,
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Kategorie löschen') : null),
  );
  if (isNew) nameInput.focus();
}
