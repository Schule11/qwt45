// Bildschirm "Einstellungen" im Stil der iPhone-Einstellungen: eine kurze Liste,
// jede Zeile zeigt den aktuellen Wert und öffnet eine eigene Seite.
//
// Eingaben werden beim Verlassen des Feldes gespeichert (auch beim Zurück-Tippen).

import { h, mount, icon, toast, choiceDialog, confirmDialog, alertDialog, getTheme, setTheme } from '../ui.js';
import { state, storageIsPersistent, updateSettings, categoriesFor } from '../data.js';
import { formatDateTime, formatSize } from '../format.js';
import { APP_VERSION, APP_STAGE } from '../config.js';
import { createBackupFile, markBackupDone, readBackupFile, applyBackup } from '../backup.js';
import { saveFile, prefersShare } from '../files.js';
import { openCategoryList } from './categories.js';
import { pageHeader } from './components.js';

/** Eingabefeld, das beim Verlassen prüft und speichert */
function settingField({ id, label, value, unit, inputmode = 'text', placeholder = '', hint = null, onSave }) {
  const input = h('input', {
    class: 'field', id, type: 'text', inputmode, autocomplete: 'off', value, placeholder,
    enterkeyhint: 'done',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } },
    onchange: async () => {
      const result = await onSave(input.value.trim());
      if (result === false) { input.value = value; return; } // ungültig → alter Wert
      if (typeof result === 'string') input.value = result;   // schön formatiert
      value = input.value;
      toast('Gespeichert');
    },
  });
  return [
    h('label', { class: 'lbl', for: id }, label),
    unit ? h('div', { class: 'unit-field' }, input, h('span', { class: 'unit' }, unit)) : input,
    hint ? h('p', { class: 'hint' }, hint) : null,
  ];
}

function invalid(msg) {
  alertDialog({ title: 'Ungültige Eingabe', text: msg });
  return false;
}

/** Zeile wie in den iPhone-Einstellungen: Titel links, Wert rechts, Pfeil */
function navRow(label, value, onClick, { id = null } = {}) {
  return h('button', { type: 'button', class: 'row nav-row', id, onclick: onClick },
    h('span', { class: 'nav-label' }, label),
    value != null ? h('span', { class: 'nav-value' }, value) : null,
    h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›'));
}

// ---------- Hauptseite ----------

export function render(root) {
  const s = state.settings;
  const refresh = () => { const y = window.scrollY; root.replaceChildren(); render(root); window.scrollTo(0, y); };

  // --- Datensicherung ---
  const lastBackup = state.local.lastBackupAt;
  const since = state.bookings.length - (state.local.bookingsAtLastBackup || 0);
  const exportBtn = h('button', { type: 'button', class: 'btn primary block', onclick: () => doExport(exportBtn) },
    icon('download'), 'Backup erstellen');
  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (file) doImport(file);
    },
  });
  const importBtn = h('button', { type: 'button', class: 'btn block', onclick: () => importInput.click() },
    icon('upload'), 'Backup einspielen');
  const reminder = h('select', {
    class: 'field', id: 'backup-reminder',
    onchange: async (e) => { await updateSettings({ backupReminderDays: Number(e.target.value) }, { silent: true }); toast('Gespeichert'); },
  },
  [[14, 'alle 14 Tage'], [30, 'alle 30 Tage'], [60, 'alle 60 Tage'], [90, 'alle 90 Tage'], [0, 'nie']]
    .map(([v, l]) => h('option', { value: String(v) }, l)));
  reminder.value = String(s.backupReminderDays ?? 30);

  // --- Darstellung ---
  const themeButtons = [['system', 'Wie Handy'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) =>
    h('button', {
      type: 'button',
      'aria-pressed': String(getTheme() === v),
      onclick: (e) => {
        setTheme(v);
        for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
      },
    }, l));

  const storageInfo = h('span', null, '…');
  storageIsPersistent().then((p) => {
    storageInfo.textContent = p === true ? 'dauerhaft' : p === false ? 'nicht garantiert' : 'unbekannt';
  });

  mount(root,
    pageHeader('Einstellungen', { active: true }),

    h('h2', { class: 'section-title' }, 'Kategorien'),
    h('div', { class: 'rows group' },
      navRow('Kategorien Einnahmen', String(categoriesFor('income').length), () => openCategoryList('income', refresh), { id: 'nav-cat-income' }),
      navRow('Kategorien Ausgaben', String(categoriesFor('expense').length), () => openCategoryList('expense', refresh), { id: 'nav-cat-expense' })),

    h('h2', { class: 'section-title' }, 'Datensicherung'),
    h('section', { class: 'card' },
      h('p', { class: 'setting-text' },
        'Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig – am besten in iCloud Drive.'),
      h('div', { class: 'kv' },
        h('span', null, 'Letztes Backup'),
        h('span', null, lastBackup ? formatDateTime(lastBackup) : 'noch keins')),
      lastBackup && since > 0
        ? h('div', { class: 'kv' }, h('span', null, 'Seitdem neu/gelöscht'), h('span', null, `${since} Buchungen`))
        : null,
      h('div', { class: 'btn-row', style: 'margin-top: 14px' }, exportBtn, importBtn),
      importInput,
      h('label', { class: 'lbl', for: 'backup-reminder' }, 'An Backup erinnern'),
      reminder),

    h('h2', { class: 'section-title' }, 'Darstellung'),
    h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': 'Darstellung' }, themeButtons),

    h('h2', { class: 'section-title' }, 'App'),
    h('section', { class: 'card' },
      h('div', { class: 'kv' }, h('span', null, 'Version'), h('span', null, APP_STAGE ? `${APP_VERSION} (${APP_STAGE})` : APP_VERSION)),
      h('div', { class: 'kv' }, h('span', null, 'Gespeicherte Buchungen'), h('span', null, String(state.bookings.length))),
      h('div', { class: 'kv' }, h('span', null, 'Speicher'), storageInfo)),
  );
}

// ---------- Backup erstellen ----------

export async function doExport(btn) {
  btn.disabled = true;
  try {
    const { file, counts } = await createBackupFile();
    const share = prefersShare(file);
    const text = h('div', null,
      h('p', null, `${counts.bookings} Buchungen und ${counts.receipts} Belegfotos · ${formatSize(file.size)}`),
      h('p', null, share
        ? 'Tippe auf „Sichern“ und wähle dann „In Dateien sichern“ → iCloud Drive. So liegt das Backup nicht nur auf dem Handy.'
        : 'Die Datei wird in deinen Download-Ordner geladen. Bewahre sie an einem sicheren Ort auf.'));

    await choiceDialog({
      title: 'Backup ist bereit',
      text,
      buttons: [
        {
          label: share ? 'Sichern …' : 'Herunterladen',
          kind: 'primary',
          // Muss direkt im Tipp passieren, sonst blockiert das iPhone das Teilen
          onClick: () => saveFile(file, (ok) => {
            if (!ok) return;
            markBackupDone();
            toast(share ? 'Backup gesichert' : 'Backup heruntergeladen');
          }),
        },
        { label: 'Abbrechen' },
      ],
    });
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Backup fehlgeschlagen', text: err.message || String(err) });
  } finally {
    btn.disabled = false;
  }
}

// ---------- Backup einspielen ----------

async function doImport(file) {
  let backup;
  try {
    backup = await readBackupFile(file);
  } catch (err) {
    alertDialog({ title: 'Backup nicht lesbar', text: err.message });
    return;
  }

  const date = backup.exportedAt ? formatDateTime(backup.exportedAt) : 'unbekannt';
  const mode = await choiceDialog({
    title: 'Backup einspielen',
    text: h('div', null,
      h('p', null, `Backup vom ${date}: ${backup.bookings.length} Buchungen, ${backup.receipts.length} Belegfotos.`),
      h('p', null, h('strong', null, 'Zusammenführen: '), 'Buchungen aus dem Backup kommen dazu, nichts wird doppelt. Das jeweils Neuere gilt.'),
      h('p', null, h('strong', null, 'Ersetzen: '), 'Alle Daten auf diesem Gerät werden gelöscht und durch das Backup ersetzt.')),
    buttons: [
      { label: 'Zusammenführen (empfohlen)', value: 'merge', kind: 'primary' },
      { label: 'Alles ersetzen', value: 'replace' },
      { label: 'Abbrechen' },
    ],
  });
  if (!mode) return;

  if (mode === 'replace' && state.bookings.length) {
    const ok = await confirmDialog({
      title: 'Wirklich ersetzen?',
      text: `Die ${state.bookings.length} Buchungen auf diesem Gerät werden gelöscht und durch das Backup ersetzt.`,
      confirmLabel: 'Ja, ersetzen',
      danger: true,
    });
    if (!ok) return;
  }

  try {
    const r = await applyBackup(backup, mode);
    const lines = mode === 'replace'
      ? [`${r.added} Buchungen übernommen.`]
      : [`${r.added} neu, ${r.updated} aktualisiert, ${r.removed} entfernt.`, `Jetzt gespeichert: ${state.bookings.length} Buchungen.`];
    if (r.skipped) lines.push(`${r.skipped} fehlerhafte Einträge wurden übersprungen.`);
    alertDialog({ title: 'Backup eingespielt', text: h('div', null, lines.map((l) => h('p', null, l))) });
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Einspielen fehlgeschlagen', text: `Es wurde nichts verändert. (${err.message || err})` });
  }
}
