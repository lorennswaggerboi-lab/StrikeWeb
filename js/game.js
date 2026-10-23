// Núcleo del cliente: render, entrada, predicción de movimiento, armas, red e interpolación.
import * as THREE from 'three';
import { BOXES, SPAWN_CENTER } from '../shared/map.js';
import { WEAPONS, NADES, NADE_ORDER, moveSpeed, recoilKick } from '../shared/weapons.js';
import {
  moveBody, raycast, rayPlayer, findOverlap, eyeHeight, viewDir, angleWrap,
  STAND_HEIGHT, CROUCH_HEIGHT, JUMP_VELOCITY, PLAYER_RADIUS,
} from '../shared/physics.js';
import { buildWorld } from './world.js';
import { createPlayerModel, setPlayerWeapon, posePlayer, createViewModel, createWeaponModel } from './models.js';
import { Effects } from './effects.js';
import { Sound } from './audio.js';
import { Hud } from './hud.js';

const INTERP_DELAY = 100;
const SEND_INTERVAL = 1000 / 30;
const TEAM_NAMES = { T: 'Terroristas', CT: 'Antiterroristas' };
const REASONS = { elim: 'Equipo eliminado', bomb: 'La bomba ha explotado', defuse: 'Bomba desactivada', time: 'Se acabó el tiempo' };

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAngle = (a, b, k) => a + angleWrap(b - a) * k;

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const q = settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'baja', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'alta' ? 2 : 1));
    this.renderer.shadowMap.enabled = q !== 'baja';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 900);
    this.camera.rotation.order = 'YXZ';
    this.world = buildWorld(this.scene, q);

    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight('#f0f4ff', '#a08060', 2.6));
    const vl = new THREE.DirectionalLight('#fff3e0', 1.6);
    vl.position.set(1, 2, 1);
    this.vmScene.add(vl);
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd08a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.vmFlash.scale.setScalar(0.18);
    this.vmFlash.visible = false;
    this.vmScene.add(this.vmFlash);

    this.effects = new Effects(this.scene);
    this.vmFlash.material.map = this.effects.tex.fire;
    this.sound = new Sound();
    this.sound.setVolume(settings.volume);
    this.hud = new Hud(this);

    this.bombMesh = createWeaponModel('c4');
    this.bombMesh.scale.setScalar(1.6);
    this.bombMesh.visible = false;
    this.bombLight = new THREE.PointLight('#ff2020', 0, 4, 2);
    this.bombMesh.add(this.bombLight);
    this.scene.add(this.bombMesh);

    this.resetState();
    this.keys = {};
    this.mouse = { left: false, right: false };
    this.locked = false;
    this.last = performance.now();
    this.fps = 60;
    this.bindInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resetState() {
    this.connected = false;
    this.ws = null;
    this.myId = -1;
    this.roomName = '';
    this.team = 'SPEC';
    this.alive = false;
    this.phase = 'warmup';
    this.score = { T: 0, CT: 0 };
    this.roundNum = 0;
    this.bomb = null;
    this.priv = null;
    this.roster = [];
    this.rosterMap = new Map();
    this.botsTarget = null;
    this.me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, h: STAND_HEIGHT, onGround: true, yaw: 0, pitch: 0, crouch: false, eye: 1.64 };
    this.spawnSeq = 0;
    this.slot = 2;
    this.prevSlot = 3;
    this.lastSlotChange = 0;
    this.nadeSel = 'he';
    this.nextFire = 0;
    this.spray = 0;
    this.punch = { p: 0, y: 0 };
    this.shake = 0;
    this.lastShotT = 0;
    this.reloadUntil = 0;
    this.reloadDur = 1;
    this.deployUntil = 0;
    this.scope = 0;
    this.rescopeAt = 0;
    this.magPred = null;
    this.snaps = [];
    this.offset = 0;
    this.rtt = 0;
    this.tl = 0;
    this.tlAt = performance.now();
    this.spectateId = null;
    this.deathT = 0;
    this.stepDist = 0;
    this.lastSend = 0;
    this.usingKey = false;
    this.ui = { buy: false, sb: false, chat: false, pause: false, team: false };
    this.nadeMeshes = new Map();
    this.dropMeshes = new Map();
    this.nextBeep = 0;
    this.vm = null;
    this.vmKey = '';
    this.vmKick = 0;
    this.vmSway = { x: 0, y: 0 };
    this.swing = 0;
    this.walkPhase = 0;
    if (this.remotes) for (const r of this.remotes.values()) this.removeRemote(r);
    this.remotes = new Map();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCam.aspect = w / h;
    this.vmCam.updateProjectionMatrix();
  }

  applySettings(key) {
    if (key === 'volume') this.sound.setVolume(this.settings.volume);
    if (key === 'xhColor' || key === 'xhSize' || key === 'xhGap') this.hud.buildCrosshair();
  }

  // ======================= RED =======================
  connect(url, name, room, team, onStatus) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(new Error('URL de servidor inválida')); return; }
      this.ws = ws;
      const slowTimer = setTimeout(() => onStatus?.('Despertando el servidor… (Render gratis puede tardar ~1 min)'), 4000);
      const timeout = setTimeout(() => { if (!settled) { settled = true; ws.close(); reject(new Error('Tiempo de conexión agotado')); } }, 75000);
      ws.onopen = () => {
        onStatus?.('Entrando en la sala…');
        ws.send(JSON.stringify({ t: 'join', name, room, team }));
      };
      ws.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (!settled) {
          if (m.t === 'welcome') {
            settled = true; clearTimeout(timeout); clearTimeout(slowTimer);
            this.onWelcome(m);
            resolve(m);
          } else if (m.t === 'error') {
            settled = true; clearTimeout(timeout); clearTimeout(slowTimer);
            reject(new Error(m.msg));
          }
          return;
        }
        this.handle(m);
      };
      ws.onerror = () => { if (!settled) { settled = true; clearTimeout(timeout); clearTimeout(slowTimer); reject(new Error('No se pudo conectar con el servidor')); } };
      ws.onclose = () => {
        clearTimeout(slowTimer);
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('Conexión cerrada')); return; }
        if (this.connected) { this.connected = false; this.onDisconnect?.('Se perdió la conexión con el servidor'); }
      };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  disconnect() {
    this.connected = false;
    clearInterval(this.pingTimer);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.resetState();
    this.effects.clearRound();
    this.bombMesh.visible = false;
    this.hud.show(false);
    if (this.vm) { this.vmScene.remove(this.vm); this.vm = null; }
  }

  onWelcome(m) {
    this.connected = true;
    this.myId = m.id;
    this.roomName = m.room;
    this.hud.show(true);
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), 2000);
  }

  sendPing() {
    this.send({ t: 'ping', c: performance.now(), rtt: Math.round(this.rtt) });
  }

  serverNow() { return performance.now() + this.offset; }

  handle(m) {
    switch (m.t) {
      case 's': this.onSnapshot(m); break;
      case 'pong': {
        const t = performance.now();
        const rtt = t - m.c;
        this.rtt = this.rtt ? this.rtt * 0.8 + rtt * 0.2 : rtt;
        const off = m.s + rtt / 2 - t;
        this.offset = this.offsetInit ? this.offset * 0.85 + off * 0.15 : off;
        this.offsetInit = true;
        break;
      }
      case 'spawn': this.onSpawn(m); break;
      case 'tp':
        this.me.x = m.x; this.me.y = m.y; this.me.z = m.z; this.me.vx = this.me.vz = this.me.vy = 0;
        this.spawnSeq = m.sp;
        break;
      case 'shot': this.onRemoteShot(m); break;
      case 'hc':
        this.hud.hitmarker(m.k);
        this.sound.hitConfirm(m.hs, m.k);
        break;
      case 'dmg':
        this.hud.damage(m.x, m.z, m.d);
        this.sound.hurt();
        this.punch.p += 0.02 + m.d * 0.0006;
        this.shake = Math.min(0.6, this.shake + m.d / 100);
        break;
      case 'kill': this.onKill(m); break;
      case 'boom': this.onBoom(m); break;
      case 'snd': this.onSnd(m); break;
      case 'chat': this.hud.chat(m.name, m.msg, m); break;
      case 'msg': this.hud.center(m.text, m.kind === 'bomb' ? 'bomb' : '', 3000); break;
      case 'rstart':
        this.effects.clearRound();
        this.hud.center(`Ronda ${m.r}`, '', 2000);
        this.hud.sub('');
        break;
      case 'rend': {
        const win = m.w === this.team;
        const mvp = this.rosterMap.get(m.mvp);
        this.hud.center(`Ganan los ${TEAM_NAMES[m.w]}`, m.w, 5000);
        this.hud.sub((REASONS[m.r] || '') + (mvp ? ` · MVP: ${mvp.n}` : ''));
        setTimeout(() => this.hud.sub(''), 5000);
        if (this.team !== 'SPEC') this.sound.roundEnd(win);
        break;
      }
      case 'planted':
        this.sound.plantBeeps([m.x, m.y + 0.2, m.z]);
        this.nextBeep = 0;
        break;
      case 'defused': this.hud.center('Bomba desactivada', 'CT', 3000); break;
      case 'roster':
        this.roster = m.players;
        this.rosterMap = new Map(m.players.map(p => [p.id, p]));
        this.botsTarget = m.bots;
        if (this.ui.sb) this.hud.renderScoreboard();
        break;
      case 'bought': this.sound.buy(); break;
      case 'kicked': this.onDisconnect?.('Has sido expulsado de la sala'); break;
    }
  }

  onSnapshot(m) {
    const players = new Map();
    for (const e of m.p) players.set(e[0], e);
    this.snaps.push({ time: m.time, players });
    while (this.snaps.length > 30) this.snaps.shift();
    if (!this.offsetInit) { this.offset = m.time - performance.now() + INTERP_DELAY * 0; this.offsetInit = true; }
    if (m.ph !== this.phase) this.onPhase(m.ph);
    this.phase = m.ph;
    this.tl = m.tl;
    this.tlAt = performance.now();
    this.score = m.sc;
    this.roundNum = m.rn;
    this.bomb = m.b;
    this.nadesSnap = m.n;
    this.dropsSnap = m.d;
    const me = m.me;
    const prevAlive = this.priv ? this.priv.al : 0;
    this.priv = me;
    this.team = me.tm;
    if (!me.al && this.alive) this.onLocalDeath();
    if (me.al && !this.alive && prevAlive === 0 && me.sp === this.spawnSeq) this.alive = true;
    // el servidor cambió el arma (compra, recogida, sin granadas)
    if (me.sl !== this.slot && performance.now() - this.lastSlotChange > 500) this.setSlot(me.sl, true);
    if (!this.hasSlot(this.slot)) this.setSlot(this.bestSlot(), false);
    if (this.slot === 4 && !me.nd[NADE_ORDER.indexOf(this.nadeSel)]) {
      const avail = NADE_ORDER.filter((k, i) => me.nd[i] > 0);
      if (avail.length) this.nadeSel = avail[0];
    }
    if (me.rl === 0 && this.reloadUntil && performance.now() > this.reloadUntil - 100) this.reloadUntil = 0;
  }

  onPhase(ph) {
    if (ph === 'freeze') this.hud.sub('Tiempo de compra: pulsa B');
    if (ph === 'live') { this.hud.sub(''); if (this.ui.buy && this.priv && !this.priv.cb) this.toggleBuy(false); }
  }

  onSpawn(m) {
    const me = this.me;
    me.x = m.x; me.y = m.y; me.z = m.z;
    me.vx = me.vy = me.vz = 0;
    me.yaw = m.yaw; me.pitch = 0;
    me.crouch = false; me.h = STAND_HEIGHT;
    this.spawnSeq = m.sp;
    this.alive = true;
    this.deathT = 0;
    this.spectateId = null;
    this.punch.p = this.punch.y = 0;
    this.scope = 0;
    this.reloadUntil = 0;
    this.magPred = null;
    this.camera.rotation.z = 0;
  }

  onLocalDeath() {
    this.alive = false;
    this.deathT = performance.now();
    this.scope = 0;
    this.reloadUntil = 0;
    if (this.ui.buy) this.toggleBuy(false);
    if (this.usingKey) { this.usingKey = false; this.send({ t: 'u', on: 0 }); }
  }

  onKill(m) {
    const killer = this.rosterMap.get(m.k), victim = this.rosterMap.get(m.v);
    this.hud.killfeed(killer, victim, m.w, m.hs, m.k === this.myId || m.v === this.myId);
    const r = this.remotes.get(m.v);
    if (r) { r.alive = false; r.deadAt = performance.now(); }
    if (m.v === this.myId) {
      this.onLocalDeath();
      if (killer && m.k !== this.myId) this.hud.sub(`Te eliminó ${killer.n}${m.hs ? ' (disparo a la cabeza)' : ''}`);
      setTimeout(() => { if (!this.alive) this.hud.sub(''); }, 4000);
      this.spectateId = m.k !== this.myId && killer && killer.tm === this.team ? m.k : null;
    }
  }

  onBoom(m) {
    const pos = v3([m.x, m.y, m.z]);
    const camPos = this.camera.position;
    const dist = camPos.distanceTo(pos);
    if (m.g === 'he' || m.g === 'c4') {
      const big = m.g === 'c4';
      this.effects.explosion(pos, big);
      this.sound.explosion([m.x, m.y, m.z], big);
      this.shake = Math.min(1, this.shake + Math.max(0, (big ? 40 : 15) - dist) / (big ? 30 : 15));
      if (big) this.bombMesh.visible = false;
    } else if (m.g === 'flash') {
      this.effects.flashPop(pos);
      this.sound.flashbang([m.x, m.y, m.z]);
      if (this.alive || this.spectateId === null) {
        const d = pos.clone().sub(camPos);
        const len = d.length();
        if (len < 34) {
          d.divideScalar(len);
          const blocked = raycast([camPos.x, camPos.y, camPos.z], [d.x, d.y, d.z], len, BOXES);
          if (!blocked) {
            const fwd = new THREE.Vector3();
            this.camera.getWorldDirection(fwd);
            const dot = fwd.dot(d);
            const s = Math.max(0, 1 - len / 34) * (dot > 0.55 ? 1 : dot > 0 ? 0.55 : 0.2);
            if (s > 0.05) {
              this.hud.flash(1 + s * 1.2, 0.6 + s * 4.5);
              this.sound.earRing(s);
            }
          }
        }
      }
    } else if (m.g === 'smoke') {
      this.effects.smoke(pos.clone().add(new THREE.Vector3(0, 0.2, 0)));
      this.sound.smoke([m.x, m.y, m.z]);
    }
  }

  onSnd(m) {
    const pos = m.x !== undefined ? [m.x, m.y, m.z] : null;
    switch (m.s) {
      case 'knife': this.sound.swish(pos); break;
      case 'pickup': this.sound.pickup(); break;
      case 'throw': this.sound.swish(pos); break;
      case 'bounce': this.sound.bounce(pos); break;
      case 'plantstart': this.sound.plantBeeps(pos); break;
      case 'defusestart': this.sound.defuseSound(pos); break;
    }
  }

  onRemoteShot(m) {
    const r = this.remotes.get(m.id);
    const w = WEAPONS[m.w];
    const o = v3(m.o);
    this.sound.gun(w?.model, m.o, w?.silenced);
    let from = o.clone();
    if (r && r.model) {
      r.kick = 1;
      const muzzle = r.model.userData.weapon?.userData.muzzle;
      if (muzzle) { muzzle.getWorldPosition(from); }
      if (!w?.silenced) this.effects.muzzleFlash(from, 0.7);
    }
    for (const e of m.e) {
      const end = v3(e);
      if (Math.random() < 0.6) this.effects.tracer(from, end);
      if (e[3] === 0) {
        const d = end.clone().sub(o);
        const len = d.length();
        d.divideScalar(len);
        const hit = raycast(m.o, [d.x, d.y, d.z], len + 0.5, BOXES);
        this.effects.impact(end, hit ? v3(hit.n) : null);
      } else if (e[3] === 1) {
        this.effects.blood(end, end.clone().sub(o).normalize(), false);
      }
    }
  }

  // ======================= ENTRADA =======================
  bindInput() {
    const c = this.canvas;
    c.addEventListener('click', () => {
      this.sound.init();
      if (this.connected && !this.locked && !this.anyOverlay()) this.lock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked && this.connected && !this.anyOverlay() && !this.ui.chat) this.onPauseRequest?.();
      if (!this.locked) { this.mouse.left = this.mouse.right = false; this.keys = {}; this.releaseUse(); }
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      const zoom = this.scopeFov() ? this.scopeFov() / this.settings.fov : 1;
      const k = this.settings.sens * 0.022 * Math.PI / 180 * zoom;
      this.me.yaw -= e.movementX * k;
      this.me.pitch = Math.max(-1.55, Math.min(1.55, this.me.pitch - e.movementY * k));
      this.vmSway.x += e.movementX * 0.00008;
      this.vmSway.y += e.movementY * 0.00008;
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.mouse.left = true;
        if (!this.alive && this.connected) { this.cycleSpectate(); return; }
        if (this.slot === 5) this.pressUse();
        else this.fire(false);
      } else if (e.button === 2) {
        this.mouse.right = true;
        this.secondary();
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) { this.mouse.left = false; if (this.slot === 5) this.releaseUse(); }
      if (e.button === 2) this.mouse.right = false;
    });
    document.addEventListener('contextmenu', e => { if (this.connected) e.preventDefault(); });
    document.addEventListener('wheel', e => {
      if (!this.locked || !this.alive) return;
      const order = [1, 2, 3, 4, 5].filter(s => this.hasSlot(s));
      const i = order.indexOf(this.slot);
      const n = order[(i + (e.deltaY > 0 ? 1 : -1) + order.length) % order.length];
      if (n) this.setSlot(n);
    }, { passive: true });

    document.addEventListener('keydown', e => {
      if (!this.connected) return;
      if (this.ui.chat) {
        if (e.code === 'Enter') {
          const msg = this.hud.el.chatinput.value.trim();
          if (msg) this.send({ t: 'c', msg, tm: this.hud.chatTeam ? 1 : 0 });
          this.closeChat();
        } else if (e.code === 'Escape') this.closeChat();
        return;
      }
      if (e.code === 'Tab') { e.preventDefault(); this.ui.sb = true; this.hud.renderScoreboard(); document.getElementById('scoreboard').classList.remove('hidden'); return; }
      if (e.code === 'KeyB' && !e.repeat) { this.toggleBuy(); return; }
      if (e.code === 'KeyM' && !e.repeat) { this.toggleTeam(); return; }
      if (e.code === 'Escape') {
        if (this.ui.buy) this.toggleBuy(false);
        else if (this.ui.team) this.toggleTeam(false);
        return;
      }
      if (!this.locked) return;
      if (e.code === 'KeyY' || e.code === 'KeyU') { e.preventDefault(); this.openChat(e.code === 'KeyU'); return; }
      if (['Space', 'ControlLeft', 'ControlRight'].includes(e.code)) e.preventDefault();
      if (e.ctrlKey && ['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (e.repeat) return;
      switch (e.code) {
        case 'Digit1': this.setSlot(1); break;
        case 'Digit2': this.setSlot(2); break;
        case 'Digit3': this.setSlot(3); break;
        case 'Digit4': this.setSlot(4); break;
        case 'Digit5': this.setSlot(5); break;
        case 'KeyQ': if (this.hasSlot(this.prevSlot)) this.setSlot(this.prevSlot); break;
        case 'KeyR': this.startReload(); break;
        case 'KeyG': if (this.alive) this.send({ t: 'd' }); break;
        case 'KeyE': this.pressUse(); break;
      }
    });
    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') { this.ui.sb = false; document.getElementById('scoreboard').classList.add('hidden'); }
      if (e.code === 'KeyE') this.releaseUse();
    });
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* algunos navegadores lanzan si no hay gesto del usuario */ }
  }

  anyOverlay() { return this.ui.buy || this.ui.team || this.ui.pause; }

  openChat(team) {
    this.ui.chat = true;
    this.keys = {};
    this.hud.openChat(team);
    document.exitPointerLock();
  }

  closeChat() {
    this.ui.chat = false;
    this.hud.closeChat();
    this.lock();
  }

  toggleBuy(force) {
    const open = force ?? !this.ui.buy;
    if (open && (!this.priv || !this.priv.cb)) { if (this.priv && this.alive) this.hud.center('No puedes comprar ahora', '', 1200); return; }
    this.ui.buy = open;
    document.getElementById('buymenu').classList.toggle('hidden', !open);
    if (open) { this.hud.refreshBuyMenu(); document.exitPointerLock(); }
    else if (this.connected) this.lock();
  }

  toggleTeam(force) {
    const open = force ?? !this.ui.team;
    this.ui.team = open;
    document.getElementById('teamselect').classList.toggle('hidden', !open);
    if (open) document.exitPointerLock(); else if (this.connected) this.lock();
  }

  chooseTeam(team) {
    this.send({ t: 'team', team });
    this.toggleTeam(false);
  }

  buy(id) {
    this.send({ t: 'b', item: id });
  }

  pressUse() {
    if (this.usingKey || !this.alive) return;
    this.usingKey = true;
    this.send({ t: 'u', on: 1 });
  }

  releaseUse() {
    if (!this.usingKey) return;
    this.usingKey = false;
    this.send({ t: 'u', on: 0 });
  }

  // ======================= ARMAS =======================
  hasSlot(s) {
    const p = this.priv;
    if (!p) return s === 3;
    if (s === 1) return !!p.i1;
    if (s === 2) return !!p.i2;
    if (s === 3) return true;
    if (s === 4) return p.nd.some(n => n > 0);
    if (s === 5) return !!p.bm;
    return false;
  }

  bestSlot() { return this.hasSlot(1) ? 1 : this.hasSlot(2) ? 2 : 3; }

  currentItem() {
    const p = this.priv;
    if (!p) return { id: 'knife' };
    const s = this.slot;
    if (s === 1 && p.i1) return { id: p.i1[0], mag: p.i1[1], res: p.i1[2], slot: 1 };
    if (s === 2 && p.i2) return { id: p.i2[0], mag: p.i2[1], res: p.i2[2], slot: 2 };
    if (s === 4) {
      const i = NADE_ORDER.indexOf(this.nadeSel);
      return { id: 'nade', nade: this.nadeSel, count: p.nd[i] || 0, name: NADES[this.nadeSel].name, slot: 4 };
    }
    if (s === 5) return { id: 'c4', name: 'Bomba C4', count: 1, slot: 5 };
    return { id: 'knife', slot: 3 };
  }

  localMag(item) {
    const mp = this.magPred;
    if (mp && mp.slot === item.slot && mp.id === item.id && performance.now() - mp.t < 700) return Math.min(mp.mag, item.mag);
    return item.mag;
  }

  slotList() {
    const p = this.priv;
    if (!p) return [];
    const out = [];
    if (p.i1) out.push({ slot: 1, label: WEAPONS[p.i1[0]].name });
    if (p.i2) out.push({ slot: 2, label: WEAPONS[p.i2[0]].name });
    out.push({ slot: 3, label: 'Cuchillo' });
    const n = NADE_ORDER.map((k, i) => p.nd[i] > 0 ? `${k === 'he' ? 'HE' : k === 'flash' ? 'Cegadora' : 'Humo'}${p.nd[i] > 1 ? '×' + p.nd[i] : ''}` : null).filter(Boolean);
    if (n.length) out.push({ slot: 4, label: n.join(' · ') });
    if (p.bm) out.push({ slot: 5, label: 'C4' });
    return out;
  }

  setSlot(s, fromServer = false) {
    if (!this.hasSlot(s)) return;
    if (s === 4 && this.slot === 4 && !fromServer) {
      // ciclar entre granadas
      const avail = NADE_ORDER.filter((k, i) => this.priv.nd[i] > 0);
      this.nadeSel = avail[(avail.indexOf(this.nadeSel) + 1) % avail.length];
      this.deployUntil = performance.now() + 300;
      this.vmKey = '';
      return;
    }
    if (s === 4) {
      const avail = NADE_ORDER.filter((k, i) => this.priv.nd[i] > 0);
      if (!avail.includes(this.nadeSel)) this.nadeSel = avail[0];
    }
    if (s === this.slot) return;
    if (this.slot === 5) this.releaseUse();
    this.prevSlot = this.slot;
    this.slot = s;
    this.lastSlotChange = performance.now();
    this.scope = 0;
    this.reloadUntil = 0;
    this.spray = 0;
    const w = WEAPONS[this.currentItem().id];
    this.deployUntil = performance.now() + (w?.cat === 'sniper' ? 900 : w?.cat === 'knife' ? 300 : 550);
    if (!fromServer) this.send({ t: 'w', s });
    this.sound.deploy();
  }

  scopeFov() {
    if (!this.scope || performance.now() < this.rescopeAt) return 0;
    const w = WEAPONS[this.currentItem().id];
    return w?.scope ? w.scope[this.scope - 1] : 0;
  }

  secondary() {
    if (!this.alive) return;
    const item = this.currentItem();
    const w = WEAPONS[item.id];
    if (item.id === 'knife') { this.fire(true); return; }
    if (item.id === 'nade') { this.fire(true); return; }
    if (w?.scope && performance.now() > this.deployUntil && !this.reloadUntil) {
      this.scope = (this.scope + 1) % 3;
      this.rescopeAt = 0;
      this.sound.click();
    }
  }

  startReload() {
    if (!this.alive) return;
    const item = this.currentItem();
    const w = WEAPONS[item.id];
    if (!w || !w.mag || this.reloadUntil) return;
    if (this.localMag(item) >= w.mag || item.res <= 0) return;
    this.reloadUntil = performance.now() + w.reload * 1000;
    this.reloadDur = w.reload * 1000;
    this.magPred = null;
    this.scope = 0;
    this.send({ t: 'r' });
    this.sound.reload(w.reload);
  }

  spread(w) {
    const me = this.me;
    const speed = Math.hypot(me.vx, me.vz);
    let s = w.cat === 'sniper' ? (this.scopeFov() ? w.scoped : w.spread) : (w.spread || 0);
    if (speed > 1.4) s += (w.move || 0) * Math.min(1.2, speed / 5);
    if (!me.onGround) s += (w.move || 0.05) * 2 + 0.04;
    if (me.crouch && me.onGround) s *= 0.75;
    if (w.auto) s += Math.min(this.spray, 12) * 0.0011;
    return s;
  }

  aimDir() {
    return viewDir(this.me.yaw + this.punch.y, this.me.pitch + this.punch.p);
  }

  fire(alt) {
    if (!this.alive || this.phase === 'freeze' || this.ui.chat) return;
    const t = performance.now();
    if (t < this.deployUntil || t < this.nextFire || this.reloadUntil) return;
    const item = this.currentItem();
    const me = this.me;
    const eye = [me.x, me.y + me.eye, me.z];
    if (item.id === 'nade') {
      if (item.count <= 0) return;
      const d = viewDir(me.yaw, me.pitch + 0.08);
      const speed = alt ? 8 : 17;
      const v = [d[0] * speed + me.vx * 0.5, d[1] * speed + 1.5 + Math.max(0, me.vy) * 0.5, d[2] * speed + me.vz * 0.5];
      const o = [eye[0] + d[0] * 0.3, eye[1] + d[1] * 0.3 - 0.05, eye[2] + d[2] * 0.3];
      this.send({ t: 'g', g: item.nade, o, v });
      this.nextFire = t + 900;
      this.swing = 1;
      this.sound.swish(null);
      return;
    }
    if (item.id === 'c4') return;
    const w = WEAPONS[item.id];
    const rt = Math.round(this.serverNow() - INTERP_DELAY);
    if (w.cat === 'knife') {
      this.nextFire = t + (alt ? w.heavyRate : w.rate) * 1000;
      this.send({ t: 'f', w: item.id, o: eye, rt, alt: alt ? 1 : 0 });
      this.swing = alt ? 1.4 : 1;
      this.sound.swish(null);
      // predicción visual de impacto en pared
      const d = viewDir(me.yaw, me.pitch);
      const hit = raycast(eye, d, w.range, BOXES);
      if (hit) setTimeout(() => this.effects.impact(v3(eye).add(v3(d).multiplyScalar(hit.t)), v3(hit.n)), 120);
      return;
    }
    const mag = this.localMag(item);
    if (mag <= 0) {
      this.sound.click();
      this.nextFire = t + 250;
      if (item.res > 0) this.startReload();
      return;
    }
    this.magPred = { slot: item.slot, id: item.id, mag: mag - 1, t };
    const inacc = this.spread(w);
    const base = this.aimDir();
    const fwd = v3(base);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const dirs = [];
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = inacc * Math.sqrt(Math.random());
      const d = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      dirs.push([+d.x.toFixed(5), +d.y.toFixed(5), +d.z.toFixed(5)]);
    }
    this.send({ t: 'f', w: item.id, o: eye.map(v => +v.toFixed(3)), d: dirs, rt });

    // efectos locales
    this.sound.gun(w.model, null, w.silenced);
    const camPos = this.camera.position;
    const muzzleWorld = camPos.clone().addScaledVector(fwd, 0.6).addScaledVector(right, 0.13).addScaledVector(up, -0.09);
    const renderT = this.serverNow() - INTERP_DELAY;
    for (const d of dirs) {
      const range = w.range || 250;
      const mh = raycast(eye, d, range, BOXES);
      let tMax = mh ? mh.t : range, hitRemote = null;
      for (const r of this.remotes.values()) {
        if (!r.alive || !r.visible) continue;
        const h = rayPlayer(eye, d, tMax, r.x, r.y, r.z, r.crouch);
        if (h) { tMax = h.t; hitRemote = h; }
      }
      const end = v3(eye).addScaledVector(v3(d), tMax);
      if (Math.random() < 0.5 || pellets > 1) this.effects.tracer(muzzleWorld, end);
      if (hitRemote) this.effects.blood(end, v3(d), hitRemote.group === 'head');
      else if (mh) this.effects.impact(end, v3(mh.n));
    }
    void renderT;
    if (!w.silenced) {
      this.vmFlashUntil = t + 50;
      const light = new THREE.PointLight('#ffb35a', 4, 6, 2);
      light.position.copy(muzzleWorld);
      this.scene.add(light);
      this.effects.add(light, 0.05, (o, k) => { o.intensity = 4 * (1 - k); });
    }
    const [kp, ky] = recoilKick(w, this.spray);
    this.punch.p += kp;
    this.punch.y += ky;
    this.spray++;
    this.lastShotT = t;
    this.vmKick = 1;
    this.nextFire = t + w.rate * 1000;
    if (w.cat === 'sniper' && this.scope) this.rescopeAt = t + w.rate * 1000;
    if (mag - 1 <= 0 && item.res > 0) setTimeout(() => this.startReload(), 250);
  }

  // ======================= BUCLE =======================
  loop(t) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    if (!this.connected) {
      const a = t * 0.00005;
      this.camera.position.set(Math.sin(a) * 75, 42, Math.cos(a) * 75);
      this.camera.lookAt(0, 0, -5);
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      this.effects.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateLocal(dt, t);
    this.updateRemotes(dt, t);
    this.updateEntities(dt, t);
    this.updateCamera(dt, t);
    this.updateViewmodel(dt, t);
    this.effects.update(dt);
    const item = this.currentItem();
    const w = WEAPONS[item.id];
    const scoped = !!this.scopeFov();
    this.hud.updateCrosshair(w && w.cat !== 'knife' ? this.spread(w) : 0.002, scoped || (!this.alive) || (w?.cat === 'sniper'));
    this.hud.el.scope.classList.toggle('hidden', !scoped || !this.alive);
    this.hud.update(dt);

    if (t - this.lastSend > SEND_INTERVAL) {
      this.lastSend = t;
      const me = this.me;
      this.send({ t: 'i', x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yw: +(me.yaw + this.punch.y).toFixed(4), pt: +(me.pitch + this.punch.p).toFixed(4), c: me.crouch ? 1 : 0, sp: this.spawnSeq, s: scoped ? 1 : 0 });
    }

    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    if (this.vm && this.vm.visible) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.vmScene, this.vmCam);
      this.renderer.autoClear = true;
    }
  }

  updateLocal(dt, t) {
    const me = this.me;
    const item = this.currentItem();
    const w = WEAPONS[item.id];
    if (this.reloadUntil && t > this.reloadUntil + 400) this.reloadUntil = 0;

    // retroceso: recuperación
    if (t - this.lastShotT > (w?.rate || 0.1) * 1000 + 60) {
      const k = Math.exp(-dt * 7);
      this.punch.p *= k; this.punch.y *= k;
      if (t - this.lastShotT > 350) this.spray = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);

    if (!this.alive) return;
    const frozen = this.phase === 'freeze';
    const typing = this.ui.chat;
    const k = this.keys;
    let fx = 0, fz = 0;
    if (!typing && this.locked) {
      if (k.KeyW) fz -= 1;
      if (k.KeyS) fz += 1;
      if (k.KeyA) fx -= 1;
      if (k.KeyD) fx += 1;
    }
    const wantCrouch = !typing && (k.ControlLeft || k.ControlRight || k.KeyC);
    const walking = !typing && (k.ShiftLeft || k.ShiftRight);
    if (wantCrouch && !me.crouch) { me.crouch = true; me.h = CROUCH_HEIGHT; }
    else if (!wantCrouch && me.crouch && !findOverlap(me.x, me.y, me.z, PLAYER_RADIUS, STAND_HEIGHT, BOXES)) { me.crouch = false; me.h = STAND_HEIGHT; }
    me.eye = lerp(me.eye, eyeHeight(me.crouch), Math.min(1, dt * 14));

    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    // adelante = (-sin, -cos); derecha = (cos, -sin)
    let wx = -sy * -fz + cy * fx, wz = -cy * -fz - sy * fx;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    let speed = moveSpeed(item.id === 'nade' || item.id === 'c4' ? 'knife' : item.id, !!this.scopeFov());
    if (walking) speed *= 0.52;
    if (me.crouch) speed *= 0.34;
    if (frozen || this.usingKey && (this.priv?.act)) speed = 0;
    const tvx = wx * speed, tvz = wz * speed;
    if (me.onGround) {
      const a = Math.min(1, dt * (wl > 0 ? 11 : 14));
      me.vx += (tvx - me.vx) * a;
      me.vz += (tvz - me.vz) * a;
      if (k.Space && !typing && !frozen && this.locked) { me.vy = JUMP_VELOCITY; me.onGround = false; }
    } else {
      const a = Math.min(1, dt * 1.6);
      me.vx += (tvx - me.vx) * a * (wl > 0 ? 1 : 0);
      me.vz += (tvz - me.vz) * a * (wl > 0 ? 1 : 0);
    }
    const wasAir = !me.onGround, vyBefore = me.vy;
    moveBody(me, dt, BOXES);
    if (wasAir && me.onGround && vyBefore < -6) this.sound.land(null);

    const hs = Math.hypot(me.vx, me.vz);
    if (me.onGround && hs > 0.5) this.walkPhase += dt * hs * 1.6;
    if (me.onGround && hs > 3.3) {
      this.stepDist += hs * dt;
      if (this.stepDist > 2.4) { this.stepDist = 0; this.sound.footstep(null, 0.5); }
    }

    // disparo automático
    if (this.mouse.left && w?.auto && this.locked) this.fire(false);
    if (this.mouse.left && this.slot === 5 && !this.usingKey) this.pressUse();
  }

  // ---------- jugadores remotos ----------
  makeRemote(id) {
    const info = this.rosterMap.get(id);
    const r = { id, team: info?.tm || 'T', name: info?.n || '?', model: null, tag: null, x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
      alive: true, crouch: false, weapon: 'knife', hp: 100, visible: false, walk: 0, stepDist: 0, kick: 0, deadAt: 0, lastX: null };
    this.buildRemoteModel(r);
    this.remotes.set(id, r);
    return r;
  }

  buildRemoteModel(r) {
    if (r.model) this.scene.remove(r.model);
    if (r.tag) this.scene.remove(r.tag);
    r.model = createPlayerModel(r.team);
    this.scene.add(r.model);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '600 30px Rajdhani, Arial';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,.45)';
    const tw = g.measureText(r.name).width + 20;
    g.fillRect(128 - tw / 2, 12, tw, 40);
    g.fillStyle = r.team === 'CT' ? '#8fc0ff' : '#ffd27a';
    g.fillText(r.name, 128, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    r.tag.scale.set(1.6, 0.4, 1);
    r.tag.renderOrder = 10;
    this.scene.add(r.tag);
    r.builtTeam = r.team;
    r.builtName = r.name;
    r.model.userData.weaponId = null;
  }

  removeRemote(r) {
    if (r.model) this.scene.remove(r.model);
    if (r.tag) this.scene.remove(r.tag);
  }

  updateRemotes(dt, t) {
    const rt = this.serverNow() - INTERP_DELAY;
    const snaps = this.snaps;
    if (!snaps.length) return;
    let a = snaps[0], b = snaps[0];
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].time <= rt) { a = snaps[i]; b = snaps[i + 1] || snaps[i]; break; }
    }
    if (rt < snaps[0].time) { a = b = snaps[0]; }
    const k = b.time > a.time ? Math.max(0, Math.min(1, (rt - a.time) / (b.time - a.time))) : 0;
    const latest = snaps[snaps.length - 1];
    const seen = new Set();
    for (const [id, eb] of b.players) {
      if (id === this.myId) continue;
      seen.add(id);
      const ea = a.players.get(id) || eb;
      let r = this.remotes.get(id) || this.makeRemote(id);
      const info = this.rosterMap.get(id);
      if (info) { r.team = info.tm; r.name = info.n; }
      if (r.builtTeam !== r.team || r.builtName !== r.name) this.buildRemoteModel(r);
      const px = r.x, pz = r.z;
      r.x = lerp(ea[1], eb[1], k); r.y = lerp(ea[2], eb[2], k); r.z = lerp(ea[3], eb[3], k);
      r.yaw = lerpAngle(ea[4], eb[4], k); r.pitch = lerp(ea[5], eb[5], k);
      const le = latest.players.get(id) || eb;
      const flags = le[6];
      const wasAlive = r.alive;
      r.alive = !!(flags & 1);
      if (wasAlive && !r.alive && !r.deadAt) r.deadAt = t;
      if (r.alive) r.deadAt = 0;
      r.crouch = !!(eb[6] & 2);
      r.spotted = !!(flags & 4);
      r.hasBomb = !!(flags & 8);
      r.weapon = eb[7];
      r.hp = le[8];
      r.visible = true;
      // pasos de otros jugadores
      const moved = r.lastX === null ? 0 : Math.hypot(r.x - px, r.z - pz);
      r.lastX = r.x;
      const speed = dt > 0 ? moved / dt : 0;
      if (r.alive && speed > 0.5) r.walk += dt * speed * 1.6;
      if (r.alive && speed > 3.3 && speed < 12 && r.y < 3) {
        r.stepDist += moved;
        if (r.stepDist > 2.4) { r.stepDist = 0; this.sound.footstep([r.x, r.y, r.z], 1); }
      }
      // modelo
      const m = r.model;
      const hideForSpectate = !this.alive && this.spectateId === id && this.deathT && t - this.deathT > 2500;
      m.visible = !hideForSpectate;
      m.position.set(r.x, r.y, r.z);
      m.rotation.y = r.yaw;
      setPlayerWeapon(m, r.weapon);
      r.kick = Math.max(0, r.kick - dt * 10);
      m.userData.hand.position.z = -0.38 + r.kick * 0.05;
      posePlayer(m, { crouch: r.crouch, pitch: r.pitch, walk: r.walk, speed: r.alive ? speed : 0, deadT: r.alive ? 0 : (t - (r.deadAt || t)) / 1000 });
      const ally = r.team === this.team || this.team === 'SPEC';
      r.tag.visible = ally && r.alive && !hideForSpectate;
      r.tag.position.set(r.x, r.y + (r.crouch ? 1.75 : 2.2), r.z);
    }
    for (const r of this.remotes.values()) {
      if (!seen.has(r.id)) {
        r.visible = false;
        r.model.visible = false;
        r.tag.visible = false;
        if (!this.rosterMap.has(r.id)) { this.removeRemote(r); this.remotes.delete(r.id); }
      }
    }
  }

  updateEntities(dt, t) {
    // bomba
    const b = this.bomb;
    if (b && (b.s === 'dropped' || b.s === 'planted' || b.s === 'defused')) {
      this.bombMesh.visible = true;
      this.bombMesh.position.set(b.x, b.y + 0.05, b.z);
      if (b.s === 'planted') {
        const interval = Math.max(0.12, Math.min(1, b.tl / 40)) * 1000;
        const timeLeft = this.timeLeft();
        if (t > this.nextBeep && timeLeft > 0.3) {
          this.nextBeep = t + interval;
          this.sound.beep([b.x, b.y + 0.3, b.z], timeLeft < 10);
          this.bombLight.intensity = 3;
        }
        this.bombLight.intensity = Math.max(0, this.bombLight.intensity - dt * 20);
      } else this.bombLight.intensity = 0;
    } else this.bombMesh.visible = false;

    // granadas en vuelo
    const seen = new Set();
    for (const [id, type, x, y, z] of this.nadesSnap || []) {
      seen.add(id);
      let m = this.nadeMeshes.get(id);
      if (!m) {
        m = createWeaponModel('nade');
        m.scale.setScalar(1.5);
        m.position.set(x, y, z);
        m.children[0].material = new THREE.MeshLambertMaterial({ color: type === 'he' ? '#4b5e36' : type === 'flash' ? '#9aa3ab' : '#6b7f8c' });
        this.scene.add(m);
        this.nadeMeshes.set(id, m);
      }
      m.position.lerp(new THREE.Vector3(x, y, z), Math.min(1, dt * 18));
      m.rotation.x += dt * 8;
    }
    for (const [id, m] of this.nadeMeshes) if (!seen.has(id)) { this.scene.remove(m); this.nadeMeshes.delete(id); }

    // armas en el suelo
    const seenD = new Set();
    for (const [id, wid, x, y, z] of this.dropsSnap || []) {
      seenD.add(id);
      let m = this.dropMeshes.get(id);
      if (!m) {
        m = createWeaponModel(wid);
        m.rotation.set(0, Math.random() * 6, Math.PI / 2);
        m.scale.setScalar(1.1);
        this.scene.add(m);
        this.dropMeshes.set(id, m);
      }
      m.position.set(x, y + 0.04, z);
    }
    for (const [id, m] of this.dropMeshes) if (!seenD.has(id)) { this.scene.remove(m); this.dropMeshes.delete(id); }
  }

  timeLeft() {
    return this.tl - (performance.now() - this.tlAt) / 1000;
  }

  spectateCandidates() {
    const list = [...this.remotes.values()].filter(r => r.alive && r.visible && (this.team === 'SPEC' || r.team === this.team));
    return list.sort((a, b) => a.id - b.id);
  }

  cycleSpectate() {
    const list = this.spectateCandidates();
    if (!list.length) return;
    const i = list.findIndex(r => r.id === this.spectateId);
    this.spectateId = list[(i + 1) % list.length].id;
  }

  spectateTarget() {
    if (this.alive) return null;
    if (this.deathT && performance.now() - this.deathT < 2500) return null;
    let r = this.remotes.get(this.spectateId);
    if (!r || !r.alive || !r.visible) {
      const list = this.spectateCandidates();
      r = list[0] || null;
      this.spectateId = r ? r.id : null;
    }
    return r;
  }

  viewState() {
    const s = this.spectateTarget();
    if (s) return { x: s.x, z: s.z, yaw: s.yaw };
    return { x: this.me.x, z: this.me.z, yaw: this.me.yaw };
  }

  updateCamera(dt, t) {
    const cam = this.camera;
    const me = this.me;
    let fov = this.settings.fov;
    const sfov = this.scopeFov();
    if (sfov && this.alive) fov = sfov;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const shake = this.shake * this.shake;
    const sx = (Math.random() - 0.5) * shake * 0.05, sy = (Math.random() - 0.5) * shake * 0.05;
    if (this.alive) {
      const bob = me.onGround ? Math.sin(this.walkPhase * 2) * Math.min(1, Math.hypot(me.vx, me.vz) / 6) * 0.025 : 0;
      cam.position.set(me.x, me.y + me.eye + bob, me.z);
      cam.rotation.set(me.pitch + this.punch.p * 0.45 + sy, me.yaw + this.punch.y * 0.45 + sx, 0);
    } else {
      const spec = this.spectateTarget();
      if (spec) {
        cam.position.set(spec.x, spec.y + eyeHeight(spec.crouch), spec.z);
        cam.rotation.set(spec.pitch, spec.yaw, 0);
      } else if (this.deathT) {
        const k = Math.min(1, (t - this.deathT) / 700);
        cam.position.set(me.x, me.y + lerp(me.eye, 0.35, k), me.z);
        cam.rotation.set(me.pitch * (1 - k) - 0.3 * k, me.yaw, 0.6 * k);
      } else {
        // espectador libre sin objetivo: vista aérea
        cam.position.set(0, 60, 30);
        cam.rotation.set(-1.1, 0, 0);
      }
    }
    const f = viewDir(cam.rotation.y, cam.rotation.x);
    this.sound.updateListener([cam.position.x, cam.position.y, cam.position.z], f);
  }

  updateViewmodel(dt, t) {
    const item = this.currentItem();
    const key = this.alive ? item.id + ':' + (item.nade || '') + ':' + this.team : '';
    if (key !== this.vmKey) {
      this.vmKey = key;
      if (this.vm) this.vmScene.remove(this.vm);
      this.vm = key ? createViewModel(item.id === 'nade' ? 'nade' : item.id, this.team) : null;
      if (this.vm) { this.vm.scale.setScalar(0.5); this.vmScene.add(this.vm); }
    }
    const vm = this.vm;
    if (!vm) return;
    vm.visible = this.alive && !this.scopeFov();
    if (!vm.visible) { this.vmFlash.visible = false; return; }
    const me = this.me;
    const model = vm.userData.model;
    const base = model === 'knife' ? [0.15, -0.15, -0.34] : ['pistol', 'usp', 'deagle'].includes(model) ? [0.12, -0.13, -0.36] : model === 'nade' || model === 'c4' ? [0.13, -0.14, -0.32] : [0.12, -0.13, -0.33];
    const hs = Math.hypot(me.vx, me.vz);
    const bobAmt = me.onGround ? Math.min(1, hs / 6) : 0;
    const bx = Math.cos(this.walkPhase) * 0.012 * bobAmt, by = Math.abs(Math.sin(this.walkPhase)) * 0.012 * bobAmt;
    this.vmSway.x *= Math.exp(-dt * 8);
    this.vmSway.y *= Math.exp(-dt * 8);
    this.vmKick = Math.max(0, this.vmKick - dt * 12);
    this.swing = Math.max(0, this.swing - dt * 3.5);
    let rx = 0, ry = 0, rz = 0, ox = 0, oy = 0, oz = 0;
    // despliegue
    if (t < this.deployUntil) { const k = (this.deployUntil - t) / 550; oy -= k * 0.15; rx -= k * 0.6; }
    // recarga
    if (this.reloadUntil) {
      const k = 1 - Math.max(0, (this.reloadUntil - t) / this.reloadDur);
      const s = Math.sin(Math.min(1, k) * Math.PI);
      rx -= s * 0.5; rz += s * 0.6; oy -= s * 0.06;
    }
    // disparo
    oz += this.vmKick * 0.045;
    rx += this.vmKick * 0.06;
    // cuchillo / lanzamiento
    if (this.swing > 0) {
      const s = Math.sin((1 - Math.min(1, this.swing)) * Math.PI);
      ry += s * 0.9; rx -= s * 0.3; ox -= s * 0.08; oz -= s * 0.06;
    }
    // agacharse
    if (me.crouch) { ox -= 0.01; oy += 0.005; }
    vm.position.set(base[0] + bx + ox - this.vmSway.x, base[1] + by + oy + this.vmSway.y, base[2] + oz);
    vm.rotation.set(rx + this.vmSway.y * 2, ry - this.vmSway.x * 2 + 0.06, rz);
    // fogonazo del viewmodel
    const showFlash = t < (this.vmFlashUntil || 0);
    this.vmFlash.visible = showFlash;
    if (showFlash && vm.userData.muzzle) {
      vm.updateMatrixWorld(true);
      vm.userData.muzzle.getWorldPosition(this.vmFlash.position);
      this.vmFlash.material.rotation = Math.random() * 6;
    }
  }
}

export { SPAWN_CENTER };
