import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCity, nearestRoad, pointInPolygon, drivableGap } from '../src/city/city.js';
import { FreeRide } from '../src/freeRide.js';
import { CARS } from '../src/data/cars.js';

const city = buildCity();

test('la ciudad tiene calles, intersecciones y salida sobre una calle', () => {
  assert.ok(city.roads.length > 30);
  assert.ok(city.nodes.length > 200);
  const nr = nearestRoad(city, city.spawn.x, city.spawn.y);
  assert.ok(nr && nr.gap < -2, 'la salida está sobre la calle');
  assert.match(nr.edge.road.name, /^Av\. México/);
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
    const g = drivableGap(city, car.x, car.y);
    assert.ok(g && g.gap < 0.5, `fuera de la calle en (${car.x.toFixed(0)}, ${car.y.toFixed(0)})`);
    assert.ok(pointInPolygon(car.x, car.y, city.boundary), 'fuera del área');
  }
});

test('respawn deja el carro en el sentido permitido', () => {
  const ride = new FreeRide(city, CARS[0].physics);
  const oneway = city.edges.find((e) => e.road.oneway !== 0 && e.length > 40 && e.path.length === 2);
  const [a, b] = oneway.path;
  const car = ride.player.car;
  const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
  // Colocado en contra del sentido: el respawn lo voltea.
  car.place((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dir + (oneway.road.oneway > 0 ? Math.PI : 0));
  ride.respawn();
  assert.ok(Math.cos(car.heading - dir) * oneway.road.oneway > 0.99, 'mira en el sentido de la calle');
});

test('esquinas redondeadas: la esquina se vuelve calle y el arco es la nueva orilla', () => {
  assert.ok(city.fillets.length > 300);
  let checked = 0;
  for (const f of city.fillets.slice(0, 200)) {
    // Punto entre la esquina puntiaguda K y el arco: antes era banqueta, ahora es calle.
    const mid = [(f.T1[0] + f.T2[0]) / 2, (f.T1[1] + f.T2[1]) / 2];
    const p = [(mid[0] + f.K[0]) / 2, (mid[1] + f.K[1]) / 2];
    const nr = nearestRoad(city, p[0], p[1]);
    if (!nr || nr.gap <= 0.2) continue; // otra calle ya cubría esa esquina
    assert.ok(drivableGap(city, p[0], p[1]).gap <= 0, 'la esquina recortada se puede manejar');
    // Cerca del centro del arco (a media distancia del radio) sigue siendo banqueta.
    const kl = Math.hypot(f.K[0] - f.c[0], f.K[1] - f.c[1]);
    const q = [f.c[0] + ((f.K[0] - f.c[0]) / kl) * f.r * 0.5, f.c[1] + ((f.K[1] - f.c[1]) / kl) * f.r * 0.5];
    const nq = nearestRoad(city, q[0], q[1]);
    if (nq && nq.gap > 0) assert.ok(drivableGap(city, q[0], q[1]).gap > 0, 'detrás del arco sigue la banqueta');
    checked++;
  }
  assert.ok(checked > 50, `pocas esquinas revisadas (${checked})`);
});

test('dar vuelta en una esquina: con esquinas redondeadas ya no se golpea la banqueta', async () => {
  const { FreeRide } = await import('../src/freeRide.js');
  const { CARS } = await import('../src/data/cars.js');
  const turn = (c, node, steerAt) => {
    const e = node.edges[0];
    const p = e.a === node ? e.path : [...e.path].reverse();
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1]];
    const len = Math.hypot(...u);
    const dir = Math.atan2(-u[1], -u[0]); // hacia el nodo
    const ride = new FreeRide(c, CARS[0].physics);
    const car = ride.player.car;
    car.place(node.x + (u[0] / len) * 35, node.y + (u[1] / len) * 35, dir);
    car.vx = Math.cos(dir) * 8;
    car.vy = Math.sin(dir) * 8;
    let hits = 0;
    ride.onHit = () => hits++;
    for (let i = 0; i < 120 * 5; i++) {
      const dn = Math.hypot(car.x - node.x, car.y - node.y);
      // Vuelta normal de ciudad: ~29 km/h sin acelerar.
      car.input.throttle = car.speed < 8 ? 0.4 : 0;
      let turned = dir - car.heading;
      turned = Math.atan2(Math.sin(turned), Math.cos(turned));
      car.input.steer = dn < steerAt && turned < 1.4 ? -0.8 : 0; // vuelta a la derecha de ~90°
      ride.step(1 / 120);
    }
    return hits;
  };
  // Cruces en cruz (brazos a ~90°), como los del centro.
  const square = (n) => {
    const angs = n.edges.map((e) => {
      const p = e.a === n ? e.path : [...e.path].reverse();
      return Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]);
    });
    return angs.every((a) => angs.some((b) => Math.abs(Math.cos(a - b)) < 0.1));
  };
  const nodes = city.nodes.filter((n) => n.edges.length === 4 && n.edges.every((e) => !e.road.major && e.length > 60) && square(n)).slice(0, 12);
  const sharp = { ...city, fillets: [], filletIndex: new Map() };
  let withF = 0;
  let without = 0;
  for (const n of nodes) {
    withF += turn(city, n, 10.5);
    without += turn(sharp, n, 10.5);
  }
  console.log({ conEsquinasRedondeadas: withF, sinEllas: without });
  assert.ok(without > 0, 'sin redondear, la vuelta pega con la esquina');
  assert.equal(withF, 0, 'con esquinas redondeadas, no');
});
