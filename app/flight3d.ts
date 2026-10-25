import * as T from 'three';
import './flight3d.css';
import {createFlightShip,animateFlightShip,createFlightSection,FlightVfx,FlightAtmosphere,disposeFlightVisual} from './flight3d-visuals.ts';
import {cruiseSpeed,boostSpeed,laserSpeed,missileSpeed,enemySpawnRange,displaySpeed,sweptCollision} from './flight3d-tuning.ts';
import {STAGE_DURATION,ROLL_DURATION,ROLL_COOLDOWN,CHARGE_SECONDS,CHARGE_MAX,createRailWaves,formationOffset,trackCenter,trackYaw,clampRail,rollDeflects,bossPhase,type Wave} from './rail-mode.ts';

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
type Shot = { mesh: T.Mesh; velocity: T.Vector3; foe: boolean; power: number; radius: number; homing: boolean; life: number; bomb?: boolean };
type Blast = {mesh:T.Mesh;life:number;duration:number};
type SupplyRing={mesh:T.Mesh;collecting:boolean};
type CorridorHazard={mesh:T.Group;radius:number};
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
  private atmosphere=new FlightAtmosphere();
  private currentSpeed = cruiseSpeed(0);
  private lockTarget: Foe | null = null;
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
  private waveIndex=0;
  private waves: Wave[]=[];
  private brakeHeld=false;
  private fireHeld=false;
  private firePointer:number|null=null;
  private charge=0;
  private rollTime=0;
  private rollCooldown=0;
  private rollSign=1;
  private shotsReflected=0;
  private combo=0;
  private bossPhaseSeen=1;
  private radioRemaining=0;
  private invulnerable = 0;
  private flash = 0;
  private boss: Foe | null = null;
  private pendingSectorChange = false;
  private enemies: Foe[] = [];
  private shots: Shot[] = [];
  private blasts:Blast[]=[];
  private supplies:SupplyRing[]=[];
  private nextSupply=9.5;
  private nextHazard=13;
  private hazards:CorridorHazard[]=[];
  private scenery: T.Group[] = [];
  private baseX = 0;
  private baseY = 0;
  private pointer: number | null = null;
  private lastTouch = { x: 0, y: 0 };
  private keys=new Set<string>();
  private padLast:boolean[]=[];
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
    this.scene.add(this.atmosphere.mesh,this.craft,this.vfx.root);
    this.scene.add(new T.AmbientLight(0x5d7fbb, .32));
    this.attachControls();
    this.resize();
    this.configureSector();
    this.renderOverlay('NOVA STRIKE', 'RAIL FLIGHT / 3Dレールシューティング。<br>ドラッグ操縦・FIRE射撃／長押しチャージ・ROLLで弾をはじく。<br>BOOST／BRAKEで速度制御。', '出撃する');
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.raf = requestAnimationFrame(t => this.frame(t));
    Object.assign(window, { __novaFlight3D: { snapshot: () => ({ state: this.state, stage: this.stage, score: this.score, shield: this.shield, position: this.craft.position.toArray(), enemies:this.enemies.length,shots:this.shots.length,boss:!!this.boss,waveIndex:this.waveIndex,roll:this.rollTime,charge:this.charge,reflected:this.shotsReflected,combo:this.combo }), start: () => this.start(), pause: () => this.pause() } });
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
      const steer=clampRail(this.baseX+(e.clientX-this.lastTouch.x)/this.canvas.clientWidth*26,this.baseY-(e.clientY-this.lastTouch.y)/this.canvas.clientHeight*26);
      this.baseX=steer.x;this.baseY=steer.y;
      this.lastTouch = { x: e.clientX, y: e.clientY };
    });
    const release = (e: PointerEvent) => { if (this.pointer === e.pointerId) this.pointer = null; };
    this.canvas.addEventListener('pointerup', release); this.canvas.addEventListener('pointercancel', release);
    const boost = $('boost');
    boost.addEventListener('pointerdown', e => { e.preventDefault(); this.boostHeld = true; boost.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boost.addEventListener(ev, () => { this.boostHeld = false; boost.classList.remove('on'); });
    const brake=$('brake');
    brake.addEventListener('pointerdown',e=>{e.preventDefault();this.brakeHeld=true;brake.classList.add('on');});
    for(const ev of ['pointerup','pointercancel','pointerleave','lostpointercapture'])
      brake.addEventListener(ev,()=>{this.brakeHeld=false;brake.classList.remove('on');});
    const fire=$('fire');
    fire.addEventListener('pointerdown',e=>{
      if(this.state!=='playing')return;
      e.preventDefault();this.firePointer=e.pointerId;
      fire.setPointerCapture(e.pointerId);this.beginFire();fire.classList.add('on');
    });
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])
      fire.addEventListener(ev,e=>{
        if(this.firePointer!==null && (ev==='lostpointercapture'||this.firePointer===(e as PointerEvent).pointerId)){
          this.firePointer=null;this.endFire();fire.classList.remove('on');
        }
      });
    $('roll-left').addEventListener('click',()=>this.barrelRoll(-1));
    $('roll-right').addEventListener('click',()=>this.barrelRoll(1));
    $('missile').addEventListener('click', () => this.fireMissile());
    $('pause').addEventListener('click', () => this.pause());
    $('action').addEventListener('click', () => { if (this.state === 'paused') this.resume(); else this.start(); });
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','shift','p','escape','m','j','k','q','e','z','x'].includes(key))e.preventDefault();
      if(!this.keys.has(key)&&!e.repeat){
        if(key==='j'||key===' '||key==='z')this.beginFire();
        if(key==='q')this.barrelRoll(-1);
        if(key==='e')this.barrelRoll(1);
      }
      this.keys.add(key);
      if (key === 'p' || key === 'escape') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
      if (key === 'm' && !e.repeat) this.fireMissile();
    });
    window.addEventListener('keyup',e=>{
      const key=e.key.toLowerCase();this.keys.delete(key);
      if((key==='j'||key===' '||key==='z')&&!this.keys.has('j')&&!this.keys.has(' ')&&!this.keys.has('z'))this.endFire();
    });
    window.addEventListener('blur', () => { this.keys.clear();this.boostHeld=false;this.brakeHeld=false;this.fireHeld=false;if(this.state==='playing')this.pause(); });
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
    this.stopObjects();this.padLast=[];this.waveIndex=0;this.rollTime=0;this.rollCooldown=0;this.shotsReflected=0;this.combo=0;this.charge=0;this.fireHeld=false;this.pendingSectorChange=false;this.lockTarget=null;this.stage=0;this.score=0; this.currentSpeed = cruiseSpeed(0); this.cameraShake = 0; this.shield = 5; this.boost = 100;
    this.craft.position.set(0, 0, 0); this.baseX = 0; this.baseY = 0; this.totalTime = 0;
    this.missileDelay = 0; this.invulnerable = 2;
    this.configureSector(); this.state = 'playing'; this.hideOverlay();
    this.camera.position.set(0, 5.2, 15.4); this.camera.fov=71; this.camera.updateProjectionMatrix();
    this.previous = performance.now(); this.unlockAudio(); this.alert('TRUE 3D FLIGHT — SECTOR 01', 2.4);
  }
  private resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.hideOverlay(); this.previous = performance.now(); }
  private pause() {
    if (this.state !== 'playing') return;
    this.state='paused';this.pointer=null;this.boostHeld=false;this.brakeHeld=false;this.fireHeld=false;this.firePointer=null;
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
    for(const b of this.blasts){this.scene.remove(b.mesh);(b.mesh.material as T.Material).dispose();}
    for(const p of this.supplies){this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();}
    this.supplies=[];
    for(const h of this.hazards){this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);}
    this.hazards=[];
    for (const g of this.scenery){this.scene.remove(g);disposeFlightVisual(g);}
    this.vfx.clear();
    this.enemies = []; this.boss = null; this.lockTarget=null; this.shots = []; this.blasts = []; this.scenery = [];
  }
  private configureSector() {
    const p = worlds[this.stage];
    this.scene.background = new T.Color(p.sky);
    this.scene.fog = new T.Fog(p.haze, 64, 260);
    this.atmosphere.setPalette(p.sky,p.haze,p.light);
    this.floorMaterial.color.setHex(p.ground);
    this.terrainMaterial.color.setHex(p.metal);
    this.accentMaterial.color.setHex(p.light);
    for (const g of this.scenery){this.scene.remove(g);disposeFlightVisual(g);}
    this.scenery = [];
    for (let i = 0; i < 16; i++) this.makeScenery(this.craft.position.z - 55 - i * 38, i);
    this.sectorTime=0;this.waveIndex=0;this.bossPhaseSeen=1;this.nextSupply=9.5;this.nextHazard=13;this.waves=createRailWaves(this.stage);this.laserDelay=0;this.lockTarget=null;this.baseX=0;this.baseY=0;this.rollTime=0;this.charge=0;this.fireHeld=false;this.combo=0;
    $('sector').textContent = String(this.stage + 1).padStart(2, '0') + ' / 06 — ' + worldNames[this.stage];
    $('bosswrap').hidden = true; $('progress').style.width = '0%';
  }
  private makeScenery(z: number, index: number) {
    const g=createFlightSection(this.stage,index,z,this.floorMaterial,this.terrainMaterial,this.accentMaterial);
    const center=trackCenter(this.stage,z);g.position.x=center.x;g.position.y=center.y;g.rotation.y=trackYaw(this.stage,z);this.scene.add(g);this.scenery.push(g);
  }
  private spawnSupply(){
    const z=this.craft.position.z-175;
    const lane=Math.sin(this.stage*3.2+this.sectorTime*.55)*5.8;
    const c=trackCenter(this.stage,z);
    const material=new T.MeshStandardMaterial({color:0xffd68a,emissive:0xffa42e,emissiveIntensity:1.35,metalness:.65,roughness:.2,side:T.DoubleSide});
    const ring=new T.Mesh(new T.TorusGeometry(2.45,.22,8,28),material);
    ring.position.set(c.x+lane,c.y+Math.cos(this.sectorTime*.4)*2,z);
    this.scene.add(ring);
    this.supplies.push({mesh:ring,collecting:false});
  }
  private spawnHazard(){
    const z=this.craft.position.z-172,center=trackCenter(this.stage,z);
    const x=Math.sin(this.stage*2.6+this.sectorTime*.67)*5.8;
    const y=Math.cos(this.sectorTime*.53)*2.4;
    const group=new T.Group();
    const shell=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({
      color:0x663d50,emissive:0xb51d41,emissiveIntensity:.55,metalness:.78,roughness:.3,flatShading:true
    }));
    shell.scale.set(2.2,2.0,2.3);group.add(shell);
    const ring=new T.Mesh(new T.TorusGeometry(2.65,.16,6,18),new T.MeshBasicMaterial({color:0xff6686}));
    ring.rotation.x=.64;group.add(ring);
    group.position.set(center.x+x,center.y+y,z);
    this.scene.add(group);this.hazards.push({mesh:group,radius:2.4});
    this.radio('NOVA CONTROL','航路に危険物。撃破するか回避せよ！',2.5);
  }
  private destroyHazard(h:CorridorHazard,score=true){
    if(!this.hazards.includes(h))return;
    const point=h.mesh.position.clone();
    this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);
    this.hazards.splice(this.hazards.indexOf(h),1);
    this.vfx.burst(point,2.3,0xff7391);this.sfx(125,.12);
    if(score){this.score+=450;this.combo++;}
  }
  private spawnFoe(boss = false,lane?:{x:number;y:number;z:number},leader=false) {
    const seed = this.sectorTime * 9.13 + this.enemies.length * 4.3;
    const mesh = createFlightShip(boss ? 0x963d54 : this.stage % 2 ? 0xb26f75 : 0x9d577c, boss, this.stage);
    const x=boss?0:(lane?.x??(rand(seed)-.5)*12);
    const y=boss?1.5:(lane?.y??(rand(seed+4)-.5)*9);
    mesh.rotation.y=Math.PI;
    const spawnZ=this.craft.position.z-(boss?135:enemySpawnRange)-(lane?.z??0);
    const center=trackCenter(this.stage,spawnZ);
    mesh.position.set(center.x+x,center.y+y,spawnZ);
    this.scene.add(mesh);
    const max=boss?180+this.stage*32:leader?14+this.stage*2:this.stage>=3?6:4;
    const foe: Foe = { mesh, hp: max, max, radius: boss ? 8.0 : 2.15, phase: seed, x, y, fire: boss ? 1.3 : 1.3 + rand(seed + 8) * 1.5, boss, points:boss?5000:leader?920+this.stage*100:180+this.stage*65 };
    if(boss){
      this.radio('NOVA CONTROL','巨大敵反応。正面の中枢を狙え！',4);
      this.boss = foe; $('bosswrap').hidden = false; $('boss-name').textContent = 'GUARDIAN / ' + worldNames[this.stage];
      this.alert('WARNING — 3D GUARDIAN', 2.4);
    } else this.enemies.push(foe);
  }
  private fireShot(origin:T.Vector3,velocity:T.Vector3,foe:boolean,power:number,homing=false,bomb=false) {
    if (this.shots.length >= 185) return;
    const mesh = new T.Mesh(shotGeo, foe ? hostile : homing ? missileMat : friendly);
    mesh.position.copy(origin); mesh.scale.set(homing ? .46 : .22, homing ? .46 : .22, homing ? 1.0 : 1.2);
    this.scene.add(mesh);
    this.shots.push({mesh,velocity,foe,power,radius:homing?.68:.3,homing,life:3.2,bomb});
  }
  private aimRay(){
    // Converge the player muzzle onto the chase-camera crosshair. Without
    // correcting third-person parallax, shots miss what the reticle indicates.
    const focal=this.camera.position.clone().addScaledVector(
      this.camera.getWorldDirection(new T.Vector3()),140
    );
    return focal.sub(this.craft.position).normalize();
  }
  private findLock():Foe|null{
    const origin=this.craft.position.clone(),ray=this.aimRay();
    let best:Foe|null=null,rank=Infinity;
    for(const foe of [...this.enemies,...(this.boss?[this.boss]:[])]){
      const delta=foe.mesh.position.clone().sub(origin),depth=delta.dot(ray);
      if(depth<8||depth>220)continue;
      const miss=delta.addScaledVector(ray,-depth).length();
      const tolerance=foe.boss?9.5:Math.max(3.8,depth*.045);
      const score=miss/tolerance+depth*.0006;
      if(miss<tolerance&&score<rank){best=foe;rank=score;}
    }
    return best;
  }
  private beginFire(){
    if(this.state!=='playing'||this.fireHeld)return;
    this.fireHeld=true;this.charge=0;this.laserDelay=0;
    this.fireLasers();
  }
  private endFire(){
    if(!this.fireHeld)return;
    this.fireHeld=false;
    if(this.state==='playing'&&this.charge>=CHARGE_SECONDS){
      const target=this.lockTarget??this.findLock();
      const origin=this.craft.position.clone().add(new T.Vector3(0,.2,-1.8));
      const direction=target?target.mesh.position.clone().sub(origin).normalize():this.aimRay();
      this.fireShot(origin,direction.multiplyScalar(missileSpeed(this.currentSpeed)),false,15,true);
      this.sfx(240,.24);
      this.alert(target?'LOCK-ON / CHARGE HIT':'CHARGE BLAST',.75);
    }
    this.charge=0;
  }
  private barrelRoll(sign:number){
    if(this.state!=='playing'||this.rollCooldown>0)return;
    this.rollSign=sign;this.rollTime=ROLL_DURATION;this.rollCooldown=ROLL_COOLDOWN;
    this.cameraShake=.09;this.sfx(370,.16);
  }
  private fireLasers(){
    if(this.state!=='playing')return;
    const target=this.findLock();this.lockTarget=target;
    for(const sign of [-1,1]){
      const from=this.craft.position.clone().add(new T.Vector3(sign*.75,-.1,-2));
      const dir=this.aimRay();
      if(target)dir.lerp(target.mesh.position.clone().sub(from).normalize(),.26).normalize();
      this.fireShot(from,dir.multiplyScalar(laserSpeed(this.currentSpeed)),false,1);
    }
  }
  private fireMissile() {
    if (this.state !== 'playing' || this.missileDelay > 0) return;
    this.missileDelay = 8.0;
    let target: Foe | null = this.boss, nearest = 200;
    if (!target) for (const e of this.enemies) { const d = this.craft.position.distanceTo(e.mesh.position); if (d < nearest) { target = e; nearest = d; } }
    const from = this.craft.position.clone().add(new T.Vector3(0, -.1, -2));
    const dir = target ? target.mesh.position.clone().sub(from).normalize() : new T.Vector3(0, 0, -1);
    this.fireShot(from,dir.multiplyScalar(missileSpeed(this.currentSpeed)),false,23,true,true);
    this.sfx(170, .19);
    $('missile').classList.add('fired'); setTimeout(() => $('missile').classList.remove('fired'), 150);
  }
  private enemyShot(e: Foe) {
    const origin = e.mesh.position.clone().add(new T.Vector3(0, 0, e.boss ? 3.5 : 1.3));
    const aim = this.craft.position.clone().sub(origin).normalize();
    const phase=e.boss?bossPhase(e.hp,e.max):0;
    const count=e.boss?(phase===1?3:phase===2?5:7):1;
    for(let n=0;n<count;n++){
      const spread=(n-(count-1)/2)*(e.boss?(phase===3?.27:.20):.18);
      const velocity = aim.clone().add(new T.Vector3(spread, Math.sin(e.phase + n) * .065, 0)).normalize().multiplyScalar(e.boss ? 43 : 34 + this.stage * 1.5);
      this.fireShot(origin, velocity, true, 1);
    }
  }
  private hitShip() {
    if (this.invulnerable > 0 || this.state !== 'playing') return;
    this.combo=0;this.shield--; this.invulnerable = 1.65; this.flash = .6; this.cameraShake=.5; this.vfx.burst(this.craft.position,1.6,0xff6e6c); this.sfx(95, .24);
    if (this.shield <= 0) this.finish(false);
  }
  private damageFoe(e: Foe, amount: number) {
    e.hp -= amount;
    if (e.hp > 0) return;
    this.explode(e.mesh.position, e.boss ? 7 : 2.3);
    this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);this.combo++;this.score+=Math.round(e.points*(1+Math.min(12,this.combo)*.12)); this.sfx(e.boss ? 72 : 115, e.boss ? .45 : .10);
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
  private radio(speaker:string,message:string,seconds=3.1){
    $('radio-name').textContent=speaker;
    $('radio-message').textContent=message;
    this.radioRemaining=seconds;$('radio').hidden=false;
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
    this.missileDelay=Math.max(0,this.missileDelay-dt);
    this.rollCooldown=Math.max(0,this.rollCooldown-dt);
    this.rollTime=Math.max(0,this.rollTime-dt);
    this.noticeTime-=dt;
    this.radioRemaining=Math.max(0,this.radioRemaining-dt);
    $('radio').hidden=this.radioRemaining<=0;
    if (this.noticeTime < 0) $('notice').classList.remove('visible');
    const k=this.keys;
    const pad=navigator.getGamepads?.().find(p=>p&&p.connected)??null;
    const pressed=(i:number)=>!!pad?.buttons[i]?.pressed;
    const axis=(i:number)=>Math.abs(pad?.axes[i]??0)>.18?(pad?.axes[i]??0):0;
    if(pad){
      for(const index of [0,1,2,3,9]){
        if(pressed(index)&&!this.padLast[index]){
          if(index===0)this.beginFire();
          if(index===1)this.fireMissile();
          if(index===2)this.barrelRoll(-1);
          if(index===3)this.barrelRoll(1);
          if(index===9)this.pause();
        }
      }
      if(!pressed(0)&&this.padLast[0])this.endFire();
      this.padLast=pad.buttons.map(b=>b.pressed);
    }else{
      if(this.padLast[0])this.endFire();
      this.padLast=[];
    }
    const dx=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'))+axis(0);
    const dy=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))-axis(1);
    const steering=clampRail(this.baseX+dx*dt*14,this.baseY+dy*dt*14);
    this.baseX=steering.x;this.baseY=steering.y;
    const accelerating=(this.boostHeld||k.has('shift')||pressed(5))&&this.boost>0;
    const braking=(this.brakeHeld||k.has('k')||k.has('x')||pressed(4))&&this.boost>0&&!accelerating;
    this.boost=clamp(this.boost+(accelerating?-28:braking?-17:16)*dt,0,100);
    const previousShipPosition=this.craft.position.clone();
    const speed=accelerating?boostSpeed():braking?cruiseSpeed(this.stage)*.48:cruiseSpeed(this.stage);
    this.currentSpeed = speed;
    const pathCenter=trackCenter(this.stage,this.craft.position.z);
    const desiredX=pathCenter.x+this.baseX,desiredY=pathCenter.y+this.baseY;
    this.craft.position.x+=(desiredX-this.craft.position.x)*Math.min(1,dt*11);
    this.craft.position.y+=(desiredY-this.craft.position.y)*Math.min(1,dt*11);
    this.craft.position.z-=speed*dt;
    if(!this.boss&&this.sectorTime<STAGE_DURATION-5&&this.sectorTime>=this.nextHazard){
      this.spawnHazard();this.nextHazard+=13;
    }
    for(const h of [...this.hazards]){
      h.mesh.rotation.y+=dt*.85;h.mesh.rotation.x+=dt*.29;
      if(sweptCollision(previousShipPosition,this.craft.position,h.mesh.position,h.mesh.position,h.radius+.75)){
        this.hitShip();this.destroyHazard(h,false);
      }else if(h.mesh.position.z>this.craft.position.z+24)this.destroyHazard(h,false);
    }
    if(!this.boss&&this.sectorTime<this.waves[this.waves.length-1].at){
      if(this.sectorTime>=this.nextSupply){this.spawnSupply();this.nextSupply+=11.5;}
    }
    for(let i=this.supplies.length-1;i>=0;i--){
      const ring=this.supplies[i];
      ring.mesh.rotation.z+=dt*.9;ring.mesh.rotation.y+=dt*.3;
      const caught=sweptCollision(previousShipPosition,this.craft.position,ring.mesh.position,ring.mesh.position,2.55);
      const expired=ring.mesh.position.z>this.craft.position.z+28;
      if(caught||expired){
        if(caught){
          if(this.shield<5)this.shield++;else this.score+=900;
          this.boost=Math.min(100,this.boost+22);
          this.vfx.burst(ring.mesh.position,2.8,0xffd98a);
          this.sfx(690,.18);this.alert('ENERGY RING / HULL + BOOST',1.1);
        }
        this.scene.remove(ring.mesh);ring.mesh.geometry.dispose();(ring.mesh.material as T.Material).dispose();
        this.supplies.splice(i,1);
      }
    }
    const tilt=-dx*.32-(desiredX-this.craft.position.x)*.09-trackYaw(this.stage,this.craft.position.z)*.4;
    this.craft.rotation.z+=(tilt-this.craft.rotation.z)*Math.min(1,dt*7);
    if(this.rollTime>0)this.craft.rotation.z=tilt+this.rollSign*Math.PI*2*(1-this.rollTime/ROLL_DURATION);
    this.craft.rotation.x = -dy * .08;
    this.craft.visible = this.invulnerable <= 0 || Math.sin(this.totalTime * 34) > -.25;
    animateFlightShip(this.craft,this.totalTime,speed/60);
    this.scenery.forEach((g,i)=>{
      if(g.position.z>this.craft.position.z+55)g.position.z-=this.scenery.length*38;
      const p=trackCenter(this.stage,g.position.z);
      g.position.x=p.x;g.position.y=p.y;g.rotation.y=trackYaw(this.stage,g.position.z);
      if(this.stage===0)g.rotation.z=Math.sin(this.totalTime*.12+i)*.014;
    });
    if(!this.boss&&this.sectorTime>=STAGE_DURATION){
      for(const enemy of this.enemies){this.scene.remove(enemy.mesh);disposeFlightVisual(enemy.mesh,true);}
      this.enemies=[];this.spawnFoe(true);
    }else if(!this.boss){
      while(this.waveIndex<this.waves.length&&this.sectorTime>=this.waves[this.waveIndex].at){
        const wave=this.waves[this.waveIndex++];
        for(let i=0;i<wave.count;i++){
          const lane=formationOffset(wave.kind,i,wave.count,this.sectorTime);
          this.spawnFoe(false,lane,wave.support&&i===Math.floor(wave.count/2));
        }
        if(this.waveIndex===1||this.waveIndex===5||this.waveIndex===9){
          const messages=['敵編隊が進路を塞ぐ。照準を合わせろ！','ブーストとブレーキで位置を調整して！','この先に敵旗艦。装甲部位を破壊せよ！'];
          this.radio(this.waveIndex===5?'ECHO / SUPPORT':'NOVA CONTROL',messages[this.waveIndex===1?0:this.waveIndex===5?1:2],3.5);
          this.alert(['ENEMY FORMATION INBOUND','TIGHT PASSAGE / STAY ALERT','GUARDIAN AHEAD'][this.waveIndex===1?0:this.waveIndex===5?1:2],1.55);
        }
      }
    }
    this.lockTarget=this.findLock();
    if(this.fireHeld){
      this.charge=Math.min(CHARGE_MAX,this.charge+dt);
      this.laserDelay-=dt;
      if(this.charge<CHARGE_SECONDS&&this.laserDelay<=0){this.fireLasers();this.laserDelay=.115;}
    }
    const foes = this.boss ? [...this.enemies, this.boss] : [...this.enemies];
    for (const foe of foes) {
      const foePrevious=foe.mesh.position.clone();
      if(foe.boss){
        const phase=bossPhase(foe.hp,foe.max);
        if(phase>this.bossPhaseSeen){
          this.bossPhaseSeen=phase;
          this.vfx.burst(foe.mesh.position,5,0xffa66e);
          this.radio('NOVA CONTROL',phase===2?'敵旗艦、装甲を展開！射撃パターン変化！':'中枢暴走！集中射撃で決着を！',3.6);
          this.alert('GUARDIAN / PHASE '+phase,1.6);
        }
        foe.mesh.position.z += (this.craft.position.z - 105 - foe.mesh.position.z) * Math.min(1, dt * 2.3);
        const p=trackCenter(this.stage,foe.mesh.position.z);
        foe.mesh.position.x=p.x+Math.sin(this.sectorTime*.65)*5;
        foe.mesh.position.y=p.y+1.5+Math.sin(this.sectorTime*.87)*2.5;
        foe.mesh.rotation.z = Math.sin(this.sectorTime * 1.1) * .11;
      } else {
        foe.mesh.position.z += (21 + this.stage * 3) * dt;
        const p=trackCenter(this.stage,foe.mesh.position.z);
        foe.mesh.position.x=p.x+clamp(foe.x+Math.sin(this.sectorTime*1.7+foe.phase)*1.35,-10,10);
        foe.mesh.position.y=p.y+foe.y+Math.sin(this.sectorTime*2.1+foe.phase)*1.05;
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
      if (!foe.boss && sweptCollision(previousShipPosition,this.craft.position,foePrevious,foe.mesh.position,foe.radius+.65)) {
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
      if(!shot.foe){
        for(const h of [...this.hazards])if(hitSegment(a,shot.mesh.position,h.mesh.position,h.radius+shot.radius)){
          this.destroyHazard(h);shot.life=0;break;
        }
      }
      if(shot.life<=0){this.scene.remove(shot.mesh);this.shots.splice(i,1);continue;}
      if(shot.foe) {
        if(sweptCollision(a,shot.mesh.position,previousShipPosition,this.craft.position,shot.radius+.74)){
          if(rollDeflects(this.rollTime)){
            this.shotsReflected++;this.score+=75;this.vfx.burst(shot.mesh.position,.45,0x89dfff);this.sfx(460,.07);
          }else this.hitShip();
          shot.life=0;
        }
      } else {
        for (const e of foes) {
          if (e.hp > 0 && hitSegment(a, shot.mesh.position, e.mesh.position, shot.radius + e.radius)) { contact = e; break; }
        }
        if(contact){
          const impact=contact.mesh.position.clone();
          this.damageFoe(contact,shot.power);
          if(shot.bomb){
            this.explode(impact,6);
            for(const other of foes)if(other!==contact&&other.hp>0&&other.mesh.position.distanceTo(impact)<17)
              this.damageFoe(other,12);
          }
          shot.life=0;
        }
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
      this.shots=[];
      for(const ring of this.supplies){this.scene.remove(ring.mesh);ring.mesh.geometry.dispose();(ring.mesh.material as T.Material).dispose();}
      this.supplies=[];
      for(const h of this.hazards){this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);}
      this.hazards=[];this.configureSector();
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
    $('altitude').textContent = 'ALT ' + Math.round((this.craft.position.y+15)*75).toString().padStart(4,'0') + ' M';
    $('missile').textContent=this.missileDelay>0?'NOVA '+this.missileDelay.toFixed(1):'NOVA BOMB';
    $('charge-fill').style.width=Math.round(Math.min(1,this.charge/CHARGE_SECONDS)*100)+'%';
    $('fire').classList.toggle('charged',this.charge>=CHARGE_SECONDS);
    $('roll-left').classList.toggle('cooling',this.rollCooldown>0);
    $('roll-right').classList.toggle('cooling',this.rollCooldown>0);
    $('combo').textContent='HITS '+this.combo.toString().padStart(3,'0');
    $('reflect').textContent='REFLECT '+this.shotsReflected;
    $('progress').style.width = Math.min(100, this.sectorTime / STAGE_DURATION * 100) + '%';
    if (this.boss) $('boss-fill').style.width = Math.max(0, this.boss.hp / this.boss.max * 100) + '%';
  }
  private frame(t: number) {
    const dt = Math.min(.035, Math.max(0, (t - (this.previous || t)) / 1000)); this.previous = t;
    if (this.state === 'playing') this.update(dt);
    const accelerating=this.currentSpeed>=boostSpeed();
    const future=trackCenter(this.stage,this.craft.position.z-78);
    const desired=new T.Vector3(this.craft.position.x*.83,this.craft.position.y+5.3,this.craft.position.z+(accelerating?19.3:16.8));
    this.camera.position.lerp(desired, Math.min(1, dt * 8 || .09));
    if(this.cameraShake>0){this.camera.position.x+=(Math.random()-.5)*this.cameraShake*.28;this.camera.position.y+=(Math.random()-.5)*this.cameraShake*.27;}
    this.camera.lookAt(future.x+this.baseX*.37,future.y+this.baseY*.4+1,this.craft.position.z-65);
    this.camera.rotateZ(-this.craft.rotation.z*.09);
    const fov = accelerating ? 83 : 71;
    this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*4.5);
    this.camera.updateProjectionMatrix();
    const marked=this.lockTarget;
    const reticle=$('target-ring');
    const targetExists=marked && (marked===this.boss||this.enemies.includes(marked)) && marked.hp>0;
    if(targetExists){
      const worldPos=marked.mesh.position.clone();
      const ahead=worldPos.sub(this.camera.position).dot(this.camera.getWorldDirection(new T.Vector3()))>0;
      const clip=marked.mesh.position.clone().project(this.camera);
      const visible=ahead&&clip.z>-.95&&clip.z<1&&Math.abs(clip.x)<.93&&Math.abs(clip.y)<.89;
      reticle.hidden=!visible;
      if(visible){
        reticle.style.left=((clip.x+1)*50).toFixed(2)+'%';
        reticle.style.top=((1-clip.y)*50).toFixed(2)+'%';
        $('target-distance').textContent=Math.max(0,Math.round(this.craft.position.distanceTo(marked.mesh.position)))+' M';
        reticle.classList.toggle('boss-lock',marked.boss);
      }
    }else reticle.hidden=true;
    this.atmosphere.follow(this.camera.position);
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
