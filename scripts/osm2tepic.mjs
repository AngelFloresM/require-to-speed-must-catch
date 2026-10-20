// Convierte el extracto de OpenStreetMap del centro de Tepic (data/tepic.osm.gz)
// en el mapa del modo libre (src/data/tepicMap.js).
//   node scripts/osm2tepic.mjs
// Datos © OpenStreetMap contributors (ODbL 1.0).
import fs from 'node:fs';
import zlib from 'node:zlib';

const SRC = new URL('../data/tepic.osm.gz', import.meta.url);
const OUT = new URL('../src/data/tepicMap.js', import.meta.url);

// Origen: la Catedral. x = este, y = norte, en metros.
const LAT0 = 21.5119055;
const LON0 = -104.8913308;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
const proj = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY];

// ---------- Lectura del XML (formato fijo de la API de OSM) ----------
const xml = zlib.gunzipSync(fs.readFileSync(SRC)).toString('utf8');
const attr = (s, k) => s.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tagsOf = (body) => {
  const t = {};
  for (const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)) t[m[1]] = unescape(m[2]);
  return t;
};

const bounds = xml.match(/<bounds [^>]*>/)[0];
const [minX, minY] = proj(+attr(bounds, 'minlat'), +attr(bounds, 'minlon'));
const [maxX, maxY] = proj(+attr(bounds, 'maxlat'), +attr(bounds, 'maxlon'));

const nodes = new Map(); // id -> { p, tags }
for (const m of xml.matchAll(/<node ([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)) {
  nodes.set(attr(m[1], 'id'), { p: proj(+attr(m[1], 'lat'), +attr(m[1], 'lon')), tags: m[3] ? tagsOf(m[3]) : {} });
}
const ways = [];
for (const m of xml.matchAll(/<way ([^>]*)>([\s\S]*?)<\/way>/g)) {
  const refs = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map((r) => r[1]).filter((id) => nodes.has(id));
  ways.push({ id: attr(m[1], 'id'), refs, tags: tagsOf(m[2]) });
}

// ---------- Área jugable: el rectángulo descargado, con margen ----------
const M = 40;
const BOX = { minX: Math.ceil(minX + M), minY: Math.ceil(minY + M), maxX: Math.floor(maxX - M), maxY: Math.floor(maxY - M) };
const inBox = ([x, y]) => x >= BOX.minX && x <= BOX.maxX && y >= BOX.minY && y <= BOX.maxY;
const round = (v) => Math.round(v * 10) / 10;

// ---------- Calles ----------
// Ancho por tipo de calle: [doble sentido, un sentido]. Velocidad del tráfico: major.
const CLASSES = {
  trunk: [18, 10, true], primary: [14, 10, true], secondary: [12, 9, true], tertiary: [11, 9, false],
  trunk_link: [8, 7, true], primary_link: [8, 7, true], secondary_link: [8, 7, false], tertiary_link: [7, 6.5, false],
  unclassified: [9, 9, false], residential: [9, 9, false], living_street: [7, 6.5, false], service: [6, 5.5, false],
};
const shortName = (n) => (n ?? '').replace(/^Avenida /, 'Av. ').replace(/^Calle /, '').replace(/^Boulevard /, 'Blvd. ').trim();

const roads = [];
const roadWays = [];
for (const w of ways) {
  const t = w.tags;
  const cls = CLASSES[t.highway];
  if (!cls || w.refs.length < 2) continue;
  if (t.area === 'yes' || ['private', 'no'].includes(t.access)) continue;
  if (t.highway === 'service' && !t.name) continue; // estacionamientos y cocheras
  let oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
  let width = cls[oneway ? 1 : 0];
  const lanes = Number(t.lanes);
  if (lanes > 0) width = Math.max(width * 0.8, lanes * 3.3 + (oneway ? 1 : 2));
  if (Number(t.width) > 0) width = Math.max(5, Number(t.width));
  width = Math.min(20, round(width));
  const key = [shortName(t.name) || 'Calle', width, oneway, cls[2]].join('|');
  let ri = roads.findIndex((r) => r.key === key);
  if (ri < 0) {
    ri = roads.length;
    roads.push({ key, name: shortName(t.name) || 'Calle', width, oneway, major: cls[2] });
  }
  roadWays.push({ road: ri, refs: w.refs });
}

// Un nodo de OSM usado por 2+ calles (o extremo) es intersección.
const uses = new Map();
for (const rw of roadWays) {
  rw.refs.forEach((id, i) => uses.set(id, (uses.get(id) ?? 0) + (i === 0 || i === rw.refs.length - 1 ? 2 : 1)));
}

// Recorte de un segmento contra la caja: punto de cruce.
function boxCross(a, b) {
  let t0 = 0;
  let t1 = 1;
  const d = [b[0] - a[0], b[1] - a[1]];
  for (const [p, q] of [[-d[0], a[0] - BOX.minX], [d[0], BOX.maxX - a[0]], [-d[1], a[1] - BOX.minY], [d[1], BOX.maxY - a[1]]]) {
    if (p === 0) continue;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
  }
  return { t0, t1 };
}

const gNodes = []; // { x, y, boundary, osm }
const byOsm = new Map();
const nodeFor = (id) => {
  if (!byOsm.has(id)) {
    const [x, y] = nodes.get(id).p;
    byOsm.set(id, gNodes.length);
    gNodes.push({ x, y, boundary: false, osm: id });
  }
  return byOsm.get(id);
};
const boundaryNode = (p) => {
  gNodes.push({ x: p[0], y: p[1], boundary: true });
  return gNodes.length - 1;
};

// Simplifica una polilínea (Douglas-Peucker, tolerancia en m).
function simplify(pts, tol = 0.4) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = pts[i];
    const [bx, by] = pts[j];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1;
    let bi = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / len;
      if (d > best) [best, bi] = [d, k];
    }
    if (best > tol) {
      keep[bi] = true;
      stack.push([i, bi], [bi, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

const edges = []; // [a, b, road, path]
for (const rw of roadWays) {
  // Recorre la calle; corta en intersecciones y en la orilla de la caja.
  let cur = null; // { a, path }
  const close = (b) => {
    if (cur && cur.path.length > 1 && cur.a !== b) edges.push([cur.a, b, rw.road, simplify(cur.path)]);
  };
  for (let i = 0; i < rw.refs.length; i++) {
    const id = rw.refs[i];
    const p = nodes.get(id).p;
    const inside = inBox(p);
    if (i > 0) {
      const prev = nodes.get(rw.refs[i - 1]).p;
      const wasInside = inBox(prev);
      if (wasInside !== inside || (!wasInside && !inside)) {
        const { t0, t1 } = boxCross(prev, p);
        if (t0 <= t1) {
          const at = (t) => [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t];
          if (!wasInside) cur = { a: boundaryNode(at(t0)), path: [at(t0)] };
          if (!inside) {
            const q = at(t1);
            cur.path.push(q);
            close(boundaryNode(q));
            cur = null;
          }
        }
      }
    }
    if (!inside) continue;
    const isNode = i === 0 || i === rw.refs.length - 1 || uses.get(id) > 1;
    if (!cur) {
      cur = { a: nodeFor(id), path: [p] };
      continue;
    }
    cur.path.push(p);
    if (isNode) {
      const b = nodeFor(id);
      close(b);
      cur = { a: b, path: [p] };
    }
  }
}

// Quita tramos sueltos: solo la red conectada más grande.
const adj = gNodes.map(() => []);
edges.forEach((e, i) => {
  adj[e[0]].push(i);
  adj[e[1]].push(i);
});
let bestComp = null;
const comp = new Array(gNodes.length).fill(-1);
for (let s = 0; s < gNodes.length; s++) {
  if (comp[s] >= 0 || !adj[s].length) continue;
  const list = [s];
  comp[s] = s;
  for (let k = 0; k < list.length; k++) {
    for (const ei of adj[list[k]]) {
      for (const m of [edges[ei][0], edges[ei][1]]) {
        if (comp[m] < 0) {
          comp[m] = s;
          list.push(m);
        }
      }
    }
  }
  if (!bestComp || list.length > bestComp.length) bestComp = list;
}
const keepNode = new Set(bestComp);
const keptEdges = edges.filter((e) => keepNode.has(e[0]));
const remap = new Map();
const outNodes = [];
for (const e of keptEdges) {
  for (const n of [e[0], e[1]]) {
    if (!remap.has(n)) {
      remap.set(n, outNodes.length);
      outNodes.push(gNodes[n]);
    }
  }
}

// Semáforos: cada semáforo de OSM marca la intersección más cercana (3+ calles).
const degree = new Map();
for (const e of keptEdges) for (const n of [e[0], e[1]]) degree.set(n, (degree.get(n) ?? 0) + 1);
const signals = new Set();
for (const [, n] of nodes) {
  if (n.tags.highway !== 'traffic_signals' || !inBox(n.p)) continue;
  let best = null;
  for (const [gi, deg] of degree) {
    if (deg < 3 || gNodes[gi].boundary) continue;
    const d = Math.hypot(gNodes[gi].x - n.p[0], gNodes[gi].y - n.p[1]);
    if (d < 35 && (!best || d < best.d)) best = { gi, d };
  }
  if (best) signals.add(remap.get(best.gi));
}

// ---------- Áreas: parques, agua, edificios ----------
const ring = (w) => (w.refs.length > 3 && w.refs[0] === w.refs[w.refs.length - 1] ? w.refs.slice(0, -1).map((id) => nodes.get(id).p) : null);
const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
const area = (pts) => Math.abs(pts.reduce((a, p, i) => {
  const q = pts[(i + 1) % pts.length];
  return a + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;
const poly = (pts) => simplify(pts, 0.3).map(([x, y]) => [round(x), round(y)]);

const parks = [];
const water = [];
const buildings = [];
let cathedral = null;
for (const w of ways) {
  const t = w.tags;
  const pts = ring(w);
  if (!pts || !inBox(centroid(pts))) continue;
  if (['park', 'garden'].includes(t.leisure) || ['grass', 'recreation_ground', 'village_green'].includes(t.landuse)) {
    if (area(pts) > 150) parks.push({ name: t.name ?? '', poly: poly(pts) });
  } else if (t.natural === 'water' || t.place === 'square' || t.highway === 'pedestrian') {
    if (t.natural === 'water') water.push(poly(pts));
    else if (area(pts) > 150) parks.push({ name: t.name ?? '', plaza: true, poly: poly(pts) });
  } else if (t.building) {
    if (t.name === 'Catedral' || t.amenity === 'place_of_worship' && /Catedral/.test(t.name ?? '')) {
      cathedral = centroid(pts).map(round);
      continue;
    }
    const levels = Number(t['building:levels']) || 0;
    buildings.push([levels, ...poly(pts).flat()]);
  }
}
if (!cathedral) {
  const c = ways.find((w) => w.tags.name === 'Catedral' && ring(w));
  cathedral = c ? centroid(ring(c)).map(round) : [0, 0];
}

const rivers = [];
for (const w of ways) {
  if (w.tags.waterway !== 'river') continue;
  const pts = w.refs.map((id) => nodes.get(id).p).filter(inBox);
  if (pts.length > 1) rivers.push(simplify(pts, 1).map(([x, y]) => [round(x), round(y)]));
}

// ---------- Salida ----------
const data = {
  box: BOX,
  roads: roads.map(({ key, ...r }) => r),
  nodes: outNodes.map((n, i) => [round(n.x), round(n.y), n.boundary ? 1 : 0, signals.has(i) ? 1 : 0]),
  edges: keptEdges.map(([a, b, r, path]) => [remap.get(a), remap.get(b), r, path.flatMap(([x, y]) => [round(x), round(y)])]),
  parks,
  water,
  rivers,
  buildings,
  cathedral,
};
const js = `// Generado por scripts/osm2tepic.mjs a partir de data/tepic.osm.gz. No editar a mano.
// Datos © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
export default ${JSON.stringify(data)};
`;
fs.writeFileSync(OUT, js);
console.log(`calles ${roads.length}, nodos ${outNodes.length} (de ${gNodes.length}), aristas ${keptEdges.length} (de ${edges.length}), semáforos ${signals.size}, parques ${parks.length}, agua ${water.length}, ríos ${rivers.length}, edificios ${buildings.length}, ${(js.length / 1024).toFixed(0)} KB`);
console.log('caja', BOX, 'catedral', cathedral);
