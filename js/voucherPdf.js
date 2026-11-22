// Gutschein zum Verschenken (A5 quer – passt auch auf A4 gedruckt).

import { Pdf } from './pdf.js';
import { getLogo } from './logo.js';
import { state } from './data.js';
import { formatMoney, formatDate } from './format.js';

const ORANGE = [0.87, 0.41, 0.08];
const GREY = [0.42, 0.41, 0.39];
const DARK = [0.11, 0.11, 0.1];

export function voucherPdf(v) {
  const pdf = new Pdf();
  // A5 quer
  pdf.W = 595.28;
  pdf.H = 419.53;
  const s = state.settings;
  const name = s.businessName || 'Hundeschule';
  const M = 34;

  // Rahmen und Akzentstreifen
  pdf.rect(0, 0, pdf.W, 10, { fill: ORANGE });
  pdf.rect(0, pdf.H - 10, pdf.W, 10, { fill: ORANGE });

  // Logo links
  const logo = getLogo();
  if (logo) {
    pdf.setImage(logo.bytes, logo.width, logo.height);
    const lw = 190;
    pdf.drawImage(M, 70, lw, (lw * logo.height) / logo.width);
  }

  // Text rechts
  const X = 270;
  let y = 82;
  pdf.text('GUTSCHEIN', X, y, { size: 30, bold: true, color: DARK });
  y += 22;
  pdf.text(`über ${formatMoney(v.valueCents)}`, X, y + 22, { size: 30, bold: true, color: ORANGE });
  y += 62;
  if (v.recipientName) {
    pdf.text(`für ${v.recipientName}`, X, y, { size: 15, color: DARK, maxWidth: pdf.W - X - M });
    y += 26;
  }
  for (const line of pdf.wrap(`Einzulösen bei der ${name} für alle Trainings, Kurse und Beratungen.`, pdf.W - X - M, 11)) {
    pdf.text(line, X, y, { size: 11, color: DARK });
    y += 15;
  }
  y += 12;
  pdf.text(`Gutschein-Nr. ${v.code}`, X, y, { size: 10.5, bold: true });
  y += 15;
  pdf.text(`Ausgestellt am ${formatDate(v.soldDate)} · gültig bis ${formatDate(v.validUntil)}`, X, y, { size: 9.5, color: GREY });

  // Fuß: Kontakt
  const contact = [name, [s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), s.phone, s.email, s.website]
    .filter(Boolean).join(' · ');
  pdf.line(M, pdf.H - 52, pdf.W - M, pdf.H - 52, { color: [0.85, 0.84, 0.82] });
  pdf.text(contact, pdf.W / 2, pdf.H - 34, { size: 8.5, color: GREY, align: 'center', maxWidth: pdf.W - 2 * M });
  pdf.text('Eine Barauszahlung ist nicht möglich. Teileinlösung möglich, der Restwert bleibt erhalten.', pdf.W / 2, pdf.H - 22, { size: 7.5, color: GREY, align: 'center' });

  const blob = pdf.toBlob({ title: `Gutschein ${v.code}`, author: name });
  return new File([blob], `Gutschein-${v.code}.pdf`, { type: 'application/pdf' });
}
