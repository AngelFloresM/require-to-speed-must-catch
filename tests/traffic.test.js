import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCity, nearestRoad } from '../src/city/city.js';
import { buildSignals, lightFor, CYCLE } from '../src/city/signals.js';
import { Traffic } from '../src/city/traffic.js';

const city = buildCity();
buildSignals(city);

test('hay semáforos y cada uno alterna verde, amarillo y rojo', () => {
  assert.ok(city.signals.length > 10, `${city.signals.length} semáforos`);
  const n = city.signals[0];
  const e = n.edges[0];
  const seen = new Set();
  for (let t = 0; t < 40; t += 0.5) seen.add(lightFor(n, e, t));
  assert.deepEqual([...seen].sort(), ['green', 'red', 'yellow']);
  // Los dos ejes nunca están en verde al mismo tiempo.
  const other = n.edges.find((x) => n.signal.group.get(x.id) !== n.signal.group.get(e.id));
  for (let t = 0; t < 40; t += 0.25) {
    assert.ok(!(lightFor(n, e, t) === 'green' && lightFor(n, other, t) === 'green'));
  }
  assert.ok(CYCLE.yellow >= 3);
});

test('tráfico de 3 minutos: carriles, sentidos, distancias y altos', () => {
  const traffic = new Traffic(city, { count: 24 });
  const dt = 1 / 30;
  let redRuns = 0;
  let signalCrossings = 0;
  let wrongWay = 0;
  let offRoad = 0;
  let minGap = Infinity;
  let speedSum = 0;
  let samples = 0;
  const wasTurning = new Map();
  for (let i = 0; i < 180 / dt; i++) {
    traffic.step(dt);
    for (const c of traffic.cars) {
      // Al empezar a cruzar, el semáforo no debe estar en rojo.
      if (c.turn && !wasTurning.get(c)) {
        const node = c.turn.node;
        const came = c.edge; // todavía es la arista por la que llegó
        if (node.signal) signalCrossings++;
        if (lightFor(node, came, traffic.time) === 'red') redRuns++;
      }
      wasTurning.set(c, !!c.turn);
      if (c.edge.road.oneway && c.edge.road.oneway !== c.dir) wrongWay++;
      const nr = nearestRoad(city, c.x, c.y);
      if (!nr || nr.gap > 0) offRoad++;
      speedSum += c.speed;
      samples++;
    }
    if (i % 10 === 0) {
      for (let a = 0; a < traffic.cars.length; a++) {
        for (let b = a + 1; b < traffic.cars.length; b++) {
          const A = traffic.cars[a];
          const B = traffic.cars[b];
          minGap = Math.min(minGap, Math.hypot(A.x - B.x, A.y - B.y));
        }
      }
    }
  }
  const avgKmh = (speedSum / samples) * 3.6;
  assert.ok(signalCrossings > 30, `pocos cruces con semáforo (${signalCrossings})`);
  console.log({ signalCrossings, redRuns, wrongWay, offRoad, minGap: minGap.toFixed(1), avgKmh: avgKmh.toFixed(0) });
  assert.equal(redRuns, 0, 'nadie se pasa el rojo');
  assert.equal(wrongWay, 0, 'nadie va en sentido contrario');
  assert.equal(offRoad, 0, 'todos sobre la calle');
  assert.ok(minGap > 2, `dos carros casi encimados (${minGap.toFixed(1)} m)`);
  assert.ok(avgKmh > 10, 'el tráfico avanza');
});

test('el tráfico frena detrás del jugador detenido', () => {
  const traffic = new Traffic(city, { count: 1 });
  const c = traffic.cars[0];
  // Jugador parado 20 m adelante en el mismo carril.
  traffic.step(1 / 30);
  const player = { x: c.x + Math.cos(c.h) * 20, y: c.y + Math.sin(c.h) * 20, vx: 0, vy: 0, h: c.h };
  let min = Infinity;
  for (let i = 0; i < 30 * 8; i++) {
    traffic.step(1 / 30, player);
    if (c.turn) break;
    min = Math.min(min, Math.hypot(player.x - c.x, player.y - c.y));
  }
  assert.ok(min > 4.6, `se acercó a ${min.toFixed(1)} m`);
});

test('modo libre con tráfico: chocar a un carro lo detiene y avisa al pasarse el alto', async () => {
  const { FreeRide } = await import('../src/freeRide.js');
  const { CARS } = await import('../src/data/cars.js');
  const ride = new FreeRide(city, CARS[0].physics, { traffic: 1 });
  const c = ride.traffic.cars[0];
  const car = ride.player.car;
  // Coloca al jugador justo detrás y lo lanza contra el carro de tráfico.
  car.place(c.x - Math.cos(c.h) * 8, c.y - Math.sin(c.h) * 8, c.h);
  car.vx = Math.cos(c.h) * 15;
  car.vy = Math.sin(c.h) * 15;
  let stunned = false;
  for (let i = 0; i < 120; i++) {
    ride.step(1 / 120);
    if (c.stun > 0) stunned = true;
  }
  assert.ok(stunned, 'el carro chocado se detiene');

  // Cruce con semáforo en rojo para el jugador.
  const node = city.signals[0];
  const edge = node.edges.find((e) => e.length > 40 && (e.road.oneway === 0 || e.road.oneway === (e.b === node ? 1 : -1)));
  const ride2 = new FreeRide(city, CARS[0].physics);
  const p = edge.b === node ? edge.path[edge.path.length - 2] : edge.path[1];
  const h = Math.atan2(node.y - p[1], node.x - p[0]);
  const start = [node.x - Math.cos(h) * 30, node.y - Math.sin(h) * 30];
  // Busca un momento en rojo para ese acceso.
  let t = 0;
  while (lightFor(node, edge, t) !== 'red') t += 0.5;
  ride2.time = t;
  ride2.player.car.place(start[0], start[1], h);
  ride2.player.car.vx = Math.cos(h) * 15;
  ride2.player.car.vy = Math.sin(h) * 15;
  for (let i = 0; i < 120 * 2.5 && !ride2.message; i++) ride2.step(1 / 120);
  assert.equal(ride2.message?.text, '¡Te pasaste el alto!');
});

test('los postes de semáforo quedan sobre la banqueta', async () => {
  const { drivableGap } = await import('../src/city/city.js');
  // SignalMesh necesita three.js pero no DOM: se puede crear en Node.
  const { SignalMesh } = await import('../src/render/trafficMesh.js');
  const mesh = new SignalMesh(city);
  const onRoad = mesh.heads.filter((h) => drivableGap(city, h.x, h.y).gap <= 0);
  assert.ok(onRoad.length <= mesh.heads.length * 0.02, `${onRoad.length} de ${mesh.heads.length} postes sobre el asfalto`);
});
