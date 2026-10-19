// Ajustes de rendimiento estilo NFS: Most Wanted. Cada uno va de -5 a +5.
// Por ahora solo se muestran (no se pueden cambiar). applyTuning ya los
// traduce a la física para cuando se habiliten; con todo en 0 no cambia nada.

export const TUNING = [
  {
    id: 'steering',
    label: 'Dirección',
    left: 'Lenta',
    right: 'Rápida',
    desc: 'Qué tan rápido gira el volante.',
    tip: 'La mejor opción suele ser +5.',
  },
  {
    id: 'handling',
    label: 'Manejo',
    left: 'Estable',
    right: 'Nervioso',
    desc: 'Qué tan nervioso o reactivo es el carro.',
    tip: 'Déjalo en 0 o +1; lo demás suele empeorarlo.',
  },
  {
    id: 'brakes',
    label: 'Frenos',
    left: 'Adelante',
    right: 'Atrás',
    desc: 'Balance de frenos. Más hacia atrás hace que el carro sobrevire (gire de cola) cada vez que frenas.',
    tip: 'Divertido, pero casi nunca útil. No hace falta cambiarlo.',
  },
  {
    id: 'rideHeight',
    label: 'Altura',
    left: 'Baja',
    right: 'Alta',
    desc: 'Más baja da más agarre, pero si el carro toca el piso pierde mucha velocidad, y fuera del asfalto pierde mucho agarre.',
    tip: 'Con muchas superficies elevadas no conviene bajarla.',
  },
  {
    id: 'aero',
    label: 'Aerodinámica',
    left: 'Menos carga',
    right: 'Más carga',
    desc: 'Carga aerodinámica (downforce): más agarre. La velocidad máxima baja solo unos km/h. En saltos, +5 cae rápido y −5 planea.',
    tip: 'No hay desventaja real en +5.',
  },
  {
    id: 'nitrous',
    label: 'Nitro',
    left: 'Duración',
    right: 'Potencia',
    desc: 'Más potencia por menos tiempo, o menos potencia por más tiempo.',
    tip: 'Casi no hace diferencia; incluso los speedrunners lo dejan igual.',
  },
  {
    id: 'turbo',
    label: 'Turbo / supercargador',
    left: 'Aceleración',
    right: 'Vel. máxima',
    desc: 'Cambia aceleración por velocidad máxima.',
    tip: 'No hay razón real para cambiarlo.',
  },
];

export function defaultTuning() {
  return Object.fromEntries(TUNING.map((t) => [t.id, 0]));
}

// Devuelve una copia de la física con los ajustes aplicados.
export function applyTuning(physics, tuning = defaultTuning()) {
  const f = (id) => Math.max(-5, Math.min(5, tuning[id] ?? 0)) / 5; // -1..1
  const p = { ...physics };
  p.steerSpeed *= 1 + 0.5 * f('steering');
  p.gripAssist *= 1 - 0.4 * f('handling');
  p.slipPeak *= 1 - 0.2 * f('handling');
  p.brakeBias = Math.max(0.3, Math.min(0.85, p.brakeBias - 0.12 * f('brakes')));
  p.grip *= 1 - 0.03 * f('rideHeight');
  p.cgHeight += 0.05 * f('rideHeight');
  p.downforce *= 1 + 0.6 * f('aero');
  p.dragCoef *= 1 + 0.03 * f('aero');
  p.nitroPower = 1 + (p.nitroPower - 1) * (1 + 0.4 * f('nitrous'));
  p.nitroCapacity *= 1 - 0.3 * f('nitrous');
  p.finalDrive *= 1 - 0.06 * f('turbo');
  return p;
}
