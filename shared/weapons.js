// Definición de armas y equipo (valores inspirados en CS2, en metros/segundos).
// spread/move en radianes; rate = segundos entre disparos; fall = multiplicador de daño cada 10 m.

export const WEAPONS = {
  knife: { name: 'Cuchillo', slot: 3, cat: 'knife', model: 'knife', dmg: 40, heavy: 65, rate: 0.4, heavyRate: 1.0, range: 2.2, speed: 6.3, ap: 0.85, kill: 1500 },

  glock: { name: 'Glock-18', slot: 2, cat: 'pistol', model: 'pistol', team: 'T', price: 200, dmg: 30, ap: 0.47, rate: 0.15, mag: 20, res: 120, reload: 2.2, speed: 6.0, spread: 0.009, move: 0.03, recoil: 0.018, fall: 0.85, kill: 300 },
  usp: { name: 'USP-S', slot: 2, cat: 'pistol', model: 'usp', team: 'CT', price: 200, dmg: 35, ap: 0.505, rate: 0.17, mag: 12, res: 24, reload: 2.2, speed: 6.0, spread: 0.005, move: 0.03, recoil: 0.02, fall: 0.86, kill: 300, silenced: true },
  p250: { name: 'P250', slot: 2, cat: 'pistol', model: 'pistol', price: 300, dmg: 38, ap: 0.64, rate: 0.15, mag: 13, res: 26, reload: 2.2, speed: 6.0, spread: 0.008, move: 0.035, recoil: 0.025, fall: 0.85, kill: 300 },
  deagle: { name: 'Desert Eagle', slot: 2, cat: 'pistol', model: 'deagle', price: 700, dmg: 63, ap: 0.93, rate: 0.3, mag: 7, res: 35, reload: 2.2, speed: 5.9, spread: 0.006, move: 0.08, recoil: 0.06, fall: 0.88, kill: 300 },

  mac10: { name: 'MAC-10', slot: 1, cat: 'smg', model: 'smg', team: 'T', price: 1050, dmg: 29, ap: 0.575, rate: 0.075, mag: 30, res: 100, reload: 2.6, speed: 6.1, spread: 0.016, move: 0.03, recoil: 0.011, fall: 0.8, kill: 600, auto: true },
  mp9: { name: 'MP9', slot: 1, cat: 'smg', model: 'smg', team: 'CT', price: 1250, dmg: 26, ap: 0.6, rate: 0.07, mag: 30, res: 120, reload: 2.1, speed: 6.1, spread: 0.014, move: 0.028, recoil: 0.01, fall: 0.82, kill: 600, auto: true },
  nova: { name: 'Nova', slot: 1, cat: 'heavy', model: 'shotgun', price: 1050, dmg: 26, pellets: 9, ap: 0.5, rate: 0.88, mag: 8, res: 32, reload: 3.0, speed: 5.8, spread: 0.06, move: 0.02, recoil: 0.07, fall: 0.6, kill: 900, range: 45 },

  galil: { name: 'Galil AR', slot: 1, cat: 'rifle', model: 'rifle', team: 'T', price: 1800, dmg: 30, ap: 0.775, rate: 0.09, mag: 35, res: 90, reload: 3.0, speed: 5.5, spread: 0.006, move: 0.08, recoil: 0.016, fall: 0.97, kill: 300, auto: true },
  famas: { name: 'FAMAS', slot: 1, cat: 'rifle', model: 'rifle2', team: 'CT', price: 2050, dmg: 30, ap: 0.7, rate: 0.09, mag: 25, res: 90, reload: 3.3, speed: 5.5, spread: 0.005, move: 0.08, recoil: 0.015, fall: 0.96, kill: 300, auto: true },
  ak47: { name: 'AK-47', slot: 1, cat: 'rifle', model: 'ak', team: 'T', price: 2700, dmg: 36, ap: 0.775, rate: 0.1, mag: 30, res: 90, reload: 2.5, speed: 5.4, spread: 0.0035, move: 0.09, recoil: 0.021, fall: 0.98, kill: 300, auto: true },
  m4a4: { name: 'M4A4', slot: 1, cat: 'rifle', model: 'rifle2', team: 'CT', price: 3100, dmg: 33, ap: 0.7, rate: 0.09, mag: 30, res: 90, reload: 3.1, speed: 5.6, spread: 0.003, move: 0.08, recoil: 0.017, fall: 0.97, kill: 300, auto: true },
  ssg08: { name: 'SSG 08', slot: 1, cat: 'sniper', model: 'sniper', price: 1700, dmg: 88, ap: 0.85, rate: 1.25, mag: 10, res: 90, reload: 3.7, speed: 6.1, spread: 0.05, scoped: 0.0012, move: 0.07, recoil: 0.05, fall: 0.99, kill: 300, scope: [40, 15] },
  awp: { name: 'AWP', slot: 1, cat: 'sniper', model: 'awp', price: 4750, dmg: 115, ap: 0.975, rate: 1.47, mag: 5, res: 30, reload: 3.6, speed: 5.0, spread: 0.09, scoped: 0.0008, move: 0.2, recoil: 0.08, fall: 0.99, kill: 100, scope: [40, 12] },
};

export const NADES = {
  he: { name: 'Granada HE', price: 300, max: 1, key: 'he' },
  flash: { name: 'Granada cegadora', price: 200, max: 2, key: 'flash' },
  smoke: { name: 'Granada de humo', price: 300, max: 1, key: 'smoke' },
};
export const NADE_ORDER = ['he', 'flash', 'smoke'];
export const MAX_NADES = 4;

export const EQUIPMENT = {
  vest: { name: 'Chaleco', price: 650 },
  vesthelm: { name: 'Chaleco + casco', price: 1000 },
  defuser: { name: 'Kit de desactivación', price: 400, team: 'CT' },
};

export const BUY_MENU = [
  { title: 'Pistolas', items: ['glock', 'usp', 'p250', 'deagle'] },
  { title: 'Subfusiles / Pesadas', items: ['mac10', 'mp9', 'nova'] },
  { title: 'Rifles', items: ['galil', 'famas', 'ak47', 'm4a4', 'ssg08', 'awp'] },
  { title: 'Equipo', items: ['vest', 'vesthelm', 'defuser'] },
  { title: 'Granadas', items: ['he', 'flash', 'smoke'] },
];

export function itemInfo(id) {
  return WEAPONS[id] || NADES[id] || EQUIPMENT[id] || null;
}

export function damageFalloff(w, dist) {
  return Math.pow(w.fall ?? 0.95, dist / 10);
}

export function moveSpeed(wid, scoped) {
  const w = WEAPONS[wid];
  const base = w ? w.speed : 6.0;
  return scoped ? base * 0.55 : base;
}

// Patrón de retroceso determinista: devuelve [pitch, yaw] añadidos por disparo n.
export function recoilKick(w, n) {
  const r = w.recoil || 0;
  if (!w.auto) return [r, (Math.sin(n * 1.7) * 0.25) * r];
  const up = r * (n < 9 ? 1 : 0.25);
  const side = n < 5 ? Math.sin(n * 0.9) * r * 0.15 : Math.sin(n * 0.45 + 1.2) * r * 0.95;
  return [up, side];
}

export const ECONOMY = {
  start: 800, max: 16000, win: 3250, winObjective: 3500,
  lossBase: 1400, lossStep: 500, lossMax: 3400, plantBonus: 300, plantLossBonus: 800,
  teamKillPenalty: 300,
};
