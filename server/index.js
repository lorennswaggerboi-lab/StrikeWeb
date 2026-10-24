// Servidor HTTP + WebSocket. Sirve también el cliente estático (opcional: el cliente
// puede alojarse en GitHub Pages y conectarse a este servidor desplegado en Render).
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Room, sanitizeName } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const CONFIG = {
  adminEmail: process.env.ADMIN_EMAIL || 'elalfredonico@gmail.com',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  botsPerTeam: Math.max(0, Math.min(5, parseInt(process.env.BOTS_PER_TEAM ?? '4', 10) || 0)),
  botSkill: Math.max(0, Math.min(1, parseFloat(process.env.BOT_SKILL ?? '0.5') || 0.5)),
  maxRooms: parseInt(process.env.MAX_ROOMS ?? '20', 10),
  maxHumans: parseInt(process.env.MAX_PLAYERS_PER_ROOM ?? '10', 10),
};

const rooms = new Map();
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.get('/health', (req, res) => res.send('ok'));
app.get('/api/info', (req, res) => res.json({ name: 'STRIKE WEB', adminEmail: CONFIG.adminEmail, rooms: rooms.size }));
app.get('/api/rooms', (req, res) => res.json([...rooms.values()].map(r => r.info())));
for (const dir of ['js', 'shared']) app.use('/' + dir, express.static(path.join(ROOT, dir)));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(ROOT, 'style.css')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let player = null, room = null;
  let count = 0, windowStart = Date.now();

  ws.on('message', data => {
    const t = Date.now();
    if (t - windowStart > 1000) { windowStart = t; count = 0; }
    if (++count > 150) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (!player) {
      if (msg.t !== 'join') return;
      const name = sanitizeName(msg.room, 'publico').toLowerCase();
      room = rooms.get(name);
      if (!room) {
        if (rooms.size >= CONFIG.maxRooms) { ws.send(JSON.stringify({ t: 'error', msg: 'Demasiadas salas abiertas' })); return; }
        room = new Room(name, CONFIG);
        rooms.set(name, room);
        console.log(`[sala] creada "${name}"`);
      }
      if (room.humanCount() >= CONFIG.maxHumans) { ws.send(JSON.stringify({ t: 'error', msg: 'La sala está llena' })); return; }
      player = room.addHuman(ws, msg.name, msg.team);
      console.log(`[sala ${name}] entra ${player.name}`);
      return;
    }
    try { room.onMessage(player, msg); } catch (e) { console.error('Error procesando mensaje', e); }
  });

  ws.on('close', () => {
    if (!player) return;
    room.removePlayer(player);
    if (room.humanCount() === 0) {
      rooms.delete(room.name);
      console.log(`[sala] cerrada "${room.name}"`);
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 20000);

const TICK = 1 / 40;
let last = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  for (const room of rooms.values()) {
    try { room.tick(dt); } catch (e) { console.error('Error en tick', e); }
  }
}, TICK * 1000);

server.listen(PORT, () => console.log(`STRIKE WEB escuchando en http://localhost:${PORT} (admin: ${CONFIG.adminEmail})`));
