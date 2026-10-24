// Modelos de armas (perfiles extruidos + piezas torneadas, materiales PBR) y de jugadores.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WEAPONS } from '../shared/weapons.js';

const NADE_IDS = ['he', 'flash', 'smoke', 'molotov', 'incgrenade'];

// ---------- materiales compartidos ----------
function grainTex(base, dark) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = dark; g.globalAlpha = 0.15 + Math.random() * 0.25; g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); const x = Math.random() * 64; g.moveTo(x, 0); g.bezierCurveTo(x + 8, 80, x - 8, 170, x + 4, 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const M = {};
function mats() {
  if (M.ready) return M;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  Object.assign(M, {
    ready: true,
    gunmetal: S({ color: '#2a2c2f', metalness: 0.7, roughness: 0.42 }),
    steel: S({ color: '#a8adb3', metalness: 0.95, roughness: 0.25 }),
    polymer: S({ color: '#1b1c1e', metalness: 0.05, roughness: 0.75 }),
    tan: S({ color: '#8c7a5a', metalness: 0.05, roughness: 0.8 }),
    wood: S({ map: grainTex('#7a4320', '#3a1d0c'), metalness: 0, roughness: 0.55 }),
    green: S({ color: '#3d5a3a', metalness: 0.2, roughness: 0.6 }),
    olive: S({ color: '#4a5236', metalness: 0.1, roughness: 0.7 }),
    lens: S({ color: '#1a3a5a', metalness: 0.9, roughness: 0.05, emissive: '#06121e' }),
    brass: S({ color: '#b8913a', metalness: 0.9, roughness: 0.3 }),
    red: S({ color: '#8c2a20', metalness: 0.2, roughness: 0.6 }),
    nadeGreen: S({ color: '#465c37', metalness: 0.3, roughness: 0.6 }),
    nadeGray: S({ color: '#8f979e', metalness: 0.6, roughness: 0.4 }),
    nadeBlue: S({ color: '#5d7584', metalness: 0.5, roughness: 0.45 }),
    glassGreen: S({ color: '#3f6b3a', metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.75 }),
    cloth: S({ color: '#d8cbb0', roughness: 0.95 }),
    c4: S({ color: '#5d5134', roughness: 0.8 }),
    screen: S({ color: '#1e3a1e', emissive: '#2cff4a', emissiveIntensity: 0.6, roughness: 0.3 }),
  });
  return M;
}

// ---------- piezas ----------
// Extruye un perfil lateral: puntos [adelante, arriba] en metros; adelante = -Z del modelo.
function ext(points, depth, mat, x = 0, bevel = 0.004) {
  const shape = new THREE.Shape();
  points.forEach(([f, u], i) => (i ? shape.lineTo(f, u) : shape.moveTo(f, u)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  g.rotateY(Math.PI / 2); // x(adelante) -> -z
  const m = new THREE.Mesh(g, mat);
  m.position.x = x;
  return m;
}

// Cilindro a lo largo del eje "adelante" (de f0 a f1) a la altura u.
function tube(r, f0, f1, u, mat, seg = 14, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, f1 - f0, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, u, -(f0 + f1) / 2);
  return m;
}

function bx(w, h, d, f, u, mat, x = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, u, -f);
  return m;
}

// Mira telescópica torneada (lathe) entre f0 y f1.
function scope(f0, f1, u, r, mat, lensMat) {
  const len = f1 - f0;
  const pts = [
    [0, 0], [r * 1.35, 0], [r * 1.35, len * 0.16], [r, len * 0.3], [r, len * 0.7], [r * 1.25, len * 0.84], [r * 1.25, len], [0, len],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(pts, 18);
  g.rotateX(-Math.PI / 2);
  const grp = new THREE.Group();
  const body = new THREE.Mesh(g, mat);
  body.position.set(0, u, -f0);
  grp.add(body);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.2, 16), lensMat);
  lens.position.set(0, u, -f1 - 0.001);
  lens.rotation.y = Math.PI;
  grp.add(lens);
  const lens2 = lens.clone(); lens2.position.z = -f0 + 0.001; lens2.rotation.y = 0;
  grp.add(lens2);
  // torretas
  grp.add(tube(r * 0.45, -0.0001, 0.0001, u, mat));
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, r * 0.9, 10), mat);
  t1.position.set(0, u + r * 1.1, -(f0 + len * 0.5));
  grp.add(t1);
  // monturas
  grp.add(bx(r * 1.2, u - 0.075, 0.02, f0 + len * 0.3, 0.075 + (u - 0.075) / 2, mat));
  grp.add(bx(r * 1.2, u - 0.075, 0.02, f0 + len * 0.7, 0.075 + (u - 0.075) / 2, mat));
  return grp;
}

const grip = (mat, f = 0, depth = 0.034) => ext([[f - 0.025, 0.002], [f + 0.03, 0.002], [f + 0.005, -0.11], [f - 0.05, -0.105]], depth, mat);
const triggerGuard = (mat, f = 0.04) => ext([[f - 0.03, 0.0], [f + 0.035, 0.0], [f + 0.035, -0.008], [f + 0.01, -0.035], [f - 0.03, -0.035], [f - 0.03, -0.03], [f + 0.005, -0.028], [f + 0.025, -0.008], [f - 0.03, -0.006]], 0.01, mat, 0, 0.001);

export function weaponModelId(id) {
  if (id === 'nade' || id === 'c4') return id;
  if (NADE_IDS.includes(id)) return 'nade_' + id;
  return WEAPONS[id]?.model || 'knife';
}

// Arma orientada hacia -Z, empuñadura en el origen. Incluye un punto "muzzle".
export function createWeaponModel(id) {
  const m = mats();
  const model = weaponModelId(id);
  const w = WEAPONS[id];
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const add = (...o) => o.forEach(x => g.add(x));
  switch (model) {
    case 'knife': {
      const blade = ext([[0.04, 0.012], [0.2, 0.018], [0.245, 0.03], [0.2, 0.034], [0.06, 0.036], [0.04, 0.03]], 0.006, m.steel, 0, 0.0015);
      add(blade,
        ext([[-0.08, 0.012], [0.03, 0.014], [0.03, 0.036], [-0.08, 0.034], [-0.095, 0.024]], 0.024, m.polymer),
        bx(0.03, 0.05, 0.012, 0.036, 0.024, m.gunmetal));
      muzzle.position.set(0, 0.024, -0.25);
      break;
    }
    case 'pistol': case 'usp': case 'deagle': {
      const big = model === 'deagle';
      const L = big ? 0.27 : 0.19, Hs = big ? 0.045 : 0.036;
      add(ext([[-0.04, 0.03], [L - 0.03, 0.03], [L - 0.03, 0.03 + Hs], [-0.035, 0.03 + Hs], [-0.045, 0.045]], big ? 0.034 : 0.03, big ? m.steel : m.gunmetal),
        ext([[-0.03, 0.0], [L - 0.06, 0.0], [L - 0.06, 0.03], [-0.035, 0.03]], big ? 0.03 : 0.028, m.polymer),
        ext([[-0.035, 0.005], [0.015, 0.005], [-0.005, -0.1], [-0.06, -0.095]], big ? 0.034 : 0.03, m.polymer),
        triggerGuard(m.polymer, 0.02),
        bx(0.006, 0.01, 0.008, L - 0.04, 0.03 + Hs + 0.004, m.gunmetal),
        bx(0.02, 0.008, 0.008, 0.0, 0.03 + Hs + 0.004, m.gunmetal));
      if (big) add(tube(0.012, L - 0.03, L + 0.005, 0.045, m.steel));
      if (model === 'usp') { add(tube(0.017, L - 0.03, L + 0.12, 0.048, m.polymer, 16)); muzzle.position.set(0, 0.048, -(L + 0.13)); }
      else muzzle.position.set(0, 0.048, -(L + 0.01));
      break;
    }
    case 'smg': {
      add(ext([[-0.06, 0.0], [0.2, 0.0], [0.22, 0.03], [0.2, 0.075], [-0.06, 0.075]], 0.05, m.gunmetal),
        ext([[0.0, 0.005], [0.055, 0.005], [0.075, -0.22], [0.025, -0.225]], 0.034, m.polymer),
        ext([[0.13, 0.002], [0.18, 0.002], [0.17, -0.06], [0.135, -0.058]], 0.03, m.polymer),
        tube(0.012, 0.2, 0.3, 0.04, m.steel), tube(0.016, 0.28, 0.31, 0.04, m.gunmetal),
        bx(0.006, 0.012, 0.012, -0.24, 0.035, m.gunmetal, 0.018), bx(0.006, 0.012, 0.012, -0.24, 0.035, m.gunmetal, -0.018),
        bx(0.006, 0.012, 0.2, -0.16, 0.06, m.gunmetal, 0.018), bx(0.006, 0.012, 0.2, -0.16, 0.06, m.gunmetal, -0.018),
        bx(0.045, 0.06, 0.012, -0.26, 0.04, m.polymer),
        bx(0.025, 0.015, 0.16, 0.08, 0.085, m.polymer), triggerGuard(m.polymer, 0.035));
      muzzle.position.set(0, 0.04, -0.32);
      break;
    }
    case 'p90': {
      add(ext([[-0.15, 0.0], [-0.12, -0.06], [-0.04, -0.065], [-0.02, -0.02], [0.04, -0.02], [0.08, -0.06], [0.2, -0.05], [0.24, 0.0], [0.26, 0.05], [0.2, 0.09], [-0.12, 0.09], [-0.16, 0.05]], 0.06, m.polymer),
        bx(0.045, 0.02, 0.3, 0.06, 0.1, m.tan),
        tube(0.011, 0.24, 0.31, 0.03, m.steel), bx(0.03, 0.03, 0.05, 0.05, 0.12, m.gunmetal));
      muzzle.position.set(0, 0.03, -0.32);
      break;
    }
    case 'shotgun': {
      add(ext([[-0.05, 0.0], [0.2, 0.0], [0.2, 0.075], [-0.05, 0.075]], 0.05, m.gunmetal),
        ext([[-0.05, 0.065], [-0.05, 0.0], [-0.1, -0.02], [-0.4, -0.06], [-0.41, 0.02], [-0.37, 0.05], [-0.1, 0.07]], 0.042, w?.id === 'nova' ? m.polymer : m.wood),
        grip(m.polymer, -0.02), triggerGuard(m.polymer, 0.03),
        tube(0.016, 0.2, 0.68, 0.055, m.steel), tube(0.017, 0.2, 0.6, 0.02, m.gunmetal),
        tube(0.024, 0.32, 0.48, 0.02, m.polymer, 12), bx(0.008, 0.012, 0.01, 0.66, 0.075, m.steel));
      muzzle.position.set(0, 0.055, -0.69);
      break;
    }
    case 'ak': {
      add(ext([[-0.08, 0.0], [0.22, 0.0], [0.22, 0.075], [0.0, 0.085], [-0.06, 0.08], [-0.08, 0.06]], 0.046, m.gunmetal),
        ext([[-0.08, 0.06], [-0.08, 0.0], [-0.12, -0.012], [-0.43, -0.075], [-0.44, 0.0], [-0.41, 0.032], [-0.12, 0.066]], 0.04, m.wood),
        ext([[-0.025, 0.002], [0.03, 0.002], [0.005, -0.11], [-0.05, -0.105]], 0.034, m.wood),
        triggerGuard(m.gunmetal, 0.03),
        ext([[0.06, 0.002], [0.13, 0.002], [0.165, -0.08], [0.155, -0.2], [0.095, -0.225], [0.085, -0.13], [0.055, -0.035]], 0.034, m.gunmetal),
        ext([[0.22, 0.004], [0.43, 0.012], [0.43, 0.055], [0.22, 0.062]], 0.05, m.wood),
        ext([[0.22, 0.064], [0.41, 0.064], [0.41, 0.088], [0.22, 0.084]], 0.038, m.wood),
        tube(0.011, 0.41, 0.56, 0.075, m.gunmetal),
        tube(0.011, 0.43, 0.74, 0.035, m.gunmetal), tube(0.016, 0.72, 0.78, 0.035, m.gunmetal),
        bx(0.008, 0.055, 0.012, 0.64, 0.07, m.gunmetal), bx(0.03, 0.012, 0.03, 0.24, 0.088, m.gunmetal));
      muzzle.position.set(0, 0.035, -0.79);
      break;
    }
    case 'rifle': case 'rifle2': {
      const m4 = model === 'rifle2';
      const body = m4 ? m.polymer : m.gunmetal;
      add(ext([[-0.07, 0.02], [0.22, 0.02], [0.22, 0.085], [-0.07, 0.085]], 0.046, body),
        ext([[-0.05, -0.028], [0.13, -0.028], [0.15, 0.02], [-0.07, 0.02]], 0.044, m.gunmetal),
        bx(0.026, 0.014, 0.27, 0.07, 0.093, m.gunmetal),
        ext([[-0.07, 0.075], [-0.31, 0.065], [-0.32, -0.065], [-0.27, -0.068], [-0.25, -0.005], [-0.07, 0.02]], 0.04, m4 ? m.polymer : m.tan),
        tube(0.014, -0.25, -0.07, 0.05, m.gunmetal),
        ext([[-0.025, -0.025], [0.025, -0.025], [0.005, -0.13], [-0.045, -0.125]], 0.032, m.polymer),
        triggerGuard(m.gunmetal, 0.035),
        ext([[0.05, -0.025], [0.11, -0.025], [0.125, -0.2], [0.065, -0.205]], 0.03, m.gunmetal),
        bx(0.06, 0.06, 0.25, 0.345, 0.052, body),
        bx(0.012, 0.012, 0.25, 0.345, 0.088, m.gunmetal),
        tube(0.01, 0.47, 0.7, 0.05, m.gunmetal), tube(0.014, 0.68, 0.74, 0.05, m.steel),
        ext([[0.44, 0.05], [0.47, 0.05], [0.465, 0.11], [0.45, 0.11]], 0.01, m.gunmetal, 0, 0.001));
      if (w?.scope) add(scope(0.0, 0.16, 0.13, 0.018, m.gunmetal, m.lens));
      muzzle.position.set(0, 0.05, -0.75);
      break;
    }
    case 'sniper': case 'awp': {
      const awp = model === 'awp';
      const body = awp ? m.green : m.gunmetal;
      add(ext([[-0.05, 0.0], [0.26, 0.0], [0.28, 0.03], [0.26, 0.075], [-0.05, 0.075]], 0.05, body),
        awp
          ? ext([[-0.05, 0.07], [-0.05, 0.0], [-0.07, -0.02], [-0.09, -0.12], [-0.13, -0.12], [-0.13, -0.05], [-0.18, -0.03], [-0.45, -0.07], [-0.46, 0.05], [-0.4, 0.08]], 0.05, body)
          : ext([[-0.05, 0.07], [-0.05, 0.0], [-0.1, -0.015], [-0.42, -0.07], [-0.43, 0.03], [-0.38, 0.06]], 0.042, body),
        grip(awp ? body : m.polymer, -0.015), triggerGuard(m.gunmetal, 0.035),
        bx(0.034, 0.05, 0.07, 0.1, -0.02, m.gunmetal),
        tube(awp ? 0.016 : 0.012, 0.26, awp ? 0.85 : 0.78, 0.045, m.gunmetal), tube(awp ? 0.022 : 0.017, awp ? 0.8 : 0.74, awp ? 0.88 : 0.8, 0.045, m.gunmetal),
        scope(-0.02, awp ? 0.26 : 0.22, 0.125, awp ? 0.026 : 0.02, m.polymer, m.lens),
        tube(0.006, -0.015, 0.03, 0.06, m.steel));
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), m.steel);
      bolt.position.set(0.04, 0.055, 0.02);
      add(bolt, bx(0.04, 0.006, 0.006, -0.02, 0.055, m.steel, 0.02));
      muzzle.position.set(0, 0.045, awp ? -0.9 : -0.82);
      break;
    }
    case 'nade': case 'nade_he': {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), m.nadeGreen);
      s.scale.y = 1.15;
      add(s, tube(0.014, -0.012, 0.012, 0.05, m.steel), bx(0.008, 0.07, 0.014, 0.0, 0.02, m.steel, 0.035));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 6, 14), m.steel);
      ring.position.set(-0.02, 0.06, 0);
      add(ring);
      muzzle.position.set(0, 0, -0.05);
      break;
    }
    case 'nade_flash': case 'nade_smoke': case 'nade_incgrenade': {
      const mat = model === 'nade_flash' ? m.nadeGray : model === 'nade_smoke' ? m.nadeBlue : m.red;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.115, 18), mat);
      add(c, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.025, 12), m.steel));
      g.children[g.children.length - 1].position.y = 0.068;
      add(bx(0.008, 0.08, 0.014, 0.0, 0.03, m.steel, 0.032));
      for (const y of [-0.035, 0.035]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.008, 18), m.gunmetal); band.position.y = y; add(band); }
      muzzle.position.set(0, 0, -0.05);
      break;
    }
    case 'nade_molotov': {
      const pts = [[0, 0], [0.035, 0], [0.038, 0.01], [0.038, 0.08], [0.03, 0.1], [0.013, 0.12], [0.012, 0.16], [0, 0.16]].map(([a, b]) => new THREE.Vector2(a, b));
      const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), m.glassGreen);
      bottle.position.y = -0.06;
      const rag = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 7), m.cloth);
      rag.position.y = 0.12;
      add(bottle, rag);
      muzzle.position.set(0, 0.14, 0);
      break;
    }
    case 'c4': {
      add(bx(0.17, 0.055, 0.11, 0.03, 0, m.c4), bx(0.07, 0.012, 0.05, 0.03, 0.033, m.polymer, 0.035),
        bx(0.05, 0.004, 0.025, 0.04, 0.04, m.screen, 0.035));
      for (const x of [-0.05, -0.025, 0, 0.025]) add(bx(0.014, 0.07, 0.008, 0.03 + (x + 0.012) * 0, 0.0, m.red, x));
      muzzle.position.set(0, 0, -0.1);
      break;
    }
  }
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- jugadores en tercera persona ----------
const TEAM_COLORS = {
  T: { shirt: '#8a6b42', pants: '#4b3f2c', head: '#26221d', vest: '#5f5236', boots: '#2b241b', glove: '#3a3024' },
  CT: { shirt: '#2f4a6d', pants: '#25303e', head: '#2e3a2c', vest: '#1d2633', boots: '#16191d', glove: '#1e1f22' },
};
const SKIN = '#c49474';
const lam = new Map();
function lm(color) {
  if (!lam.has(color)) lam.set(color, new THREE.MeshLambertMaterial({ color }));
  return lam.get(color);
}
const rbox = (w, h, d, color, x = 0, y = 0, z = 0, r = 0.03) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), lm(color)); m.position.set(x, y, z); return m; };
const caps = (r, len, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), lm(color)); m.position.set(x, y, z); return m; };

export function createPlayerModel(team) {
  const c = TEAM_COLORS[team] || TEAM_COLORS.T;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.11, 0, 0); legR.position.set(0.11, 0, 0);
  for (const leg of [legL, legR]) {
    leg.add(caps(0.085, 0.36, c.pants, 0, -0.22, 0));
    leg.add(caps(0.075, 0.3, c.pants, 0, -0.6, 0.01));
    leg.add(rbox(0.15, 0.1, 0.26, c.boots, 0, -0.85, -0.04, 0.03));
    leg.add(rbox(0.16, 0.12, 0.13, c.vest, 0, -0.45, -0.07, 0.03));
    hips.add(leg);
  }
  hips.add(rbox(0.38, 0.16, 0.24, c.pants, 0, -0.02, 0, 0.04));
  const torso = new THREE.Group(); torso.position.y = 0.9; body.add(torso);
  torso.add(rbox(0.42, 0.56, 0.24, c.shirt, 0, 0.3, 0, 0.06));
  torso.add(rbox(0.46, 0.4, 0.3, c.vest, 0, 0.33, 0, 0.05));
  for (const x of [-0.12, 0, 0.12]) torso.add(rbox(0.09, 0.12, 0.05, c.vest, x, 0.26, -0.17, 0.015));
  if (team === 'T') torso.add(rbox(0.32, 0.36, 0.14, '#4a3f2a', 0, 0.36, 0.2, 0.04));
  else torso.add(rbox(0.3, 0.2, 0.08, '#2a3340', 0, 0.42, 0.18, 0.02));
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  head.add(caps(0.05, 0.06, SKIN, 0, -0.12, 0));
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), lm(SKIN));
  skull.scale.set(0.95, 1.08, 1.0);
  head.add(skull);
  if (team === 'CT') {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), lm(c.head));
    helmet.position.y = 0.02;
    head.add(helmet, rbox(0.2, 0.05, 0.03, '#111', 0, 0.0, -0.13, 0.01));
  } else {
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.137, 14, 12), lm(c.head));
    mask.scale.set(0.97, 1.1, 1.02);
    head.add(mask, rbox(0.17, 0.04, 0.02, SKIN, 0, 0.02, -0.135, 0.01));
  }
  const arms = new THREE.Group(); arms.position.set(0, 0.5, 0); torso.add(arms);
  const armR = new THREE.Group(); armR.position.set(0.22, 0, 0); armR.rotation.set(0, 0.25, 0);
  armR.add(caps(0.065, 0.3, c.shirt, 0, -0.04, -0.17).rotateX(Math.PI / 2));
  armR.add(rbox(0.09, 0.09, 0.1, c.glove, 0, -0.04, -0.37, 0.03));
  const armL = new THREE.Group(); armL.position.set(-0.2, 0, 0); armL.rotation.set(0, -0.5, 0);
  armL.add(caps(0.065, 0.36, c.shirt, 0, -0.04, -0.21).rotateX(Math.PI / 2));
  armL.add(rbox(0.09, 0.09, 0.1, c.glove, 0, -0.04, -0.42, 0.03));
  arms.add(armR, armL);
  const hand = new THREE.Group(); hand.position.set(0.1, -0.05, -0.38); arms.add(hand);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.userData = { body, hips, legL, legR, torso, head, arms, hand, weaponId: null, weapon: null, dead: 0 };
  return root;
}

export function setPlayerWeapon(model, id) {
  const u = model.userData;
  if (u.weaponId === id) return;
  if (u.weapon) u.hand.remove(u.weapon);
  u.weaponId = id;
  u.weapon = createWeaponModel(id);
  u.hand.add(u.weapon);
}

export function posePlayer(model, { crouch, pitch, walk, speed, deadT }) {
  const u = model.userData;
  const cr = crouch ? 1 : 0;
  u.cr = (u.cr ?? cr) + (cr - (u.cr ?? cr)) * 0.3;
  u.hips.position.y = 0.9 - u.cr * 0.4;
  u.torso.position.y = 0.9 - u.cr * 0.45;
  u.legL.rotation.x = -u.cr * 1.0;
  u.legR.rotation.x = -u.cr * 0.6;
  const sw = Math.min(1, speed / 5) * 0.6 * (1 - u.cr * 0.6);
  u.legL.rotation.x += Math.sin(walk) * sw;
  u.legR.rotation.x -= Math.sin(walk) * sw;
  u.torso.rotation.x = u.cr * 0.15;
  u.torso.rotation.y = Math.sin(walk) * sw * 0.08;
  u.arms.rotation.x = pitch * 0.9;
  u.head.rotation.x = pitch * 0.5;
  if (deadT > 0) {
    const k = Math.min(1, deadT / 0.45);
    u.body.rotation.x = -k * Math.PI / 2 * 0.98;
    u.body.position.y = 0.15 * k;
    u.body.position.z = 0.35 * k;
  } else {
    u.body.rotation.x = 0;
    u.body.position.set(0, 0, 0);
  }
}

// ---------- viewmodel en primera persona ----------
export function createViewModel(id, team) {
  const g = new THREE.Group();
  const gun = createWeaponModel(id);
  g.add(gun);
  const c = TEAM_COLORS[team] || TEAM_COLORS.T;
  const model = weaponModelId(id);
  const sleeve = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.9 });
  const glove = new THREE.MeshStandardMaterial({ color: c.glove, roughness: 0.7, metalness: 0.05 });
  const cuff = new THREE.MeshStandardMaterial({ color: c.vest, roughness: 0.8 });
  const two = !['knife', 'pistol', 'usp', 'deagle', 'c4'].includes(model) && !model.startsWith('nade');
  const armMesh = (len, r) => {
    const a = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), sleeve);
    fore.rotation.x = Math.PI / 2; fore.position.z = len / 2 + 0.05;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.035, 12), cuff);
    band.rotation.x = Math.PI / 2; band.position.z = 0.06;
    const hand = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.06, 0.085, 2, 0.02), glove);
    hand.position.z = -0.005;
    const fingers = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.05, 2, 0.012), glove);
    fingers.position.set(0.005, -0.025, -0.035);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 6), glove);
    thumb.position.set(-0.03, 0.01, -0.03); thumb.rotation.set(Math.PI / 2, 0, 0.5);
    a.add(fore, band, hand, fingers, thumb);
    return a;
  };
  const rArm = armMesh(0.26, 0.036);
  rArm.position.set(0.005, -0.035, 0.03);
  rArm.rotation.set(0.45, 0.12, 0);
  g.add(rArm);
  const lArm = armMesh(0.24, 0.033);
  if (two) {
    const f = model === 'ak' ? 0.32 : model === 'smg' || model === 'p90' ? 0.2 : model === 'shotgun' ? 0.4 : model === 'sniper' || model === 'awp' ? 0.36 : 0.33;
    lArm.position.set(-0.012, -0.012, -f);
    lArm.rotation.set(0.75, -0.28, 0.15);
  } else {
    lArm.position.set(-0.045, -0.03, 0.01);
    lArm.rotation.set(0.25, -0.4, 0);
  }
  g.add(lArm);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.userData.muzzle = gun.userData.muzzle;
  g.userData.model = model;
  return g;
}
