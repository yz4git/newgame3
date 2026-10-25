import * as T from 'three';
import './flight3d.css';
import {createFlightShip,animateFlightShip,createFlightSection,FlightVfx,FlightAtmosphere,disposeFlightVisual} from './flight3d-visuals.ts';
import {MISSIONS,scriptWaves,formation,routeCenter,laneLimit,dist,normalize,sub,add,mul,clamp,lerp,seed,swept,bossPhase,deflectDuringRoll,routeSelection,missionGrade,clampArena,ROLL_SECONDS,ROLL_REUSE,SOMERSAULT_SECONDS,LOCK_CHARGE,type Mission,type Beat,type Phase,type V3} from './nova64-rules.ts';

const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const vec=(v:V3)=>new T.Vector3(v.x,v.y,v.z);
const plain=(v:T.Vector3):V3=>({x:v.x,y:v.y,z:v.z});
const PALETTES=[
 {sky:0x030916,ground:0x18283a,metal:0x687c92,glow:0x6be6ff,haze:0x142d4f},
 {sky:0x071a2b,ground:0x073d59,metal:0x839aa5,glow:0x6be4de,haze:0x164867},
 {sky:0x0d071f,ground:0x19112e,metal:0x394666,glow:0xd789ff,haze:0x40255f},
 {sky:0x081a2a,ground:0x456b87,metal:0x9bbed2,glow:0x8df4ff,haze:0x29516c},
 {sky:0x051b17,ground:0x163c35,metal:0x537f65,glow:0x8cffe0,haze:0x194b3d},
 {sky:0x180909,ground:0x431c1a,metal:0x73514e,glow:0xff9655,haze:0x6a241d}
];
type Enemy={mesh:T.Group;hp:number;max:number;boss:boolean;elite:boolean;radius:number;phase:number;fire:number;life:number;seed:number;anchor:V3;motion:number;points:number};
type Shot={mesh:T.Mesh;velocity:T.Vector3;friendly:boolean;damage:number;homing:boolean;bomb:boolean;life:number;radius:number;target:Enemy|null};
type Pickup={mesh:T.Mesh;kind:'ring'|'laser'|'bomb'|'repair';radius:number};
type Hazard={mesh:T.Group;radius:number};
type Impact={mesh:T.Mesh;time:number;duration:number};
type Wingmate={mesh:T.Group;name:string;hp:number;fire:number;side:number};
const orb=new T.IcosahedronGeometry(1,1);
const pellet=new T.IcosahedronGeometry(1,0);
const pulseMaterials={friendly:new T.MeshBasicMaterial({color:0x74fae8,toneMapped:false}),hostile:new T.MeshBasicMaterial({color:0xff6184,toneMapped:false}),charge:new T.MeshBasicMaterial({color:0xb4fc66,toneMapped:false}),bomb:new T.MeshBasicMaterial({color:0xffd37a,toneMapped:false})};
function segment(a:T.Vector3,b:T.Vector3,p:T.Vector3,r:number){
 const d=b.clone().sub(a),length2=d.lengthSq();
 const t=length2>1e-8?clamp(p.clone().sub(a).dot(d)/length2,0,1):0;
 return a.clone().addScaledVector(d,t).distanceToSquared(p)<=r*r;
}
class Nova64 {
 private canvas=$<HTMLCanvasElement>('flight');
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(64,1,.1,600);
 private renderer:T.WebGLRenderer;
 private ship=createFlightShip(0xdbebf7);
 private sky=new FlightAtmosphere();
 private vfx=new FlightVfx(matchMedia('(pointer:coarse)').matches);
 private floor=new T.MeshStandardMaterial({color:0x192936,roughness:.83,metalness:.24});
 private metal=new T.MeshStandardMaterial({color:0x6d8799,roughness:.42,metalness:.74});
 private detail=new T.MeshStandardMaterial({color:0x79e2ff,emissive:0x3699b2,emissiveIntensity:.8,metalness:.55});
 private state:Phase='title';
 private previous:Phase='combat';
 private mission:Mission=MISSIONS[0];
 private route:number[]=[0];
 private score=0;private hits=0;private missionHits=0;private missionDamage=0;private shield=100;private maxShield=100;private lives=3;private bombs=3;private laser=1;
 private rings=0;private damage=0;private weaponHeat=0;private charge=0;private charging=false;private invulnerable=0;
 private missionTime=0;private waveIndex=0;private waves:Beat[]=[];
 private checkpoint=false;private restartTime=0;private gateShortcut=false;
 private speed=60;private throttle=0;private heatLocked=false;
 private boss:Enemy|null=null;private enemies:Enemy[]=[];private shots:Shot[]=[];private pickups:Pickup[]=[];
 private hazards:Hazard[]=[];private scenery:T.Group[]=[];private impacts:Impact[]=[];private friends:Wingmate[]=[];
 private startPosition=new T.Vector3();
 private lastPosition=new T.Vector3();private wantX=0;private wantY=0;private yaw=0;private desiredYaw=0;
 private roll=0;private rollDir=1;private rollCooldown=0;private somersault=0;private somersaultCooldown=0;private uturn=0;
 private boost=false;private brake=false;private padBoost=false;private padBrake=false;private bankLeft=false;private bankRight=false;
 private pointer:number|null=null;private pointerX=0;private pointerY=0;private firePointer:number|null=null;
 private keys=new Set<string>();private padButtons:boolean[]=[];
 private lock:Enemy|null=null;private cameraShake=0;private hitFlash=0;private bossPhaseSeen=1;
 private radioTime=0;private alertTime=0;private bleep:AudioContext|null=null;
 private time=0;private raf=0;private mini=$<HTMLCanvasElement>('radar');
 constructor(){
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.45:2));
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=1.35;
  this.scene.add(new T.HemisphereLight(0xc0d9ff,0x10223a,2.2));
  const sun=new T.DirectionalLight(0xffdebb,2.55);sun.position.set(-38,72,26);this.scene.add(sun);
  this.scene.add(this.sky.mesh,this.ship,this.vfx.root);
  this.ship.rotation.y=0;
  this.ship.position.set(0,0,0);
  this.scene.add(new T.AmbientLight(0x5678ac,.25));
  this.attach();
  this.resize();
  this.loadPalette();
  this.updateHUD();
  this.openOverlay('NOVA STRIKE','SPACE FLIGHT CAMPAIGN','完全新設計・3D空間戦闘。<br>編隊を撃破し、宙返り・ロールで回避。ミッション選択でルートが変化する。','START MISSION');
  window.addEventListener('resize',()=>this.resize());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['combat','boss'].includes(this.state))this.pause();});
  Object.assign(window,{__novaFlight3D:{
   snapshot:()=>({state:this.state,mission:this.mission.id,route:this.route.slice(),score:this.score,shield:this.shield,lives:this.lives,mode:this.mission.mode,wingmen:this.friends.map(f=>f.hp),enemies:this.enemies.length,boss:!!this.boss,shots:this.shots.length,phase:bossPhase(this.boss?.hp??0,this.boss?.max??1)}),
   start:()=>this.startCampaign(),pause:()=>this.pause()
  }});
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 private resize(){
  const w=Math.max(innerWidth,1),h=Math.max(innerHeight,1);
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
  const dpr=Math.min(window.devicePixelRatio||1,2);this.mini.width=152*dpr;this.mini.height=152*dpr;
 }
 private startAudio(){try{this.bleep??=new AudioContext();void this.bleep.resume().catch(()=>{});}catch{/**/}}
 private sound(f:number,t=.12,v=.032,shape:OscillatorType='triangle'){
  if(!this.bleep)return;
  try{
   const o=this.bleep.createOscillator(),g=this.bleep.createGain(),at=this.bleep.currentTime;
   o.type=shape;o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(Math.max(35,f*.46),at+t);
   g.gain.setValueAtTime(v,at);g.gain.exponentialRampToValueAtTime(.001,at+t);
   o.connect(g);g.connect(this.bleep.destination);o.start(at);o.stop(at+t);
  }catch{/**/}
 }
 private isPlaying(){return this.state==='combat'||this.state==='boss';}
 private attach(){
  this.canvas.addEventListener('pointerdown',e=>{
   if(!this.isPlaying()||this.pointer!==null)return;e.preventDefault();
   this.pointer=e.pointerId;this.pointerX=e.clientX;this.pointerY=e.clientY;this.canvas.setPointerCapture(e.pointerId);
  });
  this.canvas.addEventListener('pointermove',e=>{
   if(!this.isPlaying()||e.pointerId!==this.pointer)return;e.preventDefault();
   const dx=(e.clientX-this.pointerX)/Math.max(1,this.canvas.clientWidth);
   const dy=(e.clientY-this.pointerY)/Math.max(1,this.canvas.clientHeight);
   if(this.mission.mode==='corridor'){
    this.wantX=clamp(this.wantX+dx*28,-9.4,9.4);this.wantY=clamp(this.wantY-dy*30,-6.7,7.8);
   }else{
    this.wantX=clamp(this.wantX+dx*17,-8,8);this.wantY=clamp(this.wantY-dy*26,-8,8);
   }
   this.pointerX=e.clientX;this.pointerY=e.clientY;
  });
  const release=(e:PointerEvent)=>{if(this.pointer===e.pointerId)this.pointer=null;};
  this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
  const hold=(id:string,down:()=>void,up:()=>void)=>{
   const el=$(id);
   el.addEventListener('pointerdown',e=>{e.preventDefault();down();el.classList.add('active');el.setPointerCapture(e.pointerId);});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{up();el.classList.remove('active');});
  };
  hold('boost',()=>this.boost=true,()=>this.boost=false);
  hold('brake',()=>this.brake=true,()=>this.brake=false);
  hold('fire',()=>this.fireDown(),()=>this.fireUp());
  hold('bank-left',()=>this.bankLeft=true,()=>this.bankLeft=false);
  hold('bank-right',()=>this.bankRight=true,()=>this.bankRight=false);
  $('roll-left').addEventListener('click',()=>this.barrel(-1));
  $('roll-right').addEventListener('click',()=>this.barrel(1));
  $('somersault').addEventListener('click',()=>this.flip());
  $('uturn').addEventListener('click',()=>this.flip(true));
  $('bomb').addEventListener('click',()=>this.launchBomb());
  $('pause').addEventListener('click',()=>this.pause());
  $('action').addEventListener('click',()=>this.primaryAction());
  $('route-a').addEventListener('click',()=>this.chooseRoute(0));
  $('route-b').addEventListener('click',()=>this.chooseRoute(1));
  window.addEventListener('keydown',e=>{
   const key=e.key.toLowerCase();
   if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','q','e','r','f','m','p','escape','shift','control','b','u','enter'].includes(key))e.preventDefault();
   const fresh=!this.keys.has(key)&&!e.repeat;this.keys.add(key);
   if(key==='p'||key==='escape'){if(this.isPlaying())this.pause();else if(this.state==='pause')this.resume();}
   if(!fresh)return;
   if(key===' '||key==='f')this.fireDown();
   if(key==='q')this.barrel(-1);if(key==='e')this.barrel(1);
   if(key==='r')this.flip();if(key==='u')this.flip(true);if(key==='m')this.launchBomb();
   if(key==='enter'&&(this.state==='title'||this.state==='gameover'||this.state==='ending'||this.state==='pause'))this.primaryAction();
  });
  window.addEventListener('keyup',e=>{
   const key=e.key.toLowerCase();this.keys.delete(key);
   if((key===' '||key==='f')&&!this.keys.has(' ')&&!this.keys.has('f'))this.fireUp();
  });
  window.addEventListener('blur',()=>{this.keys.clear();this.boost=this.brake=false;if(this.isPlaying())this.pause();});
 }
 private pollPad(){
  const pad=navigator.getGamepads?.().find(Boolean);
  if(!pad){this.padButtons=[];return;}
  const pressed=(i:number)=>!!pad.buttons[i]?.pressed,axis=(i:number)=>Math.abs(pad.axes[i]??0)>.16?(pad.axes[i]??0):0;
  const events:Record<number,()=>void>={0:()=>this.fireDown(),1:()=>this.launchBomb(),2:()=>this.barrel(-1),3:()=>this.barrel(1),8:()=>this.flip(),9:()=>this.pause()};
  for(const [key,fn] of Object.entries(events)){const id=Number(key);if(pressed(id)&&!this.padButtons[id])fn();}
  if(!pressed(0)&&this.padButtons[0])this.fireUp();
  this.padButtons=pad.buttons.map(b=>b.pressed);
  const sx=axis(0),sy=-axis(1);
  if(this.mission.mode==='corridor'){
   this.wantX=clamp(this.wantX+sx*.36,-9.4,9.4);this.wantY=clamp(this.wantY+sy*.34,-6.7,7.8);
  }else{
   this.wantX=clamp(this.wantX+sx*.17,-8,8);this.wantY=clamp(this.wantY+sy*.25,-8,8);
  }
  this.padBoost=pressed(5);this.padBrake=pressed(4);
 }
 private openOverlay(title:string,kicker:string,info:string,button:string){
  $('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-kicker').textContent=kicker;
  $('overlay-info').innerHTML=info;$('action').textContent=button;$('action').hidden=false;
  $('route-panel').hidden=true;$('controls').hidden=true;
 }
 private hideOverlay(){$('overlay').hidden=true;$('controls').hidden=false;}
 private primaryAction(){
  if(this.state==='pause'){this.resume();return;}
  this.startCampaign();
 }
 private startCampaign(){
  this.startAudio();this.score=0;this.hits=0;this.missionHits=0;this.missionDamage=0;this.shield=100;this.maxShield=100;this.lives=3;this.bombs=3;this.laser=1;
  this.rings=0;this.damage=0;this.route=[0];this.friends=[];
  this.enterMission(0);
 }
 private clearDynamic(){
  for(const e of this.enemies){this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);}
  if(this.boss){this.scene.remove(this.boss.mesh);disposeFlightVisual(this.boss.mesh,true);}
  for(const s of this.shots)this.scene.remove(s.mesh);
  for(const p of this.pickups){this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();}
  for(const h of this.hazards){this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);}
  for(const fx of this.impacts){this.scene.remove(fx.mesh);(fx.mesh.material as T.Material).dispose();}
  for(const g of this.scenery){this.scene.remove(g);disposeFlightVisual(g);}
  for(const ally of this.friends){this.scene.remove(ally.mesh);disposeFlightVisual(ally.mesh,true);}
  this.vfx.clear();
  this.enemies=[];this.boss=null;this.shots=[];this.pickups=[];this.hazards=[];this.impacts=[];this.scenery=[];this.friends=[];this.lock=null;
 }
 private loadPalette(){
  const p=PALETTES[this.mission.scene];
  this.scene.background=new T.Color(p.sky);this.scene.fog=new T.Fog(p.haze,82,320);
  this.sky.setPalette(p.sky,p.haze,p.glow);
  this.floor.color.setHex(p.ground);this.metal.color.setHex(p.metal);this.detail.color.setHex(p.glow);
 }
 private enterMission(id:number,checkpoint=false){
  this.clearDynamic();this.mission=MISSIONS[id];
  if(!checkpoint){this.missionHits=0;this.missionDamage=0;}
  this.waveIndex=0;this.waves=scriptWaves(this.mission);
  this.missionTime=checkpoint?21:0;
  this.checkpoint=checkpoint;this.gateShortcut=false;this.bossPhaseSeen=1;this.hitFlash=0;this.cameraShake=0;
  this.invulnerable=2.3;this.weaponHeat=0;this.charge=0;this.charging=false;this.roll=0;this.rollCooldown=0;this.somersault=0;this.uturn=0;
  this.wantX=this.wantY=0;this.yaw=this.desiredYaw=0;this.boost=this.brake=false;this.speed=60;this.throttle=0;this.heatLocked=false;this.ship.userData.brokenWing=false;
  this.ship.visible=true;this.ship.rotation.set(0,0,0);
  if(checkpoint){this.waveIndex=this.waves.findIndex(w=>w.at>this.missionTime);if(this.waveIndex<0)this.waveIndex=this.waves.length;}
  this.ship.position.set(0,0,0);
  if(this.mission.mode==='corridor')this.ship.position.set(0,0,-this.missionTime*64);
  this.lastPosition.copy(this.ship.position);
  this.startPosition.copy(this.ship.position);
  this.loadPalette();this.makeWorld();
  this.makeFriends();
  this.state='combat';this.hideOverlay();
  $('mode').textContent=this.mission.mode==='all-range'?'ALL-RANGE':'CORRIDOR';
  $('radar-wrap').hidden=this.mission.mode!=='all-range';
  $('uturn').hidden=this.mission.mode!=='all-range';
  $('bosswrap').hidden=true;
  this.camera.position.copy(this.ship.position).add(new T.Vector3(0,5,15));
  this.camera.fov=67;this.camera.updateProjectionMatrix();
  this.broadcast('NOVA COMMAND',this.mission.mode==='all-range'?'全方位戦闘空域に進入。レーダーを確認！':'敵防衛線を突破して目標へ向かえ！',4);
  this.message('MISSION '+String(this.mission.id+1).padStart(2,'0')+' / '+this.mission.name,3.3);
  this.updateHUD();
 }
 private makeWorld(){
  const sceneId=this.mission.scene,all=this.mission.mode==='all-range';
  const count=all?16:18;
  for(let i=0;i<count;i++){
   const z=all?(-190+(i%8)*52):this.ship.position.z-48-i*39;
   const g=createFlightSection(sceneId,i,z,this.floor,this.metal,this.detail);
   if(all){
    g.position.x=(i<8?-1:1)*(100+(i%4)*27);
    g.rotation.y=i*.73;
   }else{
    const route=routeCenter(sceneId,z);g.position.x=route.x;g.position.y=route.y;
   }
   this.scene.add(g);this.scenery.push(g);
  }
 }
 private makeFriends(){
  for(const s of [-1,1]){
   const ally=createFlightShip(s===-1?0x8bd0e8:0xe5b983);
   ally.rotation.y=0;ally.scale.multiplyScalar(.78);
   this.scene.add(ally);
   this.friends.push({mesh:ally,name:s===-1?'ECHO':'VECTA',hp:3,side:s,fire:6+(s===1?2:0)});
  }
 }
 private message(t:string,seconds=1.5){$('notice').textContent=t;$('notice').classList.add('visible');this.alertTime=seconds;}
 private broadcast(who:string,t:string,seconds=3.6){
  $('radio').hidden=false;$('radio-name').textContent=who;$('radio-message').textContent=t;this.radioTime=seconds;
 }
 private pause(){
  if(!this.isPlaying())return;this.previous=this.state;this.state='pause';this.charging=false;this.boost=this.brake=false;
  this.openOverlay('PAUSED','MISSION HOLD','フライトは一時停止中です。<br>このモードでは敵・弾・ミッション時計も停止します。','RESUME');
 }
 private resume(){if(this.state!=='pause')return;this.state=this.previous;this.hideOverlay();}
 private fireDown(){
  if(!this.isPlaying()||this.charging)return;
  this.charging=true;this.charge=0;this.laserShot();
 }
 private fireUp(){
  if(!this.charging)return;
  this.charging=false;
  if(this.isPlaying()&&this.charge>=LOCK_CHARGE)this.chargeShot();
  this.charge=0;
 }
 private aimForward(){
  const aim=this.camera.getWorldDirection(new T.Vector3()).normalize();
  const focus=this.camera.position.clone().addScaledVector(aim,115);
  return focus.sub(this.ship.position).normalize();
 }
 private acquire(){
  const aim=this.aimForward(),from=this.ship.position;
  let best:Enemy|null=null,score=Infinity;
  for(const e of [...this.enemies,...(this.boss?[this.boss]:[])]){
   const delta=e.mesh.position.clone().sub(from),along=delta.dot(aim);
   if(along<5||along>350)continue;
   const miss=delta.addScaledVector(aim,-along).length();
   const tolerance=e.boss?11:Math.max(3.0,along*.044);
   if(miss<tolerance&&miss/tolerance+along*.0007<score){best=e;score=miss/tolerance+along*.0007;}
  }
  return best;
 }
 private shot(from:T.Vector3,dir:T.Vector3,speed:number,damage:number,enemy=false,homing=false,bomb=false,target:Enemy|null=null){
  if(this.shots.length>240)return;
  const m=new T.Mesh(pellet,enemy?pulseMaterials.hostile:bomb?pulseMaterials.bomb:homing?pulseMaterials.charge:pulseMaterials.friendly);
  m.position.copy(from);m.scale.set(bomb?.9:homing?.47:.19,bomb?.9:homing?.47:.19,bomb?2:homing?1.3:1.1);
  this.scene.add(m);
  this.shots.push({mesh:m,velocity:dir.normalize().multiplyScalar(speed),friendly:!enemy,damage,homing,bomb,life:3,radius:bomb?1.3:homing?.57:.27,target});
 }
 private laserShot(){
  if(this.weaponHeat>.05||!this.isPlaying())return;
  const forward=this.aimForward(),target=this.acquire(),level=this.laser;
  for(const s of [-1,1]){
   const origin=this.ship.position.clone().add(new T.Vector3(s*1.05,-.06,-1.5));
   const d=forward.clone();
   if(target)d.lerp(target.mesh.position.clone().sub(origin).normalize(),.12).normalize();
   this.shot(origin,d,300+this.speed,1+(level>1?1:0));
  }
  if(level===3)this.shot(this.ship.position.clone().add(new T.Vector3(0,.3,-1.9)),forward.clone(),315+this.speed,2);
  this.weaponHeat=.115;this.sound(470,.065,.013,'square');
 }
 private chargeShot(){
  const target=this.acquire(),origin=this.ship.position.clone().add(new T.Vector3(0,.18,-1.8));
  const forward=target?target.mesh.position.clone().sub(origin).normalize():this.aimForward();
  this.shot(origin,forward,240+this.speed,13+this.laser*3,false,true,false,target);
  this.sound(680,.23,.045,'sawtooth');this.message(target?'TARGET LOCK / CHARGE':'POWER CHARGE',.9);
 }
 private launchBomb(){
  if(!this.isPlaying()||this.bombs<=0)return;
  const target=this.acquire()??this.boss;
  this.bombs--;
  const origin=this.ship.position.clone().add(new T.Vector3(0,-.2,-2.1));
  this.shot(origin,target?target.mesh.position.clone().sub(origin):this.aimForward(),208+this.speed,35,false,true,true,target);
  this.sound(220,.32,.07,'sawtooth');this.message('NOVA BOMB LAUNCHED',.95);
 }
 private barrel(sign:number){
  if(!this.isPlaying()||this.rollCooldown>0)return;
  this.roll=ROLL_SECONDS;this.rollCooldown=ROLL_REUSE;this.rollDir=sign;
  this.sound(550,.17,.025);this.cameraShake=.08;
 }
 private flip(uturn=false){
  if(!this.isPlaying()||this.somersaultCooldown>0)return;
  if(uturn&&this.mission.mode!=='all-range')return;
  if(this.throttle>.79)return;
  this.somersault=SOMERSAULT_SECONDS;this.somersaultCooldown=1.6;this.uturn=uturn?1:0;this.throttle+=.24;
  if(uturn)this.desiredYaw+=Math.PI;
  this.sound(310,.38,.04);this.message(uturn?'U-TURN':'SOMERSAULT',.85);
 }
 private spawnWave(w:Beat){
  const seedBase=w.at*10+this.mission.id*111;
  for(let i=0;i<w.count;i++){
   const lane=formation(w.type,i,w.count,this.missionTime);
   const pos=this.mission.mode==='corridor'?
     this.ship.position.clone().add(new T.Vector3(lane.x,lane.y+(w.altitude-1)*2,-(154+lane.z))):
     this.ship.position.clone().add(new T.Vector3(Math.sin(i*2.4+w.at)*90,lane.y,Math.cos(i*2.4+w.at)*90));
   if(this.mission.mode==='corridor'){
    const center=routeCenter(this.mission.scene,pos.z);
    pos.x+=center.x;pos.y+=center.y;
   }
   const elite=w.elite&&i===Math.floor(w.count/2);
   const mesh=createFlightShip(elite?0xe5916d:0x925778,false,this.mission.scene);
   mesh.position.copy(pos);mesh.rotation.y=Math.PI;
   this.scene.add(mesh);
   const hp=elite?12:3+Math.floor(this.mission.difficulty*.65);
   this.enemies.push({mesh,hp,max:hp,boss:false,elite,radius:elite?2.8:2.3,
     phase:seed(seedBase+i)*6,fire:1.1+i*.29,life:0,seed:seedBase+i,anchor:plain(pos),motion:i%4,
     points:elite?20:1});
  }
  if(w.elite)this.broadcast('ECHO','装甲機が混じっている。集中射撃を！',2.8);
 }
 private spawnBoss(){
  this.enemies.forEach(e=>{this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);});this.enemies=[];
  const mesh=createFlightShip(0xb04b63,true,this.mission.scene);
  const ahead=this.mission.mode==='all-range'?
   new T.Vector3(Math.sin(this.mission.id)*70,5,Math.cos(this.mission.id)*70):
   this.ship.position.clone().add(new T.Vector3(0,2,-150));
  mesh.position.copy(ahead);
  this.scene.add(mesh);
  const hp=125+this.mission.difficulty*38;
  this.boss={mesh,hp,max:hp,boss:true,elite:true,radius:12,phase:0,fire:1.8,life:0,seed:this.mission.id,anchor:plain(ahead),motion:0,points:80};
  this.state='boss';this.bossPhaseSeen=1;
  $('bosswrap').hidden=false;$('boss-name').textContent=this.mission.boss;
  this.broadcast('NOVA COMMAND','巨大機動兵器を確認！弱点を狙って攻撃せよ！',4);
  this.message('WARNING / '+this.mission.boss,3);
  this.sound(120,.65,.063,'sawtooth');
 }
 private forward(){return new T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));}
 private enemyFire(e:Enemy){
  const from=e.mesh.position.clone();
  let target=this.ship.position.clone();
  // Wingmen attract a minority of incoming shots; rescuing them matters.
  const ally=this.friends.find(x=>x.hp>0);
  if(ally&&seed(this.time*21+e.seed)>.81)target=ally.mesh.position.clone();
  const dir=target.sub(from).normalize();
  const phase=e.boss?bossPhase(e.hp,e.max):0;
  const n=e.boss?(phase===1?3:phase===2?5:7):1;
  for(let i=0;i<n;i++){
   const spread=(i-(n-1)/2)*(e.boss?.13+.04*phase:.04);
   const aim=dir.clone().add(new T.Vector3(spread,Math.sin(e.seed+i)*.03,0)).normalize();
   this.shot(from.clone(),aim,e.boss?78:62+this.mission.difficulty*5,1,true);
  }
 }
 private spawnRing(kind:Pickup['kind']){
  const z=this.mission.mode==='corridor'?this.ship.position.z-170:this.ship.position.z+this.forward().z*95;
  const route=routeCenter(this.mission.scene,z);
  const x=this.mission.mode==='corridor'?route.x+Math.sin(this.missionTime*.7)*6:this.ship.position.x+this.forward().x*95+Math.cos(this.yaw)*Math.sin(this.missionTime)*7;
  const y=this.mission.mode==='corridor'?route.y+Math.sin(this.missionTime*.3)*4:this.ship.position.y;
  const c=kind==='ring'?0xffdf7c:kind==='laser'?0x8afaff:kind==='bomb'?0xffa36a:0x8dffab;
  const m=new T.Mesh(new T.TorusGeometry(kind==='ring'?2.35:1.6,.28,7,24),
    new T.MeshBasicMaterial({color:c}));
  m.position.set(x,y,z);this.scene.add(m);this.pickups.push({mesh:m,kind,radius:2.6});
 }
 private spawnHazard(){
  if(this.mission.mode==='all-range')return;
  const z=this.ship.position.z-166,route=routeCenter(this.mission.scene,z);
  const m=createFlightShip(0x555469,false,this.mission.scene);
  m.scale.setScalar(1.7);m.position.set(route.x+Math.sin(this.missionTime*.42)*6,route.y+Math.cos(this.missionTime*.4)*3,z);
  this.scene.add(m);this.hazards.push({mesh:m,radius:4.0});
  this.broadcast('VECTA','前方に重装甲の障害物！撃破か回避を！',2.4);
 }
 private explosion(pos:T.Vector3,radius=3){
  this.vfx.burst(pos,radius,radius>5?0xffca77:0xff9475);
  const mat=new T.MeshBasicMaterial({color:radius>5?0xffdd9b:0xff9078,transparent:true,opacity:.75,depthWrite:false,blending:T.AdditiveBlending});
  const m=new T.Mesh(orb,mat);m.position.copy(pos);m.scale.setScalar(.2);this.scene.add(m);
  this.impacts.push({mesh:m,time:0,duration:radius>5?.75:.4});
 }
 private hitEnemy(e:Enemy,power:number){
  if(e.hp<=0)return;
  e.hp-=power;this.vfx.burst(e.mesh.position,.38,0x9fffe3);
  if(e.hp>0)return;
  const p=e.mesh.position.clone();
  this.explosion(p,e.boss?10:e.elite?4.5:2.2);
  this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);
  if(e.boss){this.boss=null;this.score+=800;this.hits+=e.points;this.missionHits+=e.points;this.missionClear();return;}
  const idx=this.enemies.indexOf(e);if(idx>=0)this.enemies.splice(idx,1);
  this.hits+=e.points;this.missionHits+=e.points;this.score+=e.points*100;
  if(e.elite&&seed(this.hits+this.time)>.38)this.spawnRing(this.bombs<2?'bomb':'laser');
  this.sound(168,.12,.025);
 }
 private takeHit(points=22){
  if(this.invulnerable>0||!this.isPlaying())return;
  this.shield=Math.max(0,this.shield-points);this.damage+=points;this.missionDamage+=points;this.invulnerable=1.5;
  this.hitFlash=.7;this.cameraShake=.58;this.sound(115,.35,.07,'sawtooth');
  this.explosion(this.ship.position,2.5);
  if(this.shield<=55&&!this.ship.userData.brokenWing){
   this.ship.userData.brokenWing=true;this.laser=Math.min(this.laser,1);
   this.broadcast('ECHO','ウイングが損傷している！修理リングを探せ！',3.1);
  }
  if(this.shield<=0)this.loseShip();
 }
 private loseShip(){
  this.lives--;this.explosion(this.ship.position,8);
  if(this.lives<=0){
   this.state='gameover';this.openOverlay('MISSION FAILED','GAME OVER','TOTAL HITS '+this.hits+'<br>再出撃するとキャンペーンを最初から開始します。','RETRY CAMPAIGN');
  }else{
   this.shield=100;this.ship.userData.brokenWing=false;
   const id=this.mission.id,checkpoint=this.checkpoint;
   this.enterMission(id,checkpoint);this.broadcast('NOVA COMMAND','予備機を投入。再出撃せよ！',3.5);
  }
 }
 private missionClear(){
  this.state='clear';
  this.sound(790,.5,.052);
  this.score+=Math.floor(this.shield)*10+this.friends.filter(a=>a.hp>0).length*400;
  const grade=missionGrade(this.missionHits,this.missionDamage,this.friends.filter(a=>a.hp>0).length);
  try{const best=Number(localStorage.getItem('nova64-best')||'0');if(this.hits>best)localStorage.setItem('nova64-best',String(this.hits));}catch{/**/}
  $('bosswrap').hidden=true;
  if(this.mission.next.length===0){
   this.state='ending';
   this.openOverlay('MISSION COMPLETE','FINAL SECTOR CLEAR','TOTAL HITS '+this.hits+' / GRADE '+grade+'<br>作戦ルート '+this.route.map(x=>MISSIONS[x].name).join(' → '), 'NEW CAMPAIGN');
   return;
  }
  this.state='route';
  $('overlay').hidden=false;$('controls').hidden=true;
  $('overlay-title').textContent='MISSION ACCOMPLISHED';
  $('overlay-kicker').textContent='MISSION '+(this.mission.id+1)+' / '+this.mission.name;
  $('overlay-info').innerHTML='MISSION HITS '+this.missionHits+' / TOTAL '+this.hits+' / GRADE '+grade+'<br>残存部隊 '+this.friends.filter(x=>x.hp>0).length+' / 2<br>次の作戦空域を選択';
  $('action').hidden=true;$('route-panel').hidden=false;
  const possible=this.mission.next;
  const automatic=routeSelection(this.mission,this.missionHits,this.friends.filter(x=>x.hp>0).length,this.gateShortcut);
  const a=MISSIONS[possible[0]],b=possible[1]===undefined?null:MISSIONS[possible[1]];
  $('route-a').textContent=a.name+' / '+a.description;
  $('route-b').hidden=!b;
  if(b){$('route-b').textContent=b.name+' / '+b.description;}
  $('route-suggest').textContent=automatic===a.id?'RECOMMENDED: STANDARD ROUTE':'RECOMMENDED: EXPERT ROUTE';
 }
 private chooseRoute(index:number){
  if(this.state!=='route')return;
  const id=this.mission.next[index];
  if(id===undefined)return;
  this.route.push(id);
  this.shield=Math.min(100,this.shield+30);
  this.enterMission(id);
 }
 private updateFriends(dt:number){
  for(const ally of this.friends){
   if(ally.hp<=0){ally.mesh.visible=false;continue;}
   const forward=this.forward();
   const target=this.ship.position.clone().add(new T.Vector3(ally.side*(this.mission.mode==='corridor'?5.7:8),-1.9,4.7));
   ally.mesh.position.lerp(target,Math.min(1,dt*2.7));
   ally.mesh.rotation.set(0,this.yaw,-ally.side*.09+Math.sin(this.time*2+ally.side)*.04);
   animateFlightShip(ally.mesh,this.time,1);
   ally.fire-=dt;
   if(ally.fire<=0){
    const enemy=this.enemies.find(e=>e.mesh.position.distanceTo(this.ship.position)<105);
    if(enemy){
     const aim=enemy.mesh.position.clone().sub(ally.mesh.position).normalize();
     this.shot(ally.mesh.position.clone(),aim,250,1,false);
     ally.fire=6+seed(this.time*17)*4;
    }else ally.fire=2.2;
   }
  }
 }
 private updateFlight(dt:number){
  const k=this.keys;
  this.pollPad();
  const inputX=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'));
  const inputY=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'));
  const v=laneLimit(this.wantX+inputX*dt*16,this.wantY+inputY*dt*16);
  this.wantX=v.x;this.wantY=v.y;
  const boosting=this.boost||this.padBoost||k.has('shift'),braking=this.brake||this.padBrake||k.has('control')||k.has('b');
  if(this.throttle>=.995)this.heatLocked=true;
  if(this.throttle<.18)this.heatLocked=false;
  const activeBoost=boosting&&!this.heatLocked,activeBrake=braking&&!this.heatLocked&&!activeBoost;
  this.throttle=clamp(this.throttle+(activeBoost||activeBrake?dt*.35:-dt*.27),0,1);
  if(this.throttle>=.995)this.heatLocked=true;
  this.speed=activeBoost?128:activeBrake?26:62+this.mission.difficulty*3;
  this.lastPosition.copy(this.ship.position);
  if(this.mission.mode==='corridor'){
   this.ship.position.z-=this.speed*dt;
   const center=routeCenter(this.mission.scene,this.ship.position.z);
   this.ship.position.x=lerp(this.ship.position.x,center.x+this.wantX,dt*10);
   this.ship.position.y=lerp(this.ship.position.y,center.y+this.wantY,dt*10);
   this.yaw=0;
  }else{
   this.desiredYaw+=this.wantX*dt*.19+inputX*dt*.65;
   this.yaw=lerp(this.yaw,this.desiredYaw,dt*4.5);
   const forward=this.forward();
   this.ship.position.addScaledVector(forward,this.speed*dt);
   this.ship.position.y=clamp(this.ship.position.y+(this.wantY-this.ship.position.y)*dt*.6,-9,16);
   const clamped=clampArena(plain(this.ship.position),285);
   if(dist(clamped,plain(this.ship.position))>1){
    this.desiredYaw+=Math.PI*.96;this.ship.position.set(clamped.x,clamped.y,clamped.z);
    this.message('EDGE OF COMBAT AREA / AUTO TURN',1.3);this.sound(220,.13);
   }
   this.wantX*=Math.max(0,1-dt*1.4);
  }
  const tilt=-this.wantX*.075-inputX*.15+(this.bankRight?-.55:0)+(this.bankLeft?.55:0);
  this.roll=Math.max(0,this.roll-dt);this.rollCooldown=Math.max(0,this.rollCooldown-dt);
  this.somersault=Math.max(0,this.somersault-dt);
  this.somersaultCooldown=Math.max(0,this.somersaultCooldown-dt);
  this.ship.rotation.y=this.yaw;
  this.ship.rotation.z=lerp(this.ship.rotation.z,tilt,dt*5);
  if(this.roll>0)this.ship.rotation.z=tilt+this.rollDir*(1-this.roll/ROLL_SECONDS)*Math.PI*2;
  this.ship.rotation.x=lerp(this.ship.rotation.x,-inputY*.14,dt*5);
  if(this.somersault>0)this.ship.rotation.x=-(1-this.somersault/SOMERSAULT_SECONDS)*Math.PI*2;
  if(this.ship.userData.brokenWing){
   this.ship.rotation.z+=Math.sin(this.time*22)*.035;
   this.speed*=.92;
  }
  this.ship.visible=this.invulnerable<=0||Math.sin(this.time*35)>.15;
  animateFlightShip(this.ship,this.time,activeBoost?2:1);
  this.updateFriends(dt);
  if(this.mission.mode==='corridor'){
   for(const g of this.scenery){
    if(g.position.z>this.ship.position.z+48)g.position.z-=this.scenery.length*39;
    const p=routeCenter(this.mission.scene,g.position.z);
    g.position.x=p.x;g.position.y=p.y;
   }
  }
  this.vfx.update(this.ship.position,this.time,dt,this.speed,activeBoost);
 }
 private updateEnemies(dt:number){
  for(const e of [...this.enemies,...(this.boss?[this.boss]:[])]){
   if(e.hp<=0)continue;
   e.life+=dt;
   const previous=e.mesh.position.clone();
   if(e.boss){
    if(this.mission.mode==='corridor'){
     const zTarget=this.ship.position.z-103;
     e.mesh.position.z=lerp(e.mesh.position.z,zTarget,dt*1.45);
     const center=routeCenter(this.mission.scene,e.mesh.position.z);
     e.mesh.position.x=center.x+Math.sin(e.life*.56)*9.5;
     e.mesh.position.y=center.y+2.1+Math.sin(e.life*.83)*4.5;
     e.mesh.rotation.z=Math.sin(e.life*.6)*.16;
    }else{
     // The boss circles the center of the arena; it does NOT teleport ahead of the player.
     e.mesh.position.x=Math.sin(e.life*.3+this.mission.id)*70;
     e.mesh.position.z=Math.cos(e.life*.3+this.mission.id)*70;
     e.mesh.position.y=5+Math.sin(e.life*.72)*8;
     e.mesh.rotation.y=Math.atan2(this.ship.position.x-e.mesh.position.x,this.ship.position.z-e.mesh.position.z);
    }
    const phase=bossPhase(e.hp,e.max);
    if(phase!==this.bossPhaseSeen){
     this.bossPhaseSeen=phase;this.explosion(e.mesh.position,4);
     this.broadcast('NOVA COMMAND',phase===2?'装甲展開！砲門が増加した！':'中枢が露出！全火力を集中せよ！',3.8);
     this.message('GUARDIAN / PHASE '+phase,1.3);
    }
   }else if(this.mission.mode==='corridor'){
    // Enemies approach camera as the player moves down the authored flight corridor.
    e.mesh.position.z+=dt*(22+this.mission.difficulty*4);
    const c=routeCenter(this.mission.scene,e.mesh.position.z);
    e.mesh.position.x=c.x+e.anchor.x-routeCenter(this.mission.scene,e.anchor.z).x+Math.sin(e.life*1.6+e.phase)*2;
    e.mesh.position.y=c.y+e.anchor.y-routeCenter(this.mission.scene,e.anchor.z).y+Math.cos(e.life*1.8+e.phase)*1.4;
    e.mesh.rotation.z=Math.sin(e.life*1.2+e.phase)*.33;
    if(e.mesh.position.z>this.ship.position.z+22){
     this.scene.remove(e.mesh);disposeFlightVisual(e.mesh,true);this.enemies.splice(this.enemies.indexOf(e),1);continue;
    }
   }else{
    const anchor=vec(e.anchor),toShip=this.ship.position.clone().sub(anchor);
    e.mesh.position.lerp(this.ship.position.clone().addScaledVector(toShip.normalize(),-25),dt*.5);
    e.mesh.position.y+=Math.sin(e.life*1.9+e.phase)*dt*2.6;
    e.mesh.rotation.y=Math.atan2(this.ship.position.x-e.mesh.position.x,this.ship.position.z-e.mesh.position.z);
   }
   e.fire-=dt;
   if(e.fire<=0){
    const range=e.mesh.position.distanceTo(this.ship.position);
    if(range<190){this.enemyFire(e);e.fire=e.boss?1.18-.15*bossPhase(e.hp,e.max):2.3+seed(e.seed)*1.2;}
    else e.fire=.5;
   }
   animateFlightShip(e.mesh,this.time,1);
   if(!e.boss&&swept(plain(this.lastPosition),plain(this.ship.position),plain(previous),plain(e.mesh.position),e.radius+1)){
    this.takeHit();this.hitEnemy(e,999);
   }
  }
 }
 private updateShots(dt:number){
  const candidates=[...this.enemies,...(this.boss?[this.boss]:[])];
  for(let i=this.shots.length-1;i>=0;i--){
   const s=this.shots[i],from=s.mesh.position.clone();
   if(s.homing){
    const target=s.target?.hp&&s.target.hp>0?s.target:this.acquire();
    if(target)s.velocity.lerp(target.mesh.position.clone().sub(s.mesh.position).normalize().multiplyScalar(220+this.speed),Math.min(1,dt*5));
   }
   s.mesh.position.addScaledVector(s.velocity,dt);s.life-=dt;
   if(s.friendly){
    const hazard=this.hazards.find(h=>segment(from,s.mesh.position,h.mesh.position,h.radius+s.radius));
    if(hazard){this.explosion(hazard.mesh.position,4);this.scene.remove(hazard.mesh);disposeFlightVisual(hazard.mesh,true);this.hazards.splice(this.hazards.indexOf(hazard),1);this.hits+=1;this.missionHits+=1;s.life=0;}
    if(s.life>0)for(const e of candidates){
     if(e.hp>0&&segment(from,s.mesh.position,e.mesh.position,e.radius+s.radius)){
      const blast=e.mesh.position.clone();
      this.hitEnemy(e,s.damage);
      if(s.bomb){
       this.explosion(blast,11);
       for(const other of candidates)if(other!==e&&other.hp>0&&other.mesh.position.distanceTo(blast)<25)this.hitEnemy(other,35);
      }
      s.life=0;break;
     }
    }
   }else{
    const hit=swept(plain(from),plain(s.mesh.position),plain(this.lastPosition),plain(this.ship.position),s.radius+1.0);
    if(hit){
     if(deflectDuringRoll(this.roll)){
      this.sound(810,.08,.025);this.score+=20;this.vfx.burst(s.mesh.position,.5,0x8beaff);
     }else this.takeHit(18);
     s.life=0;
    }
    for(const ally of this.friends)if(ally.hp>0&&s.life>0&&segment(from,s.mesh.position,ally.mesh.position,1.7)){
     ally.hp--;s.life=0;this.explosion(ally.mesh.position,1.8);
     if(ally.hp===0)this.broadcast('NOVA COMMAND',ally.name+' の通信が途絶えた！',2.7);
    }
   }
   if(s.life<=0||s.mesh.position.distanceTo(this.ship.position)>355){
    this.scene.remove(s.mesh);this.shots.splice(i,1);
   }
  }
 }
 private updateItems(dt:number){
  for(let i=this.pickups.length-1;i>=0;i--){
   const p=this.pickups[i];p.mesh.rotation.y+=dt*.9;p.mesh.rotation.z+=dt*.35;
   const collected=swept(plain(this.lastPosition),plain(this.ship.position),plain(p.mesh.position),plain(p.mesh.position),p.radius);
   const expired=p.mesh.position.distanceTo(this.ship.position)>285;
   if(collected){
    if(p.kind==='ring'){this.rings++;this.shield=Math.min(this.maxShield,this.shield+18);if(this.rings%3===0)this.maxShield=Math.min(140,this.maxShield+20);}
    if(p.kind==='laser')this.laser=Math.min(3,this.laser+1);
    if(p.kind==='bomb')this.bombs=Math.min(6,this.bombs+1);
    if(p.kind==='repair'){this.shield=this.maxShield;this.ship.userData.brokenWing=false;}
    this.score+=250;this.sound(900,.22,.035);this.message(p.kind.toUpperCase()+' ACQUIRED',1.0);
   }
   if(collected||expired){this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();this.pickups.splice(i,1);}
  }
  for(const h of [...this.hazards]){
   if(swept(plain(this.lastPosition),plain(this.ship.position),plain(h.mesh.position),plain(h.mesh.position),h.radius+1)){
    this.takeHit(31);this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);this.hazards.splice(this.hazards.indexOf(h),1);
   }else if(h.mesh.position.distanceTo(this.ship.position)>290){
    this.scene.remove(h.mesh);disposeFlightVisual(h.mesh,true);this.hazards.splice(this.hazards.indexOf(h),1);
   }
  }
  for(let i=this.impacts.length-1;i>=0;i--){
   const fx=this.impacts[i];fx.time+=dt;
   const t=fx.time/fx.duration;fx.mesh.scale.setScalar(.1+t*5.5);(fx.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,1-t)*.7;
   if(t>=1){this.scene.remove(fx.mesh);(fx.mesh.material as T.Material).dispose();this.impacts.splice(i,1);}
  }
 }
 private update(dt:number){
  this.time+=dt;this.missionTime+=dt;this.weaponHeat=Math.max(0,this.weaponHeat-dt);
  this.invulnerable=Math.max(0,this.invulnerable-dt);this.cameraShake=Math.max(0,this.cameraShake-dt*.9);this.hitFlash=Math.max(0,this.hitFlash-dt*2);
  this.alertTime-=dt;this.radioTime-=dt;
  if(this.alertTime<0)$('notice').classList.remove('visible');
  if(this.radioTime<=0)$('radio').hidden=true;
  if(this.charging)this.charge=Math.min(1.25,this.charge+dt);
  // Winding up a charged shot is deliberate; rapid button presses fire lasers.
  this.updateFlight(dt);
  if(this.state==='combat'){
   while(this.waveIndex<this.waves.length&&this.missionTime>=this.waves[this.waveIndex].at){
    const beat=this.waves[this.waveIndex++];this.spawnWave(beat);
    if(this.waveIndex===1||this.waveIndex===5)this.broadcast('VECTA',this.waveIndex===1?'敵編隊、正面に展開！':'ここから攻撃が激しくなる。慎重に！',3);
   }
   if(this.missionTime>21&&!this.checkpoint){
    this.checkpoint=true;this.shield=Math.min(this.maxShield,this.shield+12);this.message('CHECKPOINT / SHIELD RESTORED',2.2);
   }
   if(this.mission.mode==='corridor'){
    if(Math.floor(this.missionTime/12)!==Math.floor((this.missionTime-dt)/12))this.spawnRing(this.missionTime>30?'repair':'ring');
    if(Math.floor(this.missionTime/17)!==Math.floor((this.missionTime-dt)/17))this.spawnHazard();
    if(Math.floor(this.missionTime/23)!==Math.floor((this.missionTime-dt)/23))this.spawnRing('laser');
   }else if(Math.floor(this.missionTime/12)!==Math.floor((this.missionTime-dt)/12))this.spawnRing(this.missionTime>40?'repair':'ring');
   if(this.missionTime>=this.mission.duration)this.spawnBoss();
  }
  this.lock=this.acquire();
  this.updateEnemies(dt);
  if(!this.isPlaying())return;
  this.updateShots(dt);
  if(!this.isPlaying())return;
  this.updateItems(dt);
  $('hit').style.opacity=String(this.hitFlash);
  this.updateHUD();
 }
 private updateHUD(){
  $('sector').textContent='MISSION '+String(this.mission.id+1).padStart(2,'0')+' / '+this.mission.name;
  $('score').textContent=String(this.missionHits).padStart(3,'0');
  $('points').textContent=String(this.score).padStart(7,'0');
  $('shield-fill').style.width=String(clamp(this.shield/this.maxShield*100,0,100))+'%';
  $('shield-value').textContent=String(Math.round(this.shield))+'/'+this.maxShield;
  $('lives').textContent='SHIP ×'+this.lives;
  $('bomb-count').textContent='×'+this.bombs;
  $('rings').textContent='◯ '+this.rings;
  $('laser').textContent='LASER '+this.laser;
  $('wing-state').textContent=this.ship.userData.brokenWing?'WING DAMAGED':'WING OK';
  $('wing-state').classList.toggle('warning',!!this.ship.userData.brokenWing);
  $('heat-fill').style.width=(this.throttle*100).toFixed(0)+'%';
  $('charge-fill').style.width=(Math.min(1,this.charge/LOCK_CHARGE)*100).toFixed(0)+'%';
  $('fire').classList.toggle('ready',this.charging&&this.charge>=LOCK_CHARGE);
  $('mode').textContent=this.mission.mode==='corridor'?'3D SCROLL':'ALL-RANGE';
  $('speed').textContent=(Math.round(this.speed*12))+' km/h';
  $('progress').style.width=(Math.min(100,this.missionTime/this.mission.duration*100))+'%';
  $('friends').textContent=this.friends.map(a=>a.name+' '+(a.hp>0?'◆'.repeat(a.hp):'LOST')).join(' / ');
  if(this.boss)$('boss-fill').style.width=String(clamp(this.boss.hp/this.boss.max*100,0,100))+'%';
 }
 private renderRadar(){
  if(this.mission.mode!=='all-range'||!this.isPlaying())return;
  const ctx=this.mini.getContext('2d');if(!ctx)return;
  const w=this.mini.width,h=this.mini.height;ctx.clearRect(0,0,w,h);
  const s=w/152;ctx.save();ctx.scale(s,s);
  ctx.fillStyle='rgba(2,15,28,.69)';ctx.fillRect(0,0,152,152);
  ctx.strokeStyle='#5ed8ea66';ctx.strokeRect(1,1,150,150);
  ctx.beginPath();ctx.arc(76,76,59,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(76,5);ctx.lineTo(76,147);ctx.moveTo(5,76);ctx.lineTo(147,76);ctx.stroke();
  const mark=(p:T.Vector3,color:string,r:number)=>{
   const dx=p.x-this.ship.position.x,dz=p.z-this.ship.position.z;
   const px=clamp(76+dx*.36,6,146),py=clamp(76+dz*.36,6,146);
   ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  };
  for(const e of this.enemies)mark(e.mesh.position,'#ff6680',3);
  if(this.boss)mark(this.boss.mesh.position,'#ffc273',6);
  for(const a of this.friends)if(a.hp>0)mark(a.mesh.position,'#8ce7ff',3);
  mark(this.ship.position,'#ffffff',4);
  ctx.restore();
 }
 private cameraFrame(dt:number){
  const dir=this.mission.mode==='corridor'?new T.Vector3(0,0,-1):this.forward();
  const chasing=this.ship.position.clone().addScaledVector(dir,-18.2).add(new T.Vector3(0,5.4,0));
  if(this.state==='title'||this.state==='route'||this.state==='gameover'||this.state==='ending')chasing.y+=1;
  this.camera.position.lerp(chasing,Math.min(1,dt*5.5||.04));
  if(this.cameraShake>0){this.camera.position.x+=(Math.random()-.5)*this.cameraShake*.45;this.camera.position.y+=(Math.random()-.5)*this.cameraShake*.3;}
  const ahead=this.ship.position.clone().addScaledVector(dir,90);
  if(this.mission.mode==='corridor'){
   const c=routeCenter(this.mission.scene,ahead.z);ahead.x=c.x+this.wantX*.32;ahead.y=c.y+this.wantY*.3;
  }
  this.camera.lookAt(ahead);
  this.camera.rotateZ(-this.ship.rotation.z*.11);
  const fov=this.boost?79:this.brake?59:69;
  this.camera.fov=lerp(this.camera.fov,fov,dt*3.5);this.camera.updateProjectionMatrix();
  const ret=$('target-ring');
  const target=this.lock;
  if(target&&this.isPlaying()&&target.hp>0){
   const ndc=target.mesh.position.clone().project(this.camera);
   const shown=Math.abs(ndc.x)<.94&&Math.abs(ndc.y)<.9&&ndc.z>0&&ndc.z<1;
   ret.hidden=!shown;
   if(shown){
    ret.style.left=((ndc.x+1)*50).toFixed(2)+'%';ret.style.top=((1-ndc.y)*50).toFixed(2)+'%';
    $('target-distance').textContent=String(Math.round(target.mesh.position.distanceTo(this.ship.position)))+' M';
   }
  }else ret.hidden=true;
  this.sky.follow(this.camera.position);
  this.renderer.render(this.scene,this.camera);
  this.renderRadar();
 }
 private frame(t:number){
  const dt=Math.min(.034,Math.max(0,(t-(this.timeStamp||t))/1000));this.timeStamp=t;
  if(this.isPlaying())this.update(dt);
  this.cameraFrame(dt);
  this.raf=requestAnimationFrame(time=>this.frame(time));
 }
 private timeStamp=0;
}
try{new Nova64();}
catch(error){
 console.error('NovaStrike 3D mode could not start',error);
 $('overlay').hidden=false;$('overlay-title').textContent='3Dモードを起動できません';
 $('overlay-info').textContent='WebGLの利用可能状況を確認してください。';
 $('action').hidden=true;
}
