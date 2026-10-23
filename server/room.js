// Lógica autoritativa de una sala: rondas, economía, disparos, granadas, bomba y bots.
import { performance } from 'perf_hooks';
import { BOXES, SPAWNS, SPAWN_CENTER, BUY_RADIUS, siteAt, SITES } from '../shared/map.js';
import { WEAPONS, NADES, NADE_ORDER, MAX_NADES, EQUIPMENT, ECONOMY, damageFalloff } from '../shared/weapons.js';
import {
  raycast, rayPlayer, findOverlap, eyeHeight, viewDir, segmentHitsSphere,
  PLAYER_RADIUS, STAND_HEIGHT, CROUCH_HEIGHT, GRAVITY,
} from '../shared/physics.js';
import { BotBrain } from './bot.js';

export const now = () => performance.now() / 1000;

const T = {
  warmup: 15, freeze: 6, round: 115, bomb: 40, plant: 3.2, defuse: 10, defuseKit: 5,
  post: 6, buy: 26, matchEnd: 12, warmupRespawn: 2.5,
};
const WIN_ROUNDS = 13;
const HALF_ROUNDS = 12;

const BOT_NAMES = [
  'Alfredo', 'Nico', 'Chispa', 'Tango', 'Rayo', 'Coyote', 'Piraña', 'Halcón', 'Sombra', 'Toro',
  'Lince', 'Puma', 'Cobra', 'Bala', 'Trueno', 'Gato', 'Zorro', 'Mamba', 'Lobo', 'Jaguar',
];

const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const other = team => (team === 'T' ? 'CT' : 'T');

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function sanitizeName(s, fallback = 'Jugador') {
  const clean = String(s ?? '').replace(/[^\p{L}\p{N} _\-.!?]/gu, '').trim().slice(0, 16);
  return clean || fallback;
}

export class Room {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.players = new Map();
    this.nextId = 1;
    this.nextEnt = 1;
    this.phase = 'warmup';
    this.phaseEnd = now() + T.warmup;
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.bomb = { state: 'none' };
    this.nades = [];
    this.smokes = [];
    this.drops = [];
    this.botTarget = config.botsPerTeam;
    this.botSkill = config.botSkill;
    this.tickCount = 0;
    this.buyEnd = 0;
    this.halftimePending = false;
    this.matchOver = null;
    this.botNameIdx = (Math.random() * BOT_NAMES.length) | 0;
    this.createdAt = Date.now();
    this.rebalanceBots(true);
  }

  // ---------- jugadores ----------
  createPlayer(name, isBot) {
    const p = {
      id: this.nextId++, name, isBot, ws: null, team: 'SPEC',
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, h: STAND_HEIGHT, onGround: true,
      yaw: 0, pitch: 0, crouch: false, scoped: false,
      alive: false, hp: 0, armor: 0, helmet: false, defuser: false,
      money: this.phase === 'warmup' ? 10000 : ECONOMY.start,
      kills: 0, deaths: 0, assists: 0, mvps: 0,
      inv: { 1: null, 2: null, 3: { id: 'knife' } }, nades: { he: 0, flash: 0, smoke: 0 }, bomb: false,
      slot: 2, lastShot: 0, reloadUntil: 0, reloadSlot: 0,
      hist: [], dmgBy: {}, flashedUntil: 0, ping: 0, spawnSeq: 0,
      lastInputT: 0, using: false, action: null, deadAt: 0, spotted: false, isAdmin: false,
      chatTimes: [],
    };
    if (isBot) p.ai = new BotBrain(this, p, this.botSkill);
    return p;
  }

  humanCount() {
    let n = 0;
    for (const p of this.players.values()) if (!p.isBot) n++;
    return n;
  }

  teamMembers(team) {
    const out = [];
    for (const p of this.players.values()) if (p.team === team) out.push(p);
    return out;
  }

  autoTeam() {
    const count = t => { let h = 0, all = 0; for (const p of this.players.values()) if (p.team === t) { all++; if (!p.isBot) h++; } return [h, all]; };
    const [th, ta] = count('T'), [ch, ca] = count('CT');
    if (th !== ch) return th < ch ? 'T' : 'CT';
    if (ta !== ca) return ta < ca ? 'T' : 'CT';
    return Math.random() < 0.5 ? 'T' : 'CT';
  }

  addHuman(ws, name, teamPref) {
    const p = this.createPlayer(sanitizeName(name), false);
    p.ws = ws;
    this.players.set(p.id, p);
    this.send(p, { t: 'welcome', id: p.id, room: this.name, adminEmail: this.config.adminEmail, admin: !this.config.adminPassword });
    const team = teamPref === 'T' || teamPref === 'CT' ? teamPref : this.autoTeam();
    this.setTeam(p, team, true);
    this.systemMsg(`${p.name} se ha unido (${team === 'T' ? 'Terroristas' : 'Antiterroristas'})`);
    this.rebalanceBots(this.phase === 'warmup');
    this.sendRoster();
    return p;
  }

  removePlayer(p) {
    if (!this.players.has(p.id)) return;
    if (p.alive) this.dropEverything(p);
    if (this.bomb.defuser === p.id) this.bomb.defuser = null;
    this.players.delete(p.id);
    if (!p.isBot) {
      this.systemMsg(`${p.name} ha salido`);
      this.rebalanceBots(this.phase === 'warmup');
    }
    this.checkRoundEnd();
    this.sendRoster();
  }

  setTeam(p, team, initial = false) {
    if (p.team === team) return;
    if (p.alive && !initial) {
      this.dropEverything(p);
      p.alive = false;
      p.deadAt = now();
    }
    p.team = team;
    this.resetInventory(p);
    if (team === 'SPEC') return;
    if (this.phase === 'warmup' || this.phase === 'freeze') {
      const idx = this.teamMembers(team).length - 1;
      this.spawn(p, idx);
    } else {
      p.alive = false;
      p.deadAt = now();
      this.send(p, { t: 'msg', text: 'Aparecerás en la próxima ronda', kind: 'info' });
    }
    this.checkRoundEnd();
  }

  changeTeam(p, team) {
    if (team !== 'T' && team !== 'CT' && team !== 'SPEC') return;
    if (team === p.team) return;
    const t = now();
    if (t - (p.lastTeamChange || 0) < 3) return;
    p.lastTeamChange = t;
    this.setTeam(p, team);
    this.systemMsg(`${p.name} se cambió a ${team === 'T' ? 'Terroristas' : team === 'CT' ? 'Antiterroristas' : 'Espectadores'}`);
    this.rebalanceBots(this.phase === 'warmup');
    this.sendRoster();
  }

  resetInventory(p) {
    const pistol = p.team === 'CT' ? 'usp' : 'glock';
    const w = WEAPONS[pistol];
    p.inv = { 1: null, 2: { id: pistol, mag: w.mag, res: w.res }, 3: { id: 'knife' } };
    p.nades = { he: 0, flash: 0, smoke: 0 };
    p.bomb = false;
    p.armor = 0;
    p.helmet = false;
    p.defuser = false;
    p.slot = 2;
    p.reloadUntil = 0;
  }

  // Mantiene cada equipo con `botTarget` miembros como mínimo usando bots.
  rebalanceBots(immediate) {
    for (const team of ['T', 'CT']) {
      const members = this.teamMembers(team);
      const humans = members.filter(p => !p.isBot).length;
      const bots = members.filter(p => p.isBot);
      const want = Math.max(0, this.botTarget - humans);
      if (bots.length < want) {
        for (let i = bots.length; i < want; i++) this.addBot(team);
      } else if (bots.length > want) {
        let extra = bots.length - want;
        // primero quitar bots muertos; los vivos solo si es inmediato
        const ordered = [...bots].sort((a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0));
        for (const b of ordered) {
          if (extra <= 0) break;
          if (b.alive && !immediate && this.phase === 'live') continue;
          this.removePlayer(b);
          extra--;
        }
      }
    }
  }

  addBot(team) {
    const name = 'BOT ' + BOT_NAMES[this.botNameIdx++ % BOT_NAMES.length];
    const b = this.createPlayer(name, true);
    this.players.set(b.id, b);
    b.team = team;
    this.resetInventory(b);
    if (this.phase === 'warmup' || this.phase === 'freeze') {
      this.spawn(b, this.teamMembers(team).length - 1);
      if (this.phase === 'freeze') b.ai.onRoundStart();
    } else {
      b.alive = false;
      b.deadAt = now();
    }
    return b;
  }

  spawn(p, idx) {
    const list = SPAWNS[p.team];
    const [sx, sz] = list[((idx % list.length) + list.length) % list.length];
    p.x = sx + (Math.random() - 0.5) * 0.6;
    p.z = sz + (Math.random() - 0.5) * 0.6;
    p.y = 0;
    p.vx = p.vy = p.vz = 0;
    p.h = STAND_HEIGHT;
    p.crouch = false;
    p.scoped = false;
    p.yaw = p.team === 'T' ? 0 : Math.PI;
    p.pitch = 0;
    p.alive = true;
    p.hp = 100;
    p.flashedUntil = 0;
    p.action = null;
    p.using = false;
    p.reloadUntil = 0;
    p.dmgBy = {};
    p.spawnSeq++;
    p.hist = [{ t: now(), x: p.x, y: p.y, z: p.z, c: false }];
    p.lastInputT = now();
    if (!p.inv[p.slot] && p.slot <= 3) p.slot = this.bestSlot(p);
    if (this.phase === 'warmup') p.money = 10000;
    this.send(p, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw, sp: p.spawnSeq });
    if (p.isBot) p.ai.onSpawn();
  }

  bestSlot(p) {
    if (p.inv[1]) return 1;
    if (p.inv[2]) return 2;
    return 3;
  }

  // ---------- red ----------
  send(p, obj) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }

  broadcast(obj, except = null) {
    const s = JSON.stringify(obj);
    for (const p of this.players.values()) if (p !== except && p.ws) this.send(p, s);
  }

  systemMsg(text) {
    this.broadcast({ t: 'chat', name: '', msg: text, sys: 1 });
  }

  centerMsg(text, kind = 'info') {
    this.broadcast({ t: 'msg', text, kind });
  }

  onMessage(p, m) {
    switch (m.t) {
      case 'i': this.onInput(p, m); break;
      case 'f': this.onFire(p, m); break;
      case 'r': this.startReload(p); break;
      case 'w': this.switchSlot(p, m.s | 0); break;
      case 'b': this.buy(p, String(m.item || '')); break;
      case 'g': this.onThrow(p, m); break;
      case 'u': p.using = !!m.on; if (m.on) this.tryPickup(p); break;
      case 'd': this.dropCurrent(p); break;
      case 'team': this.changeTeam(p, m.team); break;
      case 'c': this.onChat(p, m); break;
      case 'ping':
        p.ping = clamp(num(m.rtt, 0), 0, 9999) | 0;
        this.send(p, { t: 'pong', c: num(m.c), s: now() * 1000 });
        break;
    }
  }

  onInput(p, m) {
    p.yaw = num(m.yw, p.yaw);
    p.pitch = clamp(num(m.pt, p.pitch), -1.55, 1.55);
    p.scoped = !!m.s;
    if (!p.alive || m.sp !== p.spawnSeq) return;
    const crouch = !!m.c;
    if (this.phase === 'freeze') { p.crouch = crouch; return; }
    const x = num(m.x, NaN), y = num(m.y, NaN), z = num(m.z, NaN);
    if (!Number.isFinite(x + y + z)) return;
    const t = now();
    const dtv = Math.max(0.033, t - p.lastInputT);
    const dist = Math.hypot(x - p.x, z - p.z);
    const h = crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (dist > 9.5 * dtv + 1.2 || y < -0.5 || y > 12 ||
      findOverlap(x, y + 0.08, z, PLAYER_RADIUS - 0.12, h - 0.16, BOXES)) {
      this.correct(p);
      return;
    }
    p.x = x; p.y = y; p.z = z;
    p.crouch = crouch;
    p.lastInputT = t;
    this.pushHist(p, t);
  }

  correct(p) {
    p.spawnSeq++;
    this.send(p, { t: 'tp', x: p.x, y: p.y, z: p.z, sp: p.spawnSeq });
  }

  pushHist(p, t) {
    p.hist.push({ t, x: p.x, y: p.y, z: p.z, c: p.crouch });
    while (p.hist.length > 2 && p.hist[0].t < t - 1) p.hist.shift();
  }

  poseAt(p, t) {
    const h = p.hist;
    if (!h.length) return { x: p.x, y: p.y, z: p.z, c: p.crouch };
    if (t >= h[h.length - 1].t) return h[h.length - 1];
    for (let i = h.length - 2; i >= 0; i--) {
      if (h[i].t <= t) {
        const a = h[i], b = h[i + 1];
        const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, c: k < 0.5 ? a.c : b.c };
      }
    }
    return h[0];
  }

  // ---------- armas ----------
  currentItem(p) {
    return p.slot <= 3 ? p.inv[p.slot] : null;
  }

  weaponIdOf(p) {
    if (p.slot === 4) return 'nade';
    if (p.slot === 5) return 'c4';
    return p.inv[p.slot]?.id || 'knife';
  }

  switchSlot(p, s) {
    if (s < 1 || s > 5) return;
    if (s <= 3 && !p.inv[s]) return;
    if (s === 4 && !NADE_ORDER.some(k => p.nades[k] > 0)) return;
    if (s === 5 && !p.bomb) return;
    if (p.slot !== s) { p.reloadUntil = 0; p.scoped = false; }
    p.slot = s;
  }

  startReload(p) {
    const item = this.currentItem(p);
    if (!p.alive || !item) return;
    const w = WEAPONS[item.id];
    if (!w || !w.mag || item.mag >= w.mag || item.res <= 0 || p.reloadUntil) return;
    p.reloadUntil = now() + w.reload;
    p.reloadSlot = p.slot;
    p.scoped = false;
  }

  finishReload(p) {
    const item = p.inv[p.reloadSlot];
    p.reloadUntil = 0;
    if (!item || p.slot !== p.reloadSlot) return;
    const w = WEAPONS[item.id];
    const take = Math.min(w.mag - item.mag, item.res);
    item.mag += take;
    item.res -= take;
  }

  onFire(p, m) {
    if (!p.alive || this.phase === 'freeze') return;
    const item = this.currentItem(p);
    if (!item) return;
    const w = WEAPONS[item.id];
    if (!w || (m.w && m.w !== item.id)) return;
    const t = now();
    if (p.reloadUntil) return;
    const alt = !!m.alt && w.cat === 'knife';
    if (t - p.lastShot < (alt ? w.heavyRate : w.rate) * 0.75) return;
    const rt = clamp(num(m.rt, t * 1000) / 1000, t - 0.4, t);
    const eye = [p.x, p.y + eyeHeight(p.crouch), p.z];
    let o = eye;
    if (Array.isArray(m.o) && m.o.length === 3 && m.o.every(Number.isFinite)) {
      const d = Math.hypot(m.o[0] - eye[0], m.o[1] - eye[1], m.o[2] - eye[2]);
      if (d < 1.6) o = m.o;
    }
    if (w.cat === 'knife') {
      p.lastShot = t;
      this.knifeAttack(p, o, alt, rt);
      return;
    }
    if (item.mag <= 0) return;
    const view = viewDir(p.yaw, p.pitch);
    const pellets = w.pellets || 1;
    const dirs = [];
    if (Array.isArray(m.d)) {
      for (const d of m.d.slice(0, pellets)) {
        if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) continue;
        const len = Math.hypot(d[0], d[1], d[2]);
        if (len < 0.5) continue;
        const nd = [d[0] / len, d[1] / len, d[2] / len];
        // tolerancia por retroceso, dispersión y latencia del ángulo de visión
        if (nd[0] * view[0] + nd[1] * view[1] + nd[2] * view[2] < Math.cos(0.7)) continue;
        dirs.push(nd);
      }
    }
    if (!dirs.length) return;
    item.mag--;
    p.lastShot = t;
    this.fireBullets(p, o, dirs, w, item.id, rt);
  }

  fireBullets(p, o, dirs, w, wid, rt) {
    const ends = [];
    const dmgMap = new Map();
    const range = w.range || 250;
    for (const d of dirs) {
      const mh = raycast(o, d, range, BOXES);
      let tMax = mh ? mh.t : range;
      let victim = null, group = null;
      for (const q of this.players.values()) {
        if (q === p || !q.alive) continue;
        const pose = this.poseAt(q, rt);
        const hit = rayPlayer(o, d, tMax, pose.x, pose.y, pose.z, pose.c);
        if (hit && hit.t < tMax) { tMax = hit.t; victim = q; group = hit.group; }
      }
      ends.push([r2(o[0] + d[0] * tMax), r2(o[1] + d[1] * tMax), r2(o[2] + d[2] * tMax), victim ? 1 : mh ? 0 : 2]);
      if (victim && victim.team !== p.team) {
        const res = this.calcDamage(w, tMax, group, victim);
        const prev = dmgMap.get(victim) || { dmg: 0, armor: 0, hs: false };
        prev.dmg += res.dmg; prev.armor += res.armor; prev.hs = prev.hs || group === 'head';
        dmgMap.set(victim, prev);
      }
    }
    this.broadcast({ t: 'shot', id: p.id, w: wid, o: o.map(r2), e: ends }, p.isBot ? null : p);
    for (const b of this.players.values()) if (b.isBot && b.alive) b.ai.onNoise(p, o);
    for (const [victim, r] of dmgMap) this.applyDamage(victim, p, r.dmg, r.armor, wid, r.hs, o);
  }

  calcDamage(w, dist, group, v) {
    let dmg = w.dmg * damageFalloff(w, dist);
    if (group === 'head') dmg *= 4;
    else if (group === 'stomach') dmg *= 1.25;
    else if (group === 'legs') dmg *= 0.75;
    let armor = 0;
    const protectedHit = v.armor > 0 && group !== 'legs' && (group !== 'head' || v.helmet);
    if (protectedHit) {
      const hpDmg = dmg * w.ap;
      armor = (dmg - hpDmg) * 0.5;
      if (armor > v.armor) { dmg = dmg - v.armor * 2; armor = v.armor; } else dmg = hpDmg;
    }
    return { dmg: Math.max(1, Math.round(dmg)), armor: Math.round(armor) };
  }

  knifeAttack(p, o, heavy, rt) {
    const w = WEAPONS.knife;
    const view = viewDir(p.yaw, p.pitch);
    let best = null, bestD = Infinity, bestPose = null;
    for (const q of this.players.values()) {
      if (q === p || !q.alive || q.team === p.team) continue;
      const pose = this.poseAt(q, rt);
      const c = [pose.x, pose.y + (pose.c ? 0.8 : 1.15), pose.z];
      const dx = c[0] - o[0], dy = c[1] - o[1], dz = c[2] - o[2];
      const d = Math.hypot(dx, dy, dz);
      if (d > w.range + 0.5 || d < 1e-3) continue;
      const cos = (dx * view[0] + dy * view[1] + dz * view[2]) / d;
      if (cos < (d < 1 ? 0.3 : 0.82)) continue;
      if (raycast(o, [dx / d, dy / d, dz / d], d, BOXES)) continue;
      if (d < bestD) { bestD = d; best = q; bestPose = pose; }
    }
    this.broadcast({ t: 'snd', s: 'knife', x: r2(o[0]), y: r2(o[1]), z: r2(o[2]) }, p.isBot ? null : p);
    if (!best) return;
    const vf = viewDir(best.yaw, 0);
    const ax = bestPose.x - p.x, az = bestPose.z - p.z, al = Math.hypot(ax, az) || 1;
    const back = (vf[0] * ax + vf[2] * az) / al > 0.45;
    let dmg = heavy ? (back ? 180 : 65) : (back ? 90 : 40);
    let armor = 0;
    if (best.armor > 0) { const hp = dmg * w.ap; armor = Math.min(best.armor, Math.round((dmg - hp) * 0.5)); dmg = Math.round(hp); }
    this.applyDamage(best, p, dmg, armor, 'knife', false, o);
  }

  applyDamage(v, a, dmg, armorDmg, wid, hs, src) {
    if (!v.alive) return;
    v.hp -= dmg;
    v.armor = Math.max(0, v.armor - armorDmg);
    if (v.armor === 0) v.helmet = false;
    if (a) v.dmgBy[a.id] = (v.dmgBy[a.id] || 0) + dmg;
    if (a && a !== v) this.send(a, { t: 'hc', d: dmg, hs: hs ? 1 : 0, k: v.hp <= 0 ? 1 : 0 });
    this.send(v, { t: 'dmg', d: dmg, x: r2(src[0]), z: r2(src[2]) });
    if (v.isBot && a && a !== v) v.ai.onDamaged(a);
    if (v.hp <= 0) this.kill(v, a, wid, hs);
  }

  kill(v, a, wid, hs) {
    const t = now();
    v.alive = false;
    v.hp = 0;
    v.deadAt = t;
    v.deaths++;
    v.using = false;
    v.action = null;
    v.scoped = false;
    if (this.bomb.defuser === v.id) this.bomb.defuser = null;
    this.dropEverything(v);
    if (a && a !== v) {
      if (a.team !== v.team) {
        a.kills++;
        if (this.phase !== 'warmup') a.money = Math.min(ECONOMY.max, a.money + (WEAPONS[wid]?.kill ?? 300));
      } else {
        a.kills--;
        a.money = Math.max(0, a.money - ECONOMY.teamKillPenalty);
      }
    }
    for (const id in v.dmgBy) {
      const q = this.players.get(+id);
      if (q && q !== a && q !== v && v.dmgBy[id] >= 41 && q.team !== v.team) q.assists++;
    }
    v.dmgBy = {};
    this.broadcast({ t: 'kill', k: a ? a.id : -1, v: v.id, w: wid, hs: hs ? 1 : 0 });
    this.checkRoundEnd();
  }

  // ---------- objetos en el suelo ----------
  dropEverything(p) {
    if (p.bomb) this.dropBomb(p, false);
    const item = p.inv[1] || p.inv[2];
    if (item) {
      const slot = p.inv[1] ? 1 : 2;
      this.spawnDrop(p, item, false);
      p.inv[slot] = null;
    }
  }

  dropPoint(p, throwIt) {
    const eye = [p.x, p.y + eyeHeight(p.crouch), p.z];
    let x = p.x, z = p.z;
    if (throwIt) {
      const d = viewDir(p.yaw, 0);
      const hit = raycast(eye, d, 1.6, BOXES);
      const dist = hit ? Math.max(0, hit.t - 0.3) : 1.6;
      x += d[0] * dist; z += d[2] * dist;
    }
    const down = raycast([x, eye[1], z], [0, -1, 0], 20, BOXES);
    const y = down ? eye[1] - down.t : 0;
    return { x, y, z };
  }

  spawnDrop(p, item, throwIt) {
    const pt = this.dropPoint(p, throwIt);
    this.drops.push({ id: this.nextEnt++, item: { ...item }, ...pt, noPick: p.id, noPickUntil: now() + 1.2 });
    if (this.drops.length > 40) this.drops.shift();
  }

  dropBomb(p, throwIt) {
    if (!p.bomb) return;
    p.bomb = false;
    if (p.slot === 5) p.slot = this.bestSlot(p);
    const pt = this.dropPoint(p, throwIt);
    this.bomb = { state: 'dropped', ...pt, noPick: p.id, noPickUntil: now() + 1.2 };
    for (const q of this.players.values()) if (q.team === 'T') this.send(q, { t: 'msg', text: '¡Se ha soltado la bomba!', kind: 'warn' });
  }

  dropCurrent(p) {
    if (!p.alive) return;
    if (p.slot === 5) { this.dropBomb(p, true); return; }
    if (p.slot !== 1 && p.slot !== 2) return;
    const item = p.inv[p.slot];
    if (!item) return;
    this.spawnDrop(p, item, true);
    p.inv[p.slot] = null;
    p.reloadUntil = 0;
    p.slot = this.bestSlot(p);
  }

  tryPickup(p) {
    if (!p.alive) return;
    if (p.team === 'T' && p.bomb && siteAt(p.x, p.z)) return;
    if (p.team === 'CT' && this.bomb.state === 'planted' && Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 2) return;
    let best = null, bestD = 2.2;
    for (const d of this.drops) {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < bestD && Math.abs(d.y - p.y) < 2) { best = d; bestD = dist; }
    }
    if (!best) return;
    const w = WEAPONS[best.item.id];
    const slot = w.slot;
    if (p.inv[slot]) {
      this.drops.push({ id: this.nextEnt++, item: { ...p.inv[slot] }, x: p.x, y: p.y, z: p.z, noPick: p.id, noPickUntil: now() + 1.2 });
    }
    p.inv[slot] = best.item;
    p.slot = slot;
    p.reloadUntil = 0;
    this.drops.splice(this.drops.indexOf(best), 1);
    this.send(p, { t: 'snd', s: 'pickup' });
  }

  autoPickups(t) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.team === 'T' && this.bomb.state === 'dropped' && !(this.bomb.noPick === p.id && t < this.bomb.noPickUntil)) {
        if (Math.hypot(this.bomb.x - p.x, this.bomb.z - p.z) < 1.2 && Math.abs(this.bomb.y - p.y) < 2) {
          p.bomb = true;
          this.bomb = { state: 'carried', carrier: p.id };
          this.send(p, { t: 'msg', text: 'Has recogido la bomba', kind: 'info' });
          this.send(p, { t: 'snd', s: 'pickup' });
        }
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        if (d.noPick === p.id && t < d.noPickUntil) continue;
        const slot = WEAPONS[d.item.id].slot;
        if (p.inv[slot]) continue;
        if (Math.hypot(d.x - p.x, d.z - p.z) < 1.0 && Math.abs(d.y - p.y) < 2) {
          p.inv[slot] = d.item;
          this.drops.splice(i, 1);
          this.send(p, { t: 'snd', s: 'pickup' });
        }
      }
    }
  }

  // ---------- compras ----------
  canBuy(p) {
    if (!p.alive || p.team === 'SPEC') return false;
    const t = now();
    if (this.phase === 'warmup') return true;
    if (this.phase !== 'freeze' && this.phase !== 'live') return false;
    if (t > this.buyEnd) return false;
    const c = SPAWN_CENTER[p.team];
    return Math.hypot(p.x - c[0], p.z - c[1]) < BUY_RADIUS;
  }

  buy(p, id) {
    if (!this.canBuy(p)) return false;
    const pay = cost => {
      if (p.money < cost) return false;
      p.money -= cost;
      this.send(p, { t: 'bought', item: id });
      return true;
    };
    const w = WEAPONS[id];
    if (w) {
      if (!w.price || (w.team && w.team !== p.team)) return false;
      const cur = p.inv[w.slot];
      if (cur && cur.id === id) return false;
      if (!pay(w.price)) return false;
      if (cur) this.spawnDrop(p, cur, true);
      p.inv[w.slot] = { id, mag: w.mag, res: w.res };
      p.slot = w.slot;
      p.reloadUntil = 0;
      return true;
    }
    if (NADES[id]) {
      const total = NADE_ORDER.reduce((s, k) => s + p.nades[k], 0);
      if (p.nades[id] >= NADES[id].max || total >= MAX_NADES) return false;
      if (!pay(NADES[id].price)) return false;
      p.nades[id]++;
      return true;
    }
    if (id === 'vest') {
      if (p.armor >= 100) return false;
      if (!pay(EQUIPMENT.vest.price)) return false;
      p.armor = 100;
      return true;
    }
    if (id === 'vesthelm') {
      if (p.armor >= 100 && p.helmet) return false;
      const cost = p.armor >= 100 ? 350 : EQUIPMENT.vesthelm.price;
      if (!pay(cost)) return false;
      p.armor = 100; p.helmet = true;
      return true;
    }
    if (id === 'defuser') {
      if (p.team !== 'CT' || p.defuser) return false;
      if (!pay(EQUIPMENT.defuser.price)) return false;
      p.defuser = true;
      return true;
    }
    return false;
  }

  // ---------- granadas ----------
  onThrow(p, m) {
    if (!p.alive || this.phase === 'freeze') return;
    const g = String(m.g || '');
    if (!NADES[g] || p.nades[g] <= 0) return;
    const eye = [p.x, p.y + eyeHeight(p.crouch), p.z];
    let o = eye;
    if (Array.isArray(m.o) && m.o.length === 3 && m.o.every(Number.isFinite) &&
      Math.hypot(m.o[0] - eye[0], m.o[1] - eye[1], m.o[2] - eye[2]) < 2) o = m.o;
    let v = Array.isArray(m.v) && m.v.length === 3 && m.v.every(Number.isFinite) ? m.v : viewDir(p.yaw, p.pitch).map(c => c * 15);
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp > 24) v = v.map(c => c * 24 / sp);
    this.throwNade(p, g, o, v);
  }

  throwNade(p, g, o, v) {
    p.nades[g]--;
    if (p.slot === 4 && !NADE_ORDER.some(k => p.nades[k] > 0)) p.slot = this.bestSlot(p);
    const start = raycast(o, [v[0], v[1], v[2]].map(c => c / (Math.hypot(...v) || 1)), 0.3, BOXES) ? [p.x, p.y + 1.2, p.z] : o;
    this.nades.push({
      id: this.nextEnt++, type: g, x: start[0], y: start[1], z: start[2], vx: v[0], vy: v[1], vz: v[2],
      owner: p.id, team: p.team, born: now(), rest: 0,
    });
    this.broadcast({ t: 'snd', s: 'throw', x: r2(o[0]), y: r2(o[1]), z: r2(o[2]) }, p.isBot ? null : p);
  }

  updateNades(dt, t) {
    const R = 0.07;
    const steps = Math.ceil(dt / (1 / 120));
    const sdt = dt / steps;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      for (let s = 0; s < steps; s++) {
        n.vy -= GRAVITY * sdt;
        let bounced = false;
        for (const [k, vk] of [['x', 'vx'], ['y', 'vy'], ['z', 'vz']]) {
          const old = n[k];
          n[k] += n[vk] * sdt;
          const hitFloor = k === 'y' && n.y < R;
          if (hitFloor || findOverlap(n.x, n.y - R, n.z, R, R * 2, BOXES)) {
            n[k] = hitFloor ? R : old;
            n[vk] = -n[vk] * 0.42;
            if (k !== 'y') { n.vy *= 0.8; } else { n.vx *= 0.7; n.vz *= 0.7; }
            if (Math.abs(n[vk]) > 1.2) bounced = true;
          }
        }
        if (bounced && t - (n.lastBounce || 0) > 0.15) {
          n.lastBounce = t;
          this.broadcast({ t: 'snd', s: 'bounce', x: r2(n.x), y: r2(n.y), z: r2(n.z) });
        }
      }
      const speed = Math.hypot(n.vx, n.vy, n.vz);
      if (speed < 0.4) n.rest += dt; else n.rest = 0;
      const age = t - n.born;
      const fuse = n.type === 'smoke' ? (n.rest > 0.35 || age > 3.5) : age > 1.6;
      if (fuse) {
        this.nades.splice(i, 1);
        this.detonate(n, t);
      }
    }
  }

  detonate(n, t) {
    const pos = [n.x, n.y, n.z];
    const owner = this.players.get(n.owner) || null;
    this.broadcast({ t: 'boom', g: n.type, x: r2(n.x), y: r2(n.y), z: r2(n.z) });
    if (n.type === 'he') {
      const radius = 9;
      for (const q of this.players.values()) {
        if (!q.alive) continue;
        if (owner && q !== owner && q.team === owner.team) continue;
        const c = [q.x, q.y + 1.0, q.z];
        const dx = c[0] - pos[0], dy = c[1] - pos[1], dz = c[2] - pos[2];
        const d = Math.hypot(dx, dy, dz);
        if (d > radius) continue;
        if (d > 0.1 && raycast(pos, [dx / d, dy / d, dz / d], d, BOXES)) continue;
        let dmg = 98 * (1 - d / radius) ** 1.4;
        let armor = 0;
        if (q.armor > 0) { armor = Math.min(q.armor, Math.round(dmg * 0.25)); dmg *= 0.58; }
        dmg = Math.round(dmg);
        if (dmg > 0) this.applyDamage(q, owner, dmg, armor, 'he', false, pos);
      }
    } else if (n.type === 'smoke') {
      this.smokes.push({ x: n.x, y: n.y + 1.2, z: n.z, until: t + 18 });
    } else if (n.type === 'flash') {
      for (const b of this.players.values()) {
        if (!b.isBot || !b.alive) continue;
        const e = [b.x, b.y + eyeHeight(b.crouch), b.z];
        const dx = pos[0] - e[0], dy = pos[1] - e[1], dz = pos[2] - e[2];
        const d = Math.hypot(dx, dy, dz);
        if (d > 30 || raycast(e, [dx / d, dy / d, dz / d], d, BOXES)) continue;
        const v = viewDir(b.yaw, b.pitch);
        const dot = (v[0] * dx + v[1] * dy + v[2] * dz) / d;
        const dur = (dot > 0.5 ? 3.5 : dot > 0 ? 2 : 0.6) * (1 - d / 30);
        b.flashedUntil = Math.max(b.flashedUntil, t + dur);
      }
    }
  }

  // ¿Línea de visión libre (mapa + humo)?
  los(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3) return true;
    if (raycast(a, [dx / d, dy / d, dz / d], d, BOXES)) return false;
    for (const s of this.smokes) if (segmentHitsSphere(a, b, [s.x, s.y, s.z], 3.6)) return false;
    return true;
  }

  // ---------- bomba ----------
  updateUse(p, t) {
    if (!p.alive || !p.using || this.phase === 'freeze') {
      if (p.action) this.cancelAction(p);
      return;
    }
    if (!p.action) {
      if (p.team === 'T' && p.bomb && this.phase === 'live' && siteAt(p.x, p.z) && p.y < 3) {
        p.action = { type: 'plant', start: t, x: p.x, z: p.z };
        this.broadcast({ t: 'snd', s: 'plantstart', x: r2(p.x), y: r2(p.y + 0.5), z: r2(p.z) });
      } else if (p.team === 'CT' && this.bomb.state === 'planted' && !this.bomb.defuser &&
        Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 2 && Math.abs(p.y - this.bomb.y) < 2) {
        p.action = { type: 'defuse', start: t, x: p.x, z: p.z };
        this.bomb.defuser = p.id;
        this.bomb.defuseKit = p.defuser;
        this.bomb.defuseStart = t;
        this.broadcast({ t: 'snd', s: 'defusestart', x: r2(p.x), y: r2(p.y + 0.5), z: r2(p.z) });
      } else return;
    }
    const a = p.action;
    if (Math.hypot(p.x - a.x, p.z - a.z) > 0.7) { this.cancelAction(p); return; }
    const dur = a.type === 'plant' ? T.plant : (p.defuser ? T.defuseKit : T.defuse);
    if (t - a.start >= dur) {
      p.action = null;
      p.using = false;
      if (a.type === 'plant') this.plantBomb(p, t); else this.defuseBomb(p);
    }
  }

  cancelAction(p) {
    if (p.action?.type === 'defuse' && this.bomb.defuser === p.id) this.bomb.defuser = null;
    p.action = null;
  }

  actionProgress(p, t) {
    if (!p.action) return 0;
    const dur = p.action.type === 'plant' ? T.plant : (p.defuser ? T.defuseKit : T.defuse);
    return clamp((t - p.action.start) / dur, 0, 1);
  }

  plantBomb(p, t) {
    p.bomb = false;
    if (p.slot === 5) p.slot = this.bestSlot(p);
    const site = siteAt(p.x, p.z);
    this.bomb = { state: 'planted', x: p.x, y: p.y, z: p.z, site, explodeAt: t + T.bomb, plantedAt: t, defuser: null, planter: p.id };
    this.phaseEnd = this.bomb.explodeAt;
    p.money = Math.min(ECONOMY.max, p.money + ECONOMY.plantBonus);
    this.centerMsg(`¡La bomba ha sido plantada en el sitio ${site}!`, 'bomb');
    this.broadcast({ t: 'planted', site, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
    for (const q of this.players.values()) if (q.isBot) q.ai.onBombPlanted();
  }

  defuseBomb(p) {
    this.bomb.state = 'defused';
    this.bomb.defuser = null;
    p.money = Math.min(ECONOMY.max, p.money + 300);
    this.broadcast({ t: 'defused', id: p.id });
    this.endRound('CT', 'defuse', p);
  }

  updateBomb(t) {
    if (this.bomb.state !== 'planted') return;
    if (t < this.bomb.explodeAt) return;
    const b = this.bomb;
    b.state = 'exploded';
    this.broadcast({ t: 'boom', g: 'c4', x: r2(b.x), y: r2(b.y), z: r2(b.z) });
    const planter = this.players.get(b.planter) || null;
    const sigma = 25 / 3;
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y, q.z - b.z);
      let dmg = 500 * Math.exp(-(d * d) / (2 * sigma * sigma));
      if (dmg < 1) continue;
      let armor = 0;
      if (q.armor > 0) { armor = Math.min(q.armor, Math.round(dmg * 0.25)); dmg *= 0.5; }
      this.applyDamage(q, planter && planter.team !== q.team ? planter : null, Math.round(dmg), armor, 'bomb', false, [b.x, b.y, b.z]);
    }
    if (this.phase === 'live') this.endRound('T', 'bomb', planter);
  }

  // ---------- rondas ----------
  bothTeamsPresent() {
    return this.teamMembers('T').length > 0 && this.teamMembers('CT').length > 0;
  }

  startRound() {
    const t = now();
    if (this.halftimePending) {
      this.halftimePending = false;
      for (const p of this.players.values()) {
        if (p.team === 'T') p.team = 'CT'; else if (p.team === 'CT') p.team = 'T';
        p.money = ECONOMY.start;
        this.resetInventory(p);
        p.alive = false;
      }
      this.score = { T: this.score.CT, CT: this.score.T };
      this.lossStreak = { T: 0, CT: 0 };
      this.centerMsg('Descanso: cambio de bandos', 'info');
    }
    this.round++;
    this.rebalanceBots(true);
    this.drops = [];
    this.nades = [];
    this.smokes = [];
    this.bomb = { state: 'none' };
    this.phase = 'freeze';
    this.phaseEnd = t + T.freeze;
    this.buyEnd = t + T.buy;
    for (const team of ['T', 'CT']) {
      const members = shuffle(this.teamMembers(team));
      members.forEach((p, i) => {
        if (!p.alive) this.resetInventory(p);
        p.bomb = false;
        this.spawn(p, i);
      });
    }
    const ts = this.teamMembers('T');
    if (ts.length) {
      const humans = ts.filter(p => !p.isBot);
      const pool = humans.length && Math.random() < 0.7 ? humans : ts;
      const carrier = pool[(Math.random() * pool.length) | 0] || ts[0];
      carrier.bomb = true;
      this.bomb = { state: 'carried', carrier: carrier.id };
      this.send(carrier, { t: 'msg', text: 'Llevas la bomba (5). Plántala en A o B con E', kind: 'info' });
    }
    this.broadcast({ t: 'rstart', r: this.round, sc: this.score });
    for (const p of this.players.values()) if (p.isBot && p.alive) p.ai.onRoundStart();
    this.sendRoster();
  }

  endRound(winner, reason, hero = null) {
    if (this.phase !== 'live' && this.phase !== 'freeze') return;
    const t = now();
    const loser = other(winner);
    this.phase = 'post';
    this.phaseEnd = t + T.post;
    this.score[winner]++;
    this.lossStreak[winner] = 0;
    this.lossStreak[loser] = Math.min(this.lossStreak[loser] + 1, 5);
    const winMoney = reason === 'bomb' || reason === 'defuse' ? ECONOMY.winObjective : ECONOMY.win;
    let lossMoney = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * (this.lossStreak[loser] - 1));
    for (const p of this.players.values()) {
      if (p.team === winner) p.money = Math.min(ECONOMY.max, p.money + winMoney);
      else if (p.team === loser) {
        let m = lossMoney;
        if (loser === 'T' && this.bomb.planter) m += ECONOMY.plantLossBonus;
        p.money = Math.min(ECONOMY.max, p.money + m);
      }
    }
    // MVP: el héroe del objetivo o quien más bajas hizo en la ronda
    const mvp = hero && hero.team === winner ? hero : null;
    if (mvp) mvp.mvps++;
    this.broadcast({ t: 'rend', w: winner, r: reason, sc: this.score, mvp: mvp ? mvp.id : -1 });
    if (this.score[winner] >= WIN_ROUNDS) {
      this.matchOver = winner;
      this.phaseEnd = t + T.matchEnd;
      this.centerMsg(`¡${winner === 'T' ? 'Los Terroristas' : 'Los Antiterroristas'} ganan la partida!`, 'match');
    } else if (this.round === HALF_ROUNDS) {
      this.halftimePending = true;
    }
    this.sendRoster();
  }

  resetMatch() {
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.matchOver = null;
    this.halftimePending = false;
    for (const p of this.players.values()) {
      p.money = ECONOMY.start;
      p.kills = p.deaths = p.assists = p.mvps = 0;
      this.resetInventory(p);
      p.alive = false;
    }
    this.centerMsg('¡Comienza la partida!', 'info');
    this.startRound();
  }

  checkRoundEnd() {
    if (this.phase !== 'live') return;
    const ts = this.teamMembers('T'), cts = this.teamMembers('CT');
    if (!ts.length || !cts.length) return;
    const tAlive = ts.filter(p => p.alive).length;
    const ctAlive = cts.filter(p => p.alive).length;
    if (ctAlive === 0) this.endRound('T', 'elim');
    else if (tAlive === 0 && this.bomb.state !== 'planted') this.endRound('CT', 'elim');
  }

  enterWarmup() {
    this.phase = 'warmup';
    this.phaseEnd = now() + T.warmup;
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.bomb = { state: 'none' };
    for (const p of this.players.values()) {
      p.money = 10000;
      if (p.team !== 'SPEC' && !p.alive) this.spawn(p, (Math.random() * 10) | 0);
    }
    this.centerMsg('Calentamiento — esperando jugadores', 'info');
  }

  // ---------- chat y comandos ----------
  onChat(p, m) {
    const t = now();
    p.chatTimes = p.chatTimes.filter(x => t - x < 5);
    if (p.chatTimes.length >= 5) return;
    p.chatTimes.push(t);
    const msg = String(m.msg || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    if (!msg) return;
    if (msg[0] === '/' || msg[0] === '!') { this.command(p, msg.slice(1).split(/\s+/)); return; }
    const out = { t: 'chat', id: p.id, name: p.name, team: p.team, msg, tm: m.tm ? 1 : 0, dead: p.alive ? 0 : 1 };
    const s = JSON.stringify(out);
    for (const q of this.players.values()) if (!m.tm || q.team === p.team) this.send(q, s);
  }

  command(p, [cmd, ...args]) {
    const reply = text => this.send(p, { t: 'chat', name: '', msg: text, sys: 1 });
    const isAdmin = p.isAdmin || !this.config.adminPassword;
    switch ((cmd || '').toLowerCase()) {
      case 'help':
        reply('Comandos: /login <clave>, /bots <0-5>, /skill <0-1>, /kick <nombre>, /restart, /admin');
        return;
      case 'admin':
        reply(`Administrador del servidor: ${this.config.adminEmail}`);
        return;
      case 'login':
        if (this.config.adminPassword && args[0] === this.config.adminPassword) {
          p.isAdmin = true;
          reply('Sesión de administrador iniciada');
        } else reply('Clave incorrecta');
        return;
    }
    if (!isAdmin) { reply('Necesitas ser administrador (/login <clave>)'); return; }
    switch ((cmd || '').toLowerCase()) {
      case 'bots': {
        const n = clamp(parseInt(args[0], 10) || 0, 0, 5);
        this.botTarget = n;
        this.rebalanceBots(this.phase !== 'live');
        this.systemMsg(`Bots por equipo: ${n}`);
        this.sendRoster();
        break;
      }
      case 'skill': {
        const s = clamp(parseFloat(args[0]) || 0.5, 0, 1);
        this.botSkill = s;
        for (const q of this.players.values()) if (q.isBot) q.ai.skill = s;
        this.systemMsg(`Habilidad de bots: ${s}`);
        break;
      }
      case 'kick': {
        const name = args.join(' ').toLowerCase();
        for (const q of this.players.values()) {
          if (q.name.toLowerCase() === name && q !== p) {
            if (q.ws) { this.send(q, { t: 'kicked' }); q.ws.close(); } else this.removePlayer(q);
            this.systemMsg(`${q.name} fue expulsado`);
            break;
          }
        }
        break;
      }
      case 'restart':
        this.systemMsg('Reiniciando partida...');
        this.resetMatch();
        break;
      default:
        reply('Comando desconocido. Usa /help');
    }
  }

  // ---------- bucle ----------
  computeSpotted() {
    const alive = [...this.players.values()].filter(p => p.alive);
    for (const q of alive) {
      q.spotted = false;
      const c = [q.x, q.y + 1.2, q.z];
      for (const e of alive) {
        if (e.team === q.team) continue;
        const eye = [e.x, e.y + eyeHeight(e.crouch), e.z];
        if (Math.hypot(eye[0] - c[0], eye[2] - c[2]) > 80) continue;
        if (this.los(eye, c)) { q.spotted = true; break; }
      }
    }
  }

  tick(dt) {
    const t = now();
    this.tickCount++;
    switch (this.phase) {
      case 'warmup':
        for (const p of this.players.values()) {
          if (!p.alive && p.team !== 'SPEC' && t - p.deadAt > T.warmupRespawn) { this.resetInventory(p); this.spawn(p, (Math.random() * 10) | 0); }
        }
        if (!this.bothTeamsPresent()) this.phaseEnd = Math.max(this.phaseEnd, t + 5);
        else if (t >= this.phaseEnd) this.resetMatch();
        break;
      case 'freeze':
        if (t >= this.phaseEnd) { this.phase = 'live'; this.phaseEnd = t + T.round; this.roundStartT = t; }
        break;
      case 'live':
        if (!this.bothTeamsPresent()) { this.enterWarmup(); break; }
        if (this.bomb.state !== 'planted' && t >= this.phaseEnd) this.endRound('CT', 'time');
        break;
      case 'post':
        if (t >= this.phaseEnd) {
          if (!this.bothTeamsPresent()) this.enterWarmup();
          else if (this.matchOver) this.resetMatch();
          else this.startRound();
        }
        break;
    }
    this.updateBomb(t);
    this.smokes = this.smokes.filter(s => s.until > t);
    for (const p of this.players.values()) {
      if (p.reloadUntil && t >= p.reloadUntil) this.finishReload(p);
      if (p.isBot) {
        p.ai.think(dt, t);
        if (p.alive) this.pushHist(p, t);
      }
      this.updateUse(p, t);
    }
    this.updateNades(dt, t);
    this.autoPickups(t);
    if (this.tickCount % 4 === 0) this.computeSpotted();
    if (this.tickCount % 2 === 0) this.sendSnapshots(t);
    if (this.tickCount % 40 === 0) this.sendRoster();
  }

  timeLeft(t) {
    if (this.phase === 'live' && this.bomb.state === 'planted') return Math.max(0, this.bomb.explodeAt - t);
    return Math.max(0, this.phaseEnd - t);
  }

  sendSnapshots(t) {
    const players = [];
    for (const p of this.players.values()) {
      if (p.team === 'SPEC') continue;
      const flags = (p.alive ? 1 : 0) | (p.crouch ? 2 : 0) | (p.spotted ? 4 : 0) | (p.bomb ? 8 : 0) |
        (p.action ? 16 : 0) | (p.scoped ? 32 : 0) | (p.reloadUntil ? 64 : 0);
      players.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), flags, this.weaponIdOf(p), p.hp]);
    }
    const b = this.bomb;
    const bomb = b.state === 'none' ? null : {
      s: b.state, x: r2(b.x ?? 0), y: r2(b.y ?? 0), z: r2(b.z ?? 0), c: b.carrier ?? -1, site: b.site || null,
      tl: b.state === 'planted' ? r2(Math.max(0, b.explodeAt - t)) : 0,
      dp: b.defuser ? r2(clamp((t - b.defuseStart) / (b.defuseKit ? T.defuseKit : T.defuse), 0, 1)) : -1,
    };
    const common = {
      t: 's', time: Math.round(t * 1000), ph: this.phase, tl: r2(this.timeLeft(t)), sc: this.score, rn: this.round,
      p: players, b: bomb,
      n: this.nades.map(n => [n.id, n.type, r2(n.x), r2(n.y), r2(n.z)]),
      d: this.drops.map(d => [d.id, d.item.id, r2(d.x), r2(d.y), r2(d.z)]),
    };
    const base = JSON.stringify(common).slice(0, -1);
    for (const p of this.players.values()) {
      if (!p.ws) continue;
      const me = {
        hp: p.hp, ar: p.armor, hm: p.helmet ? 1 : 0, mo: p.money, sl: p.slot, tm: p.team, al: p.alive ? 1 : 0, sp: p.spawnSeq,
        i1: p.inv[1] ? [p.inv[1].id, p.inv[1].mag, p.inv[1].res] : null,
        i2: p.inv[2] ? [p.inv[2].id, p.inv[2].mag, p.inv[2].res] : null,
        nd: [p.nades.he, p.nades.flash, p.nades.smoke], bm: p.bomb ? 1 : 0, df: p.defuser ? 1 : 0,
        rl: p.reloadUntil ? r2(Math.max(0, p.reloadUntil - t)) : 0,
        act: p.action ? p.action.type : 0, pr: r2(this.actionProgress(p, t)), cb: this.canBuy(p) ? 1 : 0,
        bt: r2(Math.max(0, this.buyEnd - t)),
      };
      this.send(p, base + ',"me":' + JSON.stringify(me) + '}');
    }
  }

  sendRoster() {
    const list = [...this.players.values()];
    for (const viewer of list) {
      if (!viewer.ws) continue;
      const players = list.map(p => ({
        id: p.id, n: p.name, tm: p.team, b: p.isBot ? 1 : 0, k: p.kills, d: p.deaths, a: p.assists, mvp: p.mvps,
        pg: p.isBot ? 0 : p.ping, al: p.alive ? 1 : 0,
        m: p.team === viewer.team || viewer.team === 'SPEC' ? p.money : -1,
      }));
      this.send(viewer, { t: 'roster', players, sc: this.score, rn: this.round, bots: this.botTarget });
    }
  }

  info() {
    return {
      name: this.name, humans: this.humanCount(), players: this.players.size, round: this.round,
      score: this.score, phase: this.phase, maxHumans: this.config.maxHumans,
    };
  }
}
