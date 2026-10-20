// Lee teclado y control según la asignación del jugador (src/bindings.js).

import { ACTIONS, parseBindings, padValue } from './bindings.js';

const STORAGE_KEY = 'bindings';
const PRESS_ACTIONS = ['shiftUp', 'shiftDown', 'camera', 'reset', 'pause', 'map', 'tune'];

let bindings = load();
const keys = new Set();
const pressedKeys = new Set(); // teclas que bajaron en este frame
let padPrev = {};
let capture = null; // { kind: 'key' | 'pad', resolve, baseline }

function load() {
  try {
    return parseBindings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseBindings(null);
  }
}

export function getBindings() {
  return bindings;
}

export function saveBindings(next) {
  bindings = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {}
}

export const getGamepad = () => navigator.getGamepads?.().find((p) => p) ?? null;

window.addEventListener('keydown', (e) => {
  if (capture?.kind === 'key') {
    e.preventDefault();
    const c = capture;
    capture = null;
    c.resolve(e.code === 'Escape' ? null : e.code); // Esc cancela
    return;
  }
  if (!keys.has(e.code)) pressedKeys.add(e.code);
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Espera la siguiente tecla (resuelve con el código, o null si se cancela con Esc).
export function captureKey() {
  cancelCapture();
  return new Promise((resolve) => (capture = { kind: 'key', resolve }));
}

// Espera el siguiente botón o eje que se mueva en el control.
export function captureGamepad() {
  cancelCapture();
  const pad = getGamepad();
  return new Promise((resolve) => {
    capture = {
      kind: 'pad',
      resolve,
      baseline: pad ? { buttons: pad.buttons.map((b) => b.value), axes: [...pad.axes] } : null,
    };
  });
}

export function cancelCapture() {
  if (capture) {
    const c = capture;
    capture = null;
    c.resolve(null);
  }
}

function pollCapture(pad) {
  if (capture?.kind !== 'pad' || !pad) return;
  if (!capture.baseline) capture.baseline = { buttons: pad.buttons.map((b) => b.value), axes: [...pad.axes] };
  const base = capture.baseline;
  let found = null;
  pad.buttons.forEach((b, i) => {
    if (!found && b.value > 0.5 && (base.buttons[i] ?? 0) < 0.3) found = { type: 'button', index: i };
  });
  pad.axes.forEach((v, i) => {
    const d = v - (base.axes[i] ?? 0);
    if (!found && Math.abs(d) > 0.6) found = { type: 'axis', index: i, dir: d > 0 ? 1 : -1 };
  });
  if (found) {
    const c = capture;
    capture = null;
    c.resolve(found);
  }
}

export function isCapturing() {
  return capture !== null;
}

function value(action, pad) {
  const b = bindings[action];
  const key = b.keys.some((k) => k && keys.has(k)) ? 1 : 0;
  return Math.max(key, padValue(pad, b.pad));
}

export function readInput() {
  const pad = getGamepad();
  pollCapture(pad);
  const actions = new Set();
  if (capture) {
    pressedKeys.clear();
    return { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, actions };
  }
  for (const id of PRESS_ACTIONS) {
    const b = bindings[id];
    if (b.keys.some((k) => k && pressedKeys.has(k))) actions.add(id);
    const down = padValue(pad, b.pad) > 0.5;
    if (down && !padPrev[id]) actions.add(id);
    padPrev[id] = down;
  }
  // Esc siempre pausa, aunque se haya quitado de la asignación.
  if (pressedKeys.has('Escape') && !ACTIONS.some(({ id }) => bindings[id].keys.includes('Escape'))) actions.add('pause');
  pressedKeys.clear();
  return {
    throttle: value('throttle', pad),
    brake: value('brake', pad),
    steer: value('steerLeft', pad) - value('steerRight', pad),
    handbrake: value('handbrake', pad) > 0.5,
    nitro: value('nitro', pad) > 0.5,
    actions,
  };
}

export { ACTIONS };
