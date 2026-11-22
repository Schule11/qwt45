// Export der Jahresauswertung als CSV (für Excel/Numbers) und als PDF.

import { state, categoryName, categoryById, contactById, contactLabel, recordById, isShiftedYear } from './data.js';
import { paymentLabel, euerPostenFor } from './defaults.js';
import { yearReport } from './yearReport.js';
import { formatMoney, formatSigned, formatProfit, formatDate, formatKm, todayISO, MONTHS } from './format.js';
import { Pdf } from './pdf.js';
import { getLogo } from './logo.js';

export { preloadLogo } from './logo.js';

// ---------- CSV ----------
// Semikolon als Trenner, Komma als Dezimalzeichen, UTF-8 mit BOM:
// So öffnet deutsches Excel die Datei direkt richtig.

function textCell(value) {
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

function csvFile(rows, name) {
  const text = '﻿' + rows.map((r) => r.join(';')).join('\r\n') + '\r\n';
  return new File([text], name, { type: 'text/csv' });
}

function invoiceNumber(b) {
  const inv = recordById('invoices', b.invoiceId);
  return inv && !inv.cancelled ? inv.number : '';
}

/** Alle Buchungen eines Jahres, eine Zeile pro Buchung */
export function bookingsCsv(year) {
  const r = yearReport(year);
  const rows = [[
    'Datum', 'Art', 'Kategorie', 'EÜR-Posten', 'Kund:in', 'Beschreibung', 'Zahlungsart', 'Einnahme (EUR)', 'Ausgabe (EUR)',
    'Rechnungsbetrag (EUR)', 'Betrieblicher Anteil (%)', 'Kilometer', 'Ziel', 'Zweck', 'Beleg', 'Rechnung/Quittung',
  ].map(textCell)];
  for (const b of r.bookings) {
    rows.push([
      textCell(formatDate(b.date)),
      textCell(b.type === 'income' ? 'Einnahme' : 'Ausgabe'),
      textCell(categoryName(b.categoryId)),
      textCell(euerPostenFor(categoryById(b.categoryId))),
      textCell(contactLabel(contactById(b.personId))),
      textCell([b.description, isShiftedYear(b) ? `10-Tage-Regel: zählt für ${year}` : null].filter(Boolean).join(' – ')),
      textCell(paymentLabel(b.payment)),
      b.type === 'income' ? moneyCell(b.amountCents) : '',
      b.type === 'expense' ? moneyCell(b.amountCents) : '',
      b.businessPercent && b.businessPercent < 100 ? moneyCell(b.fullAmountCents) : '',
      b.businessPercent && b.businessPercent < 100 ? String(b.businessPercent) : '',
      b.km ? formatKm(b.km) : '',
      textCell(b.tripTo || ''),
      textCell(b.tripPurpose || ''),
      textCell(b.receiptId ? 'ja' : ''),
      textCell(invoiceNumber(b)),
    ]);
  }
  rows.push([]);
  rows.push(['', '', '', '', '', textCell('Summe'), '', moneyCell(r.totals.income), moneyCell(r.totals.expense), '', '', '', '', '', '', '']);
  return csvFile(rows, `hundeschule-buchungen-${year}.csv`);
}

/** Summen pro EÜR-Posten, pro Kategorie und pro Monat */
export function summaryCsv(year) {
  const r = yearReport(year);
  const rows = [];
  rows.push([textCell(`Einnahmenüberschussrechnung ${year}`), textCell(state.settings.businessName || '')]);
  rows.push([textCell('Kleinunternehmer nach § 19 UStG, alle Beträge brutto (wie bezahlt)')]);
  rows.push([]);
  rows.push(['EÜR-Posten', 'Art', 'Betrag (EUR)', 'Enthaltene Kategorien'].map(textCell));
  for (const p of r.posten) {
    rows.push([textCell(p.name), textCell(p.type === 'income' ? 'Einnahme' : 'Ausgabe'), moneyCell(p.cents), textCell(p.categories.join(', '))]);
  }
  rows.push([]);
  rows.push([textCell('Summe Betriebseinnahmen'), '', moneyCell(r.totals.income)]);
  rows.push([textCell('Summe Betriebsausgaben'), '', moneyCell(r.totals.expense)]);
  rows.push([textCell(r.totals.profit < 0 ? 'Verlust' : 'Gewinn'), '', moneyCell(r.totals.profit)]);
  rows.push([]);
  rows.push(['Kategorie', 'Art', 'Betrag (EUR)', 'Anzahl Buchungen', 'EÜR-Posten'].map(textCell));
  for (const c of [...r.categories.income, ...r.categories.expense]) {
    rows.push([textCell(c.name), textCell(c.type === 'income' ? 'Einnahme' : 'Ausgabe'), moneyCell(c.cents), String(c.count), textCell(c.posten)]);
  }
  rows.push([]);
  rows.push(['Monat', 'Einnahmen (EUR)', 'Ausgaben (EUR)', 'Ergebnis (EUR)'].map(textCell));
  r.months.forEach((m, i) => rows.push([textCell(MONTHS[i]), moneyCell(m.income), moneyCell(m.expense), moneyCell(m.profit)]));
  if (r.persons.length) {
    rows.push([]);
    rows.push(['Kund:in', 'Einnahmen (EUR)', 'Anzahl Zahlungen'].map(textCell));
    for (const p of r.persons) rows.push([textCell(p.label), moneyCell(p.cents), String(p.count)]);
  }
  return csvFile(rows, `hundeschule-summen-${year}.csv`);
}

// ---------- PDF ----------

const GREY = [0.42, 0.41, 0.39];
const LIGHT = [0.85, 0.84, 0.82];
const GREEN = [0.08, 0.48, 0.27];
const RED = [0.75, 0.22, 0.17];

export function reportPdf(year) {
  const r = yearReport(year);
  const pdf = new Pdf();
  const M = 48;                 // Rand
  const R = pdf.W - M;          // rechte Kante
  const BOTTOM = pdf.H - 60;    // unterste Schreibzeile
  const business = state.settings.businessName || 'Hundeschule';
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

  const row = (label, amount, { bold = false, color = [0, 0, 0], sub = null, count = null } = {}) => {
    ensure(sub ? 30 : 18);
    y += 15;
    pdf.text(label, M, y, { size: 10, bold, maxWidth: count != null ? 330 : R - M - 90 });
    if (count != null) pdf.text(String(count), R - 110, y, { size: 10, align: 'right', color: GREY });
    pdf.text(amount, R, y, { size: 10, bold, align: 'right', color });
    if (sub) {
      y += 11;
      pdf.text(sub, M + 8, y, { size: 8, color: GREY, maxWidth: 400 });
    }
    y += 4;
  };

  // --- Kopf ---
  const logo = getLogo();
  if (logo?.bytes) {
    pdf.setImage(logo.bytes, logo.width, logo.height);
    const lw = 84;
    const lh = (lw * logo.height) / logo.width;
    pdf.drawImage(R - lw, M - 8, lw, lh);
  }
  y += 14;
  pdf.text(`Einnahmenüberschussrechnung ${year}`, M, y, { size: 18, bold: true });
  y += 19;
  pdf.text(business, M, y, { size: 11 });
  y += 15;
  pdf.text(`Zeitraum 01.01.${year} – 31.12.${year} · erstellt am ${formatDate(todayISO())}`, M, y, { size: 9, color: GREY });
  y += 12;
  pdf.text('Umsatzsteuerlicher Kleinunternehmer (§ 19 UStG) · alle Beträge brutto, wie bezahlt', M, y, { size: 9, color: GREY });
  y += 20;

  // --- Ergebnis ---
  pdf.rect(M, y, R - M, 66, { fill: [0.955, 0.95, 0.94] });
  const resRow = (label, value, yy, opts = {}) => {
    pdf.text(label, M + 12, yy, { size: 10.5, bold: opts.bold });
    pdf.text(value, R - 12, yy, { size: opts.bold ? 12 : 10.5, bold: opts.bold, align: 'right', color: opts.color || [0, 0, 0] });
  };
  resRow('Betriebseinnahmen', formatMoney(r.totals.income), y + 18);
  resRow('Betriebsausgaben', formatMoney(r.totals.expense), y + 35);
  resRow(r.totals.profit < 0 ? 'Verlust' : 'Gewinn', formatProfit(r.totals.profit), y + 56, { bold: true, color: r.totals.profit < 0 ? RED : [0, 0, 0] });
  y += 66;
  if (r.open.count) {
    y += 14;
    pdf.text(`Nicht enthalten: ${r.open.count} noch offene ${r.open.count === 1 ? 'Zahlung' : 'Zahlungen'} über ${formatMoney(r.open.cents)} `
      + '(zählen erst im Jahr, in dem das Geld eingeht).', M, y, { size: 8.5, color: GREY, maxWidth: R - M });
  }

  if (!r.bookings.length) {
    y += 30;
    pdf.text(`Für ${year} sind keine Buchungen erfasst.`, M, y, { size: 11, color: GREY });
  } else {
    // --- Übertrag in die Anlage EÜR ---
    heading('Übertrag in die Anlage EÜR');
    y += 11;
    pdf.text('Die Zeilennummern ändern sich jährlich – die Posten heißen im Formular (und in ELSTER) so wie hier.', M, y, { size: 8.5, color: GREY });
    y += 6;
    for (const p of r.posten) {
      row(p.name, formatMoney(p.cents), { sub: `Kategorien: ${p.categories.join(', ')}` });
    }
    y += 4;
    pdf.line(M, y, R, y, { color: LIGHT });
    row('Summe Betriebseinnahmen', formatMoney(r.totals.income), { bold: true });
    row('Summe Betriebsausgaben', formatMoney(r.totals.expense), { bold: true });
    row(r.totals.profit < 0 ? 'Verlust' : 'Gewinn', formatProfit(r.totals.profit), { bold: true });

    // --- Kategorien ---
    const catTable = (title, list) => {
      if (!list.length) return;
      heading(title);
      y += 12;
      pdf.text('Kategorie', M, y, { size: 8.5, color: GREY });
      pdf.text('Buchungen', R - 110, y, { size: 8.5, color: GREY, align: 'right' });
      pdf.text('Betrag', R, y, { size: 8.5, color: GREY, align: 'right' });
      for (const c of list) {
        const label = c.km ? `${c.name} (${formatKm(c.km)} km)` : c.name;
        row(label, formatMoney(c.cents), { count: c.count });
      }
    };
    catTable('Einnahmen nach Kategorie', r.categories.income);
    catTable('Ausgaben nach Kategorie', r.categories.expense);

    // --- Monate ---
    heading('Monatsübersicht');
    const cols = [R - 220, R - 110, R];
    y += 12;
    pdf.text('Monat', M, y, { size: 8.5, color: GREY });
    ['Einnahmen', 'Ausgaben', 'Ergebnis'].forEach((t, i) => pdf.text(t, cols[i], y, { size: 8.5, color: GREY, align: 'right' }));
    r.months.forEach((m, i) => {
      ensure(18);
      y += 15;
      pdf.text(MONTHS[i], M, y, { size: 10 });
      pdf.text(m.income ? formatMoney(m.income) : '–', cols[0], y, { size: 10, align: 'right', color: m.income ? [0, 0, 0] : GREY });
      pdf.text(m.expense ? formatMoney(m.expense) : '–', cols[1], y, { size: 10, align: 'right', color: m.expense ? [0, 0, 0] : GREY });
      pdf.text(m.count ? formatProfit(m.profit) : '–', cols[2], y, { size: 10, align: 'right', color: m.count ? (m.profit < 0 ? RED : [0, 0, 0]) : GREY });
      y += 3;
    });
    y += 4;
    pdf.line(M, y, R, y, { color: LIGHT });
    y += 15;
    pdf.text('Summe', M, y, { size: 10, bold: true });
    pdf.text(formatMoney(r.totals.income), cols[0], y, { size: 10, bold: true, align: 'right' });
    pdf.text(formatMoney(r.totals.expense), cols[1], y, { size: 10, bold: true, align: 'right' });
    pdf.text(formatProfit(r.totals.profit), cols[2], y, { size: 10, bold: true, align: 'right' });

    // --- Einzelbuchungen ---
    const X = { date: M, cat: M + 58, desc: M + 168, pay: M + 352, receipt: M + 414 };
    const tableHead = () => {
      y += 12;
      pdf.text('Datum', X.date, y, { size: 8.5, color: GREY });
      pdf.text('Kategorie', X.cat, y, { size: 8.5, color: GREY });
      pdf.text('Beschreibung', X.desc, y, { size: 8.5, color: GREY });
      pdf.text('Zahlung', X.pay, y, { size: 8.5, color: GREY });
      pdf.text('Beleg', X.receipt, y, { size: 8.5, color: GREY });
      pdf.text('Betrag', R, y, { size: 8.5, color: GREY, align: 'right' });
      y += 3;
    };
    heading(`Alle Buchungen ${year} (${r.bookings.length})`);
    tableHead();
    let month = null;
    for (const b of r.bookings) {
      const m = Number(b.date.slice(5, 7));
      const key = b.date.slice(0, 7);
      if (key !== month) {
        month = key;
        ensure(40, tableHead);
        y += 18;
        const dy = Number(b.date.slice(0, 4));
        pdf.text(dy === Number(year) ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${dy} (10-Tage-Regel)`, M, y, { size: 9.5, bold: true });
        y += 2;
      }
      ensure(16, () => { tableHead(); });
      y += 13;
      pdf.text(formatDate(b.date), X.date, y, { size: 9 });
      pdf.text(categoryName(b.categoryId), X.cat, y, { size: 9, maxWidth: 104 });
      const person = contactById(b.personId)?.name;
      let desc = [person, b.tripTo ? `Fahrt: ${b.tripTo}` : null, b.tripPurpose, b.description].filter(Boolean).join(' – ');
      if (b.km) desc = `${desc} (${formatKm(b.km)} km)`.trim();
      if (b.businessPercent && b.businessPercent < 100) desc = [`${b.businessPercent} % von ${formatMoney(b.fullAmountCents)}`, desc].filter(Boolean).join(' – ');
      if (isShiftedYear(b)) desc = [`10-Tage-Regel: zählt für ${year}`, desc].filter(Boolean).join(' – ');
      pdf.text(desc, X.desc, y, { size: 9, maxWidth: 178 });
      pdf.text(paymentLabel(b.payment), X.pay, y, { size: 9, maxWidth: 58 });
      pdf.text(b.receiptId ? 'ja' : '', X.receipt, y, { size: 9 });
      pdf.text(formatSigned(b.amountCents, b.type), R, y, { size: 9, align: 'right', color: b.type === 'income' ? GREEN : RED });
      y += 2;
    }
  }

  // --- Hinweis am Ende ---
  ensure(40);
  y += 30;
  pdf.text('Erstellt mit der Hundeschule-App. Ohne Gewähr – bitte die Zuordnung zu den Posten der Anlage EÜR vor der Abgabe prüfen.', M, y, { size: 8, color: GREY, maxWidth: R - M });

  // --- Fußzeile auf jeder Seite ---
  const total = pdf.pages.length;
  for (let i = 0; i < total; i++) {
    pdf.setPage(i);
    pdf.line(M, pdf.H - 40, R, pdf.H - 40, { color: LIGHT });
    pdf.text(`${business} · Einnahmenüberschussrechnung ${year}`, M, pdf.H - 28, { size: 8, color: GREY });
    pdf.text(`Seite ${i + 1} von ${total}`, R, pdf.H - 28, { size: 8, color: GREY, align: 'right' });
  }

  const blob = pdf.toBlob({ title: `Einnahmenüberschussrechnung ${year}`, author: business });
  return new File([blob], `hundeschule-euer-${year}.pdf`, { type: 'application/pdf' });
}
