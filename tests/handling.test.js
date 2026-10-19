// Pruebas de manejo: un "piloto" simple que apunta al centro de la pista.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OvalTrack } from '../src/track.js';
import { Race } from '../src/race.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { CARS } from '../src/data/cars.js';
import { measurePerformance } from '../src/data/performance.js';


// mode: 'gas' (a fondo, nunca frena), 'brake' (frena fuerte antes y dentro
// de la curva), 'hand' (como 'brake' + freno de mano al entrar a la curva)
function drive(spec, mode, seconds = 60) {
  const t = new OvalTrack();
  const race = new Race(t, { ...spec, color: 0 }, { laps: 9 });
  race.state = 'racing';
  const car = race.player.car;
  const perf = measurePerformance(spec);
  let hits = 0;
  let maxSlip = 0;
  let handTimer = 0;
  let wasInCurve = false;
  race.onHit = () => hits++;
  for (let i = 0; i < 120 * seconds; i++) {
    const pr = t.project(car.x, car.y);
    const tp = t.pointAt(pr.s + 25);
    let ang = Math.atan2(tp.y - car.y, tp.x - car.x) - car.heading;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    // Velocidad segura en la curva (con un margen) según el agarre del carro.
    const ahead = t.pointAt(pr.s + 60).curvature || t.pointAt(pr.s).curvature;
    const safe = ahead ? Math.sqrt(perf.lateralG * 9.81 * (1 / ahead)) * 0.8 : Infinity;
    const tooFast = mode !== 'gas' && car.speed > safe;
    // Toque de freno de mano de 0.6 s al entrar a cada curva.
    const inCurve = t.pointAt(pr.s).curvature > 0;
    if (inCurve && !wasInCurve) handTimer = 0.6;
    wasInCurve = inCurve;
    handTimer -= 1 / 120;
    Object.assign(car.input, {
      steer: Math.max(-1, Math.min(1, ang * 4)),
      throttle: tooFast ? 0 : 1,
      brake: tooFast ? 1 : 0,
      handbrake: mode === 'hand' && handTimer > 0,
    });
    race.step();
    if (car.speed > 10) {
      const lat = -car.vx * Math.sin(car.heading) + car.vy * Math.cos(car.heading);
      maxSlip = Math.max(maxSlip, Math.abs(Math.asin(Math.min(1, Math.abs(lat) / car.speed))));
    }
  }
  return { hits, maxSlipDeg: maxSlip * 57.3, laps: race.player.lapsDone };
}

for (const { name, physics: spec } of CARS) {
  test(`${name}: a fondo sin frenar: no hay trompos`, () => {
    const r = drive(spec, 'gas');
    assert.ok(r.maxSlipDeg < 30, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
  });

  test(`${name}: frenar fuerte en la curva no hace perder el control`, () => {
    const r = drive(spec, 'brake');
    assert.equal(r.hits, 0);
    assert.ok(r.maxSlipDeg < 30, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
  });

  test(`${name}: el freno de mano derrapa pero no hace trompo`, () => {
    const r = drive(spec, 'hand');
    assert.equal(r.hits, 0);
    assert.ok(r.maxSlipDeg < 60, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
    assert.ok(r.laps >= 1);
  });

  test(`${name}: girar a tope a 200 km/h no hace trompo`, () => {
    const car = new Vehicle(spec);
    car.vx = Math.min(200 / 3.6, car.topSpeed * 0.95);
    car.input.throttle = 1;
    car.input.steer = 1;
    let maxSlip = 0;
    for (let i = 0; i < 120 * 3; i++) {
      car.update(1 / 120);
      const lat = -car.vx * Math.sin(car.heading) + car.vy * Math.cos(car.heading);
      maxSlip = Math.max(maxSlip, Math.abs(Math.asin(Math.min(1, Math.abs(lat) / car.speed))));
    }
    assert.ok(maxSlip * 57.3 < 15, `deriva ${(maxSlip * 57.3).toFixed(0)}°`);
    assert.ok(car.heading > 1, 'debe girar');
  });

  test(`${name}: frena de 200 a 0 km/h en menos de 130 m`, () => {
    const car = new Vehicle(spec);
    car.vx = Math.min(200 / 3.6, car.topSpeed * 0.95);
    car.input.brake = 1;
    for (let i = 0; i < 120 * 10 && car.forwardSpeed > 0.5; i++) car.update(1 / 120);
    assert.ok(car.x < 160, `distancia ${car.x.toFixed(0)} m`);
  });

  test(`${name}: el garaje muestra datos reales`, () => {
    const p = measurePerformance(spec);
    assert.ok(p.topKmh > 150 && p.topKmh < 300, `vel ${p.topKmh}`);
    assert.ok(p.zeroTo100 > 2 && p.zeroTo100 < 14, `0-100 ${p.zeroTo100}`);
  });
}
