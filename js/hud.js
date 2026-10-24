// Interfaz: HUD, radar, killfeed, chat, menú de compra, marcador y ajustes.
import { BOXES, SITES, siteAt } from '../shared/map.js';
import { WEAPONS, NADES, EQUIPMENT, BUY_MENU, NADE_ORDER, itemInfo } from '../shared/weapons.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEAPON_SHORT = { he: 'HE', bomb: 'C4', knife: 'Cuchillo' };

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'crosshair', 'hitmarker', 'scope', 'flash', 'dmgflash', 'dmgind', 'radar', 'radarloc', 'money', 'moneydelta', 'buyhint', 'buytime',
      'ctAlive', 'tAlive', 'scoreCT', 'scoreT', 'timer', 'roundinfo', 'killfeed', 'center', 'sub', 'progress', 'progressbar', 'progresslabel',
      'hp', 'armor', 'helmet', 'kit', 'slots', 'weaponname', 'mag', 'res', 'bombstatus', 'spectate', 'chatlog', 'chatbox', 'chatinput', 'chatmode', 'netinfo',
      'buymenu', 'buycats', 'buymoney', 'scoreboard', 'sbCT', 'sbT', 'sbSpec', 'sbscoreCT', 'sbscoreT', 'sbround', 'sbroom']) this.el[id] = $(id);
    this.radarCtx = this.el.radar.getContext('2d');
    this.radarMap = this.buildRadarMap();
    this.centerTimer = 0;
    this.hitTimer = 0;
    this.lastMoney = null;
    this.moneyTimer = 0;
    this.flashAmount = 0;
    this.flashDecay = 1;
    this.dmgAlpha = 0;
    this.buildCrosshair();
    this.buildBuyMenu();
    this.cache = {};
  }

  set(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    this.el[id].textContent = value;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  buildCrosshair() {
    const s = this.game.settings;
    const x = this.el.crosshair;
    x.innerHTML = '';
    this.xh = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('i');
      b.style.background = s.xhColor;
      x.appendChild(b);
      this.xh.push(b);
    }
    this.xhGapCur = -1;
  }

  updateCrosshair(spread, hidden) {
    const s = this.game.settings;
    this.el.crosshair.style.display = hidden ? 'none' : '';
    if (hidden) return;
    const gap = Math.round(s.xhGap + spread * 900);
    if (gap === this.xhGapCur) return;
    this.xhGapCur = gap;
    const len = s.xhSize, th = 2;
    const [t, b, l, r] = this.xh;
    Object.assign(t.style, { width: th + 'px', height: len + 'px', left: -th / 2 + 'px', top: -(gap + len) + 'px' });
    Object.assign(b.style, { width: th + 'px', height: len + 'px', left: -th / 2 + 'px', top: gap + 'px' });
    Object.assign(l.style, { width: len + 'px', height: th + 'px', left: -(gap + len) + 'px', top: -th / 2 + 'px' });
    Object.assign(r.style, { width: len + 'px', height: th + 'px', left: gap + 'px', top: -th / 2 + 'px' });
  }

  hitmarker(kill) {
    const h = this.el.hitmarker;
    h.classList.toggle('kill', !!kill);
    h.classList.add('show');
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => h.classList.remove('show'), kill ? 220 : 110);
  }

  center(text, cls = '', dur = 3000) {
    const c = this.el.center;
    c.textContent = text;
    c.className = 'show ' + cls;
    clearTimeout(this.centerTimer);
    this.centerTimer = setTimeout(() => { c.className = cls; }, dur);
  }

  sub(text) { this.set('sub', text || ''); }

  killfeed(killer, victim, weapon, hs, isMe) {
    const row = document.createElement('div');
    row.className = 'kf' + (isMe ? ' me' : '');
    const name = p => p ? `<span class="c${p.tm}">${esc(p.n)}</span>` : '';
    const wName = WEAPONS[weapon]?.name || WEAPON_SHORT[weapon] || weapon;
    row.innerHTML = `${name(killer)}<span class="w">${esc(wName)}</span>${hs ? '<span class="hs">⌖ HS</span>' : ''}${name(victim)}`;
    this.el.killfeed.appendChild(row);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
    setTimeout(() => { row.style.opacity = '0'; setTimeout(() => row.remove(), 600); }, 6000);
  }

  chat(name, msg, { team, tm, dead, sys } = {}) {
    const row = document.createElement('div');
    row.className = 'cm' + (sys ? ' sys' : '');
    if (sys) row.textContent = msg;
    else row.innerHTML = `${dead ? '<span style="color:#999">*MUERTO* </span>' : ''}${tm ? '<span style="color:#aaa">(Equipo) </span>' : ''}<b class="c${team}">${esc(name)}</b>: ${esc(msg)}`;
    this.el.chatlog.appendChild(row);
    while (this.el.chatlog.children.length > 8) this.el.chatlog.firstChild.remove();
    setTimeout(() => { row.style.opacity = '0'; }, 9000);
  }

  openChat(team) {
    this.el.chatbox.classList.remove('hidden');
    this.el.chatlog.classList.add('open');
    this.el.chatmode.textContent = team ? 'EQUIPO:' : 'TODOS:';
    this.chatTeam = team;
    this.el.chatinput.value = '';
    setTimeout(() => this.el.chatinput.focus(), 0);
  }

  closeChat() {
    this.el.chatbox.classList.add('hidden');
    this.el.chatlog.classList.remove('open');
    this.el.chatinput.blur();
  }

  damage(fromX, fromZ, amount) {
    const g = this.game;
    const dx = fromX - g.me.x, dz = fromZ - g.me.z;
    // ángulo relativo a la vista
    const ang = Math.atan2(-dx, -dz) - g.me.yaw;
    const arc = document.createElement('div');
    arc.className = 'arc';
    arc.style.transform = `rotate(${-ang}rad)`;
    this.el.dmgind.appendChild(arc);
    setTimeout(() => { arc.style.opacity = '0'; }, 50);
    setTimeout(() => arc.remove(), 1100);
    this.dmgAlpha = Math.min(0.8, this.dmgAlpha + amount / 60);
  }

  flash(amount, duration) {
    if (amount > this.flashAmount) {
      this.flashAmount = amount;
      this.flashDecay = 1 / Math.max(0.3, duration);
    }
  }

  tickOverlays(dt) {
    if (this.flashAmount > 0) {
      this.flashAmount = Math.max(0, this.flashAmount - dt * this.flashDecay);
      this.el.flash.style.opacity = Math.min(1, this.flashAmount * 1.4).toFixed(3);
    } else if (this.el.flash.style.opacity !== '0') this.el.flash.style.opacity = '0';
    if (this.dmgAlpha > 0) {
      this.dmgAlpha = Math.max(0, this.dmgAlpha - dt * 1.5);
      this.el.dmgflash.style.opacity = this.dmgAlpha.toFixed(3);
    }
  }

  // ---------- radar ----------
  buildRadarMap() {
    const c = document.createElement('canvas');
    const S = 4; // px por metro
    c.width = c.height = 124 * S;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3426';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#8c7a57';
    g.fillRect(2 * S, 2 * S, 120 * S, 120 * S);
    for (const k in SITES) {
      const s = SITES[k];
      g.fillStyle = 'rgba(200,60,40,.25)';
      g.fillRect((s.x1 + 62) * S, (s.z1 + 62) * S, (s.x2 - s.x1) * S, (s.z2 - s.z1) * S);
    }
    for (const b of BOXES) {
      g.fillStyle = b.mat === 'crate' || b.mat === 'barrel' ? '#5c4d33' : '#2f2a20';
      if (b.min[1] > 2) continue;
      g.fillRect((b.min[0] + 62) * S, (b.min[2] + 62) * S, (b.max[0] - b.min[0]) * S, (b.max[2] - b.min[2]) * S);
    }
    g.font = `bold ${14 * S}px Rajdhani, Arial`;
    g.fillStyle = 'rgba(255,90,70,.8)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const k in SITES) g.fillText(k, (SITES[k].cx + 62) * S, (SITES[k].cz + 62) * S);
    return { canvas: c, S };
  }

  drawRadar() {
    const g = this.radarCtx, game = this.game;
    const W = 220, scale = 2.0; // px por metro en pantalla
    const { canvas, S } = this.radarMap;
    const view = game.viewState();
    g.save();
    g.clearRect(0, 0, W, W);
    g.translate(W / 2, W / 2);
    g.rotate(view.yaw);
    g.scale(scale / S, scale / S);
    g.translate(-(view.x + 62) * S, -(view.z + 62) * S);
    g.drawImage(canvas, 0, 0);
    g.restore();

    const toRadar = (x, z) => {
      const dx = (x - view.x) * scale, dz = (z - view.z) * scale;
      const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
      return [W / 2 + dx * c - dz * s, W / 2 + dx * s + dz * c];
    };
    const myTeam = game.team;
    const bomb = game.bomb;
    if (bomb && (myTeam === 'T' || bomb.s === 'planted') && (bomb.s === 'dropped' || bomb.s === 'planted')) {
      const [bx, by] = toRadar(bomb.x, bomb.z);
      g.fillStyle = bomb.s === 'planted' && (performance.now() % 600 < 300) ? '#ff3b30' : '#ff9f0a';
      g.fillRect(bx - 5, by - 3, 10, 6);
    }
    for (const r of game.remotes.values()) {
      if (!r.visible || r.id === game.myId) continue;
      const ally = r.team === myTeam;
      if (!ally && !(r.spotted && r.alive)) continue;
      const [px, py] = toRadar(r.x, r.z);
      if (px < -5 || py < -5 || px > W + 5 || py > W + 5) continue;
      if (!r.alive) {
        g.strokeStyle = ally ? '#9cc' : '#c99';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(px - 4, py - 4); g.lineTo(px + 4, py + 4); g.moveTo(px + 4, py - 4); g.lineTo(px - 4, py + 4); g.stroke();
        continue;
      }
      g.fillStyle = ally ? (r.team === 'CT' ? '#5d9be0' : '#e2b04a') : '#ff3b30';
      g.beginPath(); g.arc(px, py, 4.5, 0, 7); g.fill();
      if (r.hasBomb && myTeam === 'T') { g.strokeStyle = '#ff9f0a'; g.lineWidth = 2; g.stroke(); }
      if (ally) {
        const a = r.yaw - view.yaw;
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.sin(a) * 9, py - Math.cos(a) * 9); g.stroke();
      }
    }
    // yo / observado
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(W / 2, W / 2 - 7); g.lineTo(W / 2 + 5, W / 2 + 5); g.lineTo(W / 2, W / 2 + 2); g.lineTo(W / 2 - 5, W / 2 + 5); g.closePath(); g.fill();
    const site = siteAt(view.x, view.z);
    this.set('radarloc', site ? `Sitio ${site}` : zoneName(view.x, view.z));
  }

  // ---------- menú de compra ----------
  buildBuyMenu() {
    const root = this.el.buycats;
    root.innerHTML = '';
    this.buyButtons = [];
    for (const cat of BUY_MENU) {
      const col = document.createElement('div');
      col.className = 'bcat';
      col.innerHTML = `<h4>${cat.title}</h4>`;
      for (const id of cat.items) {
        const info = itemInfo(id);
        const b = document.createElement('button');
        b.className = 'bitem';
        b.innerHTML = `${esc(info.name)}<span class="pr">$${info.price}</span>`;
        b.dataset.id = id;
        b.addEventListener('click', () => this.game.buy(id));
        col.appendChild(b);
        this.buyButtons.push(b);
      }
      root.appendChild(col);
    }
  }

  refreshBuyMenu() {
    const g = this.game, me = g.priv;
    if (!me) return;
    this.el.buymoney.textContent = '$' + me.mo;
    for (const b of this.buyButtons) {
      const id = b.dataset.id;
      const info = itemInfo(id);
      const w = WEAPONS[id];
      let price = info.price;
      if (id === 'vesthelm' && me.ar >= 100) price = 350;
      const team = w?.team || info.team;
      const wrongTeam = team && team !== g.team;
      let owned = false;
      if (w) owned = (me.i1 && me.i1[0] === id) || (me.i2 && me.i2[0] === id);
      else if (NADES[id]) owned = me.nd[NADE_ORDER.indexOf(id)] >= NADES[id].max;
      else if (id === 'vest') owned = me.ar >= 100;
      else if (id === 'vesthelm') owned = me.ar >= 100 && me.hm;
      else if (id === 'defuser') owned = !!me.df;
      b.disabled = wrongTeam || owned || me.mo < price || !me.cb;
      b.classList.toggle('owned', owned);
      b.classList.toggle('hidden', !!wrongTeam);
      b.querySelector('.pr').textContent = '$' + price;
    }
  }

  // ---------- marcador ----------
  renderScoreboard() {
    const g = this.game;
    const roster = g.roster || [];
    const row = p => `<tr class="${p.al ? '' : 'dead'} ${p.id === g.myId ? 'me' : ''}"><td>${esc(p.n)}${p.b ? ' <small style="color:#888">BOT</small>' : ''}</td><td>${p.m >= 0 ? '$' + p.m : ''}</td><td>${p.k}</td><td>${p.a}</td><td>${p.d}</td><td>${p.mvp ? '★' + p.mvp : ''}</td><td>${p.b ? 'BOT' : p.pg}</td></tr>`;
    const head = '<tr><th>Jugador</th><th>Dinero</th><th>K</th><th>A</th><th>D</th><th>MVP</th><th>Ping</th></tr>';
    for (const team of ['CT', 'T']) {
      const list = roster.filter(p => p.tm === team).sort((a, b) => b.k - a.k || a.d - b.d);
      this.el['sb' + team].innerHTML = head + list.map(row).join('');
    }
    const spec = roster.filter(p => p.tm === 'SPEC');
    this.el.sbSpec.textContent = spec.length ? 'Espectadores: ' + spec.map(p => p.n).join(', ') : '';
    this.el.sbscoreCT.textContent = g.score.CT;
    this.el.sbscoreT.textContent = g.score.T;
    this.el.sbround.textContent = `de_dunas · Ronda ${g.roundNum || '-'} · Bots por equipo: ${g.botsTarget ?? '-'}`;
    this.el.sbroom.textContent = `Sala: ${g.roomName}`;
  }

  // ---------- actualización por frame ----------
  update(dt) {
    const g = this.game, me = g.priv;
    this.tickOverlays(dt);
    this.drawRadar();
    this.set('netinfo', `${g.fps | 0} FPS · ${g.rtt | 0} ms`);

    // marcador superior
    this.set('scoreCT', String(g.score.CT));
    this.set('scoreT', String(g.score.T));
    const t = Math.max(0, g.timeLeft());
    const ts = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    this.set('timer', g.phase === 'live' && g.bomb?.s === 'planted' ? '💣 ' + Math.ceil(t) : ts);
    this.el.timer.classList.toggle('bomb', g.bomb?.s === 'planted');
    const phaseName = { warmup: 'Calentamiento', freeze: 'Tiempo de compra', live: `Ronda ${g.roundNum}`, post: 'Fin de ronda' }[g.phase] || '';
    this.set('roundinfo', phaseName);
    const alive = { T: [], CT: [] };
    for (const r of g.remotes.values()) if (r.team in alive && r.visible) alive[r.team].push(r.alive);
    const dots = arr => arr.sort((a, b) => b - a).map(a => `<i class="${a ? '' : 'dead'}"></i>`).join('');
    const ctH = dots(alive.CT), tH = dots(alive.T);
    if (this.cache.ctA !== ctH) { this.cache.ctA = ctH; this.el.ctAlive.innerHTML = ctH; }
    if (this.cache.tA !== tH) { this.cache.tA = tH; this.el.tAlive.innerHTML = tH; }

    if (!me) return;
    // dinero
    if (this.lastMoney !== null && me.mo !== this.lastMoney && Math.abs(me.mo - this.lastMoney) < 9000) {
      const d = me.mo - this.lastMoney;
      const md = this.el.moneydelta;
      md.textContent = (d > 0 ? '+$' : '-$') + Math.abs(d);
      md.style.color = d > 0 ? '#8fe08f' : '#ff8a80';
      md.classList.add('show');
      clearTimeout(this.moneyTimer);
      this.moneyTimer = setTimeout(() => md.classList.remove('show'), 50);
    }
    this.lastMoney = me.mo;
    this.set('money', '$' + me.mo);
    const canBuy = !!me.cb && me.al;
    this.el.buyhint.classList.toggle('hidden', !canBuy);
    if (canBuy) this.set('buytime', g.phase === 'warmup' ? 'calentamiento' : `${Math.ceil(me.bt)} s`);
    if (!this.el.buymenu.classList.contains('hidden')) this.refreshBuyMenu();

    const spectating = !g.alive;
    const view = spectating ? g.spectateTarget() : null;
    const hp = spectating ? (view ? view.hp : 0) : me.hp;
    this.set('hp', String(Math.max(0, hp)));
    this.el.hp.parentElement.classList.toggle('low', hp <= 25);
    this.set('armor', spectating ? '-' : String(me.ar));
    this.el.helmet.classList.toggle('hidden', spectating || !me.hm);
    this.el.kit.classList.toggle('hidden', spectating || !me.df);

    // arma y munición
    const cur = g.currentItem();
    if (!spectating && cur) {
      const w = WEAPONS[cur.id];
      this.set('weaponname', w ? w.name : cur.name || '');
      if (w && w.mag) {
        this.set('mag', String(g.localMag(cur)));
        this.set('res', '/ ' + cur.res);
        this.el.mag.classList.toggle('low', g.localMag(cur) <= Math.ceil(w.mag * 0.2));
      } else if (cur.count !== undefined) {
        this.set('mag', String(cur.count)); this.set('res', '');
        this.el.mag.classList.remove('low');
      } else { this.set('mag', '∞'); this.set('res', ''); this.el.mag.classList.remove('low'); }
    } else {
      this.set('weaponname', view ? (WEAPONS[view.weapon]?.name || '') : '');
      this.set('mag', '-'); this.set('res', '');
    }
    const slotsHtml = spectating ? '' : g.slotList().map(s => `<div class="sl ${s.slot === g.slot ? 'on' : ''}"><b>${s.slot}</b>${esc(s.label)}</div>`).join('');
    if (this.cache.slots !== slotsHtml) { this.cache.slots = slotsHtml; this.el.slots.innerHTML = slotsHtml; }

    // bomba
    const b = g.bomb;
    let bs = '';
    if (b?.s === 'planted') bs = `Bomba plantada en ${b.site}` + (b.dp >= 0 ? ` · desactivando ${Math.round(b.dp * 100)}%` : '');
    else if (b?.s === 'dropped' && g.team === 'T') bs = 'La bomba está en el suelo';
    this.el.bombstatus.classList.toggle('hidden', !bs);
    if (bs) this.set('bombstatus', bs);

    // progreso plantar / desactivar
    const act = me.act;
    this.el.progress.classList.toggle('hidden', !act);
    if (act) {
      this.set('progresslabel', act === 'plant' ? 'Plantando la bomba…' : me.df ? 'Desactivando (con kit)…' : 'Desactivando…');
      this.el.progressbar.style.width = (me.pr * 100).toFixed(1) + '%';
    }

    // observando
    this.el.spectate.classList.toggle('hidden', !spectating);
    if (spectating) {
      const html = view ? `Observando a <b class="c${view.team}">${esc(view.name)}</b><small>Clic para cambiar · ${g.phase === 'warmup' ? 'Reapareces en breve' : 'Esperando a la siguiente ronda'}</small>`
        : `<small>${g.team === 'SPEC' ? 'Modo espectador · [M] elegir equipo' : 'Esperando a la siguiente ronda'}</small>`;
      if (this.cache.spec !== html) { this.cache.spec = html; this.el.spectate.innerHTML = html; }
    }
  }
}

function zoneName(x, z) {
  if (z > 26) return 'Base T';
  if (z < -26) return x < -28 ? 'Cerca de B' : x > 28 ? 'Cerca de A' : 'Base CT';
  if (x < -44) return 'Carril B';
  if (x > 42) return 'A largo';
  if (x > -8 && x < 8) return 'Medio';
  if (z > 8 && z < 13 && x < -8) return 'Túnel';
  if (z > -18 && z < -13 && x > 8) return 'A corto';
  return '';
}

// ---------- Ajustes ----------
export function renderSettings(container, settings, onChange) {
  const rows = [
    ['sens', 'Sensibilidad', 'range', 0.2, 6, 0.05],
    ['fov', 'Campo de visión', 'range', 70, 110, 1],
    ['volume', 'Volumen', 'range', 0, 1, 0.01],
    ['xhSize', 'Tamaño de mira', 'range', 2, 14, 1],
    ['xhGap', 'Separación de mira', 'range', 0, 10, 1],
    ['xhColor', 'Color de mira', 'color'],
    ['quality', 'Calidad (recargar)', 'select', ['baja', 'media', 'alta']],
  ];
  container.innerHTML = '';
  for (const [key, label, type, a, b, step] of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    let input, val;
    if (type === 'select') {
      input = document.createElement('select');
      input.style.width = '150px';
      for (const opt of a) { const o = document.createElement('option'); o.value = opt; o.textContent = opt; input.appendChild(o); }
      input.value = settings[key];
    } else {
      input = document.createElement('input');
      input.type = type;
      if (type === 'range') { input.min = a; input.max = b; input.step = step; }
      input.value = settings[key];
    }
    row.innerHTML = `<span>${label}</span>`;
    const right = document.createElement('div');
    right.style.display = 'flex'; right.style.alignItems = 'center'; right.style.gap = '6px';
    right.appendChild(input);
    if (type === 'range') { val = document.createElement('span'); val.className = 'val'; val.textContent = settings[key]; right.appendChild(val); }
    row.appendChild(right);
    input.addEventListener('input', () => {
      settings[key] = type === 'range' ? parseFloat(input.value) : input.value;
      if (val) val.textContent = settings[key];
      onChange(key);
    });
    container.appendChild(row);
  }
}
