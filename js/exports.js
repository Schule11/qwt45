// Export der Jahresauswertung als CSV (für Excel/Numbers) und als PDF.

import { categoryName } from './data.js';
import { yearReport } from './yearReport.js';
import { formatMoney, formatSigned, formatBalance, formatDate, todayISO, monthLabel, MONTHS } from './format.js';
import { hoursRows, startBalance, formatHours, hoursToInput } from './hours.js';
import { Pdf } from './pdf.js';

// ---------- CSV ----------
// Semikolon als Trenner, Komma als Dezimalzeichen, UTF-8 mit BOM:
// So öffnet deutsches Excel die Datei direkt richtig.

export function textCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // verhindert, dass Excel Text als Formel ausführt
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function moneyCell(cents) {
  if (cents == null) return '';
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function csvFile(rows, name) {
  const text = '﻿' + rows.map((r) => r.join(';')).join('\r\n') + '\r\n';
  return new File([text], name, { type: 'text/csv' });
}

/** Alle Buchungen eines Jahres, eine Zeile pro Buchung */
export function bookingsCsv(year) {
  const r = yearReport(year);
  const rows = [['Datum', 'Art', 'Kategorie', 'Beschreibung', 'Einnahme (EUR)', 'Ausgabe (EUR)', 'Beleg'].map(textCell)];
  for (const b of r.bookings) {
    rows.push([
      textCell(formatDate(b.date)),
      textCell(b.type === 'income' ? 'Einnahme' : 'Ausgabe'),
      textCell(categoryName(b.categoryId)),
      textCell(b.description),
      b.type === 'income' ? moneyCell(b.amountCents) : '',
      b.type === 'expense' ? moneyCell(b.amountCents) : '',
      textCell(b.receiptId ? 'ja' : ''),
    ]);
  }
  rows.push([]);
  rows.push(['', '', '', textCell('Summe'), moneyCell(r.totals.income), moneyCell(r.totals.expense), '']);
  return csvFile(rows, `haushaltsbuch-buchungen-${year}.csv`);
}

/** Summen pro Monat und pro Kategorie */
export function summaryCsv(year) {
  const r = yearReport(year);
  const rows = [];
  rows.push([textCell(`Haushaltsbuch ${year}`)]);
  rows.push([]);
  rows.push([textCell('Einnahmen'), moneyCell(r.totals.income)]);
  rows.push([textCell('Ausgaben'), moneyCell(r.totals.expense)]);
  rows.push([textCell('Saldo'), moneyCell(r.totals.balance)]);
  rows.push([]);
  rows.push(['Monat', 'Einnahmen (EUR)', 'Ausgaben (EUR)', 'Saldo (EUR)'].map(textCell));
  r.months.forEach((m, i) => rows.push([textCell(MONTHS[i]), moneyCell(m.income), moneyCell(m.expense), moneyCell(m.balance)]));
  rows.push([]);
  rows.push(['Kategorie', 'Art', 'Betrag (EUR)', 'Anzahl Buchungen'].map(textCell));
  for (const c of [...r.categories.income, ...r.categories.expense]) {
    rows.push([textCell(c.name), textCell(c.type === 'income' ? 'Einnahme' : 'Ausgabe'), moneyCell(c.cents), String(c.count)]);
  }
  return csvFile(rows, `haushaltsbuch-summen-${year}.csv`);
}

// ---------- PDF ----------

export const GREY = [0.42, 0.41, 0.39];
export const LIGHT = [0.85, 0.84, 0.82];
const GREEN = [0.08, 0.48, 0.27];
export const RED = [0.75, 0.22, 0.17];

export function reportPdf(year) {
  const r = yearReport(year);
  const pdf = new Pdf();
  const M = 48;                 // Rand
  const R = pdf.W - M;          // rechte Kante
  const BOTTOM = pdf.H - 60;    // unterste Schreibzeile
  let y = M;

  const newPage = (onNew) => { pdf.addPage(); y = M + 6; if (onNew) onNew(); };
  const ensure = (h, onNew) => { if (y + h > BOTTOM) newPage(onNew); };

  const heading = (text) => {
    ensure(60);
    y += 26;
    pdf.text(text, M, y, { size: 12.5, bold: true });
    y += 8;
    pdf.line(M, y, R, y, { color: LIGHT, width: 0.8 });
    y += 4;
  };

  const row = (label, amount, { bold = false, color = [0, 0, 0], count = null } = {}) => {
    ensure(18);
    y += 15;
    pdf.text(label, M, y, { size: 10, bold, maxWidth: count != null ? 330 : R - M - 90 });
    if (count != null) pdf.text(String(count), R - 110, y, { size: 10, align: 'right', color: GREY });
    pdf.text(amount, R, y, { size: 10, bold, align: 'right', color });
    y += 4;
  };

  // --- Kopf ---
  y += 14;
  pdf.text(`Haushaltsbuch ${year}`, M, y, { size: 18, bold: true });
  y += 17;
  pdf.text(`Jahresübersicht 01.01.${year} – 31.12.${year} · erstellt am ${formatDate(todayISO())}`, M, y, { size: 9, color: GREY });
  y += 20;

  // --- Ergebnis ---
  pdf.rect(M, y, R - M, 66, { fill: [0.955, 0.95, 0.94] });
  const resRow = (label, value, yy, opts = {}) => {
    pdf.text(label, M + 12, yy, { size: 10.5, bold: opts.bold });
    pdf.text(value, R - 12, yy, { size: opts.bold ? 12 : 10.5, bold: opts.bold, align: 'right', color: opts.color || [0, 0, 0] });
  };
  resRow('Einnahmen', formatMoney(r.totals.income), y + 18);
  resRow('Ausgaben', formatMoney(r.totals.expense), y + 35);
  resRow('Saldo', formatBalance(r.totals.balance), y + 56, { bold: true, color: r.totals.balance < 0 ? RED : [0, 0, 0] });
  y += 66;

  if (!r.bookings.length) {
    y += 30;
    pdf.text(`Für ${year} sind keine Buchungen erfasst.`, M, y, { size: 11, color: GREY });
  } else {
    // --- Kategorien ---
    const catTable = (title, list) => {
      if (!list.length) return;
      heading(title);
      y += 12;
      pdf.text('Kategorie', M, y, { size: 8.5, color: GREY });
      pdf.text('Buchungen', R - 110, y, { size: 8.5, color: GREY, align: 'right' });
      pdf.text('Betrag', R, y, { size: 8.5, color: GREY, align: 'right' });
      for (const c of list) row(c.name, formatMoney(c.cents), { count: c.count });
    };
    catTable('Einnahmen nach Kategorie', r.categories.income);
    catTable('Ausgaben nach Kategorie', r.categories.expense);

    // --- Monate ---
    heading('Monatsübersicht');
    const cols = [R - 220, R - 110, R];
    y += 12;
    pdf.text('Monat', M, y, { size: 8.5, color: GREY });
    ['Einnahmen', 'Ausgaben', 'Saldo'].forEach((t, i) => pdf.text(t, cols[i], y, { size: 8.5, color: GREY, align: 'right' }));
    r.months.forEach((m, i) => {
      ensure(18);
      y += 15;
      pdf.text(MONTHS[i], M, y, { size: 10 });
      pdf.text(m.income ? formatMoney(m.income) : '–', cols[0], y, { size: 10, align: 'right', color: m.income ? [0, 0, 0] : GREY });
      pdf.text(m.expense ? formatMoney(m.expense) : '–', cols[1], y, { size: 10, align: 'right', color: m.expense ? [0, 0, 0] : GREY });
      pdf.text(m.count ? formatBalance(m.balance) : '–', cols[2], y, { size: 10, align: 'right', color: m.count ? (m.balance < 0 ? RED : [0, 0, 0]) : GREY });
      y += 3;
    });
    y += 4;
    pdf.line(M, y, R, y, { color: LIGHT });
    y += 15;
    pdf.text('Summe', M, y, { size: 10, bold: true });
    pdf.text(formatMoney(r.totals.income), cols[0], y, { size: 10, bold: true, align: 'right' });
    pdf.text(formatMoney(r.totals.expense), cols[1], y, { size: 10, bold: true, align: 'right' });
    pdf.text(formatBalance(r.totals.balance), cols[2], y, { size: 10, bold: true, align: 'right' });

    // --- Einzelbuchungen ---
    const X = { date: M, cat: M + 58, desc: M + 182, receipt: M + 420 };
    const tableHead = () => {
      y += 12;
      pdf.text('Datum', X.date, y, { size: 8.5, color: GREY });
      pdf.text('Kategorie', X.cat, y, { size: 8.5, color: GREY });
      pdf.text('Beschreibung', X.desc, y, { size: 8.5, color: GREY });
      pdf.text('Beleg', X.receipt, y, { size: 8.5, color: GREY });
      pdf.text('Betrag', R, y, { size: 8.5, color: GREY, align: 'right' });
      y += 3;
    };
    heading(`Alle Buchungen ${year} (${r.bookings.length})`);
    tableHead();
    let month = null;
    for (const b of r.bookings) {
      const key = b.date.slice(0, 7);
      if (key !== month) {
        month = key;
        ensure(40, tableHead);
        y += 18;
        pdf.text(MONTHS[Number(b.date.slice(5, 7)) - 1], M, y, { size: 9.5, bold: true });
        y += 2;
      }
      ensure(16, tableHead);
      y += 13;
      pdf.text(formatDate(b.date), X.date, y, { size: 9 });
      pdf.text(categoryName(b.categoryId), X.cat, y, { size: 9, maxWidth: 118 });
      pdf.text(b.description, X.desc, y, { size: 9, maxWidth: 230 });
      pdf.text(b.receiptId ? 'ja' : '', X.receipt, y, { size: 9 });
      pdf.text(formatSigned(b.amountCents, b.type), R, y, { size: 9, align: 'right', color: b.type === 'income' ? GREEN : RED });
      y += 2;
    }
  }

  footer(pdf, `Haushaltsbuch ${year}`, M, R);
  const blob = pdf.toBlob({ title: `Haushaltsbuch ${year}`, author: 'Haushaltsbuch' });
  return new File([blob], `haushaltsbuch-${year}.pdf`, { type: 'application/pdf' });
}

/** Fußzeile mit Seitenzahl auf jeder Seite */
export function footer(pdf, label, M, R) {
  const total = pdf.pages.length;
  for (let i = 0; i < total; i++) {
    pdf.setPage(i);
    pdf.line(M, pdf.H - 40, R, pdf.H - 40, { color: LIGHT });
    pdf.text(label, M, pdf.H - 28, { size: 8, color: GREY });
    pdf.text(`Seite ${i + 1} von ${total}`, R, pdf.H - 28, { size: 8, color: GREY, align: 'right' });
  }
}

// ---------- Überstunden ----------

/** Alle erfassten Monate mit Differenz und laufendem Stand */
export function hoursCsv() {
  const rows = [['Monat', 'Gearbeitet (Std.)', 'Ausbezahlt (Std.)', 'Überstunden (Std.)', 'Vom AZK ausbezahlt (Std.)', 'Stand (Std.)', 'Notiz'].map(textCell)];
  // Zahlen immer als Dezimalzahl mit Komma – damit Excel/Numbers damit rechnen können
  const num = (sec) => hoursToInput(sec); // Kommazahl, zwei Nachkommastellen
  rows.push([textCell('Übertrag'), '', '', '', '', num(startBalance()), '']);
  for (const r of hoursRows()) {
    rows.push([textCell(monthLabel(r.month)), num(r.rec.workedSec), num(r.rec.paidSec), num(r.diff), num(r.azk), num(r.balance), textCell(r.rec.note)]);
  }
  rows.push([]);
  rows.push([textCell('Überstunden = gearbeitet − ausbezahlt; Stand = Übertrag + Überstunden − vom AZK ausbezahlt')]);
  return csvFile(rows, `haushaltsbuch-ueberstunden-${todayISO()}.csv`);
}

/** Übersicht aller Monate als PDF (z. B. für ein Gespräch mit dem Arbeitgeber) */
export function hoursPdf() {
  const rows = hoursRows();
  const pdf = new Pdf();
  const M = 48;
  const R = pdf.W - M;
  const BOTTOM = pdf.H - 60;
  const cols = [R - 316, R - 238, R - 158, R - 80, R]; // rechte Kanten: gearbeitet, ausbezahlt, Überstunden, AZK, Stand
  const fmt = (m, signed = false) => formatHours(m, { signed, unit: false });
  let y = M + 14;

  pdf.text('Überstunden', M, y, { size: 18, bold: true });
  y += 17;
  const last = rows[rows.length - 1];
  pdf.text(rows.length
    ? `${monthLabel(rows[0].month)} bis ${monthLabel(last.month)} · erstellt am ${formatDate(todayISO())}`
    : `erstellt am ${formatDate(todayISO())}`, M, y, { size: 9, color: GREY });
  y += 20;

  const balance = last ? last.balance : startBalance();
  pdf.rect(M, y, R - M, 40, { fill: [0.955, 0.95, 0.94] });
  pdf.text(last ? `Stand nach ${monthLabel(last.month)}` : 'Stand', M + 12, y + 25, { size: 11, bold: true });
  pdf.text(formatHours(balance, { signed: true }), R - 12, y + 25, { size: 13, bold: true, align: 'right', color: balance < 0 ? RED : [0, 0, 0] });
  y += 40;

  const tableHead = () => {
    y += 26;
    pdf.text('Monat', M, y, { size: 8.5, color: GREY });
    ['Gearbeitet', 'Ausbezahlt', 'Überstunden', 'Vom AZK', 'Stand'].forEach((t, i) => pdf.text(t, cols[i], y, { size: 8.5, color: GREY, align: 'right' }));
    y += 4;
    pdf.line(M, y, R, y, { color: LIGHT });
  };
  tableHead();
  y += 2;
  if (startBalance()) {
    y += 15;
    pdf.text('Übertrag', M, y, { size: 10, color: GREY });
    pdf.text(fmt(startBalance(), true), cols[4], y, { size: 10, align: 'right' });
  }
  let year = null;
  for (const r of rows) {
    const note = r.rec.note;
    if (y + (note ? 30 : 18) > BOTTOM) { pdf.addPage(); y = M; tableHead(); year = null; }
    if (r.month.slice(0, 4) !== year) {
      year = r.month.slice(0, 4);
      y += 18;
      pdf.text(year, M, y, { size: 9.5, bold: true });
    }
    y += 15;
    pdf.text(MONTHS[Number(r.month.slice(5)) - 1], M, y, { size: 10 });
    pdf.text(fmt(r.rec.workedSec), cols[0], y, { size: 10, align: 'right' });
    pdf.text(fmt(r.rec.paidSec), cols[1], y, { size: 10, align: 'right' });
    pdf.text(fmt(r.diff, true), cols[2], y, { size: 10, align: 'right', color: r.diff < 0 ? RED : [0, 0, 0] });
    pdf.text(r.azk ? fmt(-r.azk, true) : '–', cols[3], y, { size: 10, align: 'right', color: r.azk ? RED : GREY });
    pdf.text(fmt(r.balance, true), cols[4], y, { size: 10, bold: true, align: 'right', color: r.balance < 0 ? RED : [0, 0, 0] });
    if (note) {
      y += 11;
      pdf.text(note, M + 8, y, { size: 8, color: GREY, maxWidth: R - M - 8 });
    }
    y += 2;
  }
  if (!rows.length) {
    y += 24;
    pdf.text('Noch keine Monate erfasst.', M, y, { size: 11, color: GREY });
  }
  y += 26;
  if (y < BOTTOM) {
    pdf.text('Alle Angaben in Stunden. Überstunden = gearbeitet − ausbezahlt; Stand = Übertrag + Überstunden − vom AZK ausbezahlt.', M, y, { size: 8, color: GREY, maxWidth: R - M });
  }

  footer(pdf, 'Haushaltsbuch · Überstunden', M, R);
  const blob = pdf.toBlob({ title: 'Überstunden', author: 'Haushaltsbuch' });
  return new File([blob], `haushaltsbuch-ueberstunden-${todayISO()}.pdf`, { type: 'application/pdf' });
}
