// Jahresabschluss-Assistent: Checkliste für ein Jahr, mit je einem Knopf zum Erledigen.

import { h, mount, toast, alertDialog, openSheet } from '../ui.js';
import { onChange, categoryName, contactById } from '../data.js';
import { formatDate, formatMoney } from '../format.js';
import { closingChecks, setAck, markExported, openOfYear, receiptsMissing, tripsIncomplete, tenDayCandidates, assignYear } from '../closing.js';
import { reportPdf, bookingsCsv } from '../exports.js';
import { tripPdf, tripsOfYear } from '../tripPdf.js';
import { saveFile, prefersShare } from '../files.js';
import { bookingRow } from './components.js';
import { doExport, openTradeTaxPage } from './settings.js';

/** Datei im Tipp erzeugen und weitergeben (wichtig fürs iPhone) */
function exportFile(make, after) {
  let file;
  try {
    file = make();
  } catch (err) {
    console.error(err);
    alertDialog({ title: 'Export fehlgeschlagen', text: err.message || String(err) });
    return;
  }
  const share = prefersShare(file);
  saveFile(file, (ok) => { if (ok && !share) toast(`${file.name} heruntergeladen`); });
  after?.();
}

function meter(done, total) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return h('div', { class: 'meter', role: 'img', 'aria-label': `${done} von ${total} erledigt` },
    h('div', { class: 'meter-fill', style: `width: ${p}%` }));
}

/** Karte für die Auswertung: Fortschritt, Tippen öffnet den Assistenten */
export function closingCard(year) {
  const r = closingChecks(year);
  const todo = r.items.filter((i) => i.status === 'todo');
  return h('button', { type: 'button', class: 'card closing-card', id: 'closing-open', onclick: () => openClosing(year) },
    h('div', { class: 'closing-card-head' },
      h('span', { class: 'closing-card-title' }, `Jahresabschluss ${year}`),
      h('span', { class: 'closing-card-count' }, `${r.done} von ${r.total} erledigt`),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')),
    meter(r.done, r.total),
    h('span', { class: 'closing-card-sub' }, todo.length
      ? `Noch offen: ${todo.map((i) => i.title).join(', ')}`
      : 'Alles geprüft – bereit für die Steuererklärung.'));
}

export function openClosing(year) {
  let unsubscribe = null;
  const content = h('div');
  const { body } = openSheet({ title: `Jahresabschluss ${year}`, onClose: () => unsubscribe?.() });
  mount(body, content);

  function actions(item) {
    const btn = (label, onClick, primary = false) => h('button', { type: 'button', class: `btn btn-small${primary ? ' primary' : ''}`, onclick: onClick }, label);
    const list = [];
    const todo = item.status === 'todo';
    switch (item.id) {
      case 'open':
        if (item.count) list.push(btn('Anzeigen', () => openBookingList({
          title: 'Offene Zahlungen', items: () => openOfYear(year),
          intro: 'Kreis antippen, sobald bezahlt wurde. Antippen der Zeile öffnet die Buchung.',
          empty: 'Keine offenen Zahlungen mehr.',
        }), todo));
        break;
      case 'receipts':
        if (item.count) list.push(btn('Anzeigen', () => openBookingList({
          title: 'Ausgaben ohne Beleg', items: () => receiptsMissing(year),
          intro: 'Antippen, um ein Foto oder PDF als Beleg hinzuzufügen.',
          empty: 'Alle Ausgaben haben jetzt einen Beleg.',
        }), todo));
        break;
      case 'trips':
        if (item.count) list.push(btn('Anzeigen', () => openBookingList({
          title: 'Fahrten ergänzen', items: () => tripsIncomplete(year),
          intro: 'Antippen und Ziel und Zweck eintragen, z. B. „Hundeplatz Cappel“ und „Gruppenstunde“.',
          empty: 'Alle Fahrten haben Ziel und Zweck.',
        }), todo));
        break;
      case 'tenday':
        if (tenDayCandidates(year).length) list.push(btn(todo ? 'Zuordnen' : 'Ansehen', () => openTenDay(year), todo));
        break;
      case 'tradetax':
        list.push(btn('Mehr dazu', () => openTradeTaxPage()));
        break;
      case 'backup': {
        const b = btn('Backup erstellen', () => doExport(b), todo);
        list.push(b);
        break;
      }
      case 'export':
        list.push(btn('Jahres-PDF', () => exportFile(() => reportPdf(year), () => markExported(year)), todo));
        if (tripsOfYear(year).length) list.push(btn('Fahrtenliste', () => exportFile(() => tripPdf(year))));
        list.push(btn('CSV', () => exportFile(() => bookingsCsv(year))));
        break;
      default:
    }
    if (todo && item.canAck !== false && item.ackLabel) {
      list.push(h('button', { type: 'button', class: 'btn-text', onclick: () => setAck(year, item.id, true) }, item.ackLabel));
    }
    if (item.status === 'checked') {
      list.push(h('button', { type: 'button', class: 'btn-text', onclick: () => setAck(year, item.id, false) }, 'Zurücknehmen'));
    }
    return list.length ? h('div', { class: 'check-actions' }, list) : null;
  }

  function render() {
    const r = closingChecks(year);
    content.replaceChildren(
      h('section', { class: 'card' },
        h('div', { class: 'kv' },
          h('strong', null, r.done === r.total ? 'Alles erledigt ✓' : `${r.done} von ${r.total} erledigt`)),
        meter(r.done, r.total),
        h('p', { class: 'hint', style: 'margin-bottom: 0' },
          `Geh die Punkte einmal durch${new Date().getFullYear() <= year ? ` – am besten Anfang ${year + 1}` : ''}, bevor du die Steuererklärung machst. `
          + '✓ heißt: passt. ! heißt: bitte ansehen.')),
      ...r.items.map((item) => h('section', { class: `card check-item ${item.status}`, 'data-id': item.id },
        h('div', { class: 'check-head' },
          h('span', { class: 'check-icon', 'aria-hidden': 'true' }, item.status === 'todo' ? '!' : '✓'),
          h('h3', { class: 'check-title' }, item.title),
          h('span', { class: 'sr-only' }, item.status === 'todo' ? 'Bitte ansehen' : item.status === 'checked' ? 'Von Hand erledigt' : 'Erledigt')),
        h('p', { class: 'check-text' }, item.text),
        item.status === 'checked' ? h('p', { class: 'check-text muted' }, 'Als erledigt markiert.') : null,
        actions(item))),
    );
  }

  render();
  unsubscribe = onChange(render);
}

/** Liste von Buchungen (z. B. ohne Beleg); aktualisiert sich nach jeder Änderung */
function openBookingList({ title, items, intro, empty }) {
  let unsubscribe = null;
  const list = h('div');
  const { body } = openSheet({ title, onClose: () => unsubscribe?.() });
  mount(body, h('p', { class: 'hint', style: 'margin-top: 0' }, intro), list);
  const render = () => {
    const rows = items();
    list.replaceChildren(rows.length
      ? h('div', { class: 'rows' }, rows.map(bookingRow))
      : h('div', { class: 'empty' }, h('strong', null, '✓ Erledigt'), empty));
  };
  render();
  unsubscribe = onChange(render);
}

/** 10-Tage-Regel: für jede Zahlung rund um den Jahreswechsel das Jahr festlegen */
function openTenDay(year) {
  let unsubscribe = null;
  const list = h('div');
  const { body } = openSheet({ title: '10-Tage-Regel', onClose: () => unsubscribe?.() });
  mount(body,
    h('section', { class: 'card' },
      h('p', { style: 'margin-top: 0' },
        'Regelmäßig wiederkehrende Zahlungen wie Platzmiete, Versicherung oder Telefon zählen ausnahmsweise nicht im Jahr der Zahlung, '
        + 'sondern in dem Jahr, zu dem sie gehören – wenn sie zwischen dem 22.12. und dem 10.01. bezahlt und auch in dieser Zeit fällig wurden.'),
      h('p', { class: 'hint' }, 'Beispiele: Die Platzmiete für Dezember, bezahlt am 5. Januar, gehört noch ins alte Jahr. '
        + 'Der Versicherungsbeitrag fürs neue Jahr, bezahlt am 28. Dezember, gehört ins neue Jahr.'),
      h('p', { class: 'hint', style: 'margin-bottom: 0' }, 'Einmalige Ausgaben (z. B. Material) zählen immer im Jahr der Zahlung. Im Zweifel: Jahr der Zahlung wählen.')),
    list);

  const render = () => {
    const cands = tenDayCandidates(year);
    if (!cands.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', null, 'Nichts zu prüfen'), 'Keine wiederkehrenden Zahlungen rund um den Jahreswechsel.'));
      return;
    }
    list.replaceChildren(h('h2', { class: 'section-title' }, 'Zu welchem Jahr gehört die Zahlung?'),
      ...cands.map((c) => {
        const b = c.booking;
        const dateYear = Number(b.date.slice(0, 4));
        const name = b.description || categoryName(b.categoryId);
        return h('section', { class: 'card tenday-item', 'data-id': b.id },
          h('div', { class: 'kv' },
            h('strong', null, name),
            h('span', { class: 'num' }, formatMoney(b.amountCents))),
          h('p', { class: 'hint', style: 'margin: 2px 0 10px' },
            [`bezahlt am ${formatDate(b.date)}`, categoryName(b.categoryId) !== name ? categoryName(b.categoryId) : null,
              contactById(b.personId)?.name].filter(Boolean).join(' · ')),
          h('div', { class: 'segmented segmented-3', role: 'group', 'aria-label': `Jahr für ${name}` },
            c.years.map((y) => h('button', {
              type: 'button',
              'aria-pressed': String(c.decided && c.assigned === y),
              onclick: async () => {
                await assignYear(b, y);
                toast(y === dateYear ? `Zählt für ${y} (Jahr der Zahlung)` : `Zählt jetzt für ${y}`);
              },
            }, y === dateYear ? `${y} (Zahlung)` : String(y)))),
          c.decided ? null : h('p', { class: 'hint', style: 'margin-bottom: 0' }, `Noch nicht festgelegt – zählt bis dahin für ${dateYear}.`));
      }));
  };
  render();
  unsubscribe = onChange(render);
}
