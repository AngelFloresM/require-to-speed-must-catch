// IA de los rivales.
// - Velocidad: mira la pista hacia adelante y calcula, con la física de su
//   propio carro, a qué velocidad puede ir en cada curva y dónde debe frenar.
// - Trazada: se carga hacia el interior de las curvas (corta la curva) y
//   vuelve al centro en las rectas.
// - Volante: "pure pursuit" (gira lo justo para llegar a un punto adelante).
// - Rubber banding suave, como en NFS, pero solo en rectas.

const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Driver {
  constructor(racer, track, { lane = 0, skill = 0.9 } = {}) {
    this.racer = racer;
    this.track = track;
    this.lane = lane;   // desplazamiento lateral preferido en rectas (m, + = derecha)
    this.skill = skill; // 0..1: qué tan cerca del límite maneja
    this.blocked = null;
  }

  // Velocidad máxima en una curva de radio R con el agarre del carro
  // (incluye carga aerodinámica): v² = μ·g·R / (1 - μ·k·R/m).
  cornerSpeed(radius) {
    const { grip, downforce, mass } = this.racer.car.spec;
    const denom = 1 - (grip * downforce * radius) / mass;
    if (denom <= 0.05) return Infinity;
    return Math.sqrt((grip * G * radius) / denom);
  }

  // Desaceleración con la que planea frenar (m/s²): menos que el máximo, por margen.
  brakeDecel(speed) {
    const { grip, downforce, mass, brakeForce } = this.racer.car.spec;
    const tire = grip * (G + (downforce * speed * speed) / mass);
    return Math.min(brakeForce / mass, tire) * (0.62 + 0.18 * this.skill);
  }

  // Velocidad a la que conviene ir ahora para poder frenar a tiempo en todo
  // lo que viene (perfil de frenado).
  targetSpeed(s, speed) {
    const car = this.racer.car;
    const decel = this.brakeDecel(speed);
    const horizon = 30 + (speed * speed) / (2 * decel) * 1.3;
    const usage = 0.86 + 0.12 * this.skill; // cuánto del agarre usa
    let target = car.topSpeed;
    for (let d = 0; d <= horizon; d += 4) {
      const curv = this.track.pointAt(s + d).curvature;
      if (curv < 1e-4) continue;
      const vCorner = this.cornerSpeed(1 / curv) * usage;
      target = Math.min(target, Math.sqrt(vCorner * vCorner + 2 * decel * d));
    }
    return target;
  }

  // Desplazamiento lateral de la trazada: hacia el interior de la curva que viene.
  racingLine(s) {
    let turn = 0;
    for (let d = 0; d <= 40; d += 8) turn += this.track.pointAt(s + d).turn ?? 0;
    turn /= 6;
    const room = this.track.halfWidth - 2.6;
    // turn > 0 = izquierda; interior = izquierda = lateral negativo.
    const inside = clamp(-turn * 900, -1, 1) * room * 0.8;
    return Math.abs(turn) > 0.002 ? inside : clamp(this.lane, -room, room);
  }

  update(player, racers = []) {
    const car = this.racer.car;
    const track = this.track;
    const pr = track.project(car.x, car.y);
    const speed = Math.max(car.forwardSpeed, 0);
    const p = car.spec;

    // Carril: trazada, salvo que haya que esquivar a alguien.
    this.laneTarget = this.laneTarget ?? this.lane;
    const straightAhead = this.targetSpeed(pr.s, speed) >= car.topSpeed * 0.9;
    const wanted = this.traffic(racers, speed, pr, this.racingLine(pr.s), straightAhead);
    this.laneTarget += clamp(wanted - this.laneTarget, -0.05, 0.05); // ~6 m/s de lado: suave

    // Volante (controlador Stanley): sigue el rumbo de la pista, corrige el
    // error lateral respecto al carril y anticipa la curvatura que viene.
    const here = track.pointAt(pr.s + 2 + speed * 0.12);
    let psi = here.heading - car.heading;
    psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const err = pr.d - this.laneTarget; // + = estoy a la derecha del carril
    const wheelbase = p.cgToFront + p.cgToRear;
    const ahead = track.pointAt(pr.s + 4 + speed * 0.3).turn ?? 0;
    const delta = psi + Math.atan2(1.6 * err, speed + 3) + Math.atan(wheelbase * ahead) * 1.1;
    const ratio = clamp(speed / car.topSpeed, 0, 1);
    const steerMax = p.maxSteer + (p.minSteer - p.maxSteer) * ratio;
    const steer = clamp(delta / steerMax, -1, 1);
    const alpha = psi;

    // Velocidad: perfil de frenado; frena antes si va alguien lento adelante.
    let target = this.targetSpeed(pr.s, speed);
    if (this.follow !== null) target = Math.min(target, this.follow);
    // Si va muy chueco (después de un golpe), con calma.
    if (Math.abs(alpha) > 0.6) target = Math.min(target, 12);

    // Rubber banding: solo en rectas y limitado.
    const gap = player ? player.dist - this.racer.dist : 0; // + si el jugador va adelante
    const straight = target >= car.topSpeed * 0.98;
    const band = clamp(1 + gap / 800, 0.92, 1.1);
    car.powerScale = (straight ? band : Math.min(band, 1)) * (0.94 + 0.06 * this.skill);

    const inp = car.input;
    inp.steer = steer;
    inp.handbrake = false;
    const over = speed - target;
    if (over > 0.5) {
      inp.throttle = 0;
      inp.brake = clamp(over / 4, 0.25, 1);
    } else if (over > -1.5) {
      // Cerca del objetivo: mantener.
      inp.throttle = clamp(0.3 - over * 0.3, 0, 1);
      inp.brake = 0;
    } else {
      inp.throttle = Math.abs(steer) > 0.85 ? 0.7 : 1;
      inp.brake = 0;
    }
    // Nitro solo en recta larga y si va atrás o peleando posición.
    const longStraight = this.targetSpeed(pr.s + 60, speed) >= car.topSpeed * 0.98;
    inp.nitro = straight && longStraight && gap > -30 && Math.abs(steer) < 0.15;
  }

  // Tráfico de la carrera: rebasa en recta, sigue en curva y deja espacio
  // al que va a un lado. Devuelve el carril deseado y fija this.follow
  // (velocidad máxima para no pegarle al de adelante, o null).
  traffic(racers, speed, pr, base, straight) {
    const car = this.racer.car;
    const limit = this.track.halfWidth - 2.5;
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    let lane = base;
    this.follow = null;
    let nearestAhead = Infinity;
    for (const r of racers) {
      if (r === this.racer) continue;
      const o = r.car;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const fwd = dx * fx + dy * fy;
      const left = -dx * fy + dy * fx; // + = el otro va a mi izquierda
      const oSpeed = o.vx * fx + o.vy * fy;

      // Alguien a mi lado: me separo un poco para no apretarlo contra el muro.
      if (Math.abs(fwd) < 5 && Math.abs(left) < 3.2) {
        lane += left > 0 ? 1.5 : -1.5;
        continue;
      }
      // Alguien adelante en mi línea.
      if (fwd <= 0 || fwd > 12 + speed * 1.2 || Math.abs(left) > 2.6) continue;
      if (fwd >= nearestAhead) continue;
      nearestAhead = fwd;
      const closing = speed - oSpeed;
      if (straight && closing > 0.5) {
        // Rebasa por el lado con más espacio.
        const od = this.track.project(o.x, o.y).d;
        const goLeft = od + 3.4 <= limit ? od - 3.4 >= -limit ? left < 0 : false : true;
        lane = goLeft ? od - 3.4 : od + 3.4;
      } else if (fwd < 8 + speed * 0.9) {
        // En curva (o sin espacio): lo sigue a distancia.
        this.follow = Math.max(0, oSpeed - (fwd < 6 ? 2 : 0.5));
      }
    }
    return clamp(lane, -limit, limit);
  }
}
