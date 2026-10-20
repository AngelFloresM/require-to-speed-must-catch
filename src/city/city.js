// Ciudad del modo libre: grafo de calles e intersecciones (para el tráfico)
// sacado de OpenStreetMap, e índice espacial para colisiones.
// Coordenadas en metros (x = este, y = norte). Sin dependencias de DOM.
import { MAP, BOUNDARY, PARKS, SPAWN } from '../data/tepic.js';

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Punto más cercano sobre el segmento a-b.
function closestOnSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
  return { x: ax + dx * t, y: ay + dy * t, t };
}

const polylineLength = (p) => p.slice(1).reduce((acc, q, i) => acc + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

export function buildCity() {
  const roads = MAP.roads.map((r, id) => ({ ...r, id }));
  const nodes = MAP.nodes.map(([x, y, boundary, signal], id) => ({ id, x, y, edges: [], boundary: !!boundary, osmSignal: !!signal }));
  const edges = MAP.edges.map(([a, b, r, flat], id) => {
    const path = [];
    for (let i = 0; i < flat.length; i += 2) path.push([flat[i], flat[i + 1]]);
    const e = { id, road: roads[r], a: nodes[a], b: nodes[b], path, length: polylineLength(path) };
    nodes[a].edges.push(e);
    nodes[b].edges.push(e);
    return e;
  });
  for (const n of nodes) n.deadEnd = n.edges.length === 1 && !n.boundary;

  const city = { roads, nodes, edges, boundary: BOUNDARY, parks: PARKS };
  city.index = buildIndex(edges);
  city.fillets = buildFillets(nodes);
  city.filletIndex = indexFillets(city.fillets);
  // Salida: en la calle indicada, a media cuadra, lo más cerca del punto pedido.
  const dist = (e) => {
    const m = e.path[Math.floor(e.path.length / 2)];
    return Math.hypot(m[0] - SPAWN.at[0], m[1] - SPAWN.at[1]);
  };
  const edge = edges.filter((e) => SPAWN.road.test(e.road.name) && e.length > 30).sort((a, b) => dist(a) - dist(b))[0];
  const a = edge.path[0];
  const b = edge.path[edge.path.length - 1];
  let heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (edge.road.oneway) heading += edge.road.oneway < 0 ? Math.PI : 0;
  else {
    const want = Math.atan2(SPAWN.toward[1] - SPAWN.at[1], SPAWN.toward[0] - SPAWN.at[0]);
    if (Math.cos(heading - want) < 0) heading += Math.PI;
  }
  const mid = pointAlong(edge.path, edge.length / 2);
  // Doble sentido: del lado derecho.
  const off = edge.road.oneway ? 0 : edge.road.width / 4;
  city.spawn = { x: mid[0] + Math.sin(heading) * off, y: mid[1] - Math.cos(heading) * off, heading };
  return city;
}

function pointAlong(path, d) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (acc + len >= d) {
      const t = (d - acc) / (len || 1);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    acc += len;
  }
  return path[path.length - 1];
}

// Índice espacial: celdas de 30 m con los segmentos de calle cercanos.
const CELL = 30;
function buildIndex(edges) {
  const grid = new Map();
  for (const e of edges) {
    const hw = e.road.width / 2;
    for (let i = 0; i < e.path.length - 1; i++) {
      const a = e.path[i];
      const b = e.path[i + 1];
      const seg = { edge: e, ax: a[0], ay: a[1], bx: b[0], by: b[1], hw };
      const r = hw + CELL;
      for (let cx = Math.floor((Math.min(a[0], b[0]) - r) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + r) / CELL); cx++) {
        for (let cy = Math.floor((Math.min(a[1], b[1]) - r) / CELL); cy <= Math.floor((Math.max(a[1], b[1]) + r) / CELL); cy++) {
          const key = cx * 100003 + cy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(seg);
        }
      }
    }
  }
  return grid;
}

// Calle más cercana a un punto. gap < 0 = dentro de la calle.
// (nx, ny) apunta del punto hacia la calle.
export function nearestRoad(city, x, y) {
  const list = city.index.get(Math.floor(x / CELL) * 100003 + Math.floor(y / CELL));
  if (!list) return null;
  let best = null;
  for (const s of list) {
    const c = closestOnSegment(x, y, s.ax, s.ay, s.bx, s.by);
    const dist = Math.hypot(x - c.x, y - c.y);
    const gap = dist - s.hw;
    if (!best || gap < best.gap) best = { gap, dist, cx: c.x, cy: c.y, edge: s.edge, seg: s };
  }
  return best;
}

// --- Esquinas redondeadas ---
// En cada cruce, entre dos calles vecinas, la esquina de la banqueta se
// redondea con un arco de radio FILLET tangente a ambas orillas. La zona entre
// la esquina "puntiaguda" (K) y el arco se vuelve calle.
export const FILLET = 9;

function buildFillets(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.edges.length < 2 || n.boundary) continue;
    // Dirección de salida de cada arista desde el nodo, ordenadas por ángulo.
    const arms = n.edges.map((e) => {
      const p = e.a === n ? e.path : [...e.path].reverse();
      const dx = p[1][0] - p[0][0];
      const dy = p[1][1] - p[0][1];
      const len = Math.hypot(dx, dy) || 1;
      return { u: [dx / len, dy / len], hw: e.road.width / 2, ang: Math.atan2(dy, dx) };
    }).sort((a, b) => a.ang - b.ang);
    for (let i = 0; i < arms.length; i++) {
      const A = arms[i];
      const B = arms[(i + 1) % arms.length];
      let theta = B.ang - A.ang;
      if (theta <= 0) theta += Math.PI * 2;
      if (theta < 0.35 || theta > 2.8) continue; // casi recta o demasiado cerrada
      // Orilla izquierda de A y orilla derecha de B.
      const nA = [-A.u[1], A.u[0]];
      const nB = [B.u[1], -B.u[0]];
      const pA = [n.x + nA[0] * A.hw, n.y + nA[1] * A.hw];
      const pB = [n.x + nB[0] * B.hw, n.y + nB[1] * B.hw];
      // K = intersección de las dos orillas.
      const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
      if (Math.abs(den) < 1e-6) continue;
      const t = ((pB[0] - pA[0]) * B.u[1] - (pB[1] - pA[1]) * B.u[0]) / den;
      const K = [pA[0] + A.u[0] * t, pA[1] + A.u[1] * t];
      const d = FILLET / Math.tan(theta / 2);
      const T1 = [K[0] + A.u[0] * d, K[1] + A.u[1] * d];
      const T2 = [K[0] + B.u[0] * d, K[1] + B.u[1] * d];
      const bis = [A.u[0] + B.u[0], A.u[1] + B.u[1]];
      const bl = Math.hypot(bis[0], bis[1]);
      const c = [K[0] + (bis[0] / bl) * (FILLET / Math.sin(theta / 2)), K[1] + (bis[1] / bl) * (FILLET / Math.sin(theta / 2))];
      out.push({ K, T1, T2, c, r: FILLET, poly: [K, T1, c, T2] });
    }
  }
  return out;
}

function indexFillets(fillets) {
  const grid = new Map();
  for (const f of fillets) {
    const xs = f.poly.map((p) => p[0]);
    const ys = f.poly.map((p) => p[1]);
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++) {
      for (let cy = Math.floor(Math.min(...ys) / CELL); cy <= Math.floor(Math.max(...ys) / CELL); cy++) {
        const key = cx * 100003 + cy;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(f);
      }
    }
  }
  return grid;
}

// Qué tan lejos está un punto de poder manejarse (calles + esquinas redondeadas).
// gap <= 0: se puede manejar. (nx, ny): hacia dónde empujar para volver.
export function drivableGap(city, x, y) {
  const nr = nearestRoad(city, x, y);
  let best = nr ? { gap: nr.gap, nx: (nr.cx - x) / (nr.dist || 1), ny: (nr.cy - y) / (nr.dist || 1) } : null;
  const list = city.filletIndex?.get(Math.floor(x / CELL) * 100003 + Math.floor(y / CELL));
  if (list) {
    for (const f of list) {
      if (!pointInPolygon(x, y, f.poly)) continue;
      const dx = x - f.c[0];
      const dy = y - f.c[1];
      const dist = Math.hypot(dx, dy) || 1e-6;
      const gap = f.r - dist; // dentro del círculo = banqueta
      if (!best || gap < best.gap) best = { gap, nx: dx / dist, ny: dy / dist };
    }
  }
  return best;
}

// Distancia a la orilla del área jugable y normal hacia adentro.
export function boundaryPush(city, x, y) {
  if (pointInPolygon(x, y, city.boundary)) return null;
  let best = null;
  for (let i = 0; i < city.boundary.length; i++) {
    const a = city.boundary[i];
    const b = city.boundary[(i + 1) % city.boundary.length];
    const c = closestOnSegment(x, y, a[0], a[1], b[0], b[1]);
    const d = Math.hypot(x - c.x, y - c.y);
    if (!best || d < best.d) best = { d, cx: c.x, cy: c.y };
  }
  return best;
}
