// Interfaz en partida estilo CS2: HUD, radar, killfeed, avatares, compra, marcador, veto y fin de partida.
import { siteAt, getMap } from '../shared/maps.js';
import { WEAPONS, NADES, EQUIPMENT, BUY_MENU, NADE_ORDER, itemInfo } from '../shared/weapons.js';
import { icon, defaultAvatar, mapPreview } from './icons.js';

const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REASON_ICON = { elim: 'elim', bomb: 'bomb', defuse: 'defuse', time: 'time' };
const TEAM_WIN = { T: 'Los terroristas ganan', CT: 'Los antiterroristas ganan' };

export function ratingColor(r) {
  if (r >= 2000) return '#e8b03f';
  if (r >= 1600) return '#c45ae0';
  if (r >= 1300) return '#5f8fe6';
  if (r >= 1100) return '#6fb7e6';
  return '#9aa3ab';
}

export function ratingBadge(r) {
  return `<span class="rating" style="color:${ratingColor(r)};border-left:3px solid ${ratingColor(r)}">${Math.round(r)}</span>`;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'crosshair', 'hitmarker', 'scope', 'flash', 'dmgflash', 'dmgind', 'radar', 'radarloc', 'money', 'moneydelta', 'buyhint', 'buytime',
      'ctAvatars', 'tAvatars', 'scoreCT', 'scoreT', 'timer', 'roundinfo', 'banner', 'killfeed', 'center', 'sub', 'roundend', 'reTitle', 'reMvp',
      'progress', 'progressbar', 'progresslabel', 'hp', 'hpbar', 'armor', 'helmet', 'kit', 'slots', 'mag', 'res', 'bombstatus', 'spectate',
      'dmgreport', 'chatlog', 'chatbox', 'chatinput', 'chatmode', 'netinfo', 'buymenu', 'buycats', 'buymoney', 'buytimeleft',
      'scoreboard', 'sbCT', 'sbT', 'sbSpec', 'sbscoreCT', 'sbscoreT', 'sbround', 'sbroom', 'sbmap', 'sbhist',
      'mapvote', 'voteturn', 'votetimer', 'votemaps', 'votehint', 'matchend', 'meTitle', 'meScore', 'meRating', 'meTable', 'meHint']) this.el[id] = $(id);
    this.radarCtx = this.el.radar.getContext('2d');
    this.radarMap = null;
    this.timers = {};
    this.lastMoney = null;
    this.flashAmount = 0;
    this.flashDecay = 1;
    this.dmgAlpha = 0;
    this.cache = {};
    this.buildCrosshair();
    this.buildBuyMenu();
  }

  set(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    this.el[id].textContent = value;
  }

  html(id, value) {
    if (this.cache['h' + id] === value) return;
    this.cache['h' + id] = value;
    this.el[id].innerHTML = value;
  }

  later(key, ms, fn) {
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(fn, ms);
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  avatar(id) {
    const g = this.game;
    const info = g.rosterMap.get(id);
    return g.avatars.get(id) || defaultAvatar(info?.n || '?', !!info?.b);
  }

  // ---------- mira ----------
  buildCrosshair() {
    const s = this.game.settings;
    const x = this.el.crosshair;
    x.innerHTML = '';
    this.xh = [];
    const col = hexA(s.xhColor, s.xhAlpha);
    const outline = s.xhOutline ? '0 0 0 1px rgba(0,0,0,.85)' : 'none';
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('i');
      b.style.background = col;
      b.style.boxShadow = outline;
      x.appendChild(b);
      this.xh.push(b);
    }
    if (s.xhDot) {
      const d = document.createElement('i');
      const t = s.xhThick;
      Object.assign(d.style, { background: col, boxShadow: outline, width: t + 'px', height: t + 'px', left: -t / 2 + 'px', top: -t / 2 + 'px' });
      x.appendChild(d);
    }
    this.xhGapCur = -1;
  }

  updateCrosshair(spread, hidden) {
    const s = this.game.settings;
    this.el.crosshair.style.display = hidden ? 'none' : '';
    if (hidden) return;
    const gap = Math.round(s.xhGap + (s.xhDynamic ? spread * 900 : 0));
    if (gap === this.xhGapCur) return;
    this.xhGapCur = gap;
    const len = s.xhSize, th = s.xhThick;
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
    this.later('hit', kill ? 220 : 110, () => h.classList.remove('show'));
  }

  center(text, cls = '', dur = 3000) {
    const c = this.el.center;
    c.textContent = text;
    c.className = 'show ' + cls;
    this.later('center', dur, () => { c.className = cls; });
  }

  sub(text) { this.set('sub', text || ''); }

  banner(text, dur = 4000) {
    if (!text) return;
    this.el.banner.textContent = text;
    this.el.banner.classList.add('show');
    this.later('banner', dur, () => this.el.banner.classList.remove('show'));
  }

  roundEnd(winner, mvpId, why, reason) {
    const re = this.el.roundend;
    re.className = winner;
    this.el.reTitle.innerHTML = `${TEAM_WIN[winner]}${reason ? `<small>${esc(reason)}</small>` : ''}`;
    const mvp = this.game.rosterMap.get(mvpId);
    this.el.reMvp.innerHTML = mvp ? `<div class="av" style="background-image:url(${this.avatar(mvpId)})"></div><div>★ MVP: <b class="c${mvp.tm}">${esc(mvp.n)}</b><small>${esc(why || '')}</small></div>` : '';
    this.el.reMvp.style.display = mvp ? '' : 'none';
    this.later('re', 5200, () => re.classList.add('hidden'));
  }

  killfeed(m) {
    const g = this.game;
    const killer = g.rosterMap.get(m.k), victim = g.rosterMap.get(m.v), assist = g.rosterMap.get(m.a);
    const row = document.createElement('div');
    const mine = m.k === g.myId || m.v === g.myId || m.a === g.myId;
    row.className = 'kf' + (mine ? ' me' : '');
    const name = p => p ? `<span class="c${p.tm}">${esc(p.n)}</span>` : '';
    const flag = (on, id) => on ? `<img class="fl" src="${icon(id)}">` : '';
    row.innerHTML = `${name(killer)}${assist ? ` + ${name(assist)}` : ''}<img src="${icon(m.w === 'nade' ? 'he' : m.w === 'bomb' ? 'c4' : m.w)}">${flag(m.ns, 'ns')}${flag(m.sm, 'sm')}${flag(m.wb, 'wb')}${flag(m.hs, 'hs')}${name(victim)}`;
    this.el.killfeed.appendChild(row);
    while (this.el.killfeed.children.length > 7) this.el.killfeed.firstChild.remove();
    setTimeout(() => { row.style.opacity = '0'; setTimeout(() => row.remove(), 600); }, mine ? 9000 : 6000);
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
    const ang = Math.atan2(-(fromX - g.me.x), -(fromZ - g.me.z)) - g.me.yaw;
    const arc = document.createElement('div');
    arc.className = 'arc';
    arc.style.transform = `rotate(${-ang}rad)`;
    this.el.dmgind.appendChild(arc);
    setTimeout(() => { arc.style.opacity = '0'; }, 60);
    setTimeout(() => arc.remove(), 1100);
    this.dmgAlpha = Math.min(0.8, this.dmgAlpha + amount / 60);
  }

  damageReport(list) {
    const el = this.el.dmgreport;
    const rows = list.map(r => `<tr><td class="c${r.tm}">${esc(r.n)}</td><td class="g">${r.gd ? `${r.gd} en ${r.gh}` : '—'}</td><td class="r">${r.td ? `${r.td} en ${r.th}` : '—'}</td></tr>`).join('');
    el.innerHTML = `<h4>DAÑO ESTA RONDA</h4><table><tr><td></td><td class="g">Hecho</td><td class="r">Recibido</td></tr>${rows}</table>`;
    el.classList.remove('hidden');
    this.later('dmgrep', 7000, () => el.classList.add('hidden'));
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
  setMap(map) {
    const S = 4;
    const c = document.createElement('canvas');
    c.width = map.w * map.cell * S + 40;
    c.height = map.h * map.cell * S + 40;
    const g = c.getContext('2d');
    g.fillStyle = '#15130f';
    g.fillRect(0, 0, c.width, c.height);
    const px = map.cell * S, off = 20;
    for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
      const ch = map.grid[z][x];
      if (ch === '#' || ch === '%') continue;
      g.fillStyle = ch === 'A' || ch === 'B' ? '#9a7a5a' : ch === '=' ? '#6d6555' : 'cCKwb'.includes(ch) ? '#4b4234' : ch === '1' || ch === '2' ? '#857a64' : '#8c816a';
      g.fillRect(off + x * px, off + z * px, px + 0.5, px + 0.5);
    }
    // contorno de muros
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = 2;
    for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
      const solid = (xx, zz) => { const ch = map.grid[zz]?.[xx]; return !ch || ch === '#' || ch === '%'; };
      if (solid(x, z)) continue;
      if (solid(x - 1, z)) { g.beginPath(); g.moveTo(off + x * px, off + z * px); g.lineTo(off + x * px, off + (z + 1) * px); g.stroke(); }
      if (solid(x + 1, z)) { g.beginPath(); g.moveTo(off + (x + 1) * px, off + z * px); g.lineTo(off + (x + 1) * px, off + (z + 1) * px); g.stroke(); }
      if (solid(x, z - 1)) { g.beginPath(); g.moveTo(off + x * px, off + z * px); g.lineTo(off + (x + 1) * px, off + z * px); g.stroke(); }
      if (solid(x, z + 1)) { g.beginPath(); g.moveTo(off + x * px, off + (z + 1) * px); g.lineTo(off + (x + 1) * px, off + (z + 1) * px); g.stroke(); }
    }
    this.radarMap = { canvas: c, S, off, map };
  }

  drawRadar() {
    const g = this.radarCtx, game = this.game;
    if (!this.radarMap) return;
    const W = 230, scale = 2.2;
    const { canvas, S, off, map } = this.radarMap;
    const view = game.viewState();
    const toCanvas = (x, z) => [off + (x + map.half.x) * S, off + (z + map.half.z) * S];
    g.save();
    g.clearRect(0, 0, W, W);
    g.translate(W / 2, W / 2);
    g.rotate(view.yaw);
    g.scale(scale / S, scale / S);
    const [cx, cz] = toCanvas(view.x, view.z);
    g.translate(-cx, -cz);
    g.drawImage(canvas, 0, 0);
    g.restore();
    const toRadar = (x, z) => {
      const dx = (x - view.x) * scale, dz = (z - view.z) * scale;
      const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
      return [W / 2 + dx * c - dz * s, W / 2 + dx * s + dz * c];
    };
    // letras de sitios siempre derechas
    g.font = 'bold 20px "Barlow Semi Condensed", Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,110,90,.8)';
    for (const k in map.sites) { const [x, y] = toRadar(map.sites[k].cx, map.sites[k].cz); g.fillText(k, x, y); }
    const myTeam = game.team;
    const bomb = game.bomb;
    if (bomb && (myTeam === 'T' || bomb.s === 'planted') && (bomb.s === 'dropped' || bomb.s === 'planted')) {
      const [bx, by] = toRadar(bomb.x, bomb.z);
      g.fillStyle = bomb.s === 'planted' && (performance.now() % 600 < 300) ? '#ff3b30' : '#ff9f0a';
      g.fillRect(bx - 5, by - 3, 10, 6);
    }
    for (const r of game.remotes.values()) {
      if (!r.visible || r.id === game.myId) continue;
      const ally = r.team === myTeam || myTeam === 'SPEC';
      if (!ally && !(r.spotted && r.alive)) continue;
      const [px, py] = toRadar(r.x, r.z);
      if (px < -5 || py < -5 || px > W + 5 || py > W + 5) continue;
      if (!r.alive) {
        g.strokeStyle = ally ? '#9cc' : '#c99';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(px - 4, py - 4); g.lineTo(px + 4, py + 4); g.moveTo(px + 4, py - 4); g.lineTo(px - 4, py + 4); g.stroke();
        continue;
      }
      g.fillStyle = ally ? (r.team === 'CT' ? '#6fa8e6' : '#e8b03f') : '#ff3b30';
      g.beginPath(); g.arc(px, py, 4.5, 0, 7); g.fill();
      if (r.hasBomb && myTeam === 'T') { g.strokeStyle = '#ff9f0a'; g.lineWidth = 2; g.stroke(); }
      if (ally) {
        const a = r.yaw - view.yaw;
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.sin(a) * 9, py - Math.cos(a) * 9); g.stroke();
      }
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(W / 2, W / 2 - 7); g.lineTo(W / 2 + 5, W / 2 + 5); g.lineTo(W / 2, W / 2 + 2); g.lineTo(W / 2 - 5, W / 2 + 5); g.closePath(); g.fill();
    const site = siteAt(map, view.x, view.z);
    this.set('radarloc', site ? `Sitio ${site}` : map.title);
  }

  // ---------- compra ----------
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
        b.innerHTML = `<img src="${icon(id)}" alt=""><span>${esc(info.name)}</span><span class="pr">$${info.price}</span>`;
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
    this.el.buytimeleft.textContent = g.phase === 'warmup' || g.phase === 'mapvote' ? 'Calentamiento' : `Tiempo de compra: ${Math.ceil(me.bt)} s`;
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
  historyStrip(hist) {
    let html = '';
    hist.forEach((h, i) => {
      if (i === 12 || (i > 24 && (i - 24) % 3 === 0)) html += '<span class="half"></span>';
      html += `<span class="rh ${h.w}" title="Ronda ${i + 1}"><img src="${icon(REASON_ICON[h.r] || 'elim', h.w === 'CT' ? '#9cc4f0' : '#f0c870')}"></span>`;
    });
    return html;
  }

  renderScoreboard() {
    const g = this.game;
    const roster = g.roster || [];
    const row = p => `<tr class="${p.al || g.phase === 'warmup' ? '' : 'dead'} ${p.id === g.myId ? 'me' : ''}">
      <td class="avc"><div class="av ${p.al ? '' : 'dead'}" style="background-image:url(${this.avatar(p.id)})"></div></td>
      <td>${esc(p.n)}${p.b ? '' : ratingBadge(p.rt)}${p.bm ? `<img class="ic" src="${icon('c4', '#e74c3c')}">` : ''}${p.kit ? `<img class="ic" src="${icon('defuser', '#6fa8e6')}">` : ''}</td>
      <td>${p.m >= 0 ? '$' + p.m : ''}</td><td>${p.k}</td><td>${p.a}</td><td>${p.d}</td><td>${p.mvp ? '★' + p.mvp : ''}</td><td>${p.hs}%</td><td>${p.adr}</td><td>${p.sc}</td><td>${p.b ? 'BOT' : p.pg}</td></tr>`;
    const head = '<tr><th></th><th>JUGADOR</th><th>DINERO</th><th>K</th><th>A</th><th>D</th><th>MVP</th><th>HS%</th><th>ADR</th><th>PUNTOS</th><th>PING</th></tr>';
    for (const team of ['CT', 'T']) {
      const list = roster.filter(p => p.tm === team).sort((a, b) => b.sc - a.sc || b.k - a.k);
      this.el['sb' + team].innerHTML = head + list.map(row).join('');
    }
    const spec = roster.filter(p => p.tm === 'SPEC');
    this.el.sbSpec.textContent = spec.length ? 'Espectadores: ' + spec.map(p => p.n).join(', ') : '';
    this.el.sbscoreCT.textContent = g.score.CT;
    this.el.sbscoreT.textContent = g.score.T;
    this.el.sbmap.textContent = `${g.map?.title || ''} · Premier`.toUpperCase();
    this.el.sbround.textContent = g.roundNum ? `Ronda ${g.roundNum} · Primero a ${g.target || 13}` : 'Calentamiento';
    this.el.sbroom.textContent = g.isPrivate ? `Sala privada ${g.roomName}` : `Sala ${g.roomName}`;
    this.el.sbhist.innerHTML = this.historyStrip(g.history || []);
  }

  // ---------- veto ----------
  renderVote(v) {
    const g = this.game;
    const el = this.el;
    if (!v) { el.mapvote.classList.add('hidden'); return; }
    el.mapvote.classList.remove('hidden');
    const myTurn = !v.result && v.turn === g.team;
    el.voteturn.className = v.result ? '' : v.turn;
    el.voteturn.textContent = v.result ? `SE JUEGA: ${getMap(v.result).title.toUpperCase()}` : `Veta: ${v.turn === 'CT' ? 'ANTITERRORISTAS' : 'TERRORISTAS'}${myTurn ? ' (TU EQUIPO)' : ''}`;
    el.votehint.textContent = myTurn ? 'Haz clic en el mapa que quieres vetar. Gana el más votado por tu equipo.' : v.result ? 'Cargando el mapa…' : 'El otro equipo está vetando…';
    el.votemaps.innerHTML = '';
    for (const id of v.pool) {
      const map = getMap(id);
      const card = document.createElement('button');
      card.className = 'mapcard';
      const banned = v.banned[id];
      if (banned) { card.classList.add('banned'); card.dataset.ban = `VETADO (${banned})`; }
      if (v.result === id) card.classList.add('picked');
      if (!myTurn) card.classList.add('locked');
      if (g.myVote === id && myTurn) card.classList.add('myvote');
      card.innerHTML = `<img src="${mapPreview(map)}" alt=""><div class="mn">${map.title.toUpperCase()}</div><div class="md">${esc(map.desc)}</div>${v.counts[id] ? `<div class="cnt">✕ ${v.counts[id]}</div>` : ''}`;
      if (myTurn && !banned) card.addEventListener('click', () => { g.myVote = id; g.send({ t: 'vote', map: id }); this.renderVote(v); });
      el.votemaps.appendChild(card);
    }
    this.voteEnd = v.turnEnd;
  }

  // ---------- fin de partida ----------
  renderMatchEnd(m) {
    const g = this.game;
    const el = this.el;
    const mine = m.results.find(r => r.id === g.myId);
    const won = mine ? mine.won : false;
    el.meTitle.textContent = mine ? (won ? 'VICTORIA' : 'DERROTA') : `GANAN LOS ${m.winner === 'CT' ? 'ANTITERRORISTAS' : 'TERRORISTAS'}`;
    el.meTitle.className = mine ? (won ? 'win' : 'loss') : '';
    el.meScore.innerHTML = `<span class="cCT">${m.score.CT}</span> : <span class="cT">${m.score.T}</span> · ${esc(getMap(m.map).title)}`;
    el.meRating.innerHTML = mine ? `Rating Premier: ${ratingBadge(mine.rt)} <span style="color:${mine.delta >= 0 ? '#6cc04a' : '#e4453a'}">${mine.delta >= 0 ? '+' : ''}${mine.delta}</span>` : '';
    const mvp = m.results.find(r => r.id === m.mvp);
    const table = team => {
      const rows = m.results.filter(r => r.tm === team).sort((a, b) => b.sc - a.sc).map(r => `<tr class="${r.id === g.myId ? 'me' : ''}"><td class="avc"><div class="av" style="background-image:url(${this.avatar(r.id)})"></div></td><td>${esc(r.n)}${r.id === m.mvp ? ' ★' : ''}</td><td>${r.k}</td><td>${r.a}</td><td>${r.d}</td><td>${r.adr}</td><td>${r.hs}%</td><td>${r.mvps}</td><td>${r.sc}</td></tr>`).join('');
      return `<div class="sbteam ${team.toLowerCase()}"><div class="sbtitle"><b>${m.score[team]}</b><span>${team === 'CT' ? 'ANTITERRORISTAS' : 'TERRORISTAS'}</span></div><table><tr><th></th><th>JUGADOR</th><th>K</th><th>A</th><th>D</th><th>ADR</th><th>HS%</th><th>MVP</th><th>PUNTOS</th></tr>${rows}</table></div>`;
    };
    el.meTable.innerHTML = `${mvp ? `<div style="text-align:center;margin-bottom:10px">MVP de la partida: <b>${esc(mvp.n)}</b></div>` : ''}<div id="sbhist" style="display:flex;gap:2px;margin-bottom:10px;flex-wrap:wrap">${this.historyStrip(m.rounds || [])}</div>${table('CT')}${table('T')}`;
    el.matchend.classList.remove('hidden');
  }

  // ---------- por frame ----------
  update(dt) {
    const g = this.game, me = g.priv;
    this.tickOverlays(dt);
    // el radar y los avatares no necesitan refrescarse a 144 Hz
    this.slowT = (this.slowT || 0) + dt;
    const slow = this.slowT > 0.1;
    if (slow) this.slowT = 0;
    this.radarT = (this.radarT || 0) + dt;
    if (this.radarT > 1 / 30) { this.radarT = 0; this.drawRadar(); }
    if (g.settings.showFps) this.set('netinfo', `${g.fps | 0} FPS · ${g.rtt | 0} ms`); else this.set('netinfo', '');

    this.set('scoreCT', String(g.score.CT));
    this.set('scoreT', String(g.score.T));
    const t = Math.max(0, g.timeLeft());
    const ts = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const planted = g.phase === 'live' && g.bomb?.s === 'planted';
    this.set('timer', planted ? '💣' : ts);
    this.el.timer.classList.toggle('bomb', planted);
    const phaseName = { warmup: 'Calentamiento', mapvote: 'Veto de mapas', freeze: 'Tiempo de compra', live: `Ronda ${g.roundNum}`, post: 'Fin de ronda', halftime: 'Descanso', matchend: 'Fin de la partida' }[g.phase] || '';
    this.set('roundinfo', phaseName);
    if (g.phase === 'mapvote' && this.voteEnd) {
      this.set('votetimer', String(Math.max(0, Math.ceil((this.voteEnd - g.serverNow()) / 1000))));
    }

    // avatares superiores (vivo en color, muerto en gris)
    for (const team of slow ? ['CT', 'T'] : []) {
      const list = (g.roster || []).filter(p => p.tm === team).sort((a, b) => a.id - b.id);
      const html = list.map(p => {
        const r = g.remotes.get(p.id);
        const alive = p.id === g.myId ? g.alive : r && r.visible ? r.alive : !!p.al;
        const hp = p.id === g.myId ? (g.priv?.hp ?? 0) : r?.hp ?? 0;
        const showHp = alive && (team === g.team || g.team === 'SPEC');
        return `<div class="av ${alive ? '' : 'dead'}" title="${esc(p.n)}" style="background-image:url(${this.avatar(p.id)})">${showHp ? `<i class="hpb" style="width:${Math.max(0, hp)}%"></i>` : ''}${p.bm && alive ? '<i class="bm"></i>' : ''}</div>`;
      }).join('');
      this.html(team === 'CT' ? 'ctAvatars' : 'tAvatars', html);
    }

    if (!me) return;
    if (this.lastMoney !== null && me.mo !== this.lastMoney && Math.abs(me.mo - this.lastMoney) < 9000) {
      const d = me.mo - this.lastMoney;
      const md = this.el.moneydelta;
      md.textContent = (d > 0 ? '+$' : '-$') + Math.abs(d);
      md.style.color = d > 0 ? '#8fd66b' : '#ff8a80';
      md.classList.add('show');
      this.later('money', 50, () => md.classList.remove('show'));
    }
    this.lastMoney = me.mo;
    this.set('money', String(me.mo));
    const canBuy = !!me.cb && me.al;
    this.el.buyhint.classList.toggle('hidden', !canBuy);
    if (canBuy) this.set('buytime', g.phase === 'warmup' || g.phase === 'mapvote' ? '' : `${Math.ceil(me.bt)} s`);
    if (!this.el.buymenu.classList.contains('hidden')) this.refreshBuyMenu();

    const spectating = !g.alive;
    const view = spectating ? g.spectateTarget() : null;
    const hp = spectating ? (view ? view.hp : 0) : me.hp;
    this.set('hp', String(Math.max(0, hp)));
    this.el.hpbar.style.width = Math.max(0, Math.min(100, hp)) + '%';
    this.el.hp.parentElement.classList.toggle('low', hp <= 25);
    this.set('armor', spectating ? '-' : String(me.ar));
    this.el.helmet.classList.toggle('hidden', spectating || !me.hm);
    this.el.kit.classList.toggle('hidden', spectating || !me.df);

    const cur = g.currentItem();
    if (!spectating && cur) {
      const w = WEAPONS[cur.id];
      if (w && w.mag) {
        const mag = g.localMag(cur);
        this.set('mag', String(mag));
        this.set('res', String(cur.res));
        this.el.mag.classList.toggle('low', mag <= Math.ceil(w.mag * 0.2));
      } else if (cur.count !== undefined) {
        this.set('mag', String(cur.count)); this.set('res', '-');
        this.el.mag.classList.remove('low');
      } else { this.set('mag', '—'); this.set('res', '-'); this.el.mag.classList.remove('low'); }
    } else { this.set('mag', '-'); this.set('res', '-'); }
    const slotsHtml = spectating ? '' : g.slotList().map(s => `<div class="sl ${s.slot === g.slot ? 'on' : ''}"><span>${esc(s.label)}</span><img src="${icon(s.icon)}"><b>${s.slot}</b></div>`).join('');
    this.html('slots', slotsHtml);

    const b = g.bomb;
    let bs = '';
    if (b?.s === 'planted') bs = `Bomba plantada en ${b.site}` + (b.dp >= 0 ? ` · desactivando ${Math.round(b.dp * 100)}%` : '');
    else if (b?.s === 'dropped' && g.team === 'T') bs = 'La bomba está en el suelo';
    this.el.bombstatus.classList.toggle('hidden', !bs);
    if (bs) this.set('bombstatus', bs);

    const act = me.act;
    this.el.progress.classList.toggle('hidden', !act);
    if (act) {
      this.set('progresslabel', act === 'plant' ? 'Plantando la bomba…' : me.df ? 'Desactivando (con kit)…' : 'Desactivando…');
      this.el.progressbar.style.width = (me.pr * 100).toFixed(1) + '%';
    }

    this.el.spectate.classList.toggle('hidden', !spectating || g.phase === 'mapvote');
    if (spectating) {
      const htmlS = view ? `<div class="av" style="background-image:url(${this.avatar(view.id)})"></div><div>Observando a <b class="c${view.team}">${esc(view.name)}</b><small>Clic para cambiar · ${g.phase === 'warmup' ? 'Reapareces en breve' : 'Esperando a la siguiente ronda'}</small></div>`
        : `<div><small>${g.team === 'SPEC' ? 'Modo espectador · [M] elegir equipo' : 'Esperando a la siguiente ronda'}</small></div>`;
      this.html('spectate', htmlS);
    }
  }
}

function hexA(hex, a = 1) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Ajustes ----------
const GAME_SETTINGS = [
  ['sens', 'Sensibilidad', 'range', 0.2, 6, 0.05],
  ['fov', 'Campo de visión', 'range', 70, 110, 1],
  ['vmfov', 'FOV del arma', 'range', 54, 75, 1],
  ['volume', 'Volumen', 'range', 0, 1, 0.01],
  ['quality', 'Calidad (requiere recargar)', 'select', ['baja', 'media', 'alta']],
  ['renderScale', 'Escala de resolución', 'range', 0.5, 1, 0.05],
  ['showFps', 'Mostrar FPS y ping', 'check'],
  ['bob', 'Balanceo del arma', 'check'],
];
const XH_SETTINGS = [
  ['xhDynamic', 'Mira dinámica (se abre al moverte/disparar)', 'check'],
  ['xhSize', 'Longitud', 'range', 1, 16, 1],
  ['xhThick', 'Grosor', 'range', 1, 6, 0.5],
  ['xhGap', 'Separación', 'range', -2, 12, 1],
  ['xhDot', 'Punto central', 'check'],
  ['xhOutline', 'Contorno', 'check'],
  ['xhAlpha', 'Opacidad', 'range', 0.2, 1, 0.05],
  ['xhColor', 'Color', 'color'],
];

export function renderSettings(container, settings, onChange, which = 'all') {
  const rows = which === 'game' ? GAME_SETTINGS : which === 'xh' ? XH_SETTINGS : [...GAME_SETTINGS, ...XH_SETTINGS];
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
      input.type = type === 'check' ? 'checkbox' : type;
      if (type === 'range') { input.min = a; input.max = b; input.step = step; }
      if (type === 'check') input.checked = !!settings[key]; else input.value = settings[key];
    }
    row.innerHTML = `<span>${label}</span>`;
    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:6px';
    right.appendChild(input);
    if (type === 'range') { val = document.createElement('span'); val.className = 'val'; val.textContent = settings[key]; right.appendChild(val); }
    row.appendChild(right);
    input.addEventListener('input', () => {
      settings[key] = type === 'range' ? parseFloat(input.value) : type === 'check' ? input.checked : input.value;
      if (val) val.textContent = settings[key];
      onChange(key);
    });
    container.appendChild(row);
  }
}

export function drawCrosshairPreview(canvas, s, spread = 0) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const gap = s.xhGap + (s.xhDynamic ? spread * 900 : 0), len = s.xhSize, th = s.xhThick;
  const rects = [[cx - th / 2, cy - gap - len, th, len], [cx - th / 2, cy + gap, th, len], [cx - gap - len, cy - th / 2, len, th], [cx + gap, cy - th / 2, len, th]];
  if (s.xhDot) rects.push([cx - th / 2, cy - th / 2, th, th]);
  if (s.xhOutline) { g.fillStyle = 'rgba(0,0,0,.85)'; for (const [x, y, w, h] of rects) g.fillRect(x - 1, y - 1, w + 2, h + 2); }
  g.fillStyle = hexA(s.xhColor, s.xhAlpha);
  for (const r of rects) g.fillRect(...r);
}
