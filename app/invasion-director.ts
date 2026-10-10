import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
import {INVASION_BUDGET as LIMIT,INVASION_FEATURES} from './invasion-spec.ts';

const TAU=Math.PI*2;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const ease=(v:number)=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
const mod=(x:number,m:number)=>((x%m)+m)%m;
const hash=(n:number)=>{const x=Math.sin(n*127.1+23.71)*43758.5453;return x-Math.floor(x);};
const box=new T.BoxGeometry(1,1,1);
const tube=new T.CylinderGeometry(.5,.5,1,8);
const torus=new T.TorusGeometry(1,.075,8,44);
const dodeca=new T.DodecahedronGeometry(1,0);
const dummy=new T.Object3D();

type Chunk={x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;life:number;size:number;rot:number};
type Spectacle={age:number;life:number;x:number;y:number;stage:number};
type Capital={root:T.Group;turrets:T.Group[];vents:T.Mesh[]};
type Interval={name:string;strength:number};

/** Deterministic, stage-reactive orchestration. Only meshes, no game mutation.
 * The entire set is behind the projectile/player plane, with no new point lights.
 * Large ships briefly approach the center from depth, then peel to the flanks.
 */
export class InvasionDirector {
 readonly root=new T.Group();
 private dock=new T.Group();
 private dreadnoughts=new T.Group();
 private arena=new T.Group();
 private fractures=new T.Group();
 private travel=new T.Group();
 private metal=new T.MeshStandardMaterial({color:0x64758c,metalness:.62,roughness:.49});
 private alloy=new T.MeshStandardMaterial({color:0x8c9eaf,metalness:.72,roughness:.34});
 private dark=new T.MeshStandardMaterial({color:0x263549,metalness:.48,roughness:.57});
 private edges=new T.MeshStandardMaterial({color:0x9ab9c9,metalness:.53,roughness:.41});
 private warning=new T.MeshBasicMaterial({color:0xb2d9e7,transparent:true,opacity:.24,depthWrite:false,toneMapped:true});
 private rails:T.InstancedMesh;
 private gate:T.InstancedMesh;
 private shock:T.InstancedMesh;
 private platelets:T.InstancedMesh;
 private battleships:Capital[]=[];
 private bossCore=new T.Group();
 private bossPetals:T.Mesh[]=[];
 private bossBands:T.Mesh[]=[];
 private bossPylons:T.Mesh[]=[];
 private bossColumns:T.Mesh[]=[];
 private stage=-1;
 private elapsed=0;
 private shards:Chunk[]=[];
 private detonations:Spectacle[]=[];
 private serial=0;
 private lastPlay=false;
 private flyoverStrength=0;
 private currentCue:Interval={name:'none',strength:0};
 private get counted(){return this.rails.count+this.gate.count+this.shock.count+this.platelets.count;}
 constructor(){
  this.root.name='invasion-director-v34';
  this.dock.name='trench-run-architecture';
  this.dreadnoughts.name='dreadnought-intercept';
  this.arena.name='boss-rotating-hyperstructure';
  this.fractures.name='world-volume-ruptures';
  this.travel.name='hyperspace-strata';
  this.root.add(this.dock,this.dreadnoughts,this.arena,this.fractures,this.travel);
  const inst=(name:string,geo:T.BufferGeometry,mat:T.Material,n:number,group:T.Group)=>{
   const o=new T.InstancedMesh(geo,mat,n);
   o.name=name;o.frustumCulled=false;o.count=0;
   o.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(o);return o;
  };
  this.rails=inst('trench-running-giant-lattice',box,this.metal,LIMIT.trenchBeams,this.dock);
  this.gate=inst('rotating-multipass-hyperspace-portal',torus,this.edges,LIMIT.hyperRings,this.travel);
  this.shock=inst('inward-mechanical-collapse-shockframes',torus,this.warning,LIMIT.ruptureRings,this.fractures);
  this.platelets=inst('physical-rupture-metal-shards',box,this.alloy,LIMIT.debris,this.fractures);
  for(let i=0;i<LIMIT.dreadnoughts;i++){
   const craft=this.buildDreadnought(i);
   craft.root.name='dreadnought-interceptor-'+i;
   this.battleships.push(craft);
   this.dreadnoughts.add(craft.root);
  }
  this.bossCore.name='boss-radial-shipyard';this.arena.add(this.bossCore);
  for(let j=0;j<LIMIT.bossPetals;j++){
   const petal=this.add(this.bossCore,j%3===0?this.edges:this.metal,box,0,0,0,1,1,1);
   this.bossPetals.push(petal);
  }
  for(let j=0;j<4;j++){
   const band=this.add(this.bossCore,j%2===0?this.alloy:this.dark,torus,0,0,-2-j*.45,1,1,.8);
   this.bossBands.push(band);
  }
  for(let j=0;j<8;j++){
   const pylon=this.add(this.bossCore,j%2?this.dark:this.metal,box,0,0,-3,1,1,1);
   this.bossPylons.push(pylon);
  }
  for(let j=0;j<4;j++){
   const column=this.add(this.bossCore,this.edges,tube,0,0,-2,1,1,1);
   this.bossColumns.push(column);
  }
 }
 private add(parent:T.Group,mat:T.Material,geo:T.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const m=new T.Mesh(geo,mat);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);
  m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;
 }
 private buildDreadnought(id:number):Capital{
  const root=new T.Group(),turrets:T.Group[]=[],vents:T.Mesh[]=[];
  // Strong silhouette: wedge bow, hangar belly, twin articulated wings, gun turrets.
  this.add(root,this.dark,box,0,0,-.6,5.0,15,2.5);
  this.add(root,this.metal,box,0,2,.95,4.6,10.5,1);
  this.add(root,this.alloy,box,0,8,.65,2.4,5.6,2.0);
  this.add(root,this.dark,box,0,-6,-1.4,4.1,4.3,2.6);
  this.add(root,this.edges,box,0,3,1.6,.18,6.1,.15);
  for(const side of[-1,1]){
   const wing=this.add(root,this.metal,box,side*4,-1,-.65,5.6,6.3,1.1);
   wing.rotation.z=side*.22;
   const armor=this.add(root,this.alloy,box,side*5.5,-3,-.32,3.2,3.5,.5);
   armor.rotation.z=side*.30;
   this.add(root,this.dark,box,side*2.15,-7,-1.8,1.9,5.1,1.8);
   this.add(root,this.edges,box,side*2.15,-9.3,-1.1,1.25,2,.4);
   for(let j=0;j<3;j++)this.add(root,this.alloy,box,side*(1.35+j*1.6),3,1.05,.18,4.3,.22);
   const engine=this.add(root,this.warning,tube,side*2.15,-10,-1.8,.82,2.4,.82);
   vents.push(engine);
   for(let j=0;j<2;j++){
    const swivel=new T.Group();
    swivel.position.set(side*(2.8+j*2.3),1.3-j*3.5,1.08);
    this.add(swivel,this.dark,box,0,0,0,1.1,1.3,.8);
    for(const dx of[-.22,.22])this.add(swivel,this.edges,tube,dx,1.02,.30,.2,2.0,.2);
    root.add(swivel);turrets.push(swivel);
   }
  }
  if(id===1){
   this.add(root,this.dark,box,0,0,1.2,1.6,7,2.4);
   for(const y of[-3,3])this.add(root,this.edges,torus,0,y,2.5,1.65,1.65,1);
  }
  return {root,turrets,vents};
 }
 private setStage(stage:number){
  if(this.stage===stage)return;
  this.stage=stage;
  this.metal.color.setHex([0x68778a,0x617d83,0x5b778b,0x839bad,0x657d69,0x86634f][stage]??0x65798c);
  this.alloy.color.setHex([0xa7a4ba,0x95b5bb,0x9bb8d2,0xb3d7dd,0xb0bf96,0xb9937b][stage]??0x93aebf);
  this.dark.color.setHex([0x263046,0x193848,0x233049,0x2a4960,0x26443b,0x482e2c][stage]??0x23384c);
  this.edges.color.setHex([0xb4b4cf,0x84cfdb,0x83bedc,0xbedee4,0x95c8b0,0xe4aa82][stage]??0x9bbac6);
  this.warning.color.setHex([0xb7bcdd,0x89c5df,0x88bbd8,0xb2d5e4,0x9fd4ae,0xe5aa7c][stage]??0x99c6d9);
 }
 event(e:GameEvent){
  if(e.type==='stage'){
   this.shards.length=0;this.detonations.length=0;
   this.elapsed=0;this.flyoverStrength=0;this.lastPlay=false;
   this.currentCue={name:'stage-entry',strength:1};
   return;
  }
  if(e.type==='bosskill'||e.type==='fieldcollapse'||e.type==='fieldclear'){
   if(this.detonations.length>=LIMIT.ruptures)this.detonations.shift();
   this.detonations.push({age:0,life:e.type==='bosskill'?2.2:1.6,x:e.x??0,y:e.y??0,stage:this.stage});
   const n=e.type==='bosskill'?LIMIT.bossDebris:0; // facility shards belong to FacilityDemolition3D
   for(let i=0;i<n;i++){
    if(this.shards.length>=LIMIT.debris)this.shards.shift();
    const k=++this.serial,a=hash(k+9)*TAU,v=1.5+hash(k+19)*6.4;
    this.shards.push({
     x:e.x??0,y:e.y??0,z:e.type==='bosskill'?1.5:-.7,
     vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:hash(k+29)*7-2.5,
     age:0,life:.8+hash(k+39)*1.15,size:.20+hash(k+49)*.52,
     rot:hash(k+59)*13
    });
   }
  }
 }
 draw(g:Game,dt:number,reduced=false,performance=false,mix?:FxMix){
  const title=g.state==='title',active=g.state==='playing'||g.state==='transition';
  this.root.visible=title||active;
  if(!this.root.visible)return;
  this.setStage(g.stage);
  // delta is always simulation-derived and zero on pause. Lifecycle is deterministic.
  const clock=g.visualTime;
  this.elapsed=clock;
  const cinematic=!reduced&&!performance;
  const opening=g.state==='playing'&&g.time<9;
  const boss=!!g.boss&&!g.boss.dead;
  const transition=g.state==='transition';
  // Opening 0-5 s: the camera dives beneath a shipyard with overhead gantry arches.
  const dive=opening?Math.sin(Math.PI*clamp(g.time/8,0,1))**2:0;
  this.dock.visible=!reduced&&(opening||title)&&(!mix||!mix.crowded);
  let count=0;
  if(this.dock.visible){
   const n=performance?LIMIT.trenchBeams/2:LIMIT.trenchBeams;
   for(let i=0;i<n;i++){
    const rib=Math.floor(i/4),segment=i%4,u=mod(rib*11-clock*13,99)/99;
    const size=1.2+u*.65,span=12+u*2.5;
    dummy.position.set(
     segment===0?-span:segment===1?span:0,
     33-u*73,
     -18+u*15);
    dummy.rotation.set(
     segment===2||segment===3?.07:0,
     (segment%2?-.10:.10)*dive,
     segment===0?-.12:segment===1?.12:0
    );
    dummy.scale.set(
     segment<2?.62:span*2.07,
     segment<2?14*size:.72,
     segment<2?1.8:1.20);
    if(segment>=2){dummy.position.y+=segment===3?4.1:-4.1;dummy.position.z-=.50;}
    dummy.updateMatrix();this.rails.setMatrixAt(count++,dummy.matrix);
   }
  }
  this.rails.count=count;this.rails.instanceMatrix.needsUpdate=true;
  // The ship enters from 3D distance (manual perspective scale for ortho gameplay camera)
  // and makes its clearest pass during stage entry, then peels off into the sides.
  for(let i=0;i<this.battleships.length;i++){
   const d=this.battleships[i],u=mod(clock*.12+i*.47,.94)/.94;
   const intro=opening&&i===0;
   const entry=clamp(g.time/4.1,0,1);
   d.root.visible=!reduced&&(cinematic||i===0)&&(!boss||intro)&&(intro||mix?.showFlybys!==false);
   if(!d.root.visible)continue;
   const scale=intro?
    .35+ease(entry)*1.17:
    .37+Math.sin(u*Math.PI)*.56;
   const px=intro?(-3.5+ease(entry)*-4.4):(i%2?1:-1)*(8.5+u*7.0);
   const py=intro?(19-g.time*6.0):30-u*68;
   d.root.position.set(px,py,-15+scale*7-i*1.4);
   d.root.rotation.set(.16*Math.sin(clock*.3+i),.28*Math.sin(clock*.21+i),intro?-.18*ease(entry):(i%2?1:-1)*(.17+u*.28));
   d.root.scale.setScalar(scale);
   for(const [j,turret] of d.turrets.entries())turret.rotation.z=Math.sin(clock*1.1+j*.8)*.52;
   for(const [j,engine] of d.vents.entries())engine.scale.y=2+Math.sin(clock*14+j)*.4;
  }
  // A full mechanical sphere opens behind the boss as its phase changes.
  this.bossCore.visible=boss&&!reduced;
  if(mix&&!mix.showBossArchitecture)this.bossCore.visible=false;
  if(boss&&this.bossCore.visible){
   const b=g.boss!,u=ease(clamp(b.age/2.0,0,1)),ang=clock*(b.phase>=2?.18:.075);
   this.bossCore.position.set(b.x,b.y,-8+u*4);
   this.bossCore.rotation.set(.22*Math.sin(clock*.17),.31*Math.sin(clock*.2),.1*Math.sin(clock*.4));
   const R=7.2+u*1.2;
   for(let i=0;i<this.bossPetals.length;i++){
    const petal=this.bossPetals[i],a=i*TAU/this.bossPetals.length+ang*(i%2?-1:1);
    const radius=R*(.90+.1*Math.sin(clock*.41+i*.2)),open=b.rest?.65:1;
    petal.position.set(Math.cos(a)*radius,Math.sin(a)*radius,-1.5+Math.sin(clock*.5+i)*.68);
    petal.rotation.set(.3*Math.cos(a),.25*Math.sin(a),a-Math.PI/2);
    petal.scale.set(.48,3.2*open,.34);
   }
   for(let i=0;i<this.bossBands.length;i++){
    const ring=this.bossBands[i],r=R*(1.06+i*.32);
    // 4.0's stage-authored boss vault replaces these oversized dark rings;
    // they visually crossed the upper HUD and concealed the exposed reactor.
    ring.visible=g.mode!=='campaign';
    if(!ring.visible)continue;
    ring.rotation.set(.20+i*.18,Math.sin(clock*.16+i)*.32,clock*(i%2?-.23:.22));
    ring.scale.set(r,r*(.88+i*.035),1);
   }
   for(let i=0;i<this.bossPylons.length;i++){
    const pylon=this.bossPylons[i],a=i*TAU/this.bossPylons.length+ang*.3;
    pylon.position.set(Math.cos(a)*(R+2.8),Math.sin(a)*(R+2.8),-4);
    pylon.rotation.z=a+.35;pylon.scale.set(.9,4.6,1.4);
   }
   for(let i=0;i<this.bossColumns.length;i++){
    const col=this.bossColumns[i],a=i*TAU/4+clock*.04;
    col.position.set(Math.cos(a)*4.0,Math.sin(a)*4.0,-3.2);
    col.rotation.z=a;col.scale.set(.55,7.5,.55);
   }
  }
  // True depth-staged "hyperspace" coils during the otherwise non-interactive transition.
  this.travel.visible=transition&&!reduced;
  if(mix&&!mix.showWarpArchitecture)this.travel.visible=false;
  count=0;
  if(this.travel.visible){
   for(let i=0;i<LIMIT.hyperRings;i++){
    const u=mod(i*.17+clock*.36,1);
    const z=-38+u*35;
    const radius=2.5+u*10.0;
    dummy.position.set(Math.sin(clock*.35+i)*.4,Math.cos(clock*.2+i)*.6,z);
    dummy.rotation.set(clock*.15+i*.07,Math.sin(clock*.13+i)*.28,clock*(i%2?.26:-.22));
    dummy.scale.set(radius,radius*(.85+.08*Math.cos(i)),1);
    dummy.updateMatrix();this.gate.setMatrixAt(count++,dummy.matrix);
   }
  }
  this.gate.count=count;this.gate.instanceMatrix.needsUpdate=true;
  if(dt>0){
   for(const burst of this.detonations)burst.age+=dt;
   for(const p of this.shards){
    p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=3.5*dt;
   }
  }
  this.detonations=this.detonations.filter(x=>x.age<x.life);
  this.shards=this.shards.filter(x=>x.age<x.life);
  let nw=0;
  for(const burst of this.detonations){
   if(nw>=LIMIT.ruptureRings||reduced||!!mix)break; // one owner for large shock rings
   const u=clamp(burst.age/burst.life,0,1);
   // Three nested steel shockframes, not a bloom disk; scale toward depth.
   for(let j=0;j<3&&nw<LIMIT.ruptureRings;j++){
    dummy.position.set(burst.x,burst.y,-1.6-u*(2.5+j*.8));
    dummy.rotation.set(Math.sin(u*3+j)*.5,u*.8+j*.18,u*.4+j*.5);
    dummy.scale.setScalar(1.4+(2.0+j*.65)*ease(u));
    dummy.updateMatrix();this.shock.setMatrixAt(nw++,dummy.matrix);
   }
  }
  this.shock.count=nw;this.shock.instanceMatrix.needsUpdate=true;
  count=0;
  for(const p of this.shards){
   if(count>=LIMIT.debris||reduced)break;
   const f=1-p.age/p.life;
   dummy.position.set(p.x,p.y,p.z);
   dummy.rotation.set(p.rot*p.age,p.rot*.7*p.age,p.rot*.4*p.age);
   dummy.scale.set(p.size*f,p.size*f*2.2,p.size*f*.85);
   dummy.updateMatrix();this.platelets.setMatrixAt(count++,dummy.matrix);
  }
  this.platelets.count=count;this.platelets.instanceMatrix.needsUpdate=true;
  this.flyoverStrength=opening?dive:0;
  this.currentCue=transition?{name:'hyperspace-entry',strength:1}:
   boss?{name:'boss-hyperstructure',strength:ease(Math.min(1,g.boss!.age/2))}:
   opening?{name:'trench-intercept',strength:dive}:{name:'patrol-flyover',strength:cinematic?.45:.2};
  this.lastPlay=active;
 }
 diagnostics(){return {features:INVASION_FEATURES.length,stage:this.stage,cue:this.currentCue.name,
  cueStrength:this.currentCue.strength,meshInstances:this.counted,openingStrength:this.flyoverStrength,
  dreadnoughts:this.battleships.filter(s=>s.root.visible).length,
  bossStructure:this.bossCore.visible,legacyBossBands:this.bossBands.filter(r=>this.bossCore.visible&&r.visible).length,travelRings:this.gate.count,ruptures:this.detonations.length,
  armorFragments:this.platelets.count,budgets:LIMIT};}
}
