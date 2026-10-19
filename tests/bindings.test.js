import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, defaultBindings, parseBindings, assignKey, assignPad, unbindKey, unbindPad, keyLabel, padLabel, padValue,
} from '../src/bindings.js';

test('todas las acciones tienen asignación por defecto', () => {
  const b = defaultBindings();
  for (const { id } of ACTIONS) {
    assert.ok(b[id].keys[0], `${id} sin tecla`);
    assert.ok(b[id].pad, `${id} sin control`);
  }
});

test('asignar una tecla usada por otra acción se la quita a esa', () => {
  const b = defaultBindings();
  const moved = assignKey(b, 'nitro', 0, 'KeyW');
  assert.equal(moved, 'Acelerar');
  assert.equal(b.nitro.keys[0], 'KeyW');
  assert.ok(!b.throttle.keys.includes('KeyW'));
  assert.equal(b.throttle.keys[1], 'ArrowUp');
});

test('asignar la misma tecla en el otro espacio de la misma acción la mueve', () => {
  const b = defaultBindings();
  assert.equal(assignKey(b, 'throttle', 1, 'KeyW'), null);
  assert.deepEqual(b.throttle.keys, [null, 'KeyW']);
});

test('asignar un botón del control usado por otra acción se lo quita', () => {
  const b = defaultBindings();
  assert.equal(assignPad(b, 'handbrake', { type: 'button', index: 7 }), 'Acelerar');
  assert.equal(b.throttle.pad, null);
  // Mismo eje con distinta dirección no choca.
  assert.equal(assignPad(b, 'nitro', { type: 'axis', index: 0, dir: 1 }), 'Girar a la derecha');
  assert.deepEqual(b.steerLeft.pad, { type: 'axis', index: 0, dir: -1 });
});

test('quitar asignaciones', () => {
  const b = defaultBindings();
  unbindKey(b, 'throttle', 0);
  unbindPad(b, 'throttle');
  assert.deepEqual(b.throttle, { keys: [null, 'ArrowUp'], pad: null });
});

test('guardar y cargar; datos dañados vuelven a los valores por defecto', () => {
  const b = defaultBindings();
  assignKey(b, 'nitro', 0, 'KeyN');
  unbindPad(b, 'camera');
  const loaded = parseBindings(JSON.stringify(b));
  assert.deepEqual(loaded, b);
  assert.deepEqual(parseBindings('{basura'), defaultBindings());
  assert.deepEqual(parseBindings(null), defaultBindings());
  const partial = parseBindings(JSON.stringify({ nitro: { keys: [42], pad: { type: 'raro' } } }));
  assert.deepEqual(partial.nitro, { keys: [null, null], pad: defaultBindings().nitro.pad });
});

test('nombres legibles y valores del control', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowLeft'), '←');
  assert.equal(keyLabel(null), '—');
  assert.equal(padLabel({ type: 'button', index: 7 }), 'RT');
  assert.equal(padLabel({ type: 'axis', index: 0, dir: -1 }), 'Stick izq. ←');
  const pad = { buttons: [{ value: 1 }], axes: [-0.6] };
  assert.equal(padValue(pad, { type: 'button', index: 0 }), 1);
  assert.ok(padValue(pad, { type: 'axis', index: 0, dir: -1 }) > 0.5);
  assert.equal(padValue(pad, { type: 'axis', index: 0, dir: 1 }), 0);
});
