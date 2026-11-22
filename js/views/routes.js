// Häufige Strecken verwalten (für Fahrtkosten mit einem Tipp).

import { h, mount, toast, openSheet, confirmDialog } from '../ui.js';
import { state, onChange, routesSorted, saveRecord, deleteRecord, moveRecord } from '../data.js';
import { formatKm, parseAmount, formatMoney } from '../format.js';

/** Liste der Strecken als Block (für die Seite "Fahrtkosten") */
export function routesBlock() {
  const list = h('div');
  const render = () => {
    const routes = routesSorted();
    list.replaceChildren(
      routes.length
        ? h('div', { class: 'rows' }, routes.map((r, i) => h('div', { class: 'cat-row' },
          h('button', { type: 'button', class: 'cat-main', onclick: () => openRouteEditor(r) },
            h('div', { class: 'row-title' }, r.name),
            h('div', { class: 'row-sub' }, [
              `${formatKm(r.km)} km${r.roundTrip ? ' · hin & zurück' : ''}`,
              `≈ ${formatMoney(Math.round(r.km * (r.roundTrip ? 2 : 1) * state.settings.kmRateCents))}`,
              r.purpose || null,
            ].filter(Boolean).join(' · '))),
          h('div', { class: 'cat-move' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${r.name} nach oben`, disabled: i === 0, onclick: () => moveRecord('routes', routes, r.id, -1) }, '↑'),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${r.name} nach unten`, disabled: i === routes.length - 1, onclick: () => moveRecord('routes', routes, r.id, 1) }, '↓')))))
        : h('p', { class: 'hint', style: 'margin: 0 2px' }, 'Noch keine Strecken. Du kannst sie hier anlegen oder beim Erfassen einer Fahrt „merken“.'),
      h('div', { style: 'margin-top: 12px' },
        h('button', { type: 'button', class: 'btn block', onclick: () => openRouteEditor(null) }, '+ Neue Strecke')),
    );
  };
  render();
  const unsubscribe = onChange(render);
  return { el: list, dispose: unsubscribe };
}

export function openRouteEditor(route) {
  const isNew = !route;
  const nameInput = h('input', {
    class: 'field', id: 'route-name', type: 'text', maxlength: 120, autocomplete: 'off', autocapitalize: 'sentences',
    value: route?.name || '', placeholder: 'z. B. Hundeplatz',
  });
  const kmInput = h('input', {
    class: 'field', id: 'route-km', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: route ? formatKm(route.km) : '', placeholder: 'einfache Strecke, z. B. 12',
  });
  const purposeInput = h('input', {
    class: 'field', id: 'route-purpose', type: 'text', maxlength: 120, autocomplete: 'off', autocapitalize: 'sentences',
    value: route?.purpose || '', placeholder: 'z. B. Gruppenstunde (optional)',
  });
  const roundBox = h('input', { type: 'checkbox', id: 'route-round', checked: route ? !!route.roundTrip : true });
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });

  const { body, close } = openSheet({ title: isNew ? 'Neue Strecke' : 'Strecke bearbeiten', cancel: true, onConfirm: () => save() });

  async function save() {
    const fail = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
    const name = nameInput.value.trim();
    const km = parseAmount(kmInput.value);
    if (!name) return fail('Bitte ein Ziel eingeben.');
    if (!km) return fail('Bitte die Kilometer der einfachen Strecke eingeben.');
    await saveRecord('routes', { id: route?.id, name, km: km / 100, roundTrip: roundBox.checked, purpose: purposeInput.value.trim() });
    close();
    toast(isNew ? 'Strecke angelegt' : 'Gespeichert');
  }

  async function remove() {
    const ok = await confirmDialog({ title: `„${route.name}“ löschen?`, text: 'Bereits erfasste Fahrten bleiben unverändert.', confirmLabel: 'Löschen', danger: true });
    if (!ok) return;
    await deleteRecord('routes', route.id);
    close();
    toast('Strecke gelöscht');
  }

  mount(body, 
    h('label', { class: 'lbl', for: 'route-name', style: 'margin-top: 4px' }, 'Ziel'),
    nameInput,
    h('label', { class: 'lbl', for: 'route-km' }, 'Kilometer (einfache Strecke)'),
    kmInput,
    h('label', { class: 'switch-row', for: 'route-round' },
      h('span', null, h('strong', null, 'Hin- und Rückfahrt'),
        h('span', { class: 'hint', style: 'display:block; margin: 2px 0 0' }, 'Beim Auswählen werden die km verdoppelt.')),
      roundBox),
    h('label', { class: 'lbl', for: 'route-purpose' }, 'Zweck (optional)'),
    purposeInput,
    errorBox,
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn primary block', onclick: save }, 'Speichern'),
      !isNew ? h('button', { type: 'button', class: 'btn-text danger', onclick: remove }, 'Strecke löschen') : null),
  );
  if (isNew) nameInput.focus();
}
