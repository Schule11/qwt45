// Jahresabschluss-Assistent: prüft ein Jahr auf typische Lücken vor der Steuererklärung.
// Jeder Punkt hat einen Status: 'ok' (passt), 'todo' (bitte ansehen) oder 'checked'
// (von Hand als erledigt markiert). Die Oberfläche steht in views/closing.js.

import { state, isOpen, needsReceipt, categoryById, revenueFor, updateSettings, saveBooking, euerYear } from './data.js';
import { normalizeText, formatMoney, formatDateTime } from './format.js';
import { tradeTaxStatus } from './notices.js';
import { tripsOfYear } from './tripPdf.js';

// ---------- Gespeicherter Stand je Jahr (in den Einstellungen, also auch im Backup) ----------

export function closingState(year) {
  const c = state.settings.closing?.[String(year)];
  return { ack: {}, exportedAt: null, ...(c && typeof c === 'object' ? c : {}) };
}

async function patchClosing(year, patch) {
  const all = { ...(state.settings.closing || {}) };
  all[String(year)] = { ...closingState(year), ...patch };
  await updateSettings({ closing: all });
}

/** Punkt von Hand als erledigt markieren (oder wieder zurücknehmen) */
export function setAck(year, id, value) {
  const ack = { ...closingState(year).ack };
  if (value) ack[id] = new Date().toISOString();
  else delete ack[id];
  return patchClosing(year, { ack });
}

/** Merken, dass das Jahres-PDF erstellt wurde */
export function markExported(year) {
  return patchClosing(year, { exportedAt: new Date().toISOString() });
}

// ---------- 10-Tage-Regel ----------
//
// Regelmäßig wiederkehrende Zahlungen (Miete, Versicherung, Telefon, Beiträge …),
// die zwischen dem 22.12. und dem 10.01. bezahlt werden und in diesem Zeitraum fällig sind,
// zählen für das Jahr, zu dem sie wirtschaftlich gehören (§ 11 EStG).

const RECURRING_KEYS = ['platzmiete', 'versicherungen', 'telefon', 'gebuehren'];
const RECURRING_WORDS = /miete|pacht|versicher|telefon|handy|mobilfunk|internet|beitrag|beiträge|gebühr|abo\b|abonnement|lizenz|leasing|rundfunk|kfz-steuer|hosting|domain/i;

function recurringReason(b) {
  const cat = categoryById(b.categoryId);
  if (cat?.mileage) return null;
  if (cat && (RECURRING_KEYS.includes(cat.key) || RECURRING_WORDS.test(cat.name))) return cat.name;
  if (RECURRING_WORDS.test(b.description || '')) return 'wiederkehrend';
  const d = normalizeText(b.description || '');
  if (d.length < 3) return null;
  const months = new Set(state.bookings
    .filter((x) => x.type === 'expense' && normalizeText(x.description || '') === d)
    .map((x) => x.date.slice(0, 7)));
  return months.size >= 3 ? 'kommt regelmäßig vor' : null;
}

/** Zahlungen rund um die beiden Jahreswechsel, die das Jahr betreffen können */
export function tenDayCandidates(year) {
  const Y = Number(year);
  const windows = [
    { from: `${Y - 1}-12-22`, to: `${Y - 1}-12-31`, years: [Y - 1, Y] },
    { from: `${Y}-01-01`, to: `${Y}-01-10`, years: [Y - 1, Y] },
    { from: `${Y}-12-22`, to: `${Y}-12-31`, years: [Y, Y + 1] },
    { from: `${Y + 1}-01-01`, to: `${Y + 1}-01-10`, years: [Y, Y + 1] },
  ];
  const out = [];
  for (const b of state.bookings) {
    if (b.type !== 'expense' || isOpen(b)) continue;
    const w = windows.find((win) => b.date >= win.from && b.date <= win.to);
    if (!w) continue;
    const reason = recurringReason(b);
    if (!reason) continue;
    out.push({ booking: b, years: w.years, reason, decided: Number.isInteger(b.euerYear), assigned: euerYear(b) });
  }
  return out.sort((a, b) => (a.booking.date < b.booking.date ? -1 : 1));
}

/** Zuordnung festlegen: zu welchem Jahr gehört die Zahlung? */
export function assignYear(booking, year) {
  return saveBooking({ ...booking, euerYear: Number(year) });
}

// ---------- Die Prüfpunkte ----------

export function openOfYear(year) {
  const end = `${year}-12-31`;
  return state.bookings.filter((b) => isOpen(b) && (b.serviceDate || b.date) <= end);
}

export function receiptsMissing(year) {
  return state.bookings.filter((b) => needsReceipt(b) && euerYear(b) === Number(year));
}

export function tripsIncomplete(year) {
  return tripsOfYear(year).filter((b) => !b.tripTo || !b.tripPurpose);
}

/** Wurde seit dem letzten Backup etwas geändert? */
function backupCurrent() {
  const last = state.local.lastBackupAt;
  if (!last) return { ok: false, last: null };
  const changed = state.bookings.length !== state.local.bookingsAtLastBackup || state.bookings.some((b) => b.updatedAt > last);
  return { ok: !changed, last };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function closingChecks(year) {
  const Y = Number(year);
  const cs = closingState(Y);
  const items = [];
  const add = (item) => {
    const checked = item.status === 'todo' && item.canAck !== false && cs.ack[item.id];
    items.push({ ...item, status: checked ? 'checked' : item.status });
  };

  // 1. Offene Zahlungen
  const open = openOfYear(Y);
  const openSum = open.reduce((s, b) => s + b.amountCents, 0);
  add({
    id: 'open',
    title: 'Offene Zahlungen',
    status: open.length ? 'todo' : 'ok',
    text: open.length
      ? `${plural(open.length, 'Zahlung', 'Zahlungen')} über ${formatMoney(openSum)} ${open.length === 1 ? 'ist' : 'sind'} noch offen. `
        + `Was bis 31.12. nicht bezahlt ist, zählt erst im Jahr des Geldeingangs. Bitte nachhaken oder als bezahlt abhaken.`
      : `Keine offenen Zahlungen aus ${Y}.`,
    ackLabel: 'Geprüft – kommt später',
    count: open.length,
  });

  // 2. Belege
  const noReceipt = receiptsMissing(Y);
  add({
    id: 'receipts',
    title: 'Belege',
    status: noReceipt.length ? 'todo' : 'ok',
    text: noReceipt.length
      ? `${plural(noReceipt.length, 'Ausgabe', 'Ausgaben')} ohne Beleg. Foto oder PDF ergänzen. Gibt es keinen Beleg (z. B. Parkautomat), `
        + 'schreib einen Eigenbeleg mit Datum, Betrag, Empfänger, Anlass und Unterschrift.'
      : `Alle Ausgaben ${Y} haben einen Beleg.`,
    ackLabel: 'Geprüft – Eigenbelege liegen vor',
    count: noReceipt.length,
  });

  // 3. Fahrten
  const trips = tripsOfYear(Y);
  const incomplete = tripsIncomplete(Y);
  add({
    id: 'trips',
    title: 'Fahrten',
    status: incomplete.length ? 'todo' : 'ok',
    text: !trips.length
      ? `Keine Fahrten in ${Y} erfasst.`
      : incomplete.length
        ? `Bei ${plural(incomplete.length, 'Fahrt', 'Fahrten')} fehlen Ziel oder Zweck. Das Finanzamt fragt danach, wenn es die Fahrtkosten prüft.`
        : `${plural(trips.length, 'Fahrt', 'Fahrten')}, alle mit Ziel und Zweck.`,
    ackLabel: 'Geprüft',
    count: incomplete.length,
  });

  // 4. 10-Tage-Regel
  const tenDay = tenDayCandidates(Y);
  const undecided = tenDay.filter((c) => !c.decided);
  add({
    id: 'tenday',
    title: '10-Tage-Regel',
    status: undecided.length ? 'todo' : 'ok',
    text: !tenDay.length
      ? 'Keine wiederkehrenden Zahlungen rund um den Jahreswechsel.'
      : undecided.length
        ? `${plural(undecided.length, 'Zahlung', 'Zahlungen')} rund um den Jahreswechsel (z. B. Miete oder Versicherung). Bitte festlegen, zu welchem Jahr sie gehören.`
        : `${plural(tenDay.length, 'Zahlung', 'Zahlungen')} rund um den Jahreswechsel zugeordnet.`,
    canAck: false,
    count: undecided.length,
  });

  // 5. Kleinunternehmer
  const rev = revenueFor(Y);
  const lp = state.settings.limitPrevYearCents;
  add({
    id: 'smallbiz',
    title: 'Kleinunternehmerregelung',
    status: rev.cents > lp ? 'todo' : 'ok',
    text: rev.cents > lp
      ? `Umsatz ${Y}: ${formatMoney(rev.cents)} – über ${formatMoney(lp)}. Ab ${Y + 1} giltst du voraussichtlich nicht mehr als Kleinunternehmer:in `
        + 'und musst Umsatzsteuer berechnen. Bitte mit Steuerberatung klären.'
      : `Umsatz ${Y}: ${formatMoney(rev.cents)} – unter ${formatMoney(lp)}. Die Kleinunternehmerregelung gilt auch ${Y + 1} weiter `
        + '(solange du dann unter 100.000 € bleibst). Eine Umsatzsteuererklärung ist seit 2024 in der Regel nicht mehr nötig.',
    ackLabel: 'Mit Steuerberatung geklärt',
  });

  // 6. Gewerbesteuer
  const tt = tradeTaxStatus(Y);
  add({
    id: 'tradetax',
    title: 'Gewerbesteuer',
    status: tt.profit > tt.allowance ? 'todo' : 'ok',
    text: tt.profit > tt.allowance
      ? `Gewinn ${Y}: ${formatMoney(tt.profit)} – über dem Freibetrag von ${formatMoney(tt.allowance)}. Eine Gewerbesteuererklärung ist nötig. `
        + `Geschätzt ${formatMoney(tt.estimate.tax)} Gewerbesteuer, davon bis zu ${formatMoney(tt.estimate.credit)} auf die Einkommensteuer anrechenbar.`
      : `Gewinn ${Y}: ${formatMoney(tt.profit)} – unter dem Freibetrag von ${formatMoney(tt.allowance)}. Keine Gewerbesteuer, `
        + 'eine Gewerbesteuererklärung ist in der Regel nicht nötig.',
    ackLabel: 'Erklärung erledigt',
  });

  // 7. Backup
  const bk = backupCurrent();
  add({
    id: 'backup',
    title: 'Backup',
    status: bk.ok ? 'ok' : 'todo',
    text: bk.ok
      ? `Letztes Backup am ${formatDateTime(bk.last)} – seitdem keine Änderungen.`
      : bk.last
        ? `Seit dem letzten Backup (${formatDateTime(bk.last)}) hat sich etwas geändert. Sichere deine Daten, bevor du das Jahr abschließt.`
        : 'Noch kein Backup gemacht. Sichere deine Daten, bevor du das Jahr abschließt.',
    canAck: false,
  });

  // 8. Unterlagen
  add({
    id: 'export',
    title: 'Unterlagen erstellen',
    status: cs.exportedAt ? 'ok' : 'todo',
    text: cs.exportedAt
      ? `Jahres-PDF erstellt am ${formatDateTime(cs.exportedAt).split(',')[0]}. Ändert sich noch etwas, erstelle es einfach neu.`
      : 'Erstelle die Jahresübersicht als PDF und lege sie mit deinen Belegen ab – oder gib sie deiner Steuerberatung. '
        + (trips.length ? 'Die Fahrtenliste gehört dazu.' : ''),
    canAck: false,
  });

  const done = items.filter((i) => i.status !== 'todo').length;
  return { year: Y, items, done, total: items.length };
}
