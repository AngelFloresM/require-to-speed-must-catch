// Colisiones: carro contra muros de la pista y carro contra carro.

const WALL_RESTITUTION = 0.3;
const WALL_FRICTION = 0.25;
const CAR_RESTITUTION = 0.4;

// Velocidad de un punto del carro (r = posición relativa al centro).
function pointVelocity(car, rx, ry) {
  return { x: car.vx - car.yawRate * ry, y: car.vy + car.yawRate * rx };
}

// Empuja una esquina del carro fuera de un muro (n = normal hacia donde se
// puede estar) y aplica rebote y raspón. Devuelve la velocidad del golpe (m/s).
export function resolveWallContact(car, c, nx, ny, pen) {
  car.x += nx * pen;
  car.y += ny * pen;

  const v = pointVelocity(car, c.rx, c.ry);
  const vn = v.x * nx + v.y * ny;
  if (vn >= 0) return 0;

  const m = car.spec.mass;
  const I = car.spec.inertia;
  const rn = c.rx * ny - c.ry * nx;
  const j = (-(1 + WALL_RESTITUTION) * vn) / (1 / m + (rn * rn) / I);
  car.applyImpulse(nx * j, ny * j, c.rx, c.ry);

  // Fricción contra el muro (raspón).
  const tx = -ny;
  const ty = nx;
  const vt = v.x * tx + v.y * ty;
  const rt = c.rx * ty - c.ry * tx;
  let jt = -vt / (1 / m + (rt * rt) / I);
  jt = Math.max(-WALL_FRICTION * j, Math.min(WALL_FRICTION * j, jt));
  car.applyImpulse(tx * jt, ty * jt, c.rx, c.ry);
  return -vn;
}

// Devuelve la fuerza del golpe más fuerte (m/s) para efectos/sonido.
export function collideWithWalls(car, track) {
  const limit = track.halfWidth;
  let hit = 0;
  for (const c of car.corners()) {
    const pr = track.project(c.x, c.y);
    let pen = 0;
    let nx = 0;
    let ny = 0;
    if (pr.d > limit) {
      pen = pr.d - limit;
      nx = -pr.nx; // empuja hacia adentro de la pista
      ny = -pr.ny;
    } else if (pr.d < -limit) {
      pen = -limit - pr.d;
      nx = pr.nx;
      ny = pr.ny;
    } else continue;

    hit = Math.max(hit, resolveWallContact(car, c, nx, ny, pen));
  }
  return hit;
}

// Cada carro se aproxima con dos círculos (frente y cola).
function circles(car) {
  const off = car.spec.length / 2 - car.spec.width / 2;
  const c = Math.cos(car.heading);
  const s = Math.sin(car.heading);
  const r = car.spec.width / 2 + 0.05;
  return [
    { rx: c * off, ry: s * off, r },
    { rx: -c * off, ry: -s * off, r },
  ];
}

export function collideCars(a, b) {
  // Descarte rápido por distancia.
  const reach = (a.spec.length + b.spec.length) / 2 + 0.5;
  if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) return 0;
  let hit = 0;
  for (const ca of circles(a)) {
    for (const cb of circles(b)) {
      const ax = a.x + ca.rx;
      const ay = a.y + ca.ry;
      const bx = b.x + cb.rx;
      const by = b.y + cb.ry;
      let dx = bx - ax;
      let dy = by - ay;
      const dist = Math.hypot(dx, dy);
      const minDist = ca.r + cb.r;
      if (dist >= minDist || dist === 0) continue;
      const nx = dx / dist; // de a hacia b
      const ny = dy / dist;
      const pen = minDist - dist;
      const ma = a.spec.mass;
      const mb = b.spec.mass;
      a.x -= nx * pen * (mb / (ma + mb));
      a.y -= ny * pen * (mb / (ma + mb));
      b.x += nx * pen * (ma / (ma + mb));
      b.y += ny * pen * (ma / (ma + mb));

      // Punto de contacto relativo a cada centro de masa.
      const px = ax + nx * ca.r;
      const py = ay + ny * ca.r;
      const rax = px - a.x, ray = py - a.y;
      const rbx = px - b.x, rby = py - b.y;
      const va = pointVelocity(a, rax, ray);
      const vb = pointVelocity(b, rbx, rby);
      const vn = (vb.x - va.x) * nx + (vb.y - va.y) * ny;
      if (vn >= 0) continue;
      hit = Math.max(hit, -vn);
      const rna = rax * ny - ray * nx;
      const rnb = rbx * ny - rby * nx;
      const j = (-(1 + CAR_RESTITUTION) * vn) /
        (1 / ma + 1 / mb + (rna * rna) / a.spec.inertia + (rnb * rnb) / b.spec.inertia);
      a.applyImpulse(-nx * j, -ny * j, rax, ray);
      b.applyImpulse(nx * j, ny * j, rbx, rby);
    }
  }
  return hit;
}
