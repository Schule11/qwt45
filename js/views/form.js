// Formular "Neue Buchung" / "Buchung bearbeiten" – öffnet sich im Vollbild.

import { h, icon, toast, confirmDialog, openImageViewer, isTouchDevice } from '../ui.js';
import {
  state, categoriesFor, categoryById, saveBooking, deleteBooking, getReceipt, receiptToBlob, saveContact,
  productsFor, recordById, routesSorted, saveRecord, recentCategoryIds,
} from '../data.js';
import { personPicker } from './personPicker.js';
import { disclosurePicker, pickerOption, pickerGroup } from './picker.js';
import { openInvoiceEditor, openInvoiceDetail } from './invoices.js';
import { KIND_LABEL, STATUS_LABEL, invoiceStatus, cancelInvoice } from '../invoices.js';
import {
  activeVouchers, voucherRemaining, voucherRedeemed, activeCardsFor, cardRemaining,
  createVoucherForBooking, createCardForBooking, redeemVoucher, useCard,
} from '../vouchers.js';
import { offerVoucherPdf, cancelVoucher } from './vouchers.js';
import { detachBooking } from '../courses.js';
import { PAYMENT_METHODS, productPriceLabel } from '../defaults.js';
import { parseAmount, centsToInput, todayISO, formatMoney, formatDate, formatKm, normalizeText } from '../format.js';
import { prepareReceipt } from '../image.js';
import { openFile } from '../files.js';

const GWG_HINT_CENTS = 80000; // ab 800 € Hinweis auf mögliche Abschreibung

let open = false;
const closeListeners = new Set();

export function isFormOpen() { return open; }
export function onFormClosed(fn) { closeListeners.add(fn); }

function getLastType() {
  // Standard: Einnahme (das Häufigste nach einer Trainingsstunde)
  try { return localStorage.getItem('lastType') === 'expense' ? 'expense' : 'income'; } catch { return 'income'; }
}
function setLastType(type) {
  try { localStorage.setItem('lastType', type); } catch { /* egal */ }
}
function getLastPaid() {
  try { return localStorage.getItem('lastPaid') !== 'open'; } catch { return true; }
}
function setLastPaid(paid) {
  try { localStorage.setItem('lastPaid', paid ? 'paid' : 'open'); } catch { /* egal */ }
}

/**
 * Öffnet das Formular. WICHTIG: Muss direkt im Klick-Handler aufgerufen
 * werden (ohne await davor), sonst öffnet das iPhone die Tastatur nicht.
 */
export function openBookingForm(existing = null, opts = {}) {
  if (open) return;
  open = true;

  const isEdit = !!existing;
  const st = {
    type: existing?.type || (opts.productId ? (recordById('products', opts.productId)?.type || 'income') : getLastType()),
    categoryId: existing?.categoryId || null,
    payment: existing?.payment || null,
    receiptId: existing?.receiptId || null, // gespeichertes Foto
    newReceipt: null,                        // neu gewähltes Foto
    removeReceipt: false,
    receiptBusy: false,
    saving: false,
    dirty: false,
    mileage: false, // Fahrtkosten-Modus: Kilometer statt Betrag
    // Einnahme schon bezahlt? (Ausgaben sind immer bezahlt)
    paid: existing ? existing.paid !== false : getLastPaid(),
    // Datum der Stunde zusätzlich zeigen, wenn die Buchung offen war/ist
    showService: !!existing?.serviceDate || existing?.paid === false,
    productId: existing?.productId || null, // gewählter Eintrag der Preisliste
    quantity: existing?.quantity || 1,      // z. B. Anzahl 15-Minuten-Einheiten
    autoDesc: existing?.description || null, // automatisch eingesetzte Beschreibung
    redeem: null,          // Einlösen statt bezahlen: { kind: 'card', cardId } | { kind: 'voucher', voucherId }
    restPayment: 'cash',   // wie ein Restbetrag über den Gutschein hinaus bezahlt wurde
  };
  // Kilometerpauschale: bei bestehenden Fahrten die damals gültige, sonst die aktuelle
  const kmRateCents = existing?.kmRateCents ?? state.settings.kmRateCents;
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
    value: existing
      ? (existing.km != null ? formatKm(existing.kmEntered ?? existing.km) : centsToInput(existing.fullAmountCents ?? existing.amountCents))
      : '',
    oninput: () => { st.dirty = true; updateAmountHint(); updateRedeemInfo(); clearError(); },
  });
  const amountLabel = h('label', { class: 'lbl', for: 'amount' }, 'Betrag');
  const amountSuffix = h('span', { class: 'amount-suffix', 'aria-hidden': 'true' }, '€');
  const kmInfo = h('p', { class: 'hint km-info', hidden: true });
  const shareInfo = h('p', { class: 'hint km-info', hidden: true });

  // Preisliste: ein Tipp füllt Betrag, Kategorie und Beschreibung
  const productRow = h('div', { class: 'product-row', role: 'group', 'aria-label': 'Preisliste' });
  const productWrap = h('div', null, h('div', { class: 'lbl' }, 'Preisliste'), productRow);
  const qtyLabel = h('span', { class: 'qty-value', 'aria-live': 'polite' });
  const qtyRow = h('div', { class: 'qty-row', hidden: true },
    h('span', { class: 'qty-title' }, 'Dauer'),
    h('button', { type: 'button', class: 'round-btn qty-btn', 'aria-label': '15 Minuten weniger', onclick: () => changeQty(-1) }, '−'),
    qtyLabel,
    h('button', { type: 'button', class: 'round-btn qty-btn', 'aria-label': '15 Minuten mehr', onclick: () => changeQty(1) }, '+'));

  // Fahrten: Ziel, Zweck, Hin- und Rückfahrt, häufige Strecken
  const routeChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Häufige Strecken' });
  const routeWrap = h('div', null, h('div', { class: 'lbl' }, 'Häufige Strecken'), routeChips);
  const tripToInput = h('input', {
    class: 'field', id: 'trip-to', type: 'text', maxlength: 120, autocomplete: 'off', autocapitalize: 'sentences',
    enterkeyhint: 'next', placeholder: 'z. B. Hundeplatz, Kundin in Cappel', value: existing?.tripTo || '',
    oninput: () => { st.dirty = true; updateRouteSave(); },
  });
  const tripPurposeInput = h('input', {
    class: 'field', id: 'trip-purpose', type: 'text', maxlength: 120, autocomplete: 'off', autocapitalize: 'sentences',
    enterkeyhint: 'done', placeholder: 'z. B. Einzeltraining, Fortbildung, Einkauf', value: existing?.tripPurpose || '',
    oninput: () => { st.dirty = true; },
  });
  const roundTripBox = h('input', {
    type: 'checkbox', id: 'trip-round', checked: !!existing?.roundTrip,
    onchange: () => { st.dirty = true; updateAmountHint(); updateRouteSave(); },
  });
  const saveRouteBtn = h('button', { type: 'button', class: 'btn-text', hidden: true, onclick: () => rememberRoute() }, '+ Als häufige Strecke merken');
  const tripWrap = h('div', { hidden: true },
    routeWrap,
    h('label', { class: 'lbl', for: 'trip-to' }, 'Ziel'),
    tripToInput,
    saveRouteBtn,
    h('label', { class: 'lbl', for: 'trip-purpose' }, 'Zweck der Fahrt'),
    tripPurposeInput,
    h('label', { class: 'switch-row', for: 'trip-round' },
      h('span', null, h('strong', null, 'Hin- und Rückfahrt'),
        h('span', { class: 'hint', style: 'display:block; margin: 2px 0 0' }, 'Die eingegebenen km werden verdoppelt.')),
      roundTripBox));
  const amountHint = h('p', { class: 'hint warn', hidden: true },
    'Hinweis: Kostet eine Anschaffung (z. B. ein Gerät, das länger als ein Jahr hält) netto mehr als 800 €, '
    + 'muss sie meist über mehrere Jahre abgeschrieben werden. Im Zweifel bei Steuerberatung nachfragen.');

  // Kategorie als aufklappbare Liste (zuletzt verwendete oben)
  const catPicker = disclosurePicker({ id: 'cat-picker', placeholder: 'Kategorie wählen', label: 'Kategorie' });
  const catList = h('div', { class: 'picker-list', role: 'listbox', 'aria-label': 'Kategorien' });
  catPicker.panel.append(catList);
  catPicker.onOpen(() => renderChips());

  const personLabel = h('label', { class: 'lbl', for: 'person' }, 'Kund:in (optional)');
  const picker = personPicker({ initialId: existing?.personId, onChange: () => { st.dirty = true; updateRedeemOptions(); } });
  // Gutschein: für wen (steht auf dem Gutschein-PDF)
  const voucherForInput = h('input', {
    class: 'field', id: 'voucher-for', type: 'text', maxlength: 80, autocomplete: 'off', autocapitalize: 'words',
    placeholder: 'z. B. Lisa (optional)', oninput: () => { st.dirty = true; },
  });
  const voucherForWrap = h('div', { hidden: true },
    h('label', { class: 'lbl', for: 'voucher-for' }, 'Gutschein für (optional)'),
    voucherForInput,
    h('p', { class: 'hint' }, 'Steht auf dem Gutschein-PDF. Die Kund:in oben ist, wer den Gutschein kauft.'));

  const descInput = h('input', {
    class: 'field',
    id: 'desc',
    type: 'text',
    maxlength: 200,
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    placeholder: 'z. B. Einzelstunde Bello',
    value: existing?.description || '',
    oninput: () => { st.dirty = true; },
    onkeydown: (e) => {
      // Auf dem Handy schließt "Fertig" nur die Tastatur, statt zu speichern
      if (e.key === 'Enter' && isTouchDevice()) { e.preventDefault(); descInput.blur(); }
    },
  });

  // Zahlungsdatum (zählt für die EÜR)
  const dateInput = h('input', {
    class: 'field',
    id: 'date',
    type: 'date',
    required: true,
    value: existing && existing.paid !== false ? existing.date : todayISO(),
    onchange: () => { st.dirty = true; clearError(); },
  });
  const dateWrap = h('div', null, h('label', { class: 'lbl', for: 'date' }, 'Datum der Zahlung'), dateInput);

  // Datum der Stunde (bei offenen Einnahmen)
  const serviceInput = h('input', {
    class: 'field',
    id: 'service-date',
    type: 'date',
    value: existing?.serviceDate || existing?.date || todayISO(),
    onchange: () => { st.dirty = true; clearError(); },
  });
  const serviceWrap = h('div', null, h('label', { class: 'lbl', for: 'service-date' }, 'Datum der Stunde'), serviceInput);

  const openHint = h('p', { class: 'hint' },
    'Erscheint unter „Offene Zahlungen“ und zählt erst zum Gewinn, wenn du sie als bezahlt abhakst.');

  // Zahlung: Bar / Überweisung / PayPal – oder (nur Einnahmen) "Noch offen"
  const openChip = h('button', {
    type: 'button',
    class: 'chip chip-open',
    onclick: () => {
      if (st.redeem) { st.redeem = null; st.paid = true; }
      setPaid(!st.paid);
      updateStatus();
    },
  }, 'Noch offen');

  // Einlösen: 10er-Karte oder Gutschein (keine neue Einnahme)
  const cardChip = h('button', {
    type: 'button',
    class: 'chip chip-redeem',
    hidden: true,
    onclick: () => {
      const cards = activeCardsFor(picker.value().personId, currentProduct()?.id);
      st.redeem = st.redeem?.kind === 'card' ? null : (cards[0] ? { kind: 'card', cardId: cards[0].id } : null);
      st.paid = true;
      st.dirty = true;
      updateStatus();
    },
  }, '10er-Karte');
  const voucherChip = h('button', {
    type: 'button',
    class: 'chip chip-redeem',
    hidden: true,
    onclick: () => {
      const on = st.redeem?.kind !== 'voucher';
      st.redeem = on ? { kind: 'voucher', voucherId: null } : null;
      st.paid = true;
      st.dirty = true;
      updateStatus();
      if (on) voucherPicker.open();
    },
  }, 'Gutschein');
  const voucherPicker = disclosurePicker({ id: 'voucher-picker', placeholder: 'Gutschein auswählen', label: 'Gutschein' });
  const voucherList = h('div', { class: 'picker-list', role: 'listbox', 'aria-label': 'Gutscheine' });
  voucherPicker.panel.append(voucherList);
  voucherPicker.onOpen(() => renderVoucherOptions());
  const restChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Restbetrag' },
    [['cash', 'Bar'], ['transfer', 'Überweisung'], ['open', 'Noch offen']].map(([v, l]) => h('button', {
      type: 'button', class: 'chip', 'data-value': v,
      onclick: () => { st.restPayment = v; st.dirty = true; updateRedeemInfo(); },
    }, l)));
  const redeemInfo = h('p', { class: 'hint redeem-info', hidden: true });
  const restWrap = h('div', { hidden: true }, restChips);
  const voucherWrap = h('div', { hidden: true, style: 'margin-top: 10px' }, voucherPicker.el);
  const payChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Zahlung' },
    PAYMENT_METHODS.map((p) => h('button', {
      type: 'button',
      class: 'chip',
      'data-value': p.value,
      onclick: () => {
        // nochmal tippen = abwählen; eine Zahlungsart heißt immer "bezahlt"
        st.payment = st.payment === p.value && st.paid && !st.redeem ? null : p.value;
        st.dirty = true;
        st.redeem = null;
        if (!st.paid) setPaid(true);
        else updateStatus();
      },
    }, p.label)),
    cardChip,
    voucherChip,
    openChip);

  const payLabel = h('div', { class: 'lbl' }, 'Zahlung');
  const payWrap = h('div', null, payLabel, payChips, openHint, voucherWrap, redeemInfo, restWrap);
  const personWrap = h('div');

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
        typeButtons.income, typeButtons.expense),

      productWrap,

      amountLabel,
      h('div', { class: 'amount-wrap' }, amountInput, amountSuffix),
      qtyRow,
      kmInfo,
      shareInfo,
      amountHint,
      tripWrap,

      h('div', { class: 'lbl', id: 'cat-label' }, 'Kategorie'),
      catPicker.el,

      personWrap,
      voucherForWrap,

      h('label', { class: 'lbl', for: 'desc' }, 'Beschreibung (optional)'),
      descInput,

      payWrap,
      serviceWrap,
      dateWrap,

      h('div', { class: 'lbl' }, 'Beleg (optional)'),
      receiptRow,
      fileInput,

      invoiceSection(),

      errorBox,

      h('div', { class: 'form-actions' },
        saveBtn,
        isEdit ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Buchung löschen') : null)));

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' }, form);

  /** Rechnung/Quittung zur gespeicherten Einnahme */
  function invoiceSection() {
    if (!isEdit || existing.type !== 'income') return null;
    const course = recordById('courses', existing.courseId);
    const courseNote = course ? h('p', { class: 'hint' }, `Gehört zum Kurs „${course.name}“ (Übersicht → Kurse).`) : null;
    return [courseNote, invoiceButtons()];
  }

  function invoiceButtons() {
    const inv = recordById('invoices', existing.invoiceId);
    if (inv && !inv.cancelled) {
      const status = invoiceStatus(inv);
      return h('div', null,
        h('div', { class: 'lbl' }, 'Rechnung'),
        h('button', { type: 'button', class: 'row nav-row inv-link', onclick: () => openInvoiceDetail(inv) },
          icon('receipt', 20),
          h('span', { class: 'nav-label' }, `${KIND_LABEL[inv.kind]} ${inv.number}`),
          h('span', { class: `status status-${status}` }, STATUS_LABEL[status]),
          h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')));
    }
    const start = (kind) => {
      if (st.dirty) { showError('Bitte zuerst speichern, dann die Rechnung erstellen.'); return; }
      openInvoiceEditor({ kind, booking: existing, onCreated: () => close() });
    };
    return h('div', null,
      h('div', { class: 'lbl' }, 'Rechnung (optional)'),
      h('div', { class: 'btn-pair', style: 'margin-top: 0' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => start('invoice') }, 'Rechnung erstellen'),
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => start('receipt') }, 'Quittung erstellen')));
  }

  // ---------- Anzeige aktualisieren ----------

  function setType(type) {
    if (st.type === type) return;
    st.type = type;
    const cat = categoryById(st.categoryId);
    if (cat && cat.type !== type) st.categoryId = null;
    st.productId = null;
    updateType();
    renderChips();
    renderProducts();
    updateMode();
  }

  // ---------- Preisliste ----------

  function currentProduct() {
    const p = recordById('products', st.productId);
    return p && (p.type || 'income') === st.type ? p : null;
  }

  function renderProducts() {
    const list = productsFor(st.type);
    productWrap.hidden = list.length === 0;
    queueMicrotask(() => updateRedeemOptions());
    productRow.replaceChildren(...list.map((p) => h('button', {
      type: 'button',
      class: 'chip product-chip',
      'aria-pressed': String(p.id === st.productId),
      onclick: () => selectProduct(p),
    },
    h('span', { class: 'product-name' }, p.name),
    h('span', { class: 'product-price' }, productPriceLabel(p, formatMoney)))));
    updateQty();
  }

  function productText(p) {
    return p.unit === 'quarter' ? `${p.name} (${st.quantity * 15} Min)` : p.name;
  }

  /** Betrag und Beschreibung aus der Preisliste übernehmen */
  function applyProduct() {
    const p = currentProduct();
    if (!p) return;
    if (p.unit === 'fixed') amountInput.value = centsToInput(p.priceCents);
    if (p.unit === 'quarter') amountInput.value = centsToInput(p.priceCents * st.quantity);
    // Beschreibung nur setzen, wenn sie leer ist oder von uns stammt
    if (!descInput.value.trim() || descInput.value === st.autoDesc) {
      descInput.value = productText(p);
      st.autoDesc = descInput.value;
    }
    updateAmountHint();
  }

  function selectProduct(p) {
    const again = st.productId === p.id;
    st.productId = again ? null : p.id; // nochmal tippen = abwählen
    st.dirty = true;
    clearError();
    if (!again) {
      if (p.unit === 'quarter' && !st.quantity) st.quantity = 1;
      const cat = categoryById(p.categoryId);
      if (cat && cat.type === st.type) {
        st.categoryId = cat.id;
        renderChips();
        updateMode();
      }
      if (p.unit === 'free') amountInput.value = '';
      applyProduct();
    }
    renderProducts();
    if (again) return;
    if (p.unit === 'free') {
      // freier Betrag (z. B. Gutschein): gleich eintippen
      amountInput.placeholder = `ab ${centsToInput(p.priceCents)}`;
      amountInput.focus();
    } else if (!isEdit) {
      if (st.type === 'income' && !picker.hasSelection() && !state.contacts.length) picker.openSearch();
      else document.activeElement?.blur();
    }
  }

  function updateQty() {
    const p = currentProduct();
    qtyRow.hidden = !(p && p.unit === 'quarter');
    qtyLabel.textContent = `${st.quantity * 15} Min`;
  }

  function changeQty(delta) {
    st.quantity = Math.max(1, Math.min(32, st.quantity + delta));
    st.dirty = true;
    updateQty();
    applyProduct();
  }

  // ---------- Fahrten ----------

  function renderRoutes() {
    const list = routesSorted();
    routeWrap.hidden = list.length === 0;
    routeChips.replaceChildren(...list.map((r) => h('button', {
      type: 'button',
      class: 'chip',
      onclick: () => selectRoute(r),
    }, `${r.name} · ${formatKm(r.km)} km${r.roundTrip ? ' ⇄' : ''}`)));
  }

  function selectRoute(r) {
    tripToInput.value = r.name;
    amountInput.value = formatKm(r.km);
    roundTripBox.checked = !!r.roundTrip;
    if (r.purpose && !tripPurposeInput.value.trim()) tripPurposeInput.value = r.purpose;
    st.dirty = true;
    clearError();
    updateAmountHint();
    updateRouteSave();
  }

  function updateRouteSave() {
    const name = tripToInput.value.trim();
    const km = parseAmount(amountInput.value);
    const known = state.routes.some((r) => normalizeText(r.name) === normalizeText(name));
    saveRouteBtn.hidden = !(st.mileage && name && km && !known);
  }

  async function rememberRoute() {
    const name = tripToInput.value.trim();
    const km = parseAmount(amountInput.value);
    if (!name || !km) { showError('Bitte Ziel und Kilometer eingeben.'); return; }
    await saveRecord('routes', {
      name, km: km / 100, roundTrip: roundTripBox.checked, purpose: tripPurposeInput.value.trim(),
    }, { silent: true });
    toast('Strecke gemerkt');
    renderRoutes();
    updateRouteSave();
  }

  // ---------- Privatanteil ----------

  /** Betrieblicher Anteil in % (bei bestehenden Buchungen der damalige Wert) */
  function sharePercent() {
    const cat = categoryById(st.categoryId);
    if (!cat || st.type !== 'expense' || cat.mileage) return 100;
    if (existing && existing.categoryId === cat.id && existing.businessPercent) return existing.businessPercent;
    return cat.businessPercent || 100;
  }

  /** Fahrtkosten-Kategorie gewählt? Dann Kilometer statt Betrag eingeben. */
  function updateMode() {
    st.mileage = !!categoryById(st.categoryId)?.mileage;
    amountSuffix.textContent = st.mileage ? 'km' : '€';
    tripWrap.hidden = !st.mileage;
    amountInput.placeholder = st.mileage ? '0' : '0,00';
    amountInput.setAttribute('aria-label', st.mileage ? 'Gefahrene Kilometer' : 'Betrag in Euro');
    updateAmountHint();
    updatePerson();
  }

  function updateType() {
    sheet.classList.toggle('t-expense', st.type === 'expense');
    sheet.classList.toggle('t-income', st.type === 'income');
    typeButtons.expense.setAttribute('aria-pressed', String(st.type === 'expense'));
    typeButtons.income.setAttribute('aria-pressed', String(st.type === 'income'));
    const word = st.type === 'income' ? 'Einnahme' : 'Ausgabe';
    title.textContent = isEdit ? `${word} bearbeiten` : `Neue ${word}`;
    personLabel.textContent = 'Kund:in (optional)';
    updateStatus();
  }

  function setPaid(paid) {
    if (st.paid === paid) return;
    st.paid = paid;
    st.dirty = true;
    if (!paid) { st.showService = true; st.payment = null; }
    updateStatus();
  }

  function isOpenEntry() { return st.type === 'income' && !st.paid; }

  function updateStatus() {
    const income = st.type === 'income';
    const open = isOpenEntry() && !st.redeem;
    openChip.hidden = !income;
    payLabel.textContent = income ? 'Zahlung' : 'Zahlung (optional)';
    openHint.hidden = !open;
    // Beim Einlösen zählt das Datum der Stunde (es fließt kein Geld)
    serviceWrap.hidden = !(open || st.redeem || (income && st.showService));
    dateWrap.hidden = open || !!st.redeem;
    voucherWrap.hidden = st.redeem?.kind !== 'voucher';
    if (st.redeem?.kind !== 'voucher') voucherPicker.close();
    updatePayChips();
    updatePerson();
    updateRedeemInfo();
  }

  // ---------- Gutschein / 10er-Karte ----------

  /** Welche Einlöse-Möglichkeiten passen gerade (Kund:in, Leistung)? */
  function updateRedeemOptions() {
    const product = currentProduct();
    const sells = product && product.kind && product.kind !== 'service';
    const allowed = st.type === 'income' && !isEdit && !sells;
    const cards = allowed && product ? activeCardsFor(picker.value().personId, product.id) : [];
    cardChip.hidden = !cards.length;
    if (cards.length) cardChip.textContent = `10er-Karte (noch ${cardRemaining(cards[0])})`;
    voucherChip.hidden = !(allowed && activeVouchers().length);
    if (st.redeem?.kind === 'card' && !cards.some((c) => c.id === st.redeem.cardId)) st.redeem = cards[0] ? { kind: 'card', cardId: cards[0].id } : null;
    if (st.redeem?.kind === 'voucher' && voucherChip.hidden) st.redeem = null;
    // Gutschein verkaufen: "für wen" anzeigen
    voucherForWrap.hidden = !(product?.kind === 'voucher' && !isEdit);
    updateStatus();
  }

  function renderVoucherOptions() {
    const list = activeVouchers();
    voucherList.replaceChildren(...list.map((v) => pickerOption({
      label: `${v.code} · Rest ${formatMoney(voucherRemaining(v))}`,
      sub: [v.recipientName ? `für ${v.recipientName}` : null, `gültig bis ${formatDate(v.validUntil)}`].filter(Boolean).join(' · '),
      selected: st.redeem?.voucherId === v.id,
      onClick: () => {
        st.redeem = { kind: 'voucher', voucherId: v.id };
        st.dirty = true;
        voucherPicker.close();
        updateStatus();
      },
      data: { id: v.id },
    })));
  }

  function updateRedeemInfo() {
    const r = st.redeem;
    redeemInfo.hidden = !r;
    restWrap.hidden = true;
    for (const b of restChips.children) b.setAttribute('aria-pressed', String(b.dataset.value === st.restPayment));
    if (!r) return;
    const amount = parseAmount(amountInput.value) || 0;
    if (r.kind === 'card') {
      const card = recordById('cards', r.cardId);
      const left = card ? cardRemaining(card) : 0;
      redeemInfo.textContent = `Wird von der 10er-Karte abgebucht (noch ${left}, danach ${left - 1}). Es entsteht keine neue Einnahme.`;
      return;
    }
    const v = recordById('vouchers', r.voucherId);
    voucherPicker.setValue(v ? `${v.code} · Rest ${formatMoney(voucherRemaining(v))}` : null);
    if (!v) { redeemInfo.textContent = 'Bitte den Gutschein auswählen.'; return; }
    const rest = voucherRemaining(v);
    if (amount <= rest) {
      redeemInfo.textContent = `Wird vom Gutschein abgezogen (Rest danach ${formatMoney(rest - amount)}). Es entsteht keine neue Einnahme.`;
    } else {
      redeemInfo.textContent = `Der Gutschein deckt ${formatMoney(rest)}. Den Restbetrag von ${formatMoney(amount - rest)} hat die Kund:in bezahlt per:`;
      restWrap.hidden = false;
    }
  }

  // Kund:in: bei Einnahmen immer, bei Ausgaben nur für Fahrten (oder wenn schon gewählt)
  function updatePerson() {
    const show = st.type === 'income' || st.mileage || picker.hasSelection() || !!picker.input.value.trim();
    if (show && !personWrap.firstChild) personWrap.append(personLabel, picker.el);
    if (!show) personWrap.replaceChildren();
  }

  /** Kategorie-Liste füllen und gewählten Wert anzeigen */
  function renderChips() {
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
    // Andere Kategorie als der Preislisten-Eintrag? Dann Verknüpfung lösen
    const prod = currentProduct();
    if (prod && prod.categoryId !== c.id) { st.productId = null; renderProducts(); }
    renderChips();
    const wasMileage = st.mileage;
    updateMode();
    if (st.mileage && !wasMileage) {
      // Fahrtkosten: weiter zur Kilometer-Eingabe
      amountInput.focus();
      amountInput.select();
    } else if (isEdit) {
      // beim Bearbeiten nichts automatisch fokussieren
    } else if (st.type === 'income' && !picker.hasSelection()) {
      // Einnahme: als Nächstes die Kund:in. Ohne gespeicherte Namen gleich tippen lassen.
      if (state.contacts.length) document.activeElement?.blur();
      else picker.openSearch();
    } else if (!descInput.value) {
      // sonst direkt weiter zur Beschreibung
      descInput.focus();
    }
  }

  function updatePayChips() {
    for (const el of payChips.children) {
      if (el === openChip) el.setAttribute('aria-pressed', String(isOpenEntry() && !st.redeem));
      else if (el === cardChip) el.setAttribute('aria-pressed', String(st.redeem?.kind === 'card'));
      else if (el === voucherChip) el.setAttribute('aria-pressed', String(st.redeem?.kind === 'voucher'));
      else el.setAttribute('aria-pressed', String(!st.redeem && st.paid && el.dataset.value === st.payment));
    }
  }

  function updateAmountHint() {
    const value = parseAmount(amountInput.value);
    const pct = sharePercent();
    amountLabel.textContent = st.mileage ? 'Gefahrene Kilometer' : pct < 100 ? 'Rechnungsbetrag' : 'Betrag';
    amountHint.hidden = st.mileage || !(st.type === 'expense' && value != null && value > GWG_HINT_CENTS);
    kmInfo.hidden = !st.mileage;
    if (st.mileage) {
      const rate = formatMoney(kmRateCents);
      const total = value && roundTripBox.checked ? value * 2 : value;
      const calc = roundTripBox.checked ? `${formatKm(value / 100)} km × 2 = ${formatKm(total / 100)} km` : `${formatKm((value || 0) / 100)} km`;
      kmInfo.textContent = value
        ? `= ${formatMoney(Math.round((total * kmRateCents) / 100))}  (${calc} × ${rate})`
        : `Der Betrag wird mit ${rate} pro km berechnet (änderbar in den Einstellungen).`;
    }
    shareInfo.hidden = st.mileage || pct >= 100;
    if (pct < 100) {
      shareInfo.textContent = value
        ? `Davon ${pct} % betrieblich: ${formatMoney(Math.round((value * pct) / 100))} – nur das zählt für die EÜR.`
        : `Es zählt nur der betriebliche Anteil von ${pct} %.`;
    }
    updateRouteSave();
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
    const value = parseAmount(amountInput.value); // Cent bzw. Hundertstel-Kilometer
    let cents = value;
    let km = null;
    let kmEntered = null;
    let fullAmountCents = null;
    let businessPercent = null;
    const product = currentProduct();
    if (cat?.mileage) {
      if (value == null || value <= 0) {
        showError(amountInput.value.trim() ? 'Bitte gültige Kilometer eingeben, z. B. 42 oder 12,5.' : 'Bitte die gefahrenen Kilometer eingeben.');
        return;
      }
      if (value > 10000000) { showError('So viele Kilometer? Bitte prüfen.'); return; }
      const total = roundTripBox.checked ? value * 2 : value;
      kmEntered = value / 100;
      km = total / 100;
      cents = Math.round((total * kmRateCents) / 100);
    } else {
      if (product?.unit === 'free' && value != null && value < product.priceCents) {
        showError(`${product.name}: mindestens ${formatMoney(product.priceCents)}.`);
        return;
      }
      const pct = sharePercent();
      if (pct < 100 && value > 0) {
        fullAmountCents = value;
        businessPercent = pct;
        cents = Math.round((value * pct) / 100);
      }
      if (value == null || value <= 0) {
        showError(amountInput.value.trim() ? 'Bitte einen gültigen Betrag eingeben, z. B. 45,50.' : 'Bitte einen Betrag eingeben.');
        return;
      }
      if (value > 100000000) { showError('Der Betrag ist ungewöhnlich hoch. Bitte prüfen.'); return; }
    }
    if (!cat || cat.type !== st.type) { showError('Bitte eine Kategorie wählen.'); return; }
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    const open = isOpenEntry();
    const withService = open || (st.type === 'income' && st.showService);
    if (withService && !DATE.test(serviceInput.value)) { showError('Bitte das Datum der Stunde wählen.'); return; }
    if (!open && !st.redeem && !DATE.test(dateInput.value)) { showError('Bitte das Datum der Zahlung wählen.'); return; }

    // --- Einlösen: 10er-Karte oder Gutschein (keine neue Einnahme) ---
    if (st.redeem) {
      if (!DATE.test(serviceInput.value)) { showError('Bitte das Datum der Stunde wählen.'); return; }
      const note = descInput.value.trim() || product?.name || cat.name;
      const who = picker.value().personId || null;
      st.saving = true;
      try {
        if (st.redeem.kind === 'card') {
          const left = await useCard(st.redeem.cardId, { date: serviceInput.value, note });
          close();
          toast(`Von der 10er-Karte abgebucht – noch ${left} ${left === 1 ? 'Stunde' : 'Stunden'}`);
          return;
        }
        const v = recordById('vouchers', st.redeem.voucherId);
        if (!v) { st.saving = false; showError('Bitte den Gutschein auswählen.'); return; }
        const covered = Math.min(cents, voucherRemaining(v));
        const rest = cents - covered;
        let restBooking = null;
        if (rest > 0) {
          const restOpen = st.restPayment === 'open';
          restBooking = await saveBooking({
            type: 'income',
            date: serviceInput.value,
            serviceDate: restOpen ? serviceInput.value : null,
            paid: !restOpen,
            amountCents: rest,
            categoryId: cat.id,
            description: `${note} (Rest nach Gutschein ${v.code})`,
            payment: restOpen ? null : st.restPayment,
            productId: product ? product.id : null,
            personId: who,
          });
        }
        await redeemVoucher(v.id, { date: serviceInput.value, cents: covered, note, personId: who, bookingId: restBooking?.id || null });
        close();
        toast(rest > 0
          ? `${formatMoney(covered)} vom Gutschein, ${formatMoney(rest)} als Einnahme gebucht`
          : `${formatMoney(covered)} vom Gutschein eingelöst`);
      } catch (err) {
        console.error(err);
        st.saving = false;
        showError(err.message || String(err));
      }
      return;
    }

    // --- 10er-Karte verkaufen: braucht eine Kund:in ---
    if (!isEdit && product?.kind === 'card' && !picker.hasSelection()) {
      showError('Bitte die Kund:in wählen – die 10er-Karte gehört zu ihr.');
      return;
    }
    // --- Gutschein-Verkauf ändern: nicht unter den schon eingelösten Betrag ---
    const soldVoucher = isEdit ? recordById('vouchers', existing.voucherId) : null;
    if (soldVoucher && cents < voucherRedeemed(soldVoucher)) {
      showError(`Von diesem Gutschein wurden schon ${formatMoney(voucherRedeemed(soldVoucher))} eingelöst.`);
      return;
    }

    st.saving = true;
    saveBtn.disabled = true;
    saveBtnTop.disabled = true;
    try {
      // Neue Kund:in gleich mit anlegen
      let { personId = null, newName } = picker.value();
      if (newName) personId = (await saveContact({ name: newName }, { silent: true })).id;

      const receiptChange = st.newReceipt
        ? { add: { data: st.newReceipt.data, type: st.newReceipt.type, width: st.newReceipt.width, height: st.newReceipt.height, name: st.newReceipt.name || null } }
        : (st.removeReceipt ? { remove: true } : null);
      const saved = await saveBooking({
        id: existing?.id,
        type: st.type,
        // Offen: Datum der Stunde (bis zur Zahlung). Bezahlt: Datum der Zahlung.
        date: open ? serviceInput.value : dateInput.value,
        paid: !open,
        serviceDate: withService ? serviceInput.value : null,
        amountCents: cents,
        categoryId: cat.id,
        description: descInput.value.trim(),
        payment: open ? null : st.payment,
        km,
        kmRateCents: km != null ? kmRateCents : null,
        kmEntered,
        roundTrip: km != null ? roundTripBox.checked : null,
        tripTo: km != null ? tripToInput.value.trim() : null,
        tripPurpose: km != null ? tripPurposeInput.value.trim() : null,
        fullAmountCents,
        businessPercent,
        productId: product ? product.id : null,
        quantity: product && product.unit === 'quarter' ? st.quantity : null,
        personId,
      }, receiptChange);
      setLastType(st.type);
      if (!isEdit && st.type === 'income') setLastPaid(!open);

      // Gutschein / 10er-Karte zum Verkauf anlegen
      let newVoucher = null;
      if (!isEdit && product?.kind === 'voucher') {
        newVoucher = await createVoucherForBooking(saved, { recipientName: voucherForInput.value.trim() });
        await saveBooking({ id: saved.id, voucherId: newVoucher.id });
      } else if (!isEdit && product?.kind === 'card') {
        const card = await createCardForBooking(saved, product);
        await saveBooking({ id: saved.id, cardId: card.id });
      } else if (soldVoucher && soldVoucher.valueCents !== cents) {
        await saveRecord('vouchers', { id: soldVoucher.id, valueCents: cents });
      }

      close();
      if (newVoucher) offerVoucherPdf(newVoucher);
      else if (!isEdit && product?.kind === 'card') toast(`10er-Karte angelegt (${product.cardSize || 10} Stunden)`);
      else toast(isEdit ? 'Änderung gespeichert' : open ? 'Offene Einnahme gespeichert' : `${st.type === 'income' ? 'Einnahme' : 'Ausgabe'} gespeichert`);
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
    const soldV = recordById('vouchers', existing.voucherId);
    const soldC = recordById('cards', existing.cardId);
    if ((soldV && (soldV.redemptions || []).length) || (soldC && (soldC.uses || []).length)) {
      showError(soldV
        ? `Von Gutschein ${soldV.code} wurde schon etwas eingelöst. Mach die Einlösungen zuerst rückgängig (Übersicht → Gutscheine).`
        : 'Von dieser 10er-Karte wurden schon Stunden abgebucht. Mach die Abbuchungen zuerst rückgängig (Übersicht → 10er-Karten).');
      return;
    }
    const inv = recordById('invoices', existing.invoiceId);
    const invText = inv && !inv.cancelled ? ` ${KIND_LABEL[inv.kind]} ${inv.number} wird dabei storniert (die Nummer bleibt vergeben).` : '';
    const ok = await confirmDialog({
      title: 'Buchung löschen?',
      text: `„${label}“ vom ${formatDate(existing.date)} über ${formatMoney(existing.amountCents)} wird gelöscht. Das lässt sich nicht rückgängig machen.${invText}`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      if (inv && !inv.cancelled) await cancelInvoice(inv);
      if (soldV) await cancelVoucher(soldV);
      if (soldC) await saveRecord('cards', { id: soldC.id, cancelled: true });
      await detachBooking(existing);
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
    picker.close();
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('sheet-open');
    for (const url of objectUrls) URL.revokeObjectURL(url);
    open = false;
    for (const fn of closeListeners) fn();
  }

  // ---------- Start ----------

  updateType();
  renderChips();
  renderProducts();
  renderRoutes();
  updateMode();
  renderReceipt();

  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);

  // Mit vorgewähltem Eintrag der Preisliste starten (z. B. "Gutschein verkaufen")
  const preset = !isEdit && opts.productId ? recordById('products', opts.productId) : null;
  if (preset) {
    selectProduct(preset); // fokussiert bei freiem Betrag (Gutschein) das Betragsfeld
  } else if (!isEdit) {
    // Sofort fokussieren (noch im selben Tipp), damit die Zahlentastatur aufgeht
    amountInput.focus({ preventScroll: true });
  }
}
