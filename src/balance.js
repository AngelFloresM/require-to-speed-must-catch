// Iguala el rendimiento de un carro rival al del jugador, conservando su
// identidad (modelo, peso, tracción, caja y curva de torque). Así cada
// carrera es pareja, como los niveles de Most Wanted.
import { Vehicle } from './physics/vehicle.js';
import { computeTopSpeed } from './physics/engine.js';

const DT = 1 / 120;
const G = 9.81;
const TEST_SPEED = 130 / 3.6; // todos los carros llegan a 130 km/h

// Tiempo de 0 a 130 km/h, con caja automática.
export function timeTo(spec, speed = TEST_SPEED) {
  const car = new Vehicle(spec);
  car.input.throttle = 1;
  let t = 0;
  while (car.speed < speed && t < 40) {
    car.update(DT);
    t += DT;
  }
  return t;
}

// Aceleración lateral a 150 km/h (g).
export function lateralG(spec) {
  const v = 150 / 3.6;
  return (spec.grip * (spec.mass * G + spec.downforce * v * v)) / spec.mass / G;
}

const withPower = (spec, k) => ({
  ...spec,
  torqueCurve: spec.torqueCurve.map(([rpm, nm]) => [rpm, nm * k]),
  maxPower: spec.maxPower ? spec.maxPower * k : spec.maxPower,
});

function bisect(lo, hi, f, steps = 14) {
  // f(x) crece con x; busca f(x) = 0
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function matchPerformance(rival, target) {
  let s = { ...rival };
  // 1) Agarre en curva igual.
  s.grip = rival.grip * (lateralG(target) / lateralG(rival));
  // 2) Misma capacidad de frenado (por kg).
  s.brakeForce = (target.brakeForce / target.mass) * s.mass;
  // 3) Que la caja alcance la velocidad máxima del jugador (relación final).
  const topTarget = computeTopSpeed(target);
  const gearTop = (s.redline / 60) * 2 * Math.PI * s.wheelRadius / (s.gears[s.gears.length - 1] * s.finalDrive);
  if (gearTop < topTarget * 1.05) s.finalDrive *= gearTop / (topTarget * 1.05);
  // 4) Misma aceleración: escala el torque (y potencia) del motor. Si ni con
  //    mucha potencia alcanza (patina al salir), le da más tracción.
  const tTarget = timeTo(target);
  if (timeTo(withPower(s, 5)) > tTarget) {
    s.tractionScale = bisect(1, 3, (x) => tTarget - timeTo(withPower({ ...s, tractionScale: x }, 5)), 10) * 1.03;
  }
  const k = bisect(0.2, 5, (x) => tTarget - timeTo(withPower(s, x)));
  s = withPower(s, k);
  // 5) Misma velocidad máxima: limitador si es más rápido, menos arrastre si es más lento.
  const top = computeTopSpeed(s);
  if (top > topTarget) s.speedLimiter = topTarget;
  else if (top < topTarget - 0.5) {
    const base = s.dragCoef;
    const f = bisect(0.1, 1, (x) => topTarget - computeTopSpeed({ ...s, dragCoef: base * x }), 12);
    s.dragCoef = base * f;
    s.speedLimiter = topTarget;
  }
  return s;
}
