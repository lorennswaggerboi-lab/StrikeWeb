// Mapas definidos sobre una cuadrícula (cada celda = 2 m). Se parte de un bloque macizo
// y se "excavan" rectángulos: así los mapas son cerrados, con pasillos, túneles y salas.
//
// Caracteres de celda:
//   #  muro        %  muro alternativo (otro material)
//   .  suelo       A/B  sitio de bomba   T/X  spawn T / CT
//   =  suelo con techo (túnel, pórtico)
//   1  escalón 0.5 m     2  plataforma 1 m
//   c  caja 1 m   C  caja 2 m   K  contenedor 2.6 m   w  murete 1.3 m   b  barril 1.2 m
// x = (columna - ancho/2) * CELL, z = (fila - alto/2) * CELL. Las filas pequeñas (z−) son el lado CT.

export const CELL = 2;

const SOLID = {
  '#': { h: null, mat: 'wall' },
  '%': { h: null, mat: 'wall2' },
  'c': { h: 1.0, mat: 'crate' },
  'C': { h: 2.0, mat: 'crate' },
  'K': { h: 2.6, mat: 'container' },
  'w': { h: 1.3, mat: 'lowwall' },
  'b': { h: 1.2, mat: 'barrel' },
  '1': { h: 0.5, mat: 'step' },
  '2': { h: 1.0, mat: 'step' },
};
const WALK_H = { '.': 0, 'A': 0, 'B': 0, 'T': 0, 'X': 0, '=': 0, '1': 0.5, '2': 1.0 };
const CEILING_Y = 3.4;

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
  },
};

export const MAP_IDS = Object.keys(DEFS);

function buildMap(id, def) {
  const { w, h } = def;
  const rows = [];
  for (let z = 0; z < h; z++) rows.push(new Array(w).fill('#'));
  for (const [x0, x1, z0, z1, ch] of def.ops) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) rows[z][x] = ch;
  }
  // los muros cercanos al lado CT usan el material alternativo
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (rows[z][x] === '#' && z < h * 0.3) rows[z][x] = '%';
  const grid = rows.map(r => r.join(''));
  const toX = cx => (cx - w / 2) * CELL;
  const toZ = cz => (cz - h / 2) * CELL;

  // fusión voraz de celdas iguales en cajas
  const boxes = [];
  const used = rows.map(r => r.map(() => false));
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[z][x];
      const s = SOLID[ch];
      if (!s || used[z][x]) continue;
      let x2 = x;
      while (x2 + 1 < w && grid[z][x2 + 1] === ch && !used[z][x2 + 1]) x2++;
      let z2 = z;
      outer: while (z2 + 1 < h) {
        for (let xx = x; xx <= x2; xx++) if (grid[z2 + 1][xx] !== ch || used[z2 + 1][xx]) break outer;
        z2++;
      }
      for (let zz = z; zz <= z2; zz++) for (let xx = x; xx <= x2; xx++) used[zz][xx] = true;
      const height = s.h ?? def.wallH;
      boxes.push({ min: [toX(x), 0, toZ(z)], max: [toX(x2 + 1), height, toZ(z2 + 1)], mat: s.mat, seed: (x * 31 + z * 17) % 97 });
    }
  }
  // techos de túneles y pórticos
  const roofCells = rows.map(r => r.map(ch => ch === '='));
  for (const [x0, x1, z0, z1] of def.roofs || []) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) roofCells[z][x] = true;
  const usedR = rows.map(r => r.map(() => false));
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      if (!roofCells[z][x] || usedR[z][x]) continue;
      let x2 = x;
      while (x2 + 1 < w && roofCells[z][x2 + 1] && !usedR[z][x2 + 1]) x2++;
      let z2 = z;
      outer2: while (z2 + 1 < h) {
        for (let xx = x; xx <= x2; xx++) if (!roofCells[z2 + 1][xx] || usedR[z2 + 1][xx]) break outer2;
        z2++;
      }
      for (let zz = z; zz <= z2; zz++) for (let xx = x; xx <= x2; xx++) usedR[zz][xx] = true;
      boxes.push({ min: [toX(x), CEILING_Y, toZ(z)], max: [toX(x2 + 1), def.wallH, toZ(z2 + 1)], mat: 'ceiling', seed: 0 });
    }
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
    grid, boxes, sites, spawns, spawnCenter, routes,
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
