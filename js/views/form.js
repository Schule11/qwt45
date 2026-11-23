// Formular "Neue Buchung" / "Buchung bearbeiten" – öffnet sich im Vollbild.
// Mit dem Schalter "Wiederholen" wird daraus ein Dauerauftrag; dasselbe Formular
// bearbeitet auch bestehende Daueraufträge (Option `recurring`).

import { h, icon, toast, confirmDialog, choiceDialog, openImageViewer, isTouchDevice } from '../ui.js';
import {
  state, categoriesFor, categoryById, saveBooking, deleteBooking, getReceipt, receiptToBlob, recentCategoryIds,
} from '../data.js';
import { disclosurePicker, pickerOption } from './picker.js';
import { catTile } from './catIcons.js';
import { parseAmount, centsToInput, todayISO, formatMoney, formatDate } from '../format.js';
import { prepareReceipt } from '../image.js';
import { openFile } from '../files.js';
import { storageKey } from '../config.js';
import { registerForm } from './formState.js';
import {
  INTERVALS, dueDate, dueCount, nextDate, remaining, describeRhythm, saveRecurring, endRecurring, deleteRecurring,
  recurringById, shiftDay,
} from '../recurring.js';

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
 * existing: Buchung zum Bearbeiten · recurring: Dauerauftrag zum Bearbeiten ·
 * repeat: neue Buchung gleich mit eingeschaltetem "Wiederholen" öffnen
 */
export function openBookingForm(existing = null, { recurring = null, repeat = false } = {}) {
  const done = registerForm();
  if (!done) return;

  const isEdit = !!existing;     // eine Buchung bearbeiten
  const recEdit = !!recurring;   // einen Dauerauftrag bearbeiten
  const src = recurring || existing;
  const fromRec = isEdit ? recurringById(existing.recurringId) : null; // Buchung aus einem Dauerauftrag
  const recLeft = recEdit ? remaining(recurring) : null;
  const st = {
    type: src?.type || getLastType(),
    categoryId: src?.categoryId || null,
    repeat: recEdit || repeat,   // Dauerauftrag?
    interval: recurring?.interval || 1,
    endMode: recEdit && recurring.limit != null ? 'count' : 'never',
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
    value: src ? centsToInput(src.amountCents) : '',
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
    value: src?.description || '',
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
    value: recEdit ? (nextDate(recurring) || todayISO()) : (existing?.date || todayISO()),
    onchange: () => { st.dirty = true; clearError(); updateRepeat(); },
  });
  const dateLabel = h('label', { class: 'lbl', for: 'date' }, 'Datum');
  const dateHint = h('p', { class: 'hint', hidden: true });

  // ---------- Wiederholen (Dauerauftrag) ----------

  const repeatBox = h('input', {
    type: 'checkbox', id: 'repeat', checked: st.repeat,
    onchange: () => { st.repeat = repeatBox.checked; st.dirty = true; clearError(); updateRepeat(); },
  });
  const repeatRow = (isEdit || recEdit) ? null : h('label', { class: 'switch-row', for: 'repeat' },
    h('span', null,
      h('strong', null, 'Wiederholen (Dauerauftrag)'),
      h('span', { class: 'hint', style: 'display:block; margin: 2px 0 0' }, 'Für gleichbleibende Zahlungen wie Miete, Versicherung oder Abos.')),
    repeatBox);
  const intervalChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Rhythmus' },
    INTERVALS.map(([value, label]) => h('button', {
      type: 'button', class: 'chip', 'data-value': value,
      onclick: () => { st.interval = value; st.dirty = true; updateRepeat(); },
    }, label)));
  const countInput = h('input', {
    class: 'field', id: 'repeat-count', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    value: recEdit ? (recLeft ? String(recLeft) : '') : '12', 'aria-label': 'Anzahl Zahlungen',
    oninput: () => { st.dirty = true; clearError(); updateRepeat(); },
  });
  const countWrap = h('div', { class: 'unit-field', style: 'margin-top: 10px' }, countInput, h('span', { class: 'unit' }, 'Zahlungen'));
  const endChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Endet' },
    [['never', 'Unbegrenzt'], ['count', 'Nach Anzahl Zahlungen']].map(([value, label]) => h('button', {
      type: 'button', class: 'chip', 'data-value': value,
      onclick: () => {
        st.endMode = value;
        st.dirty = true;
        updateRepeat();
        if (value === 'count') countInput.focus();
      },
    }, label)));
  const repeatSummary = h('p', { class: 'hint repeat-summary' });
  const repeatWrap = h('div', { class: 'repeat-wrap' },
    h('div', { class: 'lbl' }, 'Rhythmus'),
    intervalChips,
    h('div', { class: 'lbl' }, recEdit ? 'Läuft noch' : 'Endet'),
    endChips,
    countWrap,
    repeatSummary);

  // Buchung aus einem Dauerauftrag: Hinweis mit Weg zum Dauerauftrag
  const fromRecInfo = fromRec ? h('div', null,
    h('div', { class: 'lbl' }, 'Dauerauftrag'),
    h('button', { type: 'button', class: 'row nav-row rec-link', onclick: openRecurringFromBooking },
      icon('repeat', 20),
      h('span', { class: 'nav-label' }, fromRec.description || categoryById(fromRec.categoryId)?.name || 'Dauerauftrag'),
      h('span', { class: 'nav-value' }, 'bearbeiten'),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')),
    h('p', { class: 'hint' }, 'Änderungen hier gelten nur für diese eine Buchung.')) : null;

  const fileInput = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', hidden: true, onchange: onFileChosen });
  const receiptRow = h('div', { class: 'receipt-row' });
  const receiptWrap = h('div', null, h('div', { class: 'lbl' }, 'Beleg (optional)'), receiptRow, fileInput);

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

      repeatRow,
      repeatWrap,

      dateLabel,
      dateInput,
      dateHint,

      receiptWrap,
      fromRecInfo,

      errorBox,

      h('div', { class: 'form-actions' },
        saveBtn,
        recEdit && nextDate(recurring)
          ? h('button', { type: 'button', class: 'btn-text', onclick: endRec }, 'Dauerauftrag beenden')
          : null,
        recEdit ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Dauerauftrag löschen') : null,
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
    if (recEdit) title.textContent = 'Dauerauftrag bearbeiten';
    else if (st.repeat) title.textContent = 'Neuer Dauerauftrag';
    else title.textContent = isEdit ? `${word} bearbeiten` : `Neue ${word}`;
    descInput.placeholder = st.repeat
      ? (st.type === 'income' ? 'z. B. Gehalt' : 'z. B. Miete')
      : (st.type === 'income' ? 'z. B. Gehalt November' : 'z. B. Wocheneinkauf');
  }

  /** Wiederholen an/aus: Felder, Beschriftungen und Zusammenfassung anpassen */
  function updateRepeat() {
    repeatWrap.hidden = !st.repeat;
    receiptWrap.hidden = st.repeat; // Belege gehören zu einzelnen Buchungen
    saveBtn.textContent = st.repeat && !recEdit ? 'Dauerauftrag speichern' : 'Speichern';
    dateLabel.textContent = recEdit ? 'Nächste Zahlung am' : st.repeat ? 'Erste Zahlung am' : 'Datum';
    dateHint.hidden = !st.repeat;
    dateHint.textContent = 'Legt auch den Tag fest, an dem jedes Mal gebucht wird.';
    for (const b of intervalChips.children) b.setAttribute('aria-pressed', String(Number(b.dataset.value) === st.interval));
    for (const b of endChips.children) b.setAttribute('aria-pressed', String(b.dataset.value === st.endMode));
    countWrap.hidden = st.endMode !== 'count';
    if (st.repeat) {
      const date = dateInput.value;
      const count = Number(countInput.value);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const parts = [];
      if (valid) parts.push(describeRhythm({ startDate: date, interval: st.interval }));
      if (st.endMode === 'never') parts.push('unbegrenzt');
      else if (Number.isInteger(count) && count > 0) {
        const last = { startDate: date, interval: st.interval };
        parts.push(`${count} ${count === 1 ? 'Zahlung' : 'Zahlungen'}${valid ? `, letzte am ${formatDate(dueDate(last, count - 1))}` : ''}`);
      }
      repeatSummary.textContent = parts.join(' · ');
    }
    updateType();
  }

  /** Kategorie-Liste füllen und gewählten Wert anzeigen */
  function renderCategories() {
    const cats = categoriesFor(st.type);
    const current = categoryById(st.categoryId);
    const shown = current && current.type === st.type ? current : null;
    catPicker.setValue(shown?.name, shown ? catTile(shown, { size: 'sm' }) : null);
    // Eine Liste mit allen Kategorien: die zuletzt benutzten stehen oben, der Rest in der gewohnten Reihenfolge
    const recent = recentCategoryIds(st.type, 3).map((id) => cats.find((c) => c.id === id)).filter(Boolean);
    const ordered = [...recent, ...cats.filter((c) => !recent.includes(c))];
    catList.replaceChildren(...ordered.map((c) => pickerOption({
      label: c.name,
      lead: catTile(c, { size: 'sm' }),
      selected: c.id === st.categoryId,
      onClick: () => chooseCategory(c),
      data: { id: c.id },
    })));
  }

  function chooseCategory(c) {
    st.categoryId = c.id;
    st.dirty = true;
    clearError();
    catPicker.close();
    renderCategories();
    // Tastatur schließen, damit gleich gespeichert werden kann; die Beschreibung ist freiwillig
    document.activeElement?.blur();
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
    if (st.repeat) { await saveRepeat(cat, cents); return; }

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

  /** Dauerauftrag anlegen oder ändern; vergangene Termine auf Wunsch nachtragen */
  async function saveRepeat(cat, cents) {
    const startDate = dateInput.value;
    let limit = null;
    if (st.endMode === 'count') {
      limit = Number(countInput.value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 600) {
        showError('Bitte die Anzahl der Zahlungen als ganze Zahl eingeben, z. B. 12.');
        return;
      }
    }
    if (recEdit && recurring.lastDate && startDate <= recurring.lastDate) {
      showError(`Die nächste Zahlung muss nach der zuletzt gebuchten (${formatDate(recurring.lastDate)}) liegen.`);
      return;
    }
    // Liegt die erste Zahlung in der Vergangenheit? Dann fragen, ob nachgetragen werden soll.
    const today = todayISO();
    const past = dueCount({ startDate, interval: st.interval, limit, done: 0 }, shiftDay(today, -1));
    let skipPast = false;
    if (past > 0) {
      const choice = await choiceDialog({
        title: 'Vergangene Zahlungen nachtragen?',
        text: `Seit dem ${formatDate(startDate)} wären bis gestern ${past} ${past === 1 ? 'Zahlung' : 'Zahlungen'} fällig gewesen. `
          + 'Sollen sie als Buchungen nachgetragen werden?',
        buttons: [
          { label: past === 1 ? '1 Zahlung nachtragen' : `Alle ${past} nachtragen`, value: 'all', kind: 'primary' },
          { label: 'Nein, erst ab heute', value: 'skip' },
          { label: 'Abbrechen' },
        ],
      });
      if (!choice) return;
      skipPast = choice === 'skip';
    }
    st.saving = true;
    saveBtn.disabled = true;
    saveBtnTop.disabled = true;
    try {
      const { rec, created } = await saveRecurring({
        id: recurring?.id,
        type: st.type,
        amountCents: cents,
        categoryId: cat.id,
        description: descInput.value.trim(),
        startDate,
        interval: st.interval,
        limit,
      }, { skipPast });
      setLastType(st.type);
      close();
      const next = nextDate(rec);
      const booked = created.length ? `${created.length} ${created.length === 1 ? 'Zahlung' : 'Zahlungen'} gebucht` : null;
      const upcoming = next ? `nächste am ${formatDate(next)}` : null;
      toast(`Dauerauftrag ${recEdit ? 'gespeichert' : 'angelegt'}${[booked, upcoming].filter(Boolean).map((x) => ` · ${x}`).join('')}`);
    } catch (err) {
      console.error(err);
      showError(`Speichern hat nicht geklappt: ${err.message || err}`);
      st.saving = false;
      saveBtn.disabled = false;
      saveBtnTop.disabled = false;
    }
  }

  /** Dauerauftrag beenden (keine weiteren Zahlungen) */
  async function endRec() {
    const ok = await confirmDialog({
      title: 'Dauerauftrag beenden?',
      text: 'Es werden keine weiteren Zahlungen gebucht. Bereits gebuchte Zahlungen bleiben erhalten.',
      confirmLabel: 'Beenden',
      danger: true,
    });
    if (!ok) return;
    await endRecurring(recurring.id);
    close();
    toast('Dauerauftrag beendet');
  }

  /** Von einer Buchung zu ihrem Dauerauftrag wechseln */
  async function openRecurringFromBooking() {
    if (st.dirty) {
      const ok = await confirmDialog({
        title: 'Änderungen verwerfen?',
        text: 'Die Änderungen an dieser Buchung werden nicht gespeichert.',
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
    }
    close();
    openBookingForm(null, { recurring: fromRec });
  }

  async function remove() {
    if (recEdit) {
      const count = state.bookings.filter((b) => b.recurringId === recurring.id).length;
      const ok = await confirmDialog({
        title: 'Dauerauftrag löschen?',
        text: `„${recurring.description || categoryById(recurring.categoryId)?.name || 'Dauerauftrag'}“ wird gelöscht. `
          + (count ? `Die ${count} bereits gebuchten ${count === 1 ? 'Zahlung bleibt' : 'Zahlungen bleiben'} erhalten.` : ''),
        confirmLabel: 'Löschen',
        danger: true,
      });
      if (!ok) return;
      await deleteRecurring(recurring.id);
      close();
      toast('Dauerauftrag gelöscht');
      return;
    }
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

  updateRepeat();
  renderCategories();
  renderReceipt();

  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);

  // Sofort fokussieren (noch im selben Tipp), damit die Zahlentastatur aufgeht
  if (!isEdit && !recEdit) amountInput.focus({ preventScroll: true });
}
