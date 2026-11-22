// 10er-Karten: Liste, Ansehen, Stunde abbuchen, Rückgängig.

import { h, mount, toast, openSheet, confirmDialog } from '../ui.js';
import { onChange, recordById, contactById } from '../data.js';
import { formatMoney, formatDate, todayISO, normalizeText } from '../format.js';
import { cardsSorted, cardRemaining, cardState, CARD_STATE_LABEL, useCard, undoCardUse } from '../vouchers.js';

export function openCardList(onClose = null, { onSell = null } = {}) {
  let unsubscribe = null;
  let filter = 'active';
  const list = h('div');
  const search = h('input', {
    class: 'field field-search', type: 'search', placeholder: 'Name suchen …', autocomplete: 'off', enterkeyhint: 'search',
    'aria-label': '10er-Karten durchsuchen', oninput: () => render(), onkeydown: (e) => { if (e.key === 'Enter') search.blur(); },
  });
  const seg = h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Filter', style: 'grid-template-columns: 1fr 1fr' },
    [['active', 'Aktiv'], ['all', 'Alle']].map(([v, l]) => h('button', { type: 'button', 'data-v': v, onclick: () => { filter = v; render(); } }, l)));
  const { body } = openSheet({ title: '10er-Karten', onClose: () => { unsubscribe?.(); onClose?.(); } });

  function render() {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === filter));
    const q = normalizeText(search.value);
    const all = cardsSorted().filter((c) => (filter === 'all' || cardState(c) === 'active')
      && (!q || normalizeText(`${contactById(c.personId)?.name || ''} ${contactById(c.personId)?.dog || ''} ${c.code}`).includes(q)));
    list.replaceChildren(all.length
      ? h('div', { class: 'rows' }, all.map((c) => {
        const st = cardState(c);
        return h('button', { type: 'button', class: `row inv-row${st === 'cancelled' ? ' cancelled' : ''}`, onclick: () => openCardDetail(c) },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, contactById(c.personId)?.name || 'Kund:in'),
            h('div', { class: 'row-sub' }, `${c.title || '10er-Karte'} · gekauft ${formatDate(c.soldDate)} · `,
              h('span', { class: `status status-${st === 'active' ? 'open' : st === 'used' ? 'paid' : 'cancelled'}` }, CARD_STATE_LABEL[st]))),
          h('div', { class: 'card-count' }, h('strong', null, String(cardRemaining(c))), h('span', null, `von ${c.size}`)));
      }))
      : h('div', { class: 'empty' }, h('strong', null, 'Keine 10er-Karten'), '10er-Karten verkaufst du über das + und „10er-Karte“ in der Preisliste.'));
  }

  mount(body,
    onSell ? h('div', { style: 'margin-bottom: 14px' }, h('button', { type: 'button', class: 'btn primary block', onclick: () => onSell() }, '+ 10er-Karte verkaufen')) : null,
    h('div', { class: 'filters' }, search, seg),
    list);
  render();
  unsubscribe = onChange(render);
}

export function openCardDetail(card) {
  let unsubscribe = null;
  const content = h('div');
  const { body } = openSheet({ title: '10er-Karte', onClose: () => unsubscribe?.() });

  function render() {
    const c = recordById('cards', card.id) || card;
    const st = cardState(c);
    const left = cardRemaining(c);
    const dots = Array.from({ length: c.size }, (_, i) => h('span', { class: `dot${i < c.uses.length ? ' used' : ''}` }));
    content.replaceChildren(
      h('section', { class: 'card voucher-card' },
        h('div', { class: 'row-title', style: 'text-align:center' }, contactById(c.personId)?.name || 'Kund:in'),
        h('div', { class: 'voucher-big' }, `${left} von ${c.size}`),
        h('div', { class: 'muted', style: 'text-align:center' }, `${c.title || '10er-Karte'} · Stunden übrig`),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, dots),
        h('div', { class: 'kv' }, h('span', null, 'Gekauft am'), h('span', null, formatDate(c.soldDate))),
        h('div', { class: 'kv' }, h('span', null, 'Preis'), h('span', null, formatMoney(c.priceCents))),
        h('div', { class: 'kv' }, h('span', null, 'Nummer'), h('span', null, c.code)),
        h('div', { class: 'kv' }, h('span', null, 'Status'), h('span', { class: `status status-${st === 'active' ? 'open' : st === 'used' ? 'paid' : 'cancelled'}` }, CARD_STATE_LABEL[st]))),
      st === 'active'
        ? h('button', {
          type: 'button', class: 'btn primary block',
          onclick: async () => { const n = await useCard(c.id, { date: todayISO() }); toast(`Stunde abgebucht – noch ${n}`); },
        }, 'Heute eine Stunde abbuchen')
        : null,
      h('h2', { class: 'section-title' }, 'Abgebucht'),
      (c.uses || []).length
        ? h('div', { class: 'rows' }, [...c.uses].reverse().map((u, i) => h('div', { class: 'cat-row' },
          h('div', { class: 'cat-main', style: 'cursor: default' },
            h('div', { class: 'row-title' }, `${c.uses.length - i}. Stunde · ${formatDate(u.date)}`),
            u.note ? h('div', { class: 'row-sub' }, u.note) : null),
          h('button', {
            type: 'button', class: 'btn-text danger',
            onclick: async () => {
              const ok = await confirmDialog({ title: 'Abbuchung rückgängig machen?', text: `Die Stunde vom ${formatDate(u.date)} wird der Karte wieder gutgeschrieben.`, confirmLabel: 'Rückgängig', danger: true });
              if (ok) { await undoCardUse(c.id, u.id); toast('Rückgängig gemacht'); }
            },
          }, 'Rückgängig'))))
        : h('p', { class: 'hint', style: 'margin: 0 4px' }, 'Noch keine Stunde abgebucht. Am einfachsten bei der Stunde: + → Gruppenstunde → Kund:in → Zahlung „10er-Karte“.'),
      h('p', { class: 'hint' }, 'Abbuchen ist keine neue Einnahme – das Geld kam schon beim Kauf der Karte.'),
    );
  }

  mount(body, content);
  render();
  unsubscribe = onChange(render);
}
