import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS } from '../src/data/cars.js';
import { pickRivals } from '../src/rivals.js';
import { OvalTrack } from '../src/track.js';
import { Race } from '../src/race.js';

test('los rivales usan carros distintos al del jugador y entre sí', () => {
  for (const car of CARS) {
    const rivals = pickRivals(car.id);
    assert.equal(rivals.length, 3);
    const ids = rivals.map((r) => r.name);
    assert.ok(!ids.includes(car.name), `${car.name} se repite`);
    assert.equal(new Set(ids).size, 3);
  }
});

test('carrera con carros mezclados: todos terminan sin salir de la pista', () => {
  const t = new OvalTrack();
  const player = CARS[0];
  const race = new Race(t, { ...player.physics, color: 0 }, { laps: 1, rivals: pickRivals(player.id) });
  for (let i = 0; i < 120 * 150 && !race.drivers.every((d) => d.racer.finished); i++) {
    race.step();
    for (const r of race.racers) assert.ok(Math.abs(t.project(r.car.x, r.car.y).d) < t.halfWidth + 0.5);
  }
  for (const d of race.drivers) assert.ok(d.racer.finished, `${d.racer.name} no terminó`);
  assert.ok(race.drivers.every((d) => d.racer.model), 'cada rival trae su modelo 3D');
});
