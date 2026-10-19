import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCity, nearestRoad, pointInPolygon } from '../src/city/city.js';
import { FreeRide } from '../src/freeRide.js';
import { CARS } from '../src/data/cars.js';

const city = buildCity();

test('la ciudad tiene calles, intersecciones y salida sobre una calle', () => {
  assert.ok(city.roads.length > 30);
  assert.ok(city.nodes.length > 200);
  const nr = nearestRoad(city, city.spawn.x, city.spawn.y);
  assert.ok(nr && nr.gap < -2, 'la salida está sobre la calle');
  assert.equal(nr.edge.road.name, 'Av. México');
});

test('todas las calles quedan dentro del área jugable', () => {
  for (const e of city.edges) {
    for (const [x, y] of e.path) {
      const inside = pointInPolygon(x, y, city.boundary);
      // Los extremos pueden quedar justo en la orilla.
      if (!inside) {
        const nearEdge = e.a.boundary || e.b.boundary;
        assert.ok(nearEdge, `${e.road.name} sale del área`);
      }
    }
  }
});

test('casi toda la red está conectada', () => {
  const seen = new Set([city.nodes[0].id]);
  const stack = [city.nodes[0]];
  while (stack.length) {
    const n = stack.pop();
    for (const e of n.edges) {
      const m = e.a === n ? e.b : e.a;
      if (!seen.has(m.id)) {
        seen.add(m.id);
        stack.push(m);
      }
    }
  }
  assert.ok(seen.size / city.nodes.length > 0.95, `conectados ${seen.size}/${city.nodes.length}`);
});

test('manejar sin rumbo nunca deja el carro fuera de las calles', () => {
  const ride = new FreeRide(city, CARS[0].physics);
  const car = ride.player.car;
  let t = 0;
  for (let i = 0; i < 120 * 60; i++) {
    t += 1 / 120;
    car.input.throttle = 1;
    car.input.steer = Math.sin(t * 0.7) * 0.8 + Math.sin(t * 2.3) * 0.3;
    ride.step(1 / 120);
    if (i % 600 === 0 && car.speed < 2) ride.respawn();
    const nr = nearestRoad(city, car.x, car.y);
    assert.ok(nr && nr.gap < 0.5, `fuera de la calle en (${car.x.toFixed(0)}, ${car.y.toFixed(0)})`);
    assert.ok(pointInPolygon(car.x, car.y, city.boundary), 'fuera del área');
  }
});

test('respawn deja el carro en el sentido permitido', () => {
  const ride = new FreeRide(city, CARS[0].physics);
  const oneway = city.edges.find((e) => e.road.oneway === -1 && e.length > 40);
  const [a, b] = oneway.path;
  const car = ride.player.car;
  car.place((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], b[0] - a[0]));
  ride.respawn();
  const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
  assert.ok(Math.cos(car.heading - dir) < -0.99, 'mira en contra del orden del trazo (sentido -1)');
});
