import * as T from 'three';
import './flight3d.css';
import {createFlightShip,animateFlightShip,FlightVfx,FlightAtmosphere,disposeFlightVisual} from './flight3d-visuals.ts';
import {GroundWorld,heightAt,gateCount,waterLevel,coastZone} from './flight-terrain.ts';
import {createFirstStageBoss,animateFirstStageBoss} from './flight-boss-visuals.ts';
import {RAIL_X_MAX,RAIL_Y_MIN,RAIL_Y_MAX,railCameraPan,railCameraPanY,railViewportOffset,railEdgeWarning,railMoveTarget,railAimPoint} from './flight-corridor-scroll.ts';
import {MISSIONS,scriptWaves,formation,routeCenter,laneLimit,dist,clamp,lerp,seed,swept,bossPhase,deflectDuringRoll,routeSelection,missionGrade,clampArena,ROLL_SECONDS,ROLL_REUSE,SOMERSAULT_SECONDS,LOCK_CHARGE,type Mission,type Phase,type V3} from './nova64-rules.ts';

/**
 * NovaStrike GROUND FLIGHT — rebuilt 3D arcade campaign.
 *
 * Stage 1: authored sequence of coastal meadows/city/roads -> canyon river ->
 * seven physical stone arches -> waterfall -> large guardian. No skybox-only
 * "terrain": the camera actually flies 13-18m over a tessellated heightfield.
 * All worlds have their own ground meshes, structures and collision volumes.
 */
const $=<E extends HTMLElement=HTMLElement>(name:string)=>document.getElementById(name) as E;
const P=(p:T.Vector3):V3=>({x:p.x,y:p.y,z:p.z});
const DIR=(a:T.Vector3,b:T.Vector3)=>b.clone().sub(a).normalize();
type State=Phase;
type Target={model:T.Group;position:T.Vector3;hp:number;max:number;radius:number;boss:boolean;ground:boolean;phase:number;age:number;fire:number;points:number;rescue:boolean;seed:number;side:number};
type Projectile={mesh:T.Mesh;velocity:T.Vector3;friendly:boolean;homing:boolean;bomb:boolean;damage:number;radius:number;life:number;target:Target|null};
type Supply={mesh:T.Mesh;kind:'ring'|'laser'|'repair'|'bomb';radius:number};
type Flash={mesh:T.Mesh;life:number;duration:number};
type Ally={mesh:T.Group;name:string;hp:number;side:number;cooldown:number};
const orb=new T.IcosahedronGeometry(1,1),boltGeo=new T.IcosahedronGeometry(1,0),boxGeo=new T.BoxGeometry(1,1,1),coneGeo=new T.ConeGeometry(1,1,8);
const allyColors=[0x84dcf2,0xf5c493],enemyColors=[0x9b5575,0xc67c65,0x704f96];
const laserMat=new T.MeshBasicMaterial({color:0x8dffc9,toneMapped:false});
const hostileMat=new T.MeshBasicMaterial({color:0xff6985,toneMapped:false});
const chargedMat=new T.MeshBasicMaterial({color:0xb9f75f,toneMapped:false});
const bombMat=new T.MeshBasicMaterial({color:0xffe095,toneMapped:false});
const t = (time:number) => Math.max(0,time);
const palette=[
 {sky:0x668cad,haze:0x91b4b5,light:0xffefd6},
 {sky:0x4b879d,haze:0x80b6bd,light:0xebefff},
 {sky:0x52678e,haze:0x9198b1,light:0xffd9d7},
 {sky:0x6696bd,haze:0xa5c6d3,light:0xffffff},
 {sky:0x597f75,haze:0x8db6a4,light:0xe7ffd1},
 {sky:0x6e4151,haze:0xb77c79,light:0xffb47f}
];

class GroundFlight {
 private canvas=$<HTMLCanvasElement>('flight');
 private scene=new T.Scene();
 private camera=new T.PerspectiveCamera(63,1,.1,750);
 private renderer:T.WebGLRenderer;
 private terrain=new GroundWorld();
 private sky=new FlightAtmosphere();
 private vfx=new FlightVfx(matchMedia('(pointer:coarse)').matches);
 private player=createFlightShip(0xdee6f0);
 private mission:Mission=MISSIONS[0];
 private stage:State='title';private pausedFrom:State='combat';
 private route:number[]=[0];
 private score=0;private hits=0;private missionHits=0;private missionDamage=0;
 private shield=100;private shieldMax=100;private lives=3;private bombs=3;private laserLevel=1;private rings=0;private damagedWing=false;
 private enemies:Target[]=[];private boss:Target|null=null;private shots:Projectile[]=[];
 private supplies:Supply[]=[];private blasts:Flash[]=[];private allies:Ally[]=[];
 private waves=scriptWaves(this.mission);private waveIndex=0;private missionTime=0;
 private levelEvent=0;private checkpoint=false;private rescueFinished=false;private rescueCount=0;private gateBonus=false;
 private laneX=0;private laneY=1.2;private cameraPanX=0;private yaw=0;private targetYaw=0;private velocity=74;
 private boostHeld=false;private brakeHeld=false;private padBoost=false;private padBrake=false;private leftBank=false;private rightBank=false;private keys=new Set<string>();
 private heat=0;private overheated=false;private charge=0;private fireHeld=false;private shotDelay=0;
 private roll=0;private rollDir=1;private rollCooldown=0;private loopTime=0;private loopCooldown=0;private turnAround=0;private invulnerable=0;private respawnBlink=false;
 private pointer:number|null=null;private pX=0;private pY=0;private gamepadLast:boolean[]=[];
 private currentTarget:Target|null=null;private previousPosition=new T.Vector3();private time=0;private lastFrame=0;
 private noticeTime=0;private radioTime=0;private cameraShake=0;private damageFlash=0;private audio:AudioContext|null=null;
 private averageFps=60;
 private bossStage=1;private raf=0;private radar=$<HTMLCanvasElement>('radar');
 constructor(){
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
  const mobile=matchMedia('(pointer:coarse)').matches;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.9));
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=1.28;
  this.scene.add(new T.HemisphereLight(0xb6d8ef,0x24342e,2.45));
  const sun=new T.DirectionalLight(0xffedcb,2.75);sun.position.set(-75,110,-45);this.scene.add(sun);
  this.player.rotation.y=0;
  this.player.scale.setScalar(1.21);
  this.scene.add(this.terrain.root,this.player,this.sky.mesh,this.vfx.root);
  this.scene.add(new T.AmbientLight(0x99bcca,.15));
  this.bind();this.resize();this.setPalette();
  this.terrain.configure(0,0,false);
  this.camera.position.set(0,8,16);
  this.overlay('NOVA STRIKE','3D GROUND FLIGHT',
   '地上すれすれを飛行する3Dシューティング。都市・道路・水面・渓谷が続く実在する立体ステージ。<br>前方の敵を狙い、ロール・ブースト・チャージを駆使して突破せよ。','START');
  window.addEventListener('resize',()=>this.resize());
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.playing)this.pause();});
  Object.assign(window,{__novaFlight3D:{snapshot:()=>({phase:this.stage,mission:this.mission.id,mode:this.mission.mode,
    groundHeight:heightAt(this.mission.scene,this.player.position.x,this.player.position.z),
    altitude:this.player.position.y-heightAt(this.mission.scene,this.player.position.x,this.player.position.z),
    player:this.player.position.toArray(),terrainTiles:this.terrain.tilesCount,
    gates:{...this.terrain.gateState},rescue:this.rescueFinished,targets:this.enemies.length,shots:this.shots.length,
    hits:this.missionHits,shield:this.shield,boss:this.boss!==null,missionTime:this.missionTime,fps:this.averageFps,
    laneX:this.laneX,cameraPanX:this.cameraPanX,shipViewportOffset:railViewportOffset(this.laneX),cameraX:this.camera.position.x,
    shipNdcX:this.player.position.clone().project(this.camera).x,
    sightFarX:($('sight-far') as HTMLElement).style.left,
    cameraInsideSolid:this.terrain.collisions(P(this.camera.position),P(this.camera.position),2.5)?.kind??null}),
    start:()=>this.startCampaign(),pause:()=>this.pause(),
    auditSeek:(seconds:number)=>this.auditSeek(seconds),
    auditSetLane:(x:number)=>this.auditSetLane(x)}});
  this.raf=requestAnimationFrame(now=>this.frame(now));
 }
 private get playing(){return this.stage==='combat'||this.stage==='boss';}
 private resize(){
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
  const dpr=Math.min(2,devicePixelRatio||1);this.radar.width=152*dpr;this.radar.height=152*dpr;
 }
 private sound(freq:number,duration=.13,volume=.032){
  if(!this.audio)return;
  try{
   const osc=this.audio.createOscillator(),g=this.audio.createGain();
   const now=this.audio.currentTime;
   osc.type=freq<200?'sawtooth':'triangle';osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.4),now+duration);
   g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+duration);
   osc.connect(g);g.connect(this.audio.destination);osc.start(now);osc.stop(now+duration);
  }catch{/**/}
 }
 private wakeAudio(){try{this.audio??=new AudioContext();void this.audio.resume().catch(()=>{});}catch{/**/}}
 private bind(){
  this.canvas.addEventListener('pointerdown',e=>{
   if(!this.playing||this.pointer!==null)return;
   e.preventDefault();this.pointer=e.pointerId;this.pX=e.clientX;this.pY=e.clientY;this.canvas.setPointerCapture(e.pointerId);
  });
  this.canvas.addEventListener('pointermove',e=>{
   if(!this.playing||this.pointer!==e.pointerId)return;e.preventDefault();
   const x=(e.clientX-this.pX)/Math.max(1,this.canvas.clientWidth);
   const y=(e.clientY-this.pY)/Math.max(1,this.canvas.clientHeight);
   if(this.mission.mode==='corridor')this.laneX=railMoveTarget(this.laneX,x*97);
   else this.laneX=clamp(this.laneX+x*30,-9.4,9.4);
   this.laneY=clamp(this.laneY-y*29,RAIL_Y_MIN,RAIL_Y_MAX);
   this.pX=e.clientX;this.pY=e.clientY;
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])
   this.canvas.addEventListener(ev,e=>{if((e as PointerEvent).pointerId===this.pointer)this.pointer=null;});
  const hold=(id:string,down:()=>void,up:()=>void)=>{
   const el=$(id);
   el.addEventListener('pointerdown',e=>{
    if(!this.playing)return;e.preventDefault();down();el.classList.add('active');el.setPointerCapture(e.pointerId);
   });
   for(const name of ['pointerup','pointercancel','lostpointercapture'])
    el.addEventListener(name,()=>{up();el.classList.remove('active');});
  };
  hold('boost',()=>this.boostHeld=true,()=>this.boostHeld=false);
  hold('brake',()=>this.brakeHeld=true,()=>this.brakeHeld=false);
  hold('fire',()=>this.fireDown(),()=>this.fireUp());
  hold('bank-left',()=>this.leftBank=true,()=>this.leftBank=false);
  hold('bank-right',()=>this.rightBank=true,()=>this.rightBank=false);
  $('roll-left').addEventListener('click',()=>this.barrel(-1));
  $('roll-right').addEventListener('click',()=>this.barrel(1));
  $('somersault').addEventListener('click',()=>this.flip(false));
  $('uturn').addEventListener('click',()=>this.flip(true));
  $('bomb').addEventListener('click',()=>this.dropBomb());
  $('pause').addEventListener('click',()=>this.pause());
  $('action').addEventListener('click',()=>{if(this.stage==='pause')this.resume();else if(this.stage==='route')this.advance();else this.startCampaign();});
  $('route-a').addEventListener('click',()=>this.advance());
  $('route-b').addEventListener('click',()=>this.advance());
  window.addEventListener('keydown',e=>{
   const k=e.key.toLowerCase();
   if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','q','e','r','u','m','shift','control','b','f','escape','p','enter'].includes(k))e.preventDefault();
   const fresh=!this.keys.has(k)&&!e.repeat;this.keys.add(k);
   if(k==='p'||k==='escape'){if(this.playing)this.pause();else if(this.stage==='pause')this.resume();}
   if(!fresh)return;
   if(k===' '||k==='f')this.fireDown();if(k==='q')this.barrel(-1);if(k==='e')this.barrel(1);
   if(k==='r')this.flip(false);if(k==='u')this.flip(true);if(k==='m')this.dropBomb();
   if(k==='enter'&&['title','route','pause','gameover','ending'].includes(this.stage)){
    if(this.stage==='pause')this.resume();else if(this.stage==='route')this.advance();else this.startCampaign();
   }
  });
  window.addEventListener('keyup',e=>{
   const k=e.key.toLowerCase();this.keys.delete(k);
   if((k===' '||k==='f')&&!this.keys.has(' ')&&!this.keys.has('f'))this.fireUp();
  });
  window.addEventListener('blur',()=>{this.keys.clear();this.padBoost=this.padBrake=this.boostHeld=this.brakeHeld=false;if(this.playing)this.pause();});
 }
 private gamepad(dt:number){
  const pad=navigator.getGamepads?.().find(g=>g&&g.connected);
  if(!pad){this.gamepadLast=[];this.padBoost=this.padBrake=false;return;}
  const on=(i:number)=>pad.buttons[i]?.pressed||false;
  const axis=(i:number)=>Math.abs(pad.axes[i]||0)>.17?pad.axes[i]:0;
  const commands:Record<number,()=>void>={0:()=>this.fireDown(),1:()=>this.dropBomb(),2:()=>this.barrel(-1),3:()=>this.barrel(1),8:()=>this.flip(false),9:()=>this.pause()};
  for(const [idx,fn] of Object.entries(commands))if(on(+idx)&&!this.gamepadLast[+idx])fn();
  if(!on(0)&&this.gamepadLast[0])this.fireUp();
  this.gamepadLast=pad.buttons.map(b=>b.pressed);
  this.laneX=this.mission.mode==='corridor'?railMoveTarget(this.laneX,axis(0)*dt*49):clamp(this.laneX+axis(0)*dt*31,-9.4,9.4);
  this.laneY=clamp(this.laneY-axis(1)*dt*26,RAIL_Y_MIN,RAIL_Y_MAX);
  this.padBoost=on(5);this.padBrake=on(4);
 }
 private setPalette(){
  const p=palette[this.mission.scene];
  this.scene.background=new T.Color(p.sky);
  this.scene.fog=new T.Fog(p.haze,115,580);
  this.sky.setPalette(p.sky,p.haze,p.light);
 }
 private overlay(title:string,kicker:string,info:string,button:string){
  $('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-kicker').textContent=kicker;
  $('overlay-info').innerHTML=info;$('action').textContent=button;$('action').hidden=false;
  $('route-panel').hidden=true;$('controls').hidden=true;
 }
 private closeOverlay(){$('overlay').hidden=true;$('controls').hidden=false;}
 private notice(message:string,seconds=1.75){
  $('notice').textContent=message;$('notice').classList.add('visible');this.noticeTime=seconds;
 }
 private comms(pilot:string,message:string,seconds=3.3){
  $('radio').dataset.pilot=pilot;
  $('radio-name').textContent=pilot;$('radio-message').textContent=message;
  $('radio').hidden=false;this.radioTime=seconds;
 }
 private startCampaign(){
  this.wakeAudio();this.score=0;this.hits=0;this.lives=3;this.bombs=3;this.laserLevel=1;this.rings=0;this.shieldMax=100;this.shield=100;
  this.route=[0];this.enterMission(0,false);
 }
 private cleanup(){
  for(const e of this.enemies){this.scene.remove(e.model);disposeFlightVisual(e.model,true);}
  if(this.boss){this.scene.remove(this.boss.model);disposeFlightVisual(this.boss.model,true);}
  for(const s of this.shots)this.scene.remove(s.mesh);
  for(const s of this.supplies){this.scene.remove(s.mesh);s.mesh.geometry.dispose();(s.mesh.material as T.Material).dispose();}
  for(const f of this.blasts){this.scene.remove(f.mesh);(f.mesh.material as T.Material).dispose();}
  for(const a of this.allies){this.scene.remove(a.mesh);disposeFlightVisual(a.mesh,true);}
  this.vfx.clear();
  this.enemies=[];this.boss=null;this.shots=[];this.supplies=[];this.blasts=[];this.allies=[];this.currentTarget=null;
 }
 private enterMission(id:number,resume=false){
  this.cleanup();
  this.mission=MISSIONS[id];this.setPalette();
  this.missionTime=resume?22:0;this.missionHits=resume?this.missionHits:0;this.missionDamage=resume?this.missionDamage:0;
  this.waves=scriptWaves(this.mission);
  this.waveIndex=resume?Math.max(0,this.waves.findIndex(w=>w.at>this.missionTime)):0;
  if(this.waveIndex<0)this.waveIndex=this.waves.length;
  this.checkpoint=resume;this.rescueFinished=false;this.rescueCount=0;this.gateBonus=false;this.levelEvent=0;
  this.roll=this.rollCooldown=this.loopTime=this.loopCooldown=this.charge=this.heat=this.shotDelay=0;
  this.invulnerable=resume?2.3:4.2;this.respawnBlink=resume;this.overheated=false;this.fireHeld=false;this.boostHeld=this.brakeHeld=false;
  this.laneX=0;this.laneY=2;this.cameraPanX=0;this.yaw=this.targetYaw=0;this.velocity=75;this.damagedWing=false;
  this.player.position.set(0,2,resume?-this.missionTime*75:0);this.player.rotation.set(0,0,0);
  this.previousPosition.copy(this.player.position);
  this.terrain.configure(this.mission.scene,this.player.position.z,this.mission.mode==='all-range');
  this.scene.add(this.terrain.root);
  this.allies=[-1,1].map((side,i)=>{
   const mesh=createFlightShip(allyColors[i]);mesh.rotation.y=0;mesh.scale.multiplyScalar(.72);
   this.scene.add(mesh);
   return{mesh,name:i===0?'ECHO':'VECTA',hp:3,side,cooldown:4+i*3};
  });
  this.stage='combat';this.closeOverlay();
  $('mode').textContent=this.mission.mode==='all-range'?'ALL-RANGE':'GROUND FLIGHT';
  $('radar-wrap').hidden=this.mission.mode!=='all-range';
  $('uturn').hidden=this.mission.mode!=='all-range';
  $('bosswrap').hidden=true;
  this.camera.position.copy(this.player.position).add(new T.Vector3(0,5.6,15));
  this.camera.fov=65;this.camera.updateProjectionMatrix();
  this.notice('MISSION '+String(id+1).padStart(2,'0')+' / '+this.mission.name,1.8);
  this.comms('NOVA CONTROL',id===0?'海沿いの都市防衛線を突破！ビルと橋を避けて低空を飛べ。':'ミッション開始。地形と敵配置をよく見て進め！',4);
  this.refreshHUD();
 }
 private pause(){if(!this.playing)return;this.pausedFrom=this.stage;this.stage='pause';this.fireHeld=false;this.boostHeld=this.brakeHeld=false;this.overlay('PAUSE','MISSION HOLD','ゲーム進行は停止しています。','CONTINUE');}
 private resume(){if(this.stage!=='pause')return;this.stage=this.pausedFrom;this.closeOverlay();}
 private fireDown(){
  if(!this.playing||this.fireHeld)return;this.fireHeld=true;this.charge=0;this.shotDelay=0;this.fireLasers();
 }
 private fireUp(){
  if(!this.fireHeld)return;this.fireHeld=false;
  if(this.playing&&this.charge>=LOCK_CHARGE)this.fireCharge();
  this.charge=0;
 }
 private barrel(dir:number){
  if(!this.playing||this.rollCooldown>0)return;
  this.roll=ROLL_SECONDS;this.rollCooldown=ROLL_REUSE;this.rollDir=dir;this.sound(470,.14,.035);this.cameraShake=.1;
 }
 private flip(uturn:boolean){
  if(!this.playing||this.loopCooldown>0)return;
  if(uturn&&this.mission.mode!=='all-range')return;
  if(this.heat>.87)return;
  this.loopTime=SOMERSAULT_SECONDS;this.loopCooldown=2;this.heat+=.18;
  if(uturn){this.targetYaw+=Math.PI;this.turnAround=1;}
  this.notice(uturn?'U-TURN':'SOMERSAULT',.85);this.sound(360,.35,.048);
 }
 private forward(){
  return this.mission.mode==='all-range'?new T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)):new T.Vector3(0,0,-1);
 }
 private aim(){
  if(this.mission.mode==='corridor'){
   const p=railAimPoint(this.mission.scene,this.player.position.z,this.laneX,this.laneY,145);
   return new T.Vector3(p.x,p.y,p.z).sub(this.player.position).normalize();
  }
  const focus=this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(new T.Vector3()),170);
  return focus.sub(this.player.position).normalize();
 }
 private acquire(){
  const direction=this.aim(),origin=this.player.position;
  let best:Target|null=null,score=Infinity;
  for(const e of [...this.enemies,...(this.boss?[this.boss]:[])]){
   if(e.hp<=0)continue;
   const to=e.position.clone().sub(origin),along=to.dot(direction);
   if(along<6||along>320)continue;
   const spread=to.addScaledVector(direction,-along).length();
   const tolerance=e.boss?13:Math.max(3.5,along*.045);
   const rank=spread/tolerance+along*.00045;
   if(spread<tolerance&&rank<score){best=e;score=rank;}
  }
  return best;
 }
 private emit(position:T.Vector3,velocity:T.Vector3,damage:number,friendly:boolean,homing=false,bomb=false,target:Target|null=null){
  if(this.shots.length>=225)return;
  const material=friendly?(bomb?bombMat:homing?chargedMat:laserMat):hostileMat;
  const mesh=new T.Mesh(boltGeo,material);mesh.position.copy(position);
  mesh.scale.setScalar(bomb?.85:homing?.5:.25);
  this.scene.add(mesh);
  this.shots.push({mesh,velocity,damage,friendly,homing,bomb,target,radius:bomb?1.4:homing?.65:.32,life:3});
 }
 private fireLasers(){
  if(!this.playing||this.shotDelay>0)return;
  const target=this.acquire(),forward=this.aim();
  for(const s of [-1,1]){
   const origin=this.player.position.clone().add(new T.Vector3(s*1.05,-.1,-1.5));
   const aim=forward.clone();
   if(target)aim.lerp(target.position.clone().sub(origin).normalize(),.12).normalize();
   this.emit(origin,aim.multiplyScalar(360+this.velocity),1+(this.laserLevel>1?1:0),true);
  }
  if(this.laserLevel>=3)this.emit(this.player.position.clone().add(new T.Vector3(0,.3,-1.4)),forward.multiplyScalar(390+this.velocity),2,true);
  this.shotDelay=.12;this.sound(640,.065,.018);
 }
 private fireCharge(){
  const target=this.acquire(),origin=this.player.position.clone().add(new T.Vector3(0,.2,-1.8));
  const direction=target?target.position.clone().sub(origin).normalize():this.aim();
  this.emit(origin,direction.multiplyScalar(270+this.velocity),16+this.laserLevel*3,true,true,false,target);
  this.notice(target?'CHARGE / LOCKED':'CHARGE LASER',.85);this.sound(850,.25,.05);
 }
 private dropBomb(){
  if(!this.playing||this.bombs<=0)return;
  this.bombs--;
  const target=this.acquire()??this.boss;
  const origin=this.player.position.clone().add(new T.Vector3(0,-.1,-1.9));
  const direction=target?target.position.clone().sub(origin).normalize():this.aim();
  this.emit(origin,direction.multiplyScalar(240+this.velocity),46,true,true,true,target);
  this.notice('NOVA BOMB',.8);this.sound(240,.32,.07);
 }
 private makeEnemy(pos:T.Vector3,elite=false,ground=false,rescue=false){
  const model=ground?new T.Group():createFlightShip(elite?0xc59170:enemyColors[this.mission.scene%3],false);
  if(ground){
   const armor=new T.MeshStandardMaterial({color:0x677c83,metalness:.8,roughness:.32,flatShading:true});
   const glow=new T.MeshBasicMaterial({color:0xff937a});
   const shell=new T.Mesh(boxGeo,armor);shell.scale.set(4.2,3,4.4);shell.position.y=1.4;model.add(shell);
   const head=new T.Mesh(coneGeo,armor);head.rotation.x=-Math.PI/2;head.scale.set(1.2,2.5,1.2);head.position.set(0,3.35,-1.8);model.add(head);
   const core=new T.Mesh(orb,glow);core.scale.set(.72,.65,.7);core.position.set(0,2,-2.25);model.add(core);
  }else model.rotation.y=Math.PI;
  model.position.copy(pos);this.scene.add(model);
  const hp=ground?7:elite?12:4;
  const enemy:Target={model,position:model.position,hp,max:hp,radius:ground?2.8:elite?3:2.3,age:0,boss:false,ground,phase:seed(this.time*11+pos.z),fire:1.2+seed(pos.x+pos.z)*1.3,
   points:elite?6:ground?3:1,rescue,seed:seed(pos.z+pos.x)*6,side:0};
  this.enemies.push(enemy);return enemy;
 }
 private spawnWave(){
  const wave=this.waves[this.waveIndex++];
  if(!wave)return;
  for(let i=0;i<wave.count;i++){
   const f=formation(wave.type,i,wave.count,this.missionTime);
   let pos:T.Vector3;
   if(this.mission.mode==='corridor'){
    const z=this.player.position.z-118-f.z,route=routeCenter(this.mission.scene,z);
    const flank=wave.type==='crossfire'?(i%3-1)*19
     :wave.type==='pincer'?(i%2===0?-27:27)
     :wave.type==='flypast'?(i%2===0?-33:33)
     :wave.type==='intercept'?(i%2===0?-15:15):0;
    pos=new T.Vector3(route.x+f.x+flank,route.y+f.y+3,z);
   }else{
    const angle=6.28*(i/wave.count)+this.missionTime*.17;
    pos=this.player.position.clone().add(new T.Vector3(Math.cos(angle)*98,f.y,Math.sin(angle)*98));
   }
   this.makeEnemy(pos,wave.elite&&i===Math.floor(wave.count/2),false,false);
  }
  if(this.mission.id===0&&this.waveIndex===1)this.comms('ECHO','前方に敵編隊。まずは照準に合わせて射撃！',3.2);
  if(wave.elite)this.comms('VECTA','重装甲機を確認。ロックオンで撃破！',2.5);
 }
 private spawnTurret(){
  const z=this.player.position.z-112,route=routeCenter(this.mission.scene,z);
  const left=Math.floor(this.missionTime*3)%2===0?-1:1;
  const x=route.x+left*(17+seed(this.missionTime)*21);
  const y=heightAt(this.mission.scene,x,z)+1;
  const turret=this.makeEnemy(new T.Vector3(x,y,z),false,true);
  turret.fire=1.65;
 }
 private spawnRescue(){
  if(this.rescueFinished||this.rescueCount>0||this.mission.id!==0)return;
  this.rescueCount=3;
  this.comms('ECHO','敵機に追われている！援護をお願い！',3.8);
  for(let i=0;i<3;i++){
   const z=this.player.position.z-135-i*11,r=routeCenter(0,z);
   const e=this.makeEnemy(new T.Vector3(r.x+(-1+i)*3.0,r.y+1.6,z),false,false,true);
   e.fire=2.4;
  }
 }
 private spawnBoss(){
  for(const e of this.enemies){this.scene.remove(e.model);disposeFlightVisual(e.model,true);}
  this.enemies=[];
  const specialWalker=this.mission.id===0&&this.rescueFinished&&this.terrain.gateState.passed===gateCount();
  const model=this.mission.id===0?createFirstStageBoss(specialWalker):createFlightShip(0xac5269,true,this.mission.scene);
  if(this.mission.id!==0)model.scale.multiplyScalar(1.25);
  const z=this.mission.mode==='corridor'?this.player.position.z-155:Math.cos(this.mission.id)*95;
  const route=routeCenter(this.mission.scene,z);
  model.position.set(this.mission.mode==='corridor'?route.x:Math.sin(this.mission.id)*95,this.mission.id===0?7:10,z);
  model.rotation.y=Math.PI;
  this.scene.add(model);
  const hp=185+this.mission.difficulty*36;
  this.boss={model,position:model.position,hp,max:hp,boss:true,ground:false,age:0,fire:1.15,phase:0,radius:this.mission.id===0&&!specialWalker?22:15,points:80,rescue:false,seed:123,side:0};
  if(this.mission.id===0)this.comms('NOVA COMMAND',specialWalker?'巨大歩行兵器が起動！発光する装甲のコアを狙え！':'大型空中母艦、接近！真正面の動力コアを撃て！',4);
  this.bossStage=1;this.stage='boss';
  $('bosswrap').hidden=false;$('boss-name').textContent=this.mission.boss;
  this.comms('NOVA COMMAND','大型敵接近！発光した中枢を狙え！',4);
  this.notice('WARNING / '+this.mission.boss,3);this.sound(135,.55,.06);
 }
 private enemyShoot(e:Target){
  const target=this.player.position.clone(),from=e.position.clone();
  const direction=target.sub(from).normalize();
  const phase=e.boss?bossPhase(e.hp,e.max):1;
  const count=e.boss?phase===1?3:phase===2?5:7:1;
  for(let i=0;i<count;i++){
   const spread=(i-(count-1)/2)*(e.boss?.14+phase*.03:.06);
   const dir=direction.clone().add(new T.Vector3(spread,Math.sin(e.age+i)*.04,0)).normalize();
   this.emit(from.clone(),dir.multiplyScalar(e.boss?87:70),1,false);
  }
 }
 private spawnSupply(kind:Supply['kind']){
  const z=this.player.position.z-130,center=routeCenter(this.mission.scene,z);
  const x=center.x+Math.sin(this.missionTime*1.1)*26;
  const pos=this.mission.mode==='corridor'?new T.Vector3(x,center.y+Math.sin(this.missionTime)*3,z):
    this.player.position.clone().addScaledVector(this.forward(),85);
  const color=kind==='ring'?0xffde84:kind==='laser'?0x9efbff:kind==='repair'?0x97ffab:0xffad6f;
  const geometry=new T.TorusGeometry(kind==='ring'?2.2:1.6,.24,8,28);
  const material=new T.MeshBasicMaterial({color});
  const mesh=new T.Mesh(geometry,material);mesh.position.copy(pos);this.scene.add(mesh);
  this.supplies.push({mesh,kind,radius:kind==='ring'?2.6:2.1});
 }
 private impact(position:T.Vector3,radius:number){
  this.vfx.burst(position,radius,radius>5?0xffd18a:0xff997e);
  const material=new T.MeshBasicMaterial({color:0xffc39d,transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending});
  const mesh=new T.Mesh(orb,material);mesh.position.copy(position);mesh.scale.setScalar(.12);this.scene.add(mesh);
  this.blasts.push({mesh,life:radius>4?.65:.38,duration:radius>4?.65:.38});
 }
 private destroyTarget(e:Target,power:number){
  if(e.hp<=0)return;
  e.hp-=power;
  if(e.hp>0){this.vfx.burst(e.position,.28,0xadf8f0);return;}
  const at=e.position.clone();this.impact(at,e.boss?10:e.ground?4:2.1);
  this.scene.remove(e.model);disposeFlightVisual(e.model,true);
  if(e.boss){this.boss=null;this.missionHits+=e.points;this.hits+=e.points;this.score+=9000;this.clearMission();return;}
  const idx=this.enemies.indexOf(e);if(idx>=0)this.enemies.splice(idx,1);
  this.missionHits+=e.points;this.hits+=e.points;this.score+=e.points*100;
  if(e.rescue){
   this.rescueCount=Math.max(0,this.rescueCount-1);
   if(this.rescueCount===0){this.rescueFinished=true;this.comms('ECHO','助かった！ありがとう！後で秘密の進路を教える。',3.5);this.score+=750;}
  }
  if(e.points>=6&&seed(this.missionHits+this.time)>.34)this.spawnSupply(this.laserLevel<3?'laser':'bomb');
  this.sound(175,.13,.032);
 }
 private hurt(amount=23){
  if(!this.playing||this.invulnerable>0)return;
  this.shield=Math.max(0,this.shield-amount);this.missionDamage+=amount;
  this.invulnerable=1.7;this.cameraShake=.47;this.damageFlash=.8;this.sound(105,.28,.055);
  this.impact(this.player.position,2.4);
  if(this.shield<=42&&!this.damagedWing){
   this.damagedWing=true;this.laserLevel=1;this.comms('VECTA','ウイング損傷！旋回性能が低下してる！',2.8);
  }
  if(this.shield<=0)this.loseLife();
 }
 private loseLife(){
  this.lives--;this.impact(this.player.position,8);
  if(this.lives<=0){
   this.stage='gameover';
   this.overlay('GAME OVER','MISSION FAILED','TOTAL HITS '+this.hits+'<br>キャンペーンを再出撃します。','RETRY');
  }else{
   this.shield=this.shieldMax;this.enterMission(this.mission.id,this.checkpoint);
   this.comms('NOVA COMMAND','予備機投入。チェックポイントから再出撃！',3);
  }
 }
 private clearMission(){
  if(this.stage==='route'||this.stage==='ending')return;
  const rating=missionGrade(this.missionHits,this.missionDamage,this.allies.filter(a=>a.hp>0).length);
  this.score+=Math.round(this.shield)*12+this.allies.filter(a=>a.hp>0).length*450;
  try{const best=Number(localStorage.getItem('nova-grounded-best')||0);if(this.hits>best)localStorage.setItem('nova-grounded-best',String(this.hits));}catch{/**/}
  $('bosswrap').hidden=true;
  if(this.mission.next.length===0){
   this.stage='ending';
   this.overlay('CAMPAIGN CLEAR','MISSION COMPLETE','TOTAL HITS '+this.hits+' / GRADE '+rating+'<br>'+this.route.map(i=>MISSIONS[i].name).join(' → '),'NEW GAME');
   return;
  }
  const unlock=this.mission.id===0?this.rescueFinished&&this.terrain.gateState.passed===gateCount():
    routeSelection(this.mission,this.missionHits,this.allies.filter(a=>a.hp>0).length,this.gateBonus)===this.mission.next[1];
  this.gateBonus=!!unlock;
  const chosen=this.mission.next[unlock&&this.mission.next.length>1?1:0];
  this.stage='route';
  this.overlay('MISSION COMPLETE',rating+' RANK','MISSION HITS '+this.missionHits+' / TOTAL '+this.hits+
   '<br>GATES '+this.terrain.gateState.passed+'/7 · '+(this.rescueFinished?'WINGMAN SAVED':'RESCUE INCOMPLETE')+
   '<br>NEXT: '+MISSIONS[chosen].name,'NEXT MISSION');
  $('route-suggest').textContent=unlock?'SPECIAL ROUTE UNLOCKED':'STANDARD ROUTE';
  this.notice(unlock?'MISSION ACCOMPLISHED':'MISSION COMPLETE',2.5);
 }
 private advance(){
  if(this.stage!=='route')return;
  const id=this.mission.next[this.gateBonus&&this.mission.next.length>1?1:0];
  if(id===undefined)return;
  this.route.push(id);
  this.shield=Math.min(this.shieldMax,this.shield+35);
  this.enterMission(id);
 }
 private updatePlayer(dt:number){
  this.gamepad(dt);
  const k=this.keys;
  const ix=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'));
  const iy=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'));
  this.laneX=this.mission.mode==='corridor'?railMoveTarget(this.laneX,ix*dt*34):clamp(this.laneX+ix*dt*14,-9.4,9.4);
  this.laneY=clamp(this.laneY+iy*dt*13,RAIL_Y_MIN,RAIL_Y_MAX);
  const accelerating=(this.boostHeld||this.padBoost||k.has('shift'))&&!this.overheated;
  const braking=(this.brakeHeld||this.padBrake||k.has('control')||k.has('b'))&&!this.overheated&&!accelerating;
  this.heat=clamp(this.heat+(accelerating||braking?dt*.36:-dt*.33),0,1);
  if(this.heat>=.999)this.overheated=true;
  if(this.heat<.14)this.overheated=false;
  this.velocity=accelerating?136:braking?30:76;
  if(this.damagedWing)this.velocity*=.84;
  this.previousPosition.copy(this.player.position);
  if(this.mission.mode==='corridor'){
   this.player.position.z-=this.velocity*dt;
   const center=routeCenter(this.mission.scene,this.player.position.z);
   this.player.position.x=lerp(this.player.position.x,center.x+this.laneX,dt*(this.damagedWing?6:10));
   this.player.position.y=lerp(this.player.position.y,center.y+this.laneY,dt*10);
   this.yaw=0;
  }else{
   this.targetYaw+=this.laneX*dt*.16+ix*dt*.55;
   this.yaw=lerp(this.yaw,this.targetYaw,dt*4.5);
   this.player.position.addScaledVector(this.forward(),this.velocity*dt);
   this.player.position.y=clamp(this.player.position.y+(this.laneY-this.player.position.y)*dt*.9,-5,16);
   const pos=clampArena(P(this.player.position),260);
   if(dist(pos,P(this.player.position))>.1){
    this.player.position.set(pos.x,pos.y,pos.z);
    this.targetYaw+=Math.PI;this.notice('TURN BACK / BOUNDARY',.8);
   }
   this.laneX*=Math.max(0,1-dt*1.4);
  }
  this.roll=Math.max(0,this.roll-dt);this.rollCooldown=Math.max(0,this.rollCooldown-dt);
  this.loopTime=Math.max(0,this.loopTime-dt);this.loopCooldown=Math.max(0,this.loopCooldown-dt);
  const bank=-ix*.23-clamp(this.laneX/(this.mission.mode==='corridor'?RAIL_X_MAX:9.4),-1,1)*.46+(this.leftBank?.34:0)-(this.rightBank?.34:0);
  this.player.rotation.set(0,this.yaw,lerp(this.player.rotation.z,bank,dt*6));
  if(this.roll>0)this.player.rotation.z=bank+this.rollDir*2*Math.PI*(1-this.roll/ROLL_SECONDS);
  if(this.loopTime>0)this.player.rotation.x=-(1-this.loopTime/SOMERSAULT_SECONDS)*Math.PI*2;
  this.player.visible=!this.respawnBlink||this.invulnerable<=0||Math.sin(this.time*36)>.15;
  animateFlightShip(this.player,this.time,accelerating?2.3:1.1);
  this.terrain.step(this.player.position.z,this.mission.mode==='all-range');
  const sample=heightAt(this.mission.scene,this.player.position.x,this.player.position.z);
  if(this.player.position.y<sample+2.3){
   this.player.position.y=sample+2.3;this.hurt(25);
  }
  const obstacle=this.terrain.collisions(P(this.previousPosition),P(this.player.position),1.6);
  if(obstacle)this.hurt(32);
  if(this.mission.id===0)for(const gate of this.terrain.gatesCrossed(P(this.previousPosition),P(this.player.position))){
   if(gate.passed){this.notice('ARCH '+this.terrain.gateState.passed+'/7',1.2);this.sound(840,.11,.025);this.score+=120;}
   else this.notice('ARCH MISSED',1.2);
   if(this.terrain.gateState.lastCross===6&&this.terrain.gateState.passed===7&&this.rescueFinished){
    this.gateBonus=true;this.comms('ECHO','全アーチ突破！滝の裏に隠しルートがある！',3.7);
   }
  }
  this.vfx.update(this.player.position,this.time,dt,this.velocity,accelerating);
 }
 private updateAllies(dt:number){
  for(const a of this.allies){
   if(a.hp<=0){a.mesh.visible=false;continue;}
   const flyby=clamp(1-this.missionTime/6,0,1);
   const desired=this.player.position.clone().add(
     new T.Vector3(a.side*(6+flyby*4),-2.8+flyby*3,6-flyby*36)
   );
   a.mesh.position.lerp(desired,Math.min(1,dt*2.7));
   a.mesh.rotation.set(0,this.yaw,-a.side*.11+Math.sin(this.time*2+a.side)*.04);
   animateFlightShip(a.mesh,this.time,1);
   a.cooldown-=dt;
   if(a.cooldown<=0){
    const enemy=this.enemies.find(e=>e.position.distanceTo(this.player.position)<150);
    if(enemy){
     this.emit(a.mesh.position.clone(),DIR(a.mesh.position,enemy.position).multiplyScalar(330),1,true);
     a.cooldown=4+seed(this.time*12+a.side)*3;
    }else a.cooldown=1.1;
   }
  }
 }
 private updateEnemies(dt:number){
  for(const e of [...this.enemies,...(this.boss?[this.boss]:[])]){
   if(e.hp<=0)continue;
   e.age+=dt;
   const prior=e.position.clone();
   if(e.boss){
    if(this.mission.mode==='corridor'){
     const targetZ=this.player.position.z-120;
     e.position.z=lerp(e.position.z,targetZ,dt*1.25);
     const r=routeCenter(this.mission.scene,e.position.z);
     e.position.x=r.x+Math.sin(e.age*.64)*8.2;
     e.position.y=r.y+7+Math.cos(e.age*.83)*4.4;
     e.model.rotation.z=Math.sin(e.age*.7)*.12;
    }else{
     e.position.x=Math.sin(e.age*.24+this.mission.id)*83;
     e.position.z=Math.cos(e.age*.24+this.mission.id)*83;
     e.position.y=5+Math.sin(e.age*.63)*9;
     e.model.rotation.y=Math.atan2(this.player.position.x-e.position.x,this.player.position.z-e.position.z);
    }
    const phase=bossPhase(e.hp,e.max);
    if(phase>this.bossStage){
     this.bossStage=phase;this.impact(e.position,5);
     this.comms('NOVA CONTROL',phase===2?'装甲変形！攻撃パターンが変わった！':'コアが露出！今が攻撃のチャンス！',3.2);
    }
   }else if(e.ground){
    e.position.y=heightAt(this.mission.scene,e.position.x,e.position.z)+1.2;
   }else if(this.mission.mode==='corridor'){
    e.position.z+=dt*(16+this.mission.difficulty*3);
    const r=routeCenter(this.mission.scene,e.position.z);
    e.position.x+=Math.sin(this.time*1.65+e.phase)*dt*.95;
    e.position.y=r.y+Math.sin(e.age*2.1+e.phase)*2.6+1.6;
    e.model.rotation.z=Math.sin(e.age*2+e.phase)*.23;
   }else{
    const heading=DIR(e.position,this.player.position);
    e.position.addScaledVector(heading,dt*12);
    e.position.y+=Math.sin(e.age*2.7+e.phase)*dt*2;
    e.model.rotation.y=Math.atan2(this.player.position.x-e.position.x,this.player.position.z-e.position.z);
   }
   e.fire-=dt;
   if(e.fire<=0){
    if(e.position.distanceTo(this.player.position)<185){
     this.enemyShoot(e);e.fire=e.boss?1.35-.12*bossPhase(e.hp,e.max):2+seed(e.phase)*1.6;
    }else e.fire=.5;
   }
   if(e.boss&&this.mission.id===0)animateFirstStageBoss(e.model,e.age,bossPhase(e.hp,e.max));
   else if(!e.ground)animateFlightShip(e.model,this.time+e.phase,1);
   if(!e.boss&&!e.ground&&swept(P(this.previousPosition),P(this.player.position),P(prior),P(e.position),e.radius+1)){
    this.hurt();this.destroyTarget(e,999);
   }
   if(!e.boss&&e.position.distanceTo(this.player.position)>380){
    this.scene.remove(e.model);disposeFlightVisual(e.model,true);
    const idx=this.enemies.indexOf(e);if(idx>=0)this.enemies.splice(idx,1);
   }
  }
 }
 private updateShots(dt:number){
  const targets=[...this.enemies,...(this.boss?[this.boss]:[])];
  for(let i=this.shots.length-1;i>=0;i--){
   const s=this.shots[i],from=s.mesh.position.clone();
   if(s.homing){
    const target=s.target&&s.target.hp>0?s.target:this.acquire();
    if(target)s.velocity.lerp(DIR(s.mesh.position,target.position).multiplyScalar(this.velocity+290),Math.min(1,dt*5));
   }
   s.mesh.position.addScaledVector(s.velocity,dt);s.life-=dt;
   let consumed=false;
   if(s.friendly){
    for(const target of targets){
     if(target.hp>0&&swept(P(from),P(s.mesh.position),P(target.position),P(target.position),target.radius+s.radius)){
      const position=target.position.clone();
      // Radiant guardian core is mechanically meaningful; body armour can be
      // damaged, but a close/accurate core shot applies a large multiplier.
      const core=target.boss?target.model.userData.weakpoint as T.Object3D|undefined:undefined;
      const weakpoint=core?.getWorldPosition(new T.Vector3());
      const hitCore=!!weakpoint&&swept(P(from),P(s.mesh.position),P(weakpoint),P(weakpoint),4.3+s.radius);
      const power=core?(hitCore?s.damage*2.7:s.damage*.62):s.damage;
      this.destroyTarget(target,power);
      if(hitCore)this.vfx.burst(weakpoint!,2.5,0xffce88);
      if(s.bomb){this.impact(position,13);for(const other of targets)if(other!==target&&other.hp>0&&other.position.distanceTo(position)<32)this.destroyTarget(other,40);}
      consumed=true;break;
     }
    }
   }else{
    if(swept(P(from),P(s.mesh.position),P(this.previousPosition),P(this.player.position),s.radius+1.1)){
     if(deflectDuringRoll(this.roll)){this.vfx.burst(s.mesh.position,.5,0xa4eeff);this.score+=40;this.sound(700,.08,.025);}
     else this.hurt(17);consumed=true;
    }
    if(!consumed)for(const a of this.allies){
     if(a.hp>0&&a.mesh.position.distanceTo(s.mesh.position)<2){
      a.hp--;this.impact(a.mesh.position,1.4);consumed=true;
      if(a.hp===0)this.comms('NOVA CONTROL',a.name+'の通信途絶。援護機を失った！',2.7);
      break;
     }
    }
   }
   if(consumed||s.life<=0||s.mesh.position.distanceTo(this.player.position)>450){
    this.scene.remove(s.mesh);this.shots.splice(i,1);
   }
  }
 }
 private updateSupplies(dt:number){
  for(let i=this.supplies.length-1;i>=0;i--){
   const p=this.supplies[i];p.mesh.rotation.z+=dt*.82;p.mesh.rotation.y+=dt*.54;
   const pick=swept(P(this.previousPosition),P(this.player.position),P(p.mesh.position),P(p.mesh.position),p.radius);
   const lost=p.mesh.position.distanceTo(this.player.position)>280;
   if(pick){
    if(p.kind==='ring'){this.rings++;this.shield=Math.min(this.shieldMax,this.shield+23);if(this.rings%3===0)this.shieldMax=Math.min(140,this.shieldMax+10);}
    if(p.kind==='laser')this.laserLevel=Math.min(3,this.laserLevel+1);
    if(p.kind==='bomb')this.bombs=Math.min(7,this.bombs+1);
    if(p.kind==='repair'){this.shield=this.shieldMax;this.damagedWing=false;}
    this.notice('SUPPLY / '+p.kind.toUpperCase(),.85);this.sound(960,.19,.033);this.score+=230;
   }
   if(pick||lost){
    this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();this.supplies.splice(i,1);
   }
  }
  for(let i=this.blasts.length-1;i>=0;i--){
   const effect=this.blasts[i];
   effect.life-=dt;
   const fraction=1-effect.life/effect.duration;
   effect.mesh.scale.setScalar(.2+fraction*5.5);
   (effect.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,(1-fraction)*.72);
   if(effect.life<=0){this.scene.remove(effect.mesh);(effect.mesh.material as T.Material).dispose();this.blasts.splice(i,1);}
  }
 }
 private updateGame(dt:number){
  this.time+=dt;this.missionTime+=dt;
  this.invulnerable=Math.max(0,this.invulnerable-dt);
  this.shotDelay=Math.max(0,this.shotDelay-dt);
  this.cameraShake=Math.max(0,this.cameraShake-dt*1.5);
  this.damageFlash=Math.max(0,this.damageFlash-dt*2);
  this.noticeTime-=dt;this.radioTime-=dt;
  if(this.noticeTime<0)$('notice').classList.remove('visible');
  if(this.radioTime<0)$('radio').hidden=true;
  if(this.fireHeld){
   this.charge=Math.min(1.25,this.charge+dt);
   if(this.charge<LOCK_CHARGE)this.fireLasers();
  }
  this.updatePlayer(dt);
  if(!this.playing)return;
  if(this.stage==='combat'){
   while(this.waveIndex<this.waves.length&&this.missionTime>=this.waves[this.waveIndex].at)this.spawnWave();
   if(this.mission.id===0){
    if(this.missionTime>=18&&!this.rescueFinished&&this.rescueCount===0&&this.levelEvent===0){this.levelEvent=1;this.spawnRescue();}
    if(this.missionTime>=38&&this.levelEvent===1){this.levelEvent=2;if(!this.rescueFinished)this.comms('NOVA CONTROL','援護機は離脱した。別ルート条件を失った。',2.4);}
   }
   if(!this.checkpoint&&this.missionTime>25){this.checkpoint=true;this.shield=Math.min(this.shieldMax,this.shield+10);this.notice('CHECKPOINT',1.5);}
   const crossed=(interval:number)=>(Math.floor(this.missionTime/interval)!==Math.floor((this.missionTime-dt)/interval));
   if(crossed(5.6))this.spawnTurret();
   if(crossed(12))this.spawnSupply('ring');
   if(crossed(24))this.spawnSupply(this.laserLevel<3?'laser':'repair');
   if(this.missionTime>=this.mission.duration)this.spawnBoss();
  }
  this.updateAllies(dt);
  this.updateEnemies(dt);
  if(!this.playing)return;
  this.updateShots(dt);
  if(!this.playing)return;
  this.updateSupplies(dt);
  $('hit').style.opacity=String(this.damageFlash);
  this.refreshHUD();
 }
 private refreshHUD(){
  $('sector').textContent='MISSION '+String(this.mission.id+1).padStart(2,'0')+' / '+this.mission.name;
  $('score').textContent=String(this.missionHits).padStart(3,'0');
  $('points').textContent=String(this.score).padStart(7,'0');
  $('shield-fill').style.width=(this.shield/this.shieldMax*100).toFixed(1)+'%';
  $('shield-value').textContent=Math.round(this.shield)+'/'+this.shieldMax;
  $('lives').textContent='SHIP ×'+this.lives;
  $('bomb-count').textContent='×'+this.bombs;
  $('rings').textContent='◯ '+this.rings;
  $('laser').textContent='LASER '+this.laserLevel;
  $('wing-state').textContent=this.damagedWing?'WING DAMAGED':'WING OK';
  $('wing-state').classList.toggle('warning',this.damagedWing);
  $('heat-fill').style.width=(this.heat*100).toFixed(1)+'%';
  $('charge-fill').style.width=(Math.min(1,this.charge/LOCK_CHARGE)*100).toFixed(1)+'%';
  $('fire').classList.toggle('ready',this.charge>=LOCK_CHARGE);
  $('speed').textContent=Math.round(this.velocity*12)+' km/h';
  $('progress').style.width=(Math.min(1,this.missionTime/this.mission.duration)*100).toFixed(0)+'%';
  $('friends').textContent=this.allies.map(a=>a.name+' '+(a.hp>0?'◆'.repeat(a.hp):'LOST')).join(' / ');
  $('mode').textContent=this.mission.mode==='all-range'?'ALL-RANGE':'GROUND FLIGHT';
  $('arches').hidden=this.mission.id!==0;
  $('bosswrap').hidden=!this.boss;
  if(this.boss)$('boss-fill').style.width=(Math.max(0,this.boss.hp/this.boss.max)*100).toFixed(0)+'%';
  $('arc-count').textContent=this.mission.id===0?this.terrain.gateState.passed+' / '+gateCount():'—';
 }
 private renderRadar(){
  if(this.mission.mode!=='all-range'||!this.playing)return;
  const context=this.radar.getContext('2d');if(!context)return;
  const w=this.radar.width,scale=w/152;context.clearRect(0,0,w,this.radar.height);
  context.save();context.scale(scale,scale);context.fillStyle='#031324bd';context.fillRect(0,0,152,152);
  context.strokeStyle='#8cdfff74';context.strokeRect(0,0,152,152);
  context.beginPath();context.arc(76,76,58,0,Math.PI*2);context.stroke();
  context.beginPath();context.moveTo(76,0);context.lineTo(76,152);context.moveTo(0,76);context.lineTo(152,76);context.stroke();
  const mark=(p:T.Vector3,color:string,r:number)=>{
   const px=clamp(76+(p.x-this.player.position.x)*.32,6,146),py=clamp(76+(p.z-this.player.position.z)*.32,6,146);
   context.fillStyle=color;context.beginPath();context.arc(px,py,r,0,2*Math.PI);context.fill();
  };
  for(const e of this.enemies)mark(e.position,'#ff7393',3);
  if(this.boss)mark(this.boss.position,'#ffcd77',6);
  for(const a of this.allies)if(a.hp>0)mark(a.mesh.position,'#8cf2ff',3);
  mark(this.player.position,'#f5ffff',4);
  context.restore();
 }
 private auditSetLane(value:number){
  if(!new URLSearchParams(location.search).has('audit')||!this.playing)return;
  this.laneX=this.mission.mode==='corridor'?railMoveTarget(0,value):clamp(value,-9.4,9.4);
  this.cameraPanX=railCameraPan(this.laneX);
  if(this.mission.mode==='corridor'){
   const route=routeCenter(this.mission.scene,this.player.position.z);
   this.player.position.x=route.x+this.laneX;
   this.previousPosition.copy(this.player.position);
   this.invulnerable=2.5;
  }
 }
 private auditSeek(seconds:number){
  if(!new URLSearchParams(location.search).has('audit')||!this.playing)return;
  // Inspection-only: seek physical scenery for reference comparisons without
  // waiting for a full level. Not enabled in normal gameplay sessions.
  this.missionTime=clamp(seconds,0,this.mission.duration-.2);
  this.player.position.z=-this.missionTime*76;
  const center=routeCenter(this.mission.scene,this.player.position.z);
  this.player.position.x=center.x+this.laneX;this.player.position.y=center.y+this.laneY;
  this.previousPosition.copy(this.player.position);
  this.terrain.configure(this.mission.scene,this.player.position.z,this.mission.mode==='all-range');
  this.waveIndex=this.waves.findIndex(w=>w.at>this.missionTime);
  if(this.waveIndex<0)this.waveIndex=this.waves.length;
  for(const e of this.enemies){this.scene.remove(e.model);disposeFlightVisual(e.model,true);}
  this.enemies=[];
  for(const s of this.shots)this.scene.remove(s.mesh);
  this.shots=[];
  this.cameraPanX=railCameraPan(this.laneX);
  this.camera.position.copy(this.player.position).add(new T.Vector3(-this.laneX+this.cameraPanX,4.1,13.5));
 }
 private render(dt:number){
  const forward=this.forward();
  const behind=this.player.position.clone().addScaledVector(forward,-15.5).add(new T.Vector3(0,4.3,0));
  if(this.mission.mode==='corridor'){
   // In the center the camera stays still while the ship steers across the
   // frame. When it reaches the camera dead zone, the panorama starts sliding.
   // A WORLD-SPACE camera pan exposes more buildings/terrain on either side.
   this.cameraPanX=lerp(this.cameraPanX,railCameraPan(this.laneX),Math.min(1,dt*9));
   const center=routeCenter(this.mission.scene,this.player.position.z);
   behind.x=center.x+this.cameraPanX;
   behind.y=center.y+4.3+railCameraPanY(this.laneY);
  }
  this.camera.position.lerp(behind,Math.min(1,dt*7||.08));
  if(this.cameraShake>0){
   this.camera.position.x+=(Math.random()-.5)*this.cameraShake*.4;
   this.camera.position.y+=(Math.random()-.5)*this.cameraShake*.25;
  }
  const look=this.player.position.clone().addScaledVector(forward,96);
  if(this.mission.mode==='corridor'){
   const center=routeCenter(this.mission.scene,look.z);
   look.x=center.x+this.cameraPanX*.98;
   look.y=center.y-3.6+railCameraPanY(this.laneY)*.75;
  }else look.y-=3;
  this.camera.lookAt(look);
  this.camera.rotateZ(-this.player.rotation.z*.08);
  const fov=this.boostHeld?75:this.brakeHeld?56:64;
  this.camera.fov=lerp(this.camera.fov,fov,dt*3.7);this.camera.updateProjectionMatrix();
  if(this.playing){
   const pNear=this.mission.mode==='corridor'
    ?railAimPoint(this.mission.scene,this.player.position.z,this.laneX,this.laneY,70)
    :P(this.player.position.clone().addScaledVector(this.aim(),70));
   const pFar=this.mission.mode==='corridor'
    ?railAimPoint(this.mission.scene,this.player.position.z,this.laneX,this.laneY,145)
    :P(this.player.position.clone().addScaledVector(this.aim(),145));
   for(const [id,p] of [['sight-near',pNear],['sight-far',pFar]] as const){
    const sight=$(id);
    const ndc=new T.Vector3(p.x,p.y,p.z).project(this.camera);
    const visible=ndc.z>0&&ndc.z<1&&Math.abs(ndc.x)<.95&&Math.abs(ndc.y)<.95;
    sight.hidden=!visible;
    if(visible){
     sight.style.left=((ndc.x+1)*50).toFixed(2)+'%';
     sight.style.top=((1-ndc.y)*50).toFixed(2)+'%';
    }
   }
  }
  const warning=this.playing&&this.mission.mode==='corridor'?railEdgeWarning(this.laneX):0;
  $('edge-left').style.opacity=String(this.laneX<0?warning:0);
  $('edge-right').style.opacity=String(this.laneX>0?warning:0);
  const marker=$('target-ring');
  const e=this.currentTarget;
  if(e&&this.playing&&e.hp>0){
   const ndc=e.position.clone().project(this.camera);
   const visible=ndc.z>0&&ndc.z<1&&Math.abs(ndc.x)<.93&&Math.abs(ndc.y)<.91;
   marker.hidden=!visible;
   if(visible){
    marker.style.left=((ndc.x+1)*50).toFixed(2)+'%';
    marker.style.top=((1-ndc.y)*50).toFixed(2)+'%';
    $('target-distance').textContent=Math.round(e.position.distanceTo(this.player.position))+' M';
   }
  }else marker.hidden=true;
  this.sky.follow(this.camera.position);
  this.renderer.render(this.scene,this.camera);
  this.renderRadar();
 }
 private frame(now:number){
  // Real elapsed time instead of a 34ms/frame cap. That old cap slowed the
  // entire game to ~25% speed on heavy scenes, hiding scheduled enemy waves.
  const elapsed=Math.min(.25,Math.max(0,(now-(this.lastFrame||now))/1000));
  this.lastFrame=now;
  if(elapsed>0)this.averageFps=lerp(this.averageFps,1/elapsed,.1);
  if(this.playing){
   const steps=Math.max(1,Math.ceil(elapsed/0.034)),dt=elapsed/steps;
   for(let i=0;i<steps&&this.playing;i++){
    this.currentTarget=this.acquire();
    this.updateGame(dt);
   }
  }
  this.render(elapsed);
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
}
try{new GroundFlight();}
catch(error){
 console.error('NOVA ground flight could not boot',error);
 $('overlay').hidden=false;$('overlay-title').textContent='3Dモードの起動に失敗';
 $('overlay-info').textContent='WebGLの利用可否とブラウザーの設定をご確認ください。';
 $('action').hidden=true;
}
