// Pista ovalada tipo "estadio": dos rectas + dos semicírculos.
// Coordenadas 2D (x, y). En 3D se dibuja como (x, 0, -y).
// Sentido de carrera: antihorario. La meta está en (0, -radius).

export class OvalTrack {
  constructor({ straight = 400, radius = 120, width = 20 } = {}) {
    this.straight = straight;
    this.radius = radius;
    this.width = width;
    this.halfWidth = width / 2;
    this.arc = Math.PI * radius;
    this.length = 2 * straight + 2 * this.arc;
  }

  // Punto de la línea central a una distancia s (metros desde la meta).
  pointAt(s) {
    const { straight: L, radius: R, arc } = this;
    s = ((s % this.length) + this.length) % this.length;
    const h = L / 2;
    if (s < h) return { x: s, y: -R, heading: 0, curvature: 0, turn: 0 };
    s -= h;
    if (s < arc) {
      const a = -Math.PI / 2 + s / R;
      return { x: h + R * Math.cos(a), y: R * Math.sin(a), heading: a + Math.PI / 2, curvature: 1 / R, turn: 1 / R };
    }
    s -= arc;
    if (s < L) return { x: h - s, y: R, heading: Math.PI, curvature: 0, turn: 0 };
    s -= L;
    if (s < arc) {
      const a = Math.PI / 2 + s / R;
      return { x: -h + R * Math.cos(a), y: R * Math.sin(a), heading: a + Math.PI / 2, curvature: 1 / R, turn: 1 / R };
    }
    s -= arc;
    return { x: -h + s, y: -R, heading: 0, curvature: 0, turn: 0 };
  }

  // Proyecta un punto sobre la pista.
  // s: distancia a lo largo de la pista, d: distancia lateral (+ hacia afuera),
  // nx, ny: normal hacia afuera.
  project(x, y) {
    const { straight: L, radius: R, arc } = this;
    const h = L / 2;
    if (x >= -h && x <= h) {
      if (y < 0) return { s: x >= 0 ? x : this.length + x, d: -y - R, nx: 0, ny: -1 };
      return { s: h + arc + (h - x), d: y - R, nx: 0, ny: 1 };
    }
    const cx = x > h ? h : -h;
    const dx = x - cx;
    const dy = y;
    const r = Math.hypot(dx, dy) || 1e-6;
    const nx = dx / r;
    const ny = dy / r;
    const ang = Math.atan2(dy, dx);
    let s;
    if (cx > 0) {
      s = h + (ang + Math.PI / 2) * R; // ang en [-pi/2, pi/2]
    } else {
      let a = ang - Math.PI / 2; // [0, pi] en la curva izquierda
      if (a < 0) a += 2 * Math.PI;
      s = h + arc + L + a * R;
    }
    return { s, d: r - R, nx, ny };
  }
}

// Caja que contiene la pista (para el piso y la cámara del menú).
export function trackBounds(track) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let s = 0; s < track.length; s += 5) {
    const p = track.pointAt(s);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const m = track.halfWidth + 30;
  return { minX: minX - m, maxX: maxX + m, minY: minY - m, maxY: maxY + m };
}

// Diferencia de distancia envuelta a [-length/2, length/2].
export function wrapDelta(ds, length) {
  if (ds > length / 2) return ds - length;
  if (ds < -length / 2) return ds + length;
  return ds;
}

// Pista general: curva cerrada suave (Catmull-Rom) que pasa por puntos de
// control. Se re-muestrea a pasos iguales para que pointAt/project sean rápidos.
// Misma interfaz que OvalTrack: length, halfWidth, pointAt(s), project(x, y).
// d > 0 = a la derecha del sentido de carrera.
export class PathTrack {
  constructor({ points, width = 18, step = 2 }) {
    this.width = width;
    this.halfWidth = width / 2;
    this.step = step;

    // 1) Curva densa por Catmull-Rom.
    const n = points.length;
    const dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        const c = (a, b, c2, d) =>
          0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
        dense.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    // 2) Largo acumulado y re-muestreo a pasos iguales.
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1];
      const b = dense[i % dense.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[cum.length - 1];
    const count = Math.round(total / step);
    this.length = total;
    this.step = total / count;
    this.xs = new Float64Array(count);
    this.ys = new Float64Array(count);
    let j = 0;
    for (let i = 0; i < count; i++) {
      const s = i * this.step;
      while (cum[j + 1] < s) j++;
      const a = dense[j];
      const b = dense[(j + 1) % dense.length];
      const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      this.xs[i] = a[0] + (b[0] - a[0]) * t;
      this.ys[i] = a[1] + (b[1] - a[1]) * t;
    }
    // 3) Rumbo y curvatura (suavizada en ±10 m para que la IA vea venir la curva).
    this.headings = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count;
      this.headings[i] = Math.atan2(this.ys[k] - this.ys[i], this.xs[k] - this.xs[i]);
    }
    const win = Math.max(1, Math.round(10 / this.step));
    this.curvatures = new Float64Array(count);
    this.turns = new Float64Array(count); // con signo: + = curva a la izquierda
    for (let i = 0; i < count; i++) {
      let d = this.headings[(i + win) % count] - this.headings[(i - win + count) % count];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.turns[i] = d / (2 * win * this.step);
      this.curvatures[i] = Math.abs(this.turns[i]);
    }
    // 4) Rejilla espacial de segmentos para project().
    this.cell = 25;
    this.grid = new Map();
    const reach = this.halfWidth + 15;
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count;
      const x0 = Math.min(this.xs[i], this.xs[k]) - reach;
      const x1 = Math.max(this.xs[i], this.xs[k]) + reach;
      const y0 = Math.min(this.ys[i], this.ys[k]) - reach;
      const y1 = Math.max(this.ys[i], this.ys[k]) + reach;
      for (let cx = Math.floor(x0 / this.cell); cx <= Math.floor(x1 / this.cell); cx++) {
        for (let cy = Math.floor(y0 / this.cell); cy <= Math.floor(y1 / this.cell); cy++) {
          const key = cx * 100003 + cy;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(i);
        }
      }
    }
  }

  pointAt(s) {
    const count = this.xs.length;
    s = ((s % this.length) + this.length) % this.length;
    const f = s / this.step;
    const i = Math.floor(f) % count;
    const k = (i + 1) % count;
    const t = f - Math.floor(f);
    let dh = this.headings[k] - this.headings[i];
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    return {
      x: this.xs[i] + (this.xs[k] - this.xs[i]) * t,
      y: this.ys[i] + (this.ys[k] - this.ys[i]) * t,
      heading: this.headings[i] + dh * t,
      curvature: this.curvatures[i] + (this.curvatures[k] - this.curvatures[i]) * t,
      turn: this.turns[i] + (this.turns[k] - this.turns[i]) * t,
    };
  }

  project(x, y) {
    const count = this.xs.length;
    const key = Math.floor(x / this.cell) * 100003 + Math.floor(y / this.cell);
    const near = this.grid.get(key);
    let best = Infinity;
    let out = null;
    const test = (i) => {
      const k = (i + 1) % count;
      const ax = this.xs[i];
      const ay = this.ys[i];
      const dx = this.xs[k] - ax;
      const dy = this.ys[k] - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const px = ax + dx * t;
      const py = ay + dy * t;
      const dist2 = (x - px) ** 2 + (y - py) ** 2;
      if (dist2 < best) {
        best = dist2;
        const len = Math.sqrt(len2);
        const nx = dy / len; // normal derecha
        const ny = -dx / len;
        out = { s: (i + t) * this.step, d: (x - px) * nx + (y - py) * ny, nx, ny };
      }
    };
    if (near) for (const i of near) test(i);
    else for (let i = 0; i < count; i++) test(i);
    return out;
  }
}
