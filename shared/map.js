// de_dunas — mapa original estilo "defusal" (3 carriles, 2 zonas de bomba).
// Ejes: x = este, z = sur (lado T), y = arriba. Unidades en metros.

export const MAP_NAME = 'de_dunas';
export const MAP_HALF = 60;

export const BOXES = [];

function box(x1, z1, x2, z2, h, y0 = 0, mat = 'wall') {
  BOXES.push({
    min: [Math.min(x1, x2), y0, Math.min(z1, z2)],
    max: [Math.max(x1, x2), y0 + h, Math.max(z1, z2)],
    mat,
  });
}

// Muros exteriores
box(-62, -62, 62, -60, 10, 0, 'outer');
box(-62, 60, 62, 62, 10, 0, 'outer');
box(-62, -60, -60, 60, 10, 0, 'outer');
box(60, -60, 62, 60, 10, 0, 'outer');

// Bloque izquierdo (entre carril B y medio) con túnel
box(-44, -25, -8, 8, 7);
box(-44, 13, -8, 25, 7);
box(-44, 8, -8, 13, 3, 4, 'wall'); // techo del túnel

// Bloque derecho (entre medio y carril A largo) con conector "corto"
box(8, -25, 42, -18, 7);
box(8, -13, 42, 25, 7);

// Puertas de medio
box(-8, -25, -2.5, -23, 7);
box(2.5, -25, 8, -23, 7);

// Puertas de A largo
box(42, 24, 48, 26, 7);
box(54, 24, 60, 26, 7);

// Entrada B
box(-60, 24, -56, 26, 7);
box(-50, 24, -44, 26, 7);

// Estructuras zona CT
box(-24, -44, -16, -36, 6);
box(16, -44, 24, -36, 6);

// Sitio A
box(36, -46, 39, -43, 2, 0, 'crate');
box(44, -38, 46, -36, 1, 0, 'crate');
box(46, -50, 50, -47, 1.8, 0, 'crate');
box(50, -58, 58, -52, 0.9, 0, 'crate');

// Sitio B
box(-40, -46, -36, -42, 2, 0, 'crate');
box(-48, -38, -45, -35, 1, 0, 'crate');
box(-54, -50, -50, -46, 2.5, 0, 'crate');
box(-35, -56, -30, -53, 1.2, 0, 'crate');

// Coberturas A largo
box(55, 12, 58, 15, 1, 0, 'crate');
box(48, 0, 52, 4, 1.5, 0, 'crate');
box(54, -15, 58, -11, 2, 0, 'crate');

// Coberturas carril B
box(-56, -5, -52, -1, 1.6, 0, 'crate');
box(-50, 12, -47, 15, 1, 0, 'crate');

// Medio
box(-3, -5, 3, -2, 1.4, 0, 'crate');
box(4, 10, 7, 13, 2, 0, 'crate');

// Zona T
box(-20, 32, -14, 36, 2.4, 0, 'crate');
box(14, 30, 20, 34, 2.4, 0, 'crate');
box(-4, 40, 4, 42, 1.2, 0, 'crate');
box(30, 35, 32, 37, 1.2, 0, 'barrel');
box(-36, 46, -34, 48, 1.2, 0, 'barrel');

export const SITES = {
  A: { x1: 33, x2: 59, z1: -59, z2: -29, cx: 46, cz: -44 },
  B: { x1: -59, x2: -33, z1: -59, z2: -29, cx: -46, cz: -44 },
};

export function siteAt(x, z) {
  for (const k in SITES) {
    const s = SITES[k];
    if (x >= s.x1 && x <= s.x2 && z >= s.z1 && z <= s.z2) return k;
  }
  return null;
}

export const SPAWNS = {
  T: [[-6, 50], [-3, 53], [0, 50], [3, 53], [6, 50], [-6, 56], [-3, 57], [0, 55], [3, 57], [6, 56]],
  CT: [[-6, -52], [-3, -55], [0, -52], [3, -55], [6, -52], [-6, -57], [-3, -58], [0, -56], [3, -58], [6, -57]],
};
export const SPAWN_CENTER = { T: [0, 53], CT: [0, -55] };
export const BUY_RADIUS = 16;

// Waypoints para la navegación de los bots: [x, z, etiqueta]
export const WAYPOINTS = [
  [0, 50, 'tspawn'], [-15, 45, 't'], [15, 45, 't'], [-30, 40, 't'], [30, 40, 't'], [-53, 36, 't'], [51, 36, 't'],
  [-53, 25, 'blane'], [-52, 17, 'blane'], [-52, 6, 'blane'], [-48, -3, 'blane'], [-50, -14, 'blane'], [-50, -26, 'blane'],
  [-40, 10.5, 'tunnel'], [-26, 10.5, 'tunnel'], [-12, 10.5, 'tunnel'],
  [0, 30, 'mid'], [0, 20, 'mid'], [-3, 10, 'mid'], [-5.5, -3.5, 'mid'], [5.5, -3.5, 'mid'], [0, -12, 'mid'], [0, -24, 'mid'],
  [4, -15.5, 'short'], [14, -15.5, 'short'], [26, -15.5, 'short'], [38, -15.5, 'short'],
  [51, 25, 'long'], [45, 14, 'long'], [45, 4, 'long'], [49, -6, 'long'], [48, -18, 'long'], [48, -27, 'long'],
  [40, -33, 'A'], [42, -40, 'A'], [52, -42, 'A'], [41, -52, 'A'], [54, -34, 'A'],
  [-42, -33, 'B'], [-44, -48, 'B'], [-50, -40, 'B'], [-38, -52, 'B'], [-56, -56, 'B'],
  [0, -32, 'ct'], [0, -42, 'ct'], [0, -52, 'ctspawn'], [-12, -48, 'ct'], [12, -48, 'ct'],
  [-12, -31, 'ct'], [12, -31, 'ct'], [-28, -48, 'ct'], [28, -48, 'ct'], [-28, -30, 'ct'], [28, -30, 'ct'],
];
