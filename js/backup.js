// Datensicherung: alle Daten (inkl. Belegfotos) als eine JSON-Datei
// exportieren und wieder einspielen.
//
// Einspielen geht auf zwei Arten:
// - Zusammenführen: Neues kommt dazu, Geändertes wird aktualisiert (das jeweils
//   neuere gewinnt), Gelöschtes wird auch hier gelöscht. Nichts wird doppelt.
// - Ersetzen: Alle Daten auf diesem Gerät werden durch das Backup ersetzt.

import * as db from './db.js';
import { state, load, emitChange, nowISO, updateLocal } from './data.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { APP_ID, APP_VERSION, BACKUP_FORMAT } from './config.js';
import { todayISO } from './format.js';

// ---------- Hilfen für Fotos (Binärdaten ↔ Text) ----------

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ---------- Export ----------

export async function createBackupFile() {
  const [receipts, tombstones] = await Promise.all([db.getAll('receipts'), db.getAll('tombstones')]);
  const head = {
    app: APP_ID,
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: nowISO(),
    settings: state.settings,
    categories: state.categories,
    bookings: state.bookings,
    tombstones,
  };
  // Datei in Teilen zusammensetzen – spart Arbeitsspeicher bei vielen Fotos
  const headJson = JSON.stringify(head);
  const parts = [headJson.slice(0, -1), ',"receipts":['];
  receipts.forEach((r, i) => {
    parts.push((i ? ',' : '') + JSON.stringify({
      id: r.id,
      type: r.type,
      width: r.width,
      height: r.height,
      name: r.name || null,
      createdAt: r.createdAt,
      data: bufferToBase64(r.data),
    }));
  });
  parts.push(']}');

  const name = `${APP_ID}-backup-${todayISO()}.json`;
  const file = new File(parts, name, { type: 'application/json' });
  return { file, counts: { bookings: state.bookings.length, receipts: receipts.length } };
}

export async function markBackupDone() {
  await updateLocal({ lastBackupAt: nowISO(), bookingsAtLastBackup: state.bookings.length });
}

// ---------- Import: Datei lesen und prüfen ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function readBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden. Ist es wirklich ein Backup dieser App (.json)?');
  }
  if (data?.app === 'hundeschule') {
    throw new Error('Das ist ein Backup der Hundeschule-App. Es gehört zu einer anderen App und kann hier nicht eingespielt werden.');
  }
  if (!data || data.app !== APP_ID || typeof data.format !== 'number') {
    throw new Error('Diese Datei ist kein Backup des Haushaltsbuchs.');
  }
  if (data.format > BACKUP_FORMAT) {
    throw new Error('Das Backup stammt von einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  }
  return sanitize(data);
}

const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === 'string' ? x : '');

function sanitize(data) {
  const bookings = [];
  let skipped = 0;
  for (const b of arr(data.bookings)) {
    const ok = b && typeof b.id === 'string' && (b.type === 'income' || b.type === 'expense')
      && DATE_RE.test(b.date) && Number.isSafeInteger(b.amountCents) && b.amountCents >= 0
      && typeof b.categoryId === 'string';
    if (!ok) { skipped++; continue; }
    bookings.push({
      id: b.id,
      type: b.type,
      date: b.date,
      amountCents: b.amountCents,
      categoryId: b.categoryId,
      description: str(b.description),
      receiptId: typeof b.receiptId === 'string' ? b.receiptId : null,
      createdAt: str(b.createdAt) || nowISO(),
      updatedAt: str(b.updatedAt) || str(b.createdAt) || nowISO(),
    });
  }

  const categories = arr(data.categories)
    .filter((c) => c && typeof c.id === 'string' && (c.type === 'income' || c.type === 'expense') && str(c.name))
    .map((c, i) => ({
      id: c.id,
      key: typeof c.key === 'string' ? c.key : null,
      type: c.type,
      name: c.name,
      order: Number.isFinite(c.order) ? c.order : i,
      updatedAt: str(c.updatedAt) || nowISO(),
    }));

  const receipts = arr(data.receipts).filter((r) => r && typeof r.id === 'string' && typeof r.data === 'string');
  const tombstones = arr(data.tombstones).filter((t) => t && typeof t.id === 'string' && typeof t.deletedAt === 'string');

  // Einstellungen: nur bekannte Schlüssel mit passendem Typ übernehmen
  let settings = null;
  if (data.settings && typeof data.settings === 'object') {
    settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const v = data.settings[key];
      if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[key]) settings[key] = v;
    }
  }

  return {
    exportedAt: str(data.exportedAt),
    format: data.format,
    bookings,
    categories,
    receipts,
    tombstones,
    settings,
    skipped,
  };
}

// ---------- Import: anwenden ----------

const STORES = ['bookings', 'categories', 'receipts', 'tombstones', 'meta'];

export async function applyBackup(backup, mode) {
  // Fotos vorher umwandeln (in der Datenbank-Transaktion darf nicht gewartet werden)
  const receipts = [];
  for (const r of backup.receipts) {
    try {
      receipts.push({
        id: r.id,
        type: str(r.type) || 'image/jpeg',
        width: r.width,
        height: r.height,
        name: str(r.name) || null,
        createdAt: str(r.createdAt) || nowISO(),
        data: base64ToBuffer(r.data),
      });
    } catch { /* beschädigtes Foto überspringen */ }
  }

  let result;
  if (mode === 'replace') {
    await db.write(STORES, (s) => {
      for (const name of ['bookings', 'categories', 'receipts', 'tombstones']) s[name].clear();
      for (const b of backup.bookings) s.bookings.put(b);
      for (const c of backup.categories) s.categories.put(c);
      for (const r of receipts) s.receipts.put(r);
      for (const t of backup.tombstones) s.tombstones.put(t);
      if (backup.settings) s.meta.put({ key: 'settings', value: backup.settings });
    });
    result = { added: backup.bookings.length, updated: 0, removed: 0 };
  } else {
    result = await merge(backup, receipts);
  }

  await load();
  emitChange();
  return { ...result, skipped: backup.skipped };
}

async function merge(backup, receipts) {
  const [localTombstones, localReceiptIds] = await Promise.all([db.getAll('tombstones'), db.getAllKeys('receipts')]);

  // Gelöschtes von beiden Seiten zusammenführen (jeweils der neueste Eintrag)
  const tomb = new Map(localTombstones.map((t) => [t.id, t]));
  const newTombs = [];
  for (const t of backup.tombstones) {
    const local = tomb.get(t.id);
    if (!local || local.deletedAt < t.deletedAt) { tomb.set(t.id, t); newTombs.push(t); }
  }
  const deletedAfter = (id, updatedAt) => {
    const t = tomb.get(id);
    return !!t && t.deletedAt >= (updatedAt || '');
  };

  /** Eine Liste zusammenführen: das jeweils Neuere gewinnt, Gelöschtes wird gelöscht */
  const mergeList = (localList, incomingList) => {
    const put = [];
    const del = [];
    let added = 0;
    let updated = 0;
    const localMap = new Map(localList.map((x) => [x.id, x]));
    const incomingMap = new Map(incomingList.map((x) => [x.id, x]));
    for (const x of incomingList) {
      const local = localMap.get(x.id);
      if (deletedAfter(x.id, x.updatedAt)) continue;
      if (!local) { put.push(x); added++; } else if (x.updatedAt > local.updatedAt) { put.push(x); updated++; }
    }
    for (const local of localList) {
      const incoming = incomingMap.get(local.id);
      const newest = incoming && incoming.updatedAt > local.updatedAt ? incoming : local;
      if (deletedAfter(local.id, newest.updatedAt)) del.push(local.id);
    }
    return { put, del, added, updated, removed: del.length };
  };
  const bookings = mergeList(state.bookings, backup.bookings);
  const cats = mergeList(state.categories, backup.categories);

  // Fotos (ändern sich nie – ein neues Foto bekommt eine neue ID)
  const haveR = new Set(localReceiptIds);
  const putR = receipts.filter((r) => !haveR.has(r.id) && !tomb.has(r.id));
  const delR = localReceiptIds.filter((id) => tomb.has(id));

  // Einstellungen: die neueren gewinnen
  const takeSettings = backup.settings && (backup.settings.updatedAt || '') > (state.settings.updatedAt || '');

  await db.write(STORES, (s) => {
    for (const [name, plan] of [['bookings', bookings], ['categories', cats]]) {
      for (const x of plan.put) s[name].put(x);
      for (const id of plan.del) s[name].delete(id);
    }
    for (const r of putR) s.receipts.put(r);
    for (const id of delR) s.receipts.delete(id);
    for (const t of newTombs) s.tombstones.put(t);
    if (takeSettings) s.meta.put({ key: 'settings', value: backup.settings });
  });

  return { added: bookings.added, updated: bookings.updated, removed: bookings.removed };
}
