import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS } from '../src/data/cars.js';
import { pickRivals } from '../src/rivals.js';
import { timeTo, lateralG } from '../src/balance.js';
import { computeTopSpeed } from '../src/physics/engine.js';

test('rivales igualados: misma aceleración, velocidad máxima y agarre que el jugador', () => {
  for (const car of CARS) {
    const me = car.physics;
    for (const r of pickRivals(car.id, { match: me })) {
      const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${car.name} vs ${r.name}: ${what} ${a.toFixed(2)} vs ${b.toFixed(2)}`);
      near(timeTo(r.spec), timeTo(me), 0.04, '0-130');
      near(computeTopSpeed(r.spec), computeTopSpeed(me), 0.02, 'vel. máx');
      near(lateralG(r.spec), lateralG(me), 0.01, 'g lateral');
      near(r.spec.brakeForce / r.spec.mass, me.brakeForce / me.mass, 0.01, 'frenado');
      // Conserva su identidad.
      const base = CARS.find((c) => c.name === r.name).physics;
      assert.equal(r.spec.mass, base.mass);
      assert.equal(r.spec.drivetrain, base.drivetrain);
      assert.equal(r.model, CARS.find((c) => c.name === r.name).model);
    }
  }
});

test('sin igualar, los rivales usan su carro tal cual', () => {
  const r = pickRivals(CARS[0].id)[0];
  const base = CARS.find((c) => c.name === r.name).physics;
  assert.deepEqual(r.spec.torqueCurve, base.torqueCurve);
});
