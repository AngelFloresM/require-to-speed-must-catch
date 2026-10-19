// Colisión con la ciudad: solo se puede estar sobre las calles y dentro del
// área jugable. Fuera de eso (banquetas, casas, parques, barreras) es "muro".
import { nearestRoad, boundaryPush } from './city.js';
import { resolveWallContact } from '../physics/collision.js';

export function collideWithCity(car, city) {
  let hit = 0;
  for (const c of car.corners()) {
    let pen = 0;
    let nx = 0;
    let ny = 0;
    const nr = nearestRoad(city, c.x, c.y);
    if (nr && nr.gap > 0) {
      pen = nr.gap;
      nx = (nr.cx - c.x) / nr.dist;
      ny = (nr.cy - c.y) / nr.dist;
    }
    const b = boundaryPush(city, c.x, c.y);
    if (b && b.d > pen) {
      pen = b.d;
      nx = (b.cx - c.x) / b.d;
      ny = (b.cy - c.y) / b.d;
    }
    if (pen > 0) hit = Math.max(hit, resolveWallContact(car, c, nx, ny, pen));
  }
  return hit;
}
