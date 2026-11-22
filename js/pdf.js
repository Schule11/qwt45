// Ein sehr kleiner PDF-Erzeuger – ohne fremde Bibliothek.
// Kann: Text (Helvetica, normal/fett), Linien, Flächen, ein JPEG-Bild, mehrere Seiten.
// Koordinaten: x von links, y von OBEN (bei Text: Grundlinie), Einheit Punkt (1/72 Zoll).

// Zeichenbreiten von Helvetica (Zeichen 32–126), Einheit 1/1000 der Schriftgröße
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// Sonderzeichen → WinAnsi-Code (die Kodierung der eingebauten PDF-Schriften)
const SPECIAL = {
  0x20ac: 0x80, // €
  0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x2212: 0x2d, // echtes Minus → Bindestrich
  0x00a0: 0x20, 0x202f: 0x20, 0x2009: 0x20, // geschützte/schmale Leerzeichen
};
const SPECIAL_WIDTH = { 0x80: 556, 0x82: 278, 0x84: 333, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000 };

function toCodes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp >= 32 && cp <= 126) out.push(cp);
    else if (SPECIAL[cp] != null) out.push(SPECIAL[cp]);
    else if (cp >= 0xa1 && cp <= 0xff) out.push(cp);
    else if (cp === 10 || cp === 13 || cp === 9) out.push(32);
    else out.push(0x3f); // ?
  }
  return out;
}

function charWidth(code, bold) {
  if (code >= 32 && code <= 126) return (bold ? W_BOLD : W_REG)[code - 32];
  if (SPECIAL_WIDTH[code]) return SPECIAL_WIDTH[code];
  if (code === 0xdf) return 611; // ß
  if (code === 0xa7) return 556; // §
  if (code === 0xb7) return 278; // ·
  // Umlaute und Akzente: Breite des Grundbuchstabens
  const base = String.fromCharCode(code).normalize('NFD').charCodeAt(0);
  if (base >= 32 && base <= 126) return (bold ? W_BOLD : W_REG)[base - 32];
  return 556;
}

function escapeCodes(codes) {
  let s = '';
  for (const c of codes) {
    if (c === 0x28 || c === 0x29 || c === 0x5c) s += '\\' + String.fromCharCode(c);
    else if (c < 32 || c > 126) s += '\\' + c.toString(8).padStart(3, '0');
    else s += String.fromCharCode(c);
  }
  return s;
}

const num = (v) => String(Math.round(v * 100) / 100);
const rgb = (c) => c.map((v) => num(v)).join(' ');

export class Pdf {
  constructor() {
    this.W = 595.28; // A4
    this.H = 841.89;
    this.pages = [];
    this.image = null;
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
  }

  setPage(index) { this.ops = this.pages[index]; }

  textWidth(str, size = 10, bold = false) {
    let w = 0;
    for (const c of toCodes(str)) w += charWidth(c, bold);
    return (w * size) / 1000;
  }

  /** Kürzt Text mit "…", damit er in maxWidth passt */
  fit(str, maxWidth, size = 10, bold = false) {
    str = String(str ?? '');
    if (this.textWidth(str, size, bold) <= maxWidth) return str;
    let s = str;
    while (s.length > 1 && this.textWidth(s + '…', size, bold) > maxWidth) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }

  /** Text auf mehrere Zeilen umbrechen (an Leerzeichen) */
  wrap(str, maxWidth, size = 10, bold = false) {
    const lines = [];
    for (const para of String(str ?? '').split(/\n/)) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (this.textWidth(test, size, bold) <= maxWidth || !line) line = test;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  }

  text(str, x, y, { size = 10, bold = false, color = [0, 0, 0], align = 'left', maxWidth = null } = {}) {
    let s = String(str ?? '');
    if (maxWidth) s = this.fit(s, maxWidth, size, bold);
    const w = this.textWidth(s, size, bold);
    const tx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(color)} rg 1 0 0 1 ${num(tx)} ${num(this.H - y)} Tm (${escapeCodes(toCodes(s))}) Tj ET`);
  }

  line(x1, y1, x2, y2, { color = [0.8, 0.8, 0.8], width = 0.5 } = {}) {
    this.ops.push(`${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(this.H - y1)} m ${num(x2)} ${num(this.H - y2)} l S`);
  }

  rect(x, y, w, h, { fill = [0.95, 0.95, 0.95] } = {}) {
    this.ops.push(`${rgb(fill)} rg ${num(x)} ${num(this.H - y - h)} ${num(w)} ${num(h)} re f`);
  }

  /** JPEG-Bild hinterlegen (einmal pro Dokument) */
  setImage(jpegBytes, width, height) {
    this.image = { bytes: jpegBytes, width, height };
  }

  drawImage(x, y, w, h) {
    if (!this.image) return;
    this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.H - y - h)} cm /Im1 Do Q`);
  }

  /** Fertige PDF-Datei als Blob */
  toBlob({ title = '', author = '' } = {}) {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const push = (data) => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      chunks.push(bytes);
      pos += bytes.length;
    };
    const obj = (n, body) => {
      offsets[n] = pos;
      push(`${n} 0 obj\n`);
      for (const part of [].concat(body)) push(part);
      push('\nendobj\n');
    };

    const nPages = this.pages.length;
    const firstPage = this.image ? 6 : 5;
    const pageObj = (i) => firstPage + i * 2;
    const infoObj = firstPage + nPages * 2;

    push('%PDF-1.4\n');
    push(new Uint8Array([37, 226, 227, 207, 211, 10])); // Kennzeichnung "Binärdatei"

    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${nPages} /Kids [${this.pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    if (this.image) {
      const img = this.image;
      obj(5, [
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
        img.bytes,
        '\nendstream',
      ]);
    }
    const resources = `<< /Font << /F1 3 0 R /F2 4 0 R >>${this.image ? ' /XObject << /Im1 5 0 R >>' : ''} >>`;
    this.pages.forEach((ops, i) => {
      const content = ops.join('\n');
      obj(pageObj(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.W)} ${num(this.H)}] /Resources ${resources} /Contents ${pageObj(i) + 1} 0 R >>`);
      obj(pageObj(i) + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const date = `D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    obj(infoObj, `<< /Title (${escapeCodes(toCodes(title))}) /Author (${escapeCodes(toCodes(author))}) /Producer (Hundeschule-App) /CreationDate (${date}) >>`);

    const xrefPos = pos;
    const size = infoObj + 1;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let n = 1; n < size; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    push(xref);
    push(`trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    return new Blob(chunks, { type: 'application/pdf' });
  }
}
