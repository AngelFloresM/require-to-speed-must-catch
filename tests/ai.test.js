import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../src/data/tracks.js';
import { CARS } from '../src/data/cars.js';
import { Race } from '../src/race.js';
import { Driver } from '../src/ai.js';
import { pickRivals } from '../src/rivals.js';

test('IA sola: ninguna combinación de pista y carro choca contra el muro', () => {
  for (const t of TRACKS) {
    for (const c of CARS) {
      const track = t.build();
      const race = new Race(track, { ...c.physics, color: 0 }, { laps: 1 });
      race.drivers.push(new Driver(race.player, track, { lane: 0, skill: 1 }));
      let hits = 0;
      race.onWallHit = () => hits++;
      for (let i = 0; i < 120 * 200 && !race.player.finished; i++) race.step();
      assert.ok(race.player.finished, `${t.name} / ${c.name}: no terminó`);
      assert.equal(hits, 0, `${t.name} / ${c.name}: ${hits} golpes`);
    }
  }
});

test('carreras con rivales: sin golpes fuertes contra el muro', () => {
  for (const t of TRACKS.filter((x) => ['cerro', 'laguna'].includes(x.id))) {
    for (const c of [CARS[0], CARS[2]]) {
      const track = t.build();
      const race = new Race(track, { ...c.physics, color: 0 }, { laps: 2, rivals: pickRivals(c.id) });
      const me = new Driver(race.player, track, { lane: 0, skill: 1 });
      let hard = 0;
      race.onWallHit = (r, f) => { if (!r.isPlayer && f > 6) hard++; };
      for (let i = 0; i < 120 * 400 && !race.racers.every((r) => r.finished); i++) {
        if (!race.player.finished) me.update(null, race.racers);
        race.step();
      }
      assert.ok(race.racers.every((r) => r.finished), `${t.name}: alguien no terminó`);
      assert.equal(hard, 0, `${t.name} con ${c.name}: ${hard} golpes fuertes`);
    }
  }
});

test('la IA frena antes de una horquilla', () => {
  const track = TRACKS.find((t) => t.id === 'cerro').build();
  const race = new Race(track, { ...CARS[0].physics, color: 0 }, { laps: 1 });
  const d = new Driver(race.player, track, { skill: 1 });
  // Busca la curva más cerrada y mide la velocidad planeada 100 m antes y en ella.
  let sMax = 0;
  for (let s = 0; s < track.length; s += 2) if (track.pointAt(s).curvature > track.pointAt(sMax).curvature) sMax = s;
  const before = d.targetSpeed(sMax - 100, 60);
  const at = d.targetSpeed(sMax, 30);
  assert.ok(before < 60, `a 100 m ya debe planear frenar (${before.toFixed(1)} m/s)`);
  assert.ok(at < before, 'en la curva va más lento que antes de ella');
});
