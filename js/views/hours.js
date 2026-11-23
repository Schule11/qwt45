// Bildschirm "Überstunden": aktueller Stand, Monate eines Jahres, Diagramm, Export –
// und das Formular, mit dem ein Monat erfasst wird.

import { h, mount, icon, toast, confirmDialog, alertDialog } from '../ui.js';
import { state, saveHours, deleteHours } from '../data.js';
import { MONTHS, monthLabel, todayISO } from '../format.js';
import {
  formatHours, hoursToInput, parseHours, hoursFormat, hoursFor, hoursBalance, hoursYear, hoursYears,
  missingMonths, suggestedMonth, previousRecord, balanceWith, startBalance,
} from '../hours.js';
import { hoursCsv, hoursPdf } from '../exports.js';
import { saveFile, prefersShare } from '../files.js';
import { pageHeader, yearSelect, cardHead, tapCard } from './components.js';
import { hoursChart } from './charts.js';
import { registerForm } from './formState.js';

const MAX_MINUTES = 744 * 60; // mehr als 31 × 24 Stunden hat kein Monat

let selectedYear = new Date().getFullYear();

const signedHours = (m) => formatHours(m, { signed: true });
const currentMonth = () => todayISO().slice(0, 7);

// ---------- Bausteine (auch für die Übersicht) ----------

/** Karte mit dem aktuellen Stand; onClick macht sie antippbar (Übersicht) */
export function balanceCard({ onClick = null, title = null } = {}) {
  const b = hoursBalance();
  const sub = b.lastMonth
    ? `Stand nach ${monthLabel(b.lastMonth)} · ${b.count} ${b.count === 1 ? 'Monat' : 'Monate'} erfasst`
    : 'Noch kein Monat erfasst';
  return tapCard({ onClick, className: 'hours-card', id: 'ov-hours', label: 'Aktueller Stand' },
    cardHead('clock', title || (b.minutes < 0 ? 'Minusstunden' : 'Überstunden'), { chevron: !!onClick }),
    h('span', { class: `hours-big${b.minutes < 0 ? ' neg' : ''}`, 'data-k': 'hours-balance' }, signedHours(b.minutes)),
    h('span', { class: 'hours-sub' }, sub),
    startBalance() && b.count ? h('span', { class: 'hours-sub' }, `inkl. Übertrag ${signedHours(startBalance())}`) : null);
}

/** Hinweiszeile, wenn Monate fehlen (z. B. der Vormonat); null, wenn alles da ist */
export function missingHint() {
  const missing = missingMonths(currentMonth());
  if (!missing.length) return null;
  const text = missing.length === 1
    ? `${monthLabel(missing[0])} noch nicht erfasst`
    : `${missing.length} Monate noch nicht erfasst (ab ${monthLabel(missing[0])})`;
  return h('button', { type: 'button', class: 'hint-row', id: 'hours-missing', onclick: () => openHoursForm({ month: missing[0] }) },
    icon('clock', 20), h('span', null, text), h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
}

// ---------- Bildschirm ----------

export function render(root) {
  const years = hoursYears();
  if (!years.includes(selectedYear)) selectedYear = years[0];
  const rerender = () => { root.replaceChildren(); render(root); };
  const y = hoursYear(selectedYear);
  const fmt = (m, signed = false) => formatHours(m, { signed });

  mount(root,
    pageHeader('Überstunden'),
    balanceCard({ title: 'Aktueller Stand' }),
    missingHint(),
    h('button', { type: 'button', class: 'btn primary block', id: 'hours-add', onclick: () => openHoursForm() },
      icon('clock'), 'Monat erfassen'));

  if (!state.hours.length) {
    mount(root, h('section', { class: 'card', style: 'margin-top: 16px' },
      h('h2', { class: 'card-title' }, 'So funktioniert’s'),
      explainText()));
    return;
  }

  // Jahr: Summen und Monate
  const head = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, 'Jahr'),
      h('div', { class: 'head-select' }, yearSelect(years, selectedYear, (v) => { selectedYear = Number(v); rerender(); }))),
    statRow('Gearbeitet', fmt(y.worked)),
    statRow('Ausbezahlt', fmt(y.paid)),
    statRow('Überstunden im Jahr', fmt(y.diff, true), y.diff < 0 ? 'neg' : ''),
    y.azk ? statRow('Vom AZK ausbezahlt', fmt(-y.azk, true), 'neg') : null,
    h('div', { class: 'stat total' },
      h('span', { class: 'stat-label' }, selectedYear === new Date().getFullYear() ? 'Stand bisher' : `Stand Ende ${selectedYear}`),
      h('span', { class: `stat-value${y.endOfYear < 0 ? ' neg' : ''}` }, fmt(y.endOfYear, true))),
    y.rows.length && y.startOfYear
      ? h('p', { class: 'hint', style: 'margin-bottom: 0' }, `Stand zu Jahresbeginn: ${fmt(y.startOfYear, true)}`)
      : null);

  mount(root,
    head,
    y.rows.length ? h('section', { class: 'card' }, hoursChart(y.rows, { year: selectedYear, fmt })) : null,
    monthList(y),
    h('h2', { class: 'section-title' }, 'Export'),
    h('section', { class: 'card' },
      h('div', { class: 'btn-pair', style: 'margin-top: 0' },
        exportBtn('Als PDF', hoursPdf),
        exportBtn('Als CSV', hoursCsv)),
      h('p', { class: 'hint', style: 'margin-bottom: 0' }, 'Alle erfassten Monate mit Stand – z. B. für ein Gespräch mit dem Arbeitgeber.')),
    h('h2', { class: 'section-title' }, 'So rechnet die App'),
    h('section', { class: 'card' }, explainText()),
  );
}

function statRow(label, value, cls = '') {
  return h('div', { class: 'stat' },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: `stat-value ${cls}` }, value));
}

function explainText() {
  return [
    h('p', { style: 'margin-top: 0' }, 'Trag jeden Monat ein: die Stunden, die du tatsächlich gearbeitet hast, '
      + 'die ausbezahlten Stunden und – falls es welche gab – die Stunden, die vom Arbeitszeitkonto (AZK) ausbezahlt wurden. '
      + 'Beides steht auf der Lohnabrechnung.'),
    h('p', null, h('strong', null, 'Überstunden des Monats'), ' = gearbeitet − ausbezahlt. ',
      h('strong', null, 'Stand'), ' = Übertrag + alle Überstunden − alle AZK-Auszahlungen.'),
    h('p', { class: 'hint' }, 'Überstunden abgebaut (Freizeitausgleich)? Dann hast du weniger gearbeitet als ausbezahlt – der Stand sinkt von selbst. '
      + 'Überstunden vom AZK ausbezahlt bekommen? Dann trag sie im Feld „Vom AZK ausbezahlt“ ein – auch das senkt den Stand.'),
    h('p', { class: 'hint', style: 'margin-bottom: 0' }, 'Überstunden von vorher und die Anzeige (12,5 oder 12:30): Einstellungen → Überstunden.'),
  ];
}

/** Monate des Jahres, neueste zuerst – fehlende Monate (ab dem ersten erfassten) zum Nachtragen */
function monthList(y) {
  const missing = new Set(missingMonths(currentMonth()).filter((m) => m.startsWith(String(y.year))));
  const items = [...y.rows.map((r) => ({ month: r.month, row: r })), ...[...missing].map((m) => ({ month: m, row: null }))]
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  if (!items.length) {
    return h('div', { class: 'empty' }, h('strong', null, `Keine Monate in ${y.year}`), 'Tippe auf „Monat erfassen“.');
  }
  return h('div', { class: 'rows', id: 'hours-list' }, items.map(({ month, row }) => {
    if (!row) {
      return h('button', { type: 'button', class: 'row hours-row missing', onclick: () => openHoursForm({ month }) },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, monthLabel(month)),
          h('div', { class: 'row-sub' }, 'nicht erfasst – antippen zum Nachtragen')),
        h('span', { class: 'amt muted' }, '+'));
    }
    const n = (m) => formatHours(m, { unit: false });
    const sub = `${n(row.rec.workedMinutes)} gearbeitet · ${n(row.rec.paidMinutes)} ausbezahlt`;
    const azkText = row.azk ? `, vom AZK ausbezahlt ${formatHours(row.azk)}` : '';
    return h('button', {
      type: 'button',
      class: 'row hours-row',
      'aria-label': `${monthLabel(month)}: Überstunden ${signedHours(row.diff)}${azkText}, Stand ${signedHours(row.balance)}. Bearbeiten`,
      onclick: () => openHoursForm({ month }),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, monthLabel(month)),
      h('div', { class: 'row-sub' }, sub),
      row.rec.note ? h('div', { class: 'row-sub' }, row.rec.note) : null),
    h('div', { class: 'hours-amts' },
      h('span', { class: `amt ${row.diff < 0 ? 'expense' : row.diff > 0 ? 'income' : ''}` }, signedHours(row.diff)),
      row.azk ? h('span', { class: 'hours-azk' }, `AZK ${signedHours(-row.azk)}`) : null,
      h('span', { class: 'hours-balance' }, `Stand ${signedHours(row.balance)}`)));
  }));
}

function exportBtn(label, make) {
  return h('button', {
    type: 'button',
    class: 'btn block btn-small',
    onclick: () => {
      // Datei sofort im Tipp erzeugen und weitergeben (wichtig fürs iPhone)
      let file;
      try {
        file = make();
      } catch (err) {
        console.error(err);
        alertDialog({ title: 'Export fehlgeschlagen', text: err.message || String(err) });
        return;
      }
      const share = prefersShare(file);
      saveFile(file, (ok) => { if (ok && !share) toast(`${file.name} heruntergeladen`); });
    },
  }, label);
}

// ---------- Formular: Monat erfassen ----------

/**
 * Öffnet das Formular für einen Monat ("JJJJ-MM"). Ohne Monat wird der nächste
 * sinnvolle vorgeschlagen (z. B. der fehlende Vormonat). Gibt es den Monat schon,
 * wird er bearbeitet. Muss direkt im Klick-Handler aufgerufen werden (Tastatur am iPhone).
 */
export function openHoursForm({ month = null } = {}) {
  const done = registerForm();
  if (!done) return;

  const format = hoursFormat();
  const inputmode = format === 'hm' ? 'text' : 'decimal'; // für "172:30" braucht es den Doppelpunkt
  const st = { month: month || suggestedMonth(currentMonth()), existing: null, dirty: false, saving: false };
  const lockMonth = !!(month && hoursFor(month)); // vorhandenen Monat bearbeiten: Monat fest

  const title = h('h1', { class: 'sheet-title', id: 'sheet-title' });

  // Monat und Jahr als zwei Klapplisten (funktioniert in allen Browsers gleich)
  const nowYear = new Date().getFullYear();
  const yearsWithData = state.hours.map((x) => Number(x.month.slice(0, 4)));
  const firstYear = Math.min(nowYear - 3, ...yearsWithData, Number(st.month.slice(0, 4)));
  const lastYear = Math.max(nowYear + 1, ...yearsWithData);
  const monthSel = h('select', { class: 'field', id: 'hours-month', 'aria-label': 'Monat', disabled: lockMonth, onchange: onMonthChange },
    MONTHS.map((name, i) => h('option', { value: String(i + 1).padStart(2, '0') }, name)));
  const yearSel = h('select', { class: 'field', id: 'hours-year', 'aria-label': 'Jahr', disabled: lockMonth, onchange: onMonthChange },
    Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i).map((yy) => h('option', { value: String(yy) }, String(yy))));

  const hoursInput = (id, label) => h('input', {
    class: 'field hours-input', id, type: 'text', inputmode, autocomplete: 'off', enterkeyhint: 'next',
    placeholder: format === 'hm' ? 'z. B. 172:30' : 'z. B. 172,5', 'aria-label': label,
    oninput: () => { st.dirty = true; clearError(); updatePreview(); },
  });
  const workedInput = hoursInput('hours-worked', 'Tatsächlich gearbeitet in Stunden');
  const paidInput = hoursInput('hours-paid', 'Ausbezahlt in Stunden');
  const paidHint = h('p', { class: 'hint', hidden: true });
  const azkInput = hoursInput('hours-azk', 'Vom Arbeitszeitkonto ausbezahlt in Stunden');
  azkInput.placeholder = '0';
  const noteInput = h('input', {
    class: 'field', id: 'hours-note', type: 'text', maxlength: 200, autocomplete: 'off', autocapitalize: 'sentences',
    enterkeyhint: 'done', placeholder: 'z. B. 3 Tage Urlaub',
    oninput: () => { st.dirty = true; },
  });
  const preview = h('div', { class: 'hours-preview', 'aria-live': 'polite' });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary block' }, 'Speichern');
  const saveBtnTop = h('button', { type: 'submit', class: 'round-btn confirm', 'aria-label': 'Speichern' }, icon('check', 24));
  const deleteBtn = h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Monat löschen');

  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); } },
    h('header', { class: 'sheet-bar' },
      h('button', { type: 'button', class: 'round-btn', 'aria-label': 'Abbrechen', onclick: cancel }, icon('close', 22)),
      title,
      saveBtnTop),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'lbl', style: 'margin-top: 4px' }, 'Monat'),
      h('div', { class: 'month-pick' }, monthSel, yearSel),
      lockMonth ? h('p', { class: 'hint' }, 'Falscher Monat? Diesen Eintrag löschen und den richtigen neu erfassen.') : null,

      h('label', { class: 'lbl', for: 'hours-worked' }, 'Tatsächlich gearbeitet'),
      h('div', { class: 'unit-field' }, workedInput, h('span', { class: 'unit' }, 'Std.')),

      h('label', { class: 'lbl', for: 'hours-paid' }, 'Ausbezahlt'),
      h('div', { class: 'unit-field' }, paidInput, h('span', { class: 'unit' }, 'Std.')),
      paidHint,
      h('p', { class: 'hint' }, 'Laut Lohnabrechnung – ohne die Auszahlung vom Arbeitszeitkonto (die kommt ins Feld darunter).'),

      h('label', { class: 'lbl', for: 'hours-azk' }, 'Vom AZK ausbezahlt (optional)'),
      h('div', { class: 'unit-field' }, azkInput, h('span', { class: 'unit' }, 'Std.')),
      h('p', { class: 'hint' }, 'Steht auf der Lohnabrechnung als eigener Posten „AZK“. Diese Stunden werden von deinen Überstunden abgezogen. '
        + 'Leer lassen, wenn nichts ausbezahlt wurde.'),

      preview,

      h('label', { class: 'lbl', for: 'hours-note' }, 'Notiz (optional)'),
      noteInput,

      errorBox,
      h('div', { class: 'form-actions' }, saveBtn, deleteBtn)));

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' }, form);

  // ---------- Anzeige ----------

  /** Werte des gewählten Monats laden (vorhanden: bearbeiten, sonst neu mit Vorschlag) */
  function loadMonth() {
    const rec = hoursFor(st.month);
    const hadExisting = !!st.existing;
    st.existing = rec;
    monthSel.value = st.month.slice(5);
    yearSel.value = st.month.slice(0, 4);
    if (rec) {
      workedInput.value = hoursToInput(rec.workedMinutes, format);
      paidInput.value = hoursToInput(rec.paidMinutes, format);
      azkInput.value = rec.azkMinutes ? hoursToInput(rec.azkMinutes, format) : '';
      noteInput.value = rec.note || '';
      paidHint.hidden = true;
    } else {
      if (hadExisting) { workedInput.value = ''; azkInput.value = ''; noteInput.value = ''; }
      // Ausbezahlte Stunden sind meist jeden Monat gleich: vom letzten Monat übernehmen
      const prev = previousRecord(st.month);
      if (prev && (!paidInput.value || hadExisting)) {
        paidInput.value = hoursToInput(prev.paidMinutes, format);
        paidHint.textContent = `Von ${monthLabel(prev.month)} übernommen – bitte mit der Lohnabrechnung vergleichen.`;
        paidHint.hidden = false;
      } else if (!prev) {
        paidHint.hidden = true;
      }
    }
    title.textContent = rec ? `${monthLabel(st.month)} bearbeiten` : 'Monat erfassen';
    deleteBtn.hidden = !rec;
    updatePreview();
  }

  function onMonthChange() {
    st.month = `${yearSel.value}-${monthSel.value}`;
    st.dirty = true;
    clearError();
    loadMonth();
  }

  /** AZK-Feld lesen: leer = 0, ungültig = null */
  function azkValue() {
    return azkInput.value.trim() ? parseHours(azkInput.value) : 0;
  }

  /** Vorschau: Überstunden dieses Monats, AZK-Auszahlung und Stand danach */
  function updatePreview() {
    const worked = parseHours(workedInput.value);
    const paid = parseHours(paidInput.value);
    const azk = azkValue();
    if (worked == null || paid == null) {
      preview.replaceChildren(h('span', { class: 'muted' }, 'Überstunden und Stand erscheinen hier, sobald gearbeitete und ausbezahlte Stunden eingetragen sind.'));
      return;
    }
    if (azk == null) {
      preview.replaceChildren(h('span', { class: 'muted' }, 'Bitte beim AZK eine Zahl eingeben (z. B. 10) oder das Feld leer lassen.'));
      return;
    }
    const diff = worked - paid;
    const after = balanceWith(st.month, worked, paid, azk);
    const later = state.hours.some((x) => x.month > st.month);
    preview.replaceChildren();
    mount(preview,
      h('div', { class: 'kv' }, h('span', null, `Überstunden ${MONTHS[Number(st.month.slice(5)) - 1]}`),
        h('strong', { class: diff < 0 ? 'neg' : diff > 0 ? 'pos' : '' }, signedHours(diff))),
      azk ? h('div', { class: 'kv' }, h('span', null, 'Vom AZK ausbezahlt'), h('strong', { class: 'neg' }, signedHours(-azk))) : null,
      h('div', { class: 'kv' }, h('span', null, `Stand Ende ${monthLabel(st.month)}`),
        h('strong', { class: after < 0 ? 'neg' : '' }, signedHours(after))),
      later ? h('p', { class: 'hint', style: 'margin: 4px 0 0' }, 'Spätere Monate verschieben sich entsprechend mit.') : null);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function clearError() { errorBox.hidden = true; }

  // ---------- Speichern / Löschen / Schließen ----------

  async function save() {
    if (st.saving) return;
    const example = format === 'hm' ? '172:30' : '172,5';
    const worked = parseHours(workedInput.value);
    const paid = parseHours(paidInput.value);
    if (worked == null) {
      showError(workedInput.value.trim() ? `Bitte die gearbeiteten Stunden als Zahl eingeben, z. B. ${example}.` : 'Bitte die gearbeiteten Stunden eingeben.');
      return;
    }
    if (paid == null) {
      showError(paidInput.value.trim() ? `Bitte die ausbezahlten Stunden als Zahl eingeben, z. B. ${example}.` : 'Bitte die ausbezahlten Stunden eingeben.');
      return;
    }
    const azk = azkValue();
    if (azk == null) {
      showError(`Bitte beim AZK die ausbezahlten Stunden als Zahl eingeben, z. B. ${format === 'hm' ? '10:00' : '10'} – oder das Feld leer lassen.`);
      return;
    }
    if (worked > MAX_MINUTES || paid > MAX_MINUTES || azk > MAX_MINUTES) { showError('So viele Stunden hat ein Monat nicht. Bitte prüfen.'); return; }
    if (!st.existing && hoursFor(st.month)) { loadMonth(); return; } // inzwischen anderswo angelegt

    st.saving = true;
    saveBtn.disabled = true;
    saveBtnTop.disabled = true;
    try {
      const isNew = !st.existing;
      await saveHours(st.month, { workedMinutes: worked, paidMinutes: paid, azkMinutes: azk, note: noteInput.value });
      close();
      toast(`${monthLabel(st.month)} ${isNew ? 'erfasst' : 'gespeichert'} · Stand ${signedHours(hoursBalance().minutes)}`);
    } catch (err) {
      console.error(err);
      showError(`Speichern hat nicht geklappt: ${err.message || err}`);
      st.saving = false;
      saveBtn.disabled = false;
      saveBtnTop.disabled = false;
    }
  }

  async function remove() {
    if (!st.existing) return;
    const ok = await confirmDialog({
      title: `${monthLabel(st.month)} löschen?`,
      text: 'Die Stunden dieses Monats werden gelöscht, der Stand wird neu berechnet.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteHours(st.month);
      close();
      toast(`${monthLabel(st.month)} gelöscht`);
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
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) cancel();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    document.body.classList.remove('sheet-open');
    done();
  }

  // Enter im Feld "gearbeitet" springt weiter zu "ausbezahlt"
  workedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); paidInput.focus(); } });
  paidInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); azkInput.focus(); } });

  // ---------- Start ----------

  loadMonth();
  document.body.append(sheet);
  document.body.classList.add('sheet-open');
  document.addEventListener('keydown', onKey);
  // Neuer Monat: gleich die gearbeiteten Stunden eintippen
  if (!st.existing) workedInput.focus({ preventScroll: true });
}
