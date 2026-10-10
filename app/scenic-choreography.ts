import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
import {STAGES} from './stages.ts';

const TAU=Math.PI*2;
const wrap=(x:number,n:number)=>((x%n)+n)%n;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const seed=(i:number,s=0)=>{const n=Math.sin((i+s*137)*78.233+19.2)*43758.545;return n-Math.floor(n);};
const cube=new T.BoxGeometry(1,1,1);
const barrel=new T.CylinderGeometry(.5,.5,1,9);
const ring=new T.TorusGeometry(1,.09,7,28);
const crystal=new T.IcosahedronGeometry(1,0);
const dummy=new T.Object3D();

interface Machinery {root:T.Group;hinge:T.Group;rotor:T.Group;ram:T.Mesh;signal:T.Mesh;side:number;index:number;}
interface Freight {root:T.Group;rotor:T.Group;side:number;index:number;}
interface BackdropCue {kind:'facility'|'boss'|'mission'|'finish';age:number;duration:number;x:number;y:number;}

/**
 * Exclusive scenic/background 3D choreography, completely outside hitboxes.
 * Everything is genuine depth-bearing geometry behind the projectile plane.
 * Nonessential traffic and weather are automatically reduced by the FX director.
 */
export class ScenicChoreography3D {
 readonly root=new T.Group();
 private architecture=new T.Group();
 private traffic=new T.Group();
 private scenery=new T.Group();
 private reaction=new T.Group();
 private shell=new T.MeshStandardMaterial({color:0x596b7d,metalness:.48,roughness:.56});
 private bright=new T.MeshStandardMaterial({color:0x879da9,metalness:.52,roughness:.45});
 private dark=new T.MeshStandardMaterial({color:0x263847,metalness:.40,roughness:.66});
 private accents=new T.MeshBasicMaterial({color:0x5a8994,transparent:true,opacity:.26,depthWrite:false,toneMapped:true});
 private natural=new T.MeshStandardMaterial({color:0x536d64,roughness:.94,metalness:0});
 private machines:Machinery[]=[];
 private freighters:Freight[]=[];
 private motes:T.InstancedMesh;
 private lines:T.InstancedMesh;
 private facade:T.Group[]=[];
 private shutters:T.Group[]=[];
 private warning:T.Mesh[]=[];
 private stage=-1;
 private lastTime=0;
 private cue:BackdropCue|null=null;
 private patrolCount=0;
 private backdropCount=0;
 private eventCount=0;
 private ambientCount=0;
 constructor(){
  this.root.name='scenic-director-v39-world-3d';
  this.architecture.name='stage-specific-kinetic-silhouettes';
  this.traffic.name='distant-intercept-cargo-traffic';
  this.scenery.name='far-field-weather-and-conduit-motion';
  this.reaction.name='event-reactive-world-machinery';
  this.root.add(this.architecture,this.traffic,this.scenery,this.reaction);
  this.motes=this.batch('deep-stage-volume-particles',crystal,this.natural,84,this.scenery);
  this.lines=this.batch('moving-cable-guides',cube,this.dark,48,this.scenery);
  for(let i=0;i<3;i++){
   const item=this.makeFreighter(i);
   this.freighters.push(item);this.traffic.add(item.root);
  }
  for(const side of[-1,1]){
   const sideRoot=new T.Group();
   sideRoot.name=side<0?'left-reactive-wall':'right-reactive-wall';
   sideRoot.position.set(side*10.7,7,-11.6);
   this.reaction.add(sideRoot);this.facade.push(sideRoot);
   this.block(sideRoot,this.dark,0,0,-.1,2.8,13.5,2.1);
   for(let j=0;j<5;j++){
    const y=-5.5+j*2.7;
    this.block(sideRoot,this.shell,0,y,.8,2.8,.32,.8);
    this.block(sideRoot,this.accents,side*.85,y,.92,.16,1.0,.12);
   }
   const hatch=new T.Group();
   hatch.position.set(side*.65,0,1.1);
   sideRoot.add(hatch);this.shutters.push(hatch);
   this.block(hatch,this.bright,0,0,0,1.35,7.1,.48);
   for(let j=0;j<4;j++){
    this.block(hatch,this.dark,0,-2.5+j*1.65,.28,1.2,.11,.16);
   }
   const indicator=this.block(sideRoot,this.accents,-side*.65,0,1.30,.22,2.7,.22);
   this.warning.push(indicator);
  }
  this.reaction.visible=false;
 }
 private batch(name:string,geo:T.BufferGeometry,mat:T.Material,max:number,owner:T.Group){
  const m=new T.InstancedMesh(geo,mat,max);
  m.name=name;m.frustumCulled=false;m.count=0;m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  owner.add(m);return m;
 }
 private block(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  const m=new T.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);
  m.castShadow=false;m.receiveShadow=true;parent.add(m);return m;
 }
 private mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;
 }
 private makeMachinery(stage:number,index:number):Machinery{
  const side=index===0?-1:1,root=new T.Group(),hinge=new T.Group(),rotor=new T.Group();
  root.name='stage-'+stage+'-movable-background-machine-'+index;
  // Every stage has a distinct silhouette, not recolored copies of one sprite.
  this.block(root,this.dark,0,0,-1,3.2,12,2.8);
  for(let j=0;j<4;j++)this.block(root,this.shell,side*.12,-4.5+j*2.9,.85,3.8,.53,.8);
  hinge.position.set(-side*.8,2,1.2);root.add(hinge);
  rotor.position.set(side*.5,-1.1,1.0);root.add(rotor);
  const arm=this.block(hinge,this.bright,side*1.6,0,0,4.3,.48,.70);
  const ram=this.mesh(root,barrel,this.shell,-side*.6,-3.0,1.3,.65,2.4,.65);
  const signal=this.block(root,this.accents,0,5.5,1.30,.55,.48,.20);
  if(stage===0){
   // Orbital quarry: mining clamps and enormous moving docking antenna.
   for(let j=0;j<3;j++){
    const claw=this.block(hinge,this.shell,side*(2.0+j*.49),j*.65-.65,.1,1.0,.32,.52);
    claw.rotation.z=side*(j-1)*.4;
   }
   const dish=this.mesh(rotor,ring,this.bright,0,0,.5,2.0,2.0,.65);
   dish.rotation.x=.35;
   this.mesh(rotor,crystal,this.natural,0,0,.4,.85,.85,1.4);
  }else if(stage===1){
   // Maritime docks: telescopic loading booms and realistic shipyard cranes.
   this.block(hinge,this.dark,side*3.4,0,0,.57,4.8,.65);
   for(let j=0;j<3;j++)this.block(hinge,this.shell,side*(1.5+j*.9),-.65,.3,.37,1.8,.3);
   this.mesh(rotor,barrel,this.bright,0,0,0,1.55,1.5,1.55);
   for(let j=0;j<3;j++){const fin=this.block(rotor,this.bright,0,0,.6,.33,3.5,.26);fin.rotation.z=j*TAU/3;}
  }else if(stage===2){
   // Station transfer: rotary signal dish, enormous branching cable array.
   for(let j=0;j<4;j++)this.block(hinge,this.dark,side*(1+j*.9),j%2?.45:-.45,.3,.75,.30,.52);
   const dish=this.mesh(rotor,ring,this.bright,0,0,.5,2.6,2.6,1);
   dish.rotation.y=.32;
   for(const angle of[0,Math.PI/2]){
    const vane=this.block(rotor,this.shell,0,0,.2,4.7,.22,.45);vane.rotation.z=angle;
   }
  }else if(stage===3){
   // Glacier: crystal turbines and pivoting anti-ice sensor comb.
   for(let j=0;j<5;j++){
    const spike=this.mesh(hinge,crystal,this.natural,side*(.6+j*.77),j%2?.5:-.5,-.4,.45,1.1,.5);
    spike.rotation.z=.22*j;
   }
   for(let j=0;j<5;j++){
    const fin=this.mesh(rotor,crystal,this.bright,0,0,.5,.50,2.1,.30);
    fin.rotation.z=j*TAU/5;
   }
  }else if(stage===4){
   // Relic jungle: articulated ruins, moving solar clock and living antenna.
   for(let j=0;j<4;j++){
    const branch=this.mesh(hinge,barrel,this.natural,side*(1.0+j*.80),j%2?.5:-.35,.25,.40,1.8,.40);
    branch.rotation.z=side*(.2+j*.25);
   }
   for(let j=0;j<3;j++){
    const orb=this.mesh(rotor,crystal,this.natural,Math.cos(j*TAU/3)*1.20,Math.sin(j*TAU/3)*1.20,.2,.83,.66,.45);
    orb.rotation.z=j;
   }
   this.mesh(rotor,ring,this.bright,0,0,0,2.4,2.2,1);
  }else{
   // Vulcan: sliding heat pistons, huge 3D pressure-cage vanes.
   for(let j=0;j<4;j++){
    const pipe=this.mesh(hinge,barrel,this.bright,side*(.8+j*.77),j%2?-.38:.38,-.25,.45,3.3,.45);
    pipe.rotation.z=side*.18;
   }
   this.mesh(rotor,ring,this.shell,0,0,.4,2.3,2.3,1);
   for(let j=0;j<5;j++){
    const fin=this.block(rotor,this.dark,0,1.35,.3,.34,2.0,.42);fin.rotation.z=j*TAU/5;
   }
  }
  return {root,hinge,rotor,ram,signal,side,index};
 }
 private makeFreighter(index:number):Freight{
  const root=new T.Group(),rotor=new T.Group();
  root.name='small-real-3d-freight-escort-'+index;
  this.block(root,this.dark,0,0,-.2,1.4,3.1,.8);
  this.block(root,this.shell,0,.7,.4,.9,1.4,.5);
  for(const side of[-1,1]){
   const wing=this.block(root,this.bright,side*.95,-.1,-.5,1.25,.58,.27);
   wing.rotation.z=side*.12;
   this.mesh(root,barrel,this.dark,side*.53,-1.6,-.6,.5,1.1,.5);
   this.mesh(root,crystal,this.accents,side*.53,-2.08,-.55,.23,.42,.23);
  }
  rotor.position.set(0,1.2,.8);root.add(rotor);
  for(let j=0;j<3;j++){
   const fin=this.block(rotor,this.bright,0,0,0,.22,.98,.13);
   fin.rotation.z=j*TAU/3;
  }
  return {root,rotor,side:index%2?-1:1,index};
 }
 private tint(stage:number){
  const tint=[
   [0x6c7391,0x8c90b1,0x273045,0x617a99,0x6d738d],
   [0x54758c,0x8eb3ba,0x203c50,0x548c92,0x617e79],
   [0x5c7c96,0x91afc3,0x213b53,0x6699b3,0x7b91a1],
   [0x8daec2,0xb4d0dc,0x375466,0x7babb8,0x86aab7],
   [0x526c55,0x879d78,0x263e33,0x83a18a,0x617b54],
   [0x78594b,0xa98c6a,0x392823,0xb1845d,0x6c5549]
  ][stage]??[0x607080,0x8197a2,0x28394a,0x6d9ba8,0x627889];
  this.shell.color.setHex(tint[0]);this.bright.color.setHex(tint[1]);
  this.dark.color.setHex(tint[2]);this.accents.color.setHex(tint[3]);
  this.natural.color.setHex(tint[4]);
 }
 private setStage(stage:number){
  if(this.stage===stage)return;
  this.stage=stage;this.tint(stage);
  for(const item of this.machines)this.architecture.remove(item.root);
  this.machines=[];
  for(let i=0;i<2;i++){
   const item=this.makeMachinery(stage,i);
   this.machines.push(item);this.architecture.add(item.root);
  }
  this.cue=null;this.eventCount=0;
 }
 event(e:GameEvent){
  if(e.type==='stage'){this.cue=null;return;}
  let kind:BackdropCue['kind']|null=null;
  if(e.type==='fieldcollapse'||e.type==='fieldclear'||e.type==='fieldcritical')kind='facility';
  else if(['bossform','bosstransform','warning'].includes(e.type))kind='boss';
  else if(e.type==='missionstart'||e.type==='missionclear')kind='mission';
  else if(e.type==='bosskill')kind='finish';
  if(!kind)return;
  const priority={mission:1,facility:2,boss:3,finish:4};
  if(this.cue&&this.cue.age<this.cue.duration&&priority[kind]<priority[this.cue.kind])return;
  this.cue={kind,age:0,duration:kind==='finish'?2.8:kind==='boss'?2.2:kind==='mission'?1.8:2.3,
   x:e.x??0,y:e.y??0};
  this.eventCount++;
 }
 draw(g:Game,dt:number,mix:FxMix,reduced=false,performance=false){
  this.setStage(g.stage);
  const clock=g.visualTime;
  this.root.visible=g.state!=='result';
  if(!this.root.visible)return;
  const active=g.state==='playing'||g.state==='transition',boss=!!g.boss&&!g.boss.dead;
  const density=clamp(mix.density,0,1),t=clock;
  this.lastTime=t;
  if(this.cue&&dt>0)this.cue.age+=dt;
  if(this.cue&&this.cue.age>this.cue.duration)this.cue=null;
  const strength=this.cue?1-clamp(this.cue.age/this.cue.duration,0,1):0;
  // Large articulated landmarks carry the stage identity; they live at the
  // margins and never overlap the gameplay corridor at z>=0.
  for(const rig of this.machines){
   const show=!reduced&&!performance&&(mix.showAmbientStructures||!active);
   rig.root.visible=show;
   const phase=wrap(rig.index*47+21-t*(g.stage===2?2.5:3.6),109);
   rig.root.position.set(rig.side*(12.2+rig.index*.7),phase-54,-10-rig.index*3);
   rig.root.rotation.set(.15*rig.side,Math.sin(t*.17+rig.index)*.11,rig.side*.08);
   rig.hinge.rotation.z=rig.side*(Math.sin(t*(g.stage===5?.85:.38)+rig.index)*.34+.12*strength);
   rig.rotor.rotation.z=t*(g.stage===5?.88:.38)*(rig.index===0?1:-1);
   rig.rotor.rotation.y=Math.sin(t*.23+rig.index)*.17;
   rig.ram.position.y=-3+Math.sin(t*(g.stage===5?2.2:.75)+rig.index)*.75;
   (rig.signal.material as T.MeshBasicMaterial).opacity=.15+.10*strength;
  }
  // Cargo in the far field: never the low-altitude combat ships and never
  // reused weapon silhouettes. During bullet crowding keep the air clear.
  const patrol=active&&mix.showFlybys&&!boss&&!reduced&&!performance;
  this.patrolCount=patrol?3:0;
  this.traffic.visible=patrol;
  if(patrol)for(const freight of this.freighters){
   const u=wrap(t*.055+freight.index*.34,1);
   freight.root.position.set(freight.side*(9.5+u*3.2),40-u*82,-12-freight.index*2.7);
   freight.root.rotation.set(.22*Math.sin(t*.30+freight.index),.3*freight.side,freight.side*(.11+u*.17));
   freight.root.scale.setScalar(.38+Math.sin(u*Math.PI)*.35);
   freight.rotor.rotation.z=t*(1.8+freight.index*.14);
  }
  const worldDensity=reduced?0:performance?.18:density;
  let count=0;
  for(let i=0;i<Math.floor(84*worldDensity);i++){
   const side=i%2?1:-1;
   const z=-8-(i%5)*2.4;
   const y=wrap(seed(i,7)*95-t*(1.2+seed(i,9)*2.2),95)-47.5;
   const x=side*(7.8+seed(i,14)*9.8);
   const a=Math.sin(t*.34+i*2.1);
   dummy.position.set(x+a*.30,y,z);
   dummy.rotation.set(t*.11+i*.2,t*.17,i*.8);
   const size=(g.stage===3?.11:g.stage===5?.075:.055)*(1+seed(i,6)*1.5);
   dummy.scale.set(size,size*(g.stage===3?3.2:g.stage===5?2.0:1.6),size);
   dummy.updateMatrix();this.motes.setMatrixAt(count++,dummy.matrix);
  }
  this.motes.count=count;this.motes.instanceMatrix.needsUpdate=true;
  this.ambientCount=count;
  const rails=!reduced&&!performance&&!mix.crowded&&mix.showAmbientStructures;
  let n=0;
  if(rails)for(let i=0;i<48;i++){
   const side=i%2?1:-1,depth=Math.floor(i/2)%4;
   const y=wrap(i*10.7-t*(2.3+depth*.75),103)-51.5;
   const x=side*(8.7+depth*1.2);
   dummy.position.set(x,y,-9-depth*2.5);
   dummy.rotation.set(0,.09*side,side*.1*Math.sin(t*.14+i));
   dummy.scale.set(.13,2.3+depth*.6,.36);
   dummy.updateMatrix();this.lines.setMatrixAt(n++,dummy.matrix);
  }
  this.lines.count=n;this.lines.instanceMatrix.needsUpdate=true;
  // Reactive architectural light isn't a flash overlay: the shutters physically
  // withdraw and walls' side-mounted metal indicators brighten only modestly.
  const engaged=!reduced&&(!!this.cue&&strength>0||boss&&mix.showBossArchitecture);
  this.reaction.visible=engaged;
  const opening=engaged?(boss ? .85 : 1.0)*Math.max(strength,boss ? .60 : 0):0;
  for(let j=0;j<this.facade.length;j++){
   const f=this.facade[j],side=j?1:-1;
   f.position.set(side*10.7,this.cue?clamp(this.cue.y,-5,14):boss?g.boss!.y:7,-11.6);
   this.shutters[j].position.x=side*(.65+opening*1.4);
   this.shutters[j].rotation.y=side*opening*.52;
   (this.warning[j].material as T.MeshBasicMaterial).opacity=.12+.15*opening;
  }
  this.backdropCount=engaged?2:0;
 }
 diagnostics(){
  return {stage:this.stage,environment:STAGES[this.stage]?.environment??'unknown',
   machines:this.machines.filter(m=>m.root.visible).length,traffic:this.patrolCount,
   farWeather:this.ambientCount,animatedCables:this.lines.count,
   reactiveWallUnits:this.backdropCount,cue:this.cue?.kind??null,
   eventCount:this.eventCount,
   limits:{machines:2,freighters:3,environmentParticles:84,cableSegments:48,reactiveWalls:2},
   style:'world-space-3d-only'};
 }
}
