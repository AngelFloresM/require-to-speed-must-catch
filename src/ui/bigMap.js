// Mapa expandido del modo libre (pausa el juego).
// - Toda la ciudad, con el norte arriba y tu posición.
// - Zoom: rueda del mouse, + / -, gatillos del control (RT acerca, LT aleja).
// - Mover: arrastrar con el mouse, flechas / WASD, stick izquierdo.
// - Centrar en ti: C o botón A. Cerrar: M, Esc, botón B o Back.
const MIN_ZOOM = 0.25; // px por metro
const MAX_ZOOM = 6;

export class BigMap {
  constructor(city, root) {
    this.city = city;
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.open = false;
    this.keys = new Set();
    this.zoom = 0.5;
    this.cx = 0; // centro de la vista (m)
    this.cy = 0;
    this.player = null;
    this.onClose = null;

    // Nombre de cada calle: en su tramo más largo.
    const best = new Map();
    for (const e of city.edges) {
      const prev = best.get(e.road.name);
      if (!prev || e.length > prev.length) best.set(e.road.name, e);
    }
    this.labels = [...best.values()];

    const c = this.canvas;
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.offsetX, ev.offsetY);
    }, { passive: false });
    c.addEventListener('pointerdown', (ev) => {
      this.drag = { x: ev.clientX, y: ev.clientY };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      if (!this.drag) return;
      this.cx -= (ev.clientX - this.drag.x) / this.zoom;
      this.cy += (ev.clientY - this.drag.y) / this.zoom;
      this.drag = { x: ev.clientX, y: ev.clientY };
    });
    c.addEventListener('pointerup', () => (this.drag = null));
    window.addEventListener('keydown', (ev) => {
      if (!this.open) return;
      this.keys.add(ev.code);
      if (['KeyM', 'Escape'].includes(ev.code)) this.close();
      if (ev.code === 'KeyC') this.center();
      if (ev.code === 'Equal' || ev.code === 'NumpadAdd') this.zoomAt(1.25);
      if (ev.code === 'Minus' || ev.code === 'NumpadSubtract') this.zoomAt(1 / 1.25);
      ev.preventDefault();
      ev.stopImmediatePropagation(); // el juego no recibe teclas con el mapa abierto
    }, true);
    window.addEventListener('keyup', (ev) => this.keys.delete(ev.code));
    window.addEventListener('resize', () => this.open && this.resize());
    root.querySelector('[data-map="close"]').addEventListener('click', () => this.close());
    root.querySelector('[data-map="center"]').addEventListener('click', () => this.center());
    root.querySelector('[data-map="in"]').addEventListener('click', () => this.zoomAt(1.25));
    root.querySelector('[data-map="out"]').addEventListener('click', () => this.zoomAt(1 / 1.25));
  }

  show(player) {
    this.player = player;
    this.open = true;
    this.root.classList.remove('hidden');
    this.resize();
    this.center();
    this.padPrev = navigator.getGamepads?.().find((p) => p)?.buttons.map((b) => b.pressed) ?? [];
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.keys.clear();
    this.root.classList.add('hidden');
    this.onClose?.();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width));
    this.canvas.height = Math.max(1, Math.round(r.height));
  }

  center() {
    if (this.player) {
      this.cx = this.player.x;
      this.cy = this.player.y;
    }
  }

  // Zoom manteniendo fijo el punto bajo (sx, sy) en pantalla.
  zoomAt(f, sx = this.canvas.width / 2, sy = this.canvas.height / 2) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * f));
    const wx = this.cx + (sx - this.canvas.width / 2) / this.zoom;
    const wy = this.cy - (sy - this.canvas.height / 2) / this.zoom;
    this.zoom = z;
    this.cx = wx - (sx - this.canvas.width / 2) / z;
    this.cy = wy + (sy - this.canvas.height / 2) / z;
  }

  update(dt) {
    if (!this.open) return;
    // Teclado: mover.
    const pan = 400 / this.zoom; // px de pantalla por segundo, en metros
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.cx -= pan * dt;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.cx += pan * dt;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) this.cy += pan * dt;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) this.cy -= pan * dt;
    // Control.
    const pad = navigator.getGamepads?.().find((p) => p);
    if (pad) {
      const ax = Math.abs(pad.axes[0] ?? 0) > 0.15 ? pad.axes[0] : 0;
      const ay = Math.abs(pad.axes[1] ?? 0) > 0.15 ? pad.axes[1] : 0;
      this.cx += ax * pan * dt;
      this.cy -= ay * pan * dt;
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (rt > 0.1) this.zoomAt(1 + rt * 1.5 * dt);
      if (lt > 0.1) this.zoomAt(1 / (1 + lt * 1.5 * dt));
      const down = pad.buttons.map((b) => b.pressed);
      const pressed = (i) => down[i] && !this.padPrev[i];
      if (pressed(0)) this.center();
      if (pressed(1) || pressed(8) || pressed(9) || pressed(12)) this.close();
      this.padPrev = down;
    }
    // Sin salirse demasiado de la ciudad.
    const b = this.bounds ?? (this.bounds = boundsOf(this.city.boundary));
    this.cx = Math.max(b.minX, Math.min(b.maxX, this.cx));
    this.cy = Math.max(b.minY, Math.min(b.maxY, this.cy));
    this.draw();
  }

  draw() {
    const { ctx, canvas, zoom, city } = this;
    const W = canvas.width;
    const H = canvas.height;
    const X = (x) => W / 2 + (x - this.cx) * zoom;
    const Y = (y) => H / 2 - (y - this.cy) * zoom;
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
    };
    ctx.fillStyle = '#151a1f';
    ctx.fillRect(0, 0, W, H);
    poly(city.boundary);
    ctx.fillStyle = '#2b3138';
    ctx.fill();
    for (const p of city.parks) {
      poly(p.poly);
      ctx.fillStyle = p.plaza ? '#6b6250' : '#2f5a32';
      ctx.fill();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const major of [false, true]) {
      for (const e of city.edges) {
        if (e.road.major !== major) continue;
        ctx.strokeStyle = major ? '#e8c22c' : '#c9ccd1';
        ctx.lineWidth = Math.max(1.5, e.road.width * zoom);
        ctx.beginPath();
        e.path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        ctx.stroke();
      }
    }
    // Nombres de calles cuando hay zoom suficiente.
    if (zoom >= 1) {
      ctx.font = `${Math.min(15, 9 + zoom * 1.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Con más zoom, un nombre por cuadra donde quepa.
      const list = zoom >= 1.5 ? city.edges.filter((e) => e.length * zoom > 150) : this.labels;
      for (const e of list) {
        const i = Math.floor((e.path.length - 1) / 2);
        const m = e.path[i];
        const n = e.path[i + 1];
        const mx = (m[0] + n[0]) / 2;
        const my = (m[1] + n[1]) / 2;
        const sx = X(mx);
        const sy = Y(my);
        if (sx < -100 || sx > W + 100 || sy < -50 || sy > H + 50) continue;
        let ang = -Math.atan2(n[1] - m[1], n[0] - m[0]);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(e.road.name, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(e.road.name, 0, 0);
        ctx.restore();
      }
    }
    // Tú.
    if (this.player) {
      const px = X(this.player.x);
      const py = Y(this.player.y);
      const h = this.player.heading;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-h + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(8, 9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fillStyle = '#4fc3ff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.restore();
    }
    // Escala.
    const meters = niceMeters(120 / zoom);
    ctx.fillStyle = '#fff';
    ctx.fillRect(20, H - 24, meters * zoom, 3);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${meters} m`, 20, H - 32);
  }
}

function boundsOf(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function niceMeters(m) {
  for (const n of [10, 20, 50, 100, 200, 500, 1000]) if (n >= m) return n;
  return 1000;
}
