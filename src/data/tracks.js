// Pistas. Cada una tiene puntos de control (m, x = este, y = norte),
// en el sentido de carrera; el primer punto es la meta (en una recta).
// Nombres inspirados en lugares de Nayarit; el piso es plano.
import { OvalTrack, PathTrack } from '../track.js';

function lake(n = 16) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = 260 + 40 * Math.cos(3 * a) + 25 * Math.sin(2 * a);
    pts.push([1.25 * r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

export const TRACKS = [
  {
    id: 'ovalo',
    name: 'Óvalo',
    desc: 'Dos rectas largas y dos curvas amplias. Para aprender.',
    theme: { ground: 0x4f7a3a, sky: 0x9cc8e8, trees: 0 },
    build: () => new OvalTrack(),
  },
  {
    id: 'malecon',
    name: 'Malecón San Blas',
    desc: 'Recta larga junto al mar, horquilla y una zona revirada tierra adentro.',
    theme: { ground: 0xd9c08a, sky: 0xa8d8f0, trees: 60, treeColor: 0x2f7d3a, sea: true },
    build: () =>
      new PathTrack({
        width: 18,
        points: [[0, 0], [200, 0], [400, 0], [560, 0], [650, 40], [680, 130], [630, 210], [540, 230], [460, 200],
          [400, 240], [330, 290], [240, 290], [170, 240], [90, 250], [0, 290], [-110, 280], [-190, 210],
          [-200, 110], [-150, 30], [-80, 0]],
      }),
  },
  {
    id: 'sierra',
    name: 'Sierra de Álica',
    desc: 'Camino de montaña: curvas enlazadas y pocas rectas.',
    theme: { ground: 0x3f6b35, sky: 0xb7cfdc, trees: 220, treeColor: 0x24502a },
    build: () =>
      new PathTrack({
        width: 16,
        points: [[0, 0], [150, 0], [300, 0], [400, 30], [440, 110], [400, 190], [320, 210], [260, 260], [280, 350],
          [360, 390], [420, 460], [380, 540], [280, 560], [180, 520], [120, 440], [40, 420], [-40, 470],
          [-130, 450], [-170, 370], [-130, 290], [-60, 260], [-60, 180], [-140, 140], [-160, 60], [-100, 5]],
      }),
  },
  {
    id: 'laguna',
    name: 'Laguna Santa María',
    desc: 'Vuelta rápida alrededor de la laguna, con curvas abiertas.',
    theme: { ground: 0x5d8a45, sky: 0x9fd0ea, trees: 140, treeColor: 0x2e6b35, lake: true },
    build: () => new PathTrack({ width: 18, points: lake() }),
  },
  {
    id: 'cerro',
    name: 'Cerro de San Juan',
    desc: 'Técnica: horquillas cerradas donde frenar a tiempo gana carreras.',
    theme: { ground: 0x6d7f45, sky: 0xc4d6e0, trees: 160, treeColor: 0x3a5f2a },
    build: () =>
      new PathTrack({
        width: 16,
        points: [[0, 0], [180, 0], [320, 0], [400, 40], [410, 120], [340, 160], [200, 150], [120, 190], [130, 270],
          [220, 300], [360, 300], [440, 350], [430, 440], [330, 470], [150, 460], [0, 470], [-110, 430],
          [-150, 330], [-120, 230], [-170, 150], [-160, 60], [-90, 5]],
      }),
  },
  {
    id: 'puerto-roca',
    name: 'Puerto Roca',
    desc: 'Circuito urbano trazado del juego original: horquillas en S y una recta larga al sur.',
    theme: { ground: 0x6b6a5c, sky: 0xc9c2a6, trees: 70, treeColor: 0x4d5a32 },
    // Trazada sobre el mapa de Rockport de NFS: Most Wanted (2005), 8 m por píxel.
    build: () =>
      new PathTrack({
        width: 16,
        points: [[0, 0], [64, -80], [112, -160], [152, -256], [136, -336], [56, -368], [-16, -408], [-24, -480],
          [32, -520], [112, -488], [192, -464], [288, -464], [352, -392], [432, -344], [504, -376], [512, -448],
          [440, -520], [416, -632], [416, -792], [416, -968], [368, -1048], [240, -1072], [112, -1096], [80, -992],
          [64, -856], [0, -768], [-96, -720], [-208, -680], [-288, -608], [-336, -520], [-400, -456], [-496, -432],
          [-624, -440], [-720, -424], [-760, -352], [-808, -304], [-832, -192], [-872, -24], [-816, 48], [-768, 88],
          [-752, 168], [-728, 224], [-680, 224], [-656, 168], [-688, 104], [-680, 40], [-632, 16], [-592, 56],
          [-584, 128], [-544, 184], [-472, 192], [-400, 136], [-320, 72], [-224, 24], [-112, 8]],
      }),
  },
];
