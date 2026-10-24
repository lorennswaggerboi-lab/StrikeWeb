// Sesiones, grupos (lobby estilo CS2) y emparejamiento hacia salas.
import crypto from 'crypto';
import { Room } from './room.js';
import { DEFAULT_STATS } from './store.js';

const PARTY_MAX = 5;
const code = (n = 6) => Array.from(crypto.randomBytes(n), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export class Session {
  constructor(ws, hub) {
    this.ws = ws;
    this.hub = hub;
    this.user = null;
    this.party = null;
    this.room = null;
    this.player = null;
  }

  send(data) {
    if (this.ws.readyState === 1) this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  }

  leaveRoom(reason = 'salió') {
    if (!this.room) return;
    const room = this.room;
    this.room = null;
    const p = this.player;
    this.player = null;
    room.removePlayer(p, reason === 'fin' ? 'ha vuelto al lobby' : 'ha salido');
    this.send({ t: 'left', reason });
    if (this.party) this.hub.broadcastParty(this.party);
    this.hub.sendLobby(this);
  }
}

export class Hub {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.sessions = new Map();
    this.parties = new Map();
    this.rooms = new Map();
  }

  publicUser(u) {
    return { name: u.name, avatar: u.avatar || null, stats: { ...DEFAULT_STATS, ...(u.stats || {}) } };
  }

  async auth(session, name) {
    const u = await this.store.getUser(name);
    if (!u) return false;
    const key = u.name.toLowerCase();
    const old = this.sessions.get(key);
    if (old && old !== session) {
      old.send({ t: 'kicked', reason: 'Se inició sesión con tu cuenta en otro lugar' });
      old.ws.close();
      this.disconnect(old);
    }
    session.user = this.publicUser(u);
    this.sessions.set(key, session);
    this.createParty(session);
    return true;
  }

  disconnect(session) {
    if (session.room) session.leaveRoom('desconectado');
    if (session.party) this.leaveParty(session, true);
    if (session.user && this.sessions.get(session.user.name.toLowerCase()) === session) this.sessions.delete(session.user.name.toLowerCase());
  }

  // ---------- grupos ----------
  createParty(session) {
    if (session.party) this.leaveParty(session, true);
    let c;
    do c = code(); while (this.parties.has(c));
    const party = { code: c, leader: session, members: [session], mode: 'competitive', bots: this.config.botsPerTeam, skill: this.config.botSkill };
    this.parties.set(c, party);
    session.party = party;
    this.broadcastParty(party);
    return party;
  }

  leaveParty(session, silent = false) {
    const party = session.party;
    if (!party) return;
    party.members = party.members.filter(s => s !== session);
    session.party = null;
    if (!party.members.length) { this.parties.delete(party.code); return; }
    if (party.leader === session) party.leader = party.members[0];
    this.partyChat(party, '', `${session.user.name} ha salido del grupo`);
    this.broadcastParty(party);
    if (!silent) this.createParty(session);
  }

  joinParty(session, c) {
    const party = this.parties.get(String(c || '').toUpperCase().trim());
    if (!party) return session.send({ t: 'perror', msg: 'No existe ningún grupo con ese código' });
    if (party === session.party) return;
    if (party.members.length >= PARTY_MAX) return session.send({ t: 'perror', msg: 'El grupo está completo (5/5)' });
    if (session.room) return session.send({ t: 'perror', msg: 'Sal de la partida antes de unirte a un grupo' });
    this.leaveParty(session, true);
    party.members.push(session);
    session.party = party;
    this.partyChat(party, '', `${session.user.name} se ha unido al grupo`);
    this.broadcastParty(party);
  }

  partyState(party) {
    return {
      t: 'party', code: party.code, leader: party.leader.user.name, mode: party.mode, bots: party.bots, skill: party.skill,
      members: party.members.map(s => ({ name: s.user.name, avatar: s.user.avatar, rating: s.user.stats.rating, inMatch: !!s.room })),
    };
  }

  broadcastParty(party) {
    const msg = JSON.stringify(this.partyState(party));
    for (const s of party.members) s.send(msg);
  }

  partyChat(party, name, msg) {
    const out = JSON.stringify({ t: 'pchat', name, msg });
    for (const s of party.members) s.send(out);
  }

  sendLobby(session) {
    let reconnect = null;
    for (const r of this.rooms.values()) if (r.records.has(session.user.name.toLowerCase())) { reconnect = r.id; break; }
    session.send({ t: 'lobby', user: session.user, reconnect });
  }

  // ---------- emparejamiento ----------
  queue(session) {
    const party = session.party;
    if (!party || party.leader !== session) return;
    if (party.members.some(s => s.room)) return session.send({ t: 'perror', msg: 'Algún miembro del grupo sigue en una partida' });
    let room, team;
    if (party.mode === 'private') {
      let id;
      do id = 'P-' + code(4); while (this.rooms.has(id));
      room = this.createRoom(id, true, session.user.name);
      room.botTarget = party.bots;
      room.botSkill = party.skill;
      team = Math.random() < 0.5 ? 'T' : 'CT';
    } else {
      for (const r of this.rooms.values()) {
        if (r.isPrivate || r.closed || (r.phase !== 'warmup' && r.phase !== 'mapvote')) continue;
        const t = r.slotFor(party.members.length);
        if (t) { room = r; team = t; break; }
      }
      if (!room) {
        if (this.rooms.size >= this.config.maxRooms) return session.send({ t: 'perror', msg: 'Servidor lleno, inténtalo en un momento' });
        let id;
        do id = 'C-' + code(4); while (this.rooms.has(id));
        room = this.createRoom(id, false, null);
        team = Math.random() < 0.5 ? 'T' : 'CT';
      }
    }
    for (const s of party.members) this.enterRoom(s, room, team);
    this.broadcastParty(party);
  }

  createRoom(id, isPrivate, owner) {
    const room = new Room(id, {
      isPrivate, owner, config: this.config,
      onClose: r => { this.rooms.delete(r.id); console.log(`[sala] cerrada ${r.id}`); },
      onMatchEnd: (r, humans, winner, rounds, results) => this.saveMatch(humans, winner, results),
    });
    this.rooms.set(id, room);
    console.log(`[sala] creada ${id}${isPrivate ? ' (privada)' : ''}`);
    return room;
  }

  enterRoom(session, room, team) {
    if (session.room) session.leaveRoom('cambio');
    session.send({ t: 'matchfound', room: room.id, private: room.isPrivate });
    session.room = room;
    session.player = room.addHuman(session, team);
  }

  reconnect(session) {
    for (const r of this.rooms.values()) {
      const rec = r.records.get(session.user.name.toLowerCase());
      if (rec && !r.closed) { this.enterRoom(session, r, rec.team); if (session.party) this.broadcastParty(session.party); return; }
    }
    session.send({ t: 'perror', msg: 'La partida ya no está disponible' });
    this.sendLobby(session);
  }

  async saveMatch(humans, winner, results) {
    for (const p of humans) {
      const res = results.find(r => r.id === p.id);
      try {
        const u = await this.store.getUser(p.account);
        if (!u) continue;
        const s = { ...DEFAULT_STATS, ...(u.stats || {}) };
        s.kills += p.st.kills; s.deaths += p.st.deaths; s.assists += p.st.assists; s.hs += p.st.hs;
        s.dmg += p.st.dmg; s.mvps += p.st.mvps; s.rounds += res ? Math.max(1, p.st.roundsPlayed || 0) : 0;
        s.matches++;
        if (p.team === winner) s.wins++; else s.losses++;
        s.rating = Math.max(0, s.rating + (res?.delta || 0));
        await this.store.updateUser(p.account, { stats: s });
        const sess = this.sessions.get(p.account.toLowerCase());
        if (sess) { sess.user.stats = s; if (sess.party) this.broadcastParty(sess.party); }
      } catch (e) { console.error('No se pudieron guardar las estadísticas', e); }
    }
  }

  // ---------- mensajes ----------
  async handle(session, m) {
    if (!session.user) {
      if (m.t === 'auth') {
        const name = this.tokens?.get(String(m.token || ''));
        if (!name || !(await this.auth(session, name.name))) return session.send({ t: 'autherr', msg: 'Sesión caducada, inicia sesión de nuevo' });
        session.send({ t: 'authok', user: session.user });
        this.sendLobby(session);
      }
      return;
    }
    if (session.room && session.player) {
      if (m.t === 'leave_room') { session.leaveRoom('salió'); return; }
      try { session.room.onMessage(session.player, m); } catch (e) { console.error('Error procesando mensaje', e); }
      return;
    }
    const party = session.party;
    switch (m.t) {
      case 'party_join': this.joinParty(session, m.code); break;
      case 'party_leave': this.leaveParty(session); break;
      case 'party_kick':
        if (party && party.leader === session) {
          const target = party.members.find(s => s.user.name === m.name && s !== session);
          if (target) { target.send({ t: 'perror', msg: 'Te han expulsado del grupo' }); this.leaveParty(target); }
        }
        break;
      case 'party_mode':
        if (party && party.leader === session) {
          if (m.mode === 'private' || m.mode === 'competitive') party.mode = m.mode;
          if (Number.isFinite(m.bots)) party.bots = Math.max(0, Math.min(5, m.bots | 0));
          if (Number.isFinite(m.skill)) party.skill = Math.max(0, Math.min(1, m.skill));
          this.broadcastParty(party);
        }
        break;
      case 'pchat': {
        const msg = String(m.msg || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 160);
        if (party && msg) this.partyChat(party, session.user.name, msg);
        break;
      }
      case 'queue': this.queue(session); break;
      case 'reconnect': this.reconnect(session); break;
      case 'avatar_changed':
        if (party) this.broadcastParty(party);
        break;
      case 'ping': session.send({ t: 'pong', c: m.c, s: Date.now() }); break;
    }
  }
}
