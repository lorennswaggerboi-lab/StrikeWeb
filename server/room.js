// Partida autoritativa: veto de mapas estilo Premier, rondas competitivas (MR12 + prórrogas),
// economía, disparos con compensación de lag y penetración, granadas, bomba, bots y estadísticas.
import { performance } from 'perf_hooks';
import { getMap, MAP_IDS, siteAt, BUY_RADIUS, doorBox } from '../shared/maps.js';
import { WEAPONS, NADES, NADE_ORDER, MAX_NADES, EQUIPMENT, ECONOMY, damageFalloff } from '../shared/weapons.js';
import {
  raycast, rayPlayer, rayBoxExit, findOverlap, eyeHeight, viewDir, segmentHitsSphere,
  PLAYER_RADIUS, STAND_HEIGHT, CROUCH_HEIGHT, GRAVITY,
} from '../shared/physics.js';
import { BotBrain } from './bot.js';
import { Nav } from './nav.js';

export const now = () => performance.now() / 1000;

const T = {
  warmupPublic: 40, warmupPrivate: 90, warmupFull: 8, voteTurn: 12, voteReveal: 5,
  freeze: 12, round: 115, bomb: 40, plant: 3.2, defuse: 10, defuseKit: 5,
  post: 6, buy: 20, halftime: 12, matchEnd: 15, warmupRespawn: 2,
};
const BAN_ORDER = ['CT', 'T', 'CT', 'T'];
const MAX_TEAM_HUMANS = 5;
const PENETRABLE = new Set(['crate', 'barrel', 'lowwall', 'container', 'woodpanel', 'door']);
const MATCH_PHASES = new Set(['freeze', 'live', 'post', 'halftime']);

const BOT_NAMES = [
  'Alfredo', 'Nico', 'Chispa', 'Tango', 'Rayo', 'Coyote', 'Piraña', 'Halcón', 'Sombra', 'Toro',
  'Lince', 'Puma', 'Cobra', 'Bala', 'Trueno', 'Gato', 'Zorro', 'Mamba', 'Lobo', 'Jaguar',
];

const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const other = team => (team === 'T' ? 'CT' : 'T');
const pick = arr => arr[(Math.random() * arr.length) | 0];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const emptyStats = () => ({ kills: 0, deaths: 0, assists: 0, mvps: 0, dmg: 0, hs: 0, score: 0 });

export class Room {
  constructor(id, { isPrivate = false, owner = null, config, onClose, onMatchEnd }) {
    this.id = id;
    this.isPrivate = isPrivate;
    this.owner = owner;
    this.config = config;
    this.onClose = onClose;
    this.onMatchEnd = onMatchEnd;
    this.players = new Map();
    this.records = new Map();
    this.nextId = 1;
    this.nextEnt = 1;
    this.botTarget = config.botsPerTeam;
    this.botSkill = config.botSkill;
    this.botNameIdx = (Math.random() * BOT_NAMES.length) | 0;
    this.tickCount = 0;
    this.closed = false;
    this.loadMap(pick(MAP_IDS));
    this.resetRoundState();
    this.score = { T: 0, CT: 0 };
    this.history = [];
    this.round = 0;
    this.phase = 'warmup';
    this.phaseEnd = now() + (isPrivate ? T.warmupPrivate : T.warmupPublic);
    this.vote = null;
    this.intel = { T: null, CT: null };
    this.rebalanceBots(true);
  }

  loadMap(id) {
    this.map = getMap(id);
    this.nav = new Nav(this.map);
    this.doorOpen = this.map.doors.map(() => 0);
    this.doorTarget = this.map.doors.map(() => 0);
    this.rebuildDoors();
    // al aparecer, mirar hacia la salida del spawn (primer tramo de la ruta hacia el rival)
    this.spawnLook = {};
    for (const team of ['T', 'CT']) {
      const [sx, sz] = this.map.spawnCenter[team];
      const [ex, ez] = this.map.spawnCenter[other(team)];
      const path = this.nav.findPath(sx, sz, ex, ez);
      this.spawnLook[team] = path.find(pt => Math.hypot(pt[0] - sx, pt[1] - sz) > 8) || [ex, ez];
    }
  }

  // Sólidos para balas/visión (mapa + puertas) y colisión de movimiento (además, vallas invisibles).
  rebuildDoors() {
    const doors = this.map.doors.map((d, i) => doorBox(d, this.doorOpen[i]));
    this.boxes = [...this.map.boxes, ...doors];
    this.collide = [...this.boxes, ...this.map.clips];
  }

  tryDoor(p) {
    const view = viewDir(p.yaw, 0);
    let best = -1, bestD = 2.6;
    this.map.doors.forEach((d, i) => {
      const b = doorBox(d, this.doorOpen[i]);
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      const dist = Math.hypot(cx - p.x, cz - p.z);
      if (dist > bestD) return;
      if (dist > 0.8 && ((cx - p.x) * view[0] + (cz - p.z) * view[2]) / dist < 0.2) return;
      best = i; bestD = dist;
    });
    if (best < 0) return false;
    this.setDoor(best, this.doorTarget[best] > 0.5 ? 0 : 1);
    return true;
  }

  setDoor(i, target) {
    if (this.doorTarget[i] === target) return;
    this.doorTarget[i] = target;
    const d = this.map.doors[i];
    this.broadcast({ t: 'snd', s: 'door', x: r2((d.min[0] + d.max[0]) / 2), y: 1.5, z: r2((d.min[2] + d.max[2]) / 2), o: target });
  }

  updateDoors(dt) {
    let changed = false;
    this.map.doors.forEach((d, i) => {
      const cur = this.doorOpen[i], tgt = this.doorTarget[i];
      if (cur === tgt) return;
      const next = tgt > cur ? Math.min(tgt, cur + dt / 0.9) : Math.max(tgt, cur - dt / 0.9);
      if (next < cur) {
        // no cerrar sobre un jugador: la puerta vuelve a abrirse
        const b = doorBox(d, next);
        for (const q of this.players.values()) {
          if (q.alive && findOverlap(q.x, q.y, q.z, PLAYER_RADIUS, q.crouch ? CROUCH_HEIGHT : STAND_HEIGHT, [b])) { this.doorTarget[i] = 1; return; }
        }
      }
      this.doorOpen[i] = next;
      changed = true;
    });
    if (changed) this.rebuildDoors();
  }

  resetRoundState() {
    this.bomb = { state: 'none' };
    this.nades = [];
    this.smokes = [];
    this.fires = [];
    this.drops = [];
    this.rdmg = new Map();
    this.nav?.setDanger([]);
  }

  // ---------- jugadores ----------
  createPlayer(name, isBot) {
    return {
      id: this.nextId++, name, isBot, session: null, account: null, avatar: null, rating: 0, team: 'SPEC',
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, h: STAND_HEIGHT, onGround: true,
      yaw: 0, pitch: 0, crouch: false, scoped: false,
      alive: false, hp: 0, armor: 0, helmet: false, defuser: false,
      money: this.phase === 'warmup' ? 16000 : ECONOMY.start,
      st: emptyStats(), roundKills: 0,
      inv: { 1: null, 2: null, 3: { id: 'knife' } }, nades: this.emptyNades(), bomb: false,
      slot: 2, lastShot: 0, reloadUntil: 0, reloadSlot: 0,
      hist: [], dmgBy: {}, flashedUntil: 0, ping: 0, spawnSeq: 0, fireAcc: 0,
      lastInputT: 0, using: false, action: null, deadAt: 0, spotted: false,
      chatTimes: [], partyId: null, ai: null,
    };
  }

  emptyNades() { return Object.fromEntries(NADE_ORDER.map(k => [k, 0])); }

  humans() { return [...this.players.values()].filter(p => !p.isBot); }
  humanCount() { return this.humans().length; }
  teamMembers(team) { return [...this.players.values()].filter(p => p.team === team); }
  teamHumans(team) { return this.teamMembers(team).filter(p => !p.isBot).length; }

  // ¿Puede entrar un grupo de n personas? Devuelve el equipo o null.
  slotFor(n) {
    if (this.closed || this.phase === 'matchend') return null;
    const t = this.teamHumans('T'), c = this.teamHumans('CT');
    const opts = [];
    if (t + n <= MAX_TEAM_HUMANS) opts.push(['T', t]);
    if (c + n <= MAX_TEAM_HUMANS) opts.push(['CT', c]);
    if (!opts.length) return null;
    opts.sort((a, b) => a[1] - b[1]);
    return opts[0][0];
  }

  addHuman(session, teamPref) {
    const user = session.user;
    const rec = this.records.get(user.name.toLowerCase());
    const p = this.createPlayer(user.name, false);
    p.session = session;
    p.account = user.name;
    p.avatar = user.avatar || null;
    p.rating = user.stats?.rating ?? 1000;
    p.partyId = session.party?.code || null;
    this.players.set(p.id, p);
    let team = teamPref === 'T' || teamPref === 'CT' ? teamPref : this.slotFor(1) || 'T';
    if (rec && MATCH_PHASES.has(this.phase)) {
      team = rec.team;
      p.st = rec.st;
      p.money = rec.money;
      this.records.delete(user.name.toLowerCase());
    }
    this.send(p, {
      t: 'welcome', id: p.id, room: this.id, private: this.isPrivate, owner: this.owner, map: this.map.id,
      adminEmail: this.config.adminEmail, vote: this.voteState(),
      avatars: [...this.players.values()].filter(q => q.avatar).map(q => [q.id, q.avatar]),
    });
    if (p.avatar) this.broadcast({ t: 'avatar', id: p.id, av: p.avatar }, p);
    this.setTeam(p, team, true);
    this.systemMsg(`${p.name} se ha unido${rec ? ' (reconectado)' : ''}`);
    this.rebalanceBots(this.phase === 'warmup' || this.phase === 'mapvote');
    if (this.phase === 'warmup' && !this.isPrivate && this.humanCount() >= 10) this.phaseEnd = Math.min(this.phaseEnd, now() + T.warmupFull);
    this.sendRoster();
    return p;
  }

  removePlayer(p, reason = 'ha salido') {
    if (!this.players.has(p.id)) return;
    if (p.alive) this.dropEverything(p);
    if (this.bomb.defuser === p.id) this.bomb.defuser = null;
    if (!p.isBot && MATCH_PHASES.has(this.phase) && p.team !== 'SPEC') {
      this.records.set(p.account.toLowerCase(), { team: p.team, st: p.st, money: p.money });
    }
    this.players.delete(p.id);
    if (!p.isBot) {
      this.systemMsg(`${p.name} ${reason}`);
      if (this.owner && p.account === this.owner) {
        const next = this.humans()[0];
        this.owner = next ? next.account : null;
        if (next) this.broadcast({ t: 'owner', owner: this.owner });
      }
      if (this.humanCount() === 0) { this.close(); return; }
      this.rebalanceBots(this.phase === 'warmup' || this.phase === 'mapvote');
    }
    this.checkRoundEnd();
    this.sendRoster();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.onClose?.(this);
  }

  setTeam(p, team, initial = false) {
    if (p.team === team && !initial) return;
    if (p.alive && !initial) {
      this.dropEverything(p);
      p.alive = false;
      p.deadAt = now();
    }
    p.team = team;
    this.resetInventory(p);
    if (team === 'SPEC') return;
    if (this.phase === 'warmup' || this.phase === 'mapvote' || this.phase === 'freeze') {
      this.spawn(p, this.teamMembers(team).length - 1);
      if (this.phase === 'freeze' && p.isBot) p.ai.onRoundStart();
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
    // en partidas públicas solo se puede cambiar durante el calentamiento
    if (!this.isPrivate && this.phase !== 'warmup') {
      this.send(p, { t: 'msg', text: 'Solo puedes cambiar de equipo durante el calentamiento', kind: 'info' });
      return;
    }
    if (team !== 'SPEC' && this.teamHumans(team) >= MAX_TEAM_HUMANS) {
      this.send(p, { t: 'msg', text: 'Ese equipo está completo', kind: 'info' });
      return;
    }
    const t = now();
    if (t - (p.lastTeamChange || 0) < 2) return;
    p.lastTeamChange = t;
    this.setTeam(p, team);
    this.systemMsg(`${p.name} se cambió a ${team === 'T' ? 'Terroristas' : team === 'CT' ? 'Antiterroristas' : 'Espectadores'}`);
    this.rebalanceBots(this.phase === 'warmup' || this.phase === 'mapvote');
    this.sendRoster();
  }

  resetInventory(p) {
    const pistol = p.team === 'CT' ? 'usp' : 'glock';
    const w = WEAPONS[pistol];
    p.inv = { 1: null, 2: { id: pistol, mag: w.mag, res: w.res }, 3: { id: 'knife' } };
    p.nades = this.emptyNades();
    p.bomb = false;
    p.armor = 0;
    p.helmet = false;
    p.defuser = false;
    p.slot = 2;
    p.reloadUntil = 0;
  }

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
        const ordered = [...bots].sort((a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0));
        for (const b of ordered) {
          if (extra <= 0) break;
          if (b.alive && !immediate && this.phase === 'live') continue;
          this.players.delete(b.id);
          if (b.alive) this.dropEverything(b);
          extra--;
        }
      }
    }
  }

  addBot(team) {
    const name = 'BOT ' + BOT_NAMES[this.botNameIdx++ % BOT_NAMES.length];
    const b = this.createPlayer(name, true);
    b.ai = new BotBrain(this, b, this.botSkill);
    b.rating = 0;
    this.players.set(b.id, b);
    b.team = team;
    this.resetInventory(b);
    if (this.phase === 'warmup' || this.phase === 'mapvote' || this.phase === 'freeze') {
      this.spawn(b, this.teamMembers(team).length - 1);
      if (this.phase === 'freeze') b.ai.onRoundStart();
    } else {
      b.alive = false;
      b.deadAt = now();
    }
    return b;
  }

  spawn(p, idx) {
    const list = this.map.spawns[p.team];
    const [sx, sz] = list[((idx % list.length) + list.length) % list.length];
    p.x = sx + (Math.random() - 0.5) * 0.4;
    p.z = sz + (Math.random() - 0.5) * 0.4;
    p.y = 0;
    p.vx = p.vy = p.vz = 0;
    p.h = STAND_HEIGHT;
    p.crouch = false;
    p.scoped = false;
    const c = this.spawnLook[p.team];
    p.yaw = Math.atan2(-(c[0] - p.x), -(c[1] - p.z));
    p.pitch = 0;
    p.alive = true;
    p.hp = 100;
    p.flashedUntil = 0;
    p.action = null;
    p.using = false;
    p.reloadUntil = 0;
    p.dmgBy = {};
    p.fireAcc = 0;
    p.spawnSeq++;
    p.hist = [{ t: now(), x: p.x, y: p.y, z: p.z, c: false }];
    p.lastInputT = now();
    if (p.slot <= 3 && !p.inv[p.slot]) p.slot = this.bestSlot(p);
    if (this.phase === 'warmup' || this.phase === 'mapvote') p.money = 16000;
    this.send(p, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw, sp: p.spawnSeq });
    if (p.isBot) p.ai.onSpawn();
  }

  bestSlot(p) { return p.inv[1] ? 1 : p.inv[2] ? 2 : 3; }

  // ---------- red ----------
  send(p, obj) {
    if (p.session) p.session.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }

  broadcast(obj, except = null) {
    const s = JSON.stringify(obj);
    for (const p of this.players.values()) if (p !== except && p.session) p.session.send(s);
  }

  systemMsg(text) { this.broadcast({ t: 'chat', name: '', msg: text, sys: 1 }); }
  centerMsg(text, kind = 'info') { this.broadcast({ t: 'msg', text, kind }); }

  onMessage(p, m) {
    switch (m.t) {
      case 'i': this.onInput(p, m); break;
      case 'f': this.onFire(p, m); break;
      case 'r': this.startReload(p); break;
      case 'w': this.switchSlot(p, m.s | 0); break;
      case 'b': this.buy(p, String(m.item || '')); break;
      case 'rf': this.refund(p, String(m.item || '')); break;
      case 'g': this.onThrow(p, m); break;
      case 'u':
        p.using = !!m.on;
        if (m.on && p.alive && !this.nearObjective(p) && !this.tryDoor(p)) this.tryPickup(p);
        break;
      case 'd': this.dropCurrent(p); break;
      case 'team': this.changeTeam(p, m.team); break;
      case 'c': this.onChat(p, m); break;
      case 'vote': this.onVote(p, String(m.map || '')); break;
      case 'host': this.onHost(p, m); break;
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
    p.walking = !!m.wk;
    if (!p.alive || m.sp !== p.spawnSeq) return;
    const crouch = !!m.c;
    if (this.phase === 'freeze' || this.phase === 'halftime') { p.crouch = crouch; return; }
    const x = num(m.x, NaN), y = num(m.y, NaN), z = num(m.z, NaN);
    if (!Number.isFinite(x + y + z)) return;
    const t = now();
    const dtv = Math.max(0.033, t - p.lastInputT);
    const dist = Math.hypot(x - p.x, z - p.z);
    const h = crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (dist > 9.5 * dtv + 1.2 || y < -0.5 || y > 12 ||
      findOverlap(x, y + 0.08, z, PLAYER_RADIUS - 0.12, h - 0.16, this.collide)) {
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
  currentItem(p) { return p.slot <= 3 ? p.inv[p.slot] : null; }

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
    this.broadcast({ t: 'snd', s: 'reload', id: p.id, x: r2(p.x), y: r2(p.y + 1), z: r2(p.z) }, p);
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
    if (!p.alive || this.phase === 'freeze' || this.phase === 'halftime') return;
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
      if (Math.hypot(m.o[0] - eye[0], m.o[1] - eye[1], m.o[2] - eye[2]) < 1.6) o = m.o;
    }
    if (w.cat === 'knife') {
      p.lastShot = t;
      this.knifeAttack(p, o, alt, rt);
      return;
    }
    if (item.mag <= 0) return;
    const view = viewDir(p.yaw, p.pitch);
    const dirs = [];
    if (Array.isArray(m.d)) {
      for (const d of m.d.slice(0, w.pellets || 1)) {
        if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) continue;
        const len = Math.hypot(d[0], d[1], d[2]);
        if (len < 0.5) continue;
        const nd = [d[0] / len, d[1] / len, d[2] / len];
        if (nd[0] * view[0] + nd[1] * view[1] + nd[2] * view[2] < Math.cos(0.7)) continue;
        dirs.push(nd);
      }
    }
    if (!dirs.length) return;
    item.mag--;
    p.lastShot = t;
    this.fireBullets(p, o, dirs, w, item.id, rt);
  }

  // Trazado con penetración: atraviesa cajas/contenedores finos perdiendo daño.
  traceBullet(p, o, d, w, rt) {
    let origin = o, remaining = w.range || 250, mul = 1, pens = 0, traveled = 0;
    const marks = [];
    for (let seg = 0; seg < 3; seg++) {
      const mh = raycast(origin, d, remaining, this.boxes);
      let tMax = mh ? mh.t : remaining;
      let victim = null, group = null;
      for (const q of this.players.values()) {
        if (q === p || !q.alive) continue;
        const pose = this.poseAt(q, rt);
        const hit = rayPlayer(origin, d, tMax, pose.x, pose.y, pose.z, pose.c);
        if (hit && hit.t < tMax) { tMax = hit.t; victim = q; group = hit.group; }
      }
      const end = [origin[0] + d[0] * tMax, origin[1] + d[1] * tMax, origin[2] + d[2] * tMax];
      if (victim) return { end, victim, group, dist: traveled + tMax, mul, wb: pens > 0, marks };
      if (!mh) return { end, victim: null, kind: 2, marks };
      if (!PENETRABLE.has(mh.box.mat) || !w.pen) return { end, victim: null, kind: 0, marks };
      const inside = [end[0] + d[0] * 0.001, end[1] + d[1] * 0.001, end[2] + d[2] * 0.001];
      const thick = rayBoxExit(inside, d, mh.box);
      if (thick > w.pen) return { end, victim: null, kind: 0, marks };
      marks.push(end.map(r2));
      mul *= Math.max(0.2, 0.6 - thick * 0.15);
      pens++;
      traveled += tMax + thick;
      remaining -= tMax + thick + 0.01;
      origin = [inside[0] + d[0] * (thick + 0.01), inside[1] + d[1] * (thick + 0.01), inside[2] + d[2] * (thick + 0.01)];
      if (remaining <= 0) return { end: origin, victim: null, kind: 2, marks };
    }
    return { end: origin, victim: null, kind: 2, marks };
  }

  fireBullets(p, o, dirs, w, wid, rt) {
    const ends = [];
    const dmgMap = new Map();
    for (const d of dirs) {
      const r = this.traceBullet(p, o, d, w, rt);
      for (const mk of r.marks) ends.push([...mk, 3]);
      ends.push([r2(r.end[0]), r2(r.end[1]), r2(r.end[2]), r.victim ? 1 : r.kind]);
      if (r.victim && r.victim.team !== p.team) {
        const res = this.calcDamage(w, r.dist, r.group, r.victim, r.mul);
        const prev = dmgMap.get(r.victim) || { dmg: 0, armor: 0, hs: false, wb: false, hits: 0 };
        prev.dmg += res.dmg; prev.armor += res.armor; prev.hits++;
        prev.hs = prev.hs || r.group === 'head';
        prev.wb = prev.wb || r.wb;
        prev.smoke = this.smokeBetween(o, r.end);
        dmgMap.set(r.victim, prev);
      }
    }
    this.broadcast({ t: 'shot', id: p.id, w: wid, o: o.map(r2), e: ends }, p.isBot ? null : p);
    for (const b of this.players.values()) if (b.isBot && b.alive) b.ai.onNoise(p, o);
    for (const [victim, r] of dmgMap) {
      const flags = { hs: r.hs, wb: r.wb, sm: r.smoke, ns: w.cat === 'sniper' && !p.scoped };
      this.applyDamage(victim, p, r.dmg, r.armor, wid, flags, o, r.hits);
    }
  }

  smokeBetween(a, b) {
    for (const s of this.smokes) if (segmentHitsSphere(a, b, [s.x, s.y, s.z], 3.6)) return true;
    return false;
  }

  calcDamage(w, dist, group, v, mul = 1) {
    let dmg = w.dmg * damageFalloff(w, dist) * mul;
    if (group === 'head') dmg *= 4;
    else if (group === 'stomach') dmg *= 1.25;
    else if (group === 'legs') dmg *= 0.75;
    let armor = 0;
    if (v.armor > 0 && group !== 'legs' && (group !== 'head' || v.helmet)) {
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
      if (raycast(o, [dx / d, dy / d, dz / d], d, this.boxes)) continue;
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
    this.applyDamage(best, p, dmg, armor, 'knife', {}, o, 1);
  }

  applyDamage(v, a, dmg, armorDmg, wid, flags, src, hits = 1) {
    if (!v.alive) return;
    const real = Math.min(dmg, v.hp);
    v.hp -= dmg;
    v.armor = Math.max(0, v.armor - armorDmg);
    if (v.armor === 0) v.helmet = false;
    if (a) {
      v.dmgBy[a.id] = (v.dmgBy[a.id] || 0) + real;
      if (a.team !== v.team && MATCH_PHASES.has(this.phase)) a.st.dmg += real;
      const key = a.id + '>' + v.id;
      const rec = this.rdmg.get(key) || { d: 0, h: 0 };
      rec.d += real; rec.h += hits;
      this.rdmg.set(key, rec);
    }
    if (a && a !== v) this.send(a, { t: 'hc', d: dmg, hs: flags.hs ? 1 : 0, k: v.hp <= 0 ? 1 : 0, ar: armorDmg > 0 ? 1 : 0 });
    this.send(v, { t: 'dmg', d: dmg, x: r2(src[0]), z: r2(src[2]) });
    if (v.isBot && a && a !== v) v.ai.onDamaged(a);
    if (v.hp <= 0) this.kill(v, a, wid, flags);
  }

  kill(v, a, wid, flags = {}) {
    const t = now();
    v.alive = false;
    v.hp = 0;
    v.deadAt = t;
    v.using = false;
    v.action = null;
    v.scoped = false;
    if (this.bomb.defuser === v.id) this.bomb.defuser = null;
    this.dropEverything(v);
    const counts = MATCH_PHASES.has(this.phase);
    if (counts) v.st.deaths++;
    if (a && a !== v && counts) {
      if (a.team !== v.team) {
        a.st.kills++;
        a.st.score += 2;
        a.roundKills++;
        if (flags.hs) a.st.hs++;
        a.money = Math.min(ECONOMY.max, a.money + (WEAPONS[wid]?.kill ?? 300));
      } else {
        a.st.kills--;
        a.st.score -= 2;
        a.money = Math.max(0, a.money - ECONOMY.teamKillPenalty);
      }
    } else if (a === v && counts) v.st.score -= 1;
    let assister = null;
    for (const id in v.dmgBy) {
      const q = this.players.get(+id);
      if (q && q !== a && q !== v && v.dmgBy[id] >= 41 && q.team !== v.team) {
        if (counts) { q.st.assists++; q.st.score += 1; }
        assister = q;
      }
    }
    v.dmgBy = {};
    this.broadcast({
      t: 'kill', k: a ? a.id : -1, v: v.id, a: assister ? assister.id : -1, w: wid,
      hs: flags.hs ? 1 : 0, wb: flags.wb ? 1 : 0, sm: flags.sm ? 1 : 0, ns: flags.ns ? 1 : 0,
    });
    if (!v.isBot) this.sendDamageReport(v);
    this.checkRoundEnd();
  }

  sendDamageReport(p) {
    const list = [];
    for (const q of this.players.values()) {
      if (q === p) continue;
      const g = this.rdmg.get(p.id + '>' + q.id), tk = this.rdmg.get(q.id + '>' + p.id);
      if (g || tk) list.push({ id: q.id, n: q.name, tm: q.team, gd: g?.d || 0, gh: g?.h || 0, td: tk?.d || 0, th: tk?.h || 0 });
    }
    if (list.length) this.send(p, { t: 'dmgrep', list });
  }

  // ---------- objetos en el suelo ----------
  dropEverything(p) {
    if (p.bomb) this.dropBomb(p, false);
    const slot = p.inv[1] ? 1 : p.inv[2] ? 2 : 0;
    if (slot) {
      this.spawnDrop(p, p.inv[slot], false);
      p.inv[slot] = null;
    }
  }

  dropPoint(p, throwIt) {
    const eye = [p.x, p.y + eyeHeight(p.crouch), p.z];
    let x = p.x, z = p.z;
    if (throwIt) {
      const d = viewDir(p.yaw, 0);
      const hit = raycast(eye, d, 1.6, this.boxes);
      const dist = hit ? Math.max(0, hit.t - 0.3) : 1.6;
      x += d[0] * dist; z += d[2] * dist;
    }
    const down = raycast([x, eye[1], z], [0, -1, 0], 20, this.boxes);
    return { x, y: down ? eye[1] - down.t : 0, z };
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

  // ¿Está en posición de plantar o desactivar? (tiene prioridad sobre puertas y recoger)
  nearObjective(p) {
    if (p.team === 'T' && p.bomb && siteAt(this.map, p.x, p.z)) return true;
    return p.team === 'CT' && this.bomb.state === 'planted' && Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 2;
  }

  tryPickup(p) {
    if (!p.alive) return;
    if (p.team === 'T' && p.bomb && siteAt(this.map, p.x, p.z)) return;
    if (p.team === 'CT' && this.bomb.state === 'planted' && Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 2) return;
    let best = null, bestD = 2.2;
    for (const d of this.drops) {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < bestD && Math.abs(d.y - p.y) < 2) { best = d; bestD = dist; }
    }
    if (!best) return;
    const slot = WEAPONS[best.item.id].slot;
    if (p.inv[slot]) this.drops.push({ id: this.nextEnt++, item: { ...p.inv[slot] }, x: p.x, y: p.y, z: p.z, noPick: p.id, noPickUntil: now() + 1.2 });
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
    if (this.phase === 'warmup' || this.phase === 'mapvote') return true;
    if (this.phase !== 'freeze' && this.phase !== 'live') return false;
    if (now() > this.buyEnd) return false;
    const c = this.map.spawnCenter[p.team];
    return Math.hypot(p.x - c[0], p.z - c[1]) < BUY_RADIUS;
  }

  buy(p, id) {
    if (!this.canBuy(p)) return false;
    p.purchases ||= [];
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
      // si el arma actual se compró esta ronda y no se ha usado, se devuelve en lugar de tirarla
      const curEntry = cur && p.purchases.find(e => e.item === cur && this.weaponUnused(cur));
      const credit = curEntry ? curEntry.price : 0;
      if (p.money + credit < w.price) return false;
      let prevDrop = null;
      if (curEntry) {
        p.money += credit;
        p.purchases.splice(p.purchases.indexOf(curEntry), 1);
        prevDrop = curEntry.prevDrop;
      } else if (cur) {
        this.spawnDrop(p, cur, true);
        prevDrop = this.drops[this.drops.length - 1].id;
      }
      if (!pay(w.price)) return false;
      const item = { id, mag: w.mag, res: w.res };
      p.inv[w.slot] = item;
      p.slot = w.slot;
      p.reloadUntil = 0;
      p.purchases.push({ id, kind: 'w', price: w.price, item, slot: w.slot, prevDrop });
      return true;
    }
    const n = NADES[id];
    if (n) {
      if (n.team && n.team !== p.team) return false;
      const total = NADE_ORDER.reduce((s, k) => s + p.nades[k], 0);
      if (p.nades[id] >= n.max || total >= MAX_NADES) return false;
      if (!pay(n.price)) return false;
      p.nades[id]++;
      p.purchases.push({ id, kind: 'n', price: n.price });
      return true;
    }
    if (id === 'vest') {
      if (p.armor >= 100) return false;
      if (!pay(EQUIPMENT.vest.price)) return false;
      p.purchases.push({ id, kind: 'a', price: EQUIPMENT.vest.price, prevArmor: p.armor, prevHelmet: p.helmet });
      p.armor = 100;
      return true;
    }
    if (id === 'vesthelm') {
      if (p.armor >= 100 && p.helmet) return false;
      const cost = p.armor >= 100 ? 350 : EQUIPMENT.vesthelm.price;
      if (!pay(cost)) return false;
      p.purchases.push({ id, kind: 'a', price: cost, prevArmor: p.armor, prevHelmet: p.helmet });
      p.armor = 100; p.helmet = true;
      return true;
    }
    if (id === 'defuser') {
      if (p.team !== 'CT' || p.defuser) return false;
      if (!pay(EQUIPMENT.defuser.price)) return false;
      p.defuser = true;
      p.purchases.push({ id, kind: 'd', price: EQUIPMENT.defuser.price });
      return true;
    }
    return false;
  }

  weaponUnused(item) {
    const w = WEAPONS[item.id];
    return w && item.mag === w.mag && item.res === w.res;
  }

  // ¿Se puede reembolsar esta compra? (sin usar y todavía en el inventario)
  refundable(p, e) {
    if (e.kind === 'w') return p.inv[e.slot] === e.item && this.weaponUnused(e.item);
    if (e.kind === 'n') return p.nades[e.id] > 0;
    if (e.kind === 'a') {
      // sin daño recibido y que sea la última compra de blindaje
      const lastArmor = p.purchases.filter(x => x.kind === 'a').pop();
      return lastArmor === e && p.armor >= 100 && (e.id !== 'vesthelm' || p.helmet);
    }
    if (e.kind === 'd') return p.defuser;
    return false;
  }

  refundList(p) {
    if (!p.purchases?.length || !this.canBuy(p)) return [];
    return [...new Set(p.purchases.filter(e => this.refundable(p, e)).map(e => e.id))];
  }

  refund(p, id) {
    if (!this.canBuy(p) || !p.purchases) return false;
    for (let i = p.purchases.length - 1; i >= 0; i--) {
      const e = p.purchases[i];
      if (e.id !== id || !this.refundable(p, e)) continue;
      if (e.kind === 'w') {
        p.inv[e.slot] = null;
        // devolver el arma que tenía antes si sigue en el suelo
        const di = this.drops.findIndex(d => d.id === e.prevDrop);
        if (di >= 0) { p.inv[e.slot] = this.drops[di].item; this.drops.splice(di, 1); }
        p.reloadUntil = 0;
        if (!p.inv[p.slot]) p.slot = this.bestSlot(p);
      } else if (e.kind === 'n') {
        p.nades[id]--;
        if (p.slot === 4 && !NADE_ORDER.some(k => p.nades[k] > 0)) p.slot = this.bestSlot(p);
      } else if (e.kind === 'a') {
        p.armor = e.prevArmor; p.helmet = e.prevHelmet;
      } else if (e.kind === 'd') {
        p.defuser = false;
      }
      p.money = Math.min(ECONOMY.max, p.money + e.price);
      p.purchases.splice(i, 1);
      this.send(p, { t: 'refunded', item: id, price: e.price });
      return true;
    }
    return false;
  }

  // ---------- granadas ----------
  onThrow(p, m) {
    if (!p.alive || this.phase === 'freeze' || this.phase === 'halftime') return;
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
    const len = Math.hypot(...v) || 1;
    const start = raycast(o, v.map(c => c / len), 0.3, this.boxes) ? [p.x, p.y + 1.2, p.z] : o;
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
      const fire = n.type === 'molotov' || n.type === 'incgrenade';
      let landed = false;
      for (let s = 0; s < steps && !landed; s++) {
        n.vy -= GRAVITY * sdt;
        let bounced = false;
        for (const [k, vk] of [['x', 'vx'], ['y', 'vy'], ['z', 'vz']]) {
          const old = n[k];
          n[k] += n[vk] * sdt;
          const hitFloor = k === 'y' && n.y < R;
          if (hitFloor || findOverlap(n.x, n.y - R, n.z, R, R * 2, this.boxes)) {
            const goingDown = k === 'y' && n[vk] < 0;
            n[k] = hitFloor ? R : old;
            if (fire && goingDown) { landed = true; break; }
            n[vk] = -n[vk] * 0.42;
            if (k !== 'y') n.vy *= 0.8; else { n.vx *= 0.7; n.vz *= 0.7; }
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
      let go;
      if (n.type === 'smoke') go = n.rest > 0.35 || age > 3.5;
      else if (fire) go = landed || age > 2.0;
      else go = age > 1.6;
      if (go) {
        this.nades.splice(i, 1);
        this.detonate(n, t);
      }
    }
  }

  detonate(n, t) {
    const pos = [n.x, n.y, n.z];
    const owner = this.players.get(n.owner) || null;
    if (n.type === 'molotov' || n.type === 'incgrenade') {
      const down = raycast([n.x, n.y + 0.2, n.z], [0, -1, 0], 30, this.boxes);
      const fy = down ? n.y + 0.2 - down.t : 0;
      // se apaga si cae sobre el humo o en el aire
      if (this.smokes.some(s => Math.hypot(s.x - n.x, s.z - n.z) < 4) || n.y - fy > 2.5) {
        this.broadcast({ t: 'boom', g: 'fizz', x: r2(n.x), y: r2(n.y), z: r2(n.z) });
        return;
      }
      this.fires.push({ id: this.nextEnt++, x: n.x, y: fy, z: n.z, r: 3.2, until: t + 7, owner: n.owner, team: n.team });
      this.nav.setDanger(this.fires);
      this.broadcast({ t: 'boom', g: 'fire', x: r2(n.x), y: r2(fy), z: r2(n.z) });
      return;
    }
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
        if (d > 0.1 && raycast(pos, [dx / d, dy / d, dz / d], d, this.boxes)) continue;
        let dmg = 98 * (1 - d / radius) ** 1.4;
        let armor = 0;
        if (q.armor > 0) { armor = Math.min(q.armor, Math.round(dmg * 0.25)); dmg *= 0.58; }
        dmg = Math.round(dmg);
        if (dmg > 0) this.applyDamage(q, owner, dmg, armor, 'he', {}, pos);
      }
    } else if (n.type === 'smoke') {
      // el humo apaga el fuego
      const before = this.fires.length;
      this.fires = this.fires.filter(f => Math.hypot(f.x - n.x, f.z - n.z) > 4.5);
      if (this.fires.length !== before) this.nav.setDanger(this.fires);
      this.smokes.push({ id: this.nextEnt++, x: n.x, y: n.y + 1.2, z: n.z, until: t + 18 });
    } else if (n.type === 'flash') {
      for (const b of this.players.values()) {
        if (!b.isBot || !b.alive) continue;
        const e = [b.x, b.y + eyeHeight(b.crouch), b.z];
        const dx = pos[0] - e[0], dy = pos[1] - e[1], dz = pos[2] - e[2];
        const d = Math.hypot(dx, dy, dz);
        if (d > 30 || raycast(e, [dx / d, dy / d, dz / d], d, this.boxes)) continue;
        const v = viewDir(b.yaw, b.pitch);
        const dot = (v[0] * dx + v[1] * dy + v[2] * dz) / d;
        b.flashedUntil = Math.max(b.flashedUntil, t + (dot > 0.5 ? 3.5 : dot > 0 ? 2 : 0.6) * (1 - d / 30));
      }
    }
  }

  updateFires(dt, t) {
    if (!this.fires.length) return;
    const before = this.fires.length;
    this.fires = this.fires.filter(f => f.until > t);
    if (this.fires.length !== before) this.nav.setDanger(this.fires);
    for (const q of this.players.values()) {
      if (!q.alive) continue;
      let inFire = null;
      for (const f of this.fires) if (Math.hypot(q.x - f.x, q.z - f.z) < f.r && Math.abs(q.y - f.y) < 1.5) { inFire = f; break; }
      if (!inFire) { q.fireAcc = 0; continue; }
      const owner = this.players.get(inFire.owner) || null;
      if (owner && owner !== q && owner.team === q.team) continue;
      q.fireAcc += 40 * dt;
      if (q.fireAcc >= 8) {
        const d = Math.floor(q.fireAcc);
        q.fireAcc -= d;
        this.applyDamage(q, owner, d, 0, inFire.team === 'CT' ? 'incgrenade' : 'molotov', {}, [inFire.x, inFire.y, inFire.z]);
      }
    }
  }

  los(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3) return true;
    if (raycast(a, [dx / d, dy / d, dz / d], d, this.boxes)) return false;
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
      if (p.team === 'T' && p.bomb && this.phase === 'live' && siteAt(this.map, p.x, p.z) && p.y < 3) {
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
    const site = siteAt(this.map, p.x, p.z);
    this.bomb = { state: 'planted', x: p.x, y: p.y, z: p.z, site, explodeAt: t + T.bomb, plantedAt: t, defuser: null, planter: p.id };
    this.phaseEnd = this.bomb.explodeAt;
    p.money = Math.min(ECONOMY.max, p.money + ECONOMY.plantBonus);
    p.st.score += 2;
    this.centerMsg(`¡La bomba ha sido plantada en el sitio ${site}!`, 'bomb');
    this.broadcast({ t: 'planted', site, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
    for (const q of this.players.values()) if (q.isBot) q.ai.onBombPlanted();
  }

  defuseBomb(p) {
    this.bomb.state = 'defused';
    this.bomb.defuser = null;
    p.money = Math.min(ECONOMY.max, p.money + 300);
    p.st.score += 2;
    this.broadcast({ t: 'defused', id: p.id });
    this.endRound('CT', 'defuse', p);
  }

  updateBomb(t) {
    if (this.bomb.state !== 'planted' || t < this.bomb.explodeAt) return;
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
      this.applyDamage(q, planter && planter.team !== q.team ? planter : null, Math.round(dmg), armor, 'bomb', {}, [b.x, b.y, b.z]);
    }
    if (this.phase === 'live') this.endRound('T', 'bomb', planter);
  }

  // ---------- veto de mapas (estilo Premier) ----------
  startVote() {
    this.phase = 'mapvote';
    this.vote = { pool: [...MAP_IDS], banned: {}, turn: 0, turnEnd: now() + T.voteTurn, votes: new Map(), result: null };
    if (!this.teamHumans(this.voteTeam())) this.vote.turnEnd = now() + 2.5;
    this.broadcastVote();
  }

  voteTeam() { return this.vote ? BAN_ORDER[this.vote.turn] : null; }

  remainingMaps() { return this.vote.pool.filter(id => !this.vote.banned[id]); }

  onVote(p, mapId) {
    const v = this.vote;
    if (this.phase !== 'mapvote' || !v || v.result) return;
    if (p.team !== this.voteTeam() || !this.remainingMaps().includes(mapId)) return;
    v.votes.set(p.id, mapId);
    const humans = this.teamMembers(p.team).filter(q => !q.isBot);
    if (humans.every(q => v.votes.has(q.id))) v.turnEnd = Math.min(v.turnEnd, now() + 1);
    this.broadcastVote();
  }

  resolveVoteTurn() {
    const v = this.vote;
    const team = this.voteTeam();
    const tally = {};
    for (const [pid, m] of v.votes) {
      const q = this.players.get(pid);
      if (q && q.team === team) tally[m] = (tally[m] || 0) + 1;
    }
    const remaining = this.remainingMaps();
    let max = 0, cands = [];
    for (const m of remaining) {
      const c = tally[m] || 0;
      if (c > max) { max = c; cands = [m]; } else if (c === max) cands.push(m);
    }
    const ban = pick(max > 0 ? cands : remaining);
    v.banned[ban] = team;
    v.votes = new Map();
    v.turn++;
    if (this.remainingMaps().length === 1) {
      v.result = this.remainingMaps()[0];
      v.turnEnd = now() + T.voteReveal;

    } else {
      v.turnEnd = now() + T.voteTurn;
      // equipos sin humanos vetan solos
      if (!this.teamHumans(this.voteTeam())) v.turnEnd = now() + 2.5;
    }
    this.broadcastVote();
  }

  mapTitle(id) { return getMap(id).title; }

  voteState() {
    const v = this.vote;
    if (!v) return null;
    const counts = {};
    for (const m of v.votes.values()) counts[m] = (counts[m] || 0) + 1;
    return { pool: v.pool, banned: v.banned, turn: this.voteTeam(), turnEnd: Math.round(v.turnEnd * 1000), counts, result: v.result, n: v.turn };
  }

  broadcastVote() { this.broadcast({ t: 'vote', v: this.voteState() }); }

  // ---------- partida ----------
  bothTeamsPresent() {
    return this.teamMembers('T').length > 0 && this.teamMembers('CT').length > 0;
  }

  played() { return this.score.T + this.score.CT; }

  // Rondas necesarias para ganar, según las rondas ya jugadas antes de la actual.
  winTarget(playedBefore = this.played()) {
    if (playedBefore < 24) return 13;
    return 13 + 3 * (Math.floor((playedBefore - 24) / 6) + 1);
  }

  startMatch(mapId) {
    this.loadMap(mapId);
    this.broadcast({ t: 'map', id: mapId });
    this.vote = null;
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 1, CT: 1 };
    this.history = [];
    this.matchOver = null;
    this.records.clear();
    for (const p of this.players.values()) {
      p.money = ECONOMY.start;
      p.st = emptyStats();
      this.resetInventory(p);
      p.alive = false;
    }
    this.centerMsg('¡Comienza la partida competitiva!', 'info');
    this.startRound();
  }

  swapTeams(money) {
    for (const p of this.players.values()) {
      if (p.team === 'T') p.team = 'CT'; else if (p.team === 'CT') p.team = 'T';
      p.money = money;
      this.resetInventory(p);
      p.alive = false;
    }
    for (const r of this.records.values()) r.team = other(r.team);
    this.score = { T: this.score.CT, CT: this.score.T };
    this.lossStreak = { T: 1, CT: 1 };
  }

  startRound() {
    const t = now();
    this.round++;
    this.doorOpen = this.map.doors.map(() => 0);
    this.doorTarget = this.map.doors.map(() => 0);
    this.rebuildDoors();
    this.rebalanceBots(true);
    this.resetRoundState();
    this.phase = 'freeze';
    this.phaseEnd = t + T.freeze;
    this.buyEnd = t + T.buy;
    for (const team of ['T', 'CT']) {
      shuffle(this.teamMembers(team)).forEach((p, i) => {
        if (!p.alive) this.resetInventory(p);
        p.bomb = false;
        p.roundKills = 0;
        p.purchases = [];
        this.spawn(p, i);
      });
    }
    const ts = this.teamMembers('T');
    if (ts.length) {
      const humans = ts.filter(p => !p.isBot);
      const pool = humans.length && Math.random() < 0.7 ? humans : ts;
      const carrier = pool[(Math.random() * pool.length) | 0];
      carrier.bomb = true;
      this.bomb = { state: 'carried', carrier: carrier.id };
      this.send(carrier, { t: 'msg', text: 'Llevas la bomba [5]. Plántala en A o B manteniendo E', kind: 'info' });
    }
    const target = this.winTarget();
    let banner = '';
    if (this.score.T === target - 1 && this.score.CT === target - 1) banner = 'Punto de partida para ambos equipos';
    else if (this.score.T === target - 1 || this.score.CT === target - 1) banner = 'Punto de partida';
    else if (this.played() === 11) banner = 'Última ronda de la primera mitad';
    else if (this.played() >= 24 && (this.played() - 24) % 6 === 2) banner = 'Última ronda de la mitad de la prórroga';
    if (this.played() === 24 && this.score.T === 12) banner = 'Prórroga';
    this.broadcast({ t: 'rstart', r: this.round, sc: this.score, banner });
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
    this.history.push({ w: winner, r: reason });
    const winMoney = reason === 'bomb' || reason === 'defuse' ? ECONOMY.winObjective : ECONOMY.win;
    const lossMoney = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * (this.lossStreak[loser] - 1));
    for (const p of this.players.values()) {
      if (p.team === winner) p.money = Math.min(ECONOMY.max, p.money + winMoney);
      else if (p.team === loser) {
        // los T que sobreviven al tiempo no cobran (regla competitiva)
        if (reason === 'time' && p.team === 'T' && p.alive) continue;
        let m = lossMoney;
        if (loser === 'T' && this.bomb.planter) m += ECONOMY.plantLossBonus;
        p.money = Math.min(ECONOMY.max, p.money + m);
      }
      if (p.team === winner || p.team === loser) p.st.roundsPlayed = (p.st.roundsPlayed || 0) + 1;
    }
    this.lossStreak[winner] = Math.max(1, this.lossStreak[winner] - 1);
    this.lossStreak[loser] = Math.min(this.lossStreak[loser] + 1, 5);
    // MVP: el héroe del objetivo o quien más bajas hizo
    let mvp = hero && hero.team === winner ? hero : null;
    if (!mvp) {
      let best = 0;
      for (const p of this.players.values()) if (p.team === winner && p.roundKills > best) { best = p.roundKills; mvp = p; }
    }
    if (mvp) { mvp.st.mvps++; }
    const mvpReason = !mvp ? '' : mvp === hero ? (reason === 'defuse' ? 'por desactivar la bomba' : 'por plantar la bomba') : `por ${mvp.roundKills} baja${mvp.roundKills === 1 ? '' : 's'}`;
    this.broadcast({ t: 'rend', w: winner, r: reason, sc: this.score, mvp: mvp ? mvp.id : -1, mvpWhy: mvpReason, hist: this.history });
    for (const p of this.players.values()) if (!p.isBot && p.alive) this.sendDamageReport(p);
    const p = this.played();
    const target = this.winTarget(p - 1);
    if (this.score[winner] >= target) {
      this.matchOver = winner;
    } else if (p === 12) {
      this.pendingSwap = ECONOMY.start;
    } else if (p >= 24 && (p - 24) % 3 === 0) {
      // prórroga: cambio de lado en cada mitad y dinero de prórroga
      this.pendingSwap = ECONOMY.overtimeStart;
      if ((p - 24) % 6 === 0) this.pendingSwapNoSwap = true;
    }
    this.sendRoster();
  }

  finishMatch() {
    const winner = this.matchOver;
    this.phase = 'matchend';
    this.phaseEnd = now() + T.matchEnd;
    const rounds = Math.max(1, this.played());
    const players = [...this.players.values()].filter(p => p.team === 'T' || p.team === 'CT');
    let mvp = null;
    for (const p of players) if (!mvp || p.st.score > mvp.st.score) mvp = p;
    const results = [];
    for (const p of players) {
      const won = p.team === winner;
      const adr = p.st.dmg / rounds;
      let delta = 0;
      if (!p.isBot) {
        delta = (won ? 22 : -20) + clamp((adr - 75) / 8, -6, 6) + clamp((p.st.kills - p.st.deaths) * 0.6, -6, 6);
        delta = Math.round(delta);
      }
      results.push({ id: p.id, n: p.name, tm: p.team, won, k: p.st.kills, d: p.st.deaths, a: p.st.assists, adr: Math.round(adr), hs: p.st.kills ? Math.round(p.st.hs / p.st.kills * 100) : 0, mvps: p.st.mvps, sc: p.st.score, delta, rt: p.rating + delta, bot: p.isBot ? 1 : 0 });
      if (!p.isBot) p.rating += delta;
    }
    this.broadcast({ t: 'matchend', winner, score: this.score, mvp: mvp ? mvp.id : -1, results, map: this.map.id, rounds: this.history });
    this.onMatchEnd?.(this, players.filter(p => !p.isBot), winner, rounds, results);
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

  // ---------- anfitrión y chat ----------
  onHost(p, m) {
    if (!this.isPrivate || p.account !== this.owner) return;
    switch (m.action) {
      case 'start':
        if (this.phase === 'warmup') this.phaseEnd = now() + 3;
        break;
      case 'bots':
        this.botTarget = clamp(m.n | 0, 0, 5);
        this.rebalanceBots(this.phase !== 'live');
        this.systemMsg(`Bots por equipo: ${this.botTarget}`);
        this.sendRoster();
        break;
      case 'skill':
        this.botSkill = clamp(num(m.s, 0.5), 0, 1);
        for (const q of this.players.values()) if (q.isBot) q.ai.skill = this.botSkill;
        this.systemMsg(`Dificultad de bots: ${Math.round(this.botSkill * 100)}%`);
        break;
      case 'restart':
        this.systemMsg('El anfitrión reinició la partida');
        this.phase = 'warmup';
        this.phaseEnd = now() + 5;
        this.score = { T: 0, CT: 0 };
        this.history = [];
        this.round = 0;
        break;
    }
  }

  onChat(p, m) {
    const t = now();
    p.chatTimes = p.chatTimes.filter(x => t - x < 5);
    if (p.chatTimes.length >= 5) return;
    p.chatTimes.push(t);
    const msg = String(m.msg || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    if (!msg) return;
    if (msg[0] === '/') { this.command(p, msg.slice(1).split(/\s+/)); return; }
    const out = JSON.stringify({ t: 'chat', id: p.id, name: p.name, team: p.team, msg, tm: m.tm ? 1 : 0, dead: p.alive ? 0 : 1 });
    for (const q of this.players.values()) if (!m.tm || q.team === p.team) this.send(q, out);
  }

  command(p, [cmd, ...args]) {
    const reply = text => this.send(p, { t: 'chat', name: '', msg: text, sys: 1 });
    switch ((cmd || '').toLowerCase()) {
      case 'help': reply('Comandos: /admin, /rcon <clave>, /bots <0-5>, /restart, /kick <nombre>'); return;
      case 'admin': reply(`Administrador del servidor: ${this.config.adminEmail}`); return;
      case 'rcon':
        if (this.config.adminPassword && args[0] === this.config.adminPassword) { p.isAdmin = true; reply('Acceso de administrador concedido'); }
        else reply('Clave incorrecta');
        return;
    }
    if (!p.isAdmin) { reply('Necesitas /rcon <clave> para ese comando'); return; }
    switch ((cmd || '').toLowerCase()) {
      case 'bots': this.botTarget = clamp(parseInt(args[0], 10) || 0, 0, 5); this.rebalanceBots(this.phase !== 'live'); this.systemMsg(`Bots por equipo: ${this.botTarget}`); break;
      case 'restart': this.phase = 'warmup'; this.phaseEnd = now() + 5; this.score = { T: 0, CT: 0 }; this.history = []; this.round = 0; this.systemMsg('Reiniciando…'); break;
      case 'kick': {
        const name = args.join(' ').toLowerCase();
        for (const q of this.players.values()) if (q.name.toLowerCase() === name && q !== p) { this.send(q, { t: 'kicked' }); q.session?.leaveRoom('expulsado'); break; }
        break;
      }
      default: reply('Comando desconocido');
    }
  }

  // ---------- bucle ----------
  computeSpotted() {
    const alive = [...this.players.values()].filter(p => p.alive);
    const intel = { T: [], CT: [] };
    for (const q of alive) {
      q.spotted = false;
      const pts = [[q.x, q.y + (q.crouch ? 1.1 : 1.6), q.z], [q.x, q.y + 1.0, q.z], [q.x, q.y + 0.3, q.z]];
      for (const e of alive) {
        if (e.team === q.team) continue;
        const eye = [e.x, e.y + eyeHeight(e.crouch), e.z];
        if (Math.hypot(eye[0] - q.x, eye[2] - q.z) > 90) continue;
        if (pts.some(pt => this.los(eye, pt))) { q.spotted = true; break; }
      }
      if (q.spotted && intel[q.team]) intel[q.team].push([q.x, q.z]);
    }
    const t = now();
    for (const k of ['T', 'CT']) if (intel[k].length) this.intel[k] = { t, points: intel[k] };
  }

  tick(dt) {
    if (this.closed) return;
    const t = now();
    this.tickCount++;
    switch (this.phase) {
      case 'warmup':
        for (const p of this.players.values()) {
          if (!p.alive && p.team !== 'SPEC' && t - p.deadAt > T.warmupRespawn) { this.resetInventory(p); this.spawn(p, (Math.random() * 10) | 0); }
        }
        if (!this.bothTeamsPresent()) this.phaseEnd = Math.max(this.phaseEnd, t + 5);
        else if (t >= this.phaseEnd) this.startVote();
        break;
      case 'mapvote':
        for (const p of this.players.values()) {
          if (!p.alive && p.team !== 'SPEC' && t - p.deadAt > T.warmupRespawn) { this.resetInventory(p); this.spawn(p, (Math.random() * 10) | 0); }
        }
        if (t >= this.vote.turnEnd) {
          if (this.vote.result) this.startMatch(this.vote.result);
          else this.resolveVoteTurn();
        }
        break;
      case 'freeze':
        if (t >= this.phaseEnd) { this.phase = 'live'; this.phaseEnd = t + T.round; this.roundStartT = t; }
        break;
      case 'live':
        if (!this.bothTeamsPresent()) { this.phase = 'warmup'; this.phaseEnd = t + 10; break; }
        if (this.bomb.state !== 'planted' && t >= this.phaseEnd) this.endRound('CT', 'time');
        break;
      case 'post':
        if (t >= this.phaseEnd) {
          if (this.matchOver) this.finishMatch();
          else if (this.pendingSwap) { this.phase = 'halftime'; this.phaseEnd = t + T.halftime; this.centerMsg('Descanso', 'info'); this.sendRoster(); }
          else this.startRound();
        }
        break;
      case 'halftime':
        if (t >= this.phaseEnd) {
          if (this.pendingSwapNoSwap) {
            for (const p of this.players.values()) { p.money = this.pendingSwap; this.resetInventory(p); p.alive = false; }
          } else this.swapTeams(this.pendingSwap);
          this.pendingSwap = null;
          this.pendingSwapNoSwap = false;
          this.centerMsg('Cambio de bando', 'info');
          this.startRound();
        }
        break;
      case 'matchend':
        if (t >= this.phaseEnd) {
          for (const p of this.humans()) p.session?.leaveRoom('fin');
          this.close();
          return;
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
    this.updateDoors(dt);
    this.updateNades(dt, t);
    this.updateFires(dt, t);
    this.autoPickups(t);
    if (this.tickCount % 4 === 0) this.computeSpotted();
    if (this.tickCount % 2 === 0) this.sendSnapshots(t);
    if (this.tickCount % 40 === 0) this.sendRoster();
  }

  timeLeft(t) {
    if (this.phase === 'live' && this.bomb.state === 'planted') return Math.max(0, this.bomb.explodeAt - t);
    if (this.phase === 'mapvote' && this.vote) return Math.max(0, this.vote.turnEnd - t);
    return Math.max(0, this.phaseEnd - t);
  }

  // Anti-wallhack: solo se envían enemigos visibles para el equipo, cercanos o muertos.
  visibleTo(viewer, q) {
    if (viewer.team === 'SPEC' || q.team === viewer.team || !q.alive) return true;
    if (this.phase === 'warmup' || this.phase === 'mapvote' || this.phase === 'post' || this.phase === 'matchend') return true;
    if (q.spotted) return true;
    return Math.hypot(q.x - viewer.x, q.z - viewer.z) < 20;
  }

  sendSnapshots(t) {
    const entries = [];
    for (const p of this.players.values()) {
      if (p.team === 'SPEC') continue;
      const flags = (p.alive ? 1 : 0) | (p.crouch ? 2 : 0) | (p.spotted ? 4 : 0) | (p.bomb ? 8 : 0) |
        (p.action ? 16 : 0) | (p.scoped ? 32 : 0) | (p.reloadUntil ? 64 : 0) | (p.defuser ? 128 : 0) | (p.walking ? 256 : 0);
      entries.push([p, JSON.stringify([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), flags, this.weaponIdOf(p), p.hp])]);
    }
    const b = this.bomb;
    const bomb = b.state === 'none' ? null : {
      s: b.state, x: r2(b.x ?? 0), y: r2(b.y ?? 0), z: r2(b.z ?? 0), c: b.carrier ?? -1, site: b.site || null,
      tl: b.state === 'planted' ? r2(Math.max(0, b.explodeAt - t)) : 0,
      dp: b.defuser ? r2(clamp((t - b.defuseStart) / (b.defuseKit ? T.defuseKit : T.defuse), 0, 1)) : -1,
    };
    const common = JSON.stringify({
      t: 's', time: Math.round(t * 1000), ph: this.phase, tl: r2(this.timeLeft(t)), sc: this.score, rn: this.round,
      b: bomb,
      n: this.nades.map(n => [n.id, n.type, r2(n.x), r2(n.y), r2(n.z)]),
      d: this.drops.map(d => [d.id, d.item.id, r2(d.x), r2(d.y), r2(d.z)]),
      sm: this.smokes.map(s => [s.id, r2(s.x), r2(s.y), r2(s.z), r2(s.until - t)]),
      fi: this.fires.map(f => [f.id, r2(f.x), r2(f.y), r2(f.z), f.r, r2(f.until - t)]),
      dr: this.doorOpen.map(o => Math.round(o * 100) / 100),
    }).slice(0, -1);
    for (const p of this.players.values()) {
      if (!p.session) continue;
      const list = entries.filter(([q]) => this.visibleTo(p, q)).map(e => e[1]).join(',');
      const me = {
        hp: p.hp, ar: p.armor, hm: p.helmet ? 1 : 0, mo: p.money, sl: p.slot, tm: p.team, al: p.alive ? 1 : 0, sp: p.spawnSeq,
        i1: p.inv[1] ? [p.inv[1].id, p.inv[1].mag, p.inv[1].res] : null,
        i2: p.inv[2] ? [p.inv[2].id, p.inv[2].mag, p.inv[2].res] : null,
        nd: NADE_ORDER.map(k => p.nades[k]), bm: p.bomb ? 1 : 0, df: p.defuser ? 1 : 0,
        rl: p.reloadUntil ? r2(Math.max(0, p.reloadUntil - t)) : 0,
        act: p.action ? p.action.type : 0, pr: r2(this.actionProgress(p, t)), cb: this.canBuy(p) ? 1 : 0,
        bt: r2(Math.max(0, this.buyEnd - t)),
        rf: this.refundList(p),
      };
      p.session.send(common + ',"p":[' + list + '],"me":' + JSON.stringify(me) + '}');
    }
  }

  sendRoster() {
    const list = [...this.players.values()];
    const rounds = Math.max(1, this.played());
    for (const viewer of list) {
      if (!viewer.session) continue;
      const players = list.map(p => ({
        id: p.id, n: p.name, tm: p.team, b: p.isBot ? 1 : 0, k: p.st.kills, d: p.st.deaths, a: p.st.assists, mvp: p.st.mvps,
        sc: p.st.score, adr: Math.round(p.st.dmg / rounds), hs: p.st.kills ? Math.round(p.st.hs / p.st.kills * 100) : 0,
        pg: p.isBot ? 0 : p.ping, al: p.alive ? 1 : 0, rt: p.isBot ? 0 : p.rating, party: p.partyId,
        m: p.team === viewer.team || viewer.team === 'SPEC' ? p.money : -1,
        kit: p.team === viewer.team && p.defuser ? 1 : 0, bm: p.team === viewer.team && p.bomb ? 1 : 0,
      }));
      this.send(viewer, {
        t: 'roster', players, sc: this.score, rn: this.round, bots: this.botTarget, hist: this.history,
        ph: this.phase, map: this.map.id, owner: this.owner, private: this.isPrivate, target: this.winTarget(),
      });
    }
  }

  info() {
    return {
      id: this.id, private: this.isPrivate, humans: this.humanCount(), players: this.players.size, round: this.round,
      score: this.score, phase: this.phase, map: this.map.id,
    };
  }
}
