// Construcción visual del mapa con texturas procedurales.
import * as THREE from 'three';
import { BOXES, SITES } from '../shared/map.js';

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

function speckle(g, s, n, colors, maxR = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = 0.08 + Math.random() * 0.18;
    const r = Math.random() * maxR + 0.5;
    g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
  g.globalAlpha = 1;
}

function sandstone(base, mortar) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, 5000, ['#000', '#fff', '#7a5a30'], 2.5);
    const rows = 4, bh = s / rows;
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
  });
}

function crateTex() {
  return canvasTex(256, (g, s) => {
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
  }, false);
}

function barrelTex() {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#7d2b22'; g.fillRect(0, 0, s, s);
    speckle(g, s, 1200, ['#000', '#c45a3a'], 3);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, s * 0.2, s, 8); g.fillRect(0, s * 0.75, s, 8);
  }, false);
}

function floorTex() {
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#cfae74'; g.fillRect(0, 0, s, s);
    speckle(g, s, 18000, ['#000', '#fff', '#8a6a3a', '#e8cc94'], 3);
    g.strokeStyle = 'rgba(90,64,30,.28)'; g.lineWidth = 3;
    const n = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s / n, 0); g.lineTo(i * s / n, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / n); g.lineTo(s, i * s / n); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 60},${90 + Math.random() * 40},50,.10)`;
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill();
    }
  });
}

function letterTex(ch, color) {
  return canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.font = 'bold 200px Rajdhani, Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.globalAlpha = 0.75;
    g.fillText(ch, s / 2, s / 2 + 10);
  }, false);
}

function arrowTex(text) {
  return canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(30,30,30,.7)';
    g.font = 'bold 72px Rajdhani, Arial';
    g.textAlign = 'center';
    g.fillText(text, s / 2, s / 2);
    g.beginPath(); g.moveTo(s / 2 - 50, s / 2 + 30); g.lineTo(s / 2 + 50, s / 2 + 30); g.lineTo(s / 2 + 50, s / 2 + 15); g.lineTo(s / 2 + 80, s / 2 + 45); g.lineTo(s / 2 + 50, s / 2 + 75); g.lineTo(s / 2 + 50, s / 2 + 60); g.lineTo(s / 2 - 50, s / 2 + 60); g.fill();
  }, false);
}

// Ajusta las UV de una caja para que la textura se repita según su tamaño real.
function tileUVs(geo, w, h, d, scale) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * a / scale, uv.getY(i) * b / scale);
    }
  }
  uv.needsUpdate = true;
}

export function buildWorld(scene, quality) {
  const shadows = quality !== 'baja';
  scene.background = new THREE.Color('#9ec3e6');
  scene.fog = new THREE.Fog('#c9d6df', 70, 230);

  const hemi = new THREE.HemisphereLight('#cfe3ff', '#a07c4c', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d6', 2.4);
  sun.position.set(45, 90, 30);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality === 'alta' ? 4096 : 2048, quality === 'alta' ? 4096 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 10; sc.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Cielo con degradado
  const skyGeo = new THREE.SphereGeometry(400, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5b95d6') }, bottom: { value: new THREE.Color('#e7dccb') } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const tex = {
    wall: sandstone('#cda66a', '#7d5f36'),
    outer: sandstone('#b88f5a', '#6b4e2b'),
    crate: crateTex(),
    barrel: barrelTex(),
    floor: floorTex(),
  };
  const mats = {
    wall: new THREE.MeshLambertMaterial({ map: tex.wall }),
    outer: new THREE.MeshLambertMaterial({ map: tex.outer }),
    crate: new THREE.MeshLambertMaterial({ map: tex.crate }),
    barrel: new THREE.MeshLambertMaterial({ map: tex.barrel }),
  };

  const floorGeo = new THREE.PlaneGeometry(124, 124);
  floorGeo.rotateX(-Math.PI / 2);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 31, fuv.getY(i) * 31);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: tex.floor }));
  floor.receiveShadow = shadows;
  scene.add(floor);

  // Suelo exterior (más allá de los muros)
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#c8a46c' }));
  outside.position.y = -0.05;
  scene.add(outside);

  const meshes = [];
  for (const b of BOXES) {
    const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
    const geo = new THREE.BoxGeometry(w, h, d);
    if (b.mat === 'wall' || b.mat === 'outer') tileUVs(geo, w, h, d, 3);
    const m = new THREE.Mesh(geo, mats[b.mat] || mats.wall);
    m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    scene.add(m);
    meshes.push(m);
    // remate superior de los muros
    if (b.mat === 'wall' && h > 4) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2), new THREE.MeshLambertMaterial({ color: '#a8875a' }));
      cap.position.set(m.position.x, b.max[1] + 0.12, m.position.z);
      cap.castShadow = shadows;
      scene.add(cap);
    }
  }

  // Marcas de los sitios de bomba
  for (const k in SITES) {
    const s = SITES[k];
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: letterTex(k, '#b3261e'), transparent: true, depthWrite: false }));
    mark.position.set(s.cx, 0.02, s.cz);
    scene.add(mark);
    const zone = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(s.x2 - s.x1 - 2, 0.01, s.z2 - s.z1 - 2)),
      new THREE.LineBasicMaterial({ color: '#b3261e', transparent: true, opacity: 0.35 }));
    zone.position.set(s.cx, 0.03, (s.z1 + s.z2) / 2);
    scene.add(zone);
  }

  // Señales pintadas en muros
  const signs = [
    ['A', 0, 45, 3.2, 26.05, 0], ['B', 0, -47, 3.2, 26.05, 0],
    ['A ▸', 0, 7.95, 3, -10, -Math.PI / 2], ['◂ B', 0, -7.95, 3, 16, Math.PI / 2],
  ];
  for (const [txt, , x, y, z, rot] of signs) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({ map: arrowTex(txt), transparent: true, depthWrite: false }));
    plane.position.set(x, y, z);
    plane.rotation.y = rot;
    scene.add(plane);
  }

  return { sun, meshes };
}
