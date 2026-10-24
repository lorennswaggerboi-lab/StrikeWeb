// Siluetas de armas/objetos dibujadas por código (estilo iconos de CS2), cacheadas como dataURL.
import { WEAPONS } from '../shared/weapons.js';

const W = 100, H = 32;
const R = (x, y, w, h) => ['r', x, y, w, h];
const P = (...pts) => ['p', pts];
const C = (x, y, r) => ['c', x, y, r];
const grip = (x) => P([x, 16], [x + 7, 16], [x + 4, 28], [x - 2, 27]);

const SHAPES = {
  ak: [P([0, 10], [22, 8], [22, 16], [4, 23], [0, 23]), R(20, 8, 40, 8), R(58, 9, 16, 6), R(74, 10, 24, 2.5), R(92, 6, 2, 4),
    P([42, 16], [50, 16], [47, 30], [38, 28]), grip(30)],
  rifle: [P([0, 9], [20, 9], [20, 17], [2, 21], [0, 21]), R(20, 8, 40, 9), R(58, 9, 16, 6), R(74, 10, 24, 2.5), R(44, 17, 7, 12), grip(30), R(28, 5, 18, 3)],
  rifle2: [R(0, 9, 18, 8), R(0, 7, 4, 13), R(18, 8, 40, 8), R(30, 4, 14, 3), R(56, 8, 18, 7), R(74, 10, 22, 2.5), R(40, 16, 8, 13), grip(28)],
  smg: [R(4, 10, 16, 4), R(20, 8, 36, 9), R(56, 11, 12, 3), R(36, 17, 6, 13), grip(24)],
  p90: [P([6, 12], [20, 6], [72, 6], [80, 10], [80, 15], [60, 18], [50, 26], [40, 26], [36, 18], [10, 20]), R(80, 11, 10, 3)],
  shotgun: [P([0, 10], [16, 9], [16, 16], [3, 22], [0, 22]), R(14, 9, 46, 6), R(60, 9, 36, 3), R(50, 14, 18, 4), grip(22)],
  sniper: [P([0, 10], [20, 10], [20, 16], [4, 22], [0, 22]), R(20, 10, 44, 6), R(64, 11, 34, 2.5), R(28, 3, 28, 5), R(26, 5, 4, 5), R(54, 5, 4, 5), R(40, 16, 6, 8), grip(30)],
  awp: [P([0, 8], [16, 8], [16, 18], [6, 25], [0, 25]), R(14, 9, 52, 8), R(66, 11, 32, 3.5), R(26, 1, 30, 6), R(30, 6, 4, 4), R(50, 6, 4, 4), R(36, 17, 7, 9), grip(24)],
  pistol: [R(30, 7, 36, 8), P([32, 14], [43, 14], [40, 30], [29, 30]), R(44, 15, 6, 4)],
  usp: [R(24, 7, 30, 8), R(54, 8, 26, 6), P([26, 14], [37, 14], [34, 30], [23, 30]), R(38, 15, 6, 4)],
  deagle: [R(24, 4, 46, 11), P([26, 14], [38, 14], [35, 31], [22, 31]), R(40, 15, 6, 4)],
  knife: [R(4, 12, 26, 8), R(28, 8, 4, 16), P([32, 12], [86, 9], [96, 13], [86, 18], [32, 20])],
  he: [C(50, 19, 11), R(46, 3, 12, 6), R(56, 5, 6, 10)],
  flash: [R(42, 7, 16, 23), R(44, 3, 12, 5), R(56, 4, 5, 12)],
  smoke: [R(40, 6, 20, 25), R(43, 2, 14, 5)],
  molotov: [P([44, 31], [56, 31], [58, 16], [53, 12], [53, 4], [47, 4], [47, 12], [42, 16]), P([46, 4], [44, 0], [52, 1], [54, 4])],
  incgrenade: [R(41, 7, 18, 24), R(44, 3, 12, 5), R(57, 4, 5, 12)],
  vest: [P([34, 2], [44, 2], [50, 8], [56, 2], [66, 2], [70, 30], [30, 30])],
  vesthelm: [P([30, 26], [32, 12], [42, 4], [58, 4], [68, 12], [70, 26], [62, 26], [60, 18], [40, 18], [38, 26])],
  defuser: [R(30, 10, 40, 16), R(36, 4, 4, 8), R(60, 4, 4, 8), R(40, 14, 20, 8)],
  c4: [R(26, 8, 48, 20), R(34, 4, 10, 6), R(50, 12, 18, 10)],
  // iconos del historial de rondas y del killfeed
  elim: [C(50, 13, 11), R(44, 20, 12, 8)],
  bomb: [C(48, 19, 10), R(52, 4, 4, 9), R(55, 2, 6, 3)],
  defuse: [P([36, 26], [48, 12], [44, 8], [52, 4], [60, 12], [56, 16], [42, 30])],
  time: [C(50, 16, 13)],
  hs: [C(50, 16, 12)],
  wb: [R(36, 2, 8, 28), P([22, 13], [70, 13], [70, 8], [80, 16], [70, 24], [70, 19], [22, 19])],
  sm: [C(40, 18, 9), C(52, 13, 11), C(62, 19, 9), R(36, 18, 30, 9)],
  ns: [C(50, 16, 12)],
};

const HOLES = {
  time: ctx => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(50, 16, 10, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(49, 8, 2, 9); ctx.fillRect(49, 15, 7, 2); },
  hs: ctx => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(50, 16, 9, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(49, 2, 2, 28); ctx.fillRect(36, 15, 28, 2); },
  ns: ctx => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(50, 16, 9, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(50, 16); ctx.rotate(0.78); ctx.fillRect(-15, -1.5, 30, 3); ctx.restore(); },
  elim: ctx => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(45, 13, 3, 0, 7); ctx.arc(55, 13, 3, 0, 7); ctx.fill(); ctx.fillRect(47, 22, 2, 6); ctx.fillRect(51, 22, 2, 6); ctx.globalCompositeOperation = 'source-over'; },
};

const cache = new Map();

export function iconKey(id) {
  if (SHAPES[id]) return id;
  const w = WEAPONS[id];
  if (w) return w.model === 'usp' ? 'usp' : w.model;
  if (id === 'nade') return 'he';
  return 'elim';
}

export function icon(id, color = '#ffffff') {
  const key = iconKey(id) + color;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = color;
  for (const s of SHAPES[iconKey(id)] || []) {
    ctx.beginPath();
    if (s[0] === 'r') ctx.rect(s[1], s[2], s[3], s[4]);
    else if (s[0] === 'c') ctx.arc(s[1], s[2], s[3], 0, Math.PI * 2);
    else { s[1].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
    ctx.fill();
  }
  HOLES[iconKey(id)]?.(ctx);
  // recortar el espacio vacío horizontal
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, maxX = 0;
  for (let x = 0; x < c.width; x++) for (let y = 0; y < c.height; y += 2) if (data[(y * c.width + x) * 4 + 3] > 10) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); break; }
  const out = document.createElement('canvas');
  const w = Math.max(8, maxX - minX + 4);
  out.width = w; out.height = c.height;
  out.getContext('2d').drawImage(c, minX - 2, 0, w, c.height, 0, 0, w, c.height);
  const url = out.toDataURL();
  cache.set(key, url);
  return url;
}

// Avatar por defecto: iniciales sobre un color derivado del nombre.
const avCache = new Map();
export function defaultAvatar(name, isBot = false) {
  const key = name + isBot;
  if (avCache.has(key)) return avCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, `hsl(${h},35%,${isBot ? 22 : 34}%)`);
  grad.addColorStop(1, `hsl(${(h + 40) % 360},40%,${isBot ? 12 : 20}%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.font = 'bold 28px "Barlow Semi Condensed", Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const clean = name.replace(/^BOT\s+/, '');
  g.fillText(isBot ? 'BOT' : clean.slice(0, 2).toUpperCase(), 32, 34);
  const url = c.toDataURL();
  avCache.set(key, url);
  return url;
}

// Vista previa cenital de un mapa (para el veto y el lobby).
const THEME_COLORS = {
  desert: { wall: '#5a4630', wall2: '#6b5a40', floor: '#c9a86e', site: '#c96a4a', ceil: '#9c8058', crate: '#7b5a35', spawnT: '#d6b46a', spawnCT: '#7d9bc0' },
  industrial: { wall: '#2e3135', wall2: '#3a3f45', floor: '#8b8e92', site: '#b06450', ceil: '#6c7076', crate: '#5b5f63', spawnT: '#b49b5c', spawnCT: '#6d8db5' },
  village: { wall: '#6e6152', wall2: '#7c7062', floor: '#d8d0bf', site: '#c46d52', ceil: '#a89a85', crate: '#8b6a45', spawnT: '#d9bc7a', spawnCT: '#86a3c7' },
  docks: { wall: '#4a3229', wall2: '#3f4348', floor: '#7a7d82', site: '#b8644d', ceil: '#5d6166', crate: '#7c5435', spawnT: '#bba061', spawnCT: '#6e8eb5' },
  temple: { wall: '#4f4c40', wall2: '#5b584b', floor: '#bdb69e', site: '#b9705a', ceil: '#8c8670', crate: '#6f6650', spawnT: '#c9b273', spawnCT: '#7d9bba' },
};

export function mapPreview(map, size = 180) {
  const key = 'map:' + map.id + size;
  if (cache.has(key)) return cache.get(key);
  const col = THEME_COLORS[map.theme] || THEME_COLORS.desert;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / Math.max(map.w, map.h);
  const ox = (size - map.w * s) / 2, oz = (size - map.h * s) / 2;
  g.fillStyle = col.wall;
  g.fillRect(0, 0, size, size);
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
    const ch = map.grid[z][x];
    let f = null;
    if (ch === '#') continue;
    if (ch === '%') f = col.wall2;
    else if (ch === 'A' || ch === 'B') f = col.site;
    else if (ch === '=') f = col.ceil;
    else if ('cCKwb'.includes(ch)) f = col.crate;
    else if (ch === 'T') f = col.spawnT;
    else if (ch === 'X') f = col.spawnCT;
    else f = col.floor;
    if (ch === '%') continue;
    g.fillStyle = f;
    g.fillRect(ox + x * s, oz + z * s, Math.ceil(s), Math.ceil(s));
  }
  g.font = `bold ${Math.round(size / 7)}px "Barlow Semi Condensed", Arial`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = 3;
  for (const k in map.sites) {
    const sx = ox + (map.sites[k].cx / map.cell + map.w / 2) * s, sz = oz + (map.sites[k].cz / map.cell + map.h / 2) * s;
    g.strokeText(k, sx, sz);
    g.fillText(k, sx, sz);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
