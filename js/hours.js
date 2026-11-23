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
// Eingabe: gearbeitet als Stunden:Minuten (8:56), ausbezahlt und AZK als Kommazahl
// mit höchstens zwei Nachkommastellen (8,93) – so, wie es auf der Abrechnung steht.
// Anzeige: immer als Kommazahl.
//
// Gespeichert und gerechnet wird in SEKUNDEN (ganze Zahlen): 1 Minute = 60 s,
// 0,01 Stunden = 36 s. Beide Eingabeformate gehen darin exakt auf – es gibt beim
// Rechnen keine Rundung, gerundet wird erst bei der Anzeige (auf zwei Nachkommastellen).

import { state } from './data.js';

export const HOUR = 3600;
const HUNDREDTH = 36; // 0,01 Stunden in Sekunden
const MINUTE = 60;

// ---------- Eingabe lesen ----------

/**
 * Kommazahl (oder ersatzweise Std:Min) lesen und Sekunden zurückgeben – oder null, wenn ungültig.
 * Erlaubt: "172", "172,78", "172.78", ",5", "160:30", "172 Std."; mit allowSign auch "+5", "-3,5", "−2:30".
 * Mehr als zwei Nachkommastellen sind ungültig (auf der Abrechnung stehen höchstens zwei).
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
  const hm = /^(\d{1,5}):(\d{1,2})$/.exec(s);
  if (hm) {
    if (Number(hm[2]) > 59) return null;
    return sign * (Number(hm[1]) * HOUR + Number(hm[2]) * MINUTE);
  }
  const dec = /^(\d{0,5})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!dec || (!dec[1] && !dec[2])) return null;
  const hundredths = Number(dec[1] || '0') * 100 + Number((dec[2] || '0').padEnd(2, '0'));
  return sign * hundredths * HUNDREDTH;
}

/**
 * Stunden und Minuten aus zwei Feldern lesen ("172" und "47") → Sekunden, oder null.
 * Ein leeres Feld zählt als 0; beide leer = keine Eingabe (null).
 */
export function parseHM(hours, minutes) {
  const hStr = String(hours ?? '').trim();
  const mStr = String(minutes ?? '').trim();
  if (!hStr && !mStr) return null;
  if ((hStr && !/^\d{1,4}$/.test(hStr)) || (mStr && !/^\d{1,2}$/.test(mStr))) return null;
  const m = Number(mStr || 0);
  if (m > 59) return null;
  return Number(hStr || 0) * HOUR + m * MINUTE;
}

// ---------- Anzeigen ----------

const dec = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/** Auf zwei Nachkommastellen gerundete Stunden (für Anzeige und CSV) */
export function roundedHours(seconds) {
  return Math.round((seconds || 0) / HUNDREDTH) / 100;
}

/**
 * Sekunden als Kommazahl: 45000 → "12,5 Std.".
 * signed: mit Vorzeichen ("+12,5 Std.", "−3 Std."; gerundet 0 ohne Vorzeichen), unit: false ohne "Std."
 */
export function formatHours(seconds, { signed = false, unit = true } = {}) {
  const value = roundedHours(seconds);
  const sign = signed && value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${dec.format(Math.abs(value))}${unit ? ' Std.' : ''}`;
}

/** Für Eingabefelder (Kommazahl, ohne Einheit): 45000 → "12,5", −9000 → "-2,5" */
export function hoursToInput(seconds) {
  if (seconds == null) return '';
  return formatHours(seconds, { signed: seconds < 0, unit: false }).replace('−', '-');
}

/** Für die beiden Felder Std. und Min.: 621960 → { h: "172", m: "46" } */
export function splitHM(seconds) {
  if (seconds == null) return { h: '', m: '' };
  const totalMin = Math.round(seconds / MINUTE);
  return { h: String(Math.floor(totalMin / 60)), m: String(totalMin % 60).padStart(2, '0') };
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

/** Überstunden des Monats in Sekunden: gearbeitet − ausbezahlt (ohne AZK) */
export const diffOf = (rec) => rec.workedSec - rec.paidSec;

/** Vom Arbeitszeitkonto ausbezahlt (Sekunden; fehlt die Angabe: 0) */
export const azkOf = (rec) => (Number.isSafeInteger(rec.azkSec) ? rec.azkSec : 0);

/** Veränderung des Stands in diesem Monat: Überstunden minus AZK-Auszahlung */
export const changeOf = (rec) => diffOf(rec) - azkOf(rec);

/** Übertrag vor dem ersten erfassten Monat (Sekunden) */
export function startBalance() {
  return Number.isSafeInteger(state.settings.hoursStartSec) ? state.settings.hoursStartSec : 0;
}

/**
 * Alle Monate mit laufendem Stand, älteste zuerst (alle Werte in Sekunden):
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

/** Aktueller Stand: { seconds, lastMonth, count } */
export function hoursBalance() {
  const rows = hoursRows();
  const last = rows[rows.length - 1];
  return { seconds: last ? last.balance : startBalance(), lastMonth: last?.month || null, count: rows.length };
}

/** Stand am Ende eines Monats, wenn dieser Monat die angegebenen Werte hätte (für die Vorschau im Formular) */
export function balanceWith(ym, workedSec, paidSec, azkSec = 0) {
  const others = state.hours.filter((x) => x.month !== ym && x.month <= ym);
  return others.reduce((s, x) => s + changeOf(x), startBalance()) + (workedSec - paidSec - azkSec);
}

/** Jahr: Summen und Stand am Anfang/Ende (Sekunden) */
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
    worked: sum((r) => r.rec.workedSec),
    paid: sum((r) => r.rec.paidSec),
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
