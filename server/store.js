// Almacenamiento de cuentas. Usa Postgres si existe DATABASE_URL; si no, un archivo JSON
// (en Render gratis el disco es efímero: las cuentas se pierden al reiniciar sin base de datos).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_STATS = { kills: 0, deaths: 0, assists: 0, hs: 0, dmg: 0, rounds: 0, wins: 0, losses: 0, matches: 0, mvps: 0, rating: 1000 };

export const emptySocial = () => ({ friends: [], incoming: [], outgoing: [] });

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function checkPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(h, ref);
}

class JsonStore {
  constructor(file) {
    this.file = file;
    this.users = {};
    try { this.users = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* archivo nuevo */ }
    this.timer = null;
  }
  async init() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      fs.writeFile(this.file + '.tmp', JSON.stringify(this.users), err => {
        if (!err) fs.rename(this.file + '.tmp', this.file, () => {});
      });
    }, 500);
  }
  async getUser(name) {
    const u = this.users[name.toLowerCase()];
    if (u && !u.social) u.social = emptySocial();
    return u || null;
  }
  async createUser(u) {
    const key = u.name.toLowerCase();
    if (this.users[key]) return false;
    this.users[key] = { ...u, stats: { ...DEFAULT_STATS }, avatar: null, social: emptySocial(), created: Date.now() };
    this.save();
    return true;
  }
  async updateUser(name, fields) {
    const u = this.users[name.toLowerCase()];
    if (!u) return;
    Object.assign(u, fields);
    this.save();
  }
  get kind() { return 'archivo JSON (efímero en Render)'; }
}

class PgStore {
  constructor(url) { this.url = url; }
  async init() {
    const { default: pg } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(this.url) || !/\.[a-z]{2,}(:\d+)?\//i.test(this.url);
    this.pool = new pg.Pool({ connectionString: this.url, ssl: local ? false : { rejectUnauthorized: true }, max: 5 });
    await this.pool.query(`CREATE TABLE IF NOT EXISTS users (
      name_lower TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
      avatar TEXT, stats JSONB NOT NULL DEFAULT '{}', created BIGINT NOT NULL)`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS social JSONB NOT NULL DEFAULT '{}'`);
  }
  row(r) { return r ? { name: r.name, salt: r.salt, hash: r.hash, avatar: r.avatar, stats: { ...DEFAULT_STATS, ...r.stats }, social: { ...emptySocial(), ...r.social }, created: +r.created } : null; }
  async getUser(name) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE name_lower = $1', [name.toLowerCase()]);
    return this.row(rows[0]);
  }
  async createUser(u) {
    const res = await this.pool.query(
      'INSERT INTO users (name_lower, name, salt, hash, stats, created) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
      [u.name.toLowerCase(), u.name, u.salt, u.hash, DEFAULT_STATS, Date.now()]);
    return res.rowCount === 1;
  }
  async updateUser(name, fields) {
    if ('avatar' in fields) await this.pool.query('UPDATE users SET avatar = $2 WHERE name_lower = $1', [name.toLowerCase(), fields.avatar]);
    if ('stats' in fields) await this.pool.query('UPDATE users SET stats = $2 WHERE name_lower = $1', [name.toLowerCase(), fields.stats]);
    if ('social' in fields) await this.pool.query('UPDATE users SET social = $2 WHERE name_lower = $1', [name.toLowerCase(), fields.social]);
  }
  get kind() { return 'PostgreSQL'; }
}

export async function createStore() {
  const store = process.env.DATABASE_URL
    ? new PgStore(process.env.DATABASE_URL)
    : new JsonStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'accounts.json'));
  await store.init();
  return store;
}
