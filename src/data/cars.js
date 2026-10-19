// Datos de los carros. Todo en unidades SI (m, kg, N, Nm, W, rad).
// Para agregar un carro nuevo basta con añadir otro objeto aquí.
//
// Los nombres son inventados (parecidos a los reales). Los datos de motor,
// peso y medidas se basan en fichas públicas de los modelos reales
// (aproximados, ver docs/investigacion.md). El agarre es "arcade": más alto
// que en la vida real para que se maneje como en NFS.

// Valores comunes; cada carro puede sobreescribirlos.
const BASE = {
  drivetrainEfficiency: 0.85,
  rollingResistance: 10,  // N/(m/s)
  cgHeight: 0.5,          // m
  slipPeak: 0.14,         // rad, ángulo de deriva con agarre máximo
  combinedGrip: 0.35,     // cuánto agarre lateral se pierde al acelerar/frenar a tope (0..1)
  handbrakeGrip: 0.7,     // multiplicador de agarre trasero con freno de mano
  gripAssist: 2.5,        // 1/s, qué tan rápido se alinea la velocidad con el carro
  driftAssist: 2.0,       // 1/s, lo mismo pero con freno de mano (derrape)
  driftYaw: 1.3,          // giro extra permitido con freno de mano
  maxSteer: 0.55,         // rad a baja velocidad
  minSteer: 0.11,         // rad a velocidad máxima
  steerSpeed: 3.5,        // rad/s, qué tan rápido gira el volante
  reverseForce: 3500,     // N
  maxReverseSpeed: 9,     // m/s
  upshiftAt: 0.94,        // caja automática: sube cerca del corte
  downshiftAt: 0.62,      // baja si la marcha anterior queda bajo este % de RPM
  shiftTime: 0.35,        // s sin empuje durante el cambio
  engineBraking: 0.12,    // fracción del torque que frena al soltar el acelerador
  nitroPower: 1.4,        // multiplicador de empuje con nitro
  nitroCapacity: 4,       // s de nitro
  nitroRecharge: 0.12,    // s de nitro recargados por segundo
};

const car = (physics) => ({ ...BASE, ...physics });

export const CARS = [
  {
    id: 'raptor',
    model: 'sports',
    name: 'Raptor GT',
    color: 0x2f7dd1,
    info: {
      tipo: 'Deportivo (ficticio)',
      motor: '4.0 L V8',
      potencia: '400 hp @ 7000 rpm',
      torque: '520 Nm @ 5000 rpm',
      traccion: 'Trasera (RWD)',
      caja: 'Manual 6 vel.',
      peso: '1,400 kg',
      frenos: 'Discos ventilados 4 pistones',
    },
    physics: car({
      mass: 1400, inertia: 2300,
      length: 4.5, width: 1.9, height: 1.25,
      cgToFront: 1.3, cgToRear: 1.35,
      drivetrain: 'RWD',
      idleRpm: 900, launchRpm: 3500, redline: 7800,
      torqueCurve: [[1000, 330], [3000, 460], [5000, 520], [7000, 406], [7800, 360]],
      gears: [3.1, 2.1, 1.55, 1.2, 0.98, 0.8], finalDrive: 3.6, wheelRadius: 0.33,
      dragCoef: 0.6, downforce: 2.5, grip: 1.5,
      brakeForce: 20000, brakeBias: 0.65,
    }),
  },
  {
    id: 'marsh',
    model: 'hatch',
    name: 'Nizan Marsh',
    color: 0xd9d9d9,
    info: {
      tipo: 'Hatchback compacto (ref. Nissan March 1.6)',
      motor: '1.6 L 4 cil.',
      potencia: '106 hp @ 5600 rpm',
      torque: '142 Nm @ 4400 rpm',
      traccion: 'Delantera (FWD)',
      caja: 'Manual 5 vel.',
      peso: '~1,030 kg',
      frenos: 'Disco ventilado adelante / tambor atrás',
    },
    physics: car({
      mass: 1030, inertia: 1250,
      length: 3.83, width: 1.665, height: 1.515,
      cgToFront: 0.98, cgToRear: 1.47, // ~60% del peso adelante
      drivetrain: 'FWD',
      idleRpm: 750, launchRpm: 1800, redline: 6500,
      torqueCurve: [[1000, 95], [2000, 118], [3000, 130], [4400, 142], [5600, 135], [6500, 118]],
      gears: [3.727, 2.048, 1.393, 1.029, 0.821], finalDrive: 4.067, wheelRadius: 0.305,
      dragCoef: 0.42, downforce: 0.3, grip: 1.3,
      brakeForce: 10500, brakeBias: 0.72,
      maxSteer: 0.6,
    }),
  },
  {
    id: 'taikan',
    model: 'sedan',
    name: 'Porshe Taikan Turbo S',
    color: 0x6b6f76,
    info: {
      tipo: 'Sedán eléctrico (ref. Porsche Taycan Turbo S)',
      motor: '2 motores eléctricos',
      potencia: '570 kW (775 hp), 700 kW con nitro (overboost)',
      torque: '1,110 Nm',
      traccion: 'Integral (AWD)',
      caja: '2 vel. (eje trasero)',
      peso: '~2,300 kg',
      frenos: 'Cerámicos (PCCB) 10 pistones',
    },
    physics: car({
      mass: 2300, inertia: 4200,
      length: 4.963, width: 1.966, height: 1.379,
      cgToFront: 1.48, cgToRear: 1.42,
      drivetrain: 'AWD', awdFront: 0.4,
      electric: true,
      idleRpm: 0, launchRpm: 0, redline: 16000,
      torqueCurve: [[0, 700], [16000, 700]], // torque del motor; la potencia la limita maxPower
      maxPower: 570000,
      gears: [15.1, 8.05], finalDrive: 1, wheelRadius: 0.36,
      dragCoef: 0.31, downforce: 1.2, grip: 1.5,
      speedLimiter: 260 / 3.6,
      brakeForce: 32000, brakeBias: 0.62,
      upshiftAt: 0.95, downshiftAt: 0.5, shiftTime: 0.08,
      nitroPower: 700 / 570,
      cgHeight: 0.45,
    }),
  },
  {
    id: 'mustank',
    model: 'muscle',
    name: 'Fort Mustank GT',
    color: 0xc0392b,
    info: {
      tipo: 'Muscle car (ref. Ford Mustang GT S650)',
      motor: '5.0 L V8 Coyote',
      potencia: '480 hp @ 7150 rpm',
      torque: '563 Nm @ 4900 rpm',
      traccion: 'Trasera (RWD)',
      caja: 'Manual 6 vel.',
      peso: '~1,750 kg',
      frenos: 'Brembo 6 pistones adelante',
    },
    physics: car({
      mass: 1750, inertia: 3000,
      length: 4.811, width: 1.916, height: 1.397,
      cgToFront: 1.28, cgToRear: 1.44, // ~53% adelante
      drivetrain: 'RWD',
      idleRpm: 700, launchRpm: 2200, redline: 7500,
      torqueCurve: [[1000, 380], [2000, 450], [3000, 500], [4000, 540], [4900, 563], [6000, 535], [7150, 478], [7500, 440]],
      gears: [3.25, 2.19, 1.63, 1.29, 1.0, 0.85], finalDrive: 3.73, wheelRadius: 0.343,
      dragCoef: 0.51, downforce: 1.2, grip: 1.4,
      speedLimiter: 250 / 3.6,
      brakeForce: 23000, brakeBias: 0.65,
    }),
  },
];

export const RIVAL_COLORS = [0xd13b2f, 0xe0b02a, 0x3fae5a, 0x8e44ad];
