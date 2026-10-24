// Arranque: menú principal, ajustes, lista de salas y conexión.
import { Game } from './game.js';
import { renderSettings } from './hud.js';
import { resolveServer, normalizeServer, httpBase, loadSettings, saveSettings } from './config.js';

const $ = id => document.getElementById(id);
const settings = loadSettings();
let game;
try {
  game = new Game($('c'), settings);
  window.strikeGame = game; // útil para depurar desde la consola
} catch (e) {
  console.error(e);
  $('joinerr').textContent = 'Tu navegador no soporta WebGL: ' + e.message;
}

let server = resolveServer();
let teamPref = 'auto';

function store(key, value) { try { localStorage.setItem(key, value); } catch { /* ignorar */ } }
function read(key) { try { return localStorage.getItem(key); } catch { return null; } }

$('name').value = read('sw_name') || 'Jugador' + Math.floor(Math.random() * 900 + 100);
$('room').value = new URLSearchParams(location.search).get('sala') || read('sw_room') || 'publico';
$('server').value = server;

function showMenu(on, err = '') {
  $('menu').classList.toggle('hidden', !on);
  $('joinerr').textContent = err;
  if (on) refreshRooms();
}

function setLoading(text) {
  $('loading').classList.toggle('hidden', !text);
  if (text) $('loadingtext').textContent = text;
}

for (const b of document.querySelectorAll('.tp')) {
  b.addEventListener('click', () => {
    teamPref = b.dataset.t;
    document.querySelectorAll('.tp').forEach(x => x.classList.toggle('sel', x === b));
  });
}

$('server').addEventListener('change', () => {
  const v = $('server').value.trim();
  try {
    server = v ? normalizeServer(v) : resolveServer();
    $('server').value = server;
    store('sw_server', server);
    refreshRooms();
  } catch { $('srvstatus').textContent = 'URL no válida'; }
});

async function refreshRooms() {
  const box = $('rooms');
  const base = httpBase(server);
  $('srvstatus').textContent = 'Comprobando ' + base + '…';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(base + '/api/rooms', { signal: ctrl.signal });
    clearTimeout(timer);
    const rooms = await res.json();
    $('srvstatus').textContent = '✔ Servidor en línea';
    if (!rooms.length) { box.innerHTML = '<div class="small">No hay salas activas. ¡Crea una entrando con cualquier nombre de sala!</div>'; return; }
    box.innerHTML = '';
    for (const r of rooms) {
      const row = document.createElement('div');
      row.className = 'roomrow';
      const phase = { warmup: 'calentamiento', freeze: 'compra', live: 'en juego', post: 'fin de ronda' }[r.phase] || r.phase;
      row.innerHTML = `<span><b></b> · <span class="small">${phase} · CT ${r.score.CT} - ${r.score.T} T</span></span><span>${r.humans}/${r.maxHumans} 👤</span>`;
      row.querySelector('b').textContent = r.name;
      row.addEventListener('click', () => { $('room').value = r.name; });
      box.appendChild(row);
    }
  } catch {
    $('srvstatus').textContent = 'El servidor no responde (si está en Render gratis, se despierta al entrar).';
    box.innerHTML = '<div class="small">No se pudo obtener la lista de salas. Pulsa JUGAR para despertar el servidor.</div>';
  }
}
$('refresh').addEventListener('click', refreshRooms);

async function play() {
  if (!game) return;
  const name = $('name').value.trim() || 'Jugador';
  const room = $('room').value.trim() || 'publico';
  store('sw_name', name);
  store('sw_room', room);
  game.sound.init();
  setLoading('Conectando con ' + httpBase(server) + '…');
  try {
    await game.connect(server, name, room, teamPref === 'auto' ? null : teamPref, s => setLoading(s));
    setLoading('');
    showMenu(false);
    game.lock();
  } catch (e) {
    setLoading('');
    showMenu(true, e.message);
  }
}
$('play').addEventListener('click', play);
for (const id of ['name', 'room']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') play(); });

if (game) {
  game.onDisconnect = msg => {
    game.disconnect();
    closeOverlays();
    showMenu(true, msg);
  };
  game.onPauseRequest = () => {
    game.ui.pause = true;
    renderSettings($('settingsPause'), settings, onSetting);
    $('pause').classList.remove('hidden');
  };
}

function closeOverlays() {
  for (const id of ['pause', 'buymenu', 'teamselect', 'scoreboard']) $(id).classList.add('hidden');
  if (game) Object.assign(game.ui, { pause: false, buy: false, team: false, sb: false });
}

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
  game.disconnect();
  closeOverlays();
  showMenu(true);
});
for (const b of document.querySelectorAll('[data-team]')) b.addEventListener('click', () => game.chooseTeam(b.dataset.team));
for (const b of document.querySelectorAll('[data-close]')) {
  b.addEventListener('click', () => {
    if (b.dataset.close === 'buymenu') game.toggleBuy(false);
    if (b.dataset.close === 'teamselect') game.toggleTeam(false);
  });
}

const onSetting = key => { saveSettings(settings); game?.applySettings(key); };
renderSettings($('settingsMenu'), settings, onSetting);
renderSettings($('settingsPause'), settings, onSetting);

showMenu(true);
