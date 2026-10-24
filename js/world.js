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

const THEMES = {
  desert: {
    sky: ['#5b95d6', '#e7dccb'], fog: ['#d3d9dc', 70, 260], sun: ['#fff0d6', 2.5], hemi: ['#cfe3ff', '#a07c4c', 1.15], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#cda66a', '#7d5f36'), wall2: TEX.plaster('#dcc9a0', '#b89a6a'), floor: TEX.sand(), ceiling: TEX.wood('#7a5530'), step: TEX.blocks('#bfa070', '#7d5f36', 2), lowwall: TEX.blocks('#c49c62', '#7d5f36', 2) }),
    floorScale: 8, cap: '#a8875a',
  },
  industrial: {
    sky: ['#6f7f92', '#c4c9cf'], fog: ['#b6bcc2', 50, 200], sun: ['#f2f4ff', 1.9], hemi: ['#dfe6f2', '#5a5a5a', 1.25], exposure: 1.1,
    tex: () => ({ wall: TEX.concrete('#8c8f93'), wall2: TEX.corrugated('#7f8a93'), floor: TEX.tiles('#6f7174', '#4c4e51', 2), ceiling: TEX.corrugated('#5b6066'), step: TEX.concrete('#7a7d80', false), lowwall: TEX.concrete('#99702c', false) }),
    floorScale: 8, cap: '#5e6267',
  },
  village: {
    sky: ['#6aa6e0', '#f2e6d2'], fog: ['#e3dccf', 70, 250], sun: ['#fff4e0', 2.6], hemi: ['#e5efff', '#b59a7a', 1.1], exposure: 1.0,
    tex: () => ({ wall: TEX.plaster('#ebe5d8', '#a8916d'), wall2: TEX.plaster('#e0d2b4', '#9b7c58'), floor: TEX.cobble('#b5ab98'), ceiling: TEX.wood('#6b4a2e'), step: TEX.blocks('#c4b59a', '#857256', 2), lowwall: TEX.blocks('#d6cbb4', '#857256', 2) }),
    floorScale: 8, cap: '#b0573a',
  },
  docks: {
    sky: ['#7f97ad', '#d4d6d4'], fog: ['#bfc6cb', 55, 220], sun: ['#fff6ea', 2.0], hemi: ['#d6e2ee', '#5d5650', 1.2], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#8b5a45', '#4a3026', 6), wall2: TEX.concrete('#8d9196'), floor: TEX.asphalt('#55585c'), ceiling: TEX.corrugated('#6a6f75'), step: TEX.concrete('#808487', false), lowwall: TEX.concrete('#7c8084', false) }),
    floorScale: 10, cap: '#4d5257',
  },
  temple: {
    sky: ['#5c9cbc', '#dbe5d6'], fog: ['#c9d2c5', 60, 230], sun: ['#fff3da', 2.3], hemi: ['#e2f0ea', '#6f6a55', 1.2], exposure: 1.05,
    tex: () => ({ wall: TEX.blocks('#a19c88', '#5f5b4b', 3), wall2: TEX.blocks('#b3ad97', '#6b6654', 3), floor: TEX.tiles('#b8b29e', '#7d7765', 4), ceiling: TEX.blocks('#7d7865', '#4a473d', 2), step: TEX.blocks('#a9a38d', '#6b6654', 2), lowwall: TEX.blocks('#9c977f', '#5f5b4b', 2) }),
    floorScale: 8, cap: '#8a8470',
  },
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

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = null;
    const shadows = quality !== 'baja';
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#a07c4c', 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.4);
    this.sun.position.set(45, 90, 30);
    if (shadows) {
      this.sun.castShadow = true;
      const size = quality === 'alta' ? 4096 : 2048;
      this.sun.shadow.mapSize.set(size, size);
      const sc = this.sun.shadow.camera;
      sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 10; sc.far = 240;
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 12), this.skyMat);
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
  }

  build(map, renderer) {
    this.dispose();
    this.map = map;
    const th = THEMES[map.theme] || THEMES.desert;
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
    const mats = {
      wall: new THREE.MeshLambertMaterial({ map: tex.wall }),
      wall2: new THREE.MeshLambertMaterial({ map: tex.wall2 }),
      ceiling: new THREE.MeshLambertMaterial({ map: tex.ceiling }),
      step: new THREE.MeshLambertMaterial({ map: tex.step }),
      lowwall: new THREE.MeshLambertMaterial({ map: tex.lowwall }),
      crate: new THREE.MeshLambertMaterial({ map: TEX.crate() }),
      barrel: new THREE.MeshLambertMaterial({ map: TEX.barrel() }),
      cap: new THREE.MeshLambertMaterial({ color: th.cap }),
      lamp: new THREE.MeshBasicMaterial({ color: '#ffe9b0' }),
    };
    CONTAINER_COLORS.forEach((c, i) => { mats['container' + i] = new THREE.MeshLambertMaterial({ map: TEX.container(c) }); });

    // suelo
    const fw = map.w * map.cell, fh = map.h * map.cell;
    const floorGeo = new THREE.PlaneGeometry(fw, fh).rotateX(-Math.PI / 2);
    const fuv = floorGeo.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * fw / th.floorScale, fuv.getY(i) * fh / th.floorScale);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: tex.floor }));
    floor.receiveShadow = shadows;
    group.add(floor);

    // cajas agrupadas por material y fusionadas
    const buckets = {};
    const add = (key, geo) => (buckets[key] ||= []).push(geo);
    for (const b of map.boxes) {
      const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      let key = b.mat, scale = 0;
      if (b.mat === 'wall' || b.mat === 'wall2' || b.mat === 'ceiling' || b.mat === 'lowwall' || b.mat === 'step') scale = 3;
      if (b.mat === 'container') key = 'container' + (b.seed % CONTAINER_COLORS.length);
      if (b.mat === 'crate' && h > 1.5) {
        // cajas apiladas: dos cubos con un leve giro visual
        add('crate', boxGeo(w, h / 2, d, 0).translate(cx, b.min[1] + h / 4, cz));
        add('crate', boxGeo(w * 0.94, h / 2, d * 0.94, 0).translate(cx, b.min[1] + h * 0.75, cz));
        continue;
      }
      add(key, boxGeo(w, h, d, scale).translate(cx, cy, cz));
      if ((b.mat === 'wall' || b.mat === 'wall2') && h > 4) add('cap', boxGeo(w + 0.16, 0.22, d + 0.16, 0).translate(cx, b.max[1] + 0.11, cz));
      if (b.mat === 'ceiling') {
        // lámparas bajo los techos
        for (let x = b.min[0] + 3; x < b.max[0] - 1; x += 6) for (let z = b.min[2] + 3; z < b.max[2] - 1; z += 6) {
          add('lamp', new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(x, b.min[1] - 0.03, z));
        }
      }
    }
    for (const key in buckets) {
      const geo = mergeGeometries(buckets[key], false);
      buckets[key].forEach(g => g.dispose());
      const m = new THREE.Mesh(geo, mats[key]);
      m.castShadow = shadows && key !== 'lamp';
      m.receiveShadow = shadows;
      group.add(m);
    }
    for (const k in mats) if (!buckets[k] && k !== 'cap') mats[k].dispose();

    // luces cálidas en túneles (pocas, para rendimiento)
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

    // marcas de los sitios de bomba
    for (const k in map.sites) {
      const s = map.sites[k];
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: letterTex(k), transparent: true, depthWrite: false }));
      mark.position.set(s.cx, 0.02, s.cz);
      group.add(mark);
    }

    scene.add(group);
    const span = Math.max(fw, fh) / 2 + 10;
    const sc = this.sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.updateProjectionMatrix();
  }
}
