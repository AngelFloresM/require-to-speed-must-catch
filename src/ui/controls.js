// Pantalla de controles: asignar y quitar teclas y botones del control.
import { ACTIONS, assignKey, assignPad, unbindKey, unbindPad, keyLabel, padLabel, defaultBindings } from '../bindings.js';
import { getBindings, saveBindings, captureKey, captureGamepad, cancelCapture, getGamepad } from '../input.js';

const $ = (id) => document.getElementById(id);

function cell(action, kind, slot, label) {
  const unbound = label === '—';
  return `<td><div class="bind-cell">
    <button class="bind" data-action="${action}" data-kind="${kind}" data-slot="${slot}">${label}</button>
    <button class="unbind" data-action="${action}" data-kind="${kind}" data-slot="${slot}" title="Quitar" ${unbound ? 'disabled' : ''}>×</button>
  </div></td>`;
}

export function renderControls(message = '') {
  const b = getBindings();
  const pad = getGamepad();
  $('controls-table').innerHTML =
    '<tr><th>Acción</th><th>Tecla 1</th><th>Tecla 2</th><th>Control</th></tr>' +
    ACTIONS.map(({ id, label }) =>
      `<tr><td>${label}</td>${cell(id, 'key', 0, keyLabel(b[id].keys[0]))}${cell(id, 'key', 1, keyLabel(b[id].keys[1]))}${cell(id, 'pad', 0, padLabel(b[id].pad))}</tr>`,
    ).join('');
  $('controls-msg').textContent = message || (pad ? `Control conectado: ${pad.id}` : 'Conecta un control y presiona un botón para usarlo.');
}

export function initControls() {
  $('controls-table').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const { action, kind } = t.dataset;
    const slot = Number(t.dataset.slot);
    const b = getBindings();
    const name = ACTIONS.find((a) => a.id === action).label;

    if (t.classList.contains('unbind')) {
      if (kind === 'key') unbindKey(b, action, slot);
      else unbindPad(b, action);
      saveBindings(b);
      renderControls(`Se quitó de "${name}".`);
      return;
    }

    t.textContent = kind === 'key' ? 'Presiona una tecla…' : 'Mueve el control…';
    t.classList.add('listening');
    $('controls-msg').textContent = 'Esc para cancelar.';
    const result = kind === 'key' ? await captureKey() : await captureGamepad();
    if (result === null) return renderControls('Cancelado.');
    const moved = kind === 'key' ? assignKey(b, action, slot, result) : assignPad(b, action, result);
    saveBindings(b);
    const what = kind === 'key' ? keyLabel(result) : padLabel(result);
    renderControls(moved ? `${what} asignado a "${name}" (se quitó de "${moved}").` : `${what} asignado a "${name}".`);
  });

  $('controls-reset').addEventListener('click', () => {
    saveBindings(defaultBindings());
    renderControls('Controles restablecidos.');
  });

  window.addEventListener('gamepadconnected', () => renderControls());
  window.addEventListener('gamepaddisconnected', () => renderControls());
}

export function leaveControls() {
  cancelCapture();
}
