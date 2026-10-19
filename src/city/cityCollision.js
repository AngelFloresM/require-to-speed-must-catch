// Colisión con la ciudad: solo se puede estar sobre las calles y dentro del
// área jugable. Fuera de eso (banquetas, casas, parques, barreras) es "muro".
import { drivableGap, boundaryPush } from './city.js';
import { resolveWallContact } from '../physics/collision.js';

const CURB = { restitution: 0.12, friction: 0.12 };

export function collideWithCity(car, city) {
  let hit = 0;
  for (const c of car.corners()) {
    let pen = 0;
    let nx = 0;
    let ny = 0;
    const g = drivableGap(city, c.x, c.y);
    if (g && g.gap > 0) {
      pen = g.gap;
      nx = g.nx;
      ny = g.ny;
    }
    const b = boundaryPush(city, c.x, c.y);
    if (b && b.d > pen) {
      pen = b.d;
      nx = (b.cx - c.x) / b.d;
      ny = (b.cy - c.y) / b.d;
    }
    // Banquetas: rebote y raspón más suaves que los muros de las pistas.
    if (pen > 0) hit = Math.max(hit, resolveWallContact(car, c, nx, ny, pen, CURB));
  }
  return hit;
}
