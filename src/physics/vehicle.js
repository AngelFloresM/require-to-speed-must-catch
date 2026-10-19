// Física arcade de un carro en 2D (modelo "bicicleta" con deriva de llantas).
// Estilo NFS: mucho agarre, ayudas de estabilidad y derrape con freno de mano.

const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Fuerza lateral normalizada: sube lineal hasta el pico y luego cae un poco (derrape).
function tireCurve(slip, peak) {
  const x = Math.abs(slip) / peak;
  const f = x <= 1 ? x : Math.max(0.8, 1 - (x - 1) * 0.1);
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
    this.gear = 1;
    this.drifting = false;
  }

  place(x, y, heading) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.vx = this.vy = this.yawRate = this.steer = 0;
  }

  get topSpeed() {
    // Velocidad donde potencia = arrastre + rodamiento (Newton).
    if (this._top) return this._top;
    const { power: P, dragCoef: d, rollingResistance: c } = this.spec;
    let v = Math.cbrt(P / d);
    for (let i = 0; i < 8; i++) v -= (d * v ** 3 + c * v * v - P) / (3 * d * v * v + 2 * c * v);
    return (this._top = v);
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

    // Volante: menos giro a más velocidad (ayuda arcade).
    const steerLimit = p.maxSteer + (p.minSteer - p.maxSteer) * speedRatio;
    const target = inp.steer * steerLimit;
    const maxDelta = p.steerSpeed * dt;
    this.steer += clamp(target - this.steer, -maxDelta, maxDelta);

    // Nitro
    this.nitroActive = inp.nitro && this.nitro > 0 && inp.throttle > 0 && vLong > 1;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt);
    else this.nitro = Math.min(p.nitroCapacity, this.nitro + p.nitroRecharge * dt);

    // Fuerza longitudinal (tracción trasera).
    let drive = 0;
    if (inp.throttle > 0) {
      const power = p.power * this.powerScale * (this.nitroActive ? p.nitroPower : 1);
      const maxF = p.maxDriveForce * (this.nitroActive ? 1.3 : 1);
      drive = inp.throttle * Math.min(maxF, power / Math.max(Math.abs(vLong), 1));
    }
    if (inp.brake > 0) {
      if (vLong > 0.5) drive -= inp.brake * p.brakeForce;
      else if (vLong > -p.maxReverseSpeed) drive -= inp.brake * p.reverseForce; // reversa
    }
    if (inp.handbrake) drive -= Math.sign(vLong) * Math.min(p.brakeForce * 0.3, Math.abs(vLong) * p.mass * 4);
    const drag = -p.dragCoef * vLong * Math.abs(vLong) - p.rollingResistance * vLong;

    // Fuerzas laterales de las llantas.
    const a = p.cgToFront;
    const b = p.cgToRear;
    const wheelbase = a + b;
    const weight = p.mass * G;
    const loadF = (weight * b) / wheelbase;
    const loadR = (weight * a) / wheelbase;
    const denom = Math.max(Math.abs(vLong), 2);
    const dir = vLong >= 0 ? 1 : -1;
    const slipF = Math.atan2(vLat + this.yawRate * a, denom) - this.steer * dir;
    const slipR = Math.atan2(vLat - this.yawRate * b, denom);
    const rearGrip = p.grip * (inp.handbrake ? p.handbrakeGrip : 1);
    const fyF = -tireCurve(slipF, p.slipPeak) * p.grip * loadF;
    const fyR = -tireCurve(slipR, p.slipPeak) * rearGrip * loadR;

    const cosS = Math.cos(this.steer);
    const fLong = drive + drag - fyF * Math.sin(this.steer);
    const fLat = fyF * cosS + fyR;
    const torque = a * fyF * cosS - b * fyR;

    // Integración (Euler semi-implícito).
    const aLong = fLong / p.mass;
    const aLat = fLat / p.mass;
    this.vx += (aLong * cos - aLat * sin) * dt;
    this.vy += (aLong * sin + aLat * cos) * dt;
    this.yawRate += (torque / p.inertia) * dt;

    // Ayudas de estabilidad: amortigua el giro y la deriva cuando no hay freno de mano.
    const assist = inp.handbrake ? 0.5 : 2.0;
    this.yawRate *= Math.exp(-assist * 0.5 * dt);

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
    const r = speedRatio;
    this.gear = vLong < -0.5 ? -1 : Math.min(p.gears, 1 + Math.floor(r * p.gears * 1.05));
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
