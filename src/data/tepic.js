// Mapa del modo libre: centro de Tepic, Nayarit, con datos reales de
// OpenStreetMap (calles, sentidos, semáforos, parques, río y edificios).
// Los datos se generan con scripts/osm2tepic.mjs (ver data/tepic.osm.gz).
// Coordenadas en metros con origen en la Catedral (x = este, y = norte).
// Datos © OpenStreetMap contributors, ODbL 1.0.
import MAP from './tepicMap.js';

export { MAP };

const { minX, minY, maxX, maxY } = MAP.box;
// Límite del área jugable: el rectángulo descargado (con margen).
export const BOUNDARY = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];

// Parques y plazas: solo visuales; sin edificios.
export const PARKS = MAP.parks;

// Río Mololoa y cuerpos de agua (solo visual).
export const RIVERS = MAP.rivers.map((path) => ({ width: 18, path }));
export const WATER = MAP.water;

// Punto de salida: Av. México, junto a la Catedral, hacia el norte.
export const SPAWN = { road: /^Av\. México/, at: [40, 60], toward: [60, 400] };

export const LANDMARKS = {
  cathedral: MAP.cathedral,
};

export const ATTRIBUTION = '© OpenStreetMap contributors';
