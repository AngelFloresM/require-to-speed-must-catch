// Tráfico ligero: carros que siguen carriles del grafo de la ciudad.
// - Manejan por la derecha; en calles de un sentido, por el centro.
// - Solo entran a una arista en su sentido permitido.
// - Guardan distancia (modelo IDM) con quien vaya adelante, incluido el jugador.
// - Se detienen en rojo (y en amarillo si alcanzan a frenar).
// - En cruces sin semáforo, esperan si el cruce está ocupado.
// Movimiento cinemático (sin física) salvo cuando el jugador los choca:
// el golpe los desplaza y los hace girar; se detienen un momento y luego
// regresan poco a poco a su carril.
import { lightFor } from './signals.js';
import { drivableGap } from './city.js';

const IDM = { a: 2.0, b: 3.0, s0: 2.5, T: 1.2 };
const LOOK = 40; // m que miran hacia adelante
const KNOCK_DECEL = 7; // m/s² de frenado al ser empujado (llantas arrastrando)
const KNOCK_SPIN_DAMP = 3; // 1/s, se apaga el giro
const RETURN_RATE = 0.8; // 1/s, qué tan rápido regresa a su carril

const allowed = (edge, dir) => edge.road.oneway === 0 || edge.road.oneway === dir;
const laneOffset = (edge) => (edge.road.oneway === 0 ? edge.road.width / 4 : 0);

// Distancia libre antes del nodo (para no pararse dentro del cruce).
function clearOf(node) {
  return Math.max(...node.edges.map((e) => e.road.width / 2)) + 2;
}

function pathPoint(path, d) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (acc + len >= d || i === path.length - 2) {
      const t = Math.max(0, Math.min(1, (d - acc) / (len || 1)));
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, h: Math.atan2(by - ay, bx - ax) };
    }
    acc += len;
  }
  return { x: path[0][0], y: path[0][1], h: 0 };
}

// Punto del carril a distancia s en el sentido de viaje.
export function lanePoint(edge, dir, s) {
  const p = pathPoint(edge.path, dir > 0 ? s : edge.length - s);
  const h = dir > 0 ? p.h : p.h + Math.PI;
  const off = laneOffset(edge);
  return { x: p.x + Math.sin(h) * off, y: p.y - Math.cos(h) * off, h };
}

const endNode = (edge, dir) => (dir > 0 ? edge.b : edge.a);
const startNode = (edge, dir) => (dir > 0 ? edge.a : edge.b);

export class Traffic {
  constructor(city, { count = 24, seed = 3, avoid = null } = {}) {
    this.city = city;
    this.time = 0;
    let s = seed;
    this.rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.cars = [];
    this.spawnable = city.edges.filter((e) => e.length > 40);
    for (let i = 0; i < count; i++) {
      const c = { id: i, speed: 0, stun: 0, x: 0, y: 0, h: 0 };
      this.respawn(c, avoid);
      this.cars.push(c);
    }
  }

  // Coloca un carro en una arista al azar, lejos de `avoid` y de otros carros.
  respawn(c, avoid) {
    for (let tries = 0; tries < 50; tries++) {
      const edge = this.spawnable[Math.floor(this.rand() * this.spawnable.length)];
      const dirs = [1, -1].filter((d) => allowed(edge, d));
      const dir = dirs[Math.floor(this.rand() * dirs.length)];
      const s = clearOf(startNode(edge, dir)) + this.rand() * Math.max(1, edge.length - 2 * clearOf(endNode(edge, dir)));
      const p = lanePoint(edge, dir, s);
      if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < 80) continue;
      if (this.cars.some((o) => o !== c && Math.hypot(o.x - p.x, o.y - p.y) < 12)) continue;
      Object.assign(c, { edge, dir, s, turn: null, speed: 4, x: p.x, y: p.y, h: p.h, stun: 0, knock: null, dev: null, base: null });
      return;
    }
  }

  // Elige la siguiente arista al llegar a un nodo (prefiere seguir derecho).
  chooseNext(c) {
    const node = endNode(c.edge, c.dir);
    if (node.boundary) return null; // sale del mapa
    const inH = lanePoint(c.edge, c.dir, c.edge.length).h;
    const options = [];
    for (const e of node.edges) {
      if (e === c.edge) continue;
      const dir = e.a === node ? 1 : -1;
      if (!allowed(e, dir)) continue;
      const outH = lanePoint(e, dir, 0).h;
      const straight = Math.cos(outH - inH);
      options.push({ e, dir, w: straight > 0.7 ? 3 : 1 });
    }
    if (!options.length) {
      // Sin salida: vuelta en U si la calle es de doble sentido.
      return allowed(c.edge, -c.dir) ? { e: c.edge, dir: -c.dir } : null;
    }
    let r = this.rand() * options.reduce((a, o) => a + o.w, 0);
    for (const o of options) if ((r -= o.w) <= 0) return o;
    return options[options.length - 1];
  }

  // Distancia libre al obstáculo más cercano adelante (carro o alto) y su velocidad.
  leader(c, others) {
    let gap = LOOK;
    let vLead = c.speed;
    const fx = Math.cos(c.h);
    const fy = Math.sin(c.h);
    for (const o of others) {
      if (o === c) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const fwd = dx * fx + dy * fy;
      if (fwd <= 0 || fwd > LOOK) continue;
      const lat = -dx * fy + dy * fx;
      if (Math.abs(lat) > 2.2) continue;
      const g = fwd - 4.6; // largo del carro
      if (g < gap) {
        gap = g;
        // Velocidad del otro en nuestra dirección.
        vLead = Math.max(0, (o.vx ?? Math.cos(o.h) * o.speed) * fx + (o.vy ?? Math.sin(o.h) * o.speed) * fy);
      }
    }
    // Semáforo o cruce ocupado al final de la arista.
    if (!c.turn) {
      const node = endNode(c.edge, c.dir);
      const stopAt = c.edge.length - clearOf(node);
      const dist = stopAt - c.s;
      if (dist > -0.5 && dist < LOOK) {
        const light = lightFor(node, c.edge, this.time);
        let stop = false;
        if (light === 'red') stop = true;
        else if (light === 'yellow') stop = dist > (c.speed * c.speed) / (2 * IDM.b) - 1;
        else if (!light) stop = this.crossingBusy(c, node, others);
        if (stop && dist < gap) {
          gap = Math.max(0, dist);
          vLead = 0;
        }
      }
    }
    return { gap, vLead };
  }

  // ¿Hay otro carro dentro del cruce (que no venga detrás de mí)?
  crossingBusy(c, node, others) {
    const r = clearOf(node);
    return others.some((o) => o !== c && o.turn?.node === node && Math.hypot(o.x - node.x, o.y - node.y) < r + 2);
  }

  // Golpe del jugador: body es el cuerpo físico tras el choque (posición,
  // velocidad y giro). El carro queda fuera de su carril por la diferencia.
  push(c, body) {
    const b = c.base ?? { x: c.x, y: c.y, h: c.h };
    c.dev = { x: body.x - b.x, y: body.y - b.y, h: body.heading - b.h };
    c.x = body.x;
    c.y = body.y;
    c.knock = { vx: body.vx, vy: body.vy, w: body.yawRate };
    c.speed = 0;
    c.stun = 2.5; // el otro conductor se detiene un momento
  }

  // Movimiento libre tras un golpe: se desliza frenando y choca con la banqueta.
  slide(c, dt) {
    const k = c.knock;
    const v = Math.hypot(k.vx, k.vy);
    const nv = Math.max(0, v - KNOCK_DECEL * dt);
    k.vx *= v > 0 ? nv / v : 0;
    k.vy *= v > 0 ? nv / v : 0;
    k.w *= Math.exp(-KNOCK_SPIN_DAMP * dt);
    c.dev.x += k.vx * dt;
    c.dev.y += k.vy * dt;
    c.dev.h += k.w * dt;
    const x = c.base.x + c.dev.x;
    const y = c.base.y + c.dev.y;
    const g = drivableGap(this.city, x, y);
    // Centro a más de ~1 m de la orilla: lo regresa y frena lo que iba hacia afuera.
    if (g && g.gap > -1) {
      const pen = g.gap + 1;
      c.dev.x += g.nx * pen;
      c.dev.y += g.ny * pen;
      const vn = k.vx * g.nx + k.vy * g.ny;
      if (vn < 0) {
        k.vx -= vn * g.nx * 1.2;
        k.vy -= vn * g.ny * 1.2;
      }
    }
    if (nv < 0.2 && Math.abs(k.w) < 0.05) c.knock = null;
    else c.stun = Math.max(c.stun, 0.5);
  }

  // others: carros de tráfico + jugador ({x, y, vx, vy, h}).
  step(dt, player = null) {
    this.time += dt;
    const all = player ? [...this.cars, player] : this.cars;
    for (const c of this.cars) {
      // Trabaja sobre la pose del carril; al final suma la desviación del golpe.
      if (c.base) Object.assign(c, { x: c.base.x, y: c.base.y, h: c.base.h });
      this.drive(c, dt, all);
      c.base = { x: c.x, y: c.y, h: c.h };
      if (!c.dev) continue;
      if (c.knock) this.slide(c, dt);
      else if (c.speed > 1) {
        const k = Math.exp(-RETURN_RATE * dt);
        c.dev.x *= k;
        c.dev.y *= k;
        c.dev.h = Math.atan2(Math.sin(c.dev.h), Math.cos(c.dev.h)) * k * k;
        if (Math.hypot(c.dev.x, c.dev.y) < 0.05 && Math.abs(c.dev.h) < 0.01) c.dev = null;
      }
      if (c.dev) {
        c.x += c.dev.x;
        c.y += c.dev.y;
        c.h += c.dev.h;
      }
    }
  }

  drive(c, dt, all) {
    if (c.stun > 0) {
      c.stun -= dt;
      c.speed = 0;
      return;
    }
    const v0 = c.turn ? 6 : c.edge.road.major ? 13.9 : 8.3; // 50 / 30 km/h, 22 km/h al dar vuelta
    const { gap, vLead } = this.leader(c, all);
    const dv = c.speed - vLead;
    const sStar = IDM.s0 + Math.max(0, c.speed * IDM.T + (c.speed * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
    let acc = IDM.a * (1 - (c.speed / v0) ** 4 - (sStar / Math.max(gap, 0.1)) ** 2);
    acc = Math.max(-9, Math.min(IDM.a, acc));
    c.speed = Math.max(0, c.speed + acc * dt);
    if (gap < 0.3) c.speed = Math.min(c.speed, 0.5);
    this.advance(c, c.speed * dt);
  }

  advance(c, ds) {
    if (c.turn) {
      const t = c.turn;
      t.t += ds / t.len;
      if (t.t >= 1) {
        const over = (t.t - 1) * t.len;
        c.edge = t.edge;
        c.dir = t.dir;
        c.s = t.s0 + over;
        c.turn = null;
      } else {
        const u = t.t;
        const k0 = (1 - u) * (1 - u);
        const k1 = 2 * (1 - u) * u;
        const k2 = u * u;
        c.x = k0 * t.p0.x + k1 * t.p1.x + k2 * t.p2.x;
        c.y = k0 * t.p0.y + k1 * t.p1.y + k2 * t.p2.y;
        const dx = 2 * (1 - u) * (t.p1.x - t.p0.x) + 2 * u * (t.p2.x - t.p1.x);
        const dy = 2 * (1 - u) * (t.p1.y - t.p0.y) + 2 * u * (t.p2.y - t.p1.y);
        c.h = Math.atan2(dy, dx);
        return;
      }
    }
    c.s += ds;
    const node = endNode(c.edge, c.dir);
    const exitAt = c.edge.length - clearOf(node);
    if (c.s >= exitAt) {
      const next = this.chooseNext(c);
      if (!next) {
        this.respawn(c, this.lastPlayer);
        return;
      }
      // Curva suave (Bézier) a través del cruce hasta el carril de salida.
      const p0 = lanePoint(c.edge, c.dir, exitAt);
      const s0 = clearOf(node);
      const p2 = lanePoint(next.e, next.dir, s0);
      const p1 = { x: (p0.x + p2.x) / 2 * 0.5 + node.x * 0.5, y: (p0.y + p2.y) / 2 * 0.5 + node.y * 0.5 };
      const len = Math.max(1, Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y));
      c.turn = { p0, p1, p2, len, t: 0, edge: next.e, dir: next.dir, s0, node };
      return;
    }
    const p = lanePoint(c.edge, c.dir, c.s);
    c.x = p.x;
    c.y = p.y;
    c.h = p.h;
  }
}
