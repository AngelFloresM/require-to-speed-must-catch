// Datos de los carros. Todo en unidades SI (m, kg, N, W, rad).
// Para agregar un carro nuevo basta con añadir otro objeto aquí.

export const CARS = [
  {
    id: 'raptor',
    name: 'Raptor GT',
    color: 0x2f7dd1,
    physics: {
      mass: 1400,          // kg
      inertia: 2300,       // kg·m² (giro sobre el eje vertical)
      length: 4.5,         // m
      width: 1.9,          // m
      cgToFront: 1.3,      // m, centro de masa a eje delantero
      cgToRear: 1.35,      // m, centro de masa a eje trasero
      power: 300000,       // W (~400 hp)
      maxDriveForce: 9000, // N, límite de tracción del motor
      brakeForce: 20000,   // N (limitado por ABS al agarre disponible)
      reverseForce: 3500,  // N
      maxReverseSpeed: 9,  // m/s
      dragCoef: 0.6,       // N/(m/s)²  -> velocidad máx ~ 74 m/s (267 km/h)
      rollingResistance: 10, // N/(m/s)
      grip: 1.5,           // coeficiente de fricción (arcade: alto)
      downforce: 2.5,      // N/(m/s)², carga aerodinámica
      slipPeak: 0.14,      // rad, ángulo de deriva con agarre máximo
      handbrakeGrip: 0.7,  // multiplicador de agarre trasero con freno de mano
      gripAssist: 2.5,     // 1/s, qué tan rápido se alinea la velocidad con el carro
      driftAssist: 2.0,    // 1/s, lo mismo pero con freno de mano (derrape)
      driftYaw: 1.3,       // giro extra permitido con freno de mano
      maxSteer: 0.55,      // rad a baja velocidad
      minSteer: 0.11,      // rad a velocidad máxima
      steerSpeed: 3.5,     // rad/s, qué tan rápido gira el volante
      nitroPower: 1.6,     // multiplicador de potencia con nitro
      nitroCapacity: 4,    // s de nitro
      nitroRecharge: 0.12, // s de nitro recargados por segundo
      gears: 6,
    },
  },
];

export const RIVAL_COLORS = [0xd13b2f, 0xe0b02a, 0x3fae5a];
