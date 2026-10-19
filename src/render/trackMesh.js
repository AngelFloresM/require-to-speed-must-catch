// Geometría de la pista: asfalto, bordes, muros, línea de meta y pasto.
// Todo con colores planos (sin texturas) y pocas mallas para que sea rápido.
import * as THREE from 'three';
import { trackBounds } from '../track.js';

const STEP = 4; // metros entre muestras

// Puntos a lo largo de la pista con un desplazamiento lateral (+ afuera).
function offsetPoints(track, offset) {
  const pts = [];
  const n = Math.ceil(track.length / STEP);
  for (let i = 0; i <= n; i++) {
    const p = track.pointAt((i / n) * track.length);
    pts.push([p.x + Math.sin(p.heading) * offset, p.y - Math.cos(p.heading) * offset]);
  }
  return pts;
}

// Cinta horizontal entre dos desplazamientos laterales.
function ribbon(track, inner, outer, y, colorFn) {
  const a = offsetPoints(track, inner);
  const b = offsetPoints(track, outer);
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < a.length - 1; i++) {
    const quad = [a[i], b[i], a[i + 1], b[i], b[i + 1], a[i + 1]];
    colorFn(i, c);
    for (const [x, z] of quad) {
      pos.push(x, y, -z);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Muro vertical a un desplazamiento lateral.
function wall(track, offset, height) {
  const pts = offsetPoints(track, offset);
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    pos.push(x0, 0, -z0, x1, 0, -z1, x1, height, -z1);
    pos.push(x0, 0, -z0, x1, height, -z1, x0, height, -z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Generador pseudoaleatorio con semilla (mismos árboles cada vez).
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function buildTrack(track, theme = {}) {
  const group = new THREE.Group();
  const hw = track.halfWidth;
  const b = trackBounds(track);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + 1200, b.maxY - b.minY + 1200),
    new THREE.MeshLambertMaterial({ color: theme.ground ?? 0x4f7a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, -cy);
  ground.receiveShadow = true;
  group.add(ground);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2f7fb8 });
  // Mar al sur de la pista.
  if (theme.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + 1200, 600), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(cx, 0.03, -(b.minY + 30 - 300));
    group.add(sea);
  }
  // Laguna dentro del circuito.
  let lakePoly = null;
  if (theme.lake) {
    lakePoly = [];
    for (let s = 0; s < track.length; s += 10) {
      const p = track.pointAt(s);
      lakePoly.push([cx + (p.x - cx) * 0.72, cy + (p.y - cy) * 0.72]);
    }
    const shape = new THREE.Shape(lakePoly.map(([x, y]) => new THREE.Vector2(x, y)));
    const lake = new THREE.Mesh(new THREE.ShapeGeometry(shape), waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = 0.03;
    group.add(lake);
  }

  // Árboles (una sola malla instanciada para tronco y otra para copa).
  if (theme.trees) {
    const rand = rng(track.length | 0);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), new THREE.MeshLambertMaterial({ color: 0x5a3d26 }), theme.trees);
    const tops = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 7, 7), new THREE.MeshLambertMaterial({ color: theme.treeColor ?? 0x2e6b35 }), theme.trees);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let tries = 0; n < theme.trees && tries < theme.trees * 30; tries++) {
      const x = b.minX - 100 + rand() * (b.maxX - b.minX + 200);
      const y = b.minY - 100 + rand() * (b.maxY - b.minY + 200);
      if (Math.abs(track.project(x, y).d) < hw + 8) continue;
      if (theme.sea && y < b.minY + 30) continue;
      if (lakePoly && pointInPolygon(x, y, lakePoly)) continue;
      const k = 0.7 + rand() * 0.8;
      m.makeScale(k, k, k).setPosition(x, 1.5 * k, -y);
      trunks.setMatrixAt(n, m);
      m.makeScale(k, k, k).setPosition(x, 6 * k, -y);
      tops.setMatrixAt(n, m);
      n++;
    }
    trunks.count = tops.count = n;
    tops.castShadow = true;
    group.add(trunks, tops);
  }

  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const asphalt = new THREE.Mesh(ribbon(track, -hw, hw, 0.06, (i, c) => c.set(0x3a3d42)), vcMat);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // Bordes rojo/blanco (pianos).
  const kerbColor = (i, c) => c.set(Math.floor(i / 2) % 2 ? 0xd8d8d8 : 0xc0392b);
  for (const [a, b2] of [[hw - 1.2, hw], [-hw, -hw + 1.2]]) {
    const k = new THREE.Mesh(ribbon(track, a, b2, 0.12, kerbColor), vcMat);
    k.receiveShadow = true;
    group.add(k);
  }

  // Línea central discontinua.
  const dashColor = (i, c) => c.set(i % 3 === 0 ? 0xe8e8e8 : 0x3a3d42);
  group.add(new THREE.Mesh(ribbon(track, -0.15, 0.15, 0.12, dashColor), vcMat));

  // Muros.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(wall(track, hw, 1.2), wallMat));
  group.add(new THREE.Mesh(wall(track, -hw, 1.2), wallMat));

  // Meta: se arma en ejes locales (x = adelante, z = derecha) y se coloca en s = 0.
  const start = new THREE.Group();
  const p0 = track.pointAt(0);
  start.position.set(p0.x, 0, -p0.y);
  start.rotation.y = p0.heading;
  group.add(start);

  const cells = 12;
  const size = track.width / cells;
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const cell = new THREE.PlaneGeometry(size, size);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < 2; j++) {
      const m = new THREE.Mesh(cell, (i + j) % 2 ? white : black);
      m.rotation.x = -Math.PI / 2;
      m.position.set((j - 0.5) * size, 0.14, -hw + (i + 0.5) * size);
      start.add(m);
    }
  }

  // Arco de meta.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const post = new THREE.BoxGeometry(0.6, 8, 0.6);
  for (const z of [-hw - 1, hw + 1]) {
    const p = new THREE.Mesh(post, postMat);
    p.position.set(0, 4, z);
    start.add(p);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.6, track.width + 2.6),
    new THREE.MeshLambertMaterial({ color: 0xf2a900 }),
  );
  banner.position.set(0, 7.5, 0);
  start.add(banner);

  return group;
}
