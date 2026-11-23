// Überstunden: Rechnen, Lesen und Anzeigen von Stunden.
//
// Je Monat werden erfasst: die tatsächlich gearbeiteten Stunden, die ausbezahlten
// Stunden (ohne AZK) und die Stunden, die vom Arbeitszeitkonto (AZK) ausbezahlt
// wurden – auf der Lohnabrechnung steht das als eigener Posten.
//
//   Überstunden des Monats  = gearbeitet − ausbezahlt
//   Veränderung des Stands  = Überstunden des Monats − AZK-Auszahlung
//   Stand                   = Übertrag (Einstellungen) + Summe aller Veränderungen bis dahin
//
// Eine AZK-Auszahlung baut also Überstunden ab, so wie Freizeitausgleich.
//
// Gespeichert wird in Minuten (ganze Zahlen) – so gibt es keine Rundungsfehler
// beim Aufsummieren, egal ob "172,5" oder "172:30" eingegeben wurde.

import { state } from './data.js';

// ---------- Eingabe lesen ----------

/**
 * Liest eine Stunden-Eingabe und gibt Minuten zurück (oder null, wenn ungültig).
 * Erlaubt: "172", "172,5", "172.25", "172:30", "172 Std.", "172h";
 * mit allowSign auch "+5", "-3,5", "−3:30".
 */
export function parseHours(input, { allowSign = false } = {}) {
  let s = String(input ?? '').trim().replace(/\s+/g, '').replace(/(std\.?|stunden|h)$/i, '');
  if (!s) return null;
  let sign = 1;
  if (/^[+\-−]/.test(s)) {
    if (!allowSign) return null;
    if (s[0] !== '+') sign = -1;
    s = s.slice(1);
  }
  let minutes;
  const hm = /^(\d{1,5}):(\d{1,2})$/.exec(s);
  if (hm) {
    if (Number(hm[2]) > 59) return null;
    minutes = Number(hm[1]) * 60 + Number(hm[2]);
  } else {
    const dec = /^(\d{0,5})(?:[.,](\d{1,2}))?$/.exec(s);
    if (!dec || (!dec[1] && !dec[2])) return null;
    minutes = Math.round(Number(`${dec[1] || '0'}.${dec[2] || '0'}`) * 60);
  }
  return sign * minutes;
}

// ---------- Anzeigen ----------

const dec = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** Anzeigeart aus den Einstellungen: 'decimal' (12,5 Std.) oder 'hm' (12:30 Std.) */
export function hoursFormat() {
  return state.settings.hoursFormat === 'hm' ? 'hm' : 'decimal';
}

/** Nur die Zahl ohne Vorzeichen: 750 → "12,5" bzw. "12:30" */
function number(abs, format) {
  if (format === 'hm') return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  return dec.format(Math.round((abs / 60) * 100) / 100);
}

/**
 * Minuten lesbar: 750 → "12,5 Std." (bzw. "12:30 Std.").
 * signed: mit Vorzeichen ("+12,5 Std.", "−3 Std."), unit: false ohne "Std."
 */
export function formatHours(minutes, { signed = false, unit = true, format = hoursFormat() } = {}) {
  const m = Math.round(minutes || 0);
  const sign = signed && m > 0 ? '+' : m < 0 ? '−' : '';
  return `${sign}${number(Math.abs(m), format)}${unit ? ' Std.' : ''}`;
}

/** Für Eingabefelder: 750 → "12,5" bzw. "12:30" (ohne Einheit) */
export function hoursToInput(minutes, format = hoursFormat()) {
  if (minutes == null) return '';
  return formatHours(minutes, { signed: minutes < 0, unit: false, format }).replace('−', '-');
}

// ---------- Monate ----------

/** "2026-11" → "2026-10" bzw. mit delta = +1 → "2026-12" */
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- Rechnen ----------

/** Alle erfassten Monate, älteste zuerst */
export function hoursSorted() {
  return [...state.hours].sort((a, b) => (a.month < b.month ? -1 : 1));
}

export function hoursFor(ym) {
  return state.hours.find((x) => x.month === ym) || null;
}

/** Überstunden des Monats: gearbeitet − ausbezahlt (ohne AZK) */
export const diffOf = (rec) => rec.workedMinutes - rec.paidMinutes;

/** Vom Arbeitszeitkonto ausbezahlte Stunden (ältere Einträge ohne Angabe: 0) */
export const azkOf = (rec) => (Number.isSafeInteger(rec.azkMinutes) ? rec.azkMinutes : 0);

/** Veränderung des Stands in diesem Monat: Überstunden minus AZK-Auszahlung */
export const changeOf = (rec) => diffOf(rec) - azkOf(rec);

export function startBalance() {
  return Number.isSafeInteger(state.settings.hoursStartMinutes) ? state.settings.hoursStartMinutes : 0;
}

/**
 * Alle Monate mit laufendem Stand, älteste zuerst:
 * [{ rec, month, diff, azk, change, balance }]
 *   diff = Überstunden des Monats, azk = AZK-Auszahlung, change = diff − azk,
 *   balance = Stand am Ende dieses Monats
 */
export function hoursRows(list = hoursSorted()) {
  let balance = startBalance();
  return list.map((rec) => {
    const diff = diffOf(rec);
    const azk = azkOf(rec);
    const change = diff - azk;
    balance += change;
    return { rec, month: rec.month, diff, azk, change, balance };
  });
}

/** Aktueller Stand: { minutes, lastMonth, count } */
export function hoursBalance() {
  const rows = hoursRows();
  const last = rows[rows.length - 1];
  return { minutes: last ? last.balance : startBalance(), lastMonth: last?.month || null, count: rows.length };
}

/** Stand am Ende eines Monats, wenn dieser Monat die angegebenen Werte hätte (für die Vorschau im Formular) */
export function balanceWith(ym, workedMinutes, paidMinutes, azkMinutes = 0) {
  const others = state.hours.filter((x) => x.month !== ym && x.month <= ym);
  return others.reduce((s, x) => s + changeOf(x), startBalance()) + (workedMinutes - paidMinutes - azkMinutes);
}

/** Jahr: Summen und Stand am Anfang/Ende */
export function hoursYear(year) {
  const y = String(year);
  const rows = hoursRows();
  const inYear = rows.filter((r) => r.month.startsWith(y));
  const before = rows.filter((r) => r.month < `${y}-01`);
  const startOfYear = before.length ? before[before.length - 1].balance : startBalance();
  const sum = (fn) => inYear.reduce((s, r) => s + fn(r), 0);
  return {
    year: Number(year),
    rows: inYear,
    worked: sum((r) => r.rec.workedMinutes),
    paid: sum((r) => r.rec.paidMinutes),
    diff: sum((r) => r.diff),     // Überstunden im Jahr
    azk: sum((r) => r.azk),       // vom AZK ausbezahlt
    change: sum((r) => r.change), // Veränderung des Stands im Jahr
    startOfYear,
    endOfYear: inYear.length ? inYear[inYear.length - 1].balance : startOfYear,
  };
}

/** Jahre mit erfassten Monaten (und das aktuelle), neueste zuerst */
export function hoursYears() {
  const years = new Set(state.hours.map((x) => Number(x.month.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/**
 * Monate, die fehlen: vom ersten erfassten Monat bis zum Vormonat
 * (der laufende Monat ist ja noch nicht vorbei). Älteste zuerst.
 */
export function missingMonths(currentYm) {
  const list = hoursSorted();
  if (!list.length) return [];
  const have = new Set(list.map((x) => x.month));
  const missing = [];
  const lastDone = shiftMonth(currentYm, -1);
  for (let ym = list[0].month; ym <= lastDone; ym = shiftMonth(ym, 1)) {
    if (!have.has(ym)) missing.push(ym);
  }
  return missing;
}

/** Welcher Monat soll ein neues Formular vorschlagen? Erst Lücken, dann der laufende Monat, dann der nächste freie. */
export function suggestedMonth(currentYm) {
  const missing = missingMonths(currentYm);
  if (missing.length) return missing[0];
  if (!state.hours.length) return shiftMonth(currentYm, -1);
  if (!hoursFor(currentYm)) return currentYm;
  let ym = currentYm;
  while (hoursFor(ym)) ym = shiftMonth(ym, 1);
  return ym;
}

/** Letzter erfasster Monat vor ym (z. B. um die ausbezahlten Stunden vorzuschlagen) */
export function previousRecord(ym) {
  const before = hoursSorted().filter((x) => x.month < ym);
  return before[before.length - 1] || null;
}
