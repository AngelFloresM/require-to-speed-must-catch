import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNING, defaultTuning, applyTuning } from '../src/data/tuning.js';
import { CARS } from '../src/data/cars.js';

test('hay 7 ajustes y todos empiezan en 0', () => {
  assert.equal(TUNING.length, 7);
  assert.ok(Object.values(defaultTuning()).every((v) => v === 0));
});

test('con todo en 0 la física no cambia', () => {
  for (const c of CARS) assert.deepEqual(applyTuning(c.physics), c.physics);
});

test('los ajustes mueven la física en la dirección correcta', () => {
  const base = CARS[0].physics;
  const t = (id, v) => applyTuning(base, { ...defaultTuning(), [id]: v });
  assert.ok(t('aero', 5).downforce > base.downforce);
  assert.ok(t('steering', 5).steerSpeed > base.steerSpeed);
  assert.ok(t('brakes', 5).brakeBias < base.brakeBias, '+ = más atrás');
  assert.ok(t('nitrous', 5).nitroPower > base.nitroPower);
  assert.ok(t('nitrous', 5).nitroCapacity < base.nitroCapacity);
  assert.ok(t('turbo', 5).finalDrive < base.finalDrive, '+ = más vel. máxima');
  assert.ok(t('rideHeight', -5).grip > base.grip, 'más bajo = más agarre');
  assert.deepEqual(applyTuning(base, { aero: 99 }), applyTuning(base, { aero: 5 }), 'se limita a ±5');
});
