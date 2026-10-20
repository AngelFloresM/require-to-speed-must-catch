// Asignación de controles (teclado y control). Lógica pura, sin DOM,
// para poder probarla en Node.
//
// Cada acción tiene 2 teclas y 1 entrada del control:
//   keys: ['KeyW', 'ArrowUp']     (códigos de KeyboardEvent.code, o null)
//   pad:  { type: 'button', index } | { type: 'axis', index, dir: 1 | -1 } | null

export const ACTIONS = [
  { id: 'throttle', label: 'Acelerar' },
  { id: 'brake', label: 'Frenar / reversa' },
  { id: 'steerLeft', label: 'Girar a la izquierda' },
  { id: 'steerRight', label: 'Girar a la derecha' },
  { id: 'handbrake', label: 'Freno de mano' },
  { id: 'nitro', label: 'Nitro' },
  { id: 'shiftUp', label: 'Subir marcha' },
  { id: 'shiftDown', label: 'Bajar marcha' },
  { id: 'camera', label: 'Cámara' },
  { id: 'reset', label: 'Volver a la pista' },
  { id: 'pause', label: 'Pausa' },
  { id: 'map', label: 'Mapa (modo libre)' },
  { id: 'tune', label: 'Tuneo de física' },
];

const btn = (index) => ({ type: 'button', index });

export const DEFAULT_BINDINGS = {
  throttle: { keys: ['KeyW', 'ArrowUp'], pad: btn(7) },
  brake: { keys: ['KeyS', 'ArrowDown'], pad: btn(6) },
  steerLeft: { keys: ['KeyA', 'ArrowLeft'], pad: { type: 'axis', index: 0, dir: -1 } },
  steerRight: { keys: ['KeyD', 'ArrowRight'], pad: { type: 'axis', index: 0, dir: 1 } },
  handbrake: { keys: ['Space', null], pad: btn(0) },
  nitro: { keys: ['ShiftLeft', 'ShiftRight'], pad: btn(2) },
  shiftUp: { keys: ['KeyE', null], pad: btn(5) },
  shiftDown: { keys: ['KeyQ', null], pad: btn(4) },
  camera: { keys: ['KeyC', null], pad: btn(8) },
  reset: { keys: ['KeyR', null], pad: btn(3) },
  pause: { keys: ['Escape', 'KeyP'], pad: btn(9) },
  map: { keys: ['KeyM', null], pad: btn(12) },
  tune: { keys: ['KeyT', null], pad: btn(13) },
};

const clone = (b) => JSON.parse(JSON.stringify(b));

export function defaultBindings() {
  return clone(DEFAULT_BINDINGS);
}

// Carga lo guardado y rellena con los valores por defecto lo que falte o esté mal.
export function parseBindings(json) {
  const out = defaultBindings();
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return out;
  }
  if (!saved || typeof saved !== 'object') return out;
  for (const { id } of ACTIONS) {
    const b = saved[id];
    if (!b) continue;
    if (Array.isArray(b.keys)) out[id].keys = [0, 1].map((i) => (typeof b.keys[i] === 'string' ? b.keys[i] : null));
    if (b.pad === null || isValidPad(b.pad)) out[id].pad = b.pad;
  }
  return out;
}

function isValidPad(p) {
  return p && Number.isInteger(p.index) && (p.type === 'button' || (p.type === 'axis' && (p.dir === 1 || p.dir === -1)));
}

const samePad = (a, b) => a && b && a.type === b.type && a.index === b.index && (a.type === 'button' || a.dir === b.dir);

// Asigna una tecla. Si otra acción la usaba, se le quita.
// Devuelve la etiqueta de la acción afectada (o null).
export function assignKey(bindings, action, slot, code) {
  let moved = null;
  for (const { id, label } of ACTIONS) {
    bindings[id].keys = bindings[id].keys.map((k, i) => {
      if (k === code && !(id === action && i === slot)) {
        if (id !== action) moved = label;
        return null;
      }
      return k;
    });
  }
  bindings[action].keys[slot] = code;
  return moved;
}

export function assignPad(bindings, action, pad) {
  let moved = null;
  for (const { id, label } of ACTIONS) {
    if (id !== action && samePad(bindings[id].pad, pad)) {
      bindings[id].pad = null;
      moved = label;
    }
  }
  bindings[action].pad = pad;
  return moved;
}

export function unbindKey(bindings, action, slot) {
  bindings[action].keys[slot] = null;
}

export function unbindPad(bindings, action) {
  bindings[action].pad = null;
}

// Nombres legibles.
const KEY_NAMES = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Espacio', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.',
  ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt izq.', AltRight: 'Alt der.',
  Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Borrar',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Cruceta ↑', 'Cruceta ↓', 'Cruceta ←', 'Cruceta →', 'Guía'];
const PAD_AXES = [['Stick izq.', '←', '→'], ['Stick izq.', '↑', '↓'], ['Stick der.', '←', '→'], ['Stick der.', '↑', '↓']];

export function padLabel(pad) {
  if (!pad) return '—';
  if (pad.type === 'button') return PAD_BUTTONS[pad.index] ?? `Botón ${pad.index}`;
  const axis = PAD_AXES[pad.index];
  if (!axis) return `Eje ${pad.index} ${pad.dir > 0 ? '+' : '−'}`;
  return `${axis[0]} ${pad.dir > 0 ? axis[2] : axis[1]}`;
}

// Valor 0..1 de una entrada del control.
export function padValue(gamepad, pad, deadzone = 0.15) {
  if (!gamepad || !pad) return 0;
  if (pad.type === 'button') return gamepad.buttons[pad.index]?.value ?? 0;
  const v = (gamepad.axes[pad.index] ?? 0) * pad.dir;
  return v > deadzone ? (v - deadzone) / (1 - deadzone) : 0;
}
