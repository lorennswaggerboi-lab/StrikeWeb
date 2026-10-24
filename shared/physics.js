// Física y trazado de rayos compartidos por cliente y servidor.

export const GRAVITY = 20;
export const JUMP_VELOCITY = 6.5;
export const STEP_HEIGHT = 0.55;
export const PLAYER_RADIUS = 0.4;
export const STAND_HEIGHT = 1.8;
export const CROUCH_HEIGHT = 1.25;
export const STAND_EYE = 1.64;
export const CROUCH_EYE = 1.12;

export const FLOOR = { mat: 'floor' };

export function eyeHeight(crouch) {
  return crouch ? CROUCH_EYE : STAND_EYE;
}

export function boxOverlap(x, y, z, r, h, b) {
  return x + r > b.min[0] && x - r < b.max[0] &&
    y + h > b.min[1] && y < b.max[1] &&
    z + r > b.min[2] && z - r < b.max[2];
}

export function findOverlap(x, y, z, r, h, boxes) {
  for (let i = 0; i < boxes.length; i++) {
    if (boxOverlap(x, y, z, r, h, boxes[i])) return boxes[i];
  }
  return null;
}

function axisMove(s, key, d, boxes, r) {
  if (d === 0) return;
  const old = s[key];
  s[key] = old + d;
  const b = findOverlap(s.x, s.y, s.z, r, s.h, boxes);
  if (!b) return;
  if (s.onGround) {
    const top = b.max[1];
    const rise = top - s.y;
    if (rise > 0 && rise <= STEP_HEIGHT && !findOverlap(s.x, top + 0.001, s.z, r, s.h, boxes)) {
      s.y = top + 0.001;
      return;
    }
  }
  s[key] = old;
  if (key === 'x') s.vx = 0; else s.vz = 0;
}

function stepBody(s, dt, boxes, r) {
  s.vy -= GRAVITY * dt;
  axisMove(s, 'x', s.vx * dt, boxes, r);
  axisMove(s, 'z', s.vz * dt, boxes, r);
  let ny = s.y + s.vy * dt;
  const b = findOverlap(s.x, ny, s.z, r, s.h, boxes);
  if (b) {
    if (s.vy < 0) { ny = b.max[1]; s.onGround = true; } else { ny = b.min[1] - s.h; s.onGround = false; }
    s.vy = 0;
  } else {
    s.onGround = false;
  }
  if (ny <= 0) { ny = 0; s.vy = 0; s.onGround = true; }
  s.y = ny;
}

// s: {x, y, z, vx, vy, vz, h, onGround}
export function moveBody(s, dt, boxes, r = PLAYER_RADIUS) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) stepBody(s, sdt, boxes, r);
  return s;
}

let lastAxis = -1;
export function rayBox(o, d, b, maxT) {
  let tmin = 0, tmax = maxT, axis = -1;
  for (let a = 0; a < 3; a++) {
    const oa = o[a], da = d[a];
    if (Math.abs(da) < 1e-9) {
      if (oa < b.min[a] || oa > b.max[a]) return -1;
      continue;
    }
    const inv = 1 / da;
    let t1 = (b.min[a] - oa) * inv, t2 = (b.max[a] - oa) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) { tmin = t1; axis = a; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  lastAxis = axis;
  return tmin;
}

// Devuelve {t, n, box} del primer impacto contra el mapa (incluye el suelo) o null.
export function raycast(o, d, maxT, boxes) {
  let best = maxT, hit = null, ax = -1;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayBox(o, d, boxes[i], best);
    if (t >= 0 && t < best) { best = t; hit = boxes[i]; ax = lastAxis; }
  }
  if (d[1] < -1e-6) {
    const t = -o[1] / d[1];
    if (t >= 0 && t < best) { best = t; hit = FLOOR; ax = 1; }
  }
  if (!hit) return null;
  const n = [0, 0, 0];
  if (ax >= 0) n[ax] = d[ax] > 0 ? -1 : 1;
  return { t: best, n, box: hit };
}

const _pbox = { min: [0, 0, 0], max: [0, 0, 0] };
// Hitboxes del jugador: esfera para la cabeza y caja para el cuerpo.
export function rayPlayer(o, d, maxT, px, py, pz, crouch) {
  let best = maxT, group = null;
  const hy = py + (crouch ? 1.13 : 1.6), hr = 0.24;
  const ox = o[0] - px, oy = o[1] - hy, oz = o[2] - pz;
  const bb = ox * d[0] + oy * d[1] + oz * d[2];
  const c = ox * ox + oy * oy + oz * oz - hr * hr;
  const disc = bb * bb - c;
  if (disc >= 0) {
    const t = -bb - Math.sqrt(disc);
    if (t >= 0 && t < best) { best = t; group = 'head'; }
  }
  const top = py + (crouch ? 0.95 : 1.42);
  _pbox.min[0] = px - 0.3; _pbox.min[1] = py; _pbox.min[2] = pz - 0.3;
  _pbox.max[0] = px + 0.3; _pbox.max[1] = top; _pbox.max[2] = pz + 0.3;
  const t = rayBox(o, d, _pbox, best);
  if (t >= 0 && t < best) {
    best = t;
    const ly = o[1] + d[1] * t - py;
    group = ly < (crouch ? 0.42 : 0.72) ? 'legs' : ly < (crouch ? 0.62 : 1.0) ? 'stomach' : 'chest';
  }
  return group ? { t: best, group } : null;
}

// ¿El segmento a-b atraviesa la esfera (c, r)?
export function segmentHitsSphere(a, b, c, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = len2 > 0 ? ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy + (c[2] - a[2]) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + dx * t - c[0], py = a[1] + dy * t - c[1], pz = a[2] + dz * t - c[2];
  return px * px + py * py + pz * pz < r * r;
}

export function viewDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Distancia de salida de un rayo que ya está dentro o atraviesa la caja (para penetración).
export function rayBoxExit(o, d, b) {
  let tmax = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) continue;
    const t1 = (b.min[a] - o[a]) / d[a], t2 = (b.max[a] - o[a]) / d[a];
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return tmax;
}
