// Calcula los números del garaje a partir de la física real del carro,
// para que las barras no mientan.
import { Vehicle } from '../physics/vehicle.js';

const DT = 1 / 120;
const G = 9.81;

export function measurePerformance(spec) {
  const car = new Vehicle(spec);
  car.input.throttle = 1;
  let t = 0;
  while (car.speed < 100 / 3.6 && t < 30) {
    car.update(DT);
    t += DT;
  }
  const topKmh = car.topSpeed * 3.6;
  // Aceleración lateral máxima a 150 km/h (agarre + carga aerodinámica), en g.
  const v = 150 / 3.6;
  const lateralG = (spec.grip * (spec.mass * G + spec.downforce * v * v)) / spec.mass / G;
  const scale = (x, a, b) => Math.max(1, Math.min(10, 1 + ((x - a) / (b - a)) * 9));
  return {
    topKmh,
    zeroTo100: t,
    lateralG,
    bars: {
      topSpeed: scale(topKmh, 150, 350),
      acceleration: scale(-t, -12, -2.5),
      handling: scale(lateralG, 1, 3),
    },
  };
}
