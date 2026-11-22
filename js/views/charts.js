// Diagramme für die Auswertung – schlicht, ohne fremde Bibliothek (SVG).
// - Einnahmen/Ausgaben pro Monat (gruppierte Säulen)
// - Gewinn im Jahresverlauf, verglichen mit dem Vorjahr (Linien)
// Farben kommen aus CSS-Variablen (--chart-income, --chart-expense …),
// damit hell/dunkel stimmen. Ein Tipp/Hover zeigt die genauen Werte.

import { h } from '../ui.js';
import { formatMoney, formatProfit, MONTHS } from '../format.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  return el;
};

const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Schöne Achsenschritte (1, 2, 2,5, 5 × 10^n) */
function niceStep(range, ticks = 4) {
  const raw = range / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * pow;
}

/** Säule mit 4px abgerundeter Oberkante, unten eckig (an der Grundlinie) */
function barPath(x, y, w, hgt) {
  if (hgt <= 0) return '';
  const r = Math.min(4, w / 2, hgt);
  return `M${x},${y + hgt} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + hgt} Z`;
}

/** Chart-Hülle mit Anzeige der Werte darunter; zeichnet bei Größenänderung neu */
function chartShell(label, draw) {
  // Werte-Anzeige unter dem Diagramm (statt schwebendem Tooltip – verdeckt auf dem Handy nichts)
  const tooltip = h('div', { class: 'chart-tip', role: 'status', 'aria-live': 'polite' });
  const box = h('div', { class: 'chart-box', role: 'img', 'aria-label': label });
  const wrap = h('div', { class: 'chart' }, box, tooltip);
  let lastW = 0;
  const redraw = () => {
    if (!wrap.isConnected) { ro?.disconnect(); return; }
    const w = Math.round(box.clientWidth);
    if (!w || w === lastW) return;
    lastW = w;
    box.replaceChildren(draw(w, tooltip));
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  ro?.observe(box);
  requestAnimationFrame(redraw);
  return wrap;
}

function showTip(tip, rows, title) {
  tip.replaceChildren(
    h('div', { class: 'chart-tip-title' }, title),
    h('div', { class: 'chart-tip-rows' }, rows.map((r) => h('span', { class: 'chart-tip-row' },
      r.key ? h('span', { class: `chart-key ${r.key}` }) : null,
      h('strong', null, r.value),
      h('span', { class: 'chart-tip-label' }, r.label)))));
}

function legend(items) {
  return h('div', { class: 'chart-legend' }, items.map((it) => h('span', { class: 'chart-legend-item' },
    h('span', { class: `chart-key ${it.key}${it.line ? ' line' : ''}` }), it.label)));
}

// ---------- Einnahmen & Ausgaben pro Monat ----------

/** months: 12 × { income, expense, profit } in Cent; upToMonth: letzter Monat mit Daten (0–11) oder 11 */
export function monthlyChart(months, { year }) {
  const draw = (W, tip) => {
    const H = 190;
    const pad = { l: 44, r: 6, t: 10, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense) / 100));
    const step = niceStep(max);
    const top = Math.ceil(max / step) * step;
    const y = (v) => pad.t + ih - (v / top) * ih;
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', 'aria-hidden': 'true' });

    // Raster und Achse
    for (let v = 0; v <= top + 1e-9; v += step) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: v === 0 ? 'chart-base' : 'chart-grid' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-tick' });
      t.textContent = num.format(v);
      svg.append(t);
    }
    const gw = iw / 12;
    const shows = [];
    // Markierung des gewählten Monats – hinter den Säulen
    const hl = svgEl('rect', { x: pad.l, y: pad.t, width: gw, height: ih + pad.b, rx: 6, class: 'chart-hl' });
    svg.append(hl);
    const bw = Math.min(12, (gw - 6) / 2); // Säulenbreite, höchstens 12 px (2 je Monat)
    const short = W < 460;
    months.forEach((m, i) => {
      const gx = pad.l + i * gw;
      const cx = gx + gw / 2;
      const hi = (m.income / 100 / top) * ih;
      const he = (m.expense / 100 / top) * ih;
      // 2px Lücke zwischen den beiden Säulen
      svg.append(svgEl('path', { d: barPath(cx - bw - 1, pad.t + ih - hi, bw, hi), class: 'bar-income' }));
      svg.append(svgEl('path', { d: barPath(cx + 1, pad.t + ih - he, bw, he), class: 'bar-expense' }));
      const lbl = svgEl('text', { x: cx, y: H - 7, 'text-anchor': 'middle', class: 'chart-tick' });
      lbl.textContent = short ? MONTHS[i][0] : MONTHS[i].slice(0, 3);
      svg.append(lbl);
      // Trefferfläche: die ganze Monatsspalte (größer als die Säulen)
      const hit = svgEl('rect', {
        x: gx, y: pad.t, width: gw, height: ih + pad.b, class: 'chart-hit', tabindex: 0,
        'aria-label': `${MONTHS[i]} ${year}: Einnahmen ${formatMoney(m.income)}, Ausgaben ${formatMoney(m.expense)}`,
      });
      const show = () => {
        hl.setAttribute('x', gx);
        showTip(tip, [
          { key: 'k-income', value: formatMoney(m.income), label: 'Einnahmen' },
          { key: 'k-expense', value: formatMoney(m.expense), label: 'Ausgaben' },
          { value: formatProfit(m.profit), label: m.profit < 0 ? 'Verlust' : 'Gewinn' },
        ], `${MONTHS[i]} ${year}`);
      };
      shows.push(show);
      hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
      hit.addEventListener('click', () => { selected = i; show(); });
      hit.addEventListener('focus', show);
      svg.append(hit);
    });
    // Maus verlässt das Diagramm: wieder den gewählten Monat zeigen
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') shows[selected](); });
    shows[selected]();
    return svg;
  };
  // Anfangs: letzter Monat mit Buchungen
  let selected = Math.max(0, months.reduce((last, m, i) => (m.income || m.expense ? i : last), 0));
  return h('div', null,
    legend([{ key: 'k-income', label: 'Einnahmen' }, { key: 'k-expense', label: 'Ausgaben' }]),
    chartShell(`Einnahmen und Ausgaben pro Monat ${year}`, draw),
    h('p', { class: 'chart-note' }, 'Achse in Euro. Tippe auf einen Monat, um seine Werte zu sehen.'));
}

// ---------- Gewinn im Jahresverlauf (kumuliert) ----------

/** current/previous: 12 Monatswerte (Gewinn in Cent); lastMonth: bis zu welchem Monat das aktuelle Jahr gezeichnet wird */
export function cumulativeChart({ year, current, previous, lastMonth }) {
  const cum = (arr, upto) => {
    let s = 0;
    return arr.slice(0, upto + 1).map((v) => (s += v));
  };
  const cur = cum(current, lastMonth);
  const prev = previous ? cum(previous, 11) : null;

  const draw = (W, tip) => {
    const H = 190;
    const pad = { l: 50, r: 12, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const all = [...cur, ...(prev || []), 0].map((v) => v / 100);
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (hi === lo) hi = lo + 100;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const x = (i) => pad.l + (i / 11) * iw;
    const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
    const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', 'aria-hidden': 'true' });
    for (let v = lo; v <= hi + 1e-9; v += step) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: Math.abs(v) < 1e-9 ? 'chart-base' : 'chart-grid' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-tick' });
      t.textContent = num.format(v);
      svg.append(t);
    }
    for (let i = 0; i < 12; i += 1) {
      const t = svgEl('text', { x: x(i), y: H - 7, 'text-anchor': 'middle', class: 'chart-tick' });
      t.textContent = W < 460 ? MONTHS[i][0] : MONTHS[i].slice(0, 3);
      svg.append(t);
    }
    const line = (vals, cls) => {
      const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v / 100).toFixed(1)}`).join(' ');
      svg.append(svgEl('path', { d, class: cls }));
    };
    if (prev) line(prev, 'line-prev');
    line(cur, 'line-current');
    // Endpunkt des aktuellen Jahres mit Ring in Flächenfarbe
    const ex = x(cur.length - 1);
    const ey = y(cur[cur.length - 1] / 100);
    svg.append(svgEl('circle', { cx: ex, cy: ey, r: 5, class: 'dot-current' }));

    // Fadenkreuz: findet den nächsten Monat
    const cross = svgEl('line', { y1: pad.t, y2: pad.t + ih, class: 'chart-cross', visibility: 'hidden' });
    svg.append(cross);
    const hitArea = svgEl('rect', { x: pad.l - 10, y: 0, width: iw + 20, height: H, class: 'chart-hit', tabindex: 0, 'aria-label': `Gewinn kumuliert ${year}` });
    const showIndex = (i) => {
      cross.setAttribute('x1', x(i));
      cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      const rows = [];
      if (i < cur.length) rows.push({ key: 'k-current line', value: formatProfit(cur[i]), label: String(year) });
      if (prev) rows.push({ key: 'k-prev line', value: formatProfit(prev[i]), label: String(year - 1) });
      showTip(tip, rows, `Gewinn bis Ende ${MONTHS[i]}`);
    };
    const indexAt = (clientX) => {
      const r = svg.getBoundingClientRect();
      return Math.max(0, Math.min(11, Math.round(((clientX - r.left - pad.l) / iw) * 11)));
    };
    hitArea.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showIndex(indexAt(e.clientX)); });
    hitArea.addEventListener('pointerdown', (e) => { selected = indexAt(e.clientX); showIndex(selected); });
    hitArea.addEventListener('focus', () => showIndex(selected));
    hitArea.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') showIndex(selected); });
    svg.append(hitArea);
    showIndex(selected);
    return svg;
  };
  let selected = cur.length - 1;

  return h('div', null,
    prev ? legend([{ key: 'k-current', line: true, label: String(year) }, { key: 'k-prev', line: true, label: `${year - 1} (Vorjahr)` }]) : null,
    chartShell(`Gewinn im Jahresverlauf ${year}${prev ? ` im Vergleich zu ${year - 1}` : ''}`, draw),
    h('p', { class: 'chart-note' }, 'Gewinn aufsummiert vom Jahresanfang bis zum jeweiligen Monat. Tippe ins Diagramm für die Werte.'));
}

/** Dünner Anteilsbalken (z. B. Anteil einer Kategorie an allen Einnahmen) */
export function shareBar(part, total, kind) {
  const pct = total > 0 ? Math.max(1, Math.round((part / total) * 100)) : 0;
  return h('div', { class: 'share', 'aria-hidden': 'true' }, h('div', { class: `share-fill ${kind}`, style: `width: ${pct}%` }));
}
