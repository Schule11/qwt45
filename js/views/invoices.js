// Rechnungen & Quittungen: Liste, Erstellen, Ansehen/Teilen, Stornieren.

import { h, mount, icon, toast, openSheet, choiceDialog, confirmDialog, alertDialog } from '../ui.js';
import { state, onChange, contactById, categoriesFor, productsFor, recordById, markPaid } from '../data.js';
import { formatMoney, formatDate, parseAmount, centsToInput, todayISO } from '../format.js';
import { productPriceLabel, PAYMENT_METHODS } from '../defaults.js';
import { saveFile } from '../files.js';
import { preloadLogo } from '../logo.js';
import {
  KIND_LABEL, STATUS_LABEL, createInvoice, cancelInvoice, invoiceStatus, invoicesSorted, invoiceBooking,
  missingBusinessData, lineTotal,
} from '../invoices.js';
import { invoicePdf } from '../invoicePdf.js';
import { personPicker } from './personPicker.js';

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

/** PDF teilen/herunterladen – direkt im Tipp (wichtig fürs iPhone) */
export function sharePdf(inv) {
  saveFile(invoicePdf(inv));
}

/** Nach dem Erstellen: Dialog mit "PDF teilen" */
function offerPdf(inv) {
  choiceDialog({
    title: `${KIND_LABEL[inv.kind]} ${inv.number} erstellt`,
    text: `${inv.recipient.name} · ${formatMoney(inv.totalCents)}. Du kannst das PDF jetzt per WhatsApp, Mail oder „In Dateien sichern“ weitergeben – oder später in der Liste.`,
    buttons: [
      { label: 'PDF teilen', kind: 'primary', onClick: () => sharePdf(inv) },
      { label: 'Fertig' },
    ],
  });
}

// ---------- Liste ----------

export function openInvoiceList(onClose = null) {
  preloadLogo();
  let unsubscribe = null;
  const list = h('div');
  const { body } = openSheet({ title: 'Rechnungen & Quittungen', onClose: () => { unsubscribe?.(); onClose?.(); } });

  function render() {
    const all = invoicesSorted();
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Rechnungen'),
        'Erstelle eine neue Rechnung oder Quittung – oder öffne eine Einnahme und tippe dort auf „Rechnung erstellen“.'));
      return;
    }
    list.replaceChildren(h('div', { class: 'rows' }, all.map((inv) => {
      const status = invoiceStatus(inv);
      return h('button', { type: 'button', class: `row inv-row${status === 'cancelled' ? ' cancelled' : ''}`, onclick: () => openInvoiceDetail(inv) },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, `${inv.number} · ${inv.recipient?.name || '–'}`),
          h('div', { class: 'row-sub' }, `${KIND_LABEL[inv.kind]} · ${formatDate(inv.date)} · `, h('span', { class: `status status-${status}` }, STATUS_LABEL[status]))),
        h('div', { class: 'amt' }, formatMoney(inv.totalCents)));
    })));
  }

  mount(body,
    h('div', { class: 'btn-pair', style: 'margin: 0 0 16px' },
      h('button', { type: 'button', class: 'btn btn-small primary', onclick: () => openInvoiceEditor({ kind: 'invoice' }) }, '+ Rechnung'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => openInvoiceEditor({ kind: 'receipt' }) }, '+ Quittung')),
    list);
  render();
  unsubscribe = onChange(render);
}

// ---------- Ansehen ----------

export function openInvoiceDetail(inv, { onOpenBooking = null } = {}) {
  preloadLogo();
  let unsubscribe = null;
  const content = h('div');
  const { body, close } = openSheet({ title: `${KIND_LABEL[inv.kind]} ${inv.number}`, onClose: () => unsubscribe?.() });

  function render() {
    const current = recordById('invoices', inv.id) || inv;
    const status = invoiceStatus(current);
    const booking = invoiceBooking(current);
    const kv = (k, v) => (v ? h('div', { class: 'kv' }, h('span', null, k), h('span', null, v)) : null);
    content.replaceChildren(
      h('section', { class: 'card' },
        kv('Empfänger:in', current.recipient?.name),
        kv('Anschrift', [current.recipient?.street, [current.recipient?.zip, current.recipient?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')),
        kv('Datum', formatDate(current.date)),
        kv('Leistungsdatum', formatDate(current.serviceDate)),
        current.kind === 'invoice' ? kv('Zahlbar bis', formatDate(current.dueDate)) : kv('Erhalten am', formatDate(current.paymentDate)),
        kv('Betrag', formatMoney(current.totalCents)),
        h('div', { class: 'kv' }, h('span', null, 'Status'), h('span', { class: `status status-${status}` }, STATUS_LABEL[status]))),
      h('section', { class: 'card' },
        h('div', { class: 'lbl', style: 'margin-top:0' }, 'Positionen'),
        current.items.map((it) => h('div', { class: 'kv' },
          h('span', null, `${String(it.quantity).replace('.', ',')} × ${it.text}`),
          h('span', null, formatMoney(it.totalCents))))),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn primary block', onclick: () => sharePdf(current) }, icon('share'), 'PDF teilen'),
        status === 'open' && booking
          ? h('button', { type: 'button', class: 'btn block', onclick: async () => { await markPaid(booking.id); toast('Als bezahlt markiert'); } }, 'Als bezahlt markieren')
          : null,
        booking && onOpenBooking
          ? h('button', { type: 'button', class: 'btn block', onclick: () => { close(); onOpenBooking(booking); } }, 'Zur Buchung')
          : null,
        status !== 'cancelled'
          ? h('button', { type: 'button', class: 'btn-text danger', onclick: () => cancel(current) }, `${KIND_LABEL[current.kind]} stornieren`)
          : h('p', { class: 'hint' }, `Storniert am ${formatDate((current.cancelledAt || '').slice(0, 10))}. Die Nummer bleibt vergeben.`)),
      h('p', { class: 'hint' }, 'Eine erstellte Rechnung wird nicht mehr geändert. Bei einem Fehler: stornieren und neu erstellen.'),
    );
  }

  async function cancel(current) {
    const ok = await confirmDialog({
      title: `${KIND_LABEL[current.kind]} ${current.number} stornieren?`,
      text: 'Die Nummer bleibt vergeben und die Rechnung wird als „storniert“ markiert. Die Buchung bleibt erhalten – du kannst danach eine neue Rechnung erstellen.',
      confirmLabel: 'Stornieren',
      danger: true,
    });
    if (!ok) return;
    await cancelInvoice(current);
    toast('Storniert');
  }

  mount(body, content);
  render();
  unsubscribe = onChange(render);
}

// ---------- Erstellen ----------

/**
 * Formular für eine neue Rechnung/Quittung.
 * booking: Einnahme, zu der die Rechnung gehört (sonst wird eine neue Einnahme angelegt)
 * onCreated: wird nach dem Erstellen aufgerufen (z. B. um das Buchungsformular zu schließen)
 */
export function openInvoiceEditor({ kind = 'invoice', booking = null, onCreated = null }) {
  preloadLogo();
  const missing = missingBusinessData();
  if (missing.length) {
    alertDialog({
      title: 'Geschäftsdaten fehlen',
      text: `Für eine Rechnung fehlen noch: ${missing.join(', ')}. Bitte trage sie unter Einstellungen → Geschäftsdaten ein.`,
    });
    return;
  }

  const st = { kind };
  const today = todayISO();
  const contact = contactById(booking?.personId);

  // Empfänger:in
  const nameOf = () => {
    const v = picker.value();
    if (v.personId) return contactById(v.personId)?.name || '';
    return v.newName || '';
  };
  const streetInput = h('input', { class: 'field', id: 'inv-street', type: 'text', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Straße und Hausnummer', value: contact?.street || '' });
  const zipInput = h('input', { class: 'field', id: 'inv-zip', type: 'text', inputmode: 'numeric', maxlength: 5, autocomplete: 'off', placeholder: 'PLZ', value: contact?.zip || '' });
  const cityInput = h('input', { class: 'field', id: 'inv-city', type: 'text', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Ort', value: contact?.city || '' });
  const picker = personPicker({
    idPrefix: 'inv-person',
    initialId: booking?.personId || null,
    onChange: () => {
      const c = contactById(picker.value().personId);
      if (c) { streetInput.value = c.street || ''; zipInput.value = c.zip || ''; cityInput.value = c.city || ''; }
    },
  });

  // Positionen
  const items = [];
  const itemsBox = h('div', { class: 'inv-items' });
  const totalEl = h('strong', { class: 'num' });
  function addItem(item = { text: '', quantity: 1, unitPriceCents: null }) { items.push({ ...item }); renderItems(); }
  function renderItems() {
    itemsBox.replaceChildren(...items.map((it, i) => {
      const text = h('input', { class: 'field', type: 'text', placeholder: 'Leistung, z. B. Einzelstunde', value: it.text, 'aria-label': `Position ${i + 1}: Leistung`, oninput: (e) => { it.text = e.target.value; } });
      const qty = h('input', { class: 'field', type: 'text', inputmode: 'decimal', value: String(it.quantity).replace('.', ','), 'aria-label': `Position ${i + 1}: Menge`, oninput: (e) => { it.quantity = Number(e.target.value.replace(',', '.')) || 0; updateTotal(); } });
      const price = h('input', { class: 'field', type: 'text', inputmode: 'decimal', placeholder: '0,00', value: it.unitPriceCents != null ? centsToInput(it.unitPriceCents) : '', 'aria-label': `Position ${i + 1}: Einzelpreis`, oninput: (e) => { it.unitPriceCents = parseAmount(e.target.value); updateTotal(); } });
      return h('div', { class: 'inv-item' },
        h('div', { class: 'inv-item-head' }, h('span', { class: 'lbl', style: 'margin:0' }, `Position ${i + 1}`),
          items.length > 1 ? h('button', { type: 'button', class: 'btn-text danger', onclick: () => { items.splice(i, 1); renderItems(); } }, 'Entfernen') : null),
        text,
        h('div', { class: 'inv-item-nums' },
          h('label', null, h('span', { class: 'mini-lbl' }, 'Menge'), qty),
          h('label', null, h('span', { class: 'mini-lbl' }, 'Einzelpreis (€)'), price)));
    }));
    updateTotal();
  }
  function updateTotal() {
    totalEl.textContent = formatMoney(items.reduce((s, it) => s + lineTotal(it), 0));
  }
  const productChips = h('div', { class: 'product-row' }, productsFor('income').filter((p) => p.unit !== 'free').map((p) => h('button', {
    type: 'button',
    class: 'chip product-chip',
    onclick: () => {
      const empty = items.length === 1 && !items[0].text && !items[0].unitPriceCents;
      const item = { text: p.unit === 'quarter' ? `${p.name} (je 15 Min)` : p.name, quantity: 1, unitPriceCents: p.priceCents, categoryId: p.categoryId };
      if (empty) items.splice(0, 1);
      addItem(item);
    },
  }, h('span', { class: 'product-name' }, `+ ${p.name}`), h('span', { class: 'product-price' }, productPriceLabel(p, formatMoney)))));

  // Erste Position aus der Buchung
  if (booking) {
    const prod = recordById('products', booking.productId);
    addItem({ text: booking.description || prod?.name || state.categories.find((c) => c.id === booking.categoryId)?.name || '', quantity: 1, unitPriceCents: booking.amountCents });
  } else {
    addItem();
  }

  // Daten
  const dateInput = h('input', { class: 'field', id: 'inv-date', type: 'date', value: today });
  const serviceInput = h('input', { class: 'field', id: 'inv-service', type: 'date', value: booking ? (booking.serviceDate || booking.date) : today });
  const dueInput = h('input', { class: 'field', id: 'inv-due', type: 'date', value: addDays(today, state.settings.paymentTermDays ?? 14) });
  dateInput.addEventListener('change', () => { dueInput.value = addDays(dateInput.value, state.settings.paymentTermDays ?? 14); });
  const payDateInput = h('input', { class: 'field', id: 'inv-paydate', type: 'date', value: booking && booking.paid !== false ? booking.date : today });
  st.payment = booking?.payment === 'transfer' ? 'transfer' : 'cash';
  const payChips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Zahlungsart' }, PAYMENT_METHODS.map((p) => h('button', {
    type: 'button', class: 'chip', 'data-value': p.value,
    onclick: () => { st.payment = p.value; updateKind(); },
  }, p.label)));
  const catSelect = h('select', { class: 'field', id: 'inv-cat' }, categoriesFor('income').map((c) => h('option', { value: c.id }, c.name)));
  const noteInput = h('input', { class: 'field', id: 'inv-note', type: 'text', maxlength: 300, autocomplete: 'off', placeholder: 'z. B. Kurs „Welpen 1“, 6 Termine (optional)' });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const invoiceOnly = h('div', null, h('label', { class: 'lbl', for: 'inv-due' }, 'Zahlbar bis'), dueInput);
  const receiptOnly = h('div', null,
    h('div', { class: 'lbl' }, 'Bezahlt'), payChips,
    h('label', { class: 'lbl', for: 'inv-paydate' }, 'Erhalten am'), payDateInput);
  const kindSeg = h('div', { class: 'segmented segmented-3 kind-seg', role: 'group', 'aria-label': 'Art', style: 'grid-template-columns: 1fr 1fr' },
    ['invoice', 'receipt'].map((k) => h('button', { type: 'button', 'data-v': k, onclick: () => { st.kind = k; updateKind(); } }, KIND_LABEL[k])));
  const kindHint = h('p', { class: 'hint' });

  function updateKind() {
    for (const b of kindSeg.children) b.setAttribute('aria-pressed', String(b.dataset.v === st.kind));
    for (const b of payChips.children) b.setAttribute('aria-pressed', String(b.dataset.value === st.payment));
    invoiceOnly.hidden = st.kind !== 'invoice';
    receiptOnly.hidden = st.kind !== 'receipt';
    kindHint.textContent = st.kind === 'invoice'
      ? 'Für Zahlungen, die noch kommen (z. B. per Überweisung). Die Einnahme steht so lange unter „Offene Zahlungen“.'
      : 'Bestätigung über einen bereits erhaltenen Betrag (z. B. bar nach der Stunde).';
    sheet.querySelector('.sheet-title').textContent = `Neue ${KIND_LABEL[st.kind]}`;
  }

  const { sheet, body, close } = openSheet({ title: `Neue ${KIND_LABEL[kind]}`, cancel: true, onConfirm: () => save() });

  async function save() {
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    const name = nameOf().trim();
    if (!name) return fail('Bitte die Empfänger:in wählen oder eingeben.');
    const clean = items.filter((it) => it.text.trim() || it.unitPriceCents);
    if (!clean.length) return fail('Bitte mindestens eine Position eintragen.');
    for (const it of clean) {
      if (!it.text.trim()) return fail('Bitte bei jeder Position die Leistung eintragen.');
      if (!it.unitPriceCents || it.unitPriceCents <= 0) return fail(`Bitte bei „${it.text}“ einen gültigen Preis eintragen.`);
      if (!(it.quantity > 0)) return fail(`Bitte bei „${it.text}“ eine gültige Menge eintragen.`);
    }
    const total = clean.reduce((s, it) => s + lineTotal(it), 0);
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!DATE.test(dateInput.value) || !DATE.test(serviceInput.value)) return fail('Bitte Datum und Leistungsdatum eintragen.');
    if (st.kind === 'invoice' && !DATE.test(dueInput.value)) return fail('Bitte „Zahlbar bis“ eintragen.');
    if (st.kind === 'receipt' && !DATE.test(payDateInput.value)) return fail('Bitte eintragen, wann der Betrag erhalten wurde.');
    const address = { street: streetInput.value.trim(), zip: zipInput.value.trim(), city: cityInput.value.trim() };
    if (total > 25000 && (!address.street || !address.city)) {
      const ok = await confirmDialog({
        title: 'Anschrift fehlt',
        text: 'Bei Rechnungen über 250 € gehört die vollständige Anschrift der Kund:in auf die Rechnung. Trotzdem erstellen?',
        confirmLabel: 'Trotzdem erstellen',
        cancelLabel: 'Anschrift ergänzen',
      });
      if (!ok) return;
    }
    if (booking && total !== booking.amountCents) {
      const ok = await confirmDialog({
        title: 'Betrag ändert sich',
        text: `Die Rechnung ergibt ${formatMoney(total)}, die Buchung lautet auf ${formatMoney(booking.amountCents)}. Die Buchung wird auf ${formatMoney(total)} angepasst.`,
        confirmLabel: 'Anpassen und erstellen',
      });
      if (!ok) return;
    }
    const v = picker.value();
    try {
      const inv = await createInvoice({
        kind: st.kind,
        booking,
        personId: v.personId || null,
        newPersonName: v.newName || null,
        recipient: { name, ...address },
        items: clean.map(({ text, quantity, unitPriceCents }) => ({ text: text.trim(), quantity, unitPriceCents })),
        date: dateInput.value,
        serviceDate: serviceInput.value,
        dueDate: dueInput.value,
        payment: st.payment,
        paymentDate: payDateInput.value,
        note: noteInput.value.trim(),
        categoryId: catSelect.value || clean[0].categoryId,
      });
      close();
      onCreated?.(inv);
      offerPdf(inv);
    } catch (err) {
      console.error(err);
      fail(`Erstellen hat nicht geklappt: ${err.message || err}`);
    }
  }

  // Kategorie aus der ersten Position der Preisliste vorschlagen
  const firstCat = items[0]?.categoryId;
  if (firstCat) catSelect.value = firstCat;

  mount(body,
    kindSeg,
    kindHint,
    h('div', { class: 'lbl' }, 'Empfänger:in'),
    picker.el,
    h('div', { class: 'stack', style: 'margin-top: 8px' }, streetInput, h('div', { class: 'zip-city' }, zipInput, cityInput)),
    h('p', { class: 'hint' }, 'Die Anschrift wird bei der Kund:in gespeichert. Ab 250 € ist sie Pflicht.'),
    h('div', { class: 'lbl' }, 'Positionen'),
    itemsBox,
    h('button', { type: 'button', class: 'btn-text', onclick: () => addItem() }, '+ Weitere Position'),
    productsFor('income').length ? [h('div', { class: 'lbl' }, 'Aus der Preisliste'), productChips] : null,
    h('div', { class: 'kv inv-total' }, h('span', null, 'Gesamtbetrag'), totalEl),
    booking ? null : [h('label', { class: 'lbl', for: 'inv-cat' }, 'Kategorie (für die Einnahme)'), catSelect],
    h('label', { class: 'lbl', for: 'inv-date' }, 'Datum'),
    dateInput,
    h('label', { class: 'lbl', for: 'inv-service' }, 'Leistungsdatum (Tag der Stunde)'),
    serviceInput,
    invoiceOnly,
    receiptOnly,
    h('label', { class: 'lbl', for: 'inv-note' }, 'Zusatztext (optional)'),
    noteInput,
    h('p', { class: 'hint' }, 'Auf jeder Rechnung steht automatisch: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“'),
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Erstellen')),
  );
  updateKind();
}
