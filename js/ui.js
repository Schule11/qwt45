// Bausteine für die Oberfläche: Elemente erzeugen, Symbole, Meldungen, Dialoge.

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'multiple', 'selected']);

/**
 * Erzeugt ein HTML-Element.
 * h('button', { class: 'btn', onclick: fn }, 'Text')
 * Texte werden immer als Text eingefügt (nie als HTML) – sicher für Eingaben.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (PROPS.has(key)) el[key] = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  appendChildren(el, children);
  return el;
}

/** Hängt Kinder an (Listen werden aufgelöst, leere Werte übersprungen). */
export function mount(parent, ...children) {
  appendChildren(parent, children);
  return parent;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
}

// ---------- Symbole ----------

const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.3 3.3 0 0 1 0 6.4M18 14.6c2 .7 3.2 2.5 3.5 5.4"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5.5-4-5.5-1.5S10 8 12 8zm0 0c1.5-3 5.5-4 5.5-1.5S14 8 12 8z"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

// ---------- Kurze Meldung unten ----------

let toastTimer = null;

/** Kurze Meldung; optional mit Knopf, z. B. { action: { label: 'Rückgängig', onClick } } */
export function toast(message, { action = null } = {}) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  const hide = () => el.classList.remove('show', 'has-action');
  el.replaceChildren(h('span', null, message));
  if (action) {
    el.append(h('button', {
      type: 'button',
      class: 'toast-action',
      onclick: () => { hide(); action.onClick(); },
    }, action.label));
  }
  // Neustart der Einblendung
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  el.classList.toggle('has-action', !!action);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, action ? 6000 : 2800);
}

// ---------- Dialoge ----------

/**
 * Dialog mit mehreren Knöpfen. Gibt den `value` des gewählten Knopfs zurück
 * (oder null bei Abbruch). Ein Knopf kann `onClick` haben, das sofort beim
 * Tippen läuft (wichtig fürs Teilen auf dem iPhone).
 */
export function choiceDialog({ title, text, buttons }) {
  return new Promise((resolve) => {
    let result = null;
    const body = typeof text === 'string' ? h('p', null, text) : text;
    const dlg = h('dialog', { class: 'dlg', 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      body ? h('div', { class: 'dlg-text' }, body) : null,
      h('div', { class: 'dlg-actions' },
        buttons.map((b) => h('button', {
          type: 'button',
          class: `btn block ${b.kind || ''}`,
          onclick: () => {
            result = b.value ?? null;
            if (b.onClick) b.onClick();
            dlg.close();
          },
        }, b.label))));

    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);

    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      // Sehr alte Browser ohne <dialog>
      dlg.remove();
      const first = buttons[0];
      resolve(window.confirm(`${title}\n\n${typeof text === 'string' ? text : ''}`) ? (first.onClick?.(), first.value) : null);
    }
  });
}

export async function confirmDialog({ title, text, confirmLabel = 'OK', cancelLabel = 'Abbrechen', danger = false }) {
  const value = await choiceDialog({
    title,
    text,
    buttons: [
      { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' },
      { label: cancelLabel, value: false },
    ],
  });
  return value === true;
}

export function alertDialog({ title, text, label = 'OK' }) {
  return choiceDialog({ title, text, buttons: [{ label, value: true, kind: 'primary' }] });
}

// ---------- Vollbild-Bildansicht ----------

export function openImageViewer(url, alt = 'Beleg') {
  const close = () => {
    viewer.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const viewer = h('div', { class: 'viewer', role: 'dialog', 'aria-label': alt },
    h('div', { class: 'viewer-bar' },
      h('button', { type: 'button', class: 'btn-text', onclick: close }, 'Schließen')),
    h('div', { class: 'viewer-img', onclick: (e) => { if (e.target === e.currentTarget) close(); } },
      h('img', { src: url, alt })));
  document.addEventListener('keydown', onKey);
  document.body.append(viewer);
}

// ---------- Gerät ----------

export function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

// ---------- Hell / Dunkel (gilt nur für dieses Gerät) ----------

const THEME_COLORS = { light: '#f6f5f2', dark: '#121212' };

export function getTheme() {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'light' || theme === 'dark') localStorage.setItem('theme', theme);
    else localStorage.removeItem('theme');
  } catch { /* egal */ }
  applyTheme();
}

export function applyTheme() {
  const theme = getTheme();
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (meta.dataset.media === undefined) {
      meta.dataset.media = meta.getAttribute('media') || '';
      meta.dataset.color = meta.content;
    }
    if (theme === 'system') {
      meta.setAttribute('media', meta.dataset.media);
      meta.content = meta.dataset.color;
    } else {
      meta.removeAttribute('media');
      meta.content = THEME_COLORS[theme];
    }
  }
}

// ---------- Vollbild-Ebene (z. B. Kategorien bearbeiten) ----------

/**
 * Öffnet eine Vollbild-Ebene mit Titelleiste (runde Knöpfe wie in iOS).
 * cancel: links ✕ statt ‹ ; onConfirm: rechts ein ✓-Knopf zum Speichern.
 * Gibt { sheet, body, close } zurück.
 */
export function openSheet({ title, cancel = false, onConfirm = null, onClose = null }) {
  const body = h('div', { class: 'sheet-body' });
  const onKey = (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open], .viewer')) return;
    const sheets = document.querySelectorAll('.sheet');
    if (sheets[sheets.length - 1] === sheet) close();
  };
  const close = () => {
    // Offenes Eingabefeld zuerst verlassen, damit es noch gespeichert wird
    if (sheet.contains(document.activeElement)) document.activeElement.blur();
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    if (!document.querySelector('.sheet')) document.body.classList.remove('sheet-open');
    if (onClose) onClose();
  };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'sheet-bar' },
      h('button', { type: 'button', class: 'round-btn', 'aria-label': cancel ? 'Abbrechen' : 'Zurück', onclick: close },
        icon(cancel ? 'close' : 'back', 22)),
      h('h1', { class: 'sheet-title' }, title),
      onConfirm
        ? h('button', { type: 'button', class: 'round-btn confirm', 'aria-label': 'Speichern', onclick: () => onConfirm() }, icon('check', 24))
        : h('span')),
    body);
  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);
  return { sheet, body, close };
}
