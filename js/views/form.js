// Formular "Neue Buchung" / "Buchung bearbeiten" – öffnet sich im Vollbild.

import { h, icon, toast, confirmDialog, openImageViewer, isTouchDevice } from '../ui.js';
import {
  categoriesFor, categoryById, saveBooking, deleteBooking, getReceipt, receiptToBlob, recentCategoryIds,
} from '../data.js';
import { disclosurePicker, pickerOption, pickerGroup } from './picker.js';
import { parseAmount, centsToInput, todayISO, formatMoney, formatDate } from '../format.js';
import { prepareReceipt } from '../image.js';
import { openFile } from '../files.js';
import { storageKey } from '../config.js';
import { registerForm } from './formState.js';

function getLastType() {
  // Standard: Ausgabe (das Häufigste im Alltag)
  try { return localStorage.getItem(storageKey('lastType')) === 'income' ? 'income' : 'expense'; } catch { return 'expense'; }
}
function setLastType(type) {
  try { localStorage.setItem(storageKey('lastType'), type); } catch { /* egal */ }
}

/**
 * Öffnet das Formular. WICHTIG: Muss direkt im Klick-Handler aufgerufen
 * werden (ohne await davor), sonst öffnet das iPhone die Tastatur nicht.
 */
export function openBookingForm(existing = null) {
  const done = registerForm();
  if (!done) return;

  const isEdit = !!existing;
  const st = {
    type: existing?.type || getLastType(),
    categoryId: existing?.categoryId || null,
    receiptId: existing?.receiptId || null, // gespeichertes Foto
    newReceipt: null,                        // neu gewähltes Foto
    removeReceipt: false,
    receiptBusy: false,
    saving: false,
    dirty: false,
  };
  const objectUrls = [];

  // ---------- Elemente ----------

  const title = h('h1', { class: 'sheet-title', id: 'sheet-title' });

  const typeButtons = {
    expense: h('button', { type: 'button', class: 'expense', onclick: () => setType('expense') }, 'Ausgabe'),
    income: h('button', { type: 'button', class: 'income', onclick: () => setType('income') }, 'Einnahme'),
  };

  const amountInput = h('input', {
    class: 'amount-input',
    id: 'amount',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder: '0,00',
    'aria-label': 'Betrag in Euro',
    value: existing ? centsToInput(existing.amountCents) : '',
    oninput: () => { st.dirty = true; clearError(); },
  });

  // Kategorie als aufklappbare Liste (zuletzt verwendete oben)
  const catPicker = disclosurePicker({ id: 'cat-picker', placeholder: 'Kategorie wählen', label: 'Kategorie' });
  const catList = h('div', { class: 'picker-list', role: 'listbox', 'aria-label': 'Kategorien' });
  catPicker.panel.append(catList);
  catPicker.onOpen(() => renderCategories());

  const descInput = h('input', {
    class: 'field',
    id: 'desc',
    type: 'text',
    maxlength: 200,
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    value: existing?.description || '',
    oninput: () => { st.dirty = true; },
    onkeydown: (e) => {
      // Auf dem Handy schließt "Fertig" nur die Tastatur, statt zu speichern
      if (e.key === 'Enter' && isTouchDevice()) { e.preventDefault(); descInput.blur(); }
    },
  });

  const dateInput = h('input', {
    class: 'field',
    id: 'date',
    type: 'date',
    required: true,
    value: existing?.date || todayISO(),
    onchange: () => { st.dirty = true; clearError(); },
  });

  const fileInput = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', hidden: true, onchange: onFileChosen });
  const receiptRow = h('div', { class: 'receipt-row' });

  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary block' }, 'Speichern');
  const saveBtnTop = h('button', { type: 'submit', class: 'round-btn confirm', 'aria-label': 'Speichern' }, icon('check', 24));

  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); } },
    h('header', { class: 'sheet-bar' },
      h('button', { type: 'button', class: 'round-btn', 'aria-label': 'Abbrechen', onclick: cancel }, icon('close', 22)),
      title,
      saveBtnTop),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Art der Buchung' },
        typeButtons.expense, typeButtons.income),

      h('label', { class: 'lbl', for: 'amount' }, 'Betrag'),
      h('div', { class: 'amount-wrap' }, amountInput, h('span', { class: 'amount-suffix', 'aria-hidden': 'true' }, '€')),

      h('div', { class: 'lbl', id: 'cat-label' }, 'Kategorie'),
      catPicker.el,

      h('label', { class: 'lbl', for: 'desc' }, 'Beschreibung (optional)'),
      descInput,

      h('label', { class: 'lbl', for: 'date' }, 'Datum'),
      dateInput,

      h('div', { class: 'lbl' }, 'Beleg (optional)'),
      receiptRow,
      fileInput,

      errorBox,

      h('div', { class: 'form-actions' },
        saveBtn,
        isEdit ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Buchung löschen') : null)));

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' }, form);

  // ---------- Anzeige aktualisieren ----------

  function setType(type) {
    if (st.type === type) return;
    st.type = type;
    st.dirty = true;
    const cat = categoryById(st.categoryId);
    if (cat && cat.type !== type) st.categoryId = null;
    updateType();
    renderCategories();
  }

  function updateType() {
    sheet.classList.toggle('t-expense', st.type === 'expense');
    sheet.classList.toggle('t-income', st.type === 'income');
    typeButtons.expense.setAttribute('aria-pressed', String(st.type === 'expense'));
    typeButtons.income.setAttribute('aria-pressed', String(st.type === 'income'));
    const word = st.type === 'income' ? 'Einnahme' : 'Ausgabe';
    title.textContent = isEdit ? `${word} bearbeiten` : `Neue ${word}`;
    descInput.placeholder = st.type === 'income' ? 'z. B. Gehalt November' : 'z. B. Wocheneinkauf';
  }

  /** Kategorie-Liste füllen und gewählten Wert anzeigen */
  function renderCategories() {
    const cats = categoriesFor(st.type);
    const current = categoryById(st.categoryId);
    catPicker.setValue(current && current.type === st.type ? current.name : null);
    const recentIds = cats.length > 6 ? recentCategoryIds(st.type, 3) : [];
    const recent = recentIds.map((id) => cats.find((c) => c.id === id)).filter(Boolean);
    const rest = cats.filter((c) => !recent.includes(c));
    const option = (c) => pickerOption({
      label: c.name,
      selected: c.id === st.categoryId,
      onClick: () => chooseCategory(c),
      data: { id: c.id },
    });
    catList.replaceChildren(
      ...(recent.length ? [pickerGroup('Zuletzt verwendet'), ...recent.map(option), pickerGroup('Alle Kategorien')] : []),
      ...rest.map(option),
    );
  }

  function chooseCategory(c) {
    st.categoryId = c.id;
    st.dirty = true;
    clearError();
    catPicker.close();
    renderCategories();
    // Beim Neuanlegen direkt weiter zur Beschreibung
    if (!isEdit && !descInput.value) descInput.focus();
    else document.activeElement?.blur();
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function clearError() { errorBox.hidden = true; }

  // ---------- Belegfoto ----------

  function urlFor(blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    return url;
  }

  function thumb(rec) {
    const blob = receiptToBlob(rec);
    if ((rec.type || '').includes('pdf')) {
      const file = new File([blob], rec.name || 'Beleg.pdf', { type: 'application/pdf' });
      return h('button', { type: 'button', class: 'receipt-thumb receipt-pdf', 'aria-label': 'PDF-Beleg öffnen', onclick: () => openFile(file) },
        icon('receipt', 26), h('span', null, 'PDF'));
    }
    const url = urlFor(blob);
    return h('button', { type: 'button', class: 'receipt-thumb', 'aria-label': 'Beleg ansehen', onclick: () => openImageViewer(url) },
      h('img', { src: url, alt: 'Beleg' }));
  }

  async function renderReceipt() {
    if (st.receiptBusy) {
      receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Beleg wird verarbeitet …'));
      return;
    }
    const addBtn = (label) => h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, icon('camera'), label);
    const removeBtn = h('button', {
      type: 'button',
      class: 'btn-text danger',
      onclick: () => { st.newReceipt = null; st.removeReceipt = !!st.receiptId; st.dirty = true; renderReceipt(); },
    }, 'Entfernen');

    if (st.newReceipt) {
      receiptRow.replaceChildren(thumb(st.newReceipt), addBtn('Ersetzen'), removeBtn);
      return;
    }
    if (st.receiptId && !st.removeReceipt) {
      receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Beleg wird geladen …'));
      const rec = await getReceipt(st.receiptId).catch(() => null);
      if (st.newReceipt || st.removeReceipt) return; // inzwischen geändert
      if (rec) {
        receiptRow.replaceChildren(thumb(rec), addBtn('Ersetzen'), removeBtn);
      } else {
        receiptRow.replaceChildren(h('span', { class: 'muted' }, 'Beleg nicht gefunden.'), addBtn('Beleg hinzufügen'));
      }
      return;
    }
    receiptRow.replaceChildren(addBtn('Beleg hinzufügen'));
  }

  async function onFileChosen() {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    st.receiptBusy = true;
    renderReceipt();
    try {
      st.newReceipt = await prepareReceipt(file); // Foto verkleinern oder PDF übernehmen
      st.removeReceipt = false;
      st.dirty = true;
    } catch (err) {
      showError(err.message || 'Der Beleg konnte nicht verarbeitet werden.');
    } finally {
      st.receiptBusy = false;
      renderReceipt();
    }
  }

  // ---------- Speichern / Löschen / Schließen ----------

  async function save() {
    if (st.saving || st.receiptBusy) return;
    const cat = categoryById(st.categoryId);
    const cents = parseAmount(amountInput.value);
    if (cents == null || cents <= 0) {
      showError(amountInput.value.trim() ? 'Bitte einen gültigen Betrag eingeben, z. B. 45,50.' : 'Bitte einen Betrag eingeben.');
      return;
    }
    if (cents > 100000000) { showError('Der Betrag ist ungewöhnlich hoch. Bitte prüfen.'); return; }
    if (!cat || cat.type !== st.type) { showError('Bitte eine Kategorie wählen.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) { showError('Bitte das Datum wählen.'); return; }

    st.saving = true;
    saveBtn.disabled = true;
    saveBtnTop.disabled = true;
    try {
      const receiptChange = st.newReceipt
        ? { add: { data: st.newReceipt.data, type: st.newReceipt.type, width: st.newReceipt.width, height: st.newReceipt.height, name: st.newReceipt.name || null } }
        : (st.removeReceipt ? { remove: true } : null);
      await saveBooking({
        id: existing?.id,
        type: st.type,
        date: dateInput.value,
        amountCents: cents,
        categoryId: cat.id,
        description: descInput.value.trim(),
      }, receiptChange);
      setLastType(st.type);
      close();
      toast(isEdit ? 'Änderung gespeichert' : `${st.type === 'income' ? 'Einnahme' : 'Ausgabe'} gespeichert`);
    } catch (err) {
      console.error(err);
      showError(`Speichern hat nicht geklappt: ${err.message || err}`);
      st.saving = false;
      saveBtn.disabled = false;
      saveBtnTop.disabled = false;
    }
  }

  async function remove() {
    const label = existing.description || categoryById(existing.categoryId)?.name || 'Buchung';
    const ok = await confirmDialog({
      title: 'Buchung löschen?',
      text: `„${label}“ vom ${formatDate(existing.date)} über ${formatMoney(existing.amountCents)} wird gelöscht. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBooking(existing.id);
      close();
      toast('Buchung gelöscht');
    } catch (err) {
      showError(`Löschen hat nicht geklappt: ${err.message || err}`);
    }
  }

  async function cancel() {
    if (st.dirty && !st.saving) {
      const ok = await confirmDialog({
        title: 'Änderungen verwerfen?',
        text: 'Die Eingaben werden nicht gespeichert.',
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
    }
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape' && !document.querySelector('dialog[open], .viewer')) cancel();
  }

  function close() {
    catPicker.close();
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('sheet-open');
    for (const url of objectUrls) URL.revokeObjectURL(url);
    done();
  }

  // ---------- Start ----------

  updateType();
  renderCategories();
  renderReceipt();

  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);

  // Sofort fokussieren (noch im selben Tipp), damit die Zahlentastatur aufgeht
  if (!isEdit) amountInput.focus({ preventScroll: true });
}
