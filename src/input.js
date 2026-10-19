// Teclado + control (gamepad). Devuelve valores normalizados.

const keys = new Set();
const pressed = new Set(); // teclas presionadas en este frame

window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const any = (...codes) => codes.some((c) => keys.has(c));

let padPrev = [];

export function readInput() {
  let throttle = any('KeyW', 'ArrowUp') ? 1 : 0;
  let brake = any('KeyS', 'ArrowDown') ? 1 : 0;
  let steer = (any('KeyA', 'ArrowLeft') ? 1 : 0) - (any('KeyD', 'ArrowRight') ? 1 : 0);
  let handbrake = keys.has('Space');
  let nitro = any('ShiftLeft', 'ShiftRight');
  const actions = new Set(pressed);
  pressed.clear();

  const pad = navigator.getGamepads?.().find((p) => p);
  if (pad) {
    const b = (i) => pad.buttons[i]?.value ?? 0;
    const ax = pad.axes[0] ?? 0;
    if (Math.abs(ax) > 0.12) steer = -ax;
    throttle = Math.max(throttle, b(7));
    brake = Math.max(brake, b(6));
    handbrake ||= b(0) > 0.5;
    nitro ||= b(2) > 0.5 || b(1) > 0.5;
    const down = pad.buttons.map((x) => x.pressed);
    if (down[9] && !padPrev[9]) actions.add('Escape');
    if (down[3] && !padPrev[3]) actions.add('KeyR');
    if (down[5] && !padPrev[5]) actions.add('KeyC');
    padPrev = down;
  }
  return { throttle, brake, steer, handbrake, nitro, actions };
}
