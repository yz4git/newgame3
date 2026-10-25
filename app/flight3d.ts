import * as T from 'three';
import './flight3d.css';
import {createFlightShip,animateFlightShip,createFlightSection,FlightVfx,disposeFlightVisual} from './flight3d-visuals.ts';
import {SPEED_MULTIPLIER,cruiseSpeed,boostSpeed,laserSpeed,missileSpeed,enemySpawnRange,displaySpeed} from './flight3d-tuning.ts';

const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const rand = (n: number) => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
const worldNames = ['ORBITAL GRAVEYARD', 'PELAGIC FRONT', 'NEON CITADEL', 'POLAR RIFT', 'CANOPY TEMPLE', 'CRUCIBLE CORE'];
const worlds = [
  { sky: 0x030916, ground: 0x18283a, metal: 0x687c92, light: 0x6be6ff, haze: 0x142d4f },
  { sky: 0x071a2b, ground: 0x073d59, metal: 0x839aa5, light: 0x6be4de, haze: 0x164867 },
  { sky: 0x0d071f, ground: 0x19112e, metal: 0x394666, light: 0xd789ff, haze: 0x40255f },
  { sky: 0x081a2a, ground: 0x456b87, metal: 0x9bbed2, light: 0x8df4ff, haze: 0x29516c },
  { sky: 0x051b17, ground: 0x163c35, metal: 0x537f65, light: 0x8cffe0, haze: 0x194b3d },
  { sky: 0x180909, ground: 0x431c1a, metal: 0x73514e, light: 0xff9655, haze: 0x6a241d }
] as const;
type State = 'title' | 'playing' | 'paused' | 'over' | 'clear';
type Foe = { mesh: T.Group; hp: number; max: number; radius: number; phase: number; x: number; y: number; fire: number; boss: boolean; points: number };
type Shot = { mesh: T.Mesh; velocity: T.Vector3; foe: boolean; power: number; radius: number; homing: boolean; life: number };
type Blast = { mesh: T.Mesh; life: number; duration: number };
const orbGeo = new T.IcosahedronGeometry(1, 1);
const shotGeo = new T.SphereGeometry(1, 8, 6);
const mat = (color: number, glow = 0) => new T.MeshStandardMaterial({ color, metalness: .65, roughness: .34, flatShading: true, emissive: color, emissiveIntensity: glow });
const hostile = new T.MeshBasicMaterial({ color: 0xff7195, toneMapped: false });
const friendly = new T.MeshBasicMaterial({ color: 0x7feaff, toneMapped: false });
const missileMat = new T.MeshBasicMaterial({ color: 0xffd18a, toneMapped: false });
function hitSegment(a: T.Vector3, b: T.Vector3, center: T.Vector3, radius: number) {
  const ab = new T.Vector3().subVectors(b, a);
  const t = clamp(new T.Vector3().subVectors(center, a).dot(ab) / Math.max(.000001, ab.lengthSq()), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceToSquared(center) <= radius * radius;
}
class Flight3D {
  private canvas = $<HTMLCanvasElement>('flight');
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(66, 1, .12, 420);
  private renderer: T.WebGLRenderer;
  private craft = createFlightShip(0xd5e5ef);
  private vfx = new FlightVfx(matchMedia('(pointer:coarse)').matches);
  private currentSpeed = cruiseSpeed(0);
  private cameraShake = 0;
  private state: State = 'title';
  private stage = 0;
  private sectorTime = 0;
  private totalTime = 0;
  private score = 0;
  private shield = 5;
  private boost = 100;
  private boostHeld = false;
  private missileDelay = 0;
  private laserDelay = 0;
  private spawnDelay = 1.2;
  private invulnerable = 0;
  private flash = 0;
  private boss: Foe | null = null;
  private pendingSectorChange = false;
  private enemies: Foe[] = [];
  private shots: Shot[] = [];
  private blasts: Blast[] = [];
  private scenery: T.Group[] = [];
  private baseX = 0;
  private baseY = 0;
  private pointer: number | null = null;
  private lastTouch = { x: 0, y: 0 };
  private keys = new Set<string>();
  private previous = 0;
  private raf = 0;
  private noticeTime = 0;
  private sound: AudioContext | null = null;
  private floorMaterial = mat(0x142c42);
  private terrainMaterial = mat(0x68869f);
  private accentMaterial = mat(0x86d9f0, .45);
  constructor() {
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;
    this.scene.add(new T.HemisphereLight(0x98c9ef, 0x111525, 2.1));
    const sun = new T.DirectionalLight(0xffe1c5, 2.5);
    sun.position.set(-35, 60, 25); this.scene.add(sun);
    this.craft.rotation.y = 0; // player faces -Z; hostile ships face +Z
    this.scene.add(this.craft,this.vfx.root);
    this.scene.add(new T.AmbientLight(0x5d7fbb, .32));
    this.attachControls();
    this.resize();
    this.configureSector();
    this.renderOverlay('NOVA STRIKE', 'TRUE 3D / フル3D空間で飛び、避け、撃つ。<br>ドラッグで上下左右・BOOSTで前進加速・MISSILEで追尾攻撃。', '3D出撃');
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.raf = requestAnimationFrame(t => this.frame(t));
    Object.assign(window, { __novaFlight3D: { snapshot: () => ({ state: this.state, stage: this.stage, score: this.score, shield: this.shield, position: this.craft.position.toArray(), enemies: this.enemies.length, shots: this.shots.length, boss: !!this.boss }), start: () => this.start(), pause: () => this.pause() } });
  }
  private attachControls() {
    this.canvas.addEventListener('pointerdown', e => {
      if (this.state !== 'playing' || this.pointer !== null) return;
      e.preventDefault(); this.pointer = e.pointerId;
      this.lastTouch = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', e => {
      if (this.state !== 'playing' || this.pointer !== e.pointerId) return;
      e.preventDefault();
      this.baseX = clamp(this.baseX + (e.clientX - this.lastTouch.x) / this.canvas.clientWidth * 26, -8.5, 8.5);
      this.baseY = clamp(this.baseY - (e.clientY - this.lastTouch.y) / this.canvas.clientHeight * 26, -6.5, 8);
      this.lastTouch = { x: e.clientX, y: e.clientY };
    });
    const release = (e: PointerEvent) => { if (this.pointer === e.pointerId) this.pointer = null; };
    this.canvas.addEventListener('pointerup', release); this.canvas.addEventListener('pointercancel', release);
    const boost = $('boost');
    boost.addEventListener('pointerdown', e => { e.preventDefault(); this.boostHeld = true; boost.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boost.addEventListener(ev, () => { this.boostHeld = false; boost.classList.remove('on'); });
    $('missile').addEventListener('click', () => this.fireMissile());
    $('pause').addEventListener('click', () => this.pause());
    $('action').addEventListener('click', () => { if (this.state === 'paused') this.resume(); else this.start(); });
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','shift','p','escape','m'].includes(key)) e.preventDefault();
      this.keys.add(key);
      if (key === 'p' || key === 'escape') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
      if (key === 'm' && !e.repeat) this.fireMissile();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.boostHeld = false; if (this.state === 'playing') this.pause(); });
  }
  private resize() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  private renderOverlay(title: string, html: string, button: string) {
    $('overlay').hidden = false; $('overlay-title').textContent = title; $('overlay-info').innerHTML = html; $('action').textContent = button;
    $('controls').hidden = true;
  }
  private hideOverlay() { $('overlay').hidden = true; $('controls').hidden = false; }
  private start() {
    this.stopObjects(); this.pendingSectorChange = false; this.stage = 0; this.score = 0; this.currentSpeed = cruiseSpeed(0); this.cameraShake = 0; this.shield = 5; this.boost = 100;
    this.craft.position.set(0, 0, 0); this.baseX = 0; this.baseY = 0; this.totalTime = 0;
    this.missileDelay = 0; this.invulnerable = 2;
    this.configureSector(); this.state = 'playing'; this.hideOverlay();
    this.camera.position.set(0, 5.2, 15.4); this.camera.fov=71; this.camera.updateProjectionMatrix();
    this.previous = performance.now(); this.unlockAudio(); this.alert('TRUE 3D FLIGHT — SECTOR 01', 2.4);
  }
  private resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.hideOverlay(); this.previous = performance.now(); }
  private pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.pointer = null; this.boostHeld = false;
    this.renderOverlay('PAUSED', 'フライトを一時停止しました。<br>進行・弾・敵の時間は停止しています。', '飛行を再開');
  }
  private finish(clear: boolean) {
    this.state = clear ? 'clear' : 'over'; this.boostHeld = false;
    let best = 0;
    try { best = Number(localStorage.getItem('nova-flight3d-best') || '0') || 0; if (this.score > best) localStorage.setItem('nova-flight3d-best', String(this.score)); } catch { /* private browsing */ }
    this.renderOverlay(clear ? 'ALL SECTORS CLEAR' : 'SIGNAL LOST', 'SCORE ' + this.score.toString().padStart(7, '0') + '<br>' + (clear ? '6つの立体戦場を突破！' : '3D空間の回避ラインを見直して再挑戦。') + (this.score > best ? '<br>NEW BEST' : ''), 'もう一度出撃');
  }
  private stopObjects() {
    for (const e of this.enemies){this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);}
    if (this.boss){this.scene.remove(this.boss.mesh);disposeFlightVisual(this.boss.mesh,true);}
    for (const s of this.shots) this.scene.remove(s.mesh);
    for (const b of this.blasts) this.scene.remove(b.mesh);
    for (const g of this.scenery){this.scene.remove(g);disposeFlightVisual(g);}
    this.vfx.clear();
    this.enemies = []; this.boss = null; this.shots = []; this.blasts = []; this.scenery = [];
  }
  private configureSector() {
    const p = worlds[this.stage];
    this.scene.background = new T.Color(p.sky);
    this.scene.fog = new T.Fog(p.haze, 64, 260);
    this.floorMaterial.color.setHex(p.ground);
    this.terrainMaterial.color.setHex(p.metal);
    this.accentMaterial.color.setHex(p.light);
    for (const g of this.scenery){this.scene.remove(g);disposeFlightVisual(g);}
    this.scenery = [];
    for (let i = 0; i < 16; i++) this.makeScenery(this.craft.position.z - 55 - i * 38, i);
    this.sectorTime = 0; this.spawnDelay = 1.3; this.laserDelay = 0;
    $('sector').textContent = String(this.stage + 1).padStart(2, '0') + ' / 06 — ' + worldNames[this.stage];
    $('bosswrap').hidden = true; $('progress').style.width = '0%';
  }
  private makeScenery(z: number, index: number) {
    const g=createFlightSection(this.stage,index,z,this.floorMaterial,this.terrainMaterial,this.accentMaterial);
    this.scene.add(g);this.scenery.push(g);
  }
  private spawnFoe(boss = false) {
    const seed = this.sectorTime * 9.13 + this.enemies.length * 4.3;
    const mesh = createFlightShip(boss ? 0x963d54 : this.stage % 2 ? 0xb26f75 : 0x9d577c, boss, this.stage);
    const x = boss ? 0 : (rand(seed) - .5) * 13.2;
    const y = boss ? 2.5 : (rand(seed + 4) - .5) * 10;
    mesh.rotation.y = Math.PI;
    mesh.position.set(x, y, this.craft.position.z - (boss ? 135 : enemySpawnRange));
    this.scene.add(mesh);
    const max = boss ? 145 + this.stage * 24 : (this.stage >= 3 ? 6 : 4);
    const foe: Foe = { mesh, hp: max, max, radius: boss ? 8.0 : 2.15, phase: seed, x, y, fire: boss ? 1.3 : 1.3 + rand(seed + 8) * 1.5, boss, points: boss ? 5000 : 180 + this.stage * 65 };
    if (boss) {
      this.boss = foe; $('bosswrap').hidden = false; $('boss-name').textContent = 'GUARDIAN / ' + worldNames[this.stage];
      this.alert('WARNING — 3D GUARDIAN', 2.4);
    } else this.enemies.push(foe);
  }
  private fireShot(origin: T.Vector3, velocity: T.Vector3, foe: boolean, power: number, homing = false) {
    if (this.shots.length >= 185) return;
    const mesh = new T.Mesh(shotGeo, foe ? hostile : homing ? missileMat : friendly);
    mesh.position.copy(origin); mesh.scale.set(homing ? .46 : .22, homing ? .46 : .22, homing ? 1.0 : 1.2);
    this.scene.add(mesh);
    this.shots.push({ mesh, velocity, foe, power, radius: homing ? .68 : .3, homing, life: 3.2 });
  }
  private fireLasers() {
    let lock: Foe | null = null, dist = 210;
    for (const f of [...this.enemies, ...(this.boss ? [this.boss] : [])]) {
      const dz = this.craft.position.z - f.mesh.position.z;
      const dx = Math.abs(f.mesh.position.x - this.craft.position.x), dy = Math.abs(f.mesh.position.y - this.craft.position.y);
      if (dz > 0 && dz < dist && dx < 6 && dy < 6) { lock = f; dist = dz; }
    }
    for (const side of [-1, 1]) {
      const origin = this.craft.position.clone().add(new T.Vector3(side * .62, -.10, -1.6));
      const aim = new T.Vector3(0, 0, -1);
      if (lock) aim.lerp(lock.mesh.position.clone().sub(origin).normalize(), .28).normalize();
      this.fireShot(origin, aim.multiplyScalar(laserSpeed(this.currentSpeed)), false, 1);
    }
  }
  private fireMissile() {
    if (this.state !== 'playing' || this.missileDelay > 0) return;
    this.missileDelay = 5.5;
    let target: Foe | null = this.boss, nearest = 200;
    if (!target) for (const e of this.enemies) { const d = this.craft.position.distanceTo(e.mesh.position); if (d < nearest) { target = e; nearest = d; } }
    const from = this.craft.position.clone().add(new T.Vector3(0, -.1, -2));
    const dir = target ? target.mesh.position.clone().sub(from).normalize() : new T.Vector3(0, 0, -1);
    this.fireShot(from, dir.multiplyScalar(missileSpeed(this.currentSpeed)), false, 12, true);
    this.sfx(170, .19);
    $('missile').classList.add('fired'); setTimeout(() => $('missile').classList.remove('fired'), 150);
  }
  private enemyShot(e: Foe) {
    const origin = e.mesh.position.clone().add(new T.Vector3(0, 0, e.boss ? 3.5 : 1.3));
    const aim = this.craft.position.clone().sub(origin).normalize();
    for (let n = 0; n < (e.boss ? 5 : 1); n++) {
      const spread = (n - (e.boss ? 2 : 0)) * .18;
      const velocity = aim.clone().add(new T.Vector3(spread, Math.sin(e.phase + n) * .065, 0)).normalize().multiplyScalar(e.boss ? 43 : 34 + this.stage * 1.5);
      this.fireShot(origin, velocity, true, 1);
    }
  }
  private hitShip() {
    if (this.invulnerable > 0 || this.state !== 'playing') return;
    this.shield--; this.invulnerable = 1.65; this.flash = .6; this.cameraShake=.5; this.vfx.burst(this.craft.position,1.6,0xff6e6c); this.sfx(95, .24);
    if (this.shield <= 0) this.finish(false);
  }
  private damageFoe(e: Foe, amount: number) {
    e.hp -= amount;
    if (e.hp > 0) return;
    this.explode(e.mesh.position, e.boss ? 7 : 2.3);
    this.scene.remove(e.mesh); disposeFlightVisual(e.mesh,true); this.score += e.points; this.sfx(e.boss ? 72 : 115, e.boss ? .45 : .10);
    if (e.boss) {
      this.boss = null; this.stage++;
      for (const other of this.enemies){this.scene.remove(other.mesh);disposeFlightVisual(other.mesh,true);} this.enemies = [];
      if (this.stage === worlds.length) { this.finish(true); return; }
      this.shield = Math.min(5, this.shield + 1);
      this.pendingSectorChange = true;
    } else this.enemies.splice(this.enemies.indexOf(e), 1);
  }
  private explode(position: T.Vector3, size: number) {
    const mesh = new T.Mesh(orbGeo, new T.MeshBasicMaterial({ color: size > 4 ? 0xffc27c : 0xff846a, transparent: true, opacity: .72, depthWrite: false }));
    mesh.position.copy(position); mesh.scale.setScalar(.2); this.scene.add(mesh);
    this.blasts.push({ mesh, life: .65, duration: .65 });
    this.vfx.burst(position,size,size>4?0xffbd7c:0xff816e);
  }
  private alert(message: string, seconds = 2) { $('notice').textContent = message; $('notice').classList.add('visible'); this.noticeTime = seconds; }
  private sfx(freq: number, length: number) {
    if (!this.sound) return;
    try {
      const osc = this.sound.createOscillator(), gain = this.sound.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, this.sound.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, freq * .4), this.sound.currentTime + length);
      gain.gain.setValueAtTime(.06, this.sound.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, this.sound.currentTime + length);
      osc.connect(gain); gain.connect(this.sound.destination); osc.start(); osc.stop(this.sound.currentTime + length);
    } catch { /* audio optional */ }
  }
  private unlockAudio() {
    try { this.sound ??= new AudioContext(); void this.sound.resume().catch(() => {}); } catch { /* audio optional */ }
  }
  private update(dt: number) {
    this.totalTime += dt; this.sectorTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.missileDelay = Math.max(0, this.missileDelay - dt);
    this.noticeTime -= dt;
    if (this.noticeTime < 0) $('notice').classList.remove('visible');
    const k = this.keys;
    const dx = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
    const dy = Number(k.has('w') || k.has('arrowup')) - Number(k.has('s') || k.has('arrowdown'));
    this.baseX = clamp(this.baseX + dx * dt * 11, -8.5, 8.5);
    this.baseY = clamp(this.baseY + dy * dt * 11, -6.5, 8);
    const accelerating = (this.boostHeld || k.has('shift') || k.has(' ')) && this.boost > 0;
    this.boost = clamp(this.boost + (accelerating ? -30 : 12) * dt, 0, 100);
    const speed = accelerating ? boostSpeed() : cruiseSpeed(this.stage);
    this.currentSpeed = speed;
    this.craft.position.x += (this.baseX - this.craft.position.x) * Math.min(1, dt * 12);
    this.craft.position.y += (this.baseY - this.craft.position.y) * Math.min(1, dt * 12);
    this.craft.position.z -= speed * dt;
    this.craft.rotation.z += (-dx * .18 - (this.baseX - this.craft.position.x) * .055 - this.craft.rotation.z) * Math.min(1, dt * 7);
    this.craft.rotation.x = -dy * .08;
    this.craft.visible = this.invulnerable <= 0 || Math.sin(this.totalTime * 34) > -.25;
    animateFlightShip(this.craft,this.totalTime,speed/60);
    this.scenery.forEach((g, i) => {
      if (g.position.z > this.craft.position.z + 55) g.position.z -= this.scenery.length * 38;
      if (this.stage === 0) g.rotation.z = Math.sin(this.totalTime * .12 + i) * .014;
    });
    if (!this.boss && this.sectorTime >= 45) {
      for (const enemy of this.enemies) this.scene.remove(enemy.mesh);
      this.enemies = []; this.spawnFoe(true);
    } else if (!this.boss && this.sectorTime < 45) {
      this.spawnDelay -= dt;
      if (this.spawnDelay <= 0) { this.spawnFoe(); this.spawnDelay = Math.max(.85, 1.65 - this.stage * .12); }
    }
    this.laserDelay -= dt;
    if (this.laserDelay <= 0) { this.fireLasers(); this.laserDelay = .105; }
    const foes = this.boss ? [...this.enemies, this.boss] : [...this.enemies];
    for (const foe of foes) {
      if (foe.boss) {
        foe.mesh.position.z += (this.craft.position.z - 105 - foe.mesh.position.z) * Math.min(1, dt * 2.3);
        foe.mesh.position.x = Math.sin(this.sectorTime * .65) * 4.5;
        foe.mesh.position.y = 1.5 + Math.sin(this.sectorTime * .87) * 2.4;
        foe.mesh.rotation.z = Math.sin(this.sectorTime * 1.1) * .11;
      } else {
        foe.mesh.position.z += (21 + this.stage * 3) * dt;
        foe.mesh.position.x = clamp(foe.x + Math.sin(this.sectorTime * 1.7 + foe.phase) * 1.7, -8, 8);
        foe.mesh.position.y = foe.y + Math.sin(this.sectorTime * 2.1 + foe.phase) * 1.2;
        foe.mesh.rotation.z = Math.sin(this.sectorTime * 2.1 + foe.phase) * .25;
        if (foe.mesh.position.z > this.craft.position.z + 12) {
          this.scene.remove(foe.mesh);disposeFlightVisual(foe.mesh,true); this.enemies.splice(this.enemies.indexOf(foe), 1); continue;
        }
      }
      foe.fire -= dt;
      if (foe.fire <= 0 && foe.mesh.position.z < this.craft.position.z - 20) {
        this.enemyShot(foe); foe.fire = foe.boss ? 1.4 : 2.7;
      }
      animateFlightShip(foe.mesh,this.totalTime+foe.phase,1);
      if (!foe.boss && foe.mesh.position.distanceTo(this.craft.position) < foe.radius + .65) {
        this.hitShip(); this.damageFoe(foe, foe.hp);
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i], a = shot.mesh.position.clone();
      if (shot.homing) {
        let best: Foe | null = this.boss, closest = 1e9;
        if (!best) for (const e of this.enemies) { const distance = e.mesh.position.distanceToSquared(a); if (distance < closest) { closest = distance; best = e; } }
        if (best) shot.velocity.lerp(best.mesh.position.clone().sub(a).normalize().multiplyScalar(missileSpeed(this.currentSpeed)), Math.min(1, dt * 3.8));
      }
      shot.mesh.position.addScaledVector(shot.velocity, dt); shot.life -= dt;
      let contact: Foe | null = null;
      if (shot.foe) {
        if (hitSegment(a, shot.mesh.position, this.craft.position, shot.radius + .74)) { this.hitShip(); shot.life = 0; }
      } else {
        for (const e of foes) {
          if (e.hp > 0 && hitSegment(a, shot.mesh.position, e.mesh.position, shot.radius + e.radius)) { contact = e; break; }
        }
        if (contact) { this.damageFoe(contact, shot.power); shot.life = 0; }
      }
      if (shot.life <= 0 || Math.abs(shot.mesh.position.z - this.craft.position.z) > 195) {
        this.scene.remove(shot.mesh); this.shots.splice(i, 1);
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]; b.life -= dt;
      const progress = 1 - b.life / b.duration;
      b.mesh.scale.setScalar(.2 + progress * 5.5);
      (b.mesh.material as T.MeshBasicMaterial).opacity = Math.max(0, (1 - progress) * .8);
      if (b.life <= 0) { this.scene.remove(b.mesh); b.mesh.material instanceof T.Material && b.mesh.material.dispose(); this.blasts.splice(i, 1); }
    }
    if (this.pendingSectorChange) {
      this.pendingSectorChange = false;
      for (const shot of this.shots) this.scene.remove(shot.mesh);
      this.shots = []; this.configureSector();
      this.alert('SECTOR CLEARED — NEXT WORLD', 2.9);
    }
    this.vfx.update(this.craft.position,this.totalTime,dt,speed,accelerating);
    this.cameraShake=Math.max(0,this.cameraShake-dt*1.6);
    this.flash = Math.max(0, this.flash - dt);
    $('hit').style.opacity = String(this.flash);
    this.updateUI();
  }
  private updateUI() {
    $('score').textContent = this.score.toString().padStart(7, '0');
    $('hull').textContent = '◆ '.repeat(this.shield) + '◇ '.repeat(5 - this.shield);
    $('speed').textContent = displaySpeed(this.currentSpeed) + ' km/h';
    $('speed').classList.toggle('hypersonic',this.currentSpeed>=boostSpeed());
    $('boost-fill').style.width = this.boost.toFixed(0) + '%';
    $('missile').textContent = this.missileDelay > 0 ? 'MISSILE ' + this.missileDelay.toFixed(1) : 'MISSILE READY';
    $('progress').style.width = Math.min(100, this.sectorTime / 45 * 100) + '%';
    if (this.boss) $('boss-fill').style.width = Math.max(0, this.boss.hp / this.boss.max * 100) + '%';
  }
  private frame(t: number) {
    const dt = Math.min(.035, Math.max(0, (t - (this.previous || t)) / 1000)); this.previous = t;
    if (this.state === 'playing') this.update(dt);
    const accelerating=this.currentSpeed>=boostSpeed();
    const desired = new T.Vector3(this.craft.position.x * .64, this.craft.position.y + 5.4, this.craft.position.z + (accelerating ? 18.5 : 16.4));
    this.camera.position.lerp(desired, Math.min(1, dt * 8 || .09));
    if(this.cameraShake>0){this.camera.position.x+=(Math.random()-.5)*this.cameraShake*.28;this.camera.position.y+=(Math.random()-.5)*this.cameraShake*.27;}
    this.camera.lookAt(this.craft.position.x * .47, this.craft.position.y * .48 + 1, this.craft.position.z - 43);
    const fov = accelerating ? 83 : 71;
    this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*4.5);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(time => this.frame(time));
  }
}
try { new Flight3D(); }
catch (error) {
  console.error('3D flight failed to start', error);
  $('overlay').hidden = false; $('overlay-title').textContent = '3D描画を開始できません';
  $('overlay-info').textContent = 'WebGLを利用できません。Safariの設定と端末のグラフィック機能を確認してください。';
  $('action').hidden = true;
}
