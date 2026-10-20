// Tuneo de física: valores crudos del carro que el jugador puede mover en vivo
// desde el panel de tuneo (tecla T o desde la pausa). Lógica pura, sin DOM.
// Los cambios se guardan por carro como "overrides" sobre cars.js.

export const GROUPS = ['Motor y caja', 'Agarre', 'Derrape', 'Volante', 'Frenos', 'Aerodinámica', 'Peso', 'Nitro', 'Reversa'];

// key: campo de la física (o virtual: powerScale). fmt: cómo mostrar el valor.
export const PARAMS = [
  { key: 'powerScale', group: 'Motor y caja', label: 'Potencia (×)', min: 0.5, max: 2.5, step: 0.05, def: 1, desc: 'Multiplica la curva de torque.' },
  { key: 'finalDrive', group: 'Motor y caja', label: 'Relación final', min: 0.5, max: 5.5, step: 0.05, desc: 'Más alta: más aceleración y menos vel. máxima.' },
  { key: 'shiftTime', group: 'Motor y caja', label: 'Tiempo de cambio (s)', min: 0, max: 0.8, step: 0.01, desc: 'Tiempo sin empuje en cada cambio.' },
  { key: 'upshiftAt', group: 'Motor y caja', label: 'Automática: sube al (% corte)', min: 0.6, max: 1, step: 0.01, pct: true },
  { key: 'downshiftAt', group: 'Motor y caja', label: 'Automática: baja bajo (% corte)', min: 0.3, max: 0.85, step: 0.01, pct: true },
  { key: 'engineBraking', group: 'Motor y caja', label: 'Freno de motor', min: 0, max: 0.5, step: 0.01, desc: 'Frenado al soltar el acelerador.' },
  { key: 'drivetrainEfficiency', group: 'Motor y caja', label: 'Eficiencia de transmisión', min: 0.5, max: 1, step: 0.01, pct: true },
  { key: 'rollingResistance', group: 'Motor y caja', label: 'Resistencia al rodar', min: 0, max: 60, step: 1 },

  { key: 'grip', group: 'Agarre', label: 'Agarre de llantas (μ)', min: 0.6, max: 3, step: 0.05, desc: 'El valor principal del manejo.' },
  { key: 'slipPeak', group: 'Agarre', label: 'Deriva de agarre máximo (rad)', min: 0.04, max: 0.35, step: 0.01, desc: 'Más alto: el carro patina más antes de agarrar.' },
  { key: 'combinedGrip', group: 'Agarre', label: 'Pérdida al acelerar/frenar', min: 0, max: 1, step: 0.01, pct: true, desc: 'Agarre lateral que se pierde con el pedal a fondo.' },
  { key: 'gripAssist', group: 'Agarre', label: 'Asistencia de agarre', min: 0, max: 10, step: 0.1, desc: 'Más alto: se alinea antes, derrapa menos.' },
  { key: 'cgHeight', group: 'Agarre', label: 'Altura del centro de gravedad (m)', min: 0.25, max: 0.9, step: 0.01, desc: 'Más alto: más traspaso de peso.' },

  { key: 'handbrakeGrip', group: 'Derrape', label: 'Agarre trasero con freno de mano', min: 0.1, max: 1.2, step: 0.01, pct: true },
  { key: 'driftAssist', group: 'Derrape', label: 'Asistencia al derrapar', min: 0, max: 10, step: 0.1 },
  { key: 'driftYaw', group: 'Derrape', label: 'Giro extra con freno de mano', min: 0.5, max: 3, step: 0.05 },

  { key: 'maxSteer', group: 'Volante', label: 'Giro a baja velocidad (rad)', min: 0.2, max: 0.9, step: 0.01 },
  { key: 'minSteer', group: 'Volante', label: 'Giro a velocidad máxima (rad)', min: 0.02, max: 0.35, step: 0.01 },
  { key: 'steerSpeed', group: 'Volante', label: 'Rapidez del volante (rad/s)', min: 0.5, max: 10, step: 0.1 },

  { key: 'brakeForce', group: 'Frenos', label: 'Fuerza de frenado (N)', min: 4000, max: 60000, step: 500 },
  { key: 'brakeBias', group: 'Frenos', label: 'Reparto adelante', min: 0.3, max: 0.9, step: 0.01, pct: true },

  { key: 'dragCoef', group: 'Aerodinámica', label: 'Resistencia del aire', min: 0.15, max: 1.5, step: 0.01, desc: 'Limita la velocidad máxima.' },
  { key: 'downforce', group: 'Aerodinámica', label: 'Carga aerodinámica', min: 0, max: 10, step: 0.1, desc: 'Más agarre a más velocidad.' },

  { key: 'mass', group: 'Peso', label: 'Masa (kg)', min: 600, max: 3000, step: 10 },
  { key: 'inertia', group: 'Peso', label: 'Inercia de giro', min: 500, max: 6000, step: 50, desc: 'Más alta: tarda más en girar sobre sí mismo.' },

  { key: 'nitroPower', group: 'Nitro', label: 'Potencia del nitro (×)', min: 1, max: 3, step: 0.05 },
  { key: 'nitroCapacity', group: 'Nitro', label: 'Duración del tanque (s)', min: 1, max: 15, step: 0.5 },
  { key: 'nitroRecharge', group: 'Nitro', label: 'Recarga (s por s)', min: 0, max: 1, step: 0.01 },

  { key: 'reverseForce', group: 'Reversa', label: 'Empuje en reversa (N)', min: 1000, max: 10000, step: 100 },
  { key: 'maxReverseSpeed', group: 'Reversa', label: 'Vel. máxima en reversa (m/s)', min: 3, max: 25, step: 0.5 },
];

const BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

// Valor actual (sin overrides) de un parámetro para esa física.
export function baseValue(physics, key) {
  return BY_KEY[key].def ?? physics[key];
}

const clamp = (p, v) => Math.max(p.min, Math.min(p.max, v));

// Copia de la física con los overrides aplicados. Ignora claves desconocidas.
export function applyOverrides(physics, overrides = {}) {
  const out = { ...physics };
  for (const [key, raw] of Object.entries(overrides)) {
    const p = BY_KEY[key];
    const v = Number(raw);
    if (!p || !Number.isFinite(v)) continue;
    if (key === 'powerScale') {
      const k = clamp(p, v);
      out.torqueCurve = physics.torqueCurve.map(([rpm, nm]) => [rpm, nm * k]);
      if (physics.maxPower) out.maxPower = physics.maxPower * k;
    } else out[key] = clamp(p, v);
  }
  return out;
}

// Lee lo guardado: { carId: { key: value } }, descartando lo inválido.
export function parseOverrides(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [carId, ov] of Object.entries(data)) {
    if (!ov || typeof ov !== 'object') continue;
    const clean = {};
    for (const [key, v] of Object.entries(ov)) if (BY_KEY[key] && Number.isFinite(Number(v))) clean[key] = Number(v);
    if (Object.keys(clean).length) out[carId] = clean;
  }
  return out;
}
