// Mapa del modo libre: parte del centro de Tepic, Nayarit.
// Trazado a mano sobre una captura de Google Maps (zoom ~16), por eso las
// posiciones son aproximadas. Coordenadas en píxeles de esa captura; se
// convierten a metros con S m/px, con origen en la Catedral.
//
// Sentidos de circulación: las avenidas son de doble sentido; las calles
// del cuadro son de un sentido, alternando (suposición: ajustar con datos reales).

export const S = 1.6; // m por píxel (barra de escala "200 m" ≈ 125 px)
const ORIGIN = [1320, 643]; // Catedral

export const px = ([x, y]) => [(x - ORIGIN[0]) * S, (ORIGIN[1] - y) * S];
const pts = (list) => list.map(px);

// Límite del área jugable (línea roja de la captura).
export const BOUNDARY = pts([
  [660, 175], [1000, 172], [1500, 165], [1570, 240], [1610, 380], [1640, 520], [1645, 680], [1580, 722],
  [1470, 770], [1395, 880], [1350, 1060], [1270, 1190], [1200, 1215], [1000, 1222], [800, 1232],
  [630, 1205], [580, 1100], [558, 900], [540, 680], [505, 560], [448, 480], [445, 350], [482, 265], [560, 195],
]);

// Parques y plaza: no se puede manejar dentro; sin edificios.
export const PARKS = [
  { name: 'Alameda de Tepic', poly: pts([[792, 718], [860, 668], [945, 708], [932, 795], [870, 815], [802, 788]]) },
  { name: 'Parque Juan Escutia', poly: pts([[872, 592], [950, 545], [985, 600], [912, 668], [872, 650]]) },
  { name: 'Parque La Loma', poly: pts([[835, 975], [940, 1005], [1060, 1045], [1100, 1110], [1080, 1170], [950, 1182], [822, 1168], [802, 1080], [810, 1010]]) },
  { name: 'Plaza Principal', plaza: true, poly: pts([[1252, 648], [1315, 672], [1298, 728], [1236, 702]]) },
];

// Río Mololoa (solo visual).
export const RIVER = { width: 22, path: pts([[1180, 90], [1200, 200], [1300, 280], [1372, 352], [1440, 420], [1520, 458], [1650, 500], [1760, 540]]) };

// Cuadrícula: dos familias de calles paralelas.
// k = 0 es la avenida que da nombre a la familia. names[k] (k puede ser negativo).
export const GRID = [
  {
    // Calles "norte-sur" (paralelas a Av. México). k > 0 hacia el este.
    through: px([1330, 643]),
    dir: [355, -1070], // en px (x derecha, y abajo), apuntando al norte
    side: 'right', // k > 0 queda a la derecha de dir
    spacing: 121,
    range: [-9, 3],
    names: {
      3: 'C. Ures', 2: 'San Luis', 1: 'Zacatecas', 0: 'Av. México', [-1]: 'Veracruz', [-2]: 'Puebla',
      [-3]: 'Querétaro', [-4]: 'Oaxaca', [-5]: 'León', [-6]: 'Mazatlán', [-7]: 'Ejido', [-8]: 'Construcción', [-9]: 'Trabajo',
    },
    major: [0],
  },
  {
    // Calles "oriente-poniente" (paralelas a Av. Ignacio Allende). k > 0 hacia el norte.
    through: px([1200, 805]),
    dir: [1080, 540], // apuntando al oriente
    side: 'left', // k > 0 queda a la izquierda de dir (norte)
    spacing: 93,
    range: [-6, 11],
    names: {
      11: 'Av. Guadalupe Victoria', 10: 'Ignacio López Rayón', 9: 'Pedraza', 8: 'Zaragoza', 7: 'Morelos',
      6: 'Hidalgo', 5: 'Zapata', 4: 'Amado Nervo', 3: 'Lerdo de Tejada', 2: 'Bravo', 1: 'Mina',
      0: 'Av. Ignacio Allende', [-1]: 'Miñón', [-2]: 'Abasolo', [-3]: 'Juárez', [-4]: 'Durango', [-5]: 'Nayarit', [-6]: 'Sinaloa',
    },
    major: [0, 11],
  },
];

// Avenidas que no siguen la cuadrícula. Todas de doble sentido.
export const AVENUES = [
  {
    name: 'Libramiento a Mazatlán (Fed. 15)', width: 18,
    path: pts([[430, 520], [530, 610], [650, 680], [720, 722], [770, 772], [820, 850], [870, 948], [920, 998], [1000, 1020], [1150, 1060], [1300, 1110], [1420, 1170], [1480, 1250]]),
  },
  {
    name: 'Av. Paseo de la Loma', width: 12,
    path: pts([[838, 880], [800, 960], [785, 1050], [795, 1150], [850, 1198], [1000, 1205], [1130, 1185], [1220, 1150], [1310, 1105]]),
  },
  {
    name: 'Av. Jacarandas', width: 12,
    path: pts([[742, 572], [720, 610], [690, 700], [655, 800], [625, 920], [600, 1060], [590, 1200]]),
  },
];

// Punto de salida: Av. México, junto a la plaza, hacia el norte.
export const SPAWN = { road: 'Av. México', at: px([1360, 560]), toward: px([1440, 330]) };

export const LANDMARKS = {
  cathedral: px([1285, 625]),
};

export const STREET_WIDTH = 9; // calles del centro: angostas
export const AVENUE_WIDTH = 14;
