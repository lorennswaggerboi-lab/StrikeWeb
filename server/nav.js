// Navegación de bots sobre la cuadrícula del mapa: A* en 8 direcciones respetando alturas,
// con suavizado de ruta por línea de visión y coste extra en zonas con fuego.
import { raycast } from '../shared/physics.js';

const SQRT2 = Math.SQRT2;

export class Nav {
  constructor(map) {
    this.map = map;
    this.w = map.w;
    this.h = map.h;
    this.heights = new Float32Array(this.w * this.h).fill(NaN);
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const v = map.walkHeight(x, z);
      if (v !== null) this.heights[z * this.w + x] = v;
    }
    this.danger = null;
  }

  walkable(x, z) {
    return x >= 0 && z >= 0 && x < this.w && z < this.h && !Number.isNaN(this.heights[z * this.w + x]);
  }

  canStep(ax, az, bx, bz) {
    if (!this.walkable(bx, bz)) return false;
    return this.heights[bz * this.w + bx] - this.heights[az * this.w + ax] <= 0.55;
  }

  nearestCell(x, z) {
    const [cx, cz] = this.map.cellOf(x, z);
    if (this.walkable(cx, cz)) return [cx, cz];
    for (let r = 1; r < 6; r++) {
      let best = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (!this.walkable(cx + dx, cz + dz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = [cx + dx, cz + dz]; }
      }
      if (best) return best;
    }
    return [cx, cz];
  }

  // fires: [{x,z,r}] -> celdas peligrosas
  setDanger(fires) {
    if (!fires.length) { this.danger = null; return; }
    this.danger = new Uint8Array(this.w * this.h);
    for (const f of fires) {
      const [cx, cz] = this.map.cellOf(f.x, f.z);
      const rc = Math.ceil(f.r / this.map.cell);
      for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x >= 0 && z >= 0 && x < this.w && z < this.h) this.danger[z * this.w + x] = 1;
      }
    }
  }

  findPath(sx, sz, tx, tz) {
    const [ax, az] = this.nearestCell(sx, sz);
    const [bx, bz] = this.nearestCell(tx, tz);
    const W = this.w, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const start = az * W + ax, goal = bz * W + bx;
    g[start] = 0;
    // montículo binario simple
    const heap = [[this.heur(ax, az, bx, bz), start]];
    const push = item => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    let iter = 0;
    while (heap.length && iter++ < 20000) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.canStep(cx, cz, nx, nz)) continue;
        if (dx && dz && (!this.canStep(cx, cz, cx + dx, cz) || !this.canStep(cx, cz, cx, cz + dz))) continue;
        const ni = nz * W + nx;
        let cost = dx && dz ? SQRT2 : 1;
        if (this.danger && this.danger[ni]) cost += 25;
        // preferir no pegarse a los muros
        if (!this.walkable(nx + 1, nz) || !this.walkable(nx - 1, nz) || !this.walkable(nx, nz + 1) || !this.walkable(nx, nz - 1)) cost += 0.3;
        cost *= 0.92 + Math.random() * 0.16;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; push([ng + this.heur(nx, nz, bx, bz), ni]); }
      }
    }
    if (prev[goal] < 0 && goal !== start) return [];
    const cells = [];
    for (let c = goal; c >= 0; c = prev[c]) { cells.push(c); if (c === start) break; }
    cells.reverse();
    const pts = cells.map(c => [this.map.toX((c % W) + 0.5), this.map.toZ(((c / W) | 0) + 0.5), this.heights[c]]);
    return this.smooth(pts);
  }

  heur(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  }

  clear(ax, az, bx, bz, width = 0.45) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    const d = [dx / len, 0, dz / len];
    const px = -d[2], pz = d[0];
    for (const off of [-width, 0, width]) for (const h of [0.3, 1.2]) {
      if (raycast([ax + px * off, h, az + pz * off], d, len, this.map.boxes)) return false;
    }
    return true;
  }

  smooth(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1) {
        const a = pts[i], b = pts[j];
        if (a[2] === b[2] && this.clear(a[0], a[1], b[0], b[1])) break;
        j--;
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}
