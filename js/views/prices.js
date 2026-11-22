// Preisliste verwalten: Leistungen mit Preis, die im Buchungsformular mit einem
// Tipp ausgewählt werden (Betrag, Kategorie und Beschreibung werden ausgefüllt).

import { h, mount, toast, openSheet, confirmDialog } from '../ui.js';
import { state, onChange, productsFor, categoriesFor, categoryById, saveRecord, deleteRecord, moveRecord } from '../data.js';
import { productPriceLabel } from '../defaults.js';
import { formatMoney, parseAmount, centsToInput } from '../format.js';

const TYPE_LABEL = { income: 'Einnahmen', expense: 'Ausgaben' };
const UNITS = [
  ['fixed', 'Festpreis'],
  ['quarter', 'pro 15 Min'],
  ['free', 'Freier Betrag'],
];

/** Liste aller Einträge (Einnahmen oben, Ausgaben-Vorlagen darunter) */
export function openPriceList(onClose = null) {
  let unsubscribe = null;
  const content = h('div');
  const { body } = openSheet({ title: 'Preisliste', onClose: () => { unsubscribe?.(); onClose?.(); } });

  function group(type) {
    const list = productsFor(type);
    if (!list.length) return null;
    return [
      h('h2', { class: 'section-title' }, TYPE_LABEL[type]),
      h('div', { class: 'rows' }, list.map((p, i) => h('div', { class: 'cat-row' },
        h('button', { type: 'button', class: 'cat-main', onclick: () => openProductEditor({ product: p }) },
          h('div', { class: 'row-title' }, p.name),
          h('div', { class: 'row-sub' }, [productPriceLabel(p, formatMoney), categoryById(p.categoryId)?.name].filter(Boolean).join(' · '))),
        h('div', { class: 'cat-move' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${p.name} nach oben`, disabled: i === 0, onclick: () => moveRecord('products', list, p.id, -1) }, '↑'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${p.name} nach unten`, disabled: i === list.length - 1, onclick: () => moveRecord('products', list, p.id, 1) }, '↓'))))),
    ];
  }

  function render() {
    content.replaceChildren(...[group('income'), group('expense')].flat().filter(Boolean));
    if (!state.products.length) content.append(h('div', { class: 'empty' }, h('strong', null, 'Noch keine Einträge')));
  }

  mount(body, 
    h('p', { class: 'hint', style: 'margin: 0 2px 6px' },
      'Im Buchungsformular stehen diese Einträge oben zur Auswahl. Ein Tipp füllt Betrag, Kategorie und Beschreibung aus.'),
    content,
    h('div', { style: 'margin-top: 18px' },
      h('button', { type: 'button', class: 'btn block', onclick: () => openProductEditor({}) }, '+ Neuer Eintrag')),
  );
  render();
  unsubscribe = onChange(render);
}

/** Eintrag bearbeiten oder neu anlegen */
export function openProductEditor({ product = null }) {
  const isNew = !product;
  const special = product && product.kind && product.kind !== 'service'; // Gutschein / 10er-Karte
  const st = {
    type: product?.type || 'income',
    unit: product?.unit || 'fixed',
  };

  const nameInput = h('input', {
    class: 'field', id: 'prod-name', type: 'text', maxlength: 60, autocomplete: 'off', autocapitalize: 'sentences',
    value: product?.name || '', placeholder: 'z. B. Social Walk',
  });
  const priceInput = h('input', {
    class: 'field', id: 'prod-price', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: product ? centsToInput(product.priceCents) : '', placeholder: '0,00',
  });
  const priceLabel = h('label', { class: 'lbl', for: 'prod-price' });
  const sizeInput = h('input', {
    class: 'field', id: 'prod-size', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    value: String(product?.cardSize || 10),
  });
  const catSelect = h('select', { class: 'field', id: 'prod-cat' });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const typeSeg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Art' },
    ['income', 'expense'].map((t) => h('button', {
      type: 'button', class: t, 'data-v': t,
      onclick: () => { st.type = t; update(); fillCategories(); },
    }, t === 'income' ? 'Einnahme' : 'Ausgabe-Vorlage')));
  const unitSeg = h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Abrechnung' },
    UNITS.map(([u, label]) => h('button', {
      type: 'button', 'data-v': u,
      onclick: () => { st.unit = u; update(); },
    }, label)));

  function fillCategories() {
    const cats = categoriesFor(st.type).filter((c) => !c.mileage);
    catSelect.replaceChildren(...cats.map((c) => h('option', { value: c.id }, c.name)));
    const wanted = product && categoryById(product.categoryId)?.type === st.type ? product.categoryId : cats[0]?.id;
    if (wanted) catSelect.value = wanted;
  }

  function update() {
    for (const b of typeSeg.children) b.setAttribute('aria-pressed', String(b.dataset.v === st.type));
    for (const b of unitSeg.children) b.setAttribute('aria-pressed', String(b.dataset.v === st.unit));
    priceLabel.textContent = st.unit === 'quarter' ? 'Preis pro 15 Minuten' : st.unit === 'free' ? 'Mindestbetrag (optional)' : 'Preis';
  }

  const { body, close } = openSheet({
    title: isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten',
    cancel: true,
    onConfirm: () => save(),
  });

  async function save() {
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const name = nameInput.value.trim();
    if (!name) return fail('Bitte einen Namen eingeben.');
    const price = priceInput.value.trim() ? parseAmount(priceInput.value) : (st.unit === 'free' ? 0 : null);
    if (price == null || (st.unit !== 'free' && price <= 0)) return fail('Bitte einen gültigen Preis eingeben, z. B. 80 oder 20,00.');
    if (!catSelect.value) return fail('Bitte eine Kategorie wählen.');
    const size = Number(sizeInput.value);
    if (product?.kind === 'card' && (!Number.isInteger(size) || size < 2 || size > 50)) return fail('Bitte bei der Anzahl Stunden eine Zahl von 2 bis 50 eingeben.');
    await saveRecord('products', {
      id: product?.id,
      kind: product?.kind || 'service',
      type: special ? product.type : st.type,
      unit: special ? product.unit : st.unit,
      name,
      priceCents: price,
      categoryId: catSelect.value,
      ...(product?.kind === 'card' ? { cardSize: size } : {}),
    });
    close();
    toast(isNew ? 'Eintrag angelegt' : 'Gespeichert');
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `„${product.name}“ löschen?`,
      text: 'Der Eintrag verschwindet aus der Preisliste. Bereits erfasste Buchungen bleiben unverändert.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteRecord('products', product.id);
    close();
    toast('Eintrag gelöscht');
  }

  mount(body, 
    h('label', { class: 'lbl', for: 'prod-name', style: 'margin-top: 4px' }, 'Name'),
    nameInput,
    special ? null : [h('div', { class: 'lbl' }, 'Art'), typeSeg, h('div', { class: 'lbl' }, 'Abrechnung'), unitSeg],
    priceLabel,
    priceInput,
    product?.kind === 'card' ? [h('label', { class: 'lbl', for: 'prod-size' }, 'Anzahl Stunden auf der Karte'), sizeInput] : null,
    h('label', { class: 'lbl', for: 'prod-cat' }, 'Kategorie'),
    catSelect,
    special ? h('p', { class: 'hint' }, product.kind === 'voucher'
      ? 'Gutscheine haben einen freien Betrag ab dem Mindestbetrag.'
      : 'Beim Verkauf wird eine Karte angelegt, von der Stunden abgebucht werden.') : null,
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Eintrag löschen') : null),
  );
  update();
  fillCategories();
  if (isNew) nameInput.focus();
}
