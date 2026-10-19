// Modelos 3D de los carros, generados por código (sin texturas).
// La carrocería se arma con secciones transversales redondeadas a lo largo
// del carro ("loft"), siguiendo un perfil lateral distinto para cada estilo.
// El frente apunta a +X, la izquierda a -Z, arriba a +Y.
import * as THREE from 'three';

// Perfiles normalizados: x de -0.5 (cola) a 0.5 (frente).
// body/cabin: altura como fracción del alto total. plan: ancho como fracción.
export const STYLES = {
  // Deportivo en cuña (Raptor GT)
  sports: {
    body: [[-0.5, 0.42], [-0.47, 0.52], [-0.35, 0.56], [-0.1, 0.56], [0.15, 0.52], [0.35, 0.45], [0.47, 0.36], [0.5, 0.28]],
    cabin: [[-0.3, 0.56], [-0.2, 0.88], [-0.02, 1.0], [0.1, 0.97], [0.26, 0.55]],
    plan: [[-0.5, 0.85], [-0.4, 1], [0.3, 1], [0.45, 0.9], [0.5, 0.75]],
    head: 'slim', tail: 'round', spoiler: true,
  },
  // Hatchback compacto (Nizan Marsh)
  hatch: {
    body: [[-0.5, 0.52], [-0.47, 0.6], [-0.42, 0.62], [0.1, 0.6], [0.3, 0.55], [0.44, 0.45], [0.5, 0.32]],
    cabin: [[-0.46, 0.62], [-0.43, 0.92], [-0.32, 1.0], [-0.02, 1.0], [0.08, 0.95], [0.28, 0.6]],
    plan: [[-0.5, 0.85], [-0.44, 0.98], [0.3, 1], [0.45, 0.9], [0.5, 0.76]],
    head: 'round', tail: 'tall',
  },
  // Sedán eléctrico tipo fastback (Porshe Taikan)
  sedan: {
    body: [[-0.5, 0.48], [-0.46, 0.58], [-0.4, 0.6], [-0.1, 0.58], [0.2, 0.53], [0.38, 0.48], [0.47, 0.38], [0.5, 0.3]],
    cabin: [[-0.4, 0.6], [-0.26, 0.84], [-0.1, 0.98], [0.05, 1.0], [0.15, 0.9], [0.3, 0.55]],
    plan: [[-0.5, 0.82], [-0.42, 0.98], [0.3, 1], [0.45, 0.9], [0.5, 0.72]],
    head: 'quad', tail: 'bar',
  },
  // Muscle car (Fort Mustank)
  muscle: {
    body: [[-0.5, 0.5], [-0.48, 0.6], [-0.42, 0.63], [-0.2, 0.62], [0.05, 0.6], [0.4, 0.58], [0.48, 0.5], [0.5, 0.36]],
    cabin: [[-0.38, 0.62], [-0.3, 0.78], [-0.15, 0.97], [-0.02, 1.0], [0.06, 0.95], [0.18, 0.61]],
    plan: [[-0.5, 0.9], [-0.45, 0.98], [0.35, 1], [0.47, 0.95], [0.5, 0.85]],
    head: 'slim', tail: 'tribar', spoiler: false,
  },
};

const STATIONS = 28; // secciones a lo largo del carro
const RING = 18;     // puntos por sección

// Interpola linealmente un perfil [[x, v], ...].
function sample(profile, x) {
  if (x <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    if (x <= profile[i][0]) {
      const [x0, v0] = profile[i - 1];
      const [x1, v1] = profile[i];
      const t = (x - x0) / (x1 - x0);
      // suavizado (smoothstep) para que la carrocería no se vea quebrada
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * s;
    }
  }
  return profile[profile.length - 1][1];
}

// Superficie cerrada a partir de secciones { x, bottom, top, wBottom, wTop }.
function loft(sections, roundness = 4) {
  const pos = [];
  const idx = [];
  const e = 2 / roundness;
  for (const s of sections) {
    const cy = (s.bottom + s.top) / 2;
    const hy = (s.top - s.bottom) / 2;
    for (let j = 0; j < RING; j++) {
      const a = (j / RING) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const y = cy + hy * Math.sign(sn) * Math.abs(sn) ** e;
      const t = (y - s.bottom) / Math.max(s.top - s.bottom, 1e-3);
      const w = s.wBottom + (s.wTop - s.wBottom) * t; // "tumblehome": más angosto arriba
      pos.push(s.x, y, w * Math.sign(c) * Math.abs(c) ** e);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < RING; j++) {
      const a = i * RING + j;
      const b = i * RING + ((j + 1) % RING);
      const c = a + RING;
      const d = b + RING;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Tapas en los extremos.
  for (const [i, flip] of [[0, true], [sections.length - 1, false]]) {
    const s = sections[i];
    const center = pos.length / 3;
    pos.push(s.x, (s.bottom + s.top) / 2, 0);
    for (let j = 0; j < RING; j++) {
      const a = i * RING + j;
      const b = i * RING + ((j + 1) % RING);
      if (flip) idx.push(center, a, b);
      else idx.push(center, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const MATS = {
  glass: new THREE.MeshPhongMaterial({ color: 0x141c26, shininess: 90, specular: 0x88aacc }),
  tire: new THREE.MeshLambertMaterial({ color: 0x141414 }),
  rim: new THREE.MeshPhongMaterial({ color: 0xb8bcc2, shininess: 60 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x0c0c0c }),
  trim: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  head: new THREE.MeshBasicMaterial({ color: 0xfff6d0 }),
};

function wheel(radius, width) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), MATS.tire);
  tire.rotation.x = Math.PI / 2;
  g.add(tire);
  const rimR = radius * 0.68;
  for (const side of [1, -1]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.02, 20), MATS.rim);
    face.rotation.x = Math.PI / 2;
    face.position.z = (side * width) / 2;
    g.add(face);
    // 5 rayos
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(rimR * 1.9, 0.05, 0.03), MATS.trim);
      spoke.rotation.z = (k * Math.PI) / 5;
      spoke.position.z = side * (width / 2 + 0.012);
      g.add(spoke);
    }
  }
  return g;
}

// Construye el modelo. Devuelve { group, wheels, tailMat }.
export function buildCarModel(spec, styleId, color) {
  const style = STYLES[styleId] ?? STYLES.sports;
  const L = spec.length;
  const W = spec.width;
  const H = spec.height ?? 1.3;
  const clearance = 0.16;
  const group = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x555555 });

  // Carrocería
  const body = [];
  for (let i = 0; i <= STATIONS; i++) {
    const x = -0.5 + i / STATIONS;
    const half = (sample(style.plan, x) * W) / 2;
    const end = Math.min(1, (0.5 - Math.abs(x)) * 12); // defensas un poco más altas
    body.push({
      x: x * L,
      bottom: clearance + (1 - end) * 0.08,
      top: sample(style.body, x) * H,
      wBottom: half * 0.96,
      wTop: half * 0.9,
    });
  }
  const bodyMesh = new THREE.Mesh(loft(body, 5), paint);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Cabina (vidrios)
  const cx0 = style.cabin[0][0];
  const cx1 = style.cabin[style.cabin.length - 1][0];
  const cabin = [];
  for (let i = 0; i <= 16; i++) {
    const x = cx0 + ((cx1 - cx0) * i) / 16;
    const half = (sample(style.plan, x) * W) / 2;
    const base = sample(style.body, x) * H - 0.02;
    cabin.push({
      x: x * L,
      bottom: base,
      top: Math.max(base + 0.01, sample(style.cabin, x) * H),
      wBottom: half * 0.86,
      wTop: half * 0.66,
    });
  }
  const cabinMesh = new THREE.Mesh(loft(cabin, 3), MATS.glass);
  cabinMesh.castShadow = true;
  group.add(cabinMesh);

  // Techo pintado sobre el vidrio (franja central).
  const roof = cabin
    .filter((s) => s.top > H * 0.9)
    .map((s) => ({ ...s, bottom: s.top - 0.03, top: s.top + 0.012, wBottom: s.wTop * 0.9, wTop: s.wTop * 0.85 }));
  if (roof.length > 2) group.add(new THREE.Mesh(loft(roof, 6), paint));

  // Ruedas y arcos
  const r = spec.wheelRadius ?? 0.33;
  const tw = Math.max(0.2, W * 0.12);
  const wheels = [];
  const zWheel = W / 2 - tw / 2 - 0.02;
  for (const [x, z, front] of [
    [spec.cgToFront, zWheel, true], [spec.cgToFront, -zWheel, true],
    [-spec.cgToRear, zWheel, false], [-spec.cgToRear, -zWheel, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const w = wheel(r, tw);
    pivot.add(w);
    group.add(pivot);
    wheels.push({ pivot, mesh: w, front });

    const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.05, 6, 18, Math.PI), MATS.dark);
    arch.position.set(x, r, Math.sign(z) * ((sample(style.plan, x / L) * W) / 2) * 0.96);
    group.add(arch);
  }

  // Parrilla
  const noseTop = sample(style.body, 0.5) * H;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.04, Math.max(0.08, (noseTop - clearance) * 0.45), W * 0.42), MATS.trim);
  grille.position.set(L / 2 + 0.005, clearance + 0.12, 0);
  group.add(grille);

  // Faros
  const frontX = L * 0.485;
  const headY = Math.max(clearance + 0.15, sample(style.body, 0.47) * H - 0.1);
  const headZ = W * 0.33;
  for (const s of [1, -1]) {
    if (style.head === 'round') {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), MATS.head);
      h.scale.set(0.5, 0.8, 1.2);
      h.position.set(frontX, headY, s * headZ);
      group.add(h);
    } else if (style.head === 'quad') {
      for (const [dy, dz] of [[0.04, 0.05], [0.04, -0.05], [-0.04, 0.05], [-0.04, -0.05]]) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), MATS.head);
        h.position.set(frontX, headY + dy, s * headZ + dz);
        group.add(h);
      }
    } else {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.34), MATS.head);
      h.position.set(L * 0.465, headY, s * W * 0.3);
      group.add(h);
    }
  }

  // Calaveras (se encienden al frenar)
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const backX = -L * 0.5 - 0.01;
  const tailY = sample(style.body, -0.48) * H - 0.12;
  if (style.tail === 'bar') {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, W * 0.8), tailMat);
    t.position.set(backX, tailY, 0);
    group.add(t);
  }
  for (const s of [1, -1]) {
    if (style.tail === 'tribar') {
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.05), tailMat);
        t.position.set(backX, tailY, s * (W * 0.3 + k * 0.08));
        group.add(t);
      }
    } else if (style.tail === 'tall') {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.12), tailMat);
      t.position.set(backX + 0.05, tailY + 0.1, s * W * 0.4);
      group.add(t);
    } else if (style.tail === 'round') {
      for (const dz of [0, 0.2]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), tailMat);
        t.rotation.z = Math.PI / 2;
        t.position.set(backX, tailY, s * (W * 0.25 + dz));
        group.add(t);
      }
    } else {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.3), tailMat);
      t.position.set(backX, tailY, s * W * 0.32);
      group.add(t);
    }
  }

  // Espejos
  const mirrorX = sample(style.cabin, cx1) > 0 ? cx1 * L - 0.1 : 0;
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), paint);
    m.position.set(mirrorX, sample(style.body, cx1) * H + 0.08, s * (W / 2 + 0.05));
    group.add(m);
  }

  // Alerón
  if (style.spoiler) {
    const deckY = sample(style.body, -0.45) * H;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, W * 0.92), paint);
    wing.position.set(-L / 2 + 0.2, deckY + 0.2, 0);
    group.add(wing);
    for (const s of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.04), MATS.trim);
      post.position.set(-L / 2 + 0.22, deckY + 0.1, s * W * 0.3);
      group.add(post);
    }
  }

  // Escapes
  for (const s of styleId === 'muscle' ? [1, -1] : styleId === 'sedan' ? [] : [1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), MATS.trim);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-L / 2 - 0.02, clearance + 0.08, s * W * 0.3);
    group.add(pipe);
  }

  return { group, wheels, tailMat };
}
