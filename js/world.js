// Construcción visual del mapa con texturas procedurales por tema y geometría fusionada.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(g, s, n, colors, maxR = 2, alpha = 0.18) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = 0.05 + Math.random() * alpha;
    const r = Math.random() * maxR + 0.5;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
  g.globalAlpha = 1;
}

function grime(g, s, color = '0,0,0', n = 12, a = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * s, y = s * (0.6 + Math.random() * 0.4);
    const gr = g.createRadialGradient(x, y, 0, x, y, 30 + Math.random() * 60);
    gr.addColorStop(0, `rgba(${color},${a})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }
}

const TEX = {
  blocks: (base, mortar, rows = 4) => canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 5000, ['#000', '#fff', '#6a5030'], 2.5);
    const bh = s / rows;
    g.strokeStyle = mortar; g.lineWidth = 3; g.globalAlpha = 0.55;
    for (let r = 0; r < rows; r++) {
      const y = r * bh;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      const off = r % 2 ? s / 4 : 0;
      for (let x = off; x < s + 1; x += s / 2) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
    }
    g.globalAlpha = 0.12; g.fillStyle = '#000';
    for (let r = 0; r < rows; r++) g.fillRect(0, r * bh + bh - 6, s, 6);
    g.globalAlpha = 1;
    grime(g, s);
  }),
  plaster: (base, baseColor) => canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 4000, ['#000', '#fff'], 3, 0.1);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(0,0,0,.04)';
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 30 + Math.random() * 50, 20 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill();
    }
    if (baseColor) { g.fillStyle = baseColor; g.fillRect(0, s - 34, s, 34); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, s - 36, s, 3); }
    grime(g, s, '60,40,20', 10, 0.1);
  }),
  concrete: (base, panel = true) => canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 9000, ['#000', '#fff', '#555'], 2, 0.14);
    if (panel) {
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
      g.strokeRect(1, 1, s - 2, s - 2);
      g.fillStyle = 'rgba(0,0,0,.3)';
      for (const [x, y] of [[16, 16], [s - 16, 16], [16, s - 16], [s - 16, s - 16]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    }
    grime(g, s, '0,0,0', 14, 0.1);
  }),
  corrugated: base => canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 8) {
      const gr = g.createLinearGradient(x, 0, x + 8, 0);
      gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(255,255,255,.12)');
      g.fillStyle = gr; g.fillRect(x, 0, 8, s);
    }
    speckle(g, s, 800, ['#000', '#8a4a2a'], 3, 0.25);
  }),
  tiles: (base, grout, n = 4) => canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 16000, ['#000', '#fff', '#7a6a4a'], 3, 0.16);
    g.strokeStyle = grout; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s / n, 0); g.lineTo(i * s / n, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / n); g.lineTo(s, i * s / n); g.stroke();
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      g.fillRect(((Math.random() * n) | 0) * s / n, ((Math.random() * n) | 0) * s / n, s / n, s / n);
    }
  }),
  cobble: base => canvasTex(512, (g, s) => {
    g.fillStyle = '#5d564b'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < s; x += 32) {
      const l = 40 + Math.random() * 25;
      g.fillStyle = `hsl(35, 12%, ${l}%)`;
      g.beginPath(); g.ellipse(x + 16, y + 16, 14, 13, Math.random(), 0, 7); g.fill();
    }
    g.globalAlpha = 0.35; g.fillStyle = base; g.fillRect(0, 0, s, s); g.globalAlpha = 1;
    speckle(g, s, 6000, ['#000', '#fff'], 2, 0.12);
  }),
  asphalt: base => canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 30000, ['#000', '#fff', '#777'], 2, 0.2);
    g.fillStyle = 'rgba(230,190,40,.55)';
    g.fillRect(s / 2 - 4, 0, 8, s * 0.4); g.fillRect(s / 2 - 4, s * 0.6, 8, s * 0.4);
    grime(g, s, '0,0,0', 10, 0.15);
  }),
  sand: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#cfae74'; g.fillRect(0, 0, s, s);
    speckle(g, s, 18000, ['#000', '#fff', '#8a6a3a', '#e8cc94'], 3);
    g.strokeStyle = 'rgba(90,64,30,.28)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 60},${90 + Math.random() * 40},50,.10)`;
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill();
    }
  }),
  wood: (base = '#8a5d2e') => canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)';
      g.fillRect(0, i * s / 8, s, s / 8);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, i * s / 8, s, 2);
    }
    speckle(g, s, 2500, ['#000', '#5a3a17', '#d4a36a'], 3);
  }),
  crate: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9a6b36'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#8d602f' : '#a3733c';
      g.fillRect(0, i * s / 8, s, s / 8);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * s / 8, s, 2);
    }
    speckle(g, s, 2500, ['#000', '#5a3a17', '#d4a36a'], 3);
    g.strokeStyle = '#5b3b18'; g.lineWidth = 26; g.strokeRect(13, 13, s - 26, s - 26);
    g.lineWidth = 22; g.beginPath(); g.moveTo(20, 20); g.lineTo(s - 20, s - 20); g.stroke();
    g.fillStyle = '#3a2b1a';
    for (const [x, y] of [[24, 24], [s - 24, 24], [24, s - 24], [s - 24, s - 24]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  }, false),
  container: color => canvasTex(256, (g, s) => {
    g.fillStyle = color; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 12) {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 3, s);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 4, 0, 3, s);
    }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 10; g.strokeRect(5, 5, s - 10, s - 10);
    speckle(g, s, 1500, ['#3a1d0d', '#000', '#a0522d'], 4, 0.35);
    grime(g, s, '50,25,10', 8, 0.2);
  }, false),
  barrel: () => canvasTex(128, (g, s) => {
    g.fillStyle = '#7d2b22'; g.fillRect(0, 0, s, s);
    speckle(g, s, 1200, ['#000', '#c45a3a'], 3);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, s * 0.2, s, 8); g.fillRect(0, s * 0.75, s, 8);
  }, false),
};

Object.assign(TEX, {
  terrain: (base, spots) => canvasTex(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = spots[(Math.random() * spots.length) | 0];
      g.globalAlpha = 0.12 + Math.random() * 0.15;
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 90, 10 + Math.random() * 50, Math.random() * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    speckle(g, s, 20000, ['#000', '#fff', ...spots], 2, 0.15);
  }),
  roofTiles: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9c4a2c'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < s; x += 24) {
      g.fillStyle = `hsl(14, ${45 + Math.random() * 15}%, ${30 + Math.random() * 12}%)`;
      g.beginPath(); g.ellipse(x + 12, y + 10, 11, 9, 0, 0, Math.PI); g.fill();
    }
    speckle(g, s, 2000, ['#000', '#d9805a'], 2, 0.2);
  }),
  doorWood: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) { g.fillStyle = x % 64 ? '#634224' : '#53361c'; g.fillRect(x, 0, 30, s); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 30, 0, 2, s); }
    speckle(g, s, 3000, ['#000', '#8a6238'], 2, 0.2);
    g.fillStyle = '#2b2b2b';
    for (const y of [s * 0.15, s * 0.5, s * 0.85]) { g.fillRect(0, y - 8, s, 16); for (let x = 10; x < s; x += 40) { g.fillStyle = '#777'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = '#2b2b2b'; } }
  }, false),
  hazard: base => canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 24) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, s, 3); }
    speckle(g, s, 2500, ['#000', '#fff'], 2, 0.15);
    g.save(); g.beginPath(); g.rect(0, s - 48, s, 48); g.clip();
    for (let x = -48; x < s + 48; x += 32) { g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(x, s); g.lineTo(x + 16, s); g.lineTo(x + 64, s - 48); g.lineTo(x + 48, s - 48); g.fill(); }
    g.restore();
    g.fillStyle = '#1b1b1b'; g.fillRect(0, s - 50, s, 3);
  }, false),
  fence: () => {
    const t = canvasTex(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = 'rgba(170,175,180,.9)'; g.lineWidth = 2;
      for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke(); }
    });
    return t;
  },
});

const THEMES = {
  desert: {
    sky: ['#5b95d6', '#e7dccb'], fog: ['#dcd5c6', 120, 520], sun: ['#fff0d6', 2.5], hemi: ['#cfe3ff', '#a07c4c', 1.15], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#cda66a', '#7d5f36'), wall2: TEX.plaster('#dcc9a0', '#b89a6a'), floor: TEX.sand(), ceiling: TEX.wood('#7a5530'), step: TEX.blocks('#bfa070', '#7d5f36', 2), lowwall: TEX.blocks('#c49c62', '#7d5f36', 2) }),
    floorScale: 8, cap: '#a8875a',
  },
  industrial: {
    sky: ['#6f7f92', '#c4c9cf'], fog: ['#b9bec4', 90, 420], sun: ['#f2f4ff', 1.9], hemi: ['#dfe6f2', '#5a5a5a', 1.25], exposure: 1.1,
    tex: () => ({ wall: TEX.concrete('#8c8f93'), wall2: TEX.corrugated('#7f8a93'), floor: TEX.tiles('#6f7174', '#4c4e51', 2), ceiling: TEX.corrugated('#5b6066'), step: TEX.concrete('#7a7d80', false), lowwall: TEX.concrete('#99702c', false) }),
    floorScale: 8, cap: '#5e6267',
  },
  village: {
    sky: ['#6aa6e0', '#f2e6d2'], fog: ['#e3dccf', 120, 520], sun: ['#fff4e0', 2.6], hemi: ['#e5efff', '#b59a7a', 1.1], exposure: 1.0,
    tex: () => ({ wall: TEX.plaster('#ebe5d8', '#a8916d'), wall2: TEX.plaster('#e0d2b4', '#9b7c58'), floor: TEX.cobble('#b5ab98'), ceiling: TEX.wood('#6b4a2e'), step: TEX.blocks('#c4b59a', '#857256', 2), lowwall: TEX.blocks('#d6cbb4', '#857256', 2) }),
    floorScale: 8, cap: '#b0573a',
  },
  docks: {
    sky: ['#7f97ad', '#d4d6d4'], fog: ['#c3cad0', 110, 520], sun: ['#fff6ea', 2.0], hemi: ['#d6e2ee', '#5d5650', 1.2], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#8b5a45', '#4a3026', 6), wall2: TEX.concrete('#8d9196'), floor: TEX.asphalt('#55585c'), ceiling: TEX.corrugated('#6a6f75'), step: TEX.concrete('#808487', false), lowwall: TEX.concrete('#7c8084', false) }),
    floorScale: 10, cap: '#4d5257',
  },
  temple: {
    sky: ['#5c9cbc', '#dbe5d6'], fog: ['#c9d2c5', 90, 420], sun: ['#fff3da', 2.3], hemi: ['#e2f0ea', '#6f6a55', 1.2], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#a19c88', '#5f5b4b', 3), wall2: TEX.blocks('#b3ad97', '#6b6654', 3), floor: TEX.tiles('#b8b29e', '#7d7765', 4), ceiling: TEX.blocks('#7d7865', '#4a473d', 2), step: TEX.blocks('#a9a38d', '#6b6654', 2), lowwall: TEX.blocks('#9c977f', '#5f5b4b', 2) }),
    floorScale: 8, cap: '#8a8470',
  },
};

const DECOR = {
  desert: { trim: '#8c6a40', frame: '#6b4a2a', shutter: '#3f6f7a', glass: '#20303a', awning: ['#b8452f', '#d8c08a', '#3c6e8f'], doorWood: true, terrain: ['#cfae74', ['#b9925a', '#e2c690', '#a27c4a']], roof: 'flat', dome: '#d9c39a', windows: 0.35, outside: 'desert' },
  industrial: { trim: '#55595e', frame: '#3b3f44', shutter: '#4d5a52', glass: '#1d2a33', awning: ['#7a7f85'], doorWood: false, terrain: ['#6f6a5e', ['#5a564c', '#7d786a', '#4f5546']], roof: 'flat', windows: 0.45, outside: 'industrial', fence: true },
  village: { trim: '#a8916d', frame: '#5a3f26', shutter: '#3b6b45', glass: '#1e2b33', awning: ['#a33a2c', '#2f5d8a', '#c8a34a'], doorWood: true, terrain: ['#7d8a52', ['#6c7a45', '#93a05f', '#8a7a52']], roof: 'gable', windows: 0.5, outside: 'village' },
  docks: { trim: '#3e2a22', frame: '#2f3438', shutter: '#5a2f2a', glass: '#1b2833', awning: ['#2f5d8a', '#a13a2a'], doorWood: false, terrain: ['#55585c', ['#4a4d50', '#606368']], roof: 'flat', windows: 0.4, outside: 'docks', fence: true },
  temple: { trim: '#6b6654', frame: '#4f4a3a', shutter: '#4d5a3a', glass: '#141a14', awning: ['#6f3a2a'], doorWood: false, terrain: ['#5d7046', ['#4a5c38', '#6f8452', '#7a6f50']], roof: 'flat', windows: 0.25, outside: 'temple', vines: true },
};

const CONTAINER_COLORS = ['#a13a2a', '#2f5d8a', '#3f7a3a', '#c07a26', '#6b6f74'];

// Ajusta las UV de una caja para que la textura se repita según su tamaño real.
function boxGeo(w, h, d, scale) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (scale) {
    const uv = geo.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const [a, b] = dims[f];
      for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * a / scale, uv.getY(i) * b / scale); }
    }
  }
  return geo;
}

function letterTex(ch) {
  return canvasTex(256, g => {
    g.font = 'bold 200px "Barlow Semi Condensed", Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#b3261e'; g.globalAlpha = 0.75;
    g.fillText(ch, 128, 138);
  }, false);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash = (x, z, k = 0) => (((x * 73856093) ^ (z * 19349663) ^ (k * 83492791)) >>> 0) % 10007 / 10007;

function leafTex(color) {
  const t = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `hsl(${100 + Math.random() * 30}, ${35 + Math.random() * 25}%, ${18 + Math.random() * 18}%)`;
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 5 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill();
    }
    if (color) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.globalAlpha = 0.25; g.fillRect(0, 0, s, s); }
  });
  return t;
}

function waveTex() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#2c5a77'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`;
      g.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * s, y = Math.random() * s, l = 10 + Math.random() * 30;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke();
    }
  });
}

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = null;
    this.anim = [];
    this.doorMeshes = [];
    const shadows = quality !== 'baja';
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#a07c4c', 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.4);
    this.sun.position.set(45, 90, 30);
    if (shadows) {
      this.sun.castShadow = true;
      const size = quality === 'alta' ? 2048 : 1024;
      this.sun.shadow.mapSize.set(size, size);
      const sc = this.sun.shadow.camera;
      sc.near = 10; sc.far = 260;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
    }
    scene.add(this.sun, this.sun.target);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), this.skyMat);
    this.sky.renderOrder = -1;
    scene.add(this.sky);
  }

  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); }); }
    });
    this.group = null;
    this.anim = [];
    this.doorMeshes = [];
  }

  build(map, renderer) {
    this.dispose();
    this.map = map;
    const th = THEMES[map.theme] || THEMES.desert;
    const dec = DECOR[map.theme] || DECOR.desert;
    const shadows = this.quality !== 'baja';
    const scene = this.scene;
    this.skyMat.uniforms.top.value.set(th.sky[0]);
    this.skyMat.uniforms.bottom.value.set(th.sky[1]);
    scene.background = new THREE.Color(th.sky[1]);
    scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]);
    this.sun.color.set(th.sun[0]);
    this.sun.intensity = th.sun[1];
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this.hemi.intensity = th.hemi[2];
    if (renderer) renderer.toneMappingExposure = th.exposure;

    const group = new THREE.Group();
    this.group = group;
    const tex = th.tex();
    const L = (opts) => new THREE.MeshLambertMaterial(opts);
    const mats = {
      wall: L({ map: tex.wall }), wall2: L({ map: tex.wall2 }), ceiling: L({ map: tex.ceiling }),
      step: L({ map: tex.step }), platform: L({ map: tex.wall2 }), lowwall: L({ map: tex.lowwall }),
      crate: L({ map: TEX.crate() }), barrel: L({ map: TEX.barrel() }), cap: L({ color: th.cap }),
      lamp: new THREE.MeshBasicMaterial({ color: '#ffe9b0' }),
      trim: L({ color: dec.trim }), frame: L({ color: dec.frame }), shutter: L({ color: dec.shutter }),
      glass: new THREE.MeshPhongMaterial({ color: dec.glass, specular: '#8aa4b8', shininess: 80 }),
      metal: L({ color: '#6d7276' }), dark: L({ color: '#2b2e31' }),
      doorWood: L({ map: TEX.doorWood() }), woodpanel: L({ map: TEX.doorWood() }),
      leaf: L({ map: leafTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      roofTiles: L({ map: TEX.roofTiles() }), dome: L({ color: dec.dome || '#d8c8a8' }),
      poster0: L({ color: '#b8452f' }), poster1: L({ color: '#2f5d8a' }), poster2: L({ color: '#d8b04a' }),
      terrain2: L({ color: dec.terrain[1][0] }), mountain: L({ color: { desert: '#c2a072', industrial: '#7f858c', docks: '#76848a' }[map.theme] || '#8a8f99' }), trunk: L({ color: '#6b4a2e' }),
      factory: L({ map: TEX.concrete('#8a8d90') }), brick: L({ map: TEX.blocks('#8b5a45', '#4a3026', 6) }),
      tank: L({ color: '#c9cdd1' }), hull: L({ color: '#2f3d4a' }), hullRed: L({ color: '#8a2f24' }), crane: L({ color: '#d6a12a' }),
      plaster: L({ map: TEX.plaster('#ebe5d8', '#a8916d') }), rock: L({ color: '#8b8778' }), cypress: L({ color: '#2e4a2c' }),
      foliage: L({ color: '#3f6b35' }), hills: L({ color: '#6f8a4f' }),
    };
    dec.awning.forEach((c, i) => { mats['awning' + i] = L({ color: c, side: THREE.DoubleSide }); });
    CONTAINER_COLORS.forEach((c, i) => { mats['container' + i] = L({ map: TEX.container(c) }); });
    if (dec.fence) mats.fence = L({ map: TEX.fence(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });

    const buckets = {};
    const add = (key, geo) => (buckets[key] ||= []).push(geo);
    const B = (x0, y0, z0, x1, y1, z1) => new THREE.BoxGeometry(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Math.max(0.01, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const C = map.cell, W = map.w, H = map.h;
    const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? null : map.grid[z][x]);
    const isB = ch => ch === '#' || ch === '%';

    // ---------- suelo y exterior ----------
    const floorGeos = [];
    const used = new Uint8Array(W * H);
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      if (used[z * W + x] || at(x, z) === ' ') continue;
      let x2 = x;
      while (x2 + 1 < W && !used[z * W + x2 + 1] && at(x2 + 1, z) !== ' ') x2++;
      let z2 = z;
      outer: while (z2 + 1 < H) { for (let xx = x; xx <= x2; xx++) if (used[(z2 + 1) * W + xx] || at(xx, z2 + 1) === ' ') break outer; z2++; }
      for (let zz = z; zz <= z2; zz++) for (let xx = x; xx <= x2; xx++) used[zz * W + xx] = 1;
      const x0 = map.toX(x), x1 = map.toX(x2 + 1), z0 = map.toZ(z), z1 = map.toZ(z2 + 1);
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / th.floorScale, (-z1 + uv.getY(i) * (z1 - z0)) / th.floorScale);
      floorGeos.push(g);
    }
    const floor = new THREE.Mesh(mergeGeometries(floorGeos, false), L({ map: tex.floor }));
    floorGeos.forEach(g => g.dispose());
    floor.receiveShadow = shadows;
    group.add(floor);

    const terrainTex = TEX.terrain(dec.terrain[0], dec.terrain[1]);
    terrainTex.repeat.set(140, 140);
    if (dec.outside === 'docks') {
      // muelle de hormigón bajo el mapa y mar alrededor
      add('factory', B(-map.half.x - 6, -1.6, -map.half.z - 6, map.half.x + 6, -0.02, map.half.z + 6));
      const wt = waveTex(); wt.repeat.set(60, 60);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: wt, color: '#5d8fae', specular: '#ffffff', shininess: 60 }));
      water.position.y = -1.1;
      group.add(water);
      this.anim.push(dt => { wt.offset.x += dt * 0.004; wt.offset.y += dt * 0.002; });
    } else {
      const terrain = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), L({ map: terrainTex }));
      terrain.position.y = -0.03;
      terrain.receiveShadow = shadows;
      group.add(terrain);
    }

    // ---------- cajas del mapa ----------
    const top = new Float32Array(W * H);
    for (const b of map.boxes) {
      const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      if (b.kind === 'swing') {
        add('woodpanel', B(b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]));
        continue;
      }
      if (b.kind === '#' || b.kind === '%') {
        const x0 = Math.round(b.min[0] / C + W / 2), x1 = Math.round(b.max[0] / C + W / 2), z0 = Math.round(b.min[2] / C + H / 2), z1 = Math.round(b.max[2] / C + H / 2);
        for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) top[z * W + x] = b.max[1];
      }
      let key = b.mat, scale = 0;
      if (['wall', 'wall2', 'ceiling', 'lowwall', 'step', 'platform'].includes(b.mat)) scale = 3;
      if (b.mat === 'container') key = 'container' + (b.seed % CONTAINER_COLORS.length);
      if (b.mat === 'crate' && h > 1.5) {
        add('crate', boxGeo(w, h / 2, d, 0).translate(cx, b.min[1] + h / 4, cz));
        add('crate', boxGeo(w * 0.94, h / 2, d * 0.94, 0).translate(cx, b.min[1] + h * 0.75, cz));
        continue;
      }
      if (b.mat === 'barrel') {
        // barriles redondos en lugar de cubos
        const n = Math.max(1, Math.round(w / C)) * Math.max(1, Math.round(d / C));
        for (let i = 0; i < n * 2; i++) {
          const bx = b.min[0] + 0.5 + hash(i, b.seed) * (w - 1), bz = b.min[2] + 0.5 + hash(b.seed, i) * (d - 1);
          add('barrel', new THREE.CylinderGeometry(0.42, 0.42, h, 14).translate(bx, h / 2, bz));
        }
        continue;
      }
      add(key, boxGeo(w, h, d, scale).translate(cx, cy, cz));
      if (b.kind === 'l' || b.kind === 'w') {
        add('cap', B(b.min[0] - 0.06, b.max[1], b.min[2] - 0.06, b.max[0] + 0.06, b.max[1] + 0.12, b.max[2] + 0.06));
        if (b.kind === 'l' && dec.fence) add('fence', B(cx - w / 2, b.max[1] + 0.12, cz - d / 2, cx + w / 2, b.max[1] + 2.4, cz + d / 2).scale(1, 1, 1));
      }
      if (b.mat === 'ceiling') {
        for (let x = b.min[0] + 3; x < b.max[0] - 1; x += 6) for (let z = b.min[2] + 3; z < b.max[2] - 1; z += 6) {
          add('lamp', new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(x, b.min[1] - 0.03, z));
        }
        // borde de la losa visible desde arriba
        add('cap', B(b.min[0], b.max[1], b.min[2], b.max[0], b.max[1] + 0.06, b.min[2] + 0.2));
      }
    }

    // ---------- fachadas: detalles en las caras visibles de los edificios ----------
    const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const F = (cx, cz, side, u0, u1, y0, y1, d0, d1) => {
      const X0 = map.toX(cx), Z0 = map.toZ(cz);
      if (side === 0) return B(X0 + C + d0, y0, Z0 + u0, X0 + C + d1, y1, Z0 + u1);
      if (side === 1) return B(X0 - d1, y0, Z0 + u0, X0 - d0, y1, Z0 + u1);
      if (side === 2) return B(X0 + u0, y0, Z0 + C + d0, X0 + u1, y1, Z0 + C + d1);
      return B(X0 + u0, y0, Z0 - d1, X0 + u1, y1, Z0 - d0);
    };
    const facePos = (cx, cz, side, u, d, y) => {
      const X0 = map.toX(cx), Z0 = map.toZ(cz);
      if (side === 0) return [X0 + C + d, y, Z0 + u];
      if (side === 1) return [X0 - d, y, Z0 + u];
      if (side === 2) return [X0 + u, y, Z0 + C + d];
      return [X0 + u, y, Z0 - d];
    };
    const detail = this.quality !== 'baja';
    for (let z = 0; z < H && detail; z++) for (let x = 0; x < W; x++) {
      if (!isB(at(x, z))) continue;
      const t = top[z * W + x] || map.wallH;
      for (let side = 0; side < 4; side++) {
        const [dx, dz] = SIDES[side];
        const n = at(x + dx, z + dz);
        if (n === null || isB(n)) continue;
        const wh = map.walkHeight(x + dx, z + dz);
        const ground = wh !== null && !'PDv'.includes(n);
        const base = wh || 0;
        const r = k => hash(x, z, side * 13 + k);
        add('trim', F(x, z, side, 0, C, base, base + 0.45, 0, 0.05));
        add('cap', F(x, z, side, -0.08, C + 0.08, t - 0.32, t, 0, 0.14));
        if (n === ' ' || n === 'l' || !ground) {
          // fachadas que dan al exterior: ventanas altas
          if (t >= 6 && r(1) < dec.windows + 0.15) {
            const wy = Math.min(t - 2.3, 4.3);
            add('glass', F(x, z, side, 0.55, 1.45, wy, wy + 1.35, 0, 0.02));
            add('frame', F(x, z, side, 0.45, 0.55, wy - 0.05, wy + 1.45, 0, 0.09));
            add('frame', F(x, z, side, 1.45, 1.55, wy - 0.05, wy + 1.45, 0, 0.09));
            add('frame', F(x, z, side, 0.45, 1.55, wy + 1.35, wy + 1.45, 0, 0.09));
            add('frame', F(x, z, side, 0.35, 1.65, wy - 0.12, wy, 0, 0.18));
          }
          continue;
        }
        if (t >= 6 && r(1) < dec.windows) {
          const wy = Math.min(t - 2.3, base + 4.1);
          add('glass', F(x, z, side, 0.55, 1.45, wy, wy + 1.35, 0, 0.02));
          add('frame', F(x, z, side, 0.45, 0.55, wy - 0.05, wy + 1.45, 0, 0.09));
          add('frame', F(x, z, side, 1.45, 1.55, wy - 0.05, wy + 1.45, 0, 0.09));
          add('frame', F(x, z, side, 0.45, 1.55, wy + 1.35, wy + 1.45, 0, 0.09));
          add('frame', F(x, z, side, 0.35, 1.65, wy - 0.12, wy, 0, 0.18));
          if (map.theme === 'desert' || map.theme === 'village') {
            add('shutter', F(x, z, side, 0.08, 0.44, wy, wy + 1.35, 0, 0.05));
            add('shutter', F(x, z, side, 1.56, 1.92, wy, wy + 1.35, 0, 0.05));
          }
          if (map.theme === 'village' && r(9) < 0.4) {
            // macetero con flores bajo la ventana
            add('frame', F(x, z, side, 0.5, 1.5, wy - 0.42, wy - 0.12, 0, 0.3));
            add('leaf', F(x, z, side, 0.45, 1.55, wy - 0.15, wy + 0.2, 0.02, 0.32));
          }
        }
        if (base === 0 && r(2) < 0.08) {
          // puerta (decorativa) con marco y farol
          add(dec.doorWood ? 'doorWood' : 'metal', F(x, z, side, 0.5, 1.5, 0, 2.3, 0, 0.05));
          add('frame', F(x, z, side, 0.4, 0.5, 0, 2.45, 0, 0.1));
          add('frame', F(x, z, side, 1.5, 1.6, 0, 2.45, 0, 0.1));
          add('frame', F(x, z, side, 0.4, 1.6, 2.35, 2.45, 0, 0.1));
          add('lamp', F(x, z, side, 0.92, 1.08, 2.6, 2.85, 0, 0.18));
          if (dec.awning.length && map.theme !== 'temple' && r(3) < 0.6) add('awning' + ((r(4) * dec.awning.length) | 0), F(x, z, side, 0.2, 1.8, 2.75, 2.85, 0, 0.9));
        } else if (base === 0 && r(5) < 0.05) {
          add('poster' + ((r(6) * 3) | 0), F(x, z, side, 0.4, 1.6, 1.4, 2.5, 0, 0.02));
        }
        if (r(7) < 0.06) {
          const [px, , pz] = facePos(x, z, side, 1.85, 0.12, 0);
          add('metal', new THREE.CylinderGeometry(0.06, 0.06, t - 0.3, 8).translate(px, (t - 0.3) / 2, pz));
        }
        if ((map.theme === 'industrial' || map.theme === 'docks') && r(8) < 0.08) {
          add('metal', F(x, z, side, 0.6, 1.4, base + 3.0, base + 3.6, 0, 0.45));
          add('dark', F(x, z, side, 0.7, 1.3, base + 3.1, base + 3.5, 0.45, 0.47));
        }
        if (r(10) < 0.04 && ground) {
          add('dark', F(x, z, side, 0.95, 1.05, 2.9, 3.1, 0, 0.35));
          add('lamp', F(x, z, side, 0.85, 1.15, 2.75, 2.92, 0.28, 0.45));
        }
        if (dec.vines && r(11) < 0.14) add('leaf', F(x, z, side, 0.1, 1.9, base + 0.3, Math.min(t - 0.6, base + 3 + r(12) * 3), 0.02, 0.05));
      }
    }

    // ---------- tejados ----------
    const rr = mulberry32(map.w * 1000 + map.h);
    for (const b of map.boxes) {
      if (b.kind !== '#' && b.kind !== '%') continue;
      const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2], t = b.max[1];
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      if (w * d < 12) continue;
      if (dec.roof === 'gable' && w <= 24 && d <= 24) {
        // tejado a dos aguas de teja
        const along = w >= d;
        const span = (along ? d : w) + 0.6, len = (along ? w : d) + 0.6, rise = Math.min(3, span * 0.35);
        const shape = new THREE.Shape();
        shape.moveTo(-span / 2, 0); shape.lineTo(span / 2, 0); shape.lineTo(0, rise); shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
        g.translate(0, 0, -len / 2);
        if (along) g.rotateY(Math.PI / 2);
        g.translate(cx, t, cz);
        add('roofTiles', g);
        continue;
      }
      // pretil alrededor de la azotea
      const pt = 0.25, ph = 0.55;
      add('cap', B(b.min[0], t, b.min[2], b.max[0], t + ph, b.min[2] + pt));
      add('cap', B(b.min[0], t, b.max[2] - pt, b.max[0], t + ph, b.max[2]));
      add('cap', B(b.min[0], t, b.min[2], b.min[0] + pt, t + ph, b.max[2]));
      add('cap', B(b.max[0] - pt, t, b.min[2], b.max[0], t + ph, b.max[2]));
      const n = Math.min(4, Math.floor(w * d / 60));
      for (let i = 0; i < n; i++) {
        const px = b.min[0] + 1.5 + rr() * (w - 3), pz = b.min[2] + 1.5 + rr() * (d - 3);
        const kind = rr();
        if (map.theme === 'desert' && kind < 0.3 && w > 6 && d > 6) {
          add('dome', new THREE.SphereGeometry(Math.min(w, d) * 0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx, t, cz));
        } else if (kind < 0.55) {
          add('tank', new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14).translate(px, t + 1.35, pz));
          for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) add('metal', B(px + ox - 0.05, t, pz + oz - 0.05, px + ox + 0.05, t + 0.6, pz + oz + 0.05));
        } else if (kind < 0.8) {
          add('metal', B(px - 0.6, t, pz - 0.45, px + 0.6, t + 0.8, pz + 0.45));
          add('dark', B(px - 0.4, t + 0.8, pz - 0.3, px + 0.4, t + 0.84, pz + 0.3));
        } else {
          add('metal', new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6).translate(px, t + 1.75, pz));
          add('metal', B(px - 0.6, t + 3.0, pz - 0.02, px + 0.6, t + 3.04, pz + 0.02));
        }
      }
    }

    // ---------- barandillas en plataformas elevadas ----------
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const h0 = map.walkHeight(x, z);
      if (h0 === null || h0 < 1.5) continue;
      for (let side = 0; side < 4; side++) {
        const [dx, dz] = SIDES[side];
        const n = at(x + dx, z + dz);
        if (n === null || isB(n)) continue;
        const h1 = map.walkHeight(x + dx, z + dz);
        if (h1 !== null && h0 - h1 < 1.0) continue;
        if (h1 === null && SOLID_TOP(n) >= h0 - 0.1) continue;
        for (const u of [0.08, 1.0, 1.92]) add('metal', F(x, z, side, u - 0.04, u + 0.04, h0, h0 + 1.0, -0.12, -0.04));
        add('metal', F(x, z, side, 0, C, h0 + 0.95, h0 + 1.02, -0.13, -0.03));
        add('metal', F(x, z, side, 0, C, h0 + 0.48, h0 + 0.52, -0.11, -0.05));
      }
    }

    // ---------- ventanas: parteluz y marco ----------
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      if (at(x, z) !== 'v') continue;
      const x0 = map.toX(x), z0 = map.toZ(z);
      const alongX = isB(at(x - 1, z)) || at(x - 1, z) === 'v' || isB(at(x + 1, z)) || at(x + 1, z) === 'v';
      if (alongX) {
        add('frame', B(x0 + 0.96, 1.1, z0, x0 + 1.04, 2.5, z0 + C));
        add('frame', B(x0, 1.8, z0 + 0.9, x0 + C, 1.86, z0 + 1.1));
      } else {
        add('frame', B(x0, 1.1, z0 + 0.96, x0 + C, 2.5, z0 + 1.04));
        add('frame', B(x0 + 0.9, 1.8, z0, x0 + 1.1, 1.86, z0 + C));
      }
    }

    // ---------- puertas dobles: marco grueso tipo Dust 2 ----------
    for (const sd of map.swingDoors) {
      const t = 0.3;
      if (sd.alongX) {
        add('frame', B(sd.x0 - t, 0, sd.z0, sd.x0, 3.3, sd.z1));
        add('frame', B(sd.x1, 0, sd.z0, sd.x1 + t, 3.3, sd.z1));
      } else {
        add('frame', B(sd.x0, 0, sd.z0 - t, sd.x1, 3.3, sd.z0));
        add('frame', B(sd.x0, 0, sd.z1, sd.x1, 3.3, sd.z1 + t));
      }
      // bandas metálicas en las hojas
      for (const p of sd.panels) for (const y of [0.5, 1.6, 2.7]) add('dark', B(p.min[0] - 0.01, y, p.min[2] - 0.01, p.max[0] + 0.01, y + 0.12, p.max[2] + 0.01));
    }

    // ---------- exterior ----------
    if (detail) this.buildScenery(map, dec, add, B, mats, rr);

    for (const key in buckets) {
      if (!mats[key]) continue;
      const geo = mergeGeometries(buckets[key].map(g => (g.index ? g.toNonIndexed() : g)), false);
      buckets[key].forEach(g => g.dispose());
      const m = new THREE.Mesh(geo, mats[key]);
      const big = key === 'mountain' || key === 'hills' || key === 'terrain2';
      m.castShadow = shadows && !['lamp', 'glass', 'leaf', 'fence'].includes(key) && !big;
      m.receiveShadow = shadows && !big;
      group.add(m);
    }

    // ---------- puertas correderas (dinámicas) ----------
    const doorMat = map.theme === 'industrial' || map.theme === 'docks' ? L({ map: TEX.hazard('#5c6670') })
      : map.theme === 'temple' ? L({ map: tex.wall }) : L({ map: TEX.doorWood() });
    for (const d of map.doors) {
      const w = d.max[0] - d.min[0], h = d.max[1] - d.min[1], dd = d.max[2] - d.min[2];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), doorMat);
      mesh.position.set((d.min[0] + d.max[0]) / 2, h / 2, (d.min[2] + d.max[2]) / 2);
      mesh.castShadow = mesh.receiveShadow = shadows;
      mesh.userData.base = mesh.position.clone();
      group.add(mesh);
      // raíl superior
      const rail = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 0 ? w * 2 : 0.3, 0.12, d.axis === 2 ? dd * 2 : 0.3), mats.dark);
      rail.position.set(mesh.position.x + (d.axis === 0 ? d.dir * w / 2 : 0), d.max[1] + 0.06, mesh.position.z + (d.axis === 2 ? d.dir * dd / 2 : 0));
      group.add(rail);
      this.doorMeshes.push({ mesh, d });
    }

    // luces en túneles
    if (this.quality === 'alta') {
      let n = 0;
      for (const b of map.boxes) {
        if (b.mat !== 'ceiling' || n > 6) continue;
        const l = new THREE.PointLight('#ffd9a0', 6, 12, 2);
        l.position.set((b.min[0] + b.max[0]) / 2, b.min[1] - 0.4, (b.min[2] + b.max[2]) / 2);
        group.add(l);
        n++;
      }
    }

    for (const k in map.sites) {
      const s = map.sites[k];
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: letterTex(k), transparent: true, depthWrite: false }));
      mark.position.set(s.cx, 0.02, s.cz);
      group.add(mark);
    }

    scene.add(group);
    const span = Math.max(map.half.x, map.half.z) + 10;
    const sc = this.sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.updateProjectionMatrix();
  }

  buildScenery(map, dec, add, B, mats, rr) {
    const hx = map.half.x, hz = map.half.z;
    const inMap = (x, z, m = 4) => Math.abs(x) < hx + m && Math.abs(z) < hz + m;
    const ring = (r0, r1) => {
      for (let i = 0; i < 40; i++) {
        const a = rr() * Math.PI * 2, r = r0 + rr() * (r1 - r0);
        const x = Math.cos(a) * r * (hx / Math.max(hx, hz)) + Math.cos(a) * 0, z = Math.sin(a) * r;
        if (!inMap(x, z)) return [x, z];
      }
      return [hx + r0, 0];
    };
    // celdas exteriores dentro de la cuadrícula: pequeños detalles junto a los muros bajos
    const smallProp = (x, z) => {
      const k = rr();
      if (dec.outside === 'docks') { if (k < 0.15) add('metal', new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8).translate(x, 0.35, z)); return; }
      if (k < 0.12 && (dec.outside === 'desert' || dec.outside === 'village' || dec.outside === 'temple')) this.tree(add, x, z, 0.6 + rr() * 0.5, dec.outside, rr);
      else if (k < 0.25) add('rock', new THREE.DodecahedronGeometry(0.4 + rr() * 0.6, 0).translate(x, 0.2, z));
    };
    for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) if (map.grid[z][x] === ' ' && rr() < 0.35) smallProp(map.toX(x + 0.5), map.toZ(z + 0.5));

    const o = dec.outside;
    // árboles y vegetación cercanos
    const nTrees = o === 'industrial' || o === 'docks' ? 0 : o === 'temple' ? 90 : 55;
    for (let i = 0; i < nTrees; i++) { const [x, z] = ring(8, 120); this.tree(add, x, z, 0.8 + rr() * 0.8, o, rr); }
    // montañas / colinas lejanas
    for (let i = 0; i < 26; i++) {
      const [x, z] = ring(360, 520);
      const r = 60 + rr() * 90, h = 40 + rr() * 90;
      add(o === 'village' || o === 'temple' ? 'hills' : 'mountain', new THREE.ConeGeometry(r, h, 7).translate(x, h / 2 - 2, z));
    }
    if (o === 'desert') {
      for (let i = 0; i < 40; i++) { const [x, z] = ring(20, 300); const r = 10 + rr() * 30; add('terrain2', new THREE.SphereGeometry(r, 12, 6).scale(1, 0.18, 0.7 + rr() * 0.6).translate(x, -1, z)); }
      for (let i = 0; i < 26; i++) {
        const [x, z] = ring(25, 160);
        const w = 6 + rr() * 10, d = 6 + rr() * 10, h = 5 + rr() * 9;
        add('wall', B(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2));
        add('cap', B(x - w / 2 - 0.1, h, z - d / 2 - 0.1, x + w / 2 + 0.1, h + 0.5, z + d / 2 + 0.1));
        if (rr() < 0.4) add('dome', new THREE.SphereGeometry(Math.min(w, d) * 0.35, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h + 0.5, z));
        if (rr() < 0.2) { add('wall2', B(x - 1, 0, z - 1, x + 1, h + 9, z + 1)); add('dome', new THREE.SphereGeometry(1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h + 9, z)); }
      }
    } else if (o === 'industrial') {
      for (let i = 0; i < 22; i++) {
        const [x, z] = ring(25, 180);
        const w = 14 + rr() * 26, d = 14 + rr() * 26, h = 8 + rr() * 16;
        add('factory', B(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2));
        for (let k = 0; k < 3; k++) add('metal', B(x - w / 2 + k * w / 3, h, z - d / 2, x - w / 2 + (k + 0.5) * w / 3, h + 2.5, z + d / 2));
      }
      for (let i = 0; i < 6; i++) {
        const [x, z] = ring(60, 200);
        const h = 35 + rr() * 25;
        add('brick', new THREE.CylinderGeometry(1.6, 2.4, h, 12).translate(x, h / 2, z));
        this.smokeColumn(x, h, z);
      }
      for (let i = 0; i < 10; i++) { const [x, z] = ring(20, 120); add('tank', new THREE.CylinderGeometry(5, 5, 9, 18).translate(x, 4.5, z)); }
    } else if (o === 'village') {
      for (let i = 0; i < 34; i++) {
        const [x, z] = ring(15, 170);
        const w = 6 + rr() * 6, d = 6 + rr() * 6, h = 4 + rr() * 4;
        add('plaster', B(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2));
        const shape = new THREE.Shape();
        shape.moveTo(-d / 2 - 0.4, 0); shape.lineTo(d / 2 + 0.4, 0); shape.lineTo(0, 2.4); shape.closePath();
        add('roofTiles', new THREE.ExtrudeGeometry(shape, { depth: w + 0.8, bevelEnabled: false }).translate(0, 0, -(w + 0.8) / 2).rotateY(Math.PI / 2).translate(x, h, z));
      }
      const [tx, tz] = ring(40, 80);
      add('plaster', B(tx - 3, 0, tz - 3, tx + 3, 22, tz + 3));
      add('roofTiles', new THREE.ConeGeometry(4.6, 7, 4).rotateY(Math.PI / 4).translate(tx, 25.5, tz));
      for (let i = 0; i < 40; i++) { const [x, z] = ring(10, 150); const h = 8 + rr() * 6; add('cypress', new THREE.ConeGeometry(1.2, h, 8).translate(x, h / 2 + 0.5, z)); add('trunk', new THREE.CylinderGeometry(0.2, 0.25, 1, 6).translate(x, 0.5, z)); }
    } else if (o === 'docks') {
      for (let i = 0; i < 9; i++) {
        const [x, z] = ring(40, 260);
        const l = 40 + rr() * 50, w = 10 + rr() * 6, a = rr() * Math.PI;
        const hull = new THREE.BoxGeometry(l, 6, w).rotateY(a).translate(x, 1.5, z);
        add(rr() < 0.5 ? 'hull' : 'hullRed', hull);
        add('plaster', new THREE.BoxGeometry(8, 7, w * 0.8).translate(l * 0.3, 0, 0).rotateY(a).translate(x, 8, z));
        for (let k = 0; k < 4; k++) add('container' + (k % CONTAINER_COLORS.length), new THREE.BoxGeometry(6, 2.6, 2.4).translate(-l * 0.25 + k * 6.5, 0, 0).rotateY(a).translate(x, 5.8, z));
      }
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (hx + 8), z = -hz * 0.6 + (i >> 1) * hz * 1.2;
        for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) add('crane', B(x + ox - 0.4, -1.5, z + oz - 0.4, x + ox + 0.4, 22, z + oz + 0.4));
        add('crane', B(x - 3.5, 22, z - 3.5, x + 3.5, 24, z + 3.5));
        add('crane', B(x - side * 2, 24, z - 1, x + side * 40, 25.5, z + 1));
        add('dark', B(x + side * 30 - 0.05, 8, z - 0.05, x + side * 30 + 0.05, 24, z + 0.05));
      }
      const [lx, lz] = ring(200, 260);
      add('plaster', new THREE.CylinderGeometry(2, 3, 26, 12).translate(lx, 13, lz));
      add('hullRed', new THREE.CylinderGeometry(2.2, 2.2, 3, 12).translate(lx, 27, lz));
    } else if (o === 'temple') {
      for (let i = 0; i < 30; i++) { const [x, z] = ring(10, 140); add('rock', new THREE.DodecahedronGeometry(1 + rr() * 3, 0).translate(x, 0.5, z)); }
      for (let i = 0; i < 16; i++) {
        const [x, z] = ring(15, 90);
        const h = 2 + rr() * 6;
        add('wall', new THREE.CylinderGeometry(0.8, 0.9, h, 10).translate(x, h / 2, z));
      }
      for (let i = 0; i < 3; i++) {
        const [x, z] = ring(70, 160);
        for (let k = 0; k < 5; k++) { const s = 30 - k * 6; add('wall2', B(x - s / 2, k * 5, z - s / 2, x + s / 2, k * 5 + 5, z + s / 2)); }
      }
    }
  }

  tree(add, x, z, s, kind, rr) {
    if (kind === 'desert' || kind === 'village' && rr() < 0.3) {
      // palmera
      const h = 6 * s;
      let px = x, pz = z;
      const lean = [rr() - 0.5, rr() - 0.5];
      for (let k = 0; k < 4; k++) {
        const nx = px + lean[0] * 0.6 * s, nz = pz + lean[1] * 0.6 * s;
        add('trunk', new THREE.CylinderGeometry(0.16 * s, 0.22 * s, h / 4, 7).translate((px + nx) / 2, h / 8 + k * h / 4, (pz + nz) / 2));
        px = nx; pz = nz;
      }
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + rr();
        const leaf = new THREE.BoxGeometry(0.7 * s, 0.04, 3.2 * s).translate(0, 0, 1.5 * s).rotateX(0.45).rotateY(a).translate(px, h, pz);
        add('leaf', leaf);
      }
      return;
    }
    // árbol frondoso
    const h = 3 * s;
    add('trunk', new THREE.CylinderGeometry(0.18 * s, 0.28 * s, h, 7).translate(x, h / 2, z));
    for (let k = 0; k < 3; k++) {
      const r = (1.4 + rr() * 0.8) * s;
      add('foliage', new THREE.IcosahedronGeometry(r, 0).translate(x + (rr() - 0.5) * s, h + k * 0.9 * s, z + (rr() - 0.5) * s));
    }
  }

  smokeColumn(x, h, z) {
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(200,200,200,.7)'); gr.addColorStop(1, 'rgba(200,200,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const puffs = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: '#9a9a9a' }));
      s.userData.t = i / 8;
      this.group.add(s);
      puffs.push(s);
    }
    this.anim.push(dt => {
      for (const s of puffs) {
        s.userData.t = (s.userData.t + dt * 0.05) % 1;
        const k = s.userData.t;
        s.position.set(x + k * 14, h + k * 30, z + k * 6);
        s.scale.setScalar(4 + k * 18);
        s.material.opacity = 0.6 * (1 - k);
      }
    });
  }

  setDoors(open) {
    for (const { mesh, d } of this.doorMeshes) {
      const off = d.len * 0.92 * (open[d.id] || 0) * d.dir;
      mesh.position.copy(mesh.userData.base);
      if (d.axis === 0) mesh.position.x += off; else mesh.position.z += off;
    }
  }

  update(dt) {
    for (const f of this.anim) f(dt);
  }
}

// Altura aproximada de un sólido de celda (para no poner barandillas contra cajas altas).
function SOLID_TOP(ch) {
  return { c: 1, C: 2, K: 2.6, w: 1.3, b: 1.2, l: 1.4, v: 1.1 }[ch] ?? 0;
}
