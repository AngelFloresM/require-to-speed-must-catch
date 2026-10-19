// Modo libre: manejar por la ciudad sin carrera.
import { Vehicle } from './physics/vehicle.js';
import { collideWithCity } from './city/cityCollision.js';
import { nearestRoad } from './city/city.js';

export class FreeRide {
  constructor(city, spec) {
    this.city = city;
    this.player = { car: new Vehicle(spec), isPlayer: true };
    this.time = 0;
    this.onHit = null;
    const s = city.spawn;
    this.player.car.place(s.x, s.y, s.heading);
  }

  step(dt) {
    const car = this.player.car;
    car.update(dt);
    const hit = collideWithCity(car, this.city);
    if (hit > 3 && this.onHit) this.onHit(hit);
    this.time += dt;
  }

  // Calle en la que está el jugador (o null).
  street() {
    const nr = nearestRoad(this.city, this.player.car.x, this.player.car.y);
    return nr && nr.gap < 2 ? nr.edge.road : null;
  }

  // Regresa al centro de la calle más cercana, en un sentido permitido.
  respawn() {
    const car = this.player.car;
    const nr = nearestRoad(this.city, car.x, car.y);
    if (!nr) {
      const s = this.city.spawn;
      car.place(s.x, s.y, s.heading);
      return;
    }
    const { seg } = nr;
    let heading = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
    const road = nr.edge.road;
    const sameDir = Math.cos(heading - car.heading) >= 0;
    if (road.oneway === -1 || (road.oneway === 0 && !sameDir)) heading += Math.PI;
    car.place(nr.cx, nr.cy, heading);
  }
}
