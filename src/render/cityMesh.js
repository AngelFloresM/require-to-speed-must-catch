// Ciudad en 3D, sin texturas y con pocas mallas (edificios y árboles instanciados).
import * as THREE from 'three';
import { drivableGap, pointInPolygon } from '../city/city.js';
import { MAP, RIVERS, WATER, LANDMARKS } from '../data/tepic.js';

const to3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Junta muchos cuadriláteros/triángulos planos en una geometría.
class FlatBuilder {
  constructor() {
    this.pos = [];
  }
  // Guarda cada triángulo en orden antihorario visto desde arriba, para que
  // su cara frontal apunte hacia el cielo.
  tri(a, b, c, h) {
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const list = cross > 0 ? [a, b, c] : [a, c, b];
    for (const [x, y] of list) this.pos.push(x, h, -y);
  }
  // Cinta a lo largo de una polilínea, entre desplazamientos laterales l0..l1 (+ = derecha).
  // Los tramos largos se parten en pedazos de 15 m: los triángulos gigantes
  // se recortan mal contra la cámara a ras de suelo y "desaparecen".
  ribbon(path, l0, l1, h) {
    const pts = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 15));
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
    pts.push(path[path.length - 1]);
    path = pts;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (by - ay) / len;
      const ny = -(bx - ax) / len;
      const p = (x, y, l) => [x + nx * l, y + ny * l];
      const a0 = p(ax, ay, l0), a1 = p(ax, ay, l1), b0 = p(bx, by, l0), b1 = p(bx, by, l1);
      this.tri(a0, b0, a1, h);
      this.tri(a1, b0, b1, h);
    }
  }
  disc(x, y, r, h, n = 16) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri([x, y], [x + Math.cos(a1) * r, y + Math.sin(a1) * r], [x + Math.cos(a0) * r, y + Math.sin(a0) * r], h);
    }
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}

// Relleno de un polígono con baldosas (sin triángulos gigantes). Las baldosas
// del borde se recortan en pasos más finos para que la orilla no se vea dentada.
function polygonMesh(poly, color, h, tile = 20) {
  const fb = new FlatBuilder();
  const bb = bounds(poly);
  const quad = (x, y, sz) => {
    fb.tri([x, y], [x + sz, y], [x + sz, y + sz], h);
    fb.tri([x, y], [x + sz, y + sz], [x, y + sz], h);
  };
  const fill = (x, y, sz) => {
    const corners = [[x, y], [x + sz, y], [x + sz, y + sz], [x, y + sz], [x + sz / 2, y + sz / 2]];
    const inside = corners.filter(([px, py]) => pointInPolygon(px, py, poly)).length;
    if (inside === 5) quad(x, y, sz);
    else if (sz > 2.5 && inside > 0) {
      const hs = sz / 2;
      fill(x, y, hs);
      fill(x + hs, y, hs);
      fill(x, y + hs, hs);
      fill(x + hs, y + hs, hs);
    } else if (inside >= 3) quad(x, y, sz);
    else if (sz > 2.5) {
      // la orilla puede cruzar una baldosa sin tocar sus esquinas
      const hs = sz / 2;
      for (const [ox, oy] of [[0, 0], [hs, 0], [0, hs], [hs, hs]]) {
        const cx = x + ox + hs / 2;
        const cy = y + oy + hs / 2;
        if (pointInPolygon(cx, cy, poly)) fill(x + ox, y + oy, hs);
      }
    }
  };
  for (let x = Math.floor(bb.minX / tile) * tile; x < bb.maxX; x += tile) {
    for (let y = Math.floor(bb.minY / tile) * tile; y < bb.maxY; y += tile) fill(x, y, tile);
  }
  return fb.mesh(new THREE.MeshLambertMaterial({ color }));
}

function bounds(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function buildCityMesh(city) {
  const group = new THREE.Group();
  const b = bounds(city.boundary);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const rand = rng(7);

  // Piso: afuera tierra/pasto; adentro banqueta y lotes (concreto).
  // Dividido en cuadros de 100 m: un plano de 2 triángulos de varios km se
  // recorta mal contra la cámara a ras de suelo y tapa las calles.
  const ow = b.maxX - b.minX + 3000;
  const oh = b.maxY - b.minY + 3000;
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(ow, oh, Math.ceil(ow / 100), Math.ceil(oh / 100)),
    new THREE.MeshLambertMaterial({ color: 0x8c9270 }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.set(cx, -0.05, -cy);
  group.add(outside);
  group.add(polygonMesh(city.boundary, 0xb9b4a8, 0.02));

  // Parques y plaza.
  for (const p of city.parks) group.add(polygonMesh(p.poly, p.plaza ? 0xd8cdb5 : 0x5f9a48, 0.045));

  // Río Mololoa y cuerpos de agua.
  const river = new FlatBuilder();
  for (const r of RIVERS) river.ribbon(r.path, -r.width / 2, r.width / 2, 0.035);
  group.add(river.mesh(new THREE.MeshLambertMaterial({ color: 0x3f8fb5 })));
  for (const w of WATER) group.add(polygonMesh(w, 0x3f8fb5, 0.04, 10));

  // Calles: asfalto + cruces.
  const asphalt = new FlatBuilder();
  for (const e of city.edges) asphalt.ribbon(e.path, -e.road.width / 2, e.road.width / 2, 0.06);
  for (const n of city.nodes) {
    const r = Math.max(...n.edges.map((e) => e.road.width / 2));
    asphalt.disc(n.x, n.y, r * 1.05, 0.065);
  }
  // Esquinas redondeadas: abanico desde la esquina K hasta el arco.
  for (const f of city.fillets) {
    const a0 = Math.atan2(f.T1[1] - f.c[1], f.T1[0] - f.c[0]);
    let a1 = Math.atan2(f.T2[1] - f.c[1], f.T2[0] - f.c[0]);
    let da = a1 - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da)); // el arco corto (del lado de K)
    const steps = 6;
    let prev = f.T1;
    for (let i = 1; i <= steps; i++) {
      const a = a0 + (da * i) / steps;
      const p = [f.c[0] + Math.cos(a) * f.r, f.c[1] + Math.sin(a) * f.r];
      asphalt.tri(f.K, prev, p, 0.065);
      prev = p;
    }
  }
  group.add(asphalt.mesh(new THREE.MeshLambertMaterial({ color: 0x3b3e43 })));

  // Marcas: línea amarilla en doble sentido; flechas blancas en un sentido.
  const yellow = new FlatBuilder();
  const white = new FlatBuilder();
  for (const e of city.edges) {
    if (e.length < 30) continue;
    const trimmed = trimPath(e.path, 10, 10);
    if (!trimmed) continue;
    if (e.road.oneway === 0) {
      yellow.ribbon(trimmed, -0.25, -0.1, 0.09);
      yellow.ribbon(trimmed, 0.1, 0.25, 0.09);
    } else {
      for (let d = 12; d < e.length - 12; d += 30) arrow(white, e.path, d, e.road.oneway, 0.09);
    }
  }
  group.add(yellow.mesh(new THREE.MeshLambertMaterial({ color: 0xe8c22c })));
  group.add(white.mesh(new THREE.MeshLambertMaterial({ color: 0xeeeeee })));

  // Barreras donde las calles salen del área.
  group.add(buildBarriers(city));

  // Edificios: los de OpenStreetMap con su planta real; el resto del espacio
  // se llena con casas de 1 a 3 pisos (colores de fachada del centro).
  const real = buildRealBuildings(city, rand);
  group.add(real.mesh);
  group.add(buildBuildings(city, rand, real.occupied));

  // Árboles en parques.
  group.add(buildParkTrees(city, rand));

  // Catedral.
  group.add(buildCathedral(LANDMARKS.cathedral));

  return group;
}

// Recorta d0 metros al inicio y d1 al final de una polilínea.
function trimPath(path, d0, d1) {
  const total = path.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - path[i][0], q[1] - path[i][1]), 0);
  if (total <= d0 + d1) return null;
  const at = (d) => pointAt(path, d).p;
  const out = [at(d0)];
  let acc = 0;
  for (let i = 1; i < path.length - 1; i++) {
    acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (acc > d0 && acc < total - d1) out.push(path[i]);
  }
  out.push(at(total - d1));
  return out;
}

function pointAt(path, d) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (acc + len >= d || i === path.length - 2) {
      const t = Math.min(1, (d - acc) / (len || 1));
      return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: Math.atan2(by - ay, bx - ax) };
    }
    acc += len;
  }
  return { p: path[0], dir: 0 };
}

function arrow(fb, path, d, sign, h) {
  const { p, dir } = pointAt(path, d);
  const a = dir + (sign < 0 ? Math.PI : 0);
  const f = [Math.cos(a), Math.sin(a)];
  const r = [Math.sin(a), -Math.cos(a)];
  const P = (u, v) => [p[0] + f[0] * u + r[0] * v, p[1] + f[1] * u + r[1] * v];
  fb.tri(P(1.6, 0), P(0.2, 0.9), P(0.2, -0.9), h); // punta
  fb.tri(P(0.2, 0.3), P(-1.8, 0.3), P(0.2, -0.3), h);
  fb.tri(P(0.2, -0.3), P(-1.8, 0.3), P(-1.8, -0.3), h);
}

function buildBarriers(city) {
  // Bloques rojo/blanco en dos mallas instanciadas (pocas llamadas de dibujo).
  const blocks = [];
  for (const n of city.nodes) {
    if (!n.boundary) continue;
    const e = n.edges[0];
    const p = e.a === n ? e.path[0] : e.path[e.path.length - 1];
    const q = e.a === n ? e.path[1] : e.path[e.path.length - 2];
    const dir = Math.atan2(q[1] - p[1], q[0] - p[0]); // hacia adentro
    const w = e.road.width + 1;
    // Un poco hacia adentro para que se vea delante del límite.
    const cx = p[0] + Math.cos(dir) * 1.5;
    const cy = p[1] + Math.sin(dir) * 1.5;
    const count = Math.ceil(w / 1.2);
    for (let i = 0; i < count; i++) {
      const off = -w / 2 + (i + 0.5) * 1.2; // a lo ancho de la calle
      blocks.push({ x: cx + Math.sin(dir) * off, y: cy - Math.cos(dir) * off, dir, red: i % 2 === 0 });
    }
  }
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.5, 1.1, 1.2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (const [red, color] of [[true, 0xd0342c], [false, 0xf2f2f2]]) {
    const list = blocks.filter((b) => b.red === red);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(up, b.dir);
      mesh.setMatrixAt(i, m.compose(to3(b.x, b.y, 0.55), q, one));
    });
    group.add(mesh);
  }
  return group;
}

const PALETTE = [0xe8d3a9, 0xd9a07a, 0xc9d6c0, 0xe2c4c4, 0xb8c7d9, 0xf0e2c0, 0xd8b98c, 0xcfa6a0, 0xe6e0d4, 0xa9c2a4];
const CELL = 3; // celdas de ocupación para no encimar edificios
const cellKey = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;

// Edificios reales: planta de OSM extruida (paredes + techo) en una sola malla.
// Se omiten los que pisan la calle (el ancho de las calles es estimado).
function buildRealBuildings(city, rand) {
  const pos = [];
  const col = [];
  const occupied = new Set();
  const color = new THREE.Color();
  const near = (x, y) => Math.hypot(x - LANDMARKS.cathedral[0], y - LANDMARKS.cathedral[1]) < 32;
  for (const b of MAP.buildings) {
    const levels = b[0];
    const poly = [];
    for (let i = 1; i < b.length; i += 2) poly.push([b[i], b[i + 1]]);
    if (poly.some(([x, y]) => !pointInPolygon(x, y, city.boundary) || near(x, y))) continue;
    const onRoad = poly.some(([x, y]) => {
      const g = drivableGap(city, x, y);
      return g && g.gap < 0.5;
    });
    if (onRoad) continue;
    const bb = bounds(poly);
    for (let x = bb.minX; x <= bb.maxX; x += CELL / 2) {
      for (let y = bb.minY; y <= bb.maxY; y += CELL / 2) if (pointInPolygon(x, y, poly)) occupied.add(cellKey(x, y));
    }
    for (const [x, y] of poly) occupied.add(cellKey(x, y));
    const h = (levels || 1 + Math.floor(rand() * 3)) * 3.3;
    color.setHex(PALETTE[Math.floor(rand() * PALETTE.length)]);
    const push = (x, y, z) => {
      pos.push(x, z, -y);
      col.push(color.r, color.g, color.b);
    };
    // Paredes, con la cara hacia afuera sin importar el orden de los vértices.
    const ccw = poly.reduce((a, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0) > 0;
    for (let i = 0; i < poly.length; i++) {
      let p = poly[i];
      let q = poly[(i + 1) % poly.length];
      if (!ccw) [p, q] = [q, p];
      push(p[0], p[1], 0); push(q[0], q[1], 0); push(q[0], q[1], h);
      push(p[0], p[1], 0); push(q[0], q[1], h); push(p[0], p[1], h);
    }
    // Techo un poco más oscuro.
    color.multiplyScalar(0.85);
    const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, y]) => new THREE.Vector2(x, y)), []);
    for (const [i, j, k] of tris) {
      const pts = [poly[i], poly[j], poly[k]];
      const cross = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
      for (const [x, y] of cross > 0 ? pts : [pts[0], pts[2], pts[1]]) push(x, y, h);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.count = pos.length;
  return { mesh, occupied };
}

function buildBuildings(city, rand, occupied = new Set()) {
  const cell = CELL;
  const items = [];
  const free = (x, y) => {
    if (!pointInPolygon(x, y, city.boundary)) return false;
    if (city.parks.some((p) => pointInPolygon(x, y, p.poly))) return false;
    if (Math.hypot(x - LANDMARKS.cathedral[0], y - LANDMARKS.cathedral[1]) < 32) return false;
    const g = drivableGap(city, x, y);
    return !g || g.gap > 2.5; // deja banqueta
  };
  for (const e of city.edges) {
    const hw = e.road.width / 2;
    for (let i = 0; i < e.path.length - 1; i++) {
      const [ax, ay] = e.path[i];
      const [bx, by] = e.path[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const dir = Math.atan2(by - ay, bx - ax);
      const f = [Math.cos(dir), Math.sin(dir)];
      const r = [Math.sin(dir), -Math.cos(dir)];
      for (const side of [1, -1]) {
        let d = 3 + rand() * 3;
        while (d < len - 3) {
          const front = 7 + rand() * 6;
          const depth = 14 + rand() * 14;
          const off = side * (hw + 3 + depth / 2);
          const x = ax + f[0] * d + r[0] * off;
          const y = ay + f[1] * d + r[1] * off;
          const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([u, v]) => [
            x + f[0] * (u * front) / 2 + r[0] * (v * depth) / 2,
            y + f[1] * (u * front) / 2 + r[1] * (v * depth) / 2,
          ]);
          const keys = corners.map(([px, py]) => `${Math.floor(px / cell)},${Math.floor(py / cell)}`);
          if (corners.every(([px, py]) => free(px, py)) && !keys.some((k) => occupied.has(k))) {
            // marca la huella completa
            for (let u = -front / 2; u <= front / 2; u += cell) {
              for (let v = -depth / 2; v <= depth / 2; v += cell) {
                occupied.add(`${Math.floor((x + f[0] * u + r[0] * v) / cell)},${Math.floor((y + f[1] * u + r[1] * v) / cell)}`);
              }
            }
            const floors = rand() < 0.08 ? 4 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 3);
            items.push({ x, y, dir, front, depth, h: floors * 3.3, color: PALETTE[Math.floor(rand() * PALETTE.length)] });
          }
          d += front + 0.3;
        }
      }
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.dir);
    m.compose(to3(it.x, it.y, it.h / 2), q, new THREE.Vector3(it.front, it.h, it.depth));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.setHex(it.color));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.count = items.length;
  return mesh;
}

function buildParkTrees(city, rand) {
  const spots = [];
  for (const p of city.parks) {
    if (p.plaza) continue;
    const bb = bounds(p.poly);
    const area = (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
    const n = Math.floor(area / 250);
    for (let i = 0; i < n; i++) {
      const x = bb.minX + rand() * (bb.maxX - bb.minX);
      const y = bb.minY + rand() * (bb.maxY - bb.minY);
      if (pointInPolygon(x, y, p.poly)) spots.push([x, y, 0.8 + rand() * 0.7]);
    }
  }
  const group = new THREE.Group();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), new THREE.MeshLambertMaterial({ color: 0x5a3d26 }), spots.length);
  const tops = new THREE.InstancedMesh(new THREE.SphereGeometry(2.6, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3f7d3a }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, y, k], i) => {
    m.makeScale(k, k, k).setPosition(x, 1.5 * k, -y);
    trunks.setMatrixAt(i, m);
    m.makeScale(k, k * 0.85, k).setPosition(x, 4.2 * k, -y);
    tops.setMatrixAt(i, m);
  });
  tops.castShadow = true;
  group.add(trunks, tops);
  return group;
}

function buildCathedral([x, y]) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: 0xe9dfc3 });
  const roof = new THREE.MeshLambertMaterial({ color: 0xb8a77f });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 40), stone);
  nave.position.set(0, 7, 6);
  g.add(nave);
  for (const s of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 34, 7), stone);
    tower.position.set(s * 8, 17, -14);
    g.add(tower);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9, 8), roof);
    top.position.set(s * 8, 38.5, -14);
    g.add(top);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), roof);
  dome.position.set(0, 14, 14);
  g.add(dome);
  g.traverse((o) => (o.castShadow = true));
  g.position.copy(to3(x, y));
  g.rotation.y = 2.82; // torres hacia la plaza (al sur), alineada con Av. México
  return g;
}
