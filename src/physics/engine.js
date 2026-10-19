// Motor y caja de cambios: curva de torque, RPM y fuerza en las ruedas.

const RPM_PER_RADS = 60 / (2 * Math.PI);

// Interpola la curva [[rpm, Nm], ...].
export function torqueAt(curve, rpm) {
  if (rpm <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [r1, t1] = curve[i];
    if (rpm <= r1) {
      const [r0, t0] = curve[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return curve[curve.length - 1][1];
}

// Relación total (caja × diferencial) de una marcha (1 = primera).
export function ratio(spec, gear) {
  return spec.gears[gear - 1] * spec.finalDrive;
}

// RPM del motor en una marcha a cierta velocidad (m/s).
export function engineRpm(spec, gear, speed) {
  const wheel = (Math.abs(speed) / spec.wheelRadius) * RPM_PER_RADS;
  return Math.max(spec.idleRpm, wheel * ratio(spec, gear));
}

// Fuerza de empuje (N) a acelerador a fondo en una marcha y velocidad.
// boost: multiplicador del nitro (1 = sin nitro).
export function driveForce(spec, gear, speed, boost = 1) {
  const rpm = engineRpm(spec, gear, speed);
  if (rpm >= spec.redline) return 0; // limitador de revoluciones
  // Al arrancar el embrague patina: el motor trabaja a RPM de arranque.
  const effRpm = Math.max(rpm, spec.launchRpm ?? spec.idleRpm);
  let f = (torqueAt(spec.torqueCurve, effRpm) * ratio(spec, gear) * spec.drivetrainEfficiency) / spec.wheelRadius;
  if (spec.maxPower) f = Math.min(f, spec.maxPower / Math.max(Math.abs(speed), 1));
  return f * boost;
}

// Velocidad máxima (m/s): donde el mejor empuje ya no supera la resistencia.
export function computeTopSpeed(spec) {
  let top = 0;
  for (let v = 1; v < 150; v += 0.1) {
    let best = 0;
    for (let g = 1; g <= spec.gears.length; g++) best = Math.max(best, driveForce(spec, g, v));
    const resist = spec.dragCoef * v * v + spec.rollingResistance * v;
    if (best < resist) break;
    top = v;
  }
  return spec.speedLimiter ? Math.min(top, spec.speedLimiter) : top;
}
