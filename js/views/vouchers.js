// Gutscheine: Liste, Ansehen, Einlösen (auch teilweise), Gutschein-PDF.

import { h, mount, icon, toast, openSheet, confirmDialog, choiceDialog } from '../ui.js';
import { state, onChange, recordById, contactById, saveRecord } from '../data.js';
import { formatMoney, formatDate, parseAmount, centsToInput, todayISO, normalizeText } from '../format.js';
import { saveFile } from '../files.js';
import { preloadLogo } from '../logo.js';
import {
  vouchersSorted, voucherRemaining, voucherRedeemed, voucherState, VOUCHER_STATE_LABEL, redeemVoucher, undoRedemption,
} from '../vouchers.js';
import { voucherPdf } from '../voucherPdf.js';

export function shareVoucherPdf(v) {
  saveFile(voucherPdf(v));
}

/** Nach dem Verkauf: Gutschein-PDF anbieten */
export function offerVoucherPdf(v) {
  choiceDialog({
    title: `Gutschein ${v.code} angelegt`,
    text: `Wert ${formatMoney(v.valueCents)}, gültig bis ${formatDate(v.validUntil)}. Möchtest du den Gutschein als PDF zum Verschenken teilen?`,
    buttons: [
      { label: 'Gutschein-PDF teilen', kind: 'primary', onClick: () => shareVoucherPdf(v) },
      { label: 'Später' },
    ],
  });
}

function whoFor(v) {
  return v.recipientName || contactById(v.buyerPersonId)?.name || '';
}

export function openVoucherList(onClose = null, { onSell = null } = {}) {
  preloadLogo();
  let unsubscribe = null;
  let filter = 'active';
  const list = h('div');
  const search = h('input', {
    class: 'field field-search', type: 'search', placeholder: 'Nummer oder Name suchen …', autocomplete: 'off', enterkeyhint: 'search',
    'aria-label': 'Gutscheine durchsuchen', oninput: () => render(), onkeydown: (e) => { if (e.key === 'Enter') search.blur(); },
  });
  const seg = h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Filter' },
    [['active', 'Gültig'], ['done', 'Eingelöst/alt'], ['all', 'Alle']].map(([v, l]) => h('button', {
      type: 'button', 'data-v': v, onclick: () => { filter = v; render(); },
    }, l)));
  const { body } = openSheet({ title: 'Gutscheine', onClose: () => { unsubscribe?.(); onClose?.(); } });

  function render() {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === filter));
    const q = normalizeText(search.value);
    const all = vouchersSorted().filter((v) => {
      const st = voucherState(v);
      if (filter === 'active' && st !== 'active') return false;
      if (filter === 'done' && st === 'active') return false;
      return !q || normalizeText(`${v.code} ${whoFor(v)} ${contactById(v.buyerPersonId)?.name || ''}`).includes(q);
    });
    const open = vouchersSorted().filter((v) => voucherState(v) === 'active');
    const sum = open.reduce((s, v) => s + voucherRemaining(v), 0);
    list.replaceChildren(
      h('p', { class: 'list-summary', style: 'margin: 4px 4px 10px' }, `${open.length} gültige Gutscheine · Restwert zusammen ${formatMoney(sum)}`),
      all.length
        ? h('div', { class: 'rows' }, all.map((v) => {
          const st = voucherState(v);
          return h('button', { type: 'button', class: `row inv-row${st === 'cancelled' ? ' cancelled' : ''}`, onclick: () => openVoucherDetail(v) },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title' }, [v.code, whoFor(v)].filter(Boolean).join(' · ')),
              h('div', { class: 'row-sub' }, `Rest ${formatMoney(voucherRemaining(v))} von ${formatMoney(v.valueCents)} · bis ${formatDate(v.validUntil)} · `,
                h('span', { class: `status status-${st === 'active' ? 'open' : st === 'redeemed' ? 'paid' : 'cancelled'}` }, VOUCHER_STATE_LABEL[st]))),
            h('div', { class: 'amt open' }, formatMoney(voucherRemaining(v))));
        }))
        : h('div', { class: 'empty' }, h('strong', null, 'Keine Gutscheine'), 'Gutscheine verkaufst du über das + und „Gutschein“ in der Preisliste.'),
    );
  }

  mount(body,
    onSell ? h('div', { style: 'margin-bottom: 14px' }, h('button', { type: 'button', class: 'btn primary block', onclick: () => onSell() }, '+ Gutschein verkaufen')) : null,
    h('div', { class: 'filters' }, search, seg),
    list);
  render();
  unsubscribe = onChange(render);
}

export function openVoucherDetail(voucher) {
  preloadLogo();
  let unsubscribe = null;
  const content = h('div');
  const { body } = openSheet({ title: `Gutschein ${voucher.code}`, onClose: () => unsubscribe?.() });

  function render() {
    const v = recordById('vouchers', voucher.id) || voucher;
    const st = voucherState(v);
    const kv = (k, val) => (val ? h('div', { class: 'kv' }, h('span', null, k), h('span', null, val)) : null);
    content.replaceChildren(
      h('section', { class: 'card voucher-card' },
        h('div', { class: 'voucher-big' }, formatMoney(voucherRemaining(v))),
        h('div', { class: 'muted', style: 'text-align:center; margin-bottom: 10px' }, `Restwert von ${formatMoney(v.valueCents)}`),
        kv('Für', v.recipientName),
        kv('Gekauft von', contactById(v.buyerPersonId)?.name),
        kv('Verkauft am', formatDate(v.soldDate)),
        kv('Gültig bis', formatDate(v.validUntil)),
        h('div', { class: 'kv' }, h('span', null, 'Status'), h('span', { class: `status status-${st === 'active' ? 'open' : st === 'redeemed' ? 'paid' : 'cancelled'}` }, VOUCHER_STATE_LABEL[st]))),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn primary block', onclick: () => shareVoucherPdf(v) }, icon('share'), 'Gutschein-PDF teilen'),
        st === 'active' ? h('button', { type: 'button', class: 'btn block', onclick: () => openRedeemDialog(v) }, 'Einlösen') : null),
      h('h2', { class: 'section-title' }, 'Eingelöst'),
      (v.redemptions || []).length
        ? h('div', { class: 'rows' }, [...v.redemptions].reverse().map((r) => h('div', { class: 'cat-row' },
          h('div', { class: 'cat-main', style: 'cursor: default' },
            h('div', { class: 'row-title' }, `${formatMoney(r.cents)} · ${formatDate(r.date)}`),
            r.note ? h('div', { class: 'row-sub' }, r.note) : null),
          h('button', {
            type: 'button', class: 'btn-text danger', 'aria-label': 'Einlösung rückgängig machen',
            onclick: async () => {
              const ok = await confirmDialog({ title: 'Einlösung rückgängig machen?', text: `${formatMoney(r.cents)} werden dem Gutschein wieder gutgeschrieben.`, confirmLabel: 'Rückgängig', danger: true });
              if (ok) { await undoRedemption(v.id, r.id); toast('Rückgängig gemacht'); }
            },
          }, 'Rückgängig'))))
        : h('p', { class: 'hint', style: 'margin: 0 4px' }, 'Noch nichts eingelöst. Am einfachsten löst du ihn bei der Stunde ein: + → Leistung → Zahlung „Gutschein“.'),
      h('p', { class: 'hint' }, `Bisher eingelöst: ${formatMoney(voucherRedeemed(v))}. Das Einlösen ist keine neue Einnahme – das Geld kam schon beim Verkauf.`),
    );
  }

  mount(body, content);
  render();
  unsubscribe = onChange(render);
}

/** Einlösen ohne Buchung (z. B. für Material) */
function openRedeemDialog(v) {
  const amountInput = h('input', { class: 'field', type: 'text', inputmode: 'decimal', placeholder: centsToInput(voucherRemaining(v)), 'aria-label': 'Betrag' });
  const noteInput = h('input', { class: 'field', type: 'text', placeholder: 'Wofür? (optional)', 'aria-label': 'Wofür', style: 'margin-top: 8px' });
  choiceDialog({
    title: `Gutschein ${v.code} einlösen`,
    text: h('div', null, h('p', null, `Rest: ${formatMoney(voucherRemaining(v))}. Wie viel wird eingelöst?`), amountInput, noteInput),
    buttons: [
      {
        label: 'Einlösen',
        kind: 'primary',
        onClick: async () => {
          const cents = amountInput.value.trim() ? parseAmount(amountInput.value) : voucherRemaining(v);
          if (!cents || cents <= 0) { toast('Bitte einen gültigen Betrag eingeben'); return; }
          const done = await redeemVoucher(v.id, { cents, note: noteInput.value.trim(), date: todayISO() });
          toast(`${formatMoney(done)} eingelöst`);
        },
      },
      { label: 'Abbrechen' },
    ],
  });
}

/** Gutschein stornieren (nur ohne Einlösungen) */
export async function cancelVoucher(v) {
  await saveRecord('vouchers', { id: v.id, cancelled: true });
}
