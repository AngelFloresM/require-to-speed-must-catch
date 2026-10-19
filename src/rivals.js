// Rivales: cada uno maneja un carro distinto al del jugador.
import { CARS } from './data/cars.js';
import { applyTuning } from './data/tuning.js';
import { matchPerformance } from './balance.js';

// Carril preferido y habilidad de cada lugar de la parrilla.
const SLOTS = [
  { lane: -4, skill: 0.95 },
  { lane: 3, skill: 0.88 },
  { lane: 0, skill: 0.8 },
];

// match: física del jugador; si se da, cada rival se iguala a ella
// (carrera pareja). Sin match, los rivales usan su carro tal cual.
export function pickRivals(playerCarId, { match = null, count = SLOTS.length } = {}) {
  const others = CARS.filter((c) => c.id !== playerCarId);
  return SLOTS.slice(0, count).map((slot, i) => {
    const car = others[i % others.length];
    const spec = applyTuning(car.physics);
    return {
      ...slot,
      name: car.name,
      spec: match ? matchPerformance(spec, match) : spec,
      color: car.color,
      model: car.model,
    };
  });
}
