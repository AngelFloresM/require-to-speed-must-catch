// Navegar los menús con el control (y con ↑ ↓ del teclado).
// - Cruceta o stick izquierdo: mover entre opciones (hacia la más cercana en esa dirección).
// - A: aceptar.  B: volver.  LB / RB: carro anterior / siguiente en el garaje.
// - Izquierda / derecha sobre una lista (select): cambia el valor.
import { getGamepad, isCapturing } from '../input.js';
import { pickNext } from './spatialNav.js';

const FIRST_REPEAT = 0.4; // s antes de repetir al mantener
const REPEAT = 0.14;

const visibleScreen = () => [...document.querySelectorAll('.screen')].find((s) => !s.classList.contains('hidden'));

function focusables(root) {
  return [...root.querySelectorAll('button, select')].filter((el) => !el.disabled && el.offsetParent !== null);
}

export class MenuNav {
  constructor({ onBack, onCar }) {
    this.onBack = onBack; // (screenId) => void
    this.onCar = onCar; // (dir) => void
    this.prev = [];
    this.holdDir = null;
    this.holdTime = 0;
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
      const screen = visibleScreen();
      if (!screen || document.activeElement?.tagName === 'SELECT') return;
      e.preventDefault();
      this.move(screen, 0, e.code === 'ArrowUp' ? -1 : 1);
    });
  }

  move(screen, dx, dy) {
    const list = focusables(screen);
    if (!list.length) return;
    const cur = document.activeElement;
    if (!list.includes(cur)) {
      list[0].focus();
      return;
    }
    // Izquierda / derecha sobre una lista: cambia el valor.
    if (dx && cur.tagName === 'SELECT') {
      const i = cur.selectedIndex + dx;
      if (i >= 0 && i < cur.options.length) {
        cur.selectedIndex = i;
        cur.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    const others = list.filter((el) => el !== cur);
    const k = pickNext(cur.getBoundingClientRect(), others.map((el) => el.getBoundingClientRect()), dx, dy);
    if (k >= 0) others[k].focus();
  }

  update(dt) {
    const pad = getGamepad();
    const screen = visibleScreen();
    if (!pad || !screen || isCapturing()) {
      this.prev = pad ? pad.buttons.map((b) => b.pressed) : [];
      this.holdDir = null;
      return;
    }
    const down = pad.buttons.map((b) => b.pressed);
    const before = this.prev;
    const pressed = (i) => down[i] && !before[i];
    this.prev = down;

    // Dirección: cruceta o stick.
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    let dir = null;
    if (down[12] || ay < -0.6) dir = 'up';
    else if (down[13] || ay > 0.6) dir = 'down';
    else if (down[14] || ax < -0.6) dir = 'left';
    else if (down[15] || ax > 0.6) dir = 'right';
    if (dir !== this.holdDir) {
      this.holdDir = dir;
      this.holdTime = 0;
      if (dir) this.step(screen, dir);
    } else if (dir) {
      this.holdTime += dt;
      if (this.holdTime > FIRST_REPEAT) {
        this.holdTime -= REPEAT;
        this.step(screen, dir);
      }
    }

    if (pressed(0)) {
      const el = document.activeElement;
      if (screen.contains(el) && el.tagName === 'BUTTON') el.click();
      else focusables(screen)[0]?.focus();
    }
    if (pressed(1)) this.onBack(screen.id);
    if (screen.id === 'garage') {
      if (pressed(4)) this.onCar(-1);
      if (pressed(5)) this.onCar(1);
    }
  }

  step(screen, dir) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    this.move(screen, d[0], d[1]);
  }
}
