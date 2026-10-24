// URL del servidor multijugador. Tras desplegar en Render, cambia DEFAULT_SERVER
// por la URL de tu servicio (o usa ?server=https://tu-servicio.onrender.com en la página).
export const DEFAULT_SERVER = 'wss://strike-web.onrender.com/ws';

export function normalizeServer(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  if (!/^[a-z]+:\/\//i.test(s)) s = 'wss://' + s;
  s = s.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const u = new URL(s);
  if (u.pathname === '/' || u.pathname === '') u.pathname = '/ws';
  return u.toString().replace(/\/$/, '');
}

function sameOrigin() {
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

export function resolveServer() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) { try { return normalizeServer(q); } catch { /* ignorar */ } }
  try {
    const saved = localStorage.getItem('sw_server');
    if (saved) return saved;
  } catch { /* almacenamiento no disponible */ }
  // Si la página la sirve el propio servidor de juego (local o Render), usar el mismo origen.
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.onrender.com') || location.protocol === 'http:') return sameOrigin();
  return DEFAULT_SERVER;
}

export function httpBase(wsUrl) {
  return wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/ws$/, '');
}

const DEFAULT_SETTINGS = { sens: 1.6, fov: 90, volume: 0.6, xhColor: '#4dff6a', xhSize: 6, xhGap: 3, quality: 'alta' };

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('sw_settings') || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s) {
  try { localStorage.setItem('sw_settings', JSON.stringify(s)); } catch { /* ignorar */ }
}
