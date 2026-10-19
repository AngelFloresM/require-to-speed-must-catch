// Semáforos: en los cruces donde llega una avenida (3 o más calles).
// Dos grupos de accesos (los dos ejes del cruce) que se turnan.

export const CYCLE = { green: 12, yellow: 3, allRed: 1.5 };
const PERIOD = 2 * (CYCLE.green + CYCLE.yellow + CYCLE.allRed);

// Rumbo con el que una arista llega al nodo.
export function approachHeading(edge, node) {
  const p = edge.path;
  const [a, b] = edge.b === node ? [p[p.length - 2], p[p.length - 1]] : [p[1], p[0]];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

export function buildSignals(city, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const node of city.nodes) {
    if (node.edges.length < 3 || !node.edges.some((e) => e.road.major)) continue;
    const ref = approachHeading(node.edges[0], node);
    const group = new Map(); // edgeId -> 0 | 1
    for (const e of node.edges) {
      const diff = approachHeading(e, node) - ref;
      group.set(e.id, Math.abs(Math.cos(diff)) > 0.7 ? 0 : 1);
    }
    node.signal = { group, offset: rand() * PERIOD };
  }
  city.signals = city.nodes.filter((n) => n.signal);
  return city.signals;
}

// Color del semáforo para quien llega al nodo por esa arista.
export function lightFor(node, edge, time) {
  if (!node.signal) return null;
  const g = node.signal.group.get(edge.id) ?? 0;
  const half = CYCLE.green + CYCLE.yellow + CYCLE.allRed;
  let t = (time + node.signal.offset) % PERIOD;
  if (g === 1) t = (t + half) % PERIOD;
  if (t < CYCLE.green) return 'green';
  if (t < CYCLE.green + CYCLE.yellow) return 'yellow';
  return 'red';
}
