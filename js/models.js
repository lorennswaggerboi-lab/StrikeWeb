// Modelos low-poly de jugadores y armas construidos con primitivas.
import * as THREE from 'three';
import { WEAPONS } from '../shared/weapons.js';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

function cyl(r, len, color, x = 0, y = 0, z = 0, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  return m;
}

function addRot(g, m, rx) {
  m.rotation.x = rx;
  g.add(m);
  return m;
}

const NADE_IDS = ['he', 'flash', 'smoke', 'molotov', 'incgrenade'];

export function weaponModelId(id) {
  if (id === 'nade' || id === 'c4') return id;
  if (NADE_IDS.includes(id)) return 'nade_' + id;
  return WEAPONS[id]?.model || 'knife';
}

// Arma orientada hacia -Z, empuñadura en el origen. Incluye un punto "muzzle".
export function createWeaponModel(id) {
  const model = weaponModelId(id);
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const dark = '#3a3e44', metal = '#5d636b', wood = '#8a5529', black = '#24272b';
  switch (model) {
    case 'knife':
      g.add(box(0.03, 0.035, 0.11, black, 0, 0, 0.02));
      g.add(box(0.045, 0.012, 0.02, metal, 0, 0, -0.04));
      g.add(box(0.008, 0.035, 0.17, '#c9ced4', 0, 0.005, -0.13));
      muzzle.position.set(0, 0, -0.2);
      break;
    case 'pistol': case 'usp':
      g.add(box(0.032, 0.04, 0.18, dark, 0, 0.045, -0.05));
      addRot(g, box(0.03, 0.1, 0.045, black, 0, -0.01, 0.01), 0.25);
      g.add(box(0.012, 0.03, 0.03, black, 0, 0.015, -0.03));
      if (model === 'usp') g.add(cyl(0.017, 0.13, black, 0, 0.048, -0.2));
      muzzle.position.set(0, 0.048, model === 'usp' ? -0.27 : -0.15);
      break;
    case 'deagle':
      g.add(box(0.04, 0.052, 0.25, '#9aa0a6', 0, 0.05, -0.07));
      addRot(g, box(0.034, 0.11, 0.05, black, 0, -0.01, 0.02), 0.25);
      muzzle.position.set(0, 0.05, -0.2);
      break;
    case 'smg':
      g.add(box(0.05, 0.08, 0.3, dark, 0, 0.04, -0.08));
      g.add(cyl(0.014, 0.1, black, 0, 0.05, -0.28));
      addRot(g, box(0.03, 0.16, 0.04, black, 0, -0.06, -0.1), -0.1);
      addRot(g, box(0.032, 0.09, 0.04, black, 0, -0.02, 0.03), 0.25);
      g.add(box(0.02, 0.03, 0.18, metal, 0, 0.03, 0.14));
      muzzle.position.set(0, 0.05, -0.34);
      break;
    case 'shotgun':
      g.add(box(0.05, 0.07, 0.4, dark, 0, 0.04, -0.12));
      g.add(cyl(0.018, 0.4, black, 0, 0.06, -0.45));
      g.add(box(0.045, 0.045, 0.16, wood, 0, 0.02, -0.38));
      addRot(g, box(0.045, 0.09, 0.26, wood, 0, 0.0, 0.18), 0.12);
      muzzle.position.set(0, 0.06, -0.66);
      break;
    case 'ak':
      g.add(box(0.05, 0.07, 0.36, dark, 0, 0.04, -0.12));
      g.add(box(0.055, 0.06, 0.2, wood, 0, 0.035, -0.38));
      g.add(cyl(0.012, 0.28, black, 0, 0.05, -0.58));
      g.add(box(0.012, 0.05, 0.012, black, 0, 0.08, -0.66));
      const mag = box(0.035, 0.18, 0.06, black, 0, -0.07, -0.16);
      mag.rotation.x = 0.35; g.add(mag);
      addRot(g, box(0.03, 0.09, 0.04, black, 0, -0.02, 0.03), 0.3);
      addRot(g, box(0.045, 0.085, 0.25, wood, 0, 0.0, 0.18), 0.1);
      muzzle.position.set(0, 0.05, -0.73);
      break;
    case 'rifle': case 'rifle2':
      g.add(box(0.05, 0.075, 0.4, model === 'rifle' ? '#4a4535' : black, 0, 0.04, -0.12));
      g.add(box(0.055, 0.06, 0.2, metal, 0, 0.04, -0.38));
      g.add(cyl(0.012, 0.25, black, 0, 0.05, -0.58));
      g.add(box(0.02, 0.04, 0.16, black, 0, 0.1, -0.1));
      addRot(g, box(0.035, 0.17, 0.06, black, 0, -0.07, -0.15), 0.12);
      addRot(g, box(0.03, 0.09, 0.04, black, 0, -0.02, 0.03), 0.3);
      g.add(box(0.04, 0.08, 0.22, metal, 0, 0.02, 0.18));
      muzzle.position.set(0, 0.05, -0.71);
      break;
    case 'sniper': case 'awp': {
      const body = model === 'awp' ? '#3f5a3a' : '#3b3f44';
      g.add(box(0.055, 0.08, 0.5, body, 0, 0.03, -0.1));
      g.add(cyl(0.014, 0.5, black, 0, 0.05, -0.6));
      g.add(cyl(0.028, 0.3, black, 0, 0.13, -0.1));
      g.add(cyl(0.035, 0.05, black, 0, 0.13, -0.26));
      g.add(box(0.03, 0.1, 0.06, black, 0, -0.06, -0.1));
      addRot(g, box(0.05, 0.1, 0.25, body, 0, 0.0, 0.25), 0.08);
      muzzle.position.set(0, 0.05, -0.86);
      break;
    }
    case 'nade': case 'nade_he': {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat('#465c37'));
      g.add(s);
      g.add(box(0.02, 0.03, 0.02, metal, 0, 0.045, 0));
      g.add(box(0.008, 0.06, 0.012, metal, 0.03, 0.02, 0));
      muzzle.position.set(0, 0, -0.05);
      break;
    }
    case 'nade_flash': case 'nade_smoke': case 'nade_incgrenade': {
      const color = model === 'nade_flash' ? '#9aa3ab' : model === 'nade_smoke' ? '#6b7f8c' : '#8c3a2a';
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 12), mat(color));
      g.add(c);
      g.add(box(0.02, 0.025, 0.02, metal, 0, 0.065, 0));
      g.add(box(0.008, 0.07, 0.012, metal, 0.035, 0.02, 0));
      muzzle.position.set(0, 0, -0.05);
      break;
    }
    case 'nade_molotov': {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.12, 10), mat('#3f6b3a', { transparent: true, opacity: 0.85 }));
      g.add(b);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.07, 8), mat('#3f6b3a'));
      neck.position.y = 0.09; g.add(neck);
      g.add(box(0.03, 0.05, 0.03, '#d8cbb0', 0, 0.14, 0));
      muzzle.position.set(0, 0.16, 0);
      break;
    }
    case 'p90':
      g.add(box(0.06, 0.09, 0.42, dark, 0, 0.04, -0.1));
      g.add(box(0.05, 0.03, 0.3, '#2a2a2a', 0, 0.1, -0.1));
      g.add(cyl(0.013, 0.08, black, 0, 0.05, -0.35));
      g.add(box(0.035, 0.07, 0.06, black, 0, -0.04, -0.02));
      muzzle.position.set(0, 0.05, -0.4);
      break;
    case 'c4':
      g.add(box(0.16, 0.06, 0.1, '#5d5134', 0, 0, -0.03));
      g.add(box(0.06, 0.03, 0.04, '#111', 0.03, 0.04, -0.03));
      g.add(box(0.03, 0.012, 0.012, '#f22', 0.03, 0.058, -0.03));
      muzzle.position.set(0, 0, -0.1);
      break;
  }
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const TEAM_COLORS = {
  T: { shirt: '#8a6b42', pants: '#4b3f2c', head: '#26221d', vest: '#5f5236', boots: '#2b241b' },
  CT: { shirt: '#2f4a6d', pants: '#25303e', head: '#2e3a2c', vest: '#1d2633', boots: '#16191d' },
};
const SKIN = '#c49474';

export function createPlayerModel(team) {
  const c = TEAM_COLORS[team] || TEAM_COLORS.T;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.12, 0, 0); legR.position.set(0.12, 0, 0);
  for (const leg of [legL, legR]) {
    leg.add(box(0.17, 0.82, 0.2, c.pants, 0, -0.41, 0));
    leg.add(box(0.19, 0.12, 0.28, c.boots, 0, -0.84, -0.03));
    hips.add(leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.9; body.add(torso);
  torso.add(box(0.46, 0.55, 0.26, c.shirt, 0, 0.3, 0));
  torso.add(box(0.48, 0.4, 0.3, c.vest, 0, 0.33, 0));
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  head.add(box(0.24, 0.27, 0.26, SKIN, 0, 0.0, 0));
  head.add(box(0.26, 0.14, 0.28, c.head, 0, 0.09, 0.0));
  if (team === 'CT') head.add(box(0.28, 0.06, 0.3, c.head, 0, 0.16, -0.01));
  else head.add(box(0.25, 0.1, 0.27, c.head, 0, -0.06, 0.0));
  head.add(box(0.18, 0.04, 0.02, '#0d0d0d', 0, 0.02, -0.135));

  // brazos + arma
  const arms = new THREE.Group(); arms.position.set(0, 0.5, 0); torso.add(arms);
  const armR = box(0.12, 0.12, 0.42, c.shirt, 0.2, -0.05, -0.18); armR.rotation.y = 0.25;
  const armL = box(0.12, 0.12, 0.46, c.shirt, -0.12, -0.05, -0.26); armL.rotation.y = -0.45;
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

// Pose del modelo: agachado, ángulo vertical, fase del caminar y animación de muerte.
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

// Viewmodel en primera persona: arma + brazos con las mangas del equipo.
export function createViewModel(id, team) {
  const g = new THREE.Group();
  const gun = createWeaponModel(id);
  g.add(gun);
  const sleeve = (TEAM_COLORS[team] || TEAM_COLORS.T).shirt;
  const model = weaponModelId(id);
  const glove = team === 'CT' ? '#222' : '#3a3024';
  const two = !['knife', 'pistol', 'usp', 'deagle', 'nade', 'c4'].includes(model) && !model.startsWith('nade');
  const rArm = new THREE.Group();
  rArm.add(box(0.07, 0.07, 0.24, sleeve, 0, -0.04, 0.17));
  rArm.add(box(0.075, 0.08, 0.09, glove, 0, -0.02, 0.02));
  rArm.position.set(0.02, -0.02, 0.02);
  rArm.rotation.x = 0.2;
  g.add(rArm);
  const lArm = new THREE.Group();
  lArm.add(box(0.07, 0.07, 0.26, sleeve, 0, -0.03, 0.17));
  lArm.add(box(0.075, 0.07, 0.09, glove, 0, 0, 0.0));
  if (two) { lArm.position.set(-0.05, 0.0, -0.3); lArm.rotation.set(0.15, -0.5, 0); }
  else { lArm.position.set(-0.06, -0.03, 0.0); lArm.rotation.set(0.2, -0.35, 0); }
  g.add(lArm);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  g.userData.muzzle = gun.userData.muzzle;
  g.userData.model = model;
  return g;
}
