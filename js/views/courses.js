// Gruppenkurse: Liste, Kurs anlegen/bearbeiten, Teilnehmerliste mit Bezahlt-Status.

import { h, mount, icon, toast, openSheet, choiceDialog, confirmDialog, alertDialog } from '../ui.js';
import { state, onChange, recordById, contactById, contactLabel, categoriesFor, daysOpen, isOverdue } from '../data.js';
import { formatMoney, formatDate, parseAmount, centsToInput, todayISO } from '../format.js';
import { paymentLabel } from '../defaults.js';
import {
  coursesSorted, courseStats, participantBooking, participantStatus, isFull, saveCourse, duplicateCourse, deleteCourse,
  addParticipant, removeParticipant,
} from '../courses.js';
import { personPicker } from './personPicker.js';
import { tickPaid } from './components.js';
import { openBookingForm } from './form.js';
import { openInvoiceEditor, openInvoiceDetail } from './invoices.js';
import { KIND_LABEL, cancelInvoice } from '../invoices.js';

function statsLine(course) {
  const s = courseStats(course);
  const places = course.maxParticipants ? `${s.count} von ${course.maxParticipants} Plätzen` : `${s.count} Teilnehmer:innen`;
  return [places, `${s.paid} bezahlt`, s.openCents ? `${formatMoney(s.openCents)} offen` : null].filter(Boolean).join(' · ');
}

// ---------- Liste ----------

export function openCourseList(onClose = null) {
  let unsubscribe = null;
  let filter = 'current';
  const list = h('div');
  const seg = h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Filter', style: 'grid-template-columns: 1fr 1fr' },
    [['current', 'Aktuell'], ['finished', 'Abgeschlossen']].map(([v, l]) => h('button', { type: 'button', 'data-v': v, onclick: () => { filter = v; render(); } }, l)));
  const { body } = openSheet({ title: 'Kurse', onClose: () => { unsubscribe?.(); onClose?.(); } });

  function render() {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === filter));
    const all = coursesSorted().filter((c) => (filter === 'finished' ? c.finished : !c.finished));
    list.replaceChildren(all.length
      ? h('div', { class: 'rows' }, all.map((c) => {
        const s = courseStats(c);
        return h('button', { type: 'button', class: 'row', onclick: () => openCourseDetail(c) },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, c.name),
            h('div', { class: 'row-sub' }, `ab ${formatDate(c.startDate)}${c.sessions ? ` · ${c.sessions} Termine` : ''}`),
            h('div', { class: `row-age${s.open ? '' : ''}` }, statsLine(c))),
          h('div', { class: 'card-count' }, h('strong', null, `${s.paid}/${s.count}`), h('span', null, 'bezahlt')));
      }))
      : h('div', { class: 'empty' }, h('strong', null, filter === 'finished' ? 'Keine abgeschlossenen Kurse' : 'Noch keine Kurse'),
        filter === 'finished' ? '' : 'Lege einen Kurs an, z. B. „Welpenkurs März“, und trage die Teilnehmer:innen ein.'));
  }

  mount(body,
    h('div', { style: 'margin-bottom: 14px' }, h('button', { type: 'button', class: 'btn primary block', onclick: () => openCourseEditor() }, '+ Neuer Kurs')),
    h('div', { class: 'filters' }, seg),
    list);
  render();
  unsubscribe = onChange(render);
}

// ---------- Kurs anlegen / bearbeiten ----------

export function openCourseEditor(course = null) {
  const isNew = !course;
  const field = (id, value, placeholder, extra = {}) => h('input', { class: 'field', id, type: 'text', autocomplete: 'off', value: value ?? '', placeholder, ...extra });
  const nameInput = field('course-name', course?.name, 'z. B. Welpenkurs März', { autocapitalize: 'sentences', maxlength: 80 });
  const startInput = h('input', { class: 'field', id: 'course-start', type: 'date', value: course?.startDate || todayISO() });
  const sessionsInput = field('course-sessions', course?.sessions ? String(course.sessions) : '', 'z. B. 6', { inputmode: 'numeric' });
  const whenInput = field('course-when', course?.when, 'z. B. samstags 10 Uhr, Hundeplatz (optional)', { autocapitalize: 'sentences', maxlength: 120 });
  const priceInput = field('course-price', course ? centsToInput(course.priceCents) : '', 'z. B. 120', { inputmode: 'decimal' });
  const placesInput = field('course-places', course?.maxParticipants ? String(course.maxParticipants) : '', 'z. B. 6 (optional)', { inputmode: 'numeric' });
  const cats = categoriesFor('income');
  const catSelect = h('select', { class: 'field', id: 'course-cat' }, cats.map((c) => h('option', { value: c.id }, c.name)));
  catSelect.value = course?.categoryId || (cats.find((c) => c.id === 'cat-gruppenkurse') || cats[0])?.id;
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({ title: isNew ? 'Neuer Kurs' : 'Kurs bearbeiten', cancel: true, onConfirm: () => save() });

  async function save() {
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const name = nameInput.value.trim();
    const price = parseAmount(priceInput.value);
    const sessions = sessionsInput.value.trim() ? Number(sessionsInput.value) : null;
    const places = placesInput.value.trim() ? Number(placesInput.value) : null;
    if (!name) return fail('Bitte einen Namen eingeben.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startInput.value)) return fail('Bitte das Startdatum wählen.');
    if (!price || price <= 0) return fail('Bitte den Preis pro Person eingeben, z. B. 120.');
    if (sessions != null && (!Number.isInteger(sessions) || sessions < 1 || sessions > 100)) return fail('Bitte bei den Terminen eine ganze Zahl eingeben.');
    if (places != null && (!Number.isInteger(places) || places < 1 || places > 100)) return fail('Bitte bei den Plätzen eine ganze Zahl eingeben.');
    const saved = await saveCourse({
      id: course?.id, name, startDate: startInput.value, sessions, when: whenInput.value.trim(),
      priceCents: price, maxParticipants: places, categoryId: catSelect.value,
    });
    close();
    toast(isNew ? 'Kurs angelegt' : 'Gespeichert');
    if (isNew) openCourseDetail(saved);
  }

  mount(body,
    h('label', { class: 'lbl', for: 'course-name', style: 'margin-top: 4px' }, 'Name des Kurses'), nameInput,
    h('label', { class: 'lbl', for: 'course-start' }, 'Start'), startInput,
    h('div', { class: 'zip-city', style: 'grid-template-columns: 1fr 1fr' },
      h('div', null, h('label', { class: 'lbl', for: 'course-sessions' }, 'Termine'), sessionsInput),
      h('div', null, h('label', { class: 'lbl', for: 'course-places' }, 'Plätze'), placesInput)),
    h('label', { class: 'lbl', for: 'course-when' }, 'Zeit und Ort'), whenInput,
    h('label', { class: 'lbl', for: 'course-price' }, 'Preis pro Person (€)'), priceInput,
    !isNew ? h('p', { class: 'hint' }, 'Ein neuer Preis gilt für neu hinzugefügte Teilnehmer:innen; bestehende Buchungen bleiben unverändert.') : null,
    h('label', { class: 'lbl', for: 'course-cat' }, 'Kategorie'), catSelect,
    errorBox,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn primary block', onclick: save }, isNew ? 'Kurs anlegen' : 'Speichern')),
  );
  if (isNew) nameInput.focus();
}

// ---------- Kurs ansehen: Teilnehmerliste ----------

export function openCourseDetail(courseIn) {
  let unsubscribe = null;
  const content = h('div');
  const { body, close } = openSheet({ title: courseIn.name, onClose: () => unsubscribe?.() });

  function participantRow(course, p) {
    const b = participantBooking(p);
    const person = contactById(p.personId);
    const status = participantStatus(p);
    const inv = b && recordById('invoices', b.invoiceId);
    const sub = [];
    if (status === 'paid') sub.push(`bezahlt ${formatDate(b.date)}${b.payment ? ` · ${paymentLabel(b.payment)}` : ''}`);
    if (status === 'open') {
      const d = daysOpen(b);
      sub.push(b.serviceDate > todayISO() ? `offen · Kurs beginnt ${formatDate(b.serviceDate)}` : d === 0 ? 'offen seit heute' : `offen seit ${d} ${d === 1 ? 'Tag' : 'Tagen'}`);
    }
    if (status === 'missing') sub.push('Buchung gelöscht');
    if (inv && !inv.cancelled) sub.push(`${KIND_LABEL[inv.kind]} ${inv.number}`);
    const main = h('button', { type: 'button', class: 'row-body', onclick: () => participantActions(course, p) },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, contactLabel(person) || 'Unbekannt'),
        h('div', { class: `row-sub${status === 'open' && b && isOverdue(b) ? ' neg' : ''}` }, sub.join(' · '))),
      h('div', { class: `amt ${status === 'open' ? 'open' : 'income'}` }, b ? formatMoney(b.amountCents) : '–'));
    if (status === 'open') {
      return h('div', { class: `row open-row${isOverdue(b) ? ' overdue' : ''}` },
        h('button', { type: 'button', class: 'check', 'aria-label': `${person?.name || 'Teilnahme'}: als bezahlt abhaken`, onclick: () => tickPaid(b) }),
        main);
    }
    return h('div', { class: 'row open-row paid-row' }, h('span', { class: 'check done', 'aria-hidden': 'true' }, icon('check', 18)), main);
  }

  function render() {
    const course = recordById('courses', courseIn.id);
    if (!course) { close(); return; }
    body.closest('.sheet').querySelector('.sheet-title').textContent = course.name;
    const s = courseStats(course);
    const full = isFull(course);
    const kv = (k, v) => (v ? h('div', { class: 'kv' }, h('span', null, k), h('span', null, v)) : null);
    content.replaceChildren(
      h('section', { class: 'card' },
        kv('Start', formatDate(course.startDate)),
        kv('Termine', course.sessions ? String(course.sessions) : null),
        kv('Zeit und Ort', course.when),
        kv('Preis pro Person', formatMoney(course.priceCents)),
        kv('Plätze', course.maxParticipants ? `${s.count} von ${course.maxParticipants}${full ? ' (voll)' : ''}` : String(s.count)),
        h('div', { class: 'course-progress' },
          h('div', { class: 'meter' }, h('div', { class: 'meter-fill', style: `width: ${s.count ? Math.round((s.paid / s.count) * 100) : 0}%` })),
          h('p', { class: 'hint', style: 'margin-top: 6px' }, `${s.paid} von ${s.count} bezahlt${s.openCents ? ` · noch ${formatMoney(s.openCents)} offen` : ''}`))),
      h('div', { class: 'section-head' },
        h('h2', { class: 'section-title' }, 'Teilnehmer:innen'),
        !course.finished ? h('button', { type: 'button', class: 'btn btn-small primary', onclick: () => openAddParticipant(course) }, '+ Hinzufügen') : null),
      (course.participants || []).length
        ? h('div', { class: 'rows' }, course.participants.map((p) => participantRow(course, p)))
        : h('div', { class: 'empty' }, h('strong', null, 'Noch niemand angemeldet'), 'Tippe auf „+ Hinzufügen“.'),
      (course.participants || []).length ? h('p', { class: 'hint' }, 'Kreis antippen, sobald bezahlt wurde. Ein Tipp auf den Namen zeigt weitere Möglichkeiten (z. B. Rechnung).') : null,
      h('div', { class: 'btn-row', style: 'margin-top: 20px' },
        h('button', { type: 'button', class: 'btn block', onclick: () => openCourseEditor(course) }, 'Kurs bearbeiten'),
        h('button', { type: 'button', class: 'btn block', onclick: async () => { const c = await duplicateCourse(course); toast('Kurs kopiert'); close(); openCourseEditor(c); } }, 'Als neuen Kurs kopieren'),
        h('button', {
          type: 'button', class: 'btn block',
          onclick: async () => { await saveCourse({ id: course.id, finished: !course.finished }); toast(course.finished ? 'Kurs wieder aktiv' : 'Kurs abgeschlossen'); },
        }, course.finished ? 'Wieder aktivieren' : 'Kurs abschließen'),
        !(course.participants || []).length
          ? h('button', {
            type: 'button', class: 'btn-text danger',
            onclick: async () => {
              const ok = await confirmDialog({ title: `„${course.name}“ löschen?`, text: 'Der Kurs hat keine Teilnehmer:innen und wird gelöscht.', confirmLabel: 'Löschen', danger: true });
              if (ok) { await deleteCourse(course); toast('Kurs gelöscht'); }
            },
          }, 'Kurs löschen')
          : null),
    );
  }

  mount(body, content);
  render();
  unsubscribe = onChange(render);
}

/** Möglichkeiten für eine Teilnahme */
async function participantActions(course, p) {
  const b = participantBooking(p);
  const person = contactById(p.personId);
  const inv = b && recordById('invoices', b.invoiceId);
  const hasInv = inv && !inv.cancelled;
  const status = participantStatus(p);
  const choice = await choiceDialog({
    title: contactLabel(person) || 'Teilnahme',
    text: b ? `${course.name} · ${formatMoney(b.amountCents)} · ${status === 'paid' ? 'bezahlt' : 'offen'}` : 'Die zugehörige Buchung wurde gelöscht.',
    buttons: [
      b && status === 'open' ? { label: 'Als bezahlt markieren', value: 'paid', kind: 'primary' } : null,
      b && !hasInv ? { label: status === 'open' ? 'Rechnung erstellen' : 'Quittung erstellen', value: 'invoice' } : null,
      hasInv ? { label: `${KIND_LABEL[inv.kind]} ${inv.number} ansehen`, value: 'showInvoice' } : null,
      b ? { label: 'Buchung öffnen', value: 'booking' } : null,
      { label: 'Aus dem Kurs entfernen', value: 'remove', kind: 'danger' },
      { label: 'Abbrechen' },
    ].filter(Boolean),
  });
  if (choice === 'paid') await tickPaid(b);
  if (choice === 'invoice') openInvoiceEditor({ kind: status === 'open' ? 'invoice' : 'receipt', booking: b });
  if (choice === 'showInvoice') openInvoiceDetail(inv);
  if (choice === 'booking') openBookingForm(b);
  if (choice === 'remove') {
    const paid = status === 'paid';
    const ok = await confirmDialog({
      title: `${person?.name || 'Teilnahme'} entfernen?`,
      text: paid
        ? 'Die Zahlung bleibt als Einnahme erhalten (das Geld ist ja da). Erstattest du etwas, erfasse das bitte separat.'
        : 'Die offene Zahlung für diesen Kurs wird gelöscht.',
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    if (hasInv && !paid) await cancelInvoice(inv);
    await removeParticipant(course, p.id);
    toast('Aus dem Kurs entfernt');
  }
}

/** Teilnehmer:in hinzufügen */
function openAddParticipant(course) {
  const st = { payment: null };
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const picker = personPicker({ idPrefix: 'course-person' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Zahlung' },
    [[null, 'Noch offen'], ['cash', 'Bar bezahlt'], ['transfer', 'Überwiesen']].map(([v, l]) => h('button', {
      type: 'button', class: 'chip', 'data-v': String(v), onclick: () => { st.payment = v; update(); },
    }, l)));
  const update = () => { for (const c of chips.children) c.setAttribute('aria-pressed', String(c.dataset.v === String(st.payment))); };

  const { body, close } = openSheet({ title: 'Teilnehmer:in hinzufügen', cancel: true, onConfirm: () => add() });

  async function add() {
    const fresh = recordById('courses', course.id) || course;
    const v = picker.value();
    if (!v.personId && !v.newName) { errorBox.textContent = 'Bitte eine Kund:in wählen oder einen Namen eingeben.'; errorBox.hidden = false; return; }
    if (isFull(fresh)) {
      const ok = await confirmDialog({ title: 'Kurs ist voll', text: `Alle ${fresh.maxParticipants} Plätze sind belegt. Trotzdem hinzufügen?`, confirmLabel: 'Trotzdem hinzufügen' });
      if (!ok) return;
    }
    try {
      await addParticipant(fresh, { personId: v.personId || null, newName: v.newName || null, payment: st.payment });
      close();
      toast(st.payment ? 'Hinzugefügt (bezahlt)' : 'Hinzugefügt – Zahlung offen');
    } catch (err) {
      alertDialog({ title: 'Nicht möglich', text: err.message || String(err) });
    }
  }

  mount(body,
    h('p', { class: 'hint', style: 'margin: 0 2px 12px' }, `${course.name} · ${formatMoney(course.priceCents)} pro Person`),
    h('div', { class: 'lbl' }, 'Kund:in'),
    picker.el,
    h('div', { class: 'lbl' }, 'Zahlung'),
    chips,
    h('p', { class: 'hint' }, 'Ist noch nichts bezahlt, erscheint der Betrag unter „Offene Zahlungen“ – mit Erinnerung nach 14 Tagen ab Kursbeginn.'),
    errorBox,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn primary block', onclick: add }, 'Hinzufügen')));
  update();
}
