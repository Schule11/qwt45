// Fahrtenliste als PDF: alle Fahrten eines Jahres mit Datum, Ziel, Zweck, km und Betrag.
// Dient als Nachweis der betrieblichen Fahrten (Kilometerpauschale).

import { Pdf } from './pdf.js';
import { getLogo } from './logo.js';
import { state, categoryById, isOpen } from './data.js';
import { formatMoney, formatDate, formatKm, todayISO, MONTHS } from './format.js';

const GREY = [0.42, 0.41, 0.39];
const LIGHT = [0.85, 0.84, 0.82];
const RED = [0.77, 0.17, 0.24];

export function tripsOfYear(year) {
  return state.bookings
    .filter((b) => b.type === 'expense' && !isOpen(b) && b.date.startsWith(String(year)) && (b.km || categoryById(b.categoryId)?.mileage))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt < b.createdAt ? -1 : 1)));
}

export function tripPdf(year) {
  const trips = tripsOfYear(year);
  const pdf = new Pdf();
  const s = state.settings;
  const M = 48;
  const R = pdf.W - M;
  const BOTTOM = pdf.H - 60;
  const name = s.businessName || 'Hundeschule';
  let y = M;

  const logo = getLogo();
  if (logo) {
    pdf.setImage(logo.bytes, logo.width, logo.height);
    const lw = 80;
    pdf.drawImage(R - lw, M - 8, lw, (lw * logo.height) / logo.width);
  }
  y += 14;
  pdf.text(`Fahrtenliste ${year}`, M, y, { size: 18, bold: true });
  y += 19;
  pdf.text([name, s.ownerName].filter(Boolean).join(' · '), M, y, { size: 11 });
  y += 15;
  pdf.text(`Betriebliche Fahrten mit dem privaten Pkw · erstellt am ${formatDate(todayISO())}`, M, y, { size: 9, color: GREY });
  y += 22;

  const totalKm = trips.reduce((sum, b) => sum + (b.km || 0), 0);
  const totalCents = trips.reduce((sum, b) => sum + b.amountCents, 0);
  const rates = [...new Set(trips.map((b) => b.kmRateCents).filter(Boolean))];
  pdf.rect(M, y, R - M, 50, { fill: [0.955, 0.95, 0.94] });
  pdf.text(`${trips.length} Fahrten`, M + 12, y + 20, { size: 10.5 });
  pdf.text(`${formatKm(totalKm)} km`, M + 12, y + 38, { size: 10.5, bold: true });
  pdf.text(`Kilometerpauschale: ${rates.length ? rates.map((r) => `${formatMoney(r)}/km`).join(', ') : '–'}`, M + 170, y + 20, { size: 10.5 });
  pdf.text('Summe Fahrtkosten', R - 12, y + 20, { size: 9, color: GREY, align: 'right' });
  pdf.text(formatMoney(totalCents), R - 12, y + 38, { size: 12, bold: true, align: 'right' });
  y += 50;

  const X = { date: M, to: M + 56, purpose: M + 200, way: R - 146, km: R - 64, amt: R };
  const head = () => {
    y += 22;
    pdf.text('Datum', X.date, y, { size: 8.5, color: GREY });
    pdf.text('Ziel', X.to, y, { size: 8.5, color: GREY });
    pdf.text('Zweck', X.purpose, y, { size: 8.5, color: GREY });
    pdf.text('Strecke', X.way, y, { size: 8.5, color: GREY });
    pdf.text('km', X.km, y, { size: 8.5, color: GREY, align: 'right' });
    pdf.text('Betrag', X.amt, y, { size: 8.5, color: GREY, align: 'right' });
    y += 5;
    pdf.line(M, y, R, y, { color: LIGHT, width: 0.8 });
  };
  head();
  let month = null;
  let missing = 0;
  for (const b of trips) {
    const m = Number(b.date.slice(5, 7));
    if (m !== month) {
      month = m;
      if (y + 36 > BOTTOM) { pdf.addPage(); y = M; head(); }
      y += 16;
      pdf.text(MONTHS[m - 1], M, y, { size: 9.5, bold: true });
    }
    if (y + 16 > BOTTOM) { pdf.addPage(); y = M; head(); }
    y += 14;
    const to = b.tripTo || b.description || '';
    const purpose = b.tripPurpose || '';
    if (!b.tripTo || !b.tripPurpose) missing += 1;
    pdf.text(formatDate(b.date), X.date, y, { size: 9 });
    pdf.text(to || 'Ziel fehlt', X.to, y, { size: 9, maxWidth: X.purpose - X.to - 10, color: to ? [0, 0, 0] : RED });
    pdf.text(purpose || 'Zweck fehlt', X.purpose, y, { size: 9, maxWidth: X.way - X.purpose - 8, color: purpose ? [0, 0, 0] : RED });
    pdf.text(b.roundTrip ? 'hin & zurück' : 'einfach', X.way, y, { size: 8.5, color: GREY });
    pdf.text(formatKm(b.km || 0), X.km, y, { size: 9, align: 'right' });
    pdf.text(formatMoney(b.amountCents), X.amt, y, { size: 9, align: 'right' });
  }
  if (!trips.length) {
    y += 20;
    pdf.text(`Für ${year} sind keine Fahrten erfasst.`, M, y, { size: 11, color: GREY });
  }
  y += 10;
  pdf.line(M, y, R, y, { color: LIGHT });
  y += 15;
  pdf.text('Summe', M, y, { size: 10, bold: true });
  pdf.text(formatKm(totalKm), X.km, y, { size: 10, bold: true, align: 'right' });
  pdf.text(formatMoney(totalCents), X.amt, y, { size: 10, bold: true, align: 'right' });
  y += 26;
  const notes = ['Bei „hin & zurück“ sind die Kilometer bereits verdoppelt. Betrag = km × Kilometerpauschale.'];
  if (missing) notes.push(`Bei ${missing} ${missing === 1 ? 'Fahrt fehlen' : 'Fahrten fehlen'} Ziel oder Zweck – bitte in der App ergänzen.`);
  for (const n of notes) { if (y + 14 > BOTTOM) { pdf.addPage(); y = M; } pdf.text(n, M, y, { size: 8.5, color: n.includes('fehlen') ? RED : GREY }); y += 12; }

  const total = pdf.pages.length;
  for (let i = 0; i < total; i++) {
    pdf.setPage(i);
    pdf.line(M, pdf.H - 40, R, pdf.H - 40, { color: LIGHT });
    pdf.text(`${name} · Fahrtenliste ${year}`, M, pdf.H - 28, { size: 8, color: GREY });
    pdf.text(`Seite ${i + 1} von ${total}`, R, pdf.H - 28, { size: 8, color: GREY, align: 'right' });
  }
  return new File([pdf.toBlob({ title: `Fahrtenliste ${year}`, author: name })], `hundeschule-fahrten-${year}.pdf`, { type: 'application/pdf' });
}
