import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
import {CINEMATIC_STAGE_COLORS} from './cinematics-spec.ts';
import {DEPTH_SPECTACLE_BUDGET as CAP,DEPTH_SPECTACLE_FEATURES} from './depth-spectacle-spec.ts';

const dummy=new T.Object3D();
const up=new T.Vector3(0,1,0);
const direction=new T.Vector3();
const pigment=new T.Color();
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const rand=(n:number)=>{const x=Math.sin(n*127.17+31.47)*43758.5453;return x-Math.floor(x);};
type Pulse={x:number;y:number;z:number;age:number;life:number;radius:number;color:number;kind:string};
type Dust={x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;life:number;size:number;color:number};
type Ghost={x:number;y:number;z:number;age:number;bank:number};

/**
 * Event-linked physical depth choreography for the rebuilt renderer.
 * No combat RNG, gameplay state writes, fullscreen quads or unbounded scene children.
 * Geometry is shared and instanced; only brief, capped numeric records are created.
 */
export class DepthSpectacle {
 readonly root=new T.Group();
 private tracer:T.InstancedMesh;
 private warningRails:T.InstancedMesh;
 private activeBeams:T.InstancedMesh;
 private lockGyros:T.InstancedMesh;
 private pickupOrbits:T.InstancedMesh;
 private enemyVortices:T.InstancedMesh;
 private pilotGhosts:T.InstancedMesh;
 private driftFrames:T.InstancedMesh;
 private iris:T.InstancedMesh;
 private pulses:T.InstancedMesh;
 private dust:T.InstancedMesh;
 private shield:T.Mesh<T.SphereGeometry,T.MeshBasicMaterial>;
 private novaShell:T.Mesh<T.IcosahedronGeometry,T.MeshBasicMaterial>;
 private bossCore:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;
 private shieldAge=999;
 private novaAge=999;
 private novaSize=1;
 private lastGhostAt=-100;
 private ghosts:Ghost[]=[];
 private pulsePool:Pulse[]=[];
 private dustPool:Dust[]=[];
 private serial=0;
 private stage=-1;
 private total=0;
 constructor(){
  this.root.name='battle-depth-spectacle-v32';
  const mesh=(name:string,geo:T.BufferGeometry,mat:T.Material,count:number)=>{
   const m=new T.InstancedMesh(geo,mat,count);
   m.name=name;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);
   this.root.add(m);m.count=0;return m;
  };
  const translucent=(color:number,opacity:number)=>new T.MeshBasicMaterial({
   color,transparent:true,opacity,depthWrite:false,toneMapped:true,side:T.DoubleSide
  });
  this.tracer=mesh('ballistic-velocity-3d-streaks',new T.CylinderGeometry(.055,.14,1,5),translucent(0xc4ddf3,.53),CAP.tracers);
  this.warningRails=mesh('threat-telegraph-depth-rails',new T.CylinderGeometry(.065,.065,1,5),translucent(0xe7a27d,.29),CAP.threats*2);
  this.activeBeams=mesh('active-weapon-depth-rods',new T.CylinderGeometry(.1,.2,1,6),translucent(0xfbc3a0,.39),CAP.threats);
  this.lockGyros=mesh('three-axis-lock-on-gyroscopes',new T.TorusGeometry(1,.035,4,30),translucent(0x8cdae7,.46),CAP.locks);
  this.pickupOrbits=mesh('rotating-physical-salvage-orbits',new T.TorusGeometry(1,.075,5,22),translucent(0xbde6c5,.40),CAP.pickups);
  this.enemyVortices=mesh('enemy-wing-pressure-vortices',new T.ConeGeometry(.18,.70,5,1,true),translucent(0xa9bfce,.29),CAP.enemyVortices);
  this.pilotGhosts=mesh('banked-hull-afterimage-fins',new T.TetrahedronGeometry(1,0),translucent(0x92d4e8,.25),CAP.ghosts*2);
  this.driftFrames=mesh('parallax-corridor-strain-beams',new T.BoxGeometry(.16,6,.22),new T.MeshStandardMaterial({color:0x54788d,metalness:.64,roughness:.47}),CAP.driftFrames);
  this.iris=mesh('boss-reactive-mechanical-iris',new T.ConeGeometry(.8,2.6,3),new T.MeshStandardMaterial({color:0x678da4,metalness:.62,roughness:.32,transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide}),CAP.iris);
  this.pulses=mesh('radial-contact-3d-wavefronts',new T.TorusGeometry(1,.065,6,40),translucent(0xaed2e1,.39),CAP.pulses);
  this.dust=mesh('structural-collapse-3d-debris',new T.IcosahedronGeometry(.4,0),new T.MeshStandardMaterial({color:0xd4bea2,roughness:.85,metalness:.16,transparent:true,opacity:.82,depthWrite:false}),CAP.dust);
  for(const m of [this.tracer,this.lockGyros,this.pickupOrbits,this.pulses,this.dust]){
   m.setColorAt(0,new T.Color(0xffffff));m.instanceColor!.setUsage(T.DynamicDrawUsage);
  }
  this.shield=new T.Mesh(new T.SphereGeometry(1,16,10),translucent(0x80bfe6,.0));
  this.shield.material.wireframe=true;this.shield.name='hull-damage-geodesic-shield';this.shield.visible=false;this.root.add(this.shield);
  this.novaShell=new T.Mesh(new T.IcosahedronGeometry(1,2),translucent(0x88bfda,.0));
  this.novaShell.material.wireframe=true;this.novaShell.name='nova-physical-expanding-shell';this.novaShell.visible=false;this.root.add(this.novaShell);
  this.bossCore=new T.Mesh(new T.TorusGeometry(1,.055,5,48),translucent(0xb8d8dc,.2));
  this.bossCore.name='boss-rotating-deep-shield-corona';this.bossCore.visible=false;this.root.add(this.bossCore);
 }
 private addPulse(x:number,y:number,z:number,radius:number,color:number,kind:string,life=.55){
  if(this.pulsePool.length>=CAP.pulses)this.pulsePool.shift();
  this.pulsePool.push({x,y,z,radius,color,kind,age:0,life});
 }
 event(e:GameEvent){
  if(e.type==='stage'){
   this.pulsePool.length=this.dustPool.length=this.ghosts.length=0;
   this.novaAge=this.shieldAge=999;this.lastGhostAt=-100;return;
  }
  const x=e.x??0,y=e.y??0,size=clamp(e.size??1,.3,12);
  if(e.type==='graze')this.addPulse(x,y,1.75,.48,0x90d2e3,'graze',.35);
  if(e.type==='lock')this.addPulse(x,y,1.55,.75,0xa9d9e7,'lock',.65);
  if(e.type==='enemyshot')this.addPulse(x,y,1.30,.42,0xd1a38c,'muzzle',.28);
  if(e.type==='collect'||e.type==='repair'||e.type==='medal')this.addPulse(x,y,1.4,.45,0xa0d9bd,'salvage',.52);
  if(e.type==='damage'){
   this.shieldAge=0;this.addPulse(x,y,1.2,1.3,0xaccbe4,'shield',.7);
  }
  if(e.type==='nova'){
   this.novaAge=0;this.novaSize=size;
   for(let i=0;i<3;i++)this.addPulse(x,y,1+i*.5,1.3+i*.7,0xb1d6df,'nova',1.1+i*.16);
  }
  // Large structure failure and boss finishes belong to the event setpiece, not another ring generator.
  if(['fieldcritical','fieldburst','fieldcollapse','fieldclear','bosskill','bosstransform','phase','nova'].includes(e.type))return;
  if(['explode','part','midkill','bosskill','bosstransform','phase','resonance','fieldcritical','fieldburst','fieldcollapse','fieldclear'].includes(e.type)){
   const structural=e.type.startsWith('field'),boss=e.type==='bosskill'||e.type==='bosstransform';
   const z=structural?-.12:1.35,color=structural?0xd3b292:boss?0xb3d3e5:e.color??0xcb9b80;
   this.addPulse(x,y,z,clamp(size*.7,.7,3.8),color,e.type,boss?1.25:.8);
   if(boss||e.type==='fieldcollapse'||e.type==='fieldclear')this.addPulse(x,y,z-.5,clamp(size*.55,1,4.3),0x8aaec4,'deep',1.2);
   if(structural&&['fieldcollapse','fieldclear','fieldburst'].includes(e.type)){
    for(let i=0;i<14;i++){
     if(this.dustPool.length>=CAP.dust)this.dustPool.shift();
     const n=++this.serial,a=rand(n)*Math.PI*2,v=.75+rand(n+11)*3.2;
     this.dustPool.push({x:x+Math.cos(a)*.3,y:y+Math.sin(a)*.3,z:-.5+rand(n+7),vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:1.5+rand(n+5)*2.3,age:0,life:.85+rand(n+13)*.8,size:.12+rand(n+17)*.31,color:i%4===0?0x7f9299:0xbb9b78});
    }
   }
  }
 }
 draw(g:Game,dt:number,reduced=false,performance=false,mix?:FxMix){
  const active=g.state==='playing'||g.state==='transition';
  this.root.visible=active;
  if(!active){this.total=0;return;}
  this.stage=g.stage;
  const t=g.visualTime,stageColor=CINEMATIC_STAGE_COLORS[g.stage]??CINEMATIC_STAGE_COLORS[0];
  const limit=(max:number)=>reduced?0:performance?Math.ceil(max*.32):Math.ceil(max*(mix?.crowded?.45:mix?.density??1));
  let n=0;
  for(const b of g.bullets){
   if(b.dead||n>=limit(CAP.tracers))break;
   const speed=Math.hypot(b.vx,b.vy);
   if(speed<3)continue;
   const len=clamp(speed*.055,.26,1.8),ux=b.vx/speed,uy=b.vy/speed;
   dummy.position.set(b.x-ux*len*.54,b.y-uy*len*.54,b.enemy?1.14:1.32);
   direction.set(b.vx,b.vy,0).normalize();
   dummy.quaternion.setFromUnitVectors(up,direction);
   dummy.scale.set(b.radius*.6+.08,len,b.radius*.65+.07);
   dummy.updateMatrix();this.tracer.setMatrixAt(n,dummy.matrix);
   this.tracer.setColorAt(n,pigment.setHex(b.enemy?0xe0a290:b.weapon==='laser'?0x9ae9db:0x9bc9ed));n++;
  }
  this.tracer.count=n;this.tracer.instanceMatrix.needsUpdate=true;
  if(this.tracer.instanceColor)this.tracer.instanceColor.needsUpdate=true;

  let alerts=0,beams=0;
  for(const threat of g.threats){
   if(threat.dead||alerts>=limit(CAP.threats))break;
   const activeRay=threat.age>=threat.warmup;
   if(activeRay&&beams>=limit(CAP.threats))continue;
   const dx=threat.bx-threat.ax,dy=threat.by-threat.ay,len=Math.hypot(dx,dy);
   if(len<.01)continue;
   direction.set(dx/len,dy/len,0);
   if(activeRay){
    dummy.position.set((threat.ax+threat.bx)/2,(threat.ay+threat.by)/2,1.37);
    dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(clamp(threat.width*.32,.1,.4),len,clamp(threat.width*.35,.1,.4));
    dummy.updateMatrix();this.activeBeams.setMatrixAt(beams++,dummy.matrix);
   }else{
    const charge=clamp(threat.age/threat.warmup,0,1),offset=.22+threat.width*.75*(1-charge*.4);
    for(const side of [-1,1]){
     dummy.position.set((threat.ax+threat.bx)/2+side*dy/len*offset,(threat.ay+threat.by)/2-side*dx/len*offset,1.1+side*.11);
     dummy.quaternion.setFromUnitVectors(up,direction);dummy.scale.set(.65,len,.65);dummy.updateMatrix();
     this.warningRails.setMatrixAt(alerts*2+(side===1?1:0),dummy.matrix);
    }alerts++;
   }
  }
  this.warningRails.count=alerts*2;this.activeBeams.count=beams;
  this.warningRails.instanceMatrix.needsUpdate=true;this.activeBeams.instanceMatrix.needsUpdate=true;

  n=0;
  for(const lock of g.locks){
   if(n>=limit(CAP.locks))break;
   dummy.position.set(lock.x,lock.y,1.85);
   dummy.rotation.set(.3*Math.sin(t*3+n),.45, t*(n%2?-.8:.8));
   dummy.scale.setScalar(.50+clamp(lock.progress,0,1)*.55);dummy.updateMatrix();
   this.lockGyros.setMatrixAt(n,dummy.matrix);
   this.lockGyros.setColorAt(n,pigment.setHex(0x6dbfe6).lerp(new T.Color(0xd0f6dd),lock.progress));n++;
  }
  this.lockGyros.count=n;this.lockGyros.instanceMatrix.needsUpdate=true;
  if(this.lockGyros.instanceColor)this.lockGyros.instanceColor.needsUpdate=true;

  n=0;
  for(const pickup of g.pickups){
   if(pickup.dead||n>=limit(CAP.pickups))break;
   dummy.position.set(pickup.x,pickup.y,1.45);
   dummy.rotation.set(.55+Math.sin(t*2+pickup.id)*.3,t*1.6+pickup.id,t*.5);
   dummy.scale.setScalar(pickup.type==='medal'?.62:.82);dummy.updateMatrix();
   this.pickupOrbits.setMatrixAt(n,dummy.matrix);
   this.pickupOrbits.setColorAt(n,pigment.setHex(pickup.type==='repair'?0x99d4a8:pickup.type==='power'?0x8fe0e4:0xe6c889));n++;
  }
  this.pickupOrbits.count=n;this.pickupOrbits.instanceMatrix.needsUpdate=true;
  if(this.pickupOrbits.instanceColor)this.pickupOrbits.instanceColor.needsUpdate=true;

  n=0;
  for(const enemy of g.enemies){
   if(enemy.dead||enemy.ground||n+2>limit(CAP.enemyVortices))continue;
   for(const side of [-1,1]){
    dummy.position.set(enemy.x+side*enemy.radius*.75,enemy.y+enemy.radius*.96,1.02);
    dummy.rotation.set(Math.PI,0,side*(.13+Math.sin(t*6+enemy.id)*.08));
    dummy.scale.set(.8,.7+Math.sin(t*5+enemy.id)*.12,.8);dummy.updateMatrix();
    this.enemyVortices.setMatrixAt(n++,dummy.matrix);
   }
  }
  this.enemyVortices.count=n;this.enemyVortices.instanceMatrix.needsUpdate=true;

  const player=g.player;
  if(!reduced&&dt>0&&t-this.lastGhostAt>.060&&Math.abs(player.vx)>1.8){
   this.lastGhostAt=t;
   this.ghosts.push({x:player.x,y:player.y,z:.98,age:0,bank:clamp(player.vx*.025,-.6,.6)});
   if(this.ghosts.length>CAP.ghosts)this.ghosts.shift();
  }
  if(dt>0)for(const ghost of this.ghosts)ghost.age+=dt;
  this.ghosts=this.ghosts.filter(ghost=>ghost.age<.42);
  n=0;
  for(const ghost of this.ghosts){
   if(n+2>limit(CAP.ghosts*2))break;
   const f=1-ghost.age/.42;
   for(const side of[-1,1]){
    dummy.position.set(ghost.x+side*(.95+ghost.age*.35),ghost.y-1-ghost.age*2.4,ghost.z-ghost.age*.35);
    dummy.rotation.set(.22,ghost.bank,side*.42);
    dummy.scale.set(.16+f*.2,.48+f*.9,.10+f*.12);dummy.updateMatrix();
    this.pilotGhosts.setMatrixAt(n++,dummy.matrix);
   }
  }
  this.pilotGhosts.count=n;this.pilotGhosts.instanceMatrix.needsUpdate=true;

  n=0;
  for(let i=0;i<(mix&&!mix.showAmbientStructures?0:limit(CAP.driftFrames));i++){
   const side=i%2?-1:1,z=-7.2+(i%4)*1.05;
   dummy.position.set(side*(11.9+(i%3)*1.08),((i*16.7-t*(3.9+g.stage*.18))%104+104)%104-52,z);
   dummy.rotation.set(.11*side,.15*side,side*(.10+Math.sin(t*.32+i)*.07));
   dummy.scale.set(1,1+(i%3)*.5,1);dummy.updateMatrix();
   this.driftFrames.setMatrixAt(n++,dummy.matrix);
  }
  this.driftFrames.count=n;this.driftFrames.instanceMatrix.needsUpdate=true;

  const boss=g.boss&&!g.boss.dead?g.boss:null;
  n=0;
  if(boss&&!reduced&&!performance&&mix===undefined){ // owned by InvasionDirector when orchestrated
   const phase=clamp(boss.phase,0,4),radius=3.45+.25*Math.sin(t*1.5),charge=boss.warning>0||boss.beam>0;
   for(let i=0;i<CAP.iris;i++){
    const angle=(i/CAP.iris)*Math.PI*2+t*(charge?.15:.06)*(i%2?1:-1);
    dummy.position.set(boss.x+Math.cos(angle)*radius,boss.y+Math.sin(angle)*radius*.85,-.6+.24*Math.sin(t+i));
    dummy.rotation.set(.18*Math.sin(angle),.25*Math.cos(angle),angle-Math.PI/2);
    dummy.scale.set(.8+phase*.12,charge?1.15:.78,.75);dummy.updateMatrix();
    this.iris.setMatrixAt(n++,dummy.matrix);
   }
   this.bossCore.visible=true;this.bossCore.position.set(boss.x,boss.y,-.45);
   this.bossCore.rotation.set(.33*Math.sin(t*.3),.48,t*.22);
   this.bossCore.scale.setScalar(3.1+phase*.22);
   this.bossCore.material.color.setHex(stageColor);
   this.bossCore.material.opacity=charge?.34:.17;
  }else this.bossCore.visible=false;
  this.iris.count=n;this.iris.instanceMatrix.needsUpdate=true;

  if(dt>0){
   for(const pulse of this.pulsePool)pulse.age+=dt;
   for(const part of this.dustPool){part.age+=dt;part.x+=part.vx*dt;part.y+=part.vy*dt;part.z+=part.vz*dt;part.vz-=3.1*dt;}
   this.shieldAge+=dt;this.novaAge+=dt;
  }
  this.pulsePool=this.pulsePool.filter(p=>p.age<p.life);
  this.dustPool=this.dustPool.filter(p=>p.age<p.life);
  n=0;
  for(const p of this.pulsePool){
   if(n>=limit(CAP.pulses))break;
   const u=clamp(p.age/p.life,0,1),r=p.radius*(.65+u*1.8);
   dummy.position.set(p.x,p.y,p.z);
   dummy.rotation.set(u*.55,u*.32,p.age*1.5);
   dummy.scale.set(r,r*(.85+u*.2),Math.max(.03,(1-u)*.9));dummy.updateMatrix();
   this.pulses.setMatrixAt(n,dummy.matrix);this.pulses.setColorAt(n,pigment.setHex(p.color));n++;
  }
  this.pulses.count=n;this.pulses.instanceMatrix.needsUpdate=true;
  if(this.pulses.instanceColor)this.pulses.instanceColor.needsUpdate=true;

  n=0;
  for(const part of this.dustPool){
   if(n>=limit(CAP.dust))break;
   const f=1-part.age/part.life;
   dummy.position.set(part.x,part.y,part.z);
   dummy.rotation.set(part.age*4,part.age*6,part.age*2);
   dummy.scale.setScalar(part.size*(.35+.65*f));dummy.updateMatrix();
   this.dust.setMatrixAt(n,dummy.matrix);this.dust.setColorAt(n,pigment.setHex(part.color));n++;
  }
  this.dust.count=n;this.dust.instanceMatrix.needsUpdate=true;
  if(this.dust.instanceColor)this.dust.instanceColor.needsUpdate=true;

  this.shield.visible=this.shieldAge<.7&&!reduced;
  if(this.shield.visible){
   const u=this.shieldAge/.7;
   this.shield.position.set(player.x,player.y,1.1);
   this.shield.scale.setScalar(1.1+u*1.35);
   this.shield.rotation.set(t*.6,t*.32,0);
   this.shield.material.opacity=.28*(1-u);
  }
  this.novaShell.visible=this.novaAge<1.3&&!reduced;
  if(this.novaShell.visible){
   const u=this.novaAge/1.3;
   this.novaShell.position.set(player.x,player.y,.8);
   this.novaShell.scale.setScalar(1.2+u*clamp(this.novaSize*.82,5,13));
   this.novaShell.rotation.set(t*.4,t*.33,t*.25);
   this.novaShell.material.opacity=.18*(1-u)*(1-u);
  }
  this.total=this.tracer.count+this.warningRails.count+this.activeBeams.count+this.lockGyros.count+this.pickupOrbits.count+this.enemyVortices.count+this.pilotGhosts.count+this.driftFrames.count+this.iris.count+this.pulses.count+this.dust.count;
 }
 diagnostics(){return {features:DEPTH_SPECTACLE_FEATURES.length,stage:this.stage,instances:this.total,tracers:this.tracer.count,warnings:this.warningRails.count,beams:this.activeBeams.count,locks:this.lockGyros.count,salvage:this.pickupOrbits.count,enemyVortices:this.enemyVortices.count,ghosts:this.pilotGhosts.count,iris:this.iris.count,debris:this.dust.count,pulses:this.pulses.count,shield:this.shield.visible,nova:this.novaShell.visible,budget:CAP};}
}
