// Formatierung von Beträgen und Datumsangaben (deutsch).
// Beträge werden überall als ganze Cent (Integer) gespeichert.

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** 123456 → "1.234,56 €" */
export function formatMoney(cents) {
  return eur.format((cents || 0) / 100);
}

/** Mit Vorzeichen je nach Typ: Einnahme "+12,00 €", Ausgabe "−12,00 €" */
export function formatSigned(cents, type) {
  return (type === 'income' ? '+' : '−') + formatMoney(Math.abs(cents));
}

/** Gewinn/Verlust: negatives Ergebnis mit echtem Minuszeichen */
export function formatProfit(cents) {
  return cents < 0 ? '−' + formatMoney(-cents) : formatMoney(cents);
}

/** 4550 → "45,50" (für Eingabefelder) */
export function centsToInput(cents) {
  if (cents == null) return '';
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Liest eine Betragseingabe und gibt Cent zurück (oder null, wenn ungültig).
 * Erlaubt: "12", "12,5", "12,50", "1.234,56", "12.50", "1.234", "€ 12,50"
 */
export function parseAmount(input) {
  if (input == null) return null;
  let s = String(input).replace(/[\s  €]/g, '');
  if (!s) return null;
  const dots = (s.match(/\./g) || []).length;
  if (s.includes(',')) {
    // Deutsch: Punkt = Tausendertrennzeichen, Komma = Dezimaltrennzeichen
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dots > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
    // "1.234" oder "1.234.567" → Tausenderpunkte
    s = s.replace(/\./g, '');
  }
  if (!/^\d*(\.\d{0,2})?$/.test(s) || !/\d/.test(s)) return null;
  const [intPart, frac = ''] = s.split('.');
  const cents = parseInt(intPart || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return Number.isSafeInteger(cents) ? cents : null;
}

const pad = (n) => String(n).padStart(2, '0');

/** 12.5 → "12,5", 42 → "42" */
export function formatKm(km) {
  return String(Math.round(km * 100) / 100).replace('.', ',');
}

/** Heutiges Datum als "JJJJ-MM-TT" (lokale Zeit) */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-17" → "17.11.2026" */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** ISO-Zeitstempel → "17.11.2026, 14:05" */
export function formatDateTime(isoTimestamp) {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** "2026-11" → "November 2026" */
export function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** Dateigröße lesbar: 1536000 → "1,5 MB" */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

/** Für die Suche: Kleinbuchstaben, Umlaute bleiben */
export function normalizeText(s) {
  return String(s || '').toLocaleLowerCase('de-DE').trim();
}

/** IBAN formatieren: "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00" */
export function formatIban(iban) {
  return String(iban || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

/** IBAN prüfen (Länge und Prüfsumme nach ISO 13616) */
export function isValidIban(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  if (s.startsWith('DE') && s.length !== 22) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
