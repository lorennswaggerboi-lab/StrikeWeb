// Servidor HTTP (cuentas y API) + WebSocket (lobby y partidas).
// El cliente puede estar en GitHub Pages y conectarse a este servidor desplegado en Render.
import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createStore, hashPassword, checkPassword } from './store.js';
import { Hub, Session } from './lobby.js';
import { mapList } from '../shared/maps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const CONFIG = {
  adminEmail: process.env.ADMIN_EMAIL || 'elalfredonico@gmail.com',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  botsPerTeam: Math.max(0, Math.min(5, parseInt(process.env.BOTS_PER_TEAM ?? '5', 10) || 0)),
  botSkill: Math.max(0, Math.min(1, parseFloat(process.env.BOT_SKILL ?? '0.5') || 0.5)),
  maxRooms: parseInt(process.env.MAX_ROOMS ?? '20', 10),
};

const store = await createStore();
const hub = new Hub(CONFIG, store);
const tokens = new Map(); // token -> { name, exp }
hub.tokens = { get: t => { const v = tokens.get(t); return v && v.exp > Date.now() ? v : null; } };

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '80kb' }));

// límite simple de intentos por IP
const attempts = new Map();
function limited(ip) {
  const t = Date.now();
  const a = (attempts.get(ip) || []).filter(x => t - x < 60000);
  a.push(t);
  attempts.set(ip, a);
  return a.length > 12;
}

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
function issueToken(name) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { name, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  return token;
}
function authUser(req) {
  const h = req.headers.authorization || '';
  const v = tokens.get(h.replace(/^Bearer\s+/i, ''));
  return v && v.exp > Date.now() ? v.name : null;
}

app.get('/health', (req, res) => res.send('ok'));
app.get('/api/info', (req, res) => res.json({ name: 'STRIKE WEB', adminEmail: CONFIG.adminEmail, storage: store.kind, online: hub.sessions.size, rooms: hub.rooms.size }));
app.get('/api/maps', (req, res) => res.json(mapList()));
app.get('/api/rooms', (req, res) => res.json([...hub.rooms.values()].filter(r => !r.isPrivate).map(r => r.info())));

app.post('/api/register', async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Demasiados intentos, espera un minuto' });
  const { username, password, password2 } = req.body || {};
  if (typeof username !== 'string' || !NAME_RE.test(username)) return res.status(400).json({ error: 'El usuario debe tener 3-16 caracteres (letras, números o _)' });
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) return res.status(400).json({ error: 'La contraseña debe tener entre 4 y 64 caracteres' });
  if (password !== password2) return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  const { salt, hash } = hashPassword(password);
  if (!(await store.createUser({ name: username, salt, hash }))) return res.status(409).json({ error: 'Ese usuario ya está registrado' });
  const u = await store.getUser(username);
  console.log(`[cuenta] registrada ${username}`);
  res.json({ token: issueToken(u.name), user: hub.publicUser(u) });
});

app.post('/api/login', async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Demasiados intentos, espera un minuto' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Faltan datos' });
  const u = await store.getUser(username);
  if (!u || !checkPassword(password, u.salt, u.hash)) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  res.json({ token: issueToken(u.name), user: hub.publicUser(u) });
});

app.get('/api/me', async (req, res) => {
  const name = authUser(req);
  if (!name) return res.status(401).json({ error: 'No autenticado' });
  const u = await store.getUser(name);
  res.json(hub.publicUser(u));
});

app.post('/api/avatar', async (req, res) => {
  const name = authUser(req);
  if (!name) return res.status(401).json({ error: 'No autenticado' });
  const av = req.body?.avatar;
  if (av !== null && (typeof av !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(av) || av.length > 60000)) {
    return res.status(400).json({ error: 'Imagen no válida (máx. ~40 KB)' });
  }
  await store.updateUser(name, { avatar: av });
  const s = hub.sessions.get(name.toLowerCase());
  if (s) { s.user.avatar = av; if (s.party) hub.broadcastParty(s.party); }
  res.json({ ok: true });
});

for (const dir of ['js', 'shared']) app.use('/' + dir, express.static(path.join(ROOT, dir)));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(ROOT, 'style.css')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const session = new Session(ws, hub);
  let count = 0, windowStart = Date.now();
  ws.on('message', data => {
    const t = Date.now();
    if (t - windowStart > 1000) { windowStart = t; count = 0; }
    if (++count > 150) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    hub.handle(session, msg).catch(e => console.error('Error en mensaje', e));
  });
  ws.on('close', () => hub.disconnect(session));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const t = Date.now();
  for (const [k, v] of tokens) if (v.exp < t) tokens.delete(k);
}, 20000);

let last = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  for (const room of hub.rooms.values()) {
    try { room.tick(dt); } catch (e) { console.error('Error en tick', e); }
  }
}, 25);

server.listen(PORT, () => console.log(`STRIKE WEB en http://localhost:${PORT} · cuentas: ${store.kind} · admin: ${CONFIG.adminEmail}`));
