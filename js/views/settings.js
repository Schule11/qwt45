// Bildschirm "Einstellungen" im Stil der iPhone-Einstellungen: eine kurze Liste,
// jede Zeile zeigt den aktuellen Wert und öffnet eine eigene Seite.
//
// Eingaben werden beim Verlassen des Feldes gespeichert (auch beim Zurück-Tippen).

import { h, mount, icon, toast, choiceDialog, confirmDialog, alertDialog, getTheme, setTheme, openSheet } from '../ui.js';
import { state, storageIsPersistent, updateSettings, categoriesFor } from '../data.js';
import { formatDateTime, formatSize } from '../format.js';
import { APP_VERSION, APP_STAGE } from '../config.js';
import { createBackupFile, markBackupDone, readBackupFile, applyBackup } from '../backup.js';
import { saveFile, prefersShare } from '../files.js';
import { formatHours, hoursToInput, parseHours, hoursFormat } from '../hours.js';
import { openCategoryList } from './categories.js';
import { pageHeader, settingField, invalid, navRow } from './components.js';

// ---------- Unterseite Überstunden ----------

/** Übertrag und Anzeigeart der Überstunden */
export function openHoursSettings(onClose) {
  const { body } = openSheet({ title: 'Überstunden', onClose });
  const formatButtons = [['decimal', '12,5 Std.'], ['hm', '12:30 Std.']].map(([v, l]) => h('button', {
    type: 'button',
    'aria-pressed': String(hoursFormat() === v),
    onclick: async (e) => {
      const btn = e.currentTarget; // nach dem await ist currentTarget nicht mehr gesetzt
      await updateSettings({ hoursFormat: v }, { silent: true });
      for (const b of btn.parentElement.children) b.setAttribute('aria-pressed', String(b === btn));
      startInput.value = hoursToInput(state.settings.hoursStartMinutes || 0);
      toast('Gespeichert');
    },
  }, l));
  const fields = settingField({
    id: 'set-hours-start',
    label: 'Übertrag (Stand vor dem ersten erfassten Monat)',
    unit: 'Std.',
    inputmode: 'text',
    value: hoursToInput(state.settings.hoursStartMinutes || 0),
    hint: 'Hattest du schon Überstunden, bevor du hier Monate erfasst? Dann trag den Stand hier ein, z. B. 12,5 oder 12:30. '
      + 'Minusstunden mit Minus davor, z. B. -4.',
    onSave: async (v) => {
      const minutes = v ? parseHours(v, { allowSign: true }) : 0;
      if (minutes == null || Math.abs(minutes) > 10000 * 60) return invalid('Bitte eine Stundenzahl eingeben, z. B. 12,5, 12:30 oder -4.');
      await updateSettings({ hoursStartMinutes: minutes }, { silent: true });
      return hoursToInput(minutes);
    },
  });
  const startInput = fields[1].querySelector('input');
  mount(body,
    h('section', { class: 'card' }, fields),
    h('h2', { class: 'section-title' }, 'Stunden anzeigen als'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Stunden anzeigen als' }, formatButtons),
    h('p', { class: 'hint' }, 'Eingeben kannst du immer beides: 172,5 oder 172:30.'));
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

    h('h2', { class: 'section-title' }, 'Überstunden'),
    h('div', { class: 'rows group' },
      navRow('Übertrag & Anzeige', `Übertrag ${formatHours(s.hoursStartMinutes || 0, { signed: true })}`, () => openHoursSettings(refresh), { id: 'nav-hours' })),

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
      h('div', { class: 'kv' }, h('span', null, 'Erfasste Monate (Überstunden)'), h('span', null, String(state.hours.length))),
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
      h('p', null, `${counts.bookings} Buchungen, ${counts.hours} Monate Überstunden und ${counts.receipts} Belegfotos · ${formatSize(file.size)}`),
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
      h('p', null, `Backup vom ${date}: ${backup.bookings.length} Buchungen, ${backup.hours.length} Monate Überstunden, ${backup.receipts.length} Belegfotos.`),
      h('p', null, h('strong', null, 'Zusammenführen: '), 'Buchungen und Monate aus dem Backup kommen dazu, nichts wird doppelt. Das jeweils Neuere gilt.'),
      h('p', null, h('strong', null, 'Ersetzen: '), 'Alle Daten auf diesem Gerät werden gelöscht und durch das Backup ersetzt.')),
    buttons: [
      { label: 'Zusammenführen (empfohlen)', value: 'merge', kind: 'primary' },
      { label: 'Alles ersetzen', value: 'replace' },
      { label: 'Abbrechen' },
    ],
  });
  if (!mode) return;

  if (mode === 'replace' && (state.bookings.length || state.hours.length)) {
    const ok = await confirmDialog({
      title: 'Wirklich ersetzen?',
      text: `Die ${state.bookings.length} Buchungen und ${state.hours.length} Monate Überstunden auf diesem Gerät werden gelöscht und durch das Backup ersetzt.`,
      confirmLabel: 'Ja, ersetzen',
      danger: true,
    });
    if (!ok) return;
  }

  try {
    const r = await applyBackup(backup, mode);
    const lines = mode === 'replace'
      ? [`${r.added} Buchungen und ${r.hours} Monate Überstunden übernommen.`]
      : [`Buchungen: ${r.added} neu, ${r.updated} aktualisiert, ${r.removed} entfernt.`,
        `Überstunden: ${r.hours} ${r.hours === 1 ? 'Monat' : 'Monate'} neu oder aktualisiert.`,
        `Jetzt gespeichert: ${state.bookings.length} Buchungen, ${state.hours.length} Monate Überstunden.`];
    if (r.skipped) lines.push(`${r.skipped} fehlerhafte Einträge wurden übersprungen.`);
    alertDialog({ title: 'Backup eingespielt', text: h('div', null, lines.map((l) => h('p', null, l))) });
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Einspielen fehlgeschlagen', text: `Es wurde nichts verändert. (${err.message || err})` });
  }
}
