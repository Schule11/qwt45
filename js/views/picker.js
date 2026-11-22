// Aufklappbares Auswahlfeld: zeigt den gewählten Wert; ein Tipp klappt eine
// Liste darunter auf. Es ist immer nur eine Liste gleichzeitig offen.

import { h, icon } from '../ui.js';

const openPickers = new Set();

export function disclosurePicker({ id, placeholder, label }) {
  const valueEl = h('span', { class: 'picker-value placeholder' }, placeholder);
  const btn = h('button', {
    type: 'button',
    class: 'picker-btn',
    id: `${id}-btn`,
    'aria-expanded': 'false',
    'aria-controls': `${id}-panel`,
    'aria-label': label,
    onclick: () => (isOpen() ? close() : open()),
  }, valueEl, h('span', { class: 'picker-chev' }, icon('chevronDown', 20)));
  const panel = h('div', { class: 'picker-panel', id: `${id}-panel`, hidden: true });
  const el = h('div', { class: 'picker', id }, btn, panel);
  const listeners = { open: [], close: [] };

  function isOpen() { return !panel.hidden; }

  function open() {
    for (const p of openPickers) if (p !== api) p.close();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openPickers.add(api);
    for (const fn of listeners.open) fn();
    // Liste in den sichtbaren Bereich holen
    requestAnimationFrame(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    openPickers.delete(api);
    for (const fn of listeners.close) fn();
  }

  /** Angezeigten Wert setzen (null = Platzhalter) */
  function setValue(text) {
    valueEl.textContent = text || placeholder;
    valueEl.classList.toggle('placeholder', !text);
  }

  const api = {
    el, btn, panel, open, close, isOpen, setValue,
    onOpen: (fn) => listeners.open.push(fn),
    onClose: (fn) => listeners.close.push(fn),
  };
  return api;
}

/** Eine Zeile in der aufgeklappten Liste */
export function pickerOption({ label, sub = null, selected = false, onClick, className = '', data = {} }) {
  const attrs = {
    type: 'button',
    class: `picker-option ${className}`.trim(),
    role: 'option',
    'aria-selected': String(selected),
    onclick: onClick,
  };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k}`] = v;
  return h('button', attrs,
    h('span', { class: 'picker-option-text' },
      h('span', { class: 'picker-option-label' }, label),
      sub ? h('span', { class: 'picker-option-sub' }, sub) : null),
    selected ? icon('check', 20) : null);
}

/** Zwischenüberschrift in der Liste */
export function pickerGroup(text) {
  return h('div', { class: 'picker-group' }, text);
}
