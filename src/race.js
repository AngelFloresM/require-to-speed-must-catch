// Lógica de carrera sin gráficos: carros, vueltas, posiciones y colisiones.

import { Vehicle } from './physics/vehicle.js';
import { collideWithWalls, collideCars } from './physics/collision.js';
import { Driver } from './ai.js';
import { wrapDelta } from './track.js';

export const PHYSICS_DT = 1 / 120;

export class Racer {
  constructor(name, spec, color, isPlayer = false) {
    this.name = name;
    this.car = new Vehicle(spec);
    this.color = color;
    this.isPlayer = isPlayer;
    this.dist = 0;          // distancia acumulada (negativa antes de cruzar la meta)
    this.lastS = 0;
    this.lapsDone = 0;
    this.lapTimes = [];
    this.lapStart = 0;
    this.finished = false;
    this.finishTime = 0;
    this.wrongWayTime = 0;
    this.stuckTime = 0;
    this.position = 1;
  }
}

export class Race {
  constructor(track, playerSpec, { laps = 3, rivals = [] } = {}) {
    this.track = track;
    this.laps = laps;
    this.time = 0;          // tiempo de carrera (empieza tras la cuenta regresiva)
    this.countdown = 3;
    this.state = 'countdown'; // countdown | racing | finished
    this.player = new Racer('Tú', playerSpec, playerSpec.color, true);
    this.racers = [this.player];
    this.drivers = [];
    rivals.forEach((r) => {
      const racer = new Racer(r.name, r.spec, r.color);
      racer.model = r.model;
      this.racers.push(racer);
      this.drivers.push(new Driver(racer, track, { lane: r.lane ?? 0, skill: r.skill ?? 0.9 }));
    });
    this.onHit = null; // callback(fuerza)
    this.placeOnGrid();
  }

  placeOnGrid() {
    // El jugador sale al final, como en MW.
    const order = [...this.racers.slice(1), this.player];
    order.forEach((r, i) => {
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? -3.5 : 3.5;
      const s = this.track.length - 8 - row * 9;
      const p = this.track.pointAt(s);
      // y negativa = afuera en la recta de abajo
      r.car.place(p.x, p.y + side, p.heading);
      r.lastS = s;
      r.dist = s - this.track.length;
    });
  }

  // Avanza la simulación un paso fijo.
  step(dt = PHYSICS_DT) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = 'racing';
        for (const r of this.racers) r.lapStart = 0;
      }
    }
    const frozen = this.state === 'countdown';

    for (const d of this.drivers) {
      if (d.racer.finished) this.coast(d.racer);
      else d.update(this.player, this.racers);
    }
    if (this.player.finished) this.coast(this.player);

    for (const r of this.racers) {
      if (frozen) {
        // Durante la cuenta regresiva no se mueven.
        r.car.vx = r.car.vy = r.car.yawRate = 0;
        continue;
      }
      r.car.update(dt);
      const hit = collideWithWalls(r.car, this.track);
      if (hit > 3 && r.isPlayer && this.onHit) this.onHit(hit);
    }
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const hit = collideCars(this.racers[i].car, this.racers[j].car);
        const involvesPlayer = this.racers[i].isPlayer || this.racers[j].isPlayer;
        if (hit > 2 && involvesPlayer && this.onHit) this.onHit(hit);
      }
    }

    if (this.state !== 'countdown') this.time += dt;
    for (const r of this.racers) this.updateProgress(r, dt);
    this.updatePositions();
  }

  coast(racer) {
    const inp = racer.car.input;
    inp.throttle = 0;
    inp.brake = 0.3;
    inp.nitro = false;
    inp.handbrake = false;
  }

  updateProgress(r, dt) {
    const pr = this.track.project(r.car.x, r.car.y);
    r.dist += wrapDelta(pr.s - r.lastS, this.track.length);
    r.lastS = pr.s;

    // Sentido contrario: velocidad opuesta a la dirección de la pista.
    const tp = this.track.pointAt(pr.s);
    const along = r.car.vx * Math.cos(tp.heading) + r.car.vy * Math.sin(tp.heading);
    r.wrongWayTime = along < -3 ? r.wrongWayTime + dt : 0;

    // IA atorada (lenta, atravesada o en sentido contrario): reaparece en la pista.
    if (!r.isPlayer && this.state === 'racing' && !r.finished) {
      let rel = r.car.heading - tp.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const stuck = r.car.speed < 8 || Math.abs(rel) > 1 || r.wrongWayTime > 0;
      r.stuckTime = stuck ? r.stuckTime + dt : 0;
      if (r.stuckTime > 2.5) {
        this.respawn(r);
        r.stuckTime = 0;
      }
    }

    if (r.finished || this.state === 'countdown') return;
    const laps = Math.floor(r.dist / this.track.length);
    if (laps > r.lapsDone) {
      r.lapsDone = laps;
      r.lapTimes.push(this.time - r.lapStart);
      r.lapStart = this.time;
      if (laps >= this.laps) {
        r.finished = true;
        r.finishTime = this.time;
        if (r.isPlayer) this.state = 'finished';
      }
    }
  }

  updatePositions() {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.dist - a.dist;
    });
    sorted.forEach((r, i) => (r.position = i + 1));
  }

  // Regresa un carro al centro de la pista (tecla R, o IA atorada).
  // Busca un hueco libre de otros carros para no aparecer encima de nadie.
  respawn(racer) {
    const pr = this.track.project(racer.car.x, racer.car.y);
    for (const lateral of [0, -5, 5, -8, 8]) {
      const p = this.track.pointAt(pr.s);
      const x = p.x + Math.sin(p.heading) * lateral;
      const y = p.y - Math.cos(p.heading) * lateral;
      const free = this.racers.every((o) => o === racer || Math.hypot(o.car.x - x, o.car.y - y) > 6);
      if (free || lateral === 8) {
        racer.car.place(x, y, p.heading);
        return;
      }
    }
  }

  get currentLap() {
    return Math.min(this.laps, this.player.lapsDone + 1);
  }
}
