// IA de bots: navegación por waypoints, compra, combate, plantar/desactivar y granadas.
import { BOXES, SITES, siteAt } from '../shared/map.js';
import { WEAPONS, moveSpeed } from '../shared/weapons.js';
import { moveBody, eyeHeight, viewDir, angleWrap, JUMP_VELOCITY, STAND_HEIGHT, CROUCH_HEIGHT, findOverlap, PLAYER_RADIUS } from '../shared/physics.js';
import { NODES, nearestNode, findPath, clearPath } from './nav.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

export class BotBrain {
  constructor(room, p, skill) {
    this.room = room;
    this.p = p;
    this.skill = skill;
    this.reset();
  }

  reset() {
    this.path = [];
    this.goal = null;
    this.goalKind = null;
    this.targetId = null;
    this.reactAt = 0;
    this.acquireT = 0;
    this.aimOffset = [0, 0];
    this.aimHead = false;
    this.lastSeen = null;
    this.nextPerceive = 0;
    this.visible = null;
    this.nextDecide = 0;
    this.holdYaw = null;
    this.stuckCheckT = 0;
    this.stuckPos = null;
    this.stuckCount = 0;
    this.strafeDir = 1;
    this.strafeUntil = 0;
    this.burst = 0;
    this.burstPauseUntil = 0;
    this.nextShotT = 0;
    this.via = null;
    this.viaDone = false;
    this.lookAt = null;
    this.lookUntil = 0;
    this.nadeCheckT = 0;
    this.crouchFight = false;
  }

  onSpawn() {
    this.reset();
    this.nextDecide = 0;
  }

  onRoundStart() {
    this.buy();
    const p = this.p, room = this.room;
    // plan de equipo: los T eligen un sitio común por ronda
    if (p.team === 'T') {
      if (!room.tPlan || room.tPlan.round !== room.round) room.tPlan = { round: room.round, site: Math.random() < 0.5 ? 'A' : 'B' };
      this.site = room.tPlan.site;
      const routes = this.site === 'A' ? ['long', 'short', 'long'] : ['blane', 'tunnel', 'blane'];
      this.via = pick(NODES.filter(n => n.tag === pick(routes)));
    } else {
      const ids = room.teamMembers('CT').filter(q => q.isBot).map(q => q.id).sort((a, b) => a - b);
      this.site = ids.indexOf(p.id) % 2 === 0 ? 'A' : 'B';
      if (Math.random() < 0.25) this.via = pick(NODES.filter(n => n.tag === 'mid' && n.z < -10));
    }
    this.viaDone = !this.via;
    this.aggressive = Math.random() < 0.35;
  }

  buy() {
    const p = this.p, room = this.room;
    const b = id => room.buy(p, id);
    const T = p.team === 'T';
    if (!p.inv[1]) {
      const m = p.money;
      if (m >= 4750 + 1000 && Math.random() < 0.18) b('awp');
      else if (m >= (T ? 2700 : 3100) + 650) b(T ? 'ak47' : 'm4a4');
      else if (m >= (T ? 1800 : 2050) + 650) b(T ? 'galil' : 'famas');
      else if (m >= 1700 + 650 && Math.random() < 0.3) b('ssg08');
      else if (m >= 1250 + 650 && room.round > 1) b(Math.random() < 0.3 ? 'nova' : (T ? 'mac10' : 'mp9'));
    }
    if (p.money >= 1000) b('vesthelm'); else if (p.money >= 650) b('vest');
    else if (p.money >= 300 && Math.random() < 0.5) b('p250');
    if (!T && p.money >= 400 && Math.random() < 0.7) b('defuser');
    if (p.money >= 300 && Math.random() < 0.6) b('he');
    if (p.money >= 200 && Math.random() < 0.5) b('flash');
    if (p.money >= 300 && Math.random() < 0.3) b('smoke');
    p.slot = p.inv[1] ? 1 : 2;
  }

  onBombPlanted() {
    this.path = [];
    this.nextDecide = 0;
  }

  onDamaged(attacker) {
    if (!this.visible) {
      this.lookAt = [attacker.x, attacker.y + 1.4, attacker.z];
      this.lookUntil = performance.now() / 1000 + 1.5;
      this.lastSeen = { x: attacker.x, y: attacker.y, z: attacker.z, t: performance.now() / 1000 };
    }
  }

  onNoise(src, o) {
    const p = this.p;
    if (src === p || src.team === p.team || this.visible) return;
    const d = Math.hypot(o[0] - p.x, o[2] - p.z);
    const w = WEAPONS[src.inv[src.slot]?.id];
    const radius = w?.silenced ? 12 : 40;
    if (d > radius) return;
    const t = performance.now() / 1000;
    this.lookAt = [o[0], o[1], o[2]];
    this.lookUntil = t + 1.2;
    this.lastSeen = { x: o[0], y: o[1] - 1.5, z: o[2], t };
  }

  eye() {
    const p = this.p;
    return [p.x, p.y + eyeHeight(p.crouch), p.z];
  }

  findTarget() {
    const p = this.p, room = this.room;
    const eye = this.eye();
    const view = viewDir(p.yaw, 0);
    let best = null, bestD = Infinity;
    for (const q of room.players.values()) {
      if (!q.alive || q.team === p.team || q.team === 'SPEC') continue;
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 90) continue;
      // campo de visión ~150º (más amplio a corta distancia)
      const cos = (dx * view[0] + dz * view[2]) / (d || 1);
      if (d > 4 && cos < -0.25) continue;
      const head = [q.x, q.y + (q.crouch ? 1.1 : 1.55), q.z];
      const chest = [q.x, q.y + (q.crouch ? 0.8 : 1.15), q.z];
      if (!room.los(eye, head) && !room.los(eye, chest)) continue;
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  }

  currentWeapon() {
    const p = this.p;
    const item = p.slot <= 3 ? p.inv[p.slot] : null;
    return item ? { item, w: WEAPONS[item.id] } : null;
  }

  ensureGun() {
    const p = this.p, room = this.room;
    const ok = s => p.inv[s] && (p.inv[s].mag > 0 || p.inv[s].res > 0);
    if (p.slot <= 2 && ok(p.slot)) return;
    if (ok(1)) room.switchSlot(p, 1);
    else if (ok(2)) room.switchSlot(p, 2);
    else room.switchSlot(p, 3);
  }

  decide(t) {
    const p = this.p, room = this.room, bomb = room.bomb;
    const setGoal = (x, z, kind) => {
      if (this.goal && this.goalKind === kind && Math.hypot(this.goal[0] - x, this.goal[1] - z) < 2) return;
      this.goal = [x, z];
      this.goalKind = kind;
      this.path = findPath(nearestNode(p.x, p.z), nearestNode(x, z));
    };
    const siteNode = site => pick(NODES.filter(n => n.tag === site));
    const recentEnemy = this.lastSeen && t - this.lastSeen.t < 6;

    if (room.phase === 'warmup') {
      if (recentEnemy) setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt');
      else if (!this.goal || this.arrived()) { const n = pick(NODES); setGoal(n.x, n.z, 'roam'); }
      return;
    }
    if (bomb.state === 'planted') {
      if (p.team === 'CT') setGoal(bomb.x, bomb.z, 'defuse');
      else if (this.goalKind !== 'guard') { const n = siteNode(bomb.site); setGoal(n.x, n.z, 'guard'); }
      return;
    }
    if (p.team === 'T') {
      if (p.bomb) {
        if (this.goalKind !== 'plant' || !this.goal) {
          const s = SITES[this.site];
          setGoal(s.cx + rand(-5, 5), s.cz + rand(-5, 5), 'plant');
        }
        return;
      }
      if (bomb.state === 'dropped') {
        const ts = room.teamMembers('T').filter(q => q.alive);
        const nearest = ts.sort((a, b) => Math.hypot(a.x - bomb.x, a.z - bomb.z) - Math.hypot(b.x - bomb.x, b.z - bomb.z))[0];
        if (nearest === p) { setGoal(bomb.x, bomb.z, 'getbomb'); return; }
      }
      if (recentEnemy && this.aggressive && Math.hypot(this.lastSeen.x - p.x, this.lastSeen.z - p.z) < 30) {
        setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt');
        return;
      }
      if (!this.viaDone) { setGoal(this.via.x, this.via.z, 'via'); return; }
      if (this.goalKind !== 'hold') { const n = siteNode(this.site); setGoal(n.x, n.z, 'hold'); }
      return;
    }
    // CT
    if (recentEnemy && (this.aggressive || Math.hypot(this.lastSeen.x - p.x, this.lastSeen.z - p.z) < 18)) {
      setGoal(this.lastSeen.x, this.lastSeen.z, 'hunt');
      return;
    }
    if (!this.viaDone) { setGoal(this.via.x, this.via.z, 'via'); return; }
    if (this.goalKind !== 'hold') { const n = siteNode(this.site); setGoal(n.x, n.z, 'hold'); }
  }

  arrived() {
    return !this.goal || (this.path.length === 0 && Math.hypot(this.goal[0] - this.p.x, this.goal[1] - this.p.z) < 1.3);
  }

  // Devuelve el punto inmediato al que caminar (o null si ya llegó).
  steerPoint() {
    const p = this.p;
    while (this.path.length) {
      const n = NODES[this.path[0]];
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      // saltar al siguiente nodo si ya hay visión directa (suaviza la ruta)
      if (d < 1.3 || (this.path.length > 1 && d < 6 && clearPath(p.x, p.z, NODES[this.path[1]].x, NODES[this.path[1]].z, 0.4))) {
        this.path.shift();
        continue;
      }
      return [n.x, n.z];
    }
    if (!this.goal) return null;
    const d = Math.hypot(this.goal[0] - p.x, this.goal[1] - p.z);
    if (d < 1.0) return null;
    if (!clearPath(p.x, p.z, this.goal[0], this.goal[1], 0.35)) {
      // meta no visible: replanificar desde el nodo más cercano
      this.path = findPath(nearestNode(p.x, p.z), nearestNode(this.goal[0], this.goal[1]));
      if (!this.path.length) return null;
      const n = NODES[this.path[0]];
      return [n.x, n.z];
    }
    return this.goal;
  }

  turnTo(yaw, pitch, rate, dt) {
    const p = this.p;
    const dy = angleWrap(yaw - p.yaw);
    const max = rate * dt;
    p.yaw = angleWrap(p.yaw + Math.max(-max, Math.min(max, dy)));
    const dp = pitch - p.pitch;
    p.pitch += Math.max(-max, Math.min(max, dp));
    return Math.abs(dy) + Math.abs(dp);
  }

  think(dt, t) {
    const p = this.p, room = this.room;
    if (!p.alive) return;
    const frozen = room.phase === 'freeze';
    if (t >= this.nextPerceive) {
      this.nextPerceive = t + 0.12;
      this.visible = frozen ? null : this.findTarget();
    }
    const flashed = t < p.flashedUntil;
    let target = this.visible && this.visible.alive ? this.visible : null;
    let wishX = 0, wishZ = 0, speedMul = 1;
    let desiredYaw = p.yaw, desiredPitch = 0, turnRate = 4 + this.skill * 4;
    let wantCrouch = false;
    p.using = false;

    if (target && !flashed) {
      if (this.targetId !== target.id) {
        this.targetId = target.id;
        this.acquireT = t;
        this.reactAt = t + rand(0.18, 0.45) * (1.6 - this.skill);
        this.aimHead = Math.random() < 0.15 + this.skill * 0.45;
        const err = 0.35 * (1.2 - this.skill);
        this.aimOffset = [rand(-err, err), rand(-err * 0.6, err * 0.6)];
        this.crouchFight = Math.random() < 0.25;
      }
      this.lastSeen = { x: target.x, y: target.y, z: target.z, t };
      this.ensureGun();
      const cw = this.currentWeapon();
      const eye = this.eye();
      const ty = target.y + (this.aimHead ? (target.crouch ? 1.13 : 1.6) : (target.crouch ? 0.85 : 1.2));
      const dx = target.x - eye[0], dy = ty - eye[1], dz = target.z - eye[2];
      const hd = Math.hypot(dx, dz);
      // el error de puntería se reduce mientras el bot sigue al objetivo
      const settle = Math.max(0, 1 - (t - this.acquireT) / (1.3 - this.skill * 0.6));
      desiredYaw = Math.atan2(-dx, -dz) + this.aimOffset[0] * settle;
      desiredPitch = Math.atan2(dy, hd) + this.aimOffset[1] * settle;
      turnRate = 6 + this.skill * 10;
      const w = cw?.w;
      if (w && w.cat === 'knife') {
        wishX = dx / (hd || 1); wishZ = dz / (hd || 1);
      } else if (w && (w.cat === 'pistol' || w.cat === 'smg' || w.cat === 'heavy')) {
        if (t > this.strafeUntil) { this.strafeDir = -this.strafeDir; this.strafeUntil = t + rand(0.3, 0.8); }
        const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
        wishX = rx * this.strafeDir; wishZ = rz * this.strafeDir;
        speedMul = 0.55;
        if (w.cat === 'heavy' && hd > 8) { wishX += dx / hd; wishZ += dz / hd; }
      } else if (w && hd > 15) {
        wantCrouch = this.crouchFight;
      }
      if (w && w.cat === 'sniper') p.scoped = true;
    } else {
      this.targetId = null;
      p.scoped = false;
      if (!frozen && t >= this.nextDecide) { this.nextDecide = t + 0.5; this.decide(t); }
      const sp = frozen ? null : this.steerPoint();
      if (sp) {
        const dx = sp[0] - p.x, dz = sp[1] - p.z, d = Math.hypot(dx, dz);
        wishX = dx / d; wishZ = dz / d;
        desiredYaw = Math.atan2(-dx, -dz);
        if (this.goalKind === 'via' && this.path.length === 0 && d < 2) this.viaDone = true;
      } else if (!frozen) {
        if (this.goalKind === 'via') this.viaDone = true;
        this.onArrived(t);
        if (this.holdYaw === null) {
          const s = SITES[this.site] || { cx: 0, cz: 0 };
          this.holdYaw = Math.atan2(-(0 - s.cx), -(0 - s.cz)) + rand(-0.5, 0.5);
        }
        desiredYaw = this.holdYaw + Math.sin(t * 0.6 + this.p.id) * 0.6;
      }
      if (this.lookAt && t < this.lookUntil) {
        const e = this.eye();
        const dx = this.lookAt[0] - e[0], dz = this.lookAt[2] - e[2];
        desiredYaw = Math.atan2(-dx, -dz);
        desiredPitch = Math.atan2(this.lookAt[1] - e[1], Math.hypot(dx, dz));
        turnRate = 7;
      }
      if (flashed) { desiredYaw = p.yaw + Math.sin(t * 3) * 0.5; wishX = wishZ = 0; }
      this.maybeReload();
      this.maybeThrowNade(t);
    }

    const err = this.turnTo(desiredYaw, desiredPitch, turnRate, dt);
    if (target && !flashed && t >= this.reactAt) this.tryShoot(t, err, target);

    // crouch
    if (wantCrouch !== p.crouch) {
      if (wantCrouch) { p.crouch = true; p.h = CROUCH_HEIGHT; }
      else if (!findOverlap(p.x, p.y, p.z, PLAYER_RADIUS, STAND_HEIGHT, BOXES)) { p.crouch = false; p.h = STAND_HEIGHT; }
    }

    // movimiento físico
    const cw = this.currentWeapon();
    let speed = (frozen ? 0 : moveSpeed(cw?.item.id || 'knife', p.scoped)) * speedMul;
    if (p.crouch) speed *= 0.34;
    if (p.using) speed = 0;
    const tvx = wishX * speed, tvz = wishZ * speed;
    const k = Math.min(1, dt * (p.onGround ? 10 : 2));
    p.vx += (tvx - p.vx) * k;
    p.vz += (tvz - p.vz) * k;
    moveBody(p, dt, BOXES);
    this.checkStuck(t, speed > 0.5 && (wishX || wishZ));
  }

  onArrived(t) {
    const p = this.p, room = this.room, bomb = room.bomb;
    if (this.goalKind === 'plant' && p.bomb && siteAt(p.x, p.z)) {
      p.using = true;
    } else if (this.goalKind === 'plant' && p.bomb) {
      this.goal = null; this.goalKind = null; this.nextDecide = 0;
    } else if (this.goalKind === 'defuse' && bomb.state === 'planted') {
      if (Math.hypot(p.x - bomb.x, p.z - bomb.z) < 1.8) p.using = true;
      else { this.goal = [bomb.x, bomb.z]; }
    } else if (this.goalKind === 'hunt' || this.goalKind === 'roam' || this.goalKind === 'getbomb') {
      this.lastSeen = null;
      this.goal = null;
      this.goalKind = null;
      this.nextDecide = 0;
    }
  }

  maybeReload() {
    const cw = this.currentWeapon();
    if (!cw || !cw.w.mag) return;
    if (cw.item.mag < cw.w.mag * 0.4 && cw.item.res > 0) this.room.startReload(this.p);
  }

  maybeThrowNade(t) {
    if (t < this.nadeCheckT) return;
    this.nadeCheckT = t + 1;
    const p = this.p;
    if (!this.lastSeen || t - this.lastSeen.t > 8) return;
    const type = p.nades.he > 0 ? 'he' : p.nades.flash > 0 ? 'flash' : null;
    if (!type || Math.random() > 0.2) return;
    const tx = this.lastSeen.x, tz = this.lastSeen.z;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 10 || d > 26) return;
    const T = 1.1 + d / 30;
    const e = this.eye();
    const v = [dx / T, (this.lastSeen.y + 0.5 - e[1] + 0.5 * 20 * T * T) / T, dz / T];
    const sp = Math.hypot(...v);
    if (sp > 24) return;
    this.room.throwNade(p, type, e, v);
  }

  tryShoot(t, aimErr, target) {
    const p = this.p, room = this.room;
    const cw = this.currentWeapon();
    if (!cw || p.reloadUntil) return;
    const { item, w } = cw;
    if (w.cat !== 'knife' && item.mag <= 0) { room.startReload(p); return; }
    if (t < this.nextShotT || t < this.burstPauseUntil) return;
    if (t - p.lastShot < (w.rate || 0.4)) return;
    const dist = Math.hypot(target.x - p.x, target.z - p.z);
    if (aimErr > 0.06 + 0.4 / Math.max(2, dist)) return;
    if (w.cat === 'knife') {
      if (dist > 2.2) return;
      p.lastShot = t;
      room.knifeAttack(p, this.eye(), Math.random() < 0.3, t);
      return;
    }
    const view = viewDir(p.yaw, p.pitch);
    const pellets = w.pellets || 1;
    const speed = Math.hypot(p.vx, p.vz);
    let inacc = (w.cat === 'sniper' ? (p.scoped ? w.scoped : w.spread) : w.spread) +
      (speed > 1.5 ? w.move * Math.min(1, speed / 5) : 0) + (1 - this.skill) * 0.022 + this.burst * 0.0035;
    if (p.crouch) inacc *= 0.8;
    const dirs = [];
    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = inacc * Math.sqrt(Math.random());
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const ux = Math.sin(p.yaw) * Math.sin(p.pitch), uy = Math.cos(p.pitch), uz = Math.cos(p.yaw) * Math.sin(p.pitch);
      const d = [view[0] + rx * Math.cos(a) * r + ux * Math.sin(a) * r, view[1] + uy * Math.sin(a) * r, view[2] + rz * Math.cos(a) * r + uz * Math.sin(a) * r];
      const l = Math.hypot(...d);
      dirs.push([d[0] / l, d[1] / l, d[2] / l]);
    }
    item.mag--;
    p.lastShot = t;
    room.fireBullets(p, this.eye(), dirs, w, item.id, t);
    if (w.auto) {
      this.burst++;
      if (this.burst >= (dist > 25 ? rand(2, 4) : rand(4, 9))) { this.burst = 0; this.burstPauseUntil = t + rand(0.2, 0.45); }
    } else {
      this.nextShotT = t + w.rate + rand(0.05, 0.25) * (1.3 - this.skill);
    }
    if (w.cat === 'sniper') this.nextShotT = t + w.rate + rand(0.2, 0.5);
  }

  checkStuck(t, moving) {
    const p = this.p;
    if (t < this.stuckCheckT) return;
    this.stuckCheckT = t + 0.8;
    if (moving && this.stuckPos && Math.hypot(p.x - this.stuckPos[0], p.z - this.stuckPos[1]) < 0.4) {
      this.stuckCount++;
      if (p.onGround) p.vy = JUMP_VELOCITY;
      if (this.stuckCount >= 2) {
        this.stuckCount = 0;
        this.path = [];
        if (this.goal) this.path = findPath(nearestNode(p.x, p.z), nearestNode(this.goal[0], this.goal[1]));
        p.vx += rand(-4, 4); p.vz += rand(-4, 4);
      }
    } else this.stuckCount = 0;
    this.stuckPos = [p.x, p.z];
  }
}
