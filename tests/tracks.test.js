import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../src/data/tracks.js';
import { Race } from '../src/race.js';
import { CARS } from '../src/data/cars.js';

const spec = CARS[0].physics;

for (const def of TRACKS) {
  test(`${def.name}: project() es inverso de pointAt()`, () => {
    const t = def.build();
    for (let s = 0; s < t.length; s += 7.3) {
      const p = t.pointAt(s);
      for (const side of [-5, 0, 5]) {
        const x = p.x + Math.sin(p.heading) * side;
        const y = p.y - Math.cos(p.heading) * side;
        const pr = t.project(x, y);
        assert.ok(Math.abs(pr.d - side) < 0.3, `d=${pr.d} esperado ${side} en s=${s}`);
        let ds = Math.abs(pr.s - s);
        ds = Math.min(ds, t.length - ds);
        assert.ok(ds < 1.5, `s=${pr.s} vs ${s}`);
      }
    }
  });

  test(`${def.name}: la pista no se encima consigo misma`, () => {
    const t = def.build();
    for (let a = 0; a < t.length; a += 8) {
      for (let b = a + 8; b < t.length; b += 8) {
        const along = Math.min(b - a, t.length - (b - a));
        if (along < 3 * t.width + 40) continue;
        const p = t.pointAt(a);
        const q = t.pointAt(b);
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > t.width + 20, `muy cerca en s=${a} y s=${b}`);
      }
    }
  });

  test(`${def.name}: carrera de IA de 1 vuelta, todos terminan dentro de la pista`, () => {
    const t = def.build();
    const rivals = [0, 1, 2].map((i) => ({ name: `R${i}`, spec, lane: (i - 1) * 3, skill: 0.85 + i * 0.05 }));
    const race = new Race(t, { ...spec, color: 0 }, { laps: 1, rivals });
    for (let i = 0; i < 120 * 200 && !race.drivers.every((d) => d.racer.finished); i++) {
      race.step();
      for (const r of race.racers) {
        const d = t.project(r.car.x, r.car.y).d;
        assert.ok(Math.abs(d) < t.halfWidth + 0.5, `${r.name} fuera d=${d.toFixed(1)}`);
      }
    }
    for (const d of race.drivers) assert.ok(d.racer.finished, `${d.racer.name} no terminó`);
    console.log(def.name, 'mejor tiempo IA', Math.min(...race.drivers.map((d) => d.racer.finishTime)).toFixed(1), 's');
  });
}
