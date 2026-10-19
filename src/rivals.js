// Rivales: cada uno maneja un carro distinto al del jugador.
import { CARS } from './data/cars.js';
import { applyTuning } from './data/tuning.js';

// Carril preferido y habilidad de cada lugar de la parrilla.
const SLOTS = [
  { lane: -4, skill: 0.95 },
  { lane: 3, skill: 0.88 },
  { lane: 0, skill: 0.8 },
];

export function pickRivals(playerCarId, count = SLOTS.length) {
  const others = CARS.filter((c) => c.id !== playerCarId);
  return SLOTS.slice(0, count).map((slot, i) => {
    const car = others[i % others.length];
    return {
      ...slot,
      name: car.name,
      spec: applyTuning(car.physics),
      color: car.color,
      model: car.model,
    };
  });
}
