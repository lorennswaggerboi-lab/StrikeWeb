// Aplicación: login/registro, conexión con el servidor, lobby con grupo, perfil, ajustes y entrada a partidas.
import { Game } from './game.js';
import { renderSettings, drawCrosshairPreview, ratingBadge, esc } from './hud.js';
import { defaultAvatar, mapPreview } from './icons.js';
import { getMap, MAP_IDS } from '../shared/maps.js';
import { resolveServer, normalizeServer, httpBase, loadSettings, saveSettings, DEFAULT_SERVER } from './config.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
const params = new URLSearchParams(location.search);
let game = null;
try {
  game = new Game($('c'), settings);
  window.strikeGame = game; // útil para depurar desde la consola
} catch (e) {
  console.error(e);
  $('aErr').textContent = 'Tu navegador no soporta WebGL: ' + e.message;
}

const state = { server: resolveServer(), token: null, user: null, ws: null, party: null, authMode: 'login', pendingLobby: params.get('lobby'), wantClose: false, retries: 0 };

function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
function read(k) { try { return localStorage.getItem(k); } catch { return null; } }

function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

function setLoading(text) {
  $('loading').classList.toggle('hidden', !text);
  if (text) $('loadingtext').textContent = text;
}

function showScreen(name) {
  $('auth').classList.toggle('hidden', name !== 'auth');
  $('lobby').classList.toggle('hidden', name !== 'lobby');
}

const avatarOf = (name, av) => av || defaultAvatar(name);

// ======================= LOGIN / REGISTRO =======================
$('server').value = state.server;
$('aUser').value = read('sw_user') || '';
for (const b of document.querySelectorAll('[data-auth]')) {
  b.addEventListener('click', () => {
    state.authMode = b.dataset.auth;
    document.querySelectorAll('[data-auth]').forEach(x => x.classList.toggle('sel', x === b));
    $('aPass2Row').classList.toggle('hidden', state.authMode !== 'register');
    $('aPass').autocomplete = state.authMode === 'register' ? 'new-password' : 'current-password';
    $('aSubmit').textContent = state.authMode === 'register' ? 'CREAR CUENTA' : 'ENTRAR';
    $('aErr').textContent = '';
  });
}

$('server').addEventListener('change', () => {
  const v = $('server').value.trim();
  try {
    state.server = v ? normalizeServer(v) : resolveServer();
    $('server').value = state.server;
    store('sw_server', v ? state.server : null);
    checkServer();
  } catch { $('srvstatus').textContent = 'URL no válida'; }
});

async function checkServer() {
  $('srvstatus').textContent = 'Comprobando ' + httpBase(state.server) + '…';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const info = await (await fetch(httpBase(state.server) + '/api/info', { signal: ctrl.signal })).json();
    clearTimeout(timer);
    $('srvstatus').textContent = `✔ En línea · ${info.online} conectados · ${info.rooms} partidas`;
    $('onlineInfo').textContent = `${info.online} jugadores en línea · ${info.rooms} partidas en curso`;
  } catch {
    $('srvstatus').textContent = 'El servidor no responde (Render gratis tarda ~1 min en despertar).';
  }
}

async function api(path, body, token) {
  const slow = setTimeout(() => setLoading('Despertando el servidor… (Render gratis puede tardar ~1 min)'), 2500);
  try {
    const res = await fetch(httpBase(state.server) + path, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  } catch (e) {
    if (e instanceof TypeError) throw new Error('No se pudo conectar con el servidor');
    throw e;
  } finally {
    clearTimeout(slow);
  }
}

$('authform').addEventListener('submit', async e => {
  e.preventDefault();
  game?.sound.init();
  const username = $('aUser').value.trim();
  const password = $('aPass').value;
  $('aErr').textContent = '';
  if (state.authMode === 'register' && password !== $('aPass2').value) { $('aErr').textContent = 'Las contraseñas no coinciden'; return; }
  setLoading(state.authMode === 'register' ? 'Creando cuenta…' : 'Iniciando sesión…');
  try {
    const data = state.authMode === 'register'
      ? await api('/api/register', { username, password, password2: $('aPass2').value })
      : await api('/api/login', { username, password });
    store('sw_user', data.user.name);
    state.token = data.token;
    state.user = data.user;
    $('aPass').value = $('aPass2').value = '';
    connect();
  } catch (err) {
    setLoading('');
    $('aErr').textContent = err.message;
  }
});

// ======================= CONEXIÓN =======================
function send(obj) {
  if (state.ws && state.ws.readyState === 1) state.ws.send(JSON.stringify(obj));
}
game?.attach(send);

function connect() {
  setLoading('Conectando…');
  state.wantClose = false;
  let ws;
  try { ws = new WebSocket(state.server); } catch { setLoading(''); $('aErr').textContent = 'URL de servidor inválida'; return; }
  state.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: state.token }));
  ws.onmessage = e => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    onMessage(m);
  };
  ws.onclose = () => {
    if (state.ws !== ws || state.wantClose) return;
    game?.endMatch();
    closeOverlays();
    if (state.token && state.retries < 3) {
      state.retries++;
      setLoading('Conexión perdida. Reconectando…');
      setTimeout(connect, 1500 * state.retries);
    } else {
      setLoading('');
      showScreen('auth');
      $('aErr').textContent = 'Se perdió la conexión con el servidor';
    }
  };
}

function logout() {
  state.wantClose = true;
  state.token = null;
  state.ws?.close();
  game?.endMatch();
  closeOverlays();
  showScreen('auth');
}
$('logout').addEventListener('click', logout);

function onMessage(m) {
  switch (m.t) {
    case 'authok':
      state.retries = 0;
      state.user = m.user;
      setLoading('');
      showScreen('lobby');
      renderProfile();
      checkServer();
      if (state.pendingLobby) { send({ t: 'party_join', code: state.pendingLobby }); state.pendingLobby = null; }
      return;
    case 'autherr':
      setLoading('');
      state.wantClose = true;
      state.ws.close();
      state.token = null;
      showScreen('auth');
      $('aErr').textContent = m.msg;
      return;
    case 'lobby':
      state.user = m.user;
      renderProfile();
      $('reconnectBar').classList.toggle('hidden', !m.reconnect);
      return;
    case 'party': state.party = m; renderParty(); return;
    case 'pchat': partyChat(m.name, m.msg); return;
    case 'perror': toast(m.msg); setLoading(''); return;
    case 'matchfound':
      game?.sound.matchFound();
      setLoading(m.private ? 'Creando la sala privada…' : '¡Partida encontrada! Entrando…');
      return;
    case 'welcome':
      setLoading('');
      showScreen('none');
      closeOverlays();
      game.onWelcome(m);
      game.hud.center('Haz clic para jugar', '', 2500);
      updateHostPanel();
      return;
    case 'left':
      game.endMatch();
      closeOverlays();
      showScreen('lobby');
      if (m.reason === 'expulsado') toast('Has sido expulsado de la partida');
      return;
    case 'kicked':
      if (m.reason) { state.wantClose = true; state.token = null; game?.endMatch(); closeOverlays(); showScreen('auth'); $('aErr').textContent = m.reason; }
      return;
  }
  if (game?.inMatch) {
    game.handle(m);
    if (m.t === 'roster' || m.t === 'owner') updateHostPanel();
  }
}

// ======================= LOBBY =======================
for (const b of document.querySelectorAll('.nav')) {
  b.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.toggle('sel', x === b));
    for (const id of ['play', 'profile', 'settings']) $('tab-' + id).classList.toggle('hidden', id !== b.dataset.tab);
    if (b.dataset.tab === 'settings') drawCrosshairPreview($('xhPreview'), settings);
  });
}

$('mappool').innerHTML = MAP_IDS.map(id => { const m = getMap(id); return `<div class="mp"><img src="${mapPreview(m)}" alt=""><div>${m.title.toUpperCase()}</div></div>`; }).join('');

const isLeader = () => state.party && state.user && state.party.leader === state.user.name;

function renderParty() {
  const p = state.party;
  if (!p) return;
  const leader = isLeader();
  $('partyCode').textContent = p.code;
  $('partyCount').textContent = `(${p.members.length}/5)`;
  $('partyMembers').innerHTML = p.members.map(m => `
    <div class="pm"><div class="av" style="background-image:url(${avatarOf(m.name, m.avatar)})"></div>
      <div class="nm">${esc(m.name)}${m.name === p.leader ? '<span class="crown" title="Líder">♛</span>' : ''}<div class="st">${m.inMatch ? 'En partida' : 'En el lobby'}</div></div>
      ${ratingBadge(m.rating)}
      ${leader && m.name !== state.user.name ? `<button class="kick" data-kick="${esc(m.name)}" title="Expulsar">✕</button>` : ''}
    </div>`).join('');
  for (const b of document.querySelectorAll('[data-kick]')) b.addEventListener('click', () => send({ t: 'party_kick', name: b.dataset.kick }));
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const m = p.members[i];
    slots.push(m ? `<div class="pav ${m.name === p.leader ? 'leader' : ''}" title="${esc(m.name)}" style="background-image:url(${avatarOf(m.name, m.avatar)})"></div>` : '<div class="pav empty" data-invite title="Invitar">+</div>');
  }
  $('partybar').innerHTML = slots.join('');
  for (const b of document.querySelectorAll('[data-invite]')) b.addEventListener('click', copyInvite);
  document.querySelectorAll('.mode').forEach(b => { b.classList.toggle('sel', b.dataset.mode === p.mode); b.disabled = !leader; });
  $('privateOpts').classList.toggle('hidden', p.mode !== 'private');
  $('pBots').value = p.bots; $('pBotsV').textContent = p.bots;
  $('pSkill').value = p.skill; $('pSkillV').textContent = Math.round(p.skill * 100) + '%';
  $('pBots').disabled = $('pSkill').disabled = !leader;
  const busy = p.members.some(m => m.inMatch);
  $('playBtn').disabled = !leader || busy;
  $('playBtn').textContent = p.mode === 'private' ? 'CREAR PARTIDA' : 'BUSCAR PARTIDA';
  $('playstatus').textContent = !leader ? `Esperando a que ${p.leader} inicie la partida…` : busy ? 'Algún miembro sigue en una partida' : `${p.members.length} jugador${p.members.length > 1 ? 'es' : ''} en el grupo`;
}

function inviteLink() {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('lobby', state.party.code);
  const def = new URL(location.href).hostname.endsWith('.onrender.com') || location.hostname === 'localhost' ? null : DEFAULT_SERVER;
  if (def && state.server !== def) url.searchParams.set('server', httpBase(state.server).replace(/^https?:\/\//, ''));
  return url.toString();
}

async function copyInvite() {
  if (!state.party) return;
  const link = inviteLink();
  try { await navigator.clipboard.writeText(link); toast('Enlace de invitación copiado. ¡Envíaselo a tus amigos!'); }
  catch { prompt('Copia este enlace de invitación:', link); }
}
$('copyLink').addEventListener('click', copyInvite);
$('joinBtn').addEventListener('click', () => { const c = $('joinCode').value.trim(); if (c) send({ t: 'party_join', code: c }); $('joinCode').value = ''; });
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
$('leaveParty').addEventListener('click', () => send({ t: 'party_leave' }));
for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => { if (isLeader()) send({ t: 'party_mode', mode: b.dataset.mode }); });
$('pBots').addEventListener('change', () => send({ t: 'party_mode', bots: +$('pBots').value }));
$('pSkill').addEventListener('change', () => send({ t: 'party_mode', skill: +$('pSkill').value }));
$('pBots').addEventListener('input', () => { $('pBotsV').textContent = $('pBots').value; });
$('pSkill').addEventListener('input', () => { $('pSkillV').textContent = Math.round($('pSkill').value * 100) + '%'; });
$('playBtn').addEventListener('click', () => { game?.sound.init(); send({ t: 'queue' }); setLoading('Buscando partida…'); setTimeout(() => { if (!game?.inMatch) setLoading(''); }, 8000); });
$('reconnectBtn').addEventListener('click', () => { send({ t: 'reconnect' }); setLoading('Reconectando a la partida…'); });

function partyChat(name, msg) {
  const log = $('pchatlog');
  const d = document.createElement('div');
  if (!name) { d.className = 'sys'; d.textContent = msg; }
  else d.innerHTML = `<b>${esc(name)}:</b> ${esc(msg)}`;
  log.appendChild(d);
  while (log.children.length > 60) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
$('pchatin').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const msg = $('pchatin').value.trim();
  if (msg) send({ t: 'pchat', msg });
  $('pchatin').value = '';
});

// ======================= PERFIL =======================
function renderProfile() {
  const u = state.user;
  if (!u) return;
  const s = u.stats;
  $('pfAvatar').src = avatarOf(u.name, u.avatar);
  $('pfName').textContent = u.name;
  $('pfRating').innerHTML = `Rating Premier ${ratingBadge(s.rating)}`;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
  const hs = s.kills ? Math.round(s.hs / s.kills * 100) : 0;
  const adr = s.rounds ? Math.round(s.dmg / s.rounds) : 0;
  const wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0;
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  $('pfStats').innerHTML = stat(s.matches, 'Partidas') + stat(`${s.wins} (${wr}%)`, 'Victorias') + stat(s.kills, 'Bajas') + stat(kd, 'K/D')
    + stat(hs + '%', 'Tiros a la cabeza') + stat(adr, 'ADR') + stat(s.mvps, 'MVP') + stat(s.assists, 'Asistencias');
}

async function resizeImage(file) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('No se pudo leer la imagen'));
    i.src = URL.createObjectURL(file);
  });
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const s = Math.min(img.width, img.height);
  g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
  URL.revokeObjectURL(img.src);
  return c.toDataURL('image/jpeg', 0.82);
}

$('avatarFile').addEventListener('change', async () => {
  const f = $('avatarFile').files[0];
  $('avatarFile').value = '';
  if (!f) return;
  try {
    const av = await resizeImage(f);
    await api('/api/avatar', { avatar: av }, state.token);
    state.user.avatar = av;
    renderProfile();
    toast('Foto de perfil actualizada');
  } catch (e) { toast(e.message); }
});
$('avatarRemove').addEventListener('click', async () => {
  try {
    await api('/api/avatar', { avatar: null }, state.token);
    state.user.avatar = null;
    renderProfile();
  } catch (e) { toast(e.message); }
});

// ======================= AJUSTES =======================
const onSetting = key => {
  saveSettings(settings);
  game?.applySettings(key);
  drawCrosshairPreview($('xhPreview'), settings);
};
renderSettings($('settingsGame'), settings, onSetting, 'game');
renderSettings($('settingsXh'), settings, onSetting, 'xh');
drawCrosshairPreview($('xhPreview'), settings);
// vista previa animada de la mira dinámica
let prevT = 0;
setInterval(() => {
  if ($('tab-settings').classList.contains('hidden') || !settings.xhDynamic) return;
  prevT += 0.05;
  drawCrosshairPreview($('xhPreview'), settings, Math.max(0, Math.sin(prevT)) * 0.012);
}, 50);

// ======================= MENÚS EN PARTIDA =======================
function closeOverlays() {
  for (const id of ['pause', 'buymenu', 'teamselect', 'scoreboard', 'mapvote', 'matchend']) $(id).classList.add('hidden');
  if (game) Object.assign(game.ui, { pause: false, buy: false, team: false, sb: false });
}

if (game) {
  game.onPauseRequest = () => {
    game.ui.pause = true;
    renderSettings($('settingsPause'), settings, onSetting);
    updateHostPanel();
    $('pause').classList.remove('hidden');
  };
  game.onOwnerChange = updateHostPanel;
}

function updateHostPanel() {
  const host = game?.inMatch && game.isPrivate && state.user && game.owner === state.user.name;
  $('hostpanel').classList.toggle('hidden', !host);
  if (host) {
    $('hostBots').value = game.botsTarget ?? 5; $('hostBotsV').textContent = $('hostBots').value;
    if (!$('hostSkill').dataset.touched) { $('hostSkill').value = 0.5; }
    $('hostSkillV').textContent = Math.round($('hostSkill').value * 100) + '%';
  }
}
$('hostBots').addEventListener('input', () => { $('hostBotsV').textContent = $('hostBots').value; });
$('hostBots').addEventListener('change', () => send({ t: 'host', action: 'bots', n: +$('hostBots').value }));
$('hostSkill').addEventListener('input', () => { $('hostSkill').dataset.touched = 1; $('hostSkillV').textContent = Math.round($('hostSkill').value * 100) + '%'; });
$('hostSkill').addEventListener('change', () => send({ t: 'host', action: 'skill', s: +$('hostSkill').value }));
$('hostStart').addEventListener('click', () => send({ t: 'host', action: 'start' }));
$('hostRestart').addEventListener('click', () => send({ t: 'host', action: 'restart' }));

$('resume').addEventListener('click', () => {
  game.ui.pause = false;
  $('pause').classList.add('hidden');
  game.lock();
});
$('openTeams').addEventListener('click', () => {
  game.ui.pause = false;
  $('pause').classList.add('hidden');
  game.toggleTeam(true);
});
$('leave').addEventListener('click', () => {
  if (game.phase !== 'warmup' && game.phase !== 'mapvote' && !confirm('¿Seguro que quieres abandonar la partida? Podrás reconectarte desde el lobby.')) return;
  send({ t: 'leave_room' });
  closeOverlays();
});
for (const b of document.querySelectorAll('[data-team]')) b.addEventListener('click', () => game.chooseTeam(b.dataset.team));
for (const b of document.querySelectorAll('[data-close]')) {
  b.addEventListener('click', () => {
    if (b.dataset.close === 'buymenu') game.toggleBuy(false);
    if (b.dataset.close === 'teamselect') game.toggleTeam(false);
  });
}

if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
  $('aErr').textContent = 'STRIKE WEB se juega con teclado y ratón (PC).';
}

showScreen('auth');
checkServer();
setInterval(() => { if (!game?.inMatch) checkServer(); }, 30000);
