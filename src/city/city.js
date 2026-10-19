// Ciudad del modo libre: calles recortadas al área jugable, grafo de
// intersecciones (para el tráfico) e índice espacial para colisiones.
// Coordenadas en metros (x = este, y = norte). Sin dependencias de DOM.
import { BOUNDARY, PARKS, GRID, AVENUES, SPAWN, STREET_WIDTH, AVENUE_WIDTH } from '../data/tepic.js';

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

function segIntersect(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, p: [a[0] + r[0] * t, a[1] + r[1] * t] };
}

const polylineLength = (p) => p.slice(1).reduce((acc, q, i) => acc + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

// Recorta una polilínea a tramos dentro del área (y fuera de parques si se pide).
function clipPath(path, { avoidParks }) {
  const runs = [];
  let cur = null;
  const inside = (x, y) =>
    pointInPolygon(x, y, BOUNDARY) && !(avoidParks && PARKS.some((p) => pointInPolygon(x, y, p.poly)));
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const y = ay + ((by - ay) * k) / n;
      if (inside(x, y)) {
        if (!cur) runs.push((cur = []));
        cur.push([x, y]);
      } else cur = null;
    }
  }
  // Simplifica: conserva solo los vértices donde cambia la dirección.
  return runs
    .filter((r) => polylineLength(r) > 25)
    .map((r) => r.filter((p, i) => {
      if (i === 0 || i === r.length - 1) return true;
      const a = r[i - 1];
      const b = r[i + 1];
      const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
      return Math.abs(cross) > 0.5;
    }));
}

function gridRoads() {
  const roads = [];
  for (const fam of GRID) {
    const len = Math.hypot(fam.dir[0], fam.dir[1]);
    const d = [fam.dir[0] / len, -fam.dir[1] / len]; // px -> mundo (y hacia arriba)
    const n = fam.side === 'right' ? [d[1], -d[0]] : [-d[1], d[0]];
    for (let k = fam.range[0]; k <= fam.range[1]; k++) {
      const major = fam.major.includes(k);
      const o = [fam.through[0] + n[0] * fam.spacing * k, fam.through[1] + n[1] * fam.spacing * k];
      const L = 3000;
      const line = [[o[0] - d[0] * L, o[1] - d[1] * L], [o[0] + d[0] * L, o[1] + d[1] * L]];
      // Un sentido alternado; las avenidas son de doble sentido.
      const oneway = major ? 0 : k % 2 === 0 ? 1 : -1;
      for (const path of clipPath(line, { avoidParks: true })) {
        roads.push({ name: fam.names[k] ?? 'Calle', path, width: major ? AVENUE_WIDTH : STREET_WIDTH, oneway, major });
      }
    }
  }
  return roads;
}

export function buildCity() {
  const roads = gridRoads();
  for (const av of AVENUES) {
    for (const path of clipPath(av.path, { avoidParks: false })) {
      roads.push({ name: av.name, path, width: av.width, oneway: 0, major: true });
    }
  }
  roads.forEach((r, i) => (r.id = i));

  // --- Intersecciones -> nodos ---
  const nodes = [];
  const findNode = (p) => {
    for (const n of nodes) if (Math.hypot(n.x - p[0], n.y - p[1]) < 6) return n;
    const n = { id: nodes.length, x: p[0], y: p[1], edges: [], boundary: false };
    nodes.push(n);
    return n;
  };
  const cuts = roads.map(() => []); // [{dist, node}]
  const distAlong = (road, seg, t) => {
    let acc = 0;
    for (let i = 0; i < seg; i++) acc += Math.hypot(road.path[i + 1][0] - road.path[i][0], road.path[i + 1][1] - road.path[i][1]);
    const a = road.path[seg];
    const b = road.path[seg + 1];
    return acc + Math.hypot(b[0] - a[0], b[1] - a[1]) * t;
  };
  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const A = roads[i].path;
      const B = roads[j].path;
      for (let a = 0; a < A.length - 1; a++) {
        for (let b = 0; b < B.length - 1; b++) {
          const hit = segIntersect(A[a], A[a + 1], B[b], B[b + 1]);
          if (!hit) continue;
          const node = findNode(hit.p);
          cuts[i].push({ dist: distAlong(roads[i], a, hit.t), node });
          cuts[j].push({ dist: distAlong(roads[j], b, hit.u), node });
        }
      }
    }
  }
  // Extremos de cada calle (en el límite del área: barreras).
  roads.forEach((r, i) => {
    const total = polylineLength(r.path);
    for (const [end, dist] of [[r.path[0], 0], [r.path[r.path.length - 1], total]]) {
      if (cuts[i].some((c) => Math.abs(c.dist - dist) < 6)) continue;
      const node = findNode(end);
      node.boundary = !nodes.some((m) => m !== node && Math.hypot(m.x - node.x, m.y - node.y) < 6) && isNearBoundary(end);
      node.deadEnd = !node.boundary;
      cuts[i].push({ dist, node });
    }
  });

  // --- Tramos entre nodos -> aristas ---
  const edges = [];
  roads.forEach((r, i) => {
    const list = cuts[i].sort((a, b) => a.dist - b.dist);
    for (let k = 0; k < list.length - 1; k++) {
      const a = list[k];
      const b = list[k + 1];
      if (a.node === b.node || b.dist - a.dist < 1) continue;
      const path = subPath(r.path, a.dist, b.dist);
      const e = { id: edges.length, road: r, a: a.node, b: b.node, path, length: b.dist - a.dist };
      edges.push(e);
      a.node.edges.push(e);
      b.node.edges.push(e);
    }
  });

  const city = { roads, nodes, edges, boundary: BOUNDARY, parks: PARKS };
  city.index = buildIndex(edges);
  city.fillets = buildFillets(nodes);
  city.filletIndex = indexFillets(city.fillets);
  // Salida: a media cuadra de la calle indicada, lo más cerca del punto pedido.
  const dist = (e) => {
    const m = e.path[Math.floor(e.path.length / 2)];
    return Math.hypot(m[0] - SPAWN.at[0], m[1] - SPAWN.at[1]);
  };
  const edge = edges.filter((e) => e.road.name === SPAWN.road).sort((a, b) => dist(a) - dist(b))[0];
  const a = edge.path[0];
  const b = edge.path[edge.path.length - 1];
  let heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const want = Math.atan2(SPAWN.toward[1] - SPAWN.at[1], SPAWN.toward[0] - SPAWN.at[0]);
  if (Math.cos(heading - want) < 0) heading += Math.PI;
  city.spawn = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, heading };
  return city;
}

function isNearBoundary([x, y]) {
  let best = Infinity;
  for (let i = 0; i < BOUNDARY.length; i++) {
    const a = BOUNDARY[i];
    const b = BOUNDARY[(i + 1) % BOUNDARY.length];
    const c = closestOnSegment(x, y, a[0], a[1], b[0], b[1]);
    best = Math.min(best, Math.hypot(x - c.x, y - c.y));
  }
  return best < 8;
}

function subPath(path, d0, d1) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lerp = (d) => {
      const t = (d - acc) / len;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    if (acc + len >= d0 && acc <= d1) {
      if (!out.length) out.push(lerp(Math.max(d0, acc)));
      if (acc + len <= d1) out.push([b[0], b[1]]);
      else out.push(lerp(d1));
    }
    acc += len;
  }
  return out;
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
