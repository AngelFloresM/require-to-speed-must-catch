// Geometría de la pista: asfalto, bordes, muros, línea de meta y pasto.
// Todo con colores planos (sin texturas) y pocas mallas para que sea rápido.
import * as THREE from 'three';

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

export function buildTrack(track) {
  const group = new THREE.Group();
  const hw = track.halfWidth;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 1200),
    new THREE.MeshLambertMaterial({ color: 0x4f7a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const asphalt = new THREE.Mesh(ribbon(track, -hw, hw, 0.02, (i, c) => c.set(0x3a3d42)), vcMat);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // Bordes rojo/blanco (pianos).
  const kerbColor = (i, c) => c.set(Math.floor(i / 2) % 2 ? 0xd8d8d8 : 0xc0392b);
  for (const [a, b] of [[hw - 1.2, hw], [-hw, -hw + 1.2]]) {
    const k = new THREE.Mesh(ribbon(track, a, b, 0.04, kerbColor), vcMat);
    k.receiveShadow = true;
    group.add(k);
  }

  // Línea central discontinua.
  const dashColor = (i, c) => c.set(i % 3 === 0 ? 0xe8e8e8 : 0x3a3d42);
  group.add(new THREE.Mesh(ribbon(track, -0.15, 0.15, 0.03, dashColor), vcMat));

  // Muros.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(wall(track, hw, 1.2), wallMat));
  group.add(new THREE.Mesh(wall(track, -hw, 1.2), wallMat));

  // Línea de meta a cuadros (en x = 0, recta de abajo).
  const cells = 12;
  const size = track.width / cells;
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const cell = new THREE.PlaneGeometry(size, size);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < 2; j++) {
      const m = new THREE.Mesh(cell, (i + j) % 2 ? white : black);
      m.rotation.x = -Math.PI / 2;
      m.position.set((j - 0.5) * size, 0.05, track.radius - hw + (i + 0.5) * size);
      group.add(m);
    }
  }

  // Arco de meta.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const post = new THREE.BoxGeometry(0.6, 8, 0.6);
  for (const z of [track.radius - hw - 1, track.radius + hw + 1]) {
    const p = new THREE.Mesh(post, postMat);
    p.position.set(0, 4, z);
    group.add(p);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.6, track.width + 2.6),
    new THREE.MeshLambertMaterial({ color: 0xf2a900 }),
  );
  banner.position.set(0, 7.5, track.radius);
  group.add(banner);

  return group;
}
