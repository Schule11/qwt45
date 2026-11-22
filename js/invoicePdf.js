// PDF für Rechnung und Quittung (A4, Anschrift passend für Fensterumschläge).
// Enthält die Pflichtangaben für Kleinunternehmer: Name und Anschrift beider
// Seiten, Datum, fortlaufende Nummer, Leistung und Menge, Betrag, Leistungsdatum
// und den Hinweis auf § 19 UStG.

import { Pdf } from './pdf.js';
import { getLogo } from './logo.js';
import { formatMoney, formatDate, formatIban } from './format.js';
import { KIND_LABEL } from './invoices.js';

const GREY = [0.42, 0.41, 0.39];
const LIGHT = [0.85, 0.84, 0.82];
const RED = [0.77, 0.17, 0.24];
const mm = (v) => v * 2.8346;

const qtyText = (q) => String(Math.round(Number(q) * 100) / 100).replace('.', ',');

export function invoicePdf(inv) {
  const pdf = new Pdf();
  const s = inv.seller || {};
  const L = mm(25);              // linker Rand (DIN 5008)
  const R = pdf.W - mm(20);      // rechter Rand
  const isReceipt = inv.kind === 'receipt';
  const label = KIND_LABEL[inv.kind] || 'Rechnung';
  const sellerName = s.businessName || s.ownerName || '';
  const cityLine = [s.zip, s.city].filter(Boolean).join(' ');

  // --- Kopf: Logo rechts, Absender links ---
  const logo = getLogo();
  if (logo) {
    pdf.setImage(logo.bytes, logo.width, logo.height);
    const lw = 120;
    pdf.drawImage(R - lw, mm(12), lw, (lw * logo.height) / logo.width);
  }
  let y = mm(20);
  pdf.text(sellerName, L, y, { size: 15, bold: true });
  y += 15;
  for (const line of [s.businessName && s.ownerName ? s.ownerName : null, s.street, cityLine].filter(Boolean)) {
    pdf.text(line, L, y, { size: 9.5, color: GREY });
    y += 12;
  }

  // --- Absenderzeile und Anschrift (Fensterbereich) ---
  const senderLine = [sellerName, s.street, cityLine].filter(Boolean).join(' · ');
  pdf.text(senderLine, L, mm(50), { size: 7, color: GREY, maxWidth: mm(85) });
  pdf.line(L, mm(51.5), L + Math.min(mm(85), pdf.textWidth(senderLine, 7)), mm(51.5), { color: GREY, width: 0.4 });
  const r = inv.recipient || {};
  let ay = mm(58);
  for (const line of [r.name, r.street, [r.zip, r.city].filter(Boolean).join(' ')].filter(Boolean)) {
    pdf.text(line, L, ay, { size: 11, maxWidth: mm(85) });
    ay += 15;
  }

  // --- Infoblock rechts ---
  const infoX = mm(125);
  let iy = mm(58);
  const info = [
    [`${label}snummer`, inv.number],
    [`${label}sdatum`, formatDate(inv.date)],
    ['Leistungsdatum', formatDate(inv.serviceDate)],
  ];
  if (!isReceipt && inv.dueDate) info.push(['Zahlbar bis', formatDate(inv.dueDate)]);
  for (const [k, v] of info) {
    pdf.text(k, infoX, iy, { size: 9, color: GREY });
    pdf.text(v, R, iy, { size: 9.5, bold: k.endsWith('nummer'), align: 'right' });
    iy += 14;
  }

  // --- Titel ---
  y = mm(105);
  pdf.text(`${label} ${inv.number}`, L, y, { size: 17, bold: true });
  if (inv.cancelled) pdf.text('STORNIERT', R, y, { size: 15, bold: true, color: RED, align: 'right' });
  y += 22;
  pdf.text(isReceipt ? 'Hiermit bestätige ich den Erhalt des folgenden Betrags:' : 'Für meine Leistungen berechne ich Ihnen:', L, y, { size: 10.5 });

  // --- Positionen ---
  const X = { pos: L, text: L + 26, qty: mm(128), price: mm(158), total: R };
  const tableHead = () => {
    y += 22;
    pdf.text('Pos.', X.pos, y, { size: 8.5, color: GREY });
    pdf.text('Leistung', X.text, y, { size: 8.5, color: GREY });
    pdf.text('Menge', X.qty, y, { size: 8.5, color: GREY, align: 'right' });
    pdf.text('Einzelpreis', X.price, y, { size: 8.5, color: GREY, align: 'right' });
    pdf.text('Gesamt', X.total, y, { size: 8.5, color: GREY, align: 'right' });
    y += 6;
    pdf.line(L, y, R, y, { color: LIGHT, width: 0.8 });
  };
  tableHead();
  inv.items.forEach((it, i) => {
    const lines = pdf.wrap(it.text, X.qty - X.text - 40, 10);
    if (y + lines.length * 13 + 10 > pdf.H - mm(40)) { pdf.addPage(); y = mm(25); tableHead(); }
    y += 16;
    pdf.text(String(i + 1), X.pos, y, { size: 10 });
    lines.forEach((ln, j) => pdf.text(ln, X.text, y + j * 13, { size: 10 }));
    pdf.text(qtyText(it.quantity), X.qty, y, { size: 10, align: 'right' });
    pdf.text(formatMoney(it.unitPriceCents), X.price, y, { size: 10, align: 'right' });
    pdf.text(formatMoney(it.totalCents), X.total, y, { size: 10, align: 'right' });
    y += (lines.length - 1) * 13 + 4;
  });
  y += 6;
  pdf.line(mm(110), y, R, y, { color: GREY, width: 0.6 });
  y += 17;
  pdf.text('Gesamtbetrag', mm(110), y, { size: 11, bold: true });
  pdf.text(formatMoney(inv.totalCents), R, y, { size: 12, bold: true, align: 'right' });

  // --- Hinweise ---
  y += 30;
  const para = (txt, opts = {}) => {
    for (const ln of pdf.wrap(txt, R - L, opts.size || 10, opts.bold)) {
      pdf.text(ln, L, y, { size: opts.size || 10, bold: opts.bold, color: opts.color || [0, 0, 0] });
      y += (opts.size || 10) + 4;
    }
    y += 6;
  };
  para('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', { bold: true, size: 9.5 });
  if (isReceipt) {
    const how = inv.payment === 'transfer' ? 'per Überweisung' : 'bar';
    para(`Den Betrag von ${formatMoney(inv.totalCents)} habe ich am ${formatDate(inv.paymentDate)} ${how} erhalten. Vielen Dank!`);
  } else {
    const due = inv.dueDate && inv.dueDate !== inv.date ? `bis zum ${formatDate(inv.dueDate)}` : 'umgehend';
    para(s.iban
      ? `Bitte überweisen Sie den Gesamtbetrag ${due} unter Angabe der Rechnungsnummer ${inv.number} auf das unten genannte Konto.`
      : `Bitte zahlen Sie den Gesamtbetrag ${due}.`);
  }
  if (inv.note) para(inv.note);
  if (s.invoiceNote) para(s.invoiceNote, { color: GREY });

  // --- Fußzeile auf jeder Seite ---
  const cols = [
    [sellerName, s.businessName && s.ownerName ? `Inhaber:in: ${s.ownerName}` : null, s.street, cityLine],
    [s.phone ? `Tel. ${s.phone}` : null, s.email, s.website],
    [s.bankName || (s.iban ? 'Bankverbindung' : null), s.iban ? `IBAN ${formatIban(s.iban)}` : null, s.bic ? `BIC ${s.bic}` : null,
      s.bankHolder && s.bankHolder !== sellerName ? `Kontoinhaber:in ${s.bankHolder}` : null, s.taxNumber ? `Steuernummer ${s.taxNumber}` : null],
  ].map((c) => c.filter(Boolean));
  const colX = [L, L + (R - L) * 0.36, L + (R - L) * 0.64];
  for (let p = 0; p < pdf.pages.length; p++) {
    pdf.setPage(p);
    const fy = pdf.H - mm(28);
    pdf.line(L, fy - 10, R, fy - 10, { color: LIGHT });
    cols.forEach((col, ci) => col.forEach((ln, li) => pdf.text(ln, colX[ci], fy + li * 9.5, { size: 7.5, color: GREY, maxWidth: (R - L) * 0.34 })));
    if (pdf.pages.length > 1) pdf.text(`Seite ${p + 1} von ${pdf.pages.length}`, R, pdf.H - mm(10), { size: 7.5, color: GREY, align: 'right' });
  }

  const blob = pdf.toBlob({ title: `${label} ${inv.number}`, author: sellerName });
  return new File([blob], `${label}-${inv.number}.pdf`, { type: 'application/pdf' });
}
