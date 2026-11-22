// Datensicherung: alle Daten (inkl. Belegfotos) als eine JSON-Datei
// exportieren und wieder einspielen.
//
// Einspielen geht auf zwei Arten:
// - Zusammenführen: Neues kommt dazu, Geändertes wird aktualisiert (das jeweils
//   neuere gewinnt), Gelöschtes wird auch hier gelöscht. Nichts wird doppelt.
// - Ersetzen: Alle Daten auf diesem Gerät werden durch das Backup ersetzt.

import * as db from './db.js';
import { state, load, emitChange, nowISO, updateLocal, RECORD_STORES, ensureV3Defaults } from './data.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { APP_VERSION, BACKUP_FORMAT } from './config.js';
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
    app: 'hundeschule',
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: nowISO(),
    settings: state.settings,
    categories: state.categories,
    contacts: state.contacts,
    bookings: state.bookings,
    ...Object.fromEntries(RECORD_STORES.map((name) => [name, state[name]])),
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

  const name = `hundeschule-backup-${todayISO()}.json`;
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
  if (!data || data.app !== 'hundeschule' || typeof data.format !== 'number') {
    throw new Error('Diese Datei ist kein Backup der Hundeschule-App.');
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
      ...b, // weitere Felder (Preisliste, Fahrten, Rechnung …) unverändert übernehmen
      id: b.id,
      type: b.type,
      date: b.date,
      amountCents: b.amountCents,
      categoryId: b.categoryId,
      description: str(b.description),
      payment: ['cash', 'transfer', 'paypal'].includes(b.payment) ? b.payment : null,
      receiptId: typeof b.receiptId === 'string' ? b.receiptId : null,
      personId: typeof b.personId === 'string' ? b.personId : null,
      paid: !(b.type === 'income' && b.paid === false),
      serviceDate: DATE_RE.test(b.serviceDate) ? b.serviceDate : null,
      km: typeof b.km === 'number' && b.km >= 0 ? b.km : null,
      kmRateCents: Number.isSafeInteger(b.kmRateCents) ? b.kmRateCents : null,
      createdAt: str(b.createdAt) || nowISO(),
      updatedAt: str(b.updatedAt) || str(b.createdAt) || nowISO(),
    });
  }

  const categories = arr(data.categories)
    .filter((c) => c && typeof c.id === 'string' && (c.type === 'income' || c.type === 'expense') && str(c.name))
    .map((c, i) => ({
      ...c,
      id: c.id,
      key: typeof c.key === 'string' ? c.key : null,
      type: c.type,
      name: c.name,
      euer: str(c.euer),
      mileage: !!c.mileage,
      businessPercent: Number.isFinite(c.businessPercent) && c.businessPercent > 0 && c.businessPercent <= 100 ? c.businessPercent : 100,
      order: Number.isFinite(c.order) ? c.order : i,
      updatedAt: str(c.updatedAt) || nowISO(),
    }));

  const contacts = arr(data.contacts)
    .filter((c) => c && typeof c.id === 'string' && str(c.name).trim())
    .map((c) => ({
      ...c,
      id: c.id,
      name: c.name.trim(),
      dog: str(c.dog).trim(),
      createdAt: str(c.createdAt) || nowISO(),
      updatedAt: str(c.updatedAt) || nowISO(),
    }));

  // Weitere Listen (ab Format 3); fehlen sie (altes Backup), bleiben die lokalen erhalten
  const records = {};
  for (const name of RECORD_STORES) {
    if (!Array.isArray(data[name])) continue;
    records[name] = data[name]
      .filter((x) => x && typeof x === 'object' && typeof x.id === 'string')
      .map((x) => ({ ...x, updatedAt: str(x.updatedAt) || nowISO() }));
  }

  const receipts = arr(data.receipts).filter((r) => r && typeof r.id === 'string' && typeof r.data === 'string');
  const tombstones = arr(data.tombstones).filter((t) => t && typeof t.id === 'string' && typeof t.deletedAt === 'string');

  let settings = null;
  if (data.settings && typeof data.settings === 'object') {
    settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const v = data.settings[key];
      if (v === undefined) continue;
      if (key === 'manualRevenue') {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          settings.manualRevenue = Object.fromEntries(Object.entries(v).filter(([y, c]) => /^\d{4}$/.test(y) && Number.isSafeInteger(c)));
        }
      } else if (DEFAULT_SETTINGS[key] === null || typeof v === typeof DEFAULT_SETTINGS[key]) {
        settings[key] = v;
      }
    }
  }

  return {
    exportedAt: str(data.exportedAt),
    format: data.format,
    records,
    bookings,
    categories,
    contacts,
    receipts,
    tombstones,
    settings,
    skipped,
  };
}

// ---------- Import: anwenden ----------

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
    await db.write(['bookings', 'categories', 'contacts', 'receipts', 'tombstones', 'meta', ...RECORD_STORES], (s) => {
      for (const [name, list] of Object.entries(backup.records)) {
        s[name].clear();
        for (const x of list) s[name].put(x);
      }
      s.bookings.clear();
      s.categories.clear();
      s.contacts.clear();
      s.receipts.clear();
      s.tombstones.clear();
      for (const b of backup.bookings) s.bookings.put(b);
      for (const c of backup.categories) s.categories.put(c);
      for (const c of backup.contacts) s.contacts.put(c);
      for (const r of receipts) s.receipts.put(r);
      for (const t of backup.tombstones) s.tombstones.put(t);
      if (backup.settings) s.meta.put({ key: 'settings', value: backup.settings });
    });
    result = { added: backup.bookings.length, updated: 0, removed: 0, total: backup.bookings.length };
  } else {
    result = await merge(backup, receipts);
  }

  await load();
  // Altes Backup ersetzt alles: neue Kategorien/Preisliste wieder ergänzen
  if (mode === 'replace' && (backup.format || 1) < 3) await ensureV3Defaults();
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

  const plan = { putB: [], delB: [], putC: [], delC: [], putR: [], delR: [] };
  let added = 0;
  let updated = 0;
  let removed = 0;

  // Buchungen
  const localB = new Map(state.bookings.map((b) => [b.id, b]));
  for (const b of backup.bookings) {
    const local = localB.get(b.id);
    if (deletedAfter(b.id, b.updatedAt)) continue;
    if (!local) { plan.putB.push(b); added++; } else if (b.updatedAt > local.updatedAt) { plan.putB.push(b); updated++; }
  }
  for (const local of state.bookings) {
    const incoming = backup.bookings.find((b) => b.id === local.id);
    const newest = incoming && incoming.updatedAt > local.updatedAt ? incoming : local;
    if (deletedAfter(local.id, newest.updatedAt)) { plan.delB.push(local.id); removed++; }
  }

  // Kategorien und Kund:innen: das jeweils Neuere gewinnt
  const mergeList = (localList, incomingList) => {
    const put = [];
    const del = [];
    const localMap = new Map(localList.map((x) => [x.id, x]));
    for (const x of incomingList) {
      const local = localMap.get(x.id);
      if (deletedAfter(x.id, x.updatedAt)) continue;
      if (!local || x.updatedAt > local.updatedAt) put.push(x);
    }
    for (const local of localList) {
      const incoming = incomingList.find((x) => x.id === local.id);
      const newest = incoming && incoming.updatedAt > local.updatedAt ? incoming : local;
      if (deletedAfter(local.id, newest.updatedAt)) del.push(local.id);
    }
    return { put, del };
  };
  const cats = mergeList(state.categories, backup.categories);
  plan.putC = cats.put;
  plan.delC = cats.del;
  const people = mergeList(state.contacts, backup.contacts);
  const recordPlans = Object.entries(backup.records).map(([name, list]) => [name, mergeList(state[name], list)]);

  // Fotos (ändern sich nie – ein neues Foto bekommt eine neue ID)
  const haveR = new Set(localReceiptIds);
  for (const r of receipts) {
    if (!haveR.has(r.id) && !tomb.has(r.id)) plan.putR.push(r);
  }
  for (const id of localReceiptIds) if (tomb.has(id)) plan.delR.push(id);

  // Einstellungen: die neueren gewinnen
  const takeSettings = backup.settings && (backup.settings.updatedAt || '') > (state.settings.updatedAt || '');

  await db.write(['bookings', 'categories', 'contacts', 'receipts', 'tombstones', 'meta', ...RECORD_STORES], (s) => {
    for (const [name, plan] of recordPlans) {
      for (const x of plan.put) s[name].put(x);
      for (const id of plan.del) s[name].delete(id);
    }
    for (const c of people.put) s.contacts.put(c);
    for (const id of people.del) s.contacts.delete(id);
    for (const b of plan.putB) s.bookings.put(b);
    for (const id of plan.delB) s.bookings.delete(id);
    for (const c of plan.putC) s.categories.put(c);
    for (const id of plan.delC) s.categories.delete(id);
    for (const r of plan.putR) s.receipts.put(r);
    for (const id of plan.delR) s.receipts.delete(id);
    for (const t of newTombs) s.tombstones.put(t);
    if (takeSettings) s.meta.put({ key: 'settings', value: backup.settings });
  });

  const total = state.bookings.length + added - removed;
  return { added, updated, removed, total };
}
