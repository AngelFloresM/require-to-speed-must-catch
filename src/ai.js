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

  update(player, racers = []) {
    const car = this.racer.car;
    const track = this.track;
    const pr = track.project(car.x, car.y);
    const speed = Math.max(car.forwardSpeed, 0);
    const lane = this.laneWithAvoidance(racers, speed);

    // Punto objetivo adelante, sobre el carril.
    const look = 8 + speed * 0.6;
    const tp = track.pointAt(pr.s + look);
    const nx = Math.sin(tp.heading); // normal hacia afuera = derecha del sentido de carrera
    const ny = -Math.cos(tp.heading);
    const tx = tp.x + nx * lane;
    const ty = tp.y + ny * lane;

    let ang = Math.atan2(ty - car.y, tx - car.x) - car.heading;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    const steer = Math.max(-1, Math.min(1, ang * 2.5));

    // Velocidad objetivo según la curva que viene.
    const ahead = track.pointAt(pr.s + 20 + speed * 1.2);
    const curv = Math.max(tp.curvature, ahead.curvature);
    const radius = curv > 0 ? 1 / curv + lane : Infinity;
    // v² = μ·g·R·(1 + downforce·v²/(m·g))  =>  v² = μ·g·R / (1 - μ·k·R/m)
    const { grip, downforce, mass } = car.spec;
    const denom = Math.max(0.2, 1 - (grip * downforce * radius) / mass);
    const maxCorner = Math.sqrt((grip * G * radius) / denom) * (0.9 + 0.12 * this.skill);
    let target = Math.min(maxCorner, car.topSpeed);

    // Rubber banding.
    const gap = player ? player.dist - this.racer.dist : 0; // + si el jugador va adelante
    car.powerScale = Math.max(0.85, Math.min(1.25, 1 + gap / 600)) * (0.9 + 0.1 * this.skill);

    // Si hay un carro justo enfrente más lento, no lo empuja: frena un poco.
    if (this.blocked) target = Math.min(target, this.blocked.speed);

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

  // Esquiva carros que van adelante cambiando de carril.
  laneWithAvoidance(racers, speed) {
    const car = this.racer.car;
    const limit = this.track.halfWidth - 2.5;
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    let lane = this.lane;
    this.blocked = null;
    for (const r of racers) {
      if (r === this.racer) continue;
      const o = r.car;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const fwd = dx * fx + dy * fy;
      const left = -dx * fy + dy * fx; // + = el otro va a mi izquierda
      if (fwd < -2 || fwd > 14 + speed * 0.4 || Math.abs(left) > 3) continue;
      // Pasa por el lado contrario (izquierda = adentro = carril negativo).
      const pr = this.track.project(o.x, o.y);
      lane = left > 0 ? pr.d + 4 : pr.d - 4;
      if (Math.abs(lane) > limit) lane = left > 0 ? pr.d - 4 : pr.d + 4;
      if (fwd > 0 && fwd < 9 && o.speed < speed) this.blocked = o;
      break;
    }
    return Math.max(-limit, Math.min(limit, lane));
  }
}
