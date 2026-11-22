// Kund:innen verwalten: Liste mit Suche, anlegen, bearbeiten, löschen.

import { h, mount, toast, openSheet, confirmDialog } from '../ui.js';
import {
  onChange, contactsSorted, contactLabel, contactStats, saveContact, deleteContact, findContactByName,
} from '../data.js';
import { formatSigned, formatMoney, formatDate, normalizeText } from '../format.js';
import { showBookings } from './bookings.js';
import { cardRemaining, cardState, voucherRemaining, voucherState } from '../vouchers.js';
import { coursesOf, participantStatus } from '../courses.js';
import { openCourseDetail } from './courses.js';
import { openCardDetail } from './cards.js';
import { openVoucherDetail } from './vouchers.js';
import { state } from '../data.js';

export function openContactList(onClose = null) {
  const list = h('div');
  let unsubscribe = null;
  const { body, close } = openSheet({ title: 'Kund:innen', onClose: () => { unsubscribe?.(); onClose?.(); } });

  const search = h('input', {
    class: 'field field-search', type: 'search', placeholder: 'Name oder Hund suchen …', autocomplete: 'off',
    'aria-label': 'Kund:innen durchsuchen', enterkeyhint: 'search',
    oninput: () => render(),
    onkeydown: (e) => { if (e.key === 'Enter') search.blur(); },
  });

  function render() {
    const q = normalizeText(search.value);
    const all = contactsSorted();
    const shown = q ? all.filter((c) => normalizeText(`${c.name} ${c.dog || ''}`).includes(q)) : all;
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', null, 'Noch keine Kund:innen'),
        'Namen legst du am einfachsten direkt beim Erfassen einer Einnahme an – oder hier mit „Neue Kund:in“.'));
      return;
    }
    if (!shown.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', null, 'Nichts gefunden')));
      return;
    }
    list.replaceChildren(h('div', { class: 'rows' }, shown.map((c) => {
      const s = contactStats(c.id);
      const sub = [`${s.count} ${s.count === 1 ? 'Buchung' : 'Buchungen'}`];
      if (s.open) sub.push(`offen ${formatMoney(s.open)}`);
      return h('button', { type: 'button', class: 'row', onclick: () => openContactEditor(c, close) },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, c.name),
          h('div', { class: 'row-sub' }, [c.dog ? `Hund: ${c.dog}` : null, ...sub].filter(Boolean).join(' · '))),
        s.income ? h('div', { class: 'amt income' }, formatSigned(s.income, 'income')) : null);
    })));
  }

  mount(body, 
    h('div', { class: 'filters' }, search),
    h('div', { style: 'margin: 12px 0 16px' },
      h('button', { type: 'button', class: 'btn block', onclick: () => openContactEditor(null, close) }, '+ Neue Kund:in')),
    list,
  );
  render();
  unsubscribe = onChange(render);
}

/** closeList: schließt die Liste (für "Buchungen anzeigen") */
export function openContactEditor(contact = null, closeList = null) {
  const isNew = !contact;
  const nameInput = h('input', {
    class: 'field', id: 'contact-name', type: 'text', maxlength: 80, autocomplete: 'off', autocapitalize: 'words',
    value: contact?.name || '', placeholder: 'z. B. Anna Müller',
  });
  const dogInput = h('input', {
    class: 'field', id: 'contact-dog', type: 'text', maxlength: 80, autocomplete: 'off', autocapitalize: 'words',
    value: contact?.dog || '', placeholder: 'z. B. Bello',
  });
  const field = (id, value, placeholder, extra = {}) => h('input', {
    class: 'field', id, type: 'text', autocomplete: 'off', value: value || '', placeholder, ...extra,
  });
  const streetInput = field('contact-street', contact?.street, 'Straße und Hausnummer', { autocapitalize: 'words' });
  const zipInput = field('contact-zip', contact?.zip, 'PLZ', { inputmode: 'numeric', maxlength: 5 });
  const cityInput = field('contact-city', contact?.city, 'Ort', { autocapitalize: 'words' });
  const phoneInput = field('contact-phone', contact?.phone, 'Telefon', { inputmode: 'tel', type: 'tel' });
  const emailInput = field('contact-email', contact?.email, 'E-Mail', { inputmode: 'email', type: 'email', autocapitalize: 'off' });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({
    title: isNew ? 'Neue Kund:in' : 'Kund:in bearbeiten',
    cancel: true,
    onConfirm: () => save(),
  });

  async function save() {
    const name = nameInput.value.trim();
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    if (!name) return fail('Bitte einen Namen eingeben.');
    const same = findContactByName(name);
    if (same && same.id !== contact?.id) return fail(`„${same.name}“ gibt es schon.`);
    try {
      await saveContact({
        id: contact?.id,
        name,
        dog: dogInput.value.trim(),
        street: streetInput.value.trim(),
        zip: zipInput.value.trim(),
        city: cityInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
      });
      close();
      toast(isNew ? 'Kund:in angelegt' : 'Gespeichert');
    } catch (err) {
      fail(`Speichern hat nicht geklappt: ${err.message || err}`);
    }
  }

  async function remove() {
    const { count } = contactStats(contact.id);
    const ok = await confirmDialog({
      title: `„${contactLabel(contact)}“ löschen?`,
      text: count
        ? `Die ${count} ${count === 1 ? 'Buchung bleibt' : 'Buchungen bleiben'} erhalten, nur der Name wird dort entfernt.`
        : 'Der Name wird nicht mehr zur Auswahl angeboten.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteContact(contact.id);
    close();
    toast('Kund:in gelöscht');
  }

  const stats = contact ? contactStats(contact.id) : null;
  mount(body, 
    h('label', { class: 'lbl', for: 'contact-name', style: 'margin-top: 4px' }, 'Name'),
    nameInput,
    h('label', { class: 'lbl', for: 'contact-dog' }, 'Hund (optional)'),
    dogInput,
    h('p', { class: 'hint' }, 'Der Hundename wird bei der Auswahl mit angezeigt und ist durchsuchbar.'),
    h('div', { class: 'lbl' }, 'Anschrift (für Rechnungen, optional)'),
    h('div', { class: 'stack' }, streetInput, h('div', { class: 'zip-city' }, zipInput, cityInput)),
    h('div', { class: 'lbl' }, 'Kontakt (optional)'),
    h('div', { class: 'stack' }, phoneInput, emailInput),
    contact ? extrasFor(contact) : null,
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      stats?.count
        ? h('button', {
          type: 'button',
          class: 'btn block',
          onclick: () => { close(); closeList?.(); showBookings({ person: contact.id }); },
        }, `${stats.count} ${stats.count === 1 ? 'Buchung' : 'Buchungen'} anzeigen`)
        : null,
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Kund:in löschen') : null),
  );
  if (isNew) nameInput.focus();
}

/** 10er-Karten und Gutscheine einer Kund:in */
function extrasFor(contact) {
  const cards = state.cards.filter((c) => c.personId === contact.id && cardState(c) === 'active');
  const vouchers = state.vouchers.filter((v) => v.buyerPersonId === contact.id && voucherState(v) === 'active');
  const courses = coursesOf(contact.id);
  if (!cards.length && !vouchers.length && !courses.length) return null;
  return [
    h('div', { class: 'lbl' }, 'Kurse, 10er-Karten und Gutscheine'),
    h('div', { class: 'rows' },
      courses.map((c) => {
        const p = c.participants.find((x) => x.personId === contact.id);
        const st = participantStatus(p);
        return h('button', { type: 'button', class: 'row', onclick: () => openCourseDetail(c) },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.name), h('div', { class: 'row-sub' }, `ab ${formatDate(c.startDate)} · ${st === 'paid' ? 'bezahlt' : st === 'open' ? 'offen' : '–'}`)),
          h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
      }),
      cards.map((c) => h('button', { type: 'button', class: 'row', onclick: () => openCardDetail(c) },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.title || '10er-Karte'), h('div', { class: 'row-sub' }, `noch ${cardRemaining(c)} von ${c.size}`)),
        h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'))),
      vouchers.map((v) => h('button', { type: 'button', class: 'row', onclick: () => openVoucherDetail(v) },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `Gutschein ${v.code}`), h('div', { class: 'row-sub' }, `Rest ${formatMoney(voucherRemaining(v))}`)),
        h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')))),
  ];
}
