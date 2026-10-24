// Sonido 3D sintetizado con WebAudio (no requiere archivos de audio).
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.listenerPos = [0, 0, 0];
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  updateListener(pos, fwd) {
    if (!this.ctx) return;
    this.listenerPos = pos;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos[0]; l.positionY.value = pos[1]; l.positionZ.value = pos[2];
      l.forwardX.value = fwd[0]; l.forwardY.value = fwd[1]; l.forwardZ.value = fwd[2];
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos[0], pos[1], pos[2]);
      l.setOrientation(fwd[0], fwd[1], fwd[2], 0, 1, 0);
    }
  }

  out(pos, ref = 4) {
    if (!pos) return this.master;
    const dx = pos[0] - this.listenerPos[0], dy = pos[1] - this.listenerPos[1], dz = pos[2] - this.listenerPos[2];
    if (dx * dx + dy * dy + dz * dz > 160 * 160) return null;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 200;
    p.rolloffFactor = 1.2;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
    else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(this.master);
    return p;
  }

  noise(out, { dur = 0.1, type = 'lowpass', freq = 2000, q = 0.7, gain = 0.5, attack = 0.002, delay = 0, sweep = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  tone(out, { f0 = 440, f1 = null, dur = 0.1, type = 'sine', gain = 0.3, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  gun(model, pos, silenced) {
    if (!this.ctx) return;
    const out = this.out(pos, 6);
    if (!out) return;
    const local = !pos;
    const k = local ? 0.9 : 1.4;
    if (silenced) {
      this.noise(out, { dur: 0.09, type: 'bandpass', freq: 3200, q: 1.2, gain: 0.35 * k });
      this.tone(out, { f0: 300, f1: 120, dur: 0.05, gain: 0.15 * k });
      return;
    }
    switch (model) {
      case 'awp':
        this.noise(out, { dur: 0.55, type: 'lowpass', freq: 2200, gain: 1.0 * k, sweep: 0.25 });
        this.tone(out, { f0: 90, f1: 30, dur: 0.35, gain: 0.8 * k });
        this.noise(out, { dur: 0.25, type: 'highpass', freq: 3000, gain: 0.25 * k });
        break;
      case 'sniper':
        this.noise(out, { dur: 0.4, type: 'lowpass', freq: 2800, gain: 0.9 * k, sweep: 0.3 });
        this.tone(out, { f0: 110, f1: 40, dur: 0.25, gain: 0.6 * k });
        break;
      case 'shotgun':
        this.noise(out, { dur: 0.35, type: 'lowpass', freq: 1500, gain: 1.0 * k, sweep: 0.4 });
        this.tone(out, { f0: 80, f1: 35, dur: 0.22, gain: 0.7 * k });
        break;
      case 'ak':
        this.noise(out, { dur: 0.2, type: 'lowpass', freq: 2600, gain: 0.85 * k, sweep: 0.4 });
        this.tone(out, { f0: 130, f1: 45, dur: 0.12, gain: 0.55 * k });
        break;
      case 'rifle': case 'rifle2':
        this.noise(out, { dur: 0.17, type: 'lowpass', freq: 3400, gain: 0.75 * k, sweep: 0.4 });
        this.tone(out, { f0: 150, f1: 55, dur: 0.1, gain: 0.45 * k });
        break;
      case 'smg':
        this.noise(out, { dur: 0.11, type: 'bandpass', freq: 2400, q: 0.8, gain: 0.7 * k });
        this.tone(out, { f0: 180, f1: 70, dur: 0.07, gain: 0.35 * k });
        break;
      case 'deagle':
        this.noise(out, { dur: 0.3, type: 'lowpass', freq: 2400, gain: 0.95 * k, sweep: 0.35 });
        this.tone(out, { f0: 120, f1: 40, dur: 0.18, gain: 0.6 * k });
        break;
      default:
        this.noise(out, { dur: 0.13, type: 'bandpass', freq: 2000, q: 0.7, gain: 0.7 * k });
        this.tone(out, { f0: 200, f1: 70, dur: 0.08, gain: 0.35 * k });
    }
  }

  footstep(pos, vol = 1) {
    if (!this.ctx) return;
    const out = this.out(pos, 2.5);
    if (!out) return;
    this.noise(out, { dur: 0.08, type: 'bandpass', freq: 500 + Math.random() * 400, q: 1.5, gain: 0.35 * vol });
    this.noise(out, { dur: 0.05, type: 'highpass', freq: 3500, gain: 0.06 * vol, delay: 0.01 });
  }

  land(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 2.5);
    if (out) this.noise(out, { dur: 0.12, type: 'lowpass', freq: 600, gain: 0.5 });
  }

  hitConfirm(head, kill) {
    if (!this.ctx) return;
    if (head) {
      this.tone(this.master, { f0: 2400, f1: 2300, dur: 0.25, type: 'triangle', gain: 0.25 });
      this.tone(this.master, { f0: 3600, dur: 0.15, type: 'sine', gain: 0.1 });
    } else {
      this.noise(this.master, { dur: 0.05, type: 'bandpass', freq: 1200, q: 2, gain: 0.25 });
    }
    if (kill) this.tone(this.master, { f0: 900, f1: 600, dur: 0.12, type: 'square', gain: 0.06, delay: 0.03 });
  }

  hurt() {
    if (!this.ctx) return;
    this.noise(this.master, { dur: 0.12, type: 'lowpass', freq: 700, gain: 0.5 });
  }

  impact(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 1.5);
    if (out) this.noise(out, { dur: 0.05, type: 'highpass', freq: 2500, gain: 0.2 });
  }

  click() { if (this.ctx) this.tone(this.master, { f0: 1800, dur: 0.03, type: 'square', gain: 0.08 }); }
  ui() { if (this.ctx) this.tone(this.master, { f0: 660, f1: 880, dur: 0.07, type: 'sine', gain: 0.12 }); }
  buy() { if (this.ctx) { this.noise(this.master, { dur: 0.08, type: 'bandpass', freq: 1500, gain: 0.25 }); this.tone(this.master, { f0: 520, dur: 0.06, gain: 0.08, delay: 0.05 }); } }
  pickup() { if (this.ctx) this.noise(this.master, { dur: 0.1, type: 'bandpass', freq: 900, q: 2, gain: 0.3 }); }

  reload(time) {
    if (!this.ctx) return;
    const m = this.master;
    this.noise(m, { dur: 0.06, type: 'bandpass', freq: 1400, q: 3, gain: 0.25, delay: 0.1 });
    this.noise(m, { dur: 0.08, type: 'bandpass', freq: 900, q: 3, gain: 0.3, delay: time * 0.55 });
    this.noise(m, { dur: 0.06, type: 'bandpass', freq: 2200, q: 4, gain: 0.3, delay: time * 0.85 });
  }

  swish(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 2);
    if (out) this.noise(out, { dur: 0.18, type: 'bandpass', freq: 3000, q: 1, gain: 0.25, sweep: 0.3 });
  }

  deploy() { if (this.ctx) this.noise(this.master, { dur: 0.07, type: 'bandpass', freq: 1800, q: 3, gain: 0.15 }); }

  beep(pos, urgent) {
    if (!this.ctx) return;
    const out = this.out(pos, 8);
    if (out) this.tone(out, { f0: urgent ? 2600 : 2200, dur: 0.09, type: 'square', gain: 0.18 });
  }

  explosion(pos, big) {
    if (!this.ctx) return;
    const out = this.out(pos, big ? 30 : 12);
    if (!out) return;
    this.noise(out, { dur: big ? 2.2 : 1.1, type: 'lowpass', freq: big ? 900 : 1400, gain: 1.0, sweep: 0.15 });
    this.tone(out, { f0: 70, f1: 18, dur: big ? 1.4 : 0.7, gain: 0.9 });
  }

  flashbang(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 10);
    if (out) this.noise(out, { dur: 0.5, type: 'highpass', freq: 1200, gain: 0.9 });
  }

  earRing(strength) {
    if (!this.ctx || strength < 0.2) return;
    this.tone(this.master, { f0: 3800, dur: 2.5 * strength, gain: 0.05 * strength });
  }

  smoke(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 6);
    if (out) this.noise(out, { dur: 2.5, type: 'highpass', freq: 1500, gain: 0.25, attack: 0.1 });
  }

  bounce(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 2);
    if (out) this.tone(out, { f0: 900 + Math.random() * 300, dur: 0.05, type: 'triangle', gain: 0.25 });
  }

  plantBeeps(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 4);
    if (!out) return;
    for (let i = 0; i < 7; i++) this.tone(out, { f0: 1400 + i * 60, dur: 0.06, type: 'square', gain: 0.08, delay: i * 0.4 });
  }

  defuseSound(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 4);
    if (out) for (let i = 0; i < 4; i++) this.noise(out, { dur: 0.05, type: 'bandpass', freq: 2000, q: 4, gain: 0.25, delay: i * 0.25 });
  }

  fire(pos, dur = 7) {
    if (!this.ctx) return;
    const out = this.out(pos, 5);
    if (!out) return;
    this.noise(out, { dur: 0.6, type: 'lowpass', freq: 900, gain: 0.7 });
    for (let t = 0.2; t < dur; t += 0.12 + Math.random() * 0.15) {
      this.noise(out, { dur: 0.05, type: 'bandpass', freq: 1500 + Math.random() * 2500, q: 2, gain: 0.08 + Math.random() * 0.1, delay: t });
    }
  }

  fizz(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 4);
    if (out) this.noise(out, { dur: 0.8, type: 'highpass', freq: 2500, gain: 0.3, sweep: 0.5 });
  }

  glass(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 4);
    if (!out) return;
    this.noise(out, { dur: 0.25, type: 'highpass', freq: 4000, gain: 0.45 });
    this.tone(out, { f0: 3200, f1: 2600, dur: 0.15, type: 'triangle', gain: 0.1 });
  }

  remoteReload(pos) {
    if (!this.ctx) return;
    const out = this.out(pos, 2);
    if (!out) return;
    this.noise(out, { dur: 0.06, type: 'bandpass', freq: 1400, q: 3, gain: 0.3, delay: 0.1 });
    this.noise(out, { dur: 0.08, type: 'bandpass', freq: 900, q: 3, gain: 0.35, delay: 0.9 });
  }

  armorHit() {
    if (!this.ctx) return;
    this.noise(this.master, { dur: 0.07, type: 'bandpass', freq: 2600, q: 3, gain: 0.25 });
  }

  inspect() {
    if (!this.ctx) return;
    this.noise(this.master, { dur: 0.08, type: 'bandpass', freq: 1700, q: 3, gain: 0.15, delay: 0.2 });
    this.noise(this.master, { dur: 0.08, type: 'bandpass', freq: 1100, q: 3, gain: 0.15, delay: 1.2 });
  }

  matchFound() {
    if (!this.ctx) return;
    [523, 784, 1046].forEach((f, i) => this.tone(this.master, { f0: f, dur: 0.3, type: 'triangle', gain: 0.15, delay: i * 0.1 }));
  }

  roundEnd(win) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 262];
    notes.forEach((f, i) => this.tone(this.master, { f0: f, dur: 0.35, type: 'triangle', gain: 0.12, delay: i * 0.13 }));
  }
}
