// Física arcade de un carro en 2D (modelo "bicicleta" con deriva de llantas).
// Estilo NFS: mucho agarre, ayudas de estabilidad y derrape con freno de mano.

import { driveForce, engineRpm, computeTopSpeed } from './engine.js';

const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Fuerza lateral normalizada: sube lineal hasta el pico y luego cae poco
// (derrape controlable, no "hielo").
function tireCurve(slip, peak) {
  const x = Math.abs(slip) / peak;
  const f = x <= 1 ? x : Math.max(0.92, 1 - (x - 1) * 0.04);
  return Math.sign(slip) * f;
}

export class Vehicle {
  constructor(spec) {
    this.spec = spec;
    this.x = 0;
    this.y = 0;
    this.heading = 0;   // rad, antihorario
    this.vx = 0;        // velocidad en mundo
    this.vy = 0;
    this.yawRate = 0;   // rad/s
    this.steer = 0;     // ángulo actual de las llantas
    this.nitro = spec.nitroCapacity;
    this.nitroActive = false;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
    this.powerScale = 1; // usado por la IA (rubber banding)
    // Info para el HUD
    this.speed = 0;
    this.forwardSpeed = 0;
    this.gear = 1;          // marcha actual (-1 = reversa en el HUD)
    this.rpm = spec.idleRpm;
    this.shiftTimer = 0;    // tiempo restante del cambio (sin empuje)
    this.automatic = true;
    this.wheelspin = false;
    this.drifting = false;
    this.aLong = 0;         // aceleración del paso anterior (transferencia de peso)
  }

  place(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.vx = this.vy = this.yawRate = this.steer = 0;
    this.gear = 1;
    this.aLong = 0;
  }

  get topSpeed() {
    return (this._top ??= computeTopSpeed(this.spec));
  }

  // Cambio de marcha (también lo usa la caja automática).
  shift(dir) {
    const n = this.spec.gears.length;
    const next = Math.max(1, Math.min(n, this.gear + dir));
    if (next === this.gear) return false;
    this.gear = next;
    this.shiftTimer = this.spec.shiftTime;
    return true;
  }

  autoShift(vLong) {
    const p = this.spec;
    if (this.shiftTimer > 0 || vLong < 0) return;
    const rpm = engineRpm(p, this.gear, vLong);
    if (rpm > p.redline * p.upshiftAt && this.gear < p.gears.length) this.shift(1);
    else if (this.gear > 1 && engineRpm(p, this.gear - 1, vLong) < p.redline * p.downshiftAt) this.shift(-1);
  }

  update(dt) {
    const p = this.spec;
    const inp = this.input;
    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);

    // Velocidad en ejes del carro: adelante (long) e izquierda (lat).
    const vLong = this.vx * cos + this.vy * sin;
    const vLat = -this.vx * sin + this.vy * cos;
    const speed = Math.hypot(vLong, vLat);
    const speedRatio = clamp(Math.abs(vLong) / this.topSpeed, 0, 1);

    // Carga vertical: peso + carga aerodinámica (crece con v²).
    const a = p.cgToFront;
    const b = p.cgToRear;
    const wheelbase = a + b;
    const weight = p.mass * G;
    const downforce = p.downforce * vLong * vLong;
    const load = weight + downforce;
    const gripG = (p.grip * load) / p.mass; // aceleración lateral máx. (m/s²)

    // Volante: menos giro a más velocidad, y nunca más de lo que las llantas
    // pueden sostener (evita que el frente "se lave" y el carro siga derecho).
    const speedLimit = p.maxSteer + (p.minSteer - p.maxSteer) * speedRatio;
    const gripLimit = (wheelbase * gripG) / Math.max(vLong * vLong, 1) + p.slipPeak * 0.8;
    const steerLimit = Math.min(speedLimit, gripLimit);
    const target = inp.steer * steerLimit;
    const maxDelta = p.steerSpeed * dt;
    this.steer += clamp(target - this.steer, -maxDelta, maxDelta);

    // Nitro (en eléctricos: sobrealimentación de potencia).
    this.nitroActive = inp.nitro && this.nitro > 0 && inp.throttle > 0 && vLong > 1;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt);
    else this.nitro = Math.min(p.nitroCapacity, this.nitro + p.nitroRecharge * dt);

    // Motor y caja.
    if (this.automatic) this.autoShift(vLong);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    this.rpm = engineRpm(p, this.gear, vLong);
    let drive = 0;
    const reversing = inp.brake > 0 && vLong < 0.5;
    if (reversing) {
      if (vLong > -p.maxReverseSpeed) drive = -inp.brake * p.reverseForce;
    } else if (inp.throttle > 0 && this.shiftTimer <= 0 && !(p.speedLimiter && vLong >= p.speedLimiter)) {
      const boost = this.powerScale * (this.nitroActive ? p.nitroPower : 1);
      drive = inp.throttle * driveForce(p, this.gear, vLong, boost);
    }

    // Carga en cada eje, con transferencia de peso al acelerar/frenar.
    const transfer = (p.mass * this.aLong * p.cgHeight) / wheelbase;
    const loadF = Math.max(load * 0.15, (load * b) / wheelbase - transfer);
    const loadR = Math.max(load * 0.15, (load * a) / wheelbase + transfer);
    const muF = p.grip * loadF;
    const muR = p.grip * loadR * (inp.handbrake ? p.handbrakeGrip : 1);

    // Tracción: reparto entre ejes y límite de agarre (patinan si se pasa).
    const front = p.drivetrain === 'FWD' ? 1 : p.drivetrain === 'AWD' ? p.awdFront : 0;
    let fxF = drive * front;
    let fxR = drive * (1 - front);
    this.wheelspin = Math.abs(fxF) > muF || Math.abs(fxR) > muR;
    fxF = clamp(fxF, -muF, muF);
    fxR = clamp(fxR, -muR, muR);

    // Frenos con reparto (bias) y ABS por eje.
    const dir = vLong >= 0 ? 1 : -1;
    if (inp.brake > 0 && !reversing) {
      fxF -= dir * Math.min(inp.brake * p.brakeForce * p.brakeBias, muF * 0.9);
      fxR -= dir * Math.min(inp.brake * p.brakeForce * (1 - p.brakeBias), muR * 0.9);
    }
    if (inp.handbrake) fxR -= dir * Math.min(muR, Math.abs(vLong) * p.mass * 2);
    const drag = -p.dragCoef * vLong * Math.abs(vLong) - p.rollingResistance * vLong;

    // Fuerzas laterales: lo que queda del agarre tras acelerar/frenar
    // (círculo de fricción suavizado para que se sienta arcade).
    const k = p.combinedGrip;
    const capF = muF * Math.sqrt(Math.max(0.2, 1 - k * (fxF / muF) ** 2));
    const capR = muR * Math.sqrt(Math.max(0.2, 1 - k * (fxR / Math.max(muR, 1)) ** 2));
    const denom = Math.max(Math.abs(vLong), 2);
    const slipF = Math.atan2(vLat + this.yawRate * a, denom) - this.steer * dir;
    const slipR = Math.atan2(vLat - this.yawRate * b, denom);
    const fyF = -tireCurve(slipF, p.slipPeak) * capF;
    const fyR = -tireCurve(slipR, p.slipPeak) * capR;

    const cosS = Math.cos(this.steer);
    const sinS = Math.sin(this.steer);
    const fLong = fxF * cosS + fxR + drag - fyF * sinS;
    const fLat = fyF * cosS + fxF * sinS + fyR;
    const torque = a * (fyF * cosS + fxF * sinS) - b * fyR;

    // Integración (Euler semi-implícito).
    const aLong = fLong / p.mass;
    const aLat = fLat / p.mass;
    this.aLong = clamp(aLong, -15, 15);
    this.vx += (aLong * cos - aLat * sin) * dt;
    this.vy += (aLong * sin + aLat * cos) * dt;
    this.yawRate += (torque / p.inertia) * dt;

    // Ayudas de estabilidad (estilo arcade):
    // 1) El giro no pasa de lo que el agarre permite (evita trompos).
    const v = Math.max(Math.abs(vLong), 5);
    const maxYaw = (gripG / v) * (inp.handbrake ? p.driftYaw : 1.15);
    const over = Math.abs(this.yawRate) - maxYaw;
    if (over > 0) this.yawRate -= Math.sign(this.yawRate) * over * Math.min(1, 10 * dt);
    // 2) La velocidad se alinea poco a poco con el frente del carro,
    //    sin perder rapidez (así el derrape se recupera solo).
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 3) {
      const velAng = Math.atan2(this.vy, this.vx);
      const back = vLong < 0 ? Math.PI : 0;
      let beta = velAng - (this.heading + back);
      beta = Math.atan2(Math.sin(beta), Math.cos(beta));
      const assist = inp.handbrake ? p.driftAssist : p.gripAssist;
      const newAng = velAng - beta * (1 - Math.exp(-assist * dt));
      this.vx = Math.cos(newAng) * sp;
      this.vy = Math.sin(newAng) * sp;
    }

    // A muy baja velocidad y sin acelerar, detener por completo.
    if (speed < 0.3 && inp.throttle === 0 && inp.brake === 0) {
      this.vx *= 0.8;
      this.vy *= 0.8;
      this.yawRate *= 0.8;
    }

    this.heading += this.yawRate * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Info para el HUD
    this.forwardSpeed = vLong;
    this.speed = speed;
    this.drifting = Math.abs(slipR) > 0.2 && speed > 8;
    this.displayGear = vLong < -0.5 ? -1 : this.gear;
  }

  // Esquinas del carro en mundo (para colisiones con muros).
  corners() {
    const hl = this.spec.length / 2;
    const hw = this.spec.width / 2;
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const out = [];
    for (const [lx, ly] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
      out.push({ x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c, rx: lx * c - ly * s, ry: lx * s + ly * c });
    }
    return out;
  }

  // Aplica un impulso (N·s) en un punto relativo al centro de masa.
  applyImpulse(jx, jy, rx, ry) {
    this.vx += jx / this.spec.mass;
    this.vy += jy / this.spec.mass;
    this.yawRate += (rx * jy - ry * jx) / this.spec.inertia;
  }
}
