// Modo libre: manejar por la ciudad sin carrera.
import { Vehicle } from './physics/vehicle.js';
import { collideWithCity } from './city/cityCollision.js';
import { nearestRoad } from './city/city.js';
import { Traffic } from './city/traffic.js';
import { lightFor } from './city/signals.js';
import { collideCars } from './physics/collision.js';

// Cuerpo de un carro de tráfico para el choque con el jugador (pesado, sin giro).
class TrafficBody {
  constructor(c) {
    this.c = c;
    this.spec = { length: 4.5, width: 1.85, mass: 4000, inertia: 1e9 };
    this.x = c.x;
    this.y = c.y;
    this.heading = c.h;
    this.vx = Math.cos(c.h) * c.speed;
    this.vy = Math.sin(c.h) * c.speed;
    this.yawRate = 0;
  }
  applyImpulse() {}
}

export class FreeRide {
  constructor(city, spec, { traffic = 0 } = {}) {
    this.city = city;
    this.player = { car: new Vehicle(spec), isPlayer: true };
    this.time = 0;
    this.onHit = null;
    this.message = null; // { text, until }
    this.wrongWayTime = 0;
    const s = city.spawn;
    this.player.car.place(s.x, s.y, s.heading);
    this.traffic = traffic ? new Traffic(city, { count: traffic, avoid: s }) : null;
    this.lastNode = null;
  }

  step(dt) {
    const car = this.player.car;
    car.update(dt);
    let hit = collideWithCity(car, this.city);
    if (this.traffic) {
      const t = this.traffic;
      t.lastPlayer = car;
      t.step(dt, { x: car.x, y: car.y, vx: car.vx, vy: car.vy, h: car.heading });
      for (const c of t.cars) {
        if (Math.abs(c.x - car.x) > 6 || Math.abs(c.y - car.y) > 6) continue;
        const body = new TrafficBody(c);
        const h = collideCars(car, body);
        if (h > 0) {
          hit = Math.max(hit, h);
          c.stun = 2.5; // el otro conductor se detiene un momento
        }
      }
    }
    if (hit > 3 && this.onHit) this.onHit(hit);
    this.time += dt;
    this.checkRules(dt);
  }

  // Avisos: pasarse el rojo e ir en sentido contrario.
  checkRules(dt) {
    const car = this.player.car;
    const nr = nearestRoad(this.city, car.x, car.y);
    if (!nr || nr.gap > 1) return;
    const { edge, seg } = nr;
    const sx = seg.bx - seg.ax;
    const sy = seg.by - seg.ay;
    const len = Math.hypot(sx, sy) || 1;
    const along = (car.vx * sx + car.vy * sy) / len; // + = en el orden del trazo
    const ow = edge.road.oneway;
    this.wrongWayTime = ow && along * ow < -3 ? this.wrongWayTime + dt : 0;

    // ¿Entra a un cruce con semáforo en rojo?
    if (Math.abs(along) < 3) return;
    const node = along > 0 ? edge.b : edge.a;
    if (!node.signal) return;
    const d = Math.hypot(car.x - node.x, car.y - node.y);
    const r = Math.max(...node.edges.map((e) => e.road.width / 2)) + 2;
    if (d < r && this.lastNode !== node) {
      this.lastNode = node;
      if (lightFor(node, edge, this.traffic ? this.traffic.time : this.time) === 'red') {
        this.message = { text: '¡Te pasaste el alto!', until: this.time + 2.5 };
      }
    }
    if (d > r + 5 && this.lastNode === node) this.lastNode = null;
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
