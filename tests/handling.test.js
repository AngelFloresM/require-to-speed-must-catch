// Pruebas de manejo: un "piloto" simple que apunta al centro de la pista.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OvalTrack } from '../src/track.js';
import { Race } from '../src/race.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { CARS } from '../src/data/cars.js';
import { measurePerformance } from '../src/data/performance.js';

const spec = CARS[0].physics;

// mode: 'gas' (a fondo), 'brake' (frena en curva), 'hand' (freno de mano en curva)
function drive(mode, seconds = 40) {
  const t = new OvalTrack();
  const race = new Race(t, { ...spec, color: 0 }, { laps: 9 });
  race.state = 'racing';
  const car = race.player.car;
  let hits = 0;
  let maxSlip = 0;
  race.onHit = () => hits++;
  for (let i = 0; i < 120 * seconds; i++) {
    const pr = t.project(car.x, car.y);
    const tp = t.pointAt(pr.s + 25);
    let ang = Math.atan2(tp.y - car.y, tp.x - car.x) - car.heading;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    const inCurve = t.pointAt(pr.s).curvature > 0 && car.speed > 30;
    Object.assign(car.input, {
      steer: Math.max(-1, Math.min(1, ang * 4)),
      throttle: mode === 'brake' && inCurve ? 0 : 1,
      brake: mode === 'brake' && inCurve ? 1 : 0,
      handbrake: mode === 'hand' && inCurve,
    });
    race.step();
    if (car.speed > 10) {
      const lat = -car.vx * Math.sin(car.heading) + car.vy * Math.cos(car.heading);
      maxSlip = Math.max(maxSlip, Math.abs(Math.asin(Math.min(1, Math.abs(lat) / car.speed))));
    }
  }
  return { hits, maxSlipDeg: maxSlip * 57.3, laps: race.player.lapsDone };
}

test('a fondo sin frenar: no hay trompos ni golpes', () => {
  const r = drive('gas');
  assert.equal(r.hits, 0);
  assert.ok(r.maxSlipDeg < 30, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
});

test('frenar fuerte en la curva no hace perder el control', () => {
  const r = drive('brake');
  assert.equal(r.hits, 0);
  assert.ok(r.maxSlipDeg < 30, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
});

test('el freno de mano derrapa pero no hace trompo', () => {
  const r = drive('hand');
  assert.equal(r.hits, 0);
  assert.ok(r.maxSlipDeg < 60, `deriva ${r.maxSlipDeg.toFixed(0)}°`);
  assert.ok(r.laps >= 1);
});

test('girar a tope a 200 km/h no hace trompo', () => {
  const car = new Vehicle(spec);
  car.vx = 200 / 3.6;
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

test('frena de 200 a 0 km/h en menos de 130 m', () => {
  const car = new Vehicle(spec);
  car.vx = 200 / 3.6;
  car.input.brake = 1;
  for (let i = 0; i < 120 * 10 && car.forwardSpeed > 0.5; i++) car.update(1 / 120);
  assert.ok(car.x < 130, `distancia ${car.x.toFixed(0)} m`);
});

test('el garaje muestra datos reales', () => {
  const p = measurePerformance(spec);
  assert.ok(p.topKmh > 200 && p.topKmh < 300);
  assert.ok(p.zeroTo100 > 3 && p.zeroTo100 < 8);
});
