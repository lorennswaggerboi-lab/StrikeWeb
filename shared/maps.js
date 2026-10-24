// Mapas definidos sobre una cuadrícula (cada celda = 2 m). Se parte de un bloque macizo
// y se "excavan" rectángulos: así los mapas son cerrados, con pasillos, túneles, varios
// niveles, puertas y bordes bajos desde los que se ve el exterior.
//
// Caracteres de celda:
//   #  edificio/muro       %  muro alternativo        ' ' exterior (no transitable)
//   .  suelo   A/B sitio de bomba   T/X spawn T / CT
//   =  suelo bajo techo (el techo es una losa a 3,5-4 m que se puede pisar desde arriba)
//   1-8  plataforma/escalón de altura n × 0,5 m (escaleras = celdas consecutivas 1,2,3…)
//   l  muro bajo de borde (1,4 m) con valla invisible: se ve el exterior
//   v  ventana (muro con hueco entre 1,1 y 2,5 m)
//   P  puerta doble abierta estilo Dust 2 (pasable, con dintel)
//   D  puerta corredera estilo Nuke (se abre/cierra con E)
//   c  caja 1 m   C  caja 2 m   K  contenedor 2,6 m   w  murete 1,3 m   b  barril 1,2 m
// x = (columna - ancho/2) * CELL, z = (fila - alto/2) * CELL. Las filas pequeñas (z−) son el lado CT.

export const CELL = 2;
const ROOF_Y = 3.5, ROOF_TOP = 4.0, LINTEL_Y = 3.2, DOOR_H = 3.2;

const SOLID = {
  '#': { h: null, mat: 'wall' },
  '%': { h: null, mat: 'wall2' },
  'c': { h: 1.0, mat: 'crate' },
  'C': { h: 2.0, mat: 'crate' },
  'K': { h: 2.6, mat: 'container' },
  'w': { h: 1.3, mat: 'lowwall' },
  'b': { h: 1.2, mat: 'barrel' },
  'l': { h: 1.4, mat: 'lowwall' },
};
for (let d = 1; d <= 8; d++) SOLID[String(d)] = { h: d * 0.5, mat: d <= 2 ? 'step' : 'platform' };
const WALK_H = { '.': 0, 'A': 0, 'B': 0, 'T': 0, 'X': 0, '=': 0, 'P': 0, 'D': 0 };
for (let d = 1; d <= 8; d++) WALK_H[String(d)] = d * 0.5;

const DEFS = {
  de_dunas: {
    title: 'Dunas', theme: 'desert', w: 60, h: 60, wallH: 7,
    desc: 'Clásico de desierto: A largo, A corto, medio y túneles hacia B.',
    ops: [
      [24, 35, 2, 8, 'X'],
      [3, 17, 3, 15, 'B'],
      [40, 56, 3, 15, 'A'],
      [15, 24, 4, 7, '.'], [19, 19, 4, 5, '#'], [19, 19, 6, 7, '='],
      [36, 39, 4, 8, '.'],
      [27, 32, 9, 14, '.'],
      [27, 32, 15, 40, '.'],
      [27, 28, 22, 22, '#'], [31, 32, 22, 22, '#'], [29, 30, 22, 22, '='],
      [27, 30, 38, 40, '#'], [27, 30, 12, 13, '#'],
      [18, 26, 11, 13, '.'],
      [37, 42, 16, 27, '.'], [37, 42, 16, 16, '1'], [37, 42, 17, 20, '2'], [37, 42, 21, 21, '1'],
      [33, 36, 24, 27, '.'],
      [51, 56, 16, 44, '.'], [51, 52, 36, 36, '#'], [55, 56, 36, 36, '#'], [53, 54, 36, 36, '='],
      [36, 56, 45, 49, '.'],
      [20, 39, 48, 56, 'T'],
      [26, 33, 41, 47, '.'],
      [8, 19, 50, 55, '.'],
      [6, 11, 22, 49, '='],
      [6, 11, 16, 21, '.'],
      [12, 26, 33, 35, '='],
      [3, 5, 3, 5, '2'], [3, 5, 6, 6, '1'],
      // detalles
      [8, 9, 6, 7, 'C'], [12, 12, 10, 10, 'c'], [4, 5, 12, 13, 'C'], [15, 16, 13, 13, 'c'], [13, 14, 7, 8, '#'], [8, 11, 10, 10, 'w'],
      [44, 45, 8, 9, 'C'], [49, 49, 5, 5, 'c'], [53, 54, 11, 12, 'C'], [47, 48, 13, 13, 'c'], [46, 48, 3, 3, 'w'],
      [55, 56, 30, 30, 'c'], [51, 52, 24, 25, 'C'], [55, 56, 41, 41, 'b'],
      [29, 30, 30, 31, 'C'], [27, 27, 18, 18, 'c'], [32, 32, 37, 37, 'b'],
      [24, 25, 51, 52, 'C'], [34, 35, 50, 50, 'c'], [30, 31, 54, 55, 'C'],
      [26, 27, 3, 3, 'c'], [33, 34, 6, 7, 'C'],
      [44, 45, 46, 46, 'c'], [10, 10, 52, 53, 'b'],
    ],
    routes: { A: [[53, 30], [39, 25]], B: [[8, 36], [22, 12]] },
    extra: [
      // A corto: pasarela elevada a 2 m con escaleras desde medio y hacia el sitio
      [33, 33, 24, 27, '1'], [34, 34, 24, 27, '2'], [35, 35, 24, 27, '3'], [36, 36, 24, 27, '4'],
      [37, 42, 16, 16, '1'], [37, 42, 17, 17, '2'], [37, 42, 18, 18, '3'], [37, 42, 19, 27, '4'],
      // plataformas en los sitios
      [53, 56, 3, 5, '3'], [53, 56, 6, 6, '2'], [53, 56, 7, 7, '1'],
      [3, 5, 3, 4, '3'], [3, 5, 5, 5, '2'], [3, 5, 6, 6, '1'],
      // puertas dobles de medio (con ventana a un lado), de A largo y de la entrada a túneles
      [29, 30, 22, 22, 'P'], [27, 28, 22, 22, 'v'],
      [53, 54, 36, 36, 'P'],
      [6, 7, 21, 21, '#'], [10, 11, 21, 21, '#'], [8, 9, 21, 21, 'P'],
      // puerta corredera entre CT y B, con ventana
      [19, 19, 6, 7, 'D'], [19, 19, 4, 5, 'v'],
    ],
    views: [[57, 59, 2, 49], [18, 41, 57, 59], [0, 2, 2, 16], [2, 19, 0, 2], [22, 37, 0, 1]],

  },

  de_almacen: {
    title: 'Almacén', theme: 'industrial', w: 44, h: 44, wallH: 8,
    desc: 'Nave industrial compacta con contenedores y sitios cubiertos.',
    ops: [
      [16, 27, 36, 41, 'T'],
      [16, 27, 2, 6, 'X'],
      [31, 40, 3, 13, 'A'],
      [3, 12, 3, 13, 'B'],
      [19, 24, 7, 31, '.'],
      [24, 38, 32, 35, '.'], [19, 21, 29, 31, '#'], [21, 24, 7, 8, '#'], [19, 20, 10, 11, 'K'],
      [33, 38, 14, 31, '.'],
      [5, 15, 36, 39, '.'],
      [5, 10, 14, 35, '='],
      [25, 30, 10, 12, '.'],
      [11, 18, 18, 20, '='],
      [28, 30, 3, 5, '.'],
      [13, 15, 3, 5, '.'],
      [21, 22, 12, 15, 'K'], [20, 21, 22, 25, 'K'], [23, 24, 27, 28, 'c'],
      [36, 37, 8, 10, 'K'], [33, 33, 11, 11, 'c'], [39, 40, 3, 4, 'C'],
      [5, 6, 7, 9, 'K'], [10, 10, 5, 5, 'c'], [8, 9, 11, 11, 'C'],
      [35, 35, 20, 20, 'c'], [37, 38, 27, 28, 'C'], [8, 8, 25, 25, 'c'],
      [18, 19, 38, 39, 'C'], [26, 27, 33, 33, 'b'], [12, 12, 37, 38, 'K'],
    ],
    roofs: [[31, 35, 3, 7], [3, 7, 3, 7], [16, 27, 2, 3]],
    routes: { A: [[35, 24], [27, 11]], B: [[7, 26], [15, 19]] },
    extra: [
      // entreplantas metálicas en los sitios
      [39, 40, 8, 13, '4'], [39, 40, 7, 7, '3'], [39, 40, 6, 6, '2'], [39, 40, 5, 5, '1'],
      [3, 4, 8, 13, '4'], [3, 4, 7, 7, '3'], [3, 4, 6, 6, '2'], [3, 4, 5, 5, '1'],
      // puertas correderas industriales
      [15, 15, 18, 20, 'D'], [29, 29, 3, 5, 'D'],
      // portón de la entrada a B
      [5, 6, 35, 35, '#'], [9, 10, 35, 35, '#'], [7, 8, 35, 35, 'P'],
    ],
    views: [[14, 29, 42, 43], [41, 43, 2, 14], [0, 2, 2, 14], [3, 16, 40, 43]],

  },

  de_pueblo: {
    title: 'Pueblo', theme: 'village', w: 56, h: 56, wallH: 7,
    desc: 'Callejuelas estrechas, una plaza central y pasajes techados.',
    ops: [
      [4, 15, 44, 52, 'T'],
      [40, 51, 3, 10, 'X'],
      [40, 52, 22, 32, 'A'],
      [8, 20, 4, 14, 'B'],
      [16, 35, 46, 49, '.'],
      [32, 35, 28, 45, '.'],
      [22, 33, 22, 31, '.'],
      [10, 13, 30, 43, '.'],
      [14, 21, 30, 33, '='],
      [16, 21, 22, 25, '.'],
      [16, 19, 15, 21, '.'],
      [34, 39, 24, 27, '.'],
      [36, 39, 28, 31, '='],
      [4, 7, 4, 43, '.'], [4, 7, 20, 27, '='],
      [44, 47, 11, 21, '.'],
      [21, 39, 5, 8, '.'], [30, 33, 5, 8, '='],
      [28, 31, 9, 21, '='],
      [27, 28, 26, 27, 'C'], [11, 12, 7, 8, 'C'], [17, 17, 11, 11, 'c'], [14, 15, 4, 4, 'w'],
      [45, 46, 25, 26, 'C'], [50, 50, 30, 31, 'c'], [50, 52, 22, 24, '2'], [50, 52, 25, 25, '1'],
      [8, 9, 47, 48, 'C'], [33, 33, 40, 40, 'c'], [6, 6, 34, 34, 'b'], [17, 18, 47, 48, 'C'], [24, 24, 29, 29, 'b'],
      [42, 43, 5, 6, 'c'], [10, 10, 25, 25, 'w'],
    ],
    routes: { A: [[33, 42], [36, 25]], B: [[5, 25], [17, 18]] },
    extra: [
      // balcón en A y terraza en la plaza
      [50, 52, 22, 23, '4'], [50, 52, 24, 24, '3'], [50, 52, 25, 25, '2'], [50, 52, 26, 26, '1'],
      [22, 24, 22, 23, '2'], [22, 24, 24, 24, '1'],
      // arco con puertas hacia A y puerta corredera hacia B
      [38, 38, 28, 28, '#'], [38, 38, 31, 31, '#'], [38, 38, 29, 30, 'P'],
      [16, 16, 18, 18, '#'], [19, 19, 18, 18, '#'], [17, 18, 18, 18, 'D'],
    ],
    views: [[0, 3, 3, 43], [38, 53, 0, 2], [53, 55, 21, 33], [3, 16, 53, 55]],

  },

  de_puerto: {
    title: 'Puerto', theme: 'docks', w: 60, h: 56, wallH: 8,
    desc: 'Muelle de carga lleno de contenedores apilados.',
    ops: [
      [24, 35, 46, 52, 'T'],
      [24, 35, 3, 8, 'X'],
      [44, 56, 6, 18, 'A'],
      [3, 15, 6, 18, 'B'],
      [6, 53, 22, 41, '.'],
      [26, 33, 42, 45, '.'],
      [6, 23, 44, 47, '.'], [6, 9, 42, 43, '.'],
      [36, 53, 44, 47, '.'], [50, 53, 42, 43, '.'],
      [6, 11, 19, 21, '.'], [48, 53, 19, 21, '.'],
      [36, 43, 4, 7, '.'], [16, 23, 4, 7, '.'],
      [28, 31, 9, 21, '='],
      [10, 15, 25, 26, 'K'], [10, 15, 31, 32, 'K'], [10, 15, 37, 38, 'K'],
      [20, 21, 23, 29, 'K'], [20, 21, 33, 40, 'K'],
      [26, 33, 26, 27, 'K'], [25, 34, 30, 32, '#'], [26, 33, 36, 37, 'K'],
      [38, 39, 23, 29, 'K'], [38, 39, 33, 40, 'K'],
      [44, 49, 25, 26, 'K'], [44, 49, 31, 32, 'K'], [44, 49, 37, 38, 'K'],
      [6, 8, 9, 10, 'K'], [12, 13, 14, 15, 'C'], [4, 4, 16, 16, 'c'],
      [50, 52, 9, 10, 'K'], [46, 47, 14, 15, 'C'], [55, 55, 16, 16, 'c'],
      [16, 17, 28, 28, 'c'], [42, 43, 34, 34, 'c'], [30, 30, 41, 41, 'b'], [25, 25, 5, 5, 'b'],
    ],
    routes: { A: [[51, 43], [42, 30]], B: [[7, 43], [17, 31]] },
    extra: [
      // pasarelas elevadas a 2,5 m a ambos lados del patio de contenedores
      [6, 7, 24, 36, '5'], [6, 7, 23, 23, '4'], [6, 7, 22, 22, '3'], [6, 7, 37, 37, '4'], [6, 7, 38, 38, '3'], [6, 7, 39, 39, '2'], [6, 7, 40, 40, '1'],
      [52, 53, 24, 36, '5'], [52, 53, 23, 23, '4'], [52, 53, 22, 22, '3'], [52, 53, 37, 37, '4'], [52, 53, 38, 38, '3'], [52, 53, 39, 39, '2'], [52, 53, 40, 40, '1'],
      // puertas correderas de los almacenes CT
      [20, 20, 4, 7, 'D'], [39, 39, 4, 7, 'D'],
    ],
    views: [[0, 5, 4, 47], [54, 59, 4, 47], [22, 37, 53, 55]],

  },

  de_templo: {
    title: 'Templo', theme: 'temple', w: 52, h: 52, wallH: 8,
    desc: 'Templo antiguo con columnatas, patio central y plataformas.',
    ops: [
      [20, 31, 44, 49, 'T'],
      [20, 31, 3, 7, 'X'],
      [35, 47, 8, 19, 'A'],
      [4, 16, 8, 19, 'B'],
      [19, 32, 20, 32, '.'],
      [21, 21, 22, 22, '#'], [30, 30, 22, 22, '#'], [21, 21, 30, 30, '#'], [30, 30, 30, 30, '#'],
      [23, 28, 24, 28, '1'], [24, 27, 25, 27, '#'],
      [28, 31, 33, 43, '='],
      [32, 45, 40, 43, '.'], [42, 45, 20, 39, '.'], [33, 41, 26, 28, '='],
      [6, 19, 40, 43, '.'], [6, 9, 20, 39, '.'], [10, 18, 26, 28, '='],
      [20, 23, 8, 19, '.'],
      [32, 34, 4, 6, '.'], [17, 19, 4, 6, '.'],
      [40, 44, 10, 13, '2'], [40, 44, 14, 14, '1'], [37, 37, 16, 16, '#'],
      [8, 12, 10, 13, '2'], [8, 12, 14, 14, '1'], [14, 14, 16, 16, '#'],
      [45, 46, 17, 18, 'C'], [5, 6, 17, 18, 'C'], [43, 43, 33, 33, 'c'], [7, 7, 33, 33, 'c'],
      [22, 23, 46, 47, 'C'], [25, 25, 45, 45, 'c'], [21, 22, 12, 13, 'w'],
    ],
    routes: { A: [[43, 30], [37, 27]], B: [[7, 30], [14, 27]] },
    extra: [
      // altares elevados a 2 m en los sitios
      [8, 12, 10, 11, '4'], [8, 12, 12, 12, '3'], [8, 12, 13, 13, '2'], [8, 12, 14, 14, '1'],
      [40, 44, 10, 11, '4'], [40, 44, 12, 12, '3'], [40, 44, 13, 13, '2'], [40, 44, 14, 14, '1'],
      // puertas dobles hacia CT y puertas correderas de piedra a las galerías
      [20, 20, 19, 19, '#'], [23, 23, 19, 19, '#'], [21, 22, 19, 19, 'P'],
      [37, 37, 26, 28, 'D'], [14, 14, 26, 28, 'D'],
    ],
    views: [[0, 3, 8, 43], [48, 51, 8, 43], [18, 33, 50, 51], [18, 33, 0, 2]],

  },
};

export const MAP_IDS = Object.keys(DEFS);

function mergeRects(w, h, test) {
  const used = new Array(w * h).fill(false);
  const out = [];
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const key = test(x, z);
      if (key === null || used[z * w + x]) continue;
      let x2 = x;
      while (x2 + 1 < w && !used[z * w + x2 + 1] && test(x2 + 1, z) === key) x2++;
      let z2 = z;
      outer: while (z2 + 1 < h) {
        for (let xx = x; xx <= x2; xx++) if (used[(z2 + 1) * w + xx] || test(xx, z2 + 1) !== key) break outer;
        z2++;
      }
      for (let zz = z; zz <= z2; zz++) for (let xx = x; xx <= x2; xx++) used[zz * w + xx] = true;
      out.push({ x, z, x2, z2, key });
    }
  }
  return out;
}

function buildMap(id, def) {
  const { w, h } = def;
  const rows = [];
  for (let z = 0; z < h; z++) rows.push(new Array(w).fill('#'));
  for (const [x0, x1, z0, z1, ch] of [...def.ops, ...(def.extra || [])]) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) rows[z][x] = ch;
  }
  const walkable = ch => WALK_H[ch] !== undefined;
  // bordes abiertos: el muro pegado a zona jugable se vuelve muro bajo; el resto, exterior
  for (const [x0, x1, z0, z1] of def.views || []) {
    const mark = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (rows[z][x] !== '#' && rows[z][x] !== '%') continue;
      let near = false;
      for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) {
        const r = rows[z + dz];
        if (r && r[x + dx] !== undefined && (walkable(r[x + dx]) || 'cCKwb'.includes(r[x + dx]))) { near = true; break; }
      }
      mark.push([x, z, near ? 'l' : ' ']);
    }
    for (const [x, z, ch] of mark) rows[z][x] = ch;
  }
  // los muros cercanos al lado CT usan el material alternativo
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (rows[z][x] === '#' && z < h * 0.3) rows[z][x] = '%';
  const grid = rows.map(r => r.join(''));
  const toX = cx => (cx - w / 2) * CELL;
  const toZ = cz => (cz - h / 2) * CELL;
  const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? '#' : grid[z][x]);

  const boxes = [], clips = [];
  const push = (r, y0, y1, mat, extra = {}) => boxes.push({ min: [toX(r.x), y0, toZ(r.z)], max: [toX(r.x2 + 1), y1, toZ(r.z2 + 1)], mat, seed: (r.x * 31 + r.z * 17) % 97, ...extra });
  for (const r of mergeRects(w, h, (x, z) => (SOLID[at(x, z)] ? at(x, z) : null))) {
    const s = SOLID[r.key];
    let top = s.h ?? def.wallH;
    // edificios de alturas variadas para que el horizonte no sea plano
    if (s.h === null) top = def.wallH + ((r.x * 7 + r.z * 13) % 4) * 0.9;
    push(r, 0, top, s.mat, { kind: r.key });
    if (r.key === 'l') clips.push({ min: [toX(r.x), 0, toZ(r.z)], max: [toX(r.x2 + 1), 14, toZ(r.z2 + 1)], mat: 'clip' });
  }
  // ventanas: antepecho + dintel
  for (const r of mergeRects(w, h, (x, z) => (at(x, z) === 'v' ? 'v' : null))) {
    push(r, 0, 1.1, 'wall', { kind: 'sill' });
    push(r, 2.5, def.wallH, 'wall', { kind: 'lintel' });
  }
  // techos (losas pisables) y dinteles de puertas
  const roofCells = (x, z) => at(x, z) === '=' || (def.roofs || []).some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  for (const r of mergeRects(w, h, (x, z) => (roofCells(x, z) && walkable(at(x, z)) ? 'r' : null))) push(r, ROOF_Y, ROOF_TOP, 'ceiling');
  for (const r of mergeRects(w, h, (x, z) => (at(x, z) === 'P' || at(x, z) === 'D' ? 'd' : null))) push(r, LINTEL_Y, def.wallH, 'wall', { kind: 'lintel' });

  // puertas correderas: grupos de celdas 'D'
  const doors = [];
  for (const r of mergeRects(w, h, (x, z) => (at(x, z) === 'D' ? 'D' : null))) {
    const alongX = r.x2 - r.x >= r.z2 - r.z ? (!walkable(at(r.x - 1, r.z)) || !walkable(at(r.x2 + 1, r.z))) : false;
    const x0 = toX(r.x), x1 = toX(r.x2 + 1), z0 = toZ(r.z), z1 = toZ(r.z2 + 1);
    let min, max, axis, len, dir;
    if (alongX) {
      const cz = (z0 + z1) / 2;
      min = [x0, 0, cz - 0.12]; max = [x1, DOOR_H, cz + 0.12]; axis = 0; len = x1 - x0;
      dir = SOLID[at(r.x2 + 1, r.z)] ? 1 : -1;
    } else {
      const cx = (x0 + x1) / 2;
      min = [cx - 0.12, 0, z0]; max = [cx + 0.12, DOOR_H, z1]; axis = 2; len = z1 - z0;
      dir = SOLID[at(r.x, r.z2 + 1)] ? 1 : -1;
    }
    doors.push({ id: doors.length, min, max, axis, len, dir });
  }
  // puertas dobles abiertas (decorativas): bisagras a cada lado del hueco
  // Las hojas quedan abiertas pegadas a la pared del lado hacia el que abren (no estorban el paso).
  const swingDoors = [];
  for (const r of mergeRects(w, h, (x, z) => (at(x, z) === 'P' ? 'P' : null))) {
    const alongX = r.x2 - r.x >= r.z2 - r.z && !walkable(at(r.x - 1, r.z));
    const x0 = toX(r.x), x1 = toX(r.x2 + 1), z0 = toZ(r.z), z1 = toZ(r.z2 + 1);
    const T = 0.12;
    let panels;
    if (alongX) {
      const side = walkable(at(r.x, r.z2 + 1)) ? 1 : -1;
      const line = side > 0 ? z1 : z0;
      const len = Math.min(2, (x1 - x0) / 2);
      panels = [
        { min: [x0 - len, 0.02, Math.min(line, line + side * T)], max: [x0, DOOR_H - 0.1, Math.max(line, line + side * T)], hinge: [x0, line], dir: [-1, 0], side },
        { min: [x1, 0.02, Math.min(line, line + side * T)], max: [x1 + len, DOOR_H - 0.1, Math.max(line, line + side * T)], hinge: [x1, line], dir: [1, 0], side },
      ];
    } else {
      const side = walkable(at(r.x2 + 1, r.z)) ? 1 : -1;
      const line = side > 0 ? x1 : x0;
      const len = Math.min(2, (z1 - z0) / 2);
      panels = [
        { min: [Math.min(line, line + side * T), 0.02, z0 - len], max: [Math.max(line, line + side * T), DOOR_H - 0.1, z0], hinge: [line, z0], dir: [0, -1], side },
        { min: [Math.min(line, line + side * T), 0.02, z1], max: [Math.max(line, line + side * T), DOOR_H - 0.1, z1 + len], hinge: [line, z1], dir: [0, 1], side },
      ];
    }
    for (const pnl of panels) boxes.push({ min: pnl.min, max: pnl.max, mat: 'woodpanel', kind: 'swing', seed: 0 });
    swingDoors.push({ x0, x1, z0, z1, alongX, h: DOOR_H, panels });
  }

  const sites = {};
  const spawnCells = { T: [], CT: [] };
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[z][x];
      if (ch === 'A' || ch === 'B') (sites[ch] ||= { cells: [] }).cells.push([x, z]);
      if (ch === 'T') spawnCells.T.push([x, z]);
      if (ch === 'X') spawnCells.CT.push([x, z]);
    }
  }
  for (const k in sites) {
    const s = sites[k];
    let sx = 0, sz = 0;
    s.x1 = Infinity; s.x2 = -Infinity; s.z1 = Infinity; s.z2 = -Infinity;
    for (const [x, z] of s.cells) {
      sx += x; sz += z;
      s.x1 = Math.min(s.x1, toX(x)); s.x2 = Math.max(s.x2, toX(x + 1));
      s.z1 = Math.min(s.z1, toZ(z)); s.z2 = Math.max(s.z2, toZ(z + 1));
    }
    s.cx = toX(sx / s.cells.length + 0.5);
    s.cz = toZ(sz / s.cells.length + 0.5);
    s.points = s.cells.map(([x, z]) => [toX(x + 0.5), toZ(z + 0.5)]);
  }
  const spawns = {}, spawnCenter = {};
  for (const team of ['T', 'CT']) {
    const cells = spawnCells[team];
    const mx = cells.reduce((a, c) => a + c[0], 0) / cells.length;
    const mz = cells.reduce((a, c) => a + c[1], 0) / cells.length;
    spawnCenter[team] = [toX(mx + 0.5), toZ(mz + 0.5)];
    const sorted = [...cells].sort((a, b) => Math.hypot(a[0] - mx, a[1] - mz) - Math.hypot(b[0] - mx, b[1] - mz));
    const spaced = sorted.filter(([x, z]) => (x + z) % 2 === 0);
    spawns[team] = (spaced.length >= 10 ? spaced : sorted).slice(0, 10).map(([x, z]) => [toX(x + 0.5), toZ(z + 0.5)]);
  }
  const routes = {};
  for (const k in def.routes) routes[k] = def.routes[k].map(([x, z]) => [toX(x + 0.5), toZ(z + 0.5)]);

  return {
    id, title: def.title, theme: def.theme, desc: def.desc, w, h, cell: CELL, wallH: def.wallH,
    grid, boxes, clips, doors, swingDoors, sites, spawns, spawnCenter, routes, outside: def.outside || 'all',
    half: { x: (w / 2) * CELL, z: (h / 2) * CELL },
    toX, toZ,
    cellOf(x, z) { return [Math.floor(x / CELL + w / 2), Math.floor(z / CELL + h / 2)]; },
    charAt(x, z) {
      const [cx, cz] = this.cellOf(x, z);
      if (cx < 0 || cz < 0 || cx >= w || cz >= h) return '#';
      return grid[cz][cx];
    },
    walkHeight(cx, cz) {
      if (cx < 0 || cz < 0 || cx >= w || cz >= h) return null;
      const v = WALK_H[grid[cz][cx]];
      return v === undefined ? null : v;
    },
  };
}

// Caja de colisión actual de una puerta corredera según su apertura (0 cerrada, 1 abierta).
export function doorBox(d, open) {
  const off = d.len * 0.92 * open * d.dir;
  const min = [...d.min], max = [...d.max];
  min[d.axis] += off; max[d.axis] += off;
  return { min, max, mat: 'door', door: d.id };
}

const CACHE = {};
export function getMap(id) {
  if (!DEFS[id]) id = MAP_IDS[0];
  return (CACHE[id] ||= buildMap(id, DEFS[id]));
}

export function mapList() {
  return MAP_IDS.map(id => ({ id, title: DEFS[id].title, desc: DEFS[id].desc, theme: DEFS[id].theme }));
}

export function siteAt(map, x, z) {
  const ch = map.charAt(x, z);
  return ch === 'A' || ch === 'B' ? ch : null;
}

export const BUY_RADIUS = 14;
