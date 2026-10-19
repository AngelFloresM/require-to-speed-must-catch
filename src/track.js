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
    if (s < h) return { x: s, y: -R, heading: 0, curvature: 0 };
    s -= h;
    if (s < arc) {
      const a = -Math.PI / 2 + s / R;
      return { x: h + R * Math.cos(a), y: R * Math.sin(a), heading: a + Math.PI / 2, curvature: 1 / R };
    }
    s -= arc;
    if (s < L) return { x: h - s, y: R, heading: Math.PI, curvature: 0 };
    s -= L;
    if (s < arc) {
      const a = Math.PI / 2 + s / R;
      return { x: -h + R * Math.cos(a), y: R * Math.sin(a), heading: a + Math.PI / 2, curvature: 1 / R };
    }
    s -= arc;
    return { x: -h + s, y: -R, heading: 0, curvature: 0 };
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

// Diferencia de distancia envuelta a [-length/2, length/2].
export function wrapDelta(ds, length) {
  if (ds > length / 2) return ds - length;
  if (ds < -length / 2) return ds + length;
  return ds;
}
