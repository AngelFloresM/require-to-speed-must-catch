import test from 'node:test';
import assert from 'node:assert/strict';

import { pickNext } from '../src/ui/spatialNav.js';

const rect = (x, y, w = 100, h = 40) => ({ left: x, top: y, width: w, height: h });

test('pickNext elige el botón más cercano en la dirección pedida', () => {
  const from = rect(100, 100);
  const rects = [rect(100, 160), rect(100, 220), rect(260, 100), rect(-60, 100), rect(100, 40)];
  assert.equal(pickNext(from, rects, 0, 1), 0, 'abajo: el siguiente');
  assert.equal(pickNext(from, rects, 0, -1), 4, 'arriba');
  assert.equal(pickNext(from, rects, 1, 0), 2, 'derecha');
  assert.equal(pickNext(from, rects, -1, 0), 3, 'izquierda');
});

test('pickNext prefiere lo alineado sobre lo diagonal y devuelve -1 si no hay nada', () => {
  const from = rect(100, 100);
  const rects = [rect(300, 170), rect(110, 190)];
  assert.equal(pickNext(from, rects, 0, 1), 1);
  assert.equal(pickNext(from, [rect(100, 20)], 0, 1), -1);
});

test('pickNext: una lista ancha justo debajo gana sobre un botón desalineado', () => {
  const from = rect(0, 0, 40, 40); // botón ◀ a la izquierda
  const wide = rect(0, 60, 400, 40); // lista de pistas, ancha
  const small = rect(0, 120, 80, 40); // vueltas, más abajo
  assert.equal(pickNext(from, [small, wide], 0, 1), 1);
});
