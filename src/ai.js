// IA simple: sigue un carril de la pista mirando un punto adelante.
// Incluye "rubber banding" suave, como en NFS: los rivales se ajustan
// según la distancia al jugador.

const G = 9.81;

export class Driver {
  constructor(racer, track, { lane = 0, skill = 0.9 } = {}) {
    this.racer = racer;
    this.track = track;
    this.lane = lane;   // desplazamiento lateral preferido (m, + hacia afuera)
    this.skill = skill; // 0..1, qué tanto se acerca al límite de agarre
  }

  update(player) {
    const car = this.racer.car;
    const track = this.track;
    const pr = track.project(car.x, car.y);
    const speed = Math.max(car.forwardSpeed, 0);

    // Punto objetivo adelante, sobre el carril.
    const look = 8 + speed * 0.6;
    const tp = track.pointAt(pr.s + look);
    const nx = Math.sin(tp.heading); // normal hacia afuera = derecha del sentido de carrera
    const ny = -Math.cos(tp.heading);
    const tx = tp.x + nx * this.lane;
    const ty = tp.y + ny * this.lane;

    let ang = Math.atan2(ty - car.y, tx - car.x) - car.heading;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    const steer = Math.max(-1, Math.min(1, ang * 2.5));

    // Velocidad objetivo según la curva que viene.
    const ahead = track.pointAt(pr.s + 20 + speed * 1.2);
    const curv = Math.max(tp.curvature, ahead.curvature);
    const radius = curv > 0 ? 1 / curv + this.lane : Infinity;
    const maxCorner = Math.sqrt(car.spec.grip * G * radius) * (0.8 + 0.25 * this.skill);
    const target = Math.min(maxCorner, car.topSpeed);

    // Rubber banding.
    const gap = player ? player.dist - this.racer.dist : 0; // + si el jugador va adelante
    car.powerScale = Math.max(0.85, Math.min(1.25, 1 + gap / 600)) * (0.9 + 0.1 * this.skill);

    const inp = car.input;
    inp.steer = steer;
    inp.handbrake = false;
    inp.nitro = gap > 60 && Math.abs(steer) < 0.2;
    if (speed < target) {
      inp.throttle = 1;
      inp.brake = 0;
    } else {
      inp.throttle = 0;
      inp.brake = speed > target + 3 ? 1 : 0;
    }
  }
}
