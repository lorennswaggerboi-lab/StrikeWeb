// Grafo de navegación para bots, construido automáticamente a partir de los waypoints.
import { BOXES, WAYPOINTS } from '../shared/map.js';
import { raycast } from '../shared/physics.js';

export const NODES = WAYPOINTS.map(([x, z, tag], i) => ({ i, x, z, tag, edges: [] }));

export function clearPath(ax, az, bx, bz, width = 0.45) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return true;
  const d = [dx / len, 0, dz / len];
  const px = -d[2], pz = d[0];
  for (const off of [-width, 0, width]) {
    for (const h of [0.3, 1.2]) {
      if (raycast([ax + px * off, h, az + pz * off], d, len, BOXES)) return false;
    }
  }
  return true;
}

for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const a = NODES[i], b = NODES[j];
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (dist <= 24 && clearPath(a.x, a.z, b.x, b.z)) {
      a.edges.push({ to: j, cost: dist });
      b.edges.push({ to: i, cost: dist });
    }
  }
}

export function nearestNode(x, z, needLos = true) {
  let best = -1, bestD = Infinity;
  for (const n of NODES) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD && (!needLos || clearPath(x, z, n.x, n.z, 0.2))) { bestD = d; best = n.i; }
  }
  if (best < 0 && needLos) return nearestNode(x, z, false);
  return best;
}

export function findPath(from, to) {
  if (from < 0 || to < 0) return [];
  const n = NODES.length;
  const dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[from] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    if (u === to) break;
    done[u] = true;
    for (const e of NODES[u].edges) {
      // pequeño ruido para que los bots no sigan siempre la misma ruta exacta
      const c = dist[u] + e.cost * (0.9 + Math.random() * 0.2);
      if (c < dist[e.to]) { dist[e.to] = c; prev[e.to] = u; }
    }
  }
  if (from !== to && prev[to] < 0) return [];
  const path = [];
  for (let u = to; u >= 0; u = prev[u]) { path.push(u); if (u === from) break; }
  return path.reverse();
}

export function nodesWithTag(tag) {
  return NODES.filter(n => n.tag === tag);
}
