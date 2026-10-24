// Efectos: trazadoras, chispas, sangre, marcas de bala, humo, explosiones y destellos.
import * as THREE from 'three';

function softTex(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function smokeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 20 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.smokes = [];
    this.tex = {
      glow: softTex('rgba(255,230,160,1)', 'rgba(255,140,40,0)'),
      spark: softTex('rgba(255,250,220,1)', 'rgba(255,200,80,0)'),
      blood: softTex('rgba(150,10,10,0.95)', 'rgba(90,0,0,0)'),
      dust: softTex('rgba(200,180,140,0.7)', 'rgba(200,180,140,0)'),
      fire: softTex('rgba(255,220,120,1)', 'rgba(255,80,0,0)'),
      smoke: smokeTex(),
    };
    this.decalGeo = new THREE.PlaneGeometry(0.09, 0.09);
    this.decalMat = new THREE.MeshBasicMaterial({ map: softTex('rgba(20,15,10,0.95)', 'rgba(20,15,10,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: '#ffe7a0', transparent: true, opacity: 0.8 });
    // Conjunto fijo de luces reutilizables: crear luces nuevas obliga a recompilar shaders (tirones).
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 10, 2);
      l.userData.until = 0;
      scene.add(l);
      this.lights.push(l);
    }
  }

  // Usa una luz del conjunto durante `life` segundos; fn(k) devuelve la intensidad (k = 0..1).
  flashLight(pos, color, distance, life, fn) {
    const t = performance.now();
    let l = this.lights.find(x => x.userData.until < t);
    if (!l) l = this.lights.reduce((a, b) => (a.userData.until < b.userData.until ? a : b));
    l.color.set(color);
    l.distance = distance;
    l.position.copy(pos);
    l.userData.start = t;
    l.userData.until = t + life * 1000;
    l.userData.fn = fn;
    l.intensity = fn(0);
    return l;
  }

  updateLights() {
    const t = performance.now();
    for (const l of this.lights) {
      if (t >= l.userData.until) { l.intensity = 0; continue; }
      const k = (t - l.userData.start) / (l.userData.until - l.userData.start);
      l.intensity = l.userData.fn(k);
    }
  }

  sprite(tex, pos, size, color = '#fff', additive = true, opacity = 1) {
    const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m);
    s.position.copy(pos);
    s.scale.setScalar(size);
    this.scene.add(s);
    return s;
  }

  add(obj, life, update) {
    const it = { obj, life, age: 0, update };
    this.items.push(it);
    return it;
  }

  // Termina un efecto de larga duración (humo o fuego) de forma suave.
  end(it, fade = 1.5) {
    if (it && it.age < it.life - fade) it.age = it.life - fade;
  }

  fire(pos, radius = 3.2, duration = 7) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const flames = [];
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const m = new THREE.SpriteMaterial({ map: this.tex.fire, color: new THREE.Color().setHSL(0.06 + Math.random() * 0.05, 1, 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m);
      sp.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      group.add(sp);
      flames.push({ sp, base: 0.6 + Math.random() * 0.9, ph: Math.random() * 10, y: sp.position.y });
    }
    const smoke = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.smoke, color: '#333', transparent: true, depthWrite: false, opacity: 0.5 }));
      s.position.set((Math.random() - 0.5) * radius, 1.5 + Math.random() * 2, (Math.random() - 0.5) * radius);
      s.scale.setScalar(2.5);
      group.add(s);
      smoke.push(s);
    }
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.05, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    scorch.position.y = 0.02;
    group.add(scorch);
    this.flashLight(pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ff8a30', radius * 4, duration, k => 18 * Math.min(1, k * duration / 0.3) * Math.min(1, (1 - k) * duration / 1.2) * (0.8 + Math.random() * 0.4));
    this.scene.add(group);
    return this.add(group, duration, (o, k, dt, age) => {
      const fade = Math.min(1, age / 0.3) * Math.min(1, (duration - age) / 1.2);
      for (const f of flames) {
        const fl = 0.75 + Math.sin(age * 14 + f.ph) * 0.25;
        f.sp.scale.set(f.base * fl, f.base * 1.6 * fl, 1);
        f.sp.position.y = f.y + f.base * 0.5;
        f.sp.material.opacity = fade;
      }
      for (const s of smoke) { s.position.y += dt * 0.8; if (s.position.y > 5) s.position.y = 1.5; s.material.opacity = 0.35 * fade; }
    });
  }

  tracer(from, to) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1) return;
    const start = from.clone().addScaledVector(dir, Math.min(0.15, 1.5 / len));
    const geo = new THREE.BufferGeometry().setFromPoints([start, to]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.add(line, 0.07, (o, k) => { o.material.opacity = 0.8 * (1 - k); });
  }

  impact(pos, normal) {
    const n = normal || new THREE.Vector3(0, 1, 0);
    // marca de bala
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.copy(pos).addScaledVector(n, 0.01);
    d.lookAt(d.position.clone().add(n));
    d.rotation.z = Math.random() * 6;
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > 160) this.scene.remove(this.decals.shift());
    // polvo y chispas
    const dust = this.sprite(this.tex.dust, pos.clone().addScaledVector(n, 0.08), 0.25, '#fff', false, 0.8);
    this.add(dust, 0.5, (o, k) => { o.scale.setScalar(0.25 + k * 0.5); o.material.opacity = 0.8 * (1 - k); o.position.y += 0.004; });
    for (let i = 0; i < 3; i++) {
      const s = this.sprite(this.tex.spark, pos.clone(), 0.05);
      const v = n.clone().multiplyScalar(2 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3));
      this.add(s, 0.18 + Math.random() * 0.1, (o, k, dt) => { o.position.addScaledVector(v, dt); v.y -= 9 * dt; o.material.opacity = 1 - k; });
    }
  }

  blood(pos, dir, head) {
    const count = head ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const s = this.sprite(this.tex.blood, pos.clone(), 0.12 + Math.random() * 0.15, '#fff', false);
      const v = dir.clone().multiplyScalar(1.5 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2));
      this.add(s, 0.35 + Math.random() * 0.2, (o, k, dt) => { o.position.addScaledVector(v, dt); v.y -= 9 * dt; o.material.opacity = 1 - k; o.scale.setScalar(o.scale.x * (1 + dt)); });
    }
  }

  muzzleFlash(pos, big = 1) {
    const s = this.sprite(this.tex.fire, pos, 0.35 * big);
    s.material.rotation = Math.random() * 6;
    this.add(s, 0.05, (o, k) => { o.material.opacity = 1 - k; });
    this.flashLight(pos, '#ffb35a', 7, 0.05, k => 6 * big * (1 - k));
  }

  explosion(pos, big) {
    const scale = big ? 3 : 1;
    this.flashLight(pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffa040', 25 * scale, 0.5, k => 60 * scale * (1 - k));
    const fb = this.sprite(this.tex.fire, pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 2 * scale);
    this.add(fb, 0.5, (o, k) => { o.scale.setScalar((2 + k * 5) * scale); o.material.opacity = 1 - k; });
    for (let i = 0; i < 18 * scale; i++) {
      const s = this.sprite(this.tex.fire, pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.5 + Math.random() * 0.8);
      const v = new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14).multiplyScalar(big ? 1.5 : 1);
      this.add(s, 0.5 + Math.random() * 0.4, (o, k, dt) => { o.position.addScaledVector(v, dt); v.multiplyScalar(0.92); o.material.opacity = 1 - k; });
    }
    for (let i = 0; i < 12 * scale; i++) {
      const s = this.sprite(this.tex.smoke, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * 2)), 2 * scale, '#444', false, 0.8);
      this.add(s, 2.5, (o, k, dt) => { o.position.y += dt * 1.5; o.scale.setScalar((2 + k * 4) * scale); o.material.opacity = 0.7 * (1 - k); });
    }
  }

  flashPop(pos) {
    const s = this.sprite(this.tex.glow, pos, 6, '#fff');
    this.add(s, 0.25, (o, k) => { o.material.opacity = 1 - k; o.scale.setScalar(6 + k * 6); });
    this.flashLight(pos, '#ffffff', 30, 0.25, k => 80 * (1 - k));
  }

  smoke(pos, duration = 18) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const puffs = [];
    for (let i = 0; i < 46; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex.smoke, color: new THREE.Color().setHSL(0, 0, 0.72 + Math.random() * 0.12), transparent: true, depthWrite: false, opacity: 0 });
      m.rotation = Math.random() * 6;
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.2;
      const target = new THREE.Vector3(Math.cos(a) * r, Math.random() * 3.2, Math.sin(a) * r);
      s.position.set(0, 0.3, 0);
      group.add(s);
      puffs.push({ s, target, size: 2.6 + Math.random() * 1.8 });
    }
    this.scene.add(group);
    return this.add(group, duration, (o, k, dt, age) => {
      const grow = Math.min(1, age / 1.4);
      const fade = age > duration - 2.5 ? (duration - age) / 2.5 : 1;
      for (const p of puffs) {
        p.s.position.lerp(p.target, Math.min(1, dt * 2.2));
        p.s.scale.setScalar(p.size * (0.4 + 0.6 * grow));
        p.s.material.opacity = 0.92 * grow * fade;
        p.s.material.rotation += dt * 0.05;
      }
    });
  }

  update(dt) {
    this.updateLights();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const k = Math.min(1, it.age / it.life);
      if (it.update) it.update(it.obj, k, dt, it.age);
      if (it.age >= it.life) {
        this.scene.remove(it.obj);
        it.obj.traverse?.(o => { if (o.material && o.material !== this.decalMat && o.material !== this.tracerMat) o.material.dispose?.(); if (o.geometry && !o.isSprite && o.geometry !== this.decalGeo) o.geometry.dispose?.(); });
        this.items.splice(i, 1);
      }
    }
  }

  clearRound() {
    for (const d of this.decals) this.scene.remove(d);
    this.decals = [];
  }
}
