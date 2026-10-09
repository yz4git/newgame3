import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import {CINEMATIC_BUDGETS as LIMIT,CINEMATIC_ENV_MOTION as SPEED,CINEMATIC_STAGE_COLORS as COLORS} from './cinematics-spec.ts';

const dummy=new T.Object3D();
const mod=(x:number,n:number)=>((x%n)+n)%n;
const seed=(n:number)=>{const k=Math.sin(n*127.1+78.233)*43758.5453;return k-Math.floor(k);};
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
type Ring={mesh:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>;age:number;life:number;radius:number;grow:number;x:number;y:number;z:number};
type Shard={x:number;y:number;z:number;vx:number;vy:number;vz:number;spin:number;age:number;life:number;size:number;color:T.Color};
type Trail={x:number;y:number;z:number;age:number;life:number;side:number};

const stageMats=COLORS.map(color=>new T.Color(color));
/**
 * World-space-only cinematics. Every component is physically depth positioned and
 * conservatively shaded. Purely visual — no hitboxes, combat RNG or extra lights.
 * All effects are pooled / InstancedMesh so stage length cannot increase memory use.
 */
export class VolumetricCinematics {
 readonly root=new T.Group();
 private backdrop=new T.Group();
 private near=new T.Group();
 private shipFx=new T.Group();
 private actorFx=new T.Group();
 private motes:T.InstancedMesh;
 private flybys:T.InstancedMesh;
 private contrails:T.InstancedMesh;
 private fragments:T.InstancedMesh;
 private lanterns:T.InstancedMesh;
 private enemyJets:T.InstancedMesh;
 private missileSpirals:T.InstancedMesh;
 private warpTunnel:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>[]=[];
 private stageLightning:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>[]=[];
 private exhaust:T.Mesh<T.ConeGeometry,T.MeshBasicMaterial>[]=[];
 private gantries:T.Group[]=[];
 private rotors:T.Mesh<T.TorusGeometry,T.MeshStandardMaterial>[]=[];
 private sweeps:T.Mesh<T.ConeGeometry,T.MeshBasicMaterial>[]=[];
 private bossHalos:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>[]=[];
 private rings:Ring[]=[];
 private shardPool:Shard[]=[];
 private trailPool:Trail[]=[];
 private currentStage=-1;
 private clock=0;
 private serial=0;
 private trailsAt=-10;
 private bossAge=-1;
 private eventsProcessed=0;
 private mobileMode=false;
 private visualCount=0;
 constructor(){
  this.root.name='world-space-cinematics-v31';
  this.root.add(this.backdrop,this.near,this.shipFx,this.actorFx);
  this.backdrop.name='depth-parallax-effects';
  this.near.name='physical-near-scene';
  this.shipFx.name='real-engine-volume-and-wingtip-streams';
  this.actorFx.name='boss-and-structural-world-shockwaves';
  const instance=(geometry:T.BufferGeometry,material:T.Material,count:number,parent:T.Group)=>{
   const m=new T.InstancedMesh(geometry,material,count);
   m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;
   parent.add(m);return m;
  };
  this.motes=instance(new T.TetrahedronGeometry(.12,0),new T.MeshBasicMaterial({color:0xa7c6d6,transparent:true,opacity:.40,depthWrite:false,toneMapped:true}),LIMIT.atmosphere,this.backdrop);
  this.flybys=instance(new T.IcosahedronGeometry(.5,0),new T.MeshStandardMaterial({color:0xb1bfce,roughness:.85,metalness:.15}),LIMIT.nearFlybys,this.near);
  this.contrails=instance(new T.CylinderGeometry(.09,.21,1,5),new T.MeshBasicMaterial({color:0x9dcfff,transparent:true,opacity:.40,depthWrite:false,toneMapped:true}),LIMIT.contrails,this.shipFx);
  this.fragments=instance(new T.IcosahedronGeometry(.38,0),new T.MeshStandardMaterial({color:0xb4ad9f,metalness:.64,roughness:.43,transparent:true,opacity:.92,depthWrite:true}),LIMIT.shards,this.actorFx);
  this.lanterns=instance(new T.SphereGeometry(.12,6,4),new T.MeshBasicMaterial({color:0xe2eedf,transparent:true,opacity:.63,depthWrite:false,toneMapped:true}),32,this.backdrop);
  this.enemyJets=instance(new T.ConeGeometry(.16,.75,5),new T.MeshBasicMaterial({color:0xf1ab78,transparent:true,opacity:.36,depthWrite:false,toneMapped:true}),96,this.shipFx);
  this.missileSpirals=instance(new T.TorusGeometry(.19,.045,4,10),new T.MeshBasicMaterial({color:0xeea16c,transparent:true,opacity:.52,depthWrite:false,toneMapped:true}),48,this.actorFx);
  for(let i=0;i<9;i++){
   const ring=new T.Mesh(new T.TorusGeometry(1,.06,5,40),new T.MeshBasicMaterial({color:0x84c5dc,transparent:true,opacity:.22,depthWrite:false,toneMapped:true}));
   ring.name='stage-transition-3d-warp-gate-'+i;ring.visible=false;
   ring.position.z=-2-i*.9;ring.rotation.x=.15;this.backdrop.add(ring);this.warpTunnel.push(ring);
  }
  // Low-duty-cycle branching lightning, true geometry with distant and near depth.
  for(let i=0;i<2;i++){
   const positions:number[]=[];for(let j=0;j<10;j++){
    const y=4-j*1.0,x=Math.sin(j*2.6+i*7.3)*.20+(j%2?.24:-.28),z=-2.7+(j%3)*-.20;
    positions.push(x,y,z);
   }
   const curve=new T.CatmullRomCurve3(Array.from({length:10},(_,j)=>new T.Vector3(positions[j*3],positions[j*3+1],positions[j*3+2])));
   const mesh=new T.Mesh(new T.TubeGeometry(curve,24,.055,4,false),new T.MeshBasicMaterial({color:0xafd9fd,transparent:true,opacity:.30,depthWrite:false,toneMapped:true}));
   mesh.name='real-3d-storm-discharge-'+i;mesh.visible=false;this.backdrop.add(mesh);this.stageLightning.push(mesh);
  }
  for(const [i,m]of [this.flybys,this.contrails,this.fragments].entries()){
   m.setColorAt(0,new T.Color(0xffffff));m.instanceColor!.setUsage(T.DynamicDrawUsage);
  }
  for(let i=0;i<2;i++){
   const mat=new T.MeshBasicMaterial({color:0x68c9ff,transparent:true,opacity:.30,depthWrite:false,side:T.DoubleSide,toneMapped:true});
   const jet=new T.Mesh(new T.ConeGeometry(.23,1.7,9,1,true),mat);
   jet.name='volumetric-rocket-jet-'+i;jet.rotation.z=Math.PI;jet.frustumCulled=false;
   this.shipFx.add(jet);this.exhaust.push(jet);
  }
  for(let i=0;i<LIMIT.gantries;i++){
   const group=new T.Group();group.name='parallax-gantry-'+i;
   const metal=new T.MeshStandardMaterial({color:0x4f6778,metalness:.62,roughness:.50});
   const dark=new T.MeshStandardMaterial({color:0x273e52,metalness:.44,roughness:.6});
   const frame=(x:number,y:number,z:number,w:number,h:number,d:number,mat=metal)=>{
    const box=new T.Mesh(new T.BoxGeometry(w,h,d),mat);box.position.set(x,y,z);box.castShadow=false;group.add(box);
   };
   frame(0,0,0,2.9,6.2,.7,dark);frame(-1.4,0,.38,.22,5.9,.25);frame(1.4,0,.38,.22,5.9,.25);
   for(let j=-2;j<=2;j++)frame(0,j*1.05,.36,2.8,.14,.15);
   const rim=new T.Mesh(new T.TorusGeometry(.75,.11,6,20),metal);
   rim.position.set(0,.5,.6);rim.rotation.x=.16;group.add(rim);
   group.userData.rim=rim;this.near.add(group);this.gantries.push(group);
  }
  const rotorMaterial=new T.MeshStandardMaterial({color:0x92bbc8,metalness:.65,roughness:.30});
  for(let i=0;i<4;i++){
   const torus=new T.Mesh(new T.TorusGeometry(1.5,.12,6,32),rotorMaterial);
   torus.name='volumetric-dock-rotor-'+i;torus.castShadow=false;
   torus.position.z=-3.3;this.near.add(torus);this.rotors.push(torus);
  }
  for(let i=0;i<4;i++){
   const cone=new T.Mesh(new T.ConeGeometry(1.9,6.8,12,1,true),new T.MeshBasicMaterial({color:0x79c3cc,side:T.DoubleSide,transparent:true,opacity:.045,depthWrite:false,depthTest:true,toneMapped:true}));
   cone.rotation.x=Math.PI/2;cone.name='searchlight-volume-'+i;cone.position.z=-3.7;
   this.backdrop.add(cone);this.sweeps.push(cone);
  }
  for(let i=0;i<3;i++){
   const ring=new T.Mesh(new T.TorusGeometry(1,.055,6,48),new T.MeshBasicMaterial({color:0xa7d1eb,transparent:true,opacity:.22,depthWrite:false,toneMapped:true}));
   ring.visible=false;ring.position.z=-.9+i*.16;
   ring.name='boss-entry-halo-'+i;this.actorFx.add(ring);this.bossHalos.push(ring);
  }
  for(let i=0;i<LIMIT.rings;i++){
   const m=new T.Mesh(new T.TorusGeometry(1,.055,5,44),new T.MeshBasicMaterial({color:0xffb77f,transparent:true,opacity:.0,depthWrite:false,toneMapped:true}));
   m.name='volumetric-impact-depth-'+i;m.visible=false;this.actorFx.add(m);
   this.rings.push({mesh:m,age:999,life:1,radius:1,grow:1,x:0,y:0,z:0});
  }
  this.fragments.count=this.contrails.count=this.flybys.count=this.motes.count=this.lanterns.count=this.enemyJets.count=this.missileSpirals.count=0;
 }
 event(e:GameEvent){
  const types=['explode','resonance','part','fieldcollapse','fieldburst','fieldcritical','nova','bosskill','bosstransform','bossform','phase','damage','midkill','missionclear','fieldclear'];
  if(e.type==='stage'){this.shardPool.length=0;this.trailPool.length=0;this.rings.forEach(r=>{r.age=999;r.mesh.visible=false;});this.eventsProcessed=0;this.trailsAt=-10;return;}
  if(!types.includes(e.type))return;
  if(this.eventsProcessed>=LIMIT.maxEventsPerFrame)return;
  this.eventsProcessed++;
  const size=clamp(e.size??1.1,.4,13),important=['bosskill','nova','fieldcollapse','bosstransform'].includes(e.type);
  const color=e.type==='nova'?0x70cbef:e.type.startsWith('field')?0xe5a66e:e.color??0xffad74;
  const ringCount=e.type==='bosskill'?3:e.type==='nova'?3:important?2:1;
  for(let i=0;i<ringCount;i++){
   let ring=this.rings.find(r=>r.age>=r.life);
   if(!ring)ring=this.rings.reduce((a,b)=>a.age/a.life>b.age/b.life?a:b);
   const z=e.type.startsWith('field')?-.25:e.type==='nova'?1.25:1.0;
   Object.assign(ring,{x:e.x??0,y:e.y??0,z:z+i*.32,radius:clamp(size*.20,.7,2.2),grow:clamp(size*.65,1.4,6.2),age:-i*.12,life:important?1.4:0.85});
   ring.mesh.material.color.setHex(i===0?color:i===1?0x8bc4de:0xe7bd96);
  }
  const debris=e.type==='fieldcollapse'?27:e.type==='bosskill'?44:e.type==='explode'?9:e.type==='part'?9:e.type==='bosstransform'?15:e.type==='resonance'?12:0;
  for(let i=0;i<debris;i++){
   const k=++this.serial,a=seed(k+2)*Math.PI*2,v=(1.8+seed(k+31)*5)*(important?1.15:1);
   if(this.shardPool.length>=LIMIT.shards)this.shardPool.shift();
   this.shardPool.push({
    x:e.x??0,y:e.y??0,z:e.type.startsWith('field')?-.65:1.4,
    vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:seed(k+51)*4-1.7,
    spin:seed(k+71)*12,age:0,life:.6+seed(k+91)*1.05,
    size:(.12+seed(k+111)*.21)*(important?1.3:1),color:new T.Color(i%5===0?0xd6d4bf:color)
   });
  }
 }
 private setStage(stage:number){
  if(this.currentStage===stage)return;this.currentStage=stage;
  const envColor=stageMats[stage];
  (this.motes.material as T.MeshBasicMaterial).color.copy(envColor);
  (this.lanterns.material as T.MeshBasicMaterial).color.copy(envColor).lerp(new T.Color(0xffffff),.23);
  (this.flybys.material as T.MeshStandardMaterial).color.setHex(stage===3?0xb6d3e5:stage===4?0x708d62:stage===5?0x69504a:0x758fa0);
  (this.contrails.material as T.MeshBasicMaterial).color.setHex(stage===5?0xffbb89:0x8cceeb);
  (this.fragments.material as T.MeshStandardMaterial).color.setHex(stage===5?0xaf7957:0xaaaeb3);
  for(const cone of this.sweeps){cone.material.color.copy(envColor);}
  for(const ring of this.warpTunnel)ring.material.color.copy(envColor);
  (this.missileSpirals.material as T.MeshBasicMaterial).color.setHex(stage===5?0xffbf8c:0xffa67e);
  for(const jet of this.exhaust){jet.material.color.setHex(stage===5?0xffb174:0x83d4ed);}
 }
 draw(g:Game,dt:number,reduced=false,performance=false){
  this.setStage(g.stage);
  this.eventsProcessed=0;
  const title=g.state==='title',active=g.state==='playing'||g.state==='transition';
  this.root.visible=title||active;
  if(!this.root.visible)return;
  this.clock=g.visualTime;
  this.mobileMode=performance;const stage=g.stage,t=this.clock,speed=SPEED[stage];
  const density=reduced?15:performance?28:LIMIT.atmosphere;
  for(let i=0;i<density;i++){
   const z=-1.8-seed(i+137)*11.5,x=(seed(i+11)*2-1)*17;
   const y=mod(seed(i+47)*89-t*(3+seed(i+75)*3)*speed,89)-44;
   dummy.position.set(x+Math.sin(t*.23+i)*.08,y,z);
   dummy.rotation.set(i*.21,t*.42+i*.3,0);
   const scale=(.04+seed(i+71)*.10)*(z>-5?1.1:1.4);
   dummy.scale.set(scale,scale*(1.5+seed(i+87)*2.8),scale);
   dummy.updateMatrix();this.motes.setMatrixAt(i,dummy.matrix);
  }this.motes.count=density;this.motes.instanceMatrix.needsUpdate=true;
  const flybyCount=reduced?4:performance?7:LIMIT.nearFlybys;
  for(let i=0;i<flybyCount;i++){
   const side=i%2?-1:1,z=-6.6+seed(i+55)*5.5;
   const y=mod(i*13.7+17-t*speed*(3.5+seed(i+15)*2),104)-52;
   const x=side*(9.2+seed(i+32)*5.0);
   const s=.4+seed(i+29)*1.8;
   dummy.position.set(x,y,z);dummy.rotation.set(t*.13+i, t*.15+i*.3, t*.17+i*.7);
   dummy.scale.set(s*.85,s*1.65,s*.75);dummy.updateMatrix();
   this.flybys.setMatrixAt(i,dummy.matrix);
   this.flybys.setColorAt(i,new T.Color(stage===3?0xc7e9ff:stage===4?0x86aa75:stage===5?0xa18371:0xaac2ce));
  }this.flybys.count=flybyCount;this.flybys.instanceMatrix.needsUpdate=true;if(this.flybys.instanceColor)this.flybys.instanceColor.needsUpdate=true;
  for(let i=0;i<this.gantries.length;i++){
   const group=this.gantries[i],side=i%2?-1:1;
   group.visible=!reduced&&!performance&&stage!==4;
   group.position.set(side*(12.4+(i%2)*.6),mod(i*31+12-t*3.8*speed,110)-55,-3.7-(i%3)*.35);
   group.rotation.z=side*(.08+Math.sin(t*.13+i)*.025);
   const rim=group.userData.rim as T.Mesh;rim.rotation.z=t*.43+i;
   group.scale.setScalar(.8+(i%2)*.23);
  }
  for(let i=0;i<this.rotors.length;i++){
   const m=this.rotors[i],side=i%2?-1:1;
   m.visible=!performance&&!reduced&&stage!==4;
   m.position.set(side*(11.4+seed(i+7)*1.2),mod(i*33+8-t*4.4,112)-56,-3.1);
   m.rotation.set(Math.sin(t*.4+i)*.26,Math.cos(t*.31+i)*.4,t*.28*(side)+i);
   m.scale.setScalar(.78+(i%2)*.35);
  }
  for(let i=0;i<this.sweeps.length;i++){
   const m=this.sweeps[i],side=i%2?-1:1;
   m.visible=!reduced&&!performance&&stage!==0;
   m.position.set(side*(10.5+seed(i+29)*2),mod(i*27+15-t*3.8,105)-52,-4.5);
   m.rotation.z=side*(.4+Math.sin(t*.47+i)*.36);
   m.material.opacity=.036+.018*(.5+.5*Math.sin(t*.82+i));
  }
  const lightCount=reduced?9:performance?15:32;
  for(let i=0;i<lightCount;i++){
   const side=i%2?-1:1,z=-2.9+seed(i+83)*1.1;
   dummy.position.set(side*(9.25+seed(i+94)*4.3),mod(i*11-t*(3.7+seed(i+42)),90)-45,z);
   dummy.scale.setScalar(.1+seed(i+91)*.07);dummy.rotation.set(0,0,0);dummy.updateMatrix();
   this.lanterns.setMatrixAt(i,dummy.matrix);
  }this.lanterns.count=lightCount;this.lanterns.instanceMatrix.needsUpdate=true;
  // A 3D thrust cone for airborne hostiles: the underside of each craft reacts
  // to rolls, unlike the old face-on engine sprite. Bounded, independent of bullets.
  let jets=0;for(const e of g.enemies){
   if(e.dead||e.ground||jets>=96)continue;
   const side=e.kind==='bomber'||e.kind==='cruiser'||e.kind==='corvette'?1.1:.45;
   const multi=e.kind==='bomber'||e.kind==='cruiser'||e.kind==='corvette'?2:1;
   for(let i=0;i<multi&&jets<96;i++){
    dummy.position.set(e.x+(multi===1?0:(i?side:-side)),e.y+e.radius*.7,1.05);
    dummy.rotation.set(0,0,Math.sin(e.age*1.7+e.id)*.08);
    dummy.scale.set(.67,.66+Math.sin(t*14+e.id)*.12,.7);
    dummy.updateMatrix();this.enemyJets.setMatrixAt(jets++,dummy.matrix);
   }
  }
  this.enemyJets.count=reduced?0:performance?Math.min(jets,34):jets;
  this.enemyJets.instanceMatrix.needsUpdate=true;
  // Missiles have physical circular ion wake, not another full-screen glow sprite.
  let missiles=0;
  for(const b of g.bullets){
   if(b.shape!=='missile'||missiles>=48)continue;
   dummy.position.set(b.x,b.y,b.enemy?1.13:1.24);
   dummy.rotation.set(Math.PI*.10,Math.sin(t*8+missiles)*.3,t*6+missiles);
   dummy.scale.setScalar(.6+.25*Math.sin(t*11+missiles));
   dummy.updateMatrix();this.missileSpirals.setMatrixAt(missiles++,dummy.matrix);
  }
  this.missileSpirals.count=reduced?0:performance?Math.min(missiles,20):missiles;
  this.missileSpirals.instanceMatrix.needsUpdate=true;
  // Stage changes become a receding 3D tunnel instead of a white screen flash.
  const warp=g.state==='transition'&&!reduced;
  for(let i=0;i<this.warpTunnel.length;i++){
   const gate=this.warpTunnel[i];gate.visible=warp;if(!warp)continue;
   const u=mod(3.5-g.transitionTime+i*.36,3.5)/3.5;
   gate.position.set(0,(i-4)*1.2,(u*11)-12);
   gate.scale.setScalar(3.0+u*8.5);
   gate.rotation.z=t*.21+i*.34;
   gate.material.opacity=.045+.16*(1-u)**1.2;
  }
  for(let i=0;i<this.stageLightning.length;i++){
   const bolt=this.stageLightning[i];
   bolt.visible=!reduced&&!performance&&(stage===3||stage===5)&&Math.sin(t*(stage===3?1.8:1.1)+i*9)>.982;
   bolt.position.set((i?1:-1)*10.5,mod(i*27+13-t*3.8,90)-45,-2);
   bolt.rotation.z=Math.sin(t*.7+i)*.16;
  }
  const showJet=active&&g.hull>0&&g.state!=='transition';
  this.exhaust.forEach((jet,i)=>{
   jet.visible=showJet;jet.position.set(g.player.x+(i?1:-1)*.54,g.player.y-1.90,.70);
   const bank=clamp(g.player.vx*.015,-.28,.28);
   jet.rotation.z=Math.PI+bank;
   const length=1.18+(reduced?0:.27*Math.sin(t*22+i*1.4));
   jet.scale.set(.90,length,.90);
  });
  if(showJet&&dt>0&&!reduced&&t-this.trailsAt>.075){
   this.trailsAt=t;
   for(const side of[-1,1]){
    if(this.trailPool.length>=LIMIT.contrails)this.trailPool.shift();
    this.trailPool.push({x:g.player.x+side*.60,y:g.player.y-1.55,z:1.01,age:0,life:1.0,side});
   }
  }
  if(dt>0){for(const sample of this.trailPool)sample.age+=dt;}
  this.trailPool=this.trailPool.filter(s=>s.age<s.life);
  for(let i=0;i<this.trailPool.length;i++){
   const p=this.trailPool[i],f=1-p.age/p.life;
   dummy.position.set(p.x,p.y-p.age*1.3,p.z-p.age*.22);
   dummy.rotation.set(.1,0,(p.side*.05)+Math.sin(p.age*3)*.04);
   dummy.scale.set(.09+f*.13,.25+f*.6,.06+f*.07);
   dummy.updateMatrix();this.contrails.setMatrixAt(i,dummy.matrix);
   this.contrails.setColorAt(i,new T.Color(0x4d738c).lerp(stageMats[stage],f*.65));
  }
  this.contrails.count=this.trailPool.length;this.contrails.instanceMatrix.needsUpdate=true;if(this.contrails.instanceColor)this.contrails.instanceColor.needsUpdate=true;
  const boss=g.boss&&!g.boss.dead?g.boss:null;
  for(let i=0;i<this.bossHalos.length;i++){
   const m=this.bossHalos[i];
   m.visible=!!boss&&!reduced;if(!boss)continue;
   const arrival=clamp(boss.age/(1.9+i*.16),0,1);
   const pulse=boss.phase>1?.11*Math.sin(t*(1.2+i*.38)):0;
   m.position.set(boss.x,boss.y-.7,-1.9+i*.31);
   m.rotation.set(Math.sin(t*.16+i)*.1,Math.cos(t*.21+i)*.15,t*(.12+i*.15));
   m.scale.setScalar((3.0+i*1.40)*(0.55+arrival*.42)+pulse);
   m.material.color.setHex(boss.form==='overcharged'?0xd48b65:boss.form==='shattered'?0x8bd6c6:COLORS[stage]);
   m.material.opacity=(.085+i*.02)*(arrival<.98?.55+arrival*.5:1)*(boss.rest?.8:1);
  }
  for(const ring of this.rings){
   const m=ring.mesh;if(dt>0)ring.age+=dt;
   const u=ring.age/ring.life;m.visible=u>=0&&u<1&&!reduced;if(!m.visible)continue;
   m.position.set(ring.x,ring.y,ring.z);m.rotation.set(Math.sin(u*Math.PI)*.24,u*.5,ring.age*.28);
   const radius=ring.radius+ring.grow*u;
   m.scale.set(radius,radius*(1-.20*u),1);
   m.material.opacity=(1-u)**1.25*(ring.life>1?.44:.32);
  }
  for(let i=0;i<this.shardPool.length;i++){const p=this.shardPool[i];if(dt>0){
   p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=2.6*dt;
  }}
  this.shardPool=this.shardPool.filter(p=>p.age<p.life);
  let shardCount=0;
  for(const p of this.shardPool){
   if(shardCount>=LIMIT.shards)break;
   const fade=clamp(1-p.age/p.life,0,1);
   dummy.position.set(p.x,p.y,p.z);
   dummy.rotation.set(p.age*p.spin,p.age*p.spin*.56,p.age*p.spin*.79);
   dummy.scale.setScalar(p.size*(.48+.52*fade));dummy.updateMatrix();
   this.fragments.setMatrixAt(shardCount,dummy.matrix);
   this.fragments.setColorAt(shardCount,p.color);
   shardCount++;
  }
  this.fragments.count=shardCount;this.fragments.instanceMatrix.needsUpdate=true;if(this.fragments.instanceColor)this.fragments.instanceColor.needsUpdate=true;
  this.visualCount=density+flybyCount+lightCount+this.contrails.count+shardCount+this.rings.filter(r=>r.mesh.visible).length+this.enemyJets.count+this.missileSpirals.count;
 }
 diagnostics(){return {enabled:this.root.visible,stage:this.currentStage,features:22,motes:this.motes.count,flybys:this.flybys.count,gantries:this.gantries.filter(m=>m.visible).length,rotors:this.rotors.filter(m=>m.visible).length,searchlights:this.sweeps.filter(m=>m.visible).length,lightning:this.stageLightning.filter(m=>m.visible).length,warpRings:this.warpTunnel.filter(m=>m.visible).length,enemyJets:this.enemyJets.count,missileSpirals:this.missileSpirals.count,contrails:this.contrails.count,fragments:this.fragments.count,shockwaves:this.rings.filter(r=>r.mesh.visible).length,bossHalos:this.bossHalos.filter(m=>m.visible).length,instances:this.visualCount,limits:LIMIT};}
}
