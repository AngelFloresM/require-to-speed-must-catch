// Ciudad en 3D, sin texturas y con pocas mallas (edificios y árboles instanciados).
import * as THREE from 'three';
import { nearestRoad, pointInPolygon } from '../city/city.js';
import { RIVER, LANDMARKS } from '../data/tepic.js';

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
  tri(a, b, c, h) {
    for (const [x, y] of [a, b, c]) this.pos.push(x, h, -y);
  }
  // Cinta a lo largo de una polilínea, entre desplazamientos laterales l0..l1 (+ = derecha).
  ribbon(path, l0, l1, h) {
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
    material.side = THREE.DoubleSide; // el cambio de ejes (y -> -z) invierte el orden de los vértices
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}

function polygonMesh(poly, color, h) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = h;
  m.receiveShadow = true;
  return m;
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
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + 3000, b.maxY - b.minY + 3000), new THREE.MeshLambertMaterial({ color: 0x8c9270 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.set(cx, -0.05, -cy);
  group.add(outside);
  group.add(polygonMesh(city.boundary, 0xb9b4a8, 0.02));

  // Parques y plaza.
  for (const p of city.parks) group.add(polygonMesh(p.poly, p.plaza ? 0xd8cdb5 : 0x5f9a48, 0.045));

  // Río Mololoa.
  const river = new FlatBuilder();
  river.ribbon(RIVER.path, -RIVER.width / 2, RIVER.width / 2, 0.035);
  group.add(river.mesh(new THREE.MeshLambertMaterial({ color: 0x3f8fb5 })));

  // Calles: asfalto + cruces.
  const asphalt = new FlatBuilder();
  for (const e of city.edges) asphalt.ribbon(e.path, -e.road.width / 2, e.road.width / 2, 0.06);
  for (const n of city.nodes) {
    const r = Math.max(...n.edges.map((e) => e.road.width / 2));
    asphalt.disc(n.x, n.y, r * 1.05, 0.065);
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

  // Edificios (casas de 1 a 3 pisos, colores de fachada del centro).
  group.add(buildBuildings(city, rand));

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

function buildBuildings(city, rand) {
  const PALETTE = [0xe8d3a9, 0xd9a07a, 0xc9d6c0, 0xe2c4c4, 0xb8c7d9, 0xf0e2c0, 0xd8b98c, 0xcfa6a0, 0xe6e0d4, 0xa9c2a4];
  const occupied = new Set();
  const cell = 3;
  const items = [];
  const free = (x, y) => {
    if (!pointInPolygon(x, y, city.boundary)) return false;
    if (city.parks.some((p) => pointInPolygon(x, y, p.poly))) return false;
    if (Math.hypot(x - LANDMARKS.cathedral[0], y - LANDMARKS.cathedral[1]) < 32) return false;
    const nr = nearestRoad(city, x, y);
    return !nr || nr.gap > 2.5; // deja banqueta
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
        let d = 4 + rand() * 4;
        while (d < len - 4) {
          const front = 8 + rand() * 7;
          const depth = 10 + rand() * 8;
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
          d += front + 0.5;
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
