import test from 'node:test';
import assert from 'node:assert/strict';
import { OvalTrack } from '../src/track.js';
import { Race, PHYSICS_DT } from '../src/race.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { CARS } from '../src/data/cars.js';

const spec = CARS[0].physics;

test('project() es inverso de pointAt()', () => {
  const t = new OvalTrack();
  for (let s = 0; s < t.length; s += 13.7) {
    const p = t.pointAt(s);
    const pr = t.project(p.x, p.y);
    assert.ok(Math.abs(pr.d) < 1e-6, `d=${pr.d} en s=${s}`);
    assert.ok(Math.abs(pr.s - s) < 1e-6, `s=${pr.s} vs ${s}`);
  }
});

test('el carro acelera y llega cerca de su velocidad máxima', () => {
  const car = new Vehicle(spec);
  car.input.throttle = 1;
  let t100 = 0;
  for (let i = 0; i < 120 * 40; i++) {
    car.update(PHYSICS_DT);
    if (!t100 && car.speed >= 100 / 3.6) t100 = i * PHYSICS_DT;
  }
  assert.ok(t100 > 3 && t100 < 7, `0-100 en ${t100.toFixed(2)} s`);
  assert.ok(car.speed > car.topSpeed * 0.95, `vel final ${car.speed}`);
});

test('el carro gira hacia la izquierda con steer positivo', () => {
  const car = new Vehicle(spec);
  car.vx = 20;
  car.input.throttle = 0.3;
  car.input.steer = 1;
  for (let i = 0; i < 120; i++) car.update(PHYSICS_DT);
  assert.ok(car.heading > 0.3, `heading ${car.heading}`);
  assert.ok(car.y > 0);
});

test('los muros contienen al carro', () => {
  const t = new OvalTrack();
  const race = new Race(t, { ...spec, color: 0 }, { laps: 1 });
  race.state = 'racing';
  const car = race.player.car;
  car.input.throttle = 1;
  car.input.steer = -1; // gira a la derecha, hacia el muro exterior
  for (let i = 0; i < 120 * 10; i++) {
    race.step();
    const pr = t.project(car.x, car.y);
    assert.ok(Math.abs(pr.d) < t.halfWidth + 0.5, `fuera de pista d=${pr.d}`);
  }
});

test('carrera de IA: todos terminan 2 vueltas sin salir de la pista', () => {
  const t = new OvalTrack();
  const rivals = [0, 1, 2].map((i) => ({ name: `R${i}`, spec, lane: (i - 1) * 4, skill: 0.85 + i * 0.05 }));
  const race = new Race(t, { ...spec, color: 0 }, { laps: 2, rivals });
  // El jugador también lo maneja una IA para la prueba.
  race.drivers.push(new (race.drivers[0].constructor)(race.player, t, { lane: 0, skill: 0.9 }));
  for (let i = 0; i < 120 * 200 && !race.racers.every((r) => r.finished); i++) {
    race.step();
    for (const r of race.racers) {
      const pr = t.project(r.car.x, r.car.y);
      assert.ok(Math.abs(pr.d) < t.halfWidth + 0.5, `${r.name} fuera d=${pr.d}`);
    }
  }
  for (const r of race.racers) {
    assert.ok(r.finished, `${r.name} no terminó (dist ${r.dist.toFixed(0)})`);
    console.log(r.name, 'pos', r.position, 'tiempo', r.finishTime.toFixed(1), 'vueltas', r.lapTimes.map((x) => x.toFixed(1)).join(' '));
  }
});

test('cada carro: carrera de IA completa sin salir de la pista', () => {
  for (const c of CARS) {
    const t = new OvalTrack();
    const rivals = [0, 1, 2].map((i) => ({ name: `R${i}`, spec: c.physics, lane: (i - 1) * 4, skill: 0.85 + i * 0.05 }));
    const race = new Race(t, { ...c.physics, color: 0 }, { laps: 1, rivals });
    for (let i = 0; i < 120 * 120 && !race.drivers.every((d) => d.racer.finished); i++) {
      race.step();
      for (const r of race.racers) {
        const pr = t.project(r.car.x, r.car.y);
        assert.ok(Math.abs(pr.d) < t.halfWidth + 0.5, `${c.name} ${r.name} fuera d=${pr.d}`);
      }
    }
    for (const d of race.drivers) assert.ok(d.racer.finished, `${c.name} ${d.racer.name} no terminó`);
    console.log(c.name, 'vuelta IA', Math.min(...race.drivers.map((d) => d.racer.finishTime)).toFixed(1), 's');
  }
});

test('caja automática: sube de marcha y respeta el corte', () => {
  for (const c of CARS) {
    const car = new Vehicle(c.physics);
    car.input.throttle = 1;
    let maxGear = 1;
    for (let i = 0; i < 120 * 30; i++) {
      car.update(PHYSICS_DT);
      maxGear = Math.max(maxGear, car.gear);
      assert.ok(car.rpm <= c.physics.redline * 1.02, `${c.name} rpm ${car.rpm}`);
    }
    assert.ok(maxGear >= c.physics.gears.length - 1, `${c.name} llegó a ${maxGear}`);
  }
});

test('caja manual: no cambia sola, sube a mano y no deja pasarse del corte al bajar', () => {
  const spec = CARS.find((c) => c.id === 'mustank').physics;
  const car = new Vehicle(spec);
  car.automatic = false;
  car.input.throttle = 1;
  for (let i = 0; i < 120 * 6; i++) car.update(PHYSICS_DT);
  assert.equal(car.gear, 1, 'en manual no sube sola');
  assert.ok(car.rpm <= spec.redline * 1.02, 'respeta el corte');
  for (let g = 2; g <= 4; g++) {
    assert.ok(car.manualShift(1), `sube a ${g}`);
    for (let i = 0; i < 120 * 3; i++) car.update(PHYSICS_DT);
  }
  assert.equal(car.gear, 4);
  // A esta velocidad, 1ra pasaría del corte: bajar de 2da a 1ra se rechaza.
  car.gear = 2;
  assert.equal(car.manualShift(-1), false);
  assert.equal(car.gear, 2);
  assert.ok(car.manualShift(1), 'subir sí se permite');
});

test('caja automática: el jugador puede bajar y subir a mano; la caja lo respeta un rato', () => {
  const spec = CARS.find((c) => c.id === 'mustank').physics;
  const car = new Vehicle(spec);
  car.input.throttle = 1;
  while (car.gear < 4) car.update(PHYSICS_DT);
  for (let i = 0; i < 120; i++) car.update(PHYSICS_DT);
  // Rebaje para pasar: la automática no vuelve a subir de inmediato.
  car.input.throttle = 0.3;
  assert.ok(car.manualShift(-1), 'baja a 3ra');
  for (let i = 0; i < 120; i++) car.update(PHYSICS_DT);
  assert.equal(car.gear, 3, 'mantiene la marcha elegida');
  // Subir a mano a baja velocidad: no la regresa enseguida.
  assert.ok(car.manualShift(1), 'sube a 4ta');
  for (let i = 0; i < 120; i++) car.update(PHYSICS_DT);
  assert.equal(car.gear, 4);
  // Pasado el rato, la automática vuelve a decidir.
  car.input.throttle = 0;
  car.vx *= 0.3;
  car.vy *= 0.3;
  for (let i = 0; i < 120 * 5; i++) car.update(PHYSICS_DT);
  assert.ok(car.gear < 4, `vuelve a bajar sola (marcha ${car.gear})`);
});

test('caja automática con cambio a mano: en el corte sí sube', () => {
  const spec = CARS.find((c) => c.id === 'mustank').physics;
  const car = new Vehicle(spec);
  car.input.throttle = 1;
  while (car.gear < 3) car.update(PHYSICS_DT);
  car.manualShift(-1);
  for (let i = 0; i < 120 * 2.5; i++) car.update(PHYSICS_DT);
  assert.ok(car.gear >= 3, 'no se queda pegada en el corte');
  assert.ok(car.rpm <= spec.redline * 1.02);
});

test('freno de motor: soltar el acelerador frena más en marcha baja', () => {
  const spec = CARS.find((c) => c.id === 'mustank').physics;
  const decel = (gear) => {
    const car = new Vehicle(spec);
    car.automatic = false;
    car.gear = gear;
    car.vx = 20;
    for (let i = 0; i < 120; i++) car.update(PHYSICS_DT);
    return 20 - car.speed;
  };
  assert.ok(decel(2) > decel(5));
});
