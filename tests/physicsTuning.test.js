import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, applyOverrides, baseValue, parseOverrides } from '../src/data/physicsTuning.js';
import { CARS } from '../src/data/cars.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { measurePerformance } from '../src/data/performance.js';

test('los valores de fábrica de cada carro caben en el rango de su barra', () => {
  for (const car of CARS) {
    for (const p of PARAMS) {
      const v = baseValue(car.physics, p.key);
      assert.ok(Number.isFinite(v), `${car.name} sin ${p.key}`);
      assert.ok(v >= p.min && v <= p.max, `${car.name} ${p.key}=${v} fuera de [${p.min}, ${p.max}]`);
    }
  }
});

test('sin cambios la física queda igual; los valores se recortan al rango', () => {
  const phys = CARS[0].physics;
  assert.deepEqual(applyOverrides(phys, {}), phys);
  const out = applyOverrides(phys, { grip: 99, mass: -5, nada: 3 });
  assert.equal(out.grip, 3);
  assert.equal(out.mass, 600);
  assert.equal(out.nada, undefined);
  assert.equal(phys.grip, CARS[0].physics.grip, 'no modifica el original');
});

test('potencia ×1.5 acelera más y más agarre da más g en curva', () => {
  const phys = CARS[0].physics;
  const base = measurePerformance(phys);
  const strong = measurePerformance(applyOverrides(phys, { powerScale: 1.5 }));
  assert.ok(strong.zeroTo100 < base.zeroTo100 * 0.95, `${strong.zeroTo100} vs ${base.zeroTo100}`);
  const grippy = measurePerformance(applyOverrides(phys, { grip: phys.grip + 0.5 }));
  assert.ok(grippy.lateralG > base.lateralG + 0.4);
});

test('cambiar la física en vivo recalcula la velocidad máxima', () => {
  const car = new Vehicle(CARS[0].physics);
  const top = car.topSpeed;
  car.spec = applyOverrides(CARS[0].physics, { dragCoef: CARS[0].physics.dragCoef * 2 });
  car._top = undefined;
  assert.ok(car.topSpeed < top * 0.9);
});

test('lo guardado inválido se descarta', () => {
  assert.deepEqual(parseOverrides('no json'), {});
  assert.deepEqual(parseOverrides('{"raptor": {"grip": "x", "foo": 1, "mass": 1500}, "otro": 5}'), { raptor: { mass: 1500 } });
});
