import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
import {STAGES} from './stages.ts';
import {noise} from './bg-map.ts';

/** Unlike the original endlessly repeating rails, the new sides are sparse,
 * differently sized architectural chapters with real moving transverse parts.
 * Shared mesh geometry, no photo planes, no additional lights/colliders.
 */
const BLOCK=new T.BoxGeometry(1,1,1);
const DRUM=new T.CylinderGeometry(.5,.5,1,9);
const WHEEL=new T.TorusGeometry(1,.13,6,24);
const SHARD=new T.IcosahedronGeometry(1,0);
const TAU=2*Math.PI;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const stageKey=(side:number,stage:number)=>stage+(side>0?31:0);

export const RAIL_DISTRICT_LIMITS={
 sides:2,slotsPerSide:3,variants:7,spacing:28,
 minCenterClearance:5.65,maxSceneMeshes:126,
 pulseOpacity:.18
} as const;
type Kind='open-dock'|'turbine-chamber'|'cargo-elevator'|'diagonal-gantry'|'broken-sector'|'pipe-manifold'|'signal-observatory';
const TYPES:Kind[]=['open-dock','turbine-chamber','cargo-elevator','diagonal-gantry','broken-sector','pipe-manifold','signal-observatory'];
interface Module{
 root:T.Group;type:Kind;rotor:T.Group;pod:T.Group;door:T.Group;arm:T.Group;signal:T.Mesh;
 side:number;slot:number;segment:number;meshes:number;
}
interface EventCue {kind:string;age:number;life:number;side:number;}
interface LateralLandmark {root:T.Group;head:T.Group;rotor:T.Group;side:number;pieces:number;}
function buildPart(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
 const m=new T.Mesh(geometry,material);
 m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;
 parent.add(m);return m;
}
function panel(parent:T.Object3D,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
 return buildPart(parent,BLOCK,material,x,y,z,w,h,d);
}
export class RailDistrictMotion3D {
 readonly root=new T.Group();
 private railRoot=new T.Group();
 private panels=new T.MeshStandardMaterial({color:0x718999,metalness:.55,roughness:.48});
 private edges=new T.MeshStandardMaterial({color:0x3c556a,metalness:.40,roughness:.60});
 private interiors=new T.MeshStandardMaterial({color:0x1b3041,metalness:.28,roughness:.81});
 private highlights=new T.MeshBasicMaterial({color:0x78b0b6,transparent:true,opacity:.12,depthWrite:false,toneMapped:true});
 private geology=new T.MeshStandardMaterial({color:0x788188,roughness:.89,metalness:0});
 private modules:Module[]=[];
 private landmarks:LateralLandmark[]=[];
 private visibleLandmarks=0;
 private greatestSidewaysMotion=0;
 private lastStage=-1;
 private cue:EventCue|null=null;
 private currentGeometryCount=0;
 private activeModules=0;
 private movingModules=0;
 private leftModules=0;
 private rightModules=0;
 private activeVariants:string[]=[];
 private motionSpan=0;
 constructor(){
  this.root.name='world-alive-v42-rail-districts-and-lateral-landmarks';
  this.railRoot.name='large-asymmetric-side-chapters';
  this.root.add(this.railRoot);
 }
 private tint(stage:number){
  const palette=[
   [0x646780,0x34394d,0x151e31,0x7b8eaa,0x62647a],
   [0x617f93,0x3d5767,0x203548,0x79b5bb,0x475d64],
   [0x6d8599,0x344960,0x1a2e43,0x7da7be,0x5d697e],
   [0x95b0c4,0x4c6c82,0x213a50,0x9ac5d0,0x7e9dab],
   [0x728a6b,0x425c4c,0x253c30,0x8aa98d,0x526951],
   [0x876957,0x624437,0x33251f,0xab805d,0x655147]
  ][stage]??[0x758c98,0x415767,0x1c3040,0x8bafb4,0x707b82];
  this.panels.color.setHex(palette[0]);this.edges.color.setHex(palette[1]);
  this.interiors.color.setHex(palette[2]);this.highlights.color.setHex(palette[3]);this.geology.color.setHex(palette[4]);
 }
 private typeFor(stage:number,segment:number,side:number):Kind{
  // Deterministic asymmetric runs: left and right do not mirror one another.
  // Different sides always differ, even when facing the same sector.
  // Using 5*segment + a 3-step right-hand offset also separates adjacent
  // left/right sectors. Stage shifts preserve six independent art rhythms.
  const index=((segment*5+stage*3+(side>0?3:0))%7+7)%7;
  return TYPES[index];
 }
 private makeModule(stage:number,kind:Kind,side:number,slot:number,segment:number):Module{
  const root=new T.Group(),rotor=new T.Group(),pod=new T.Group(),door=new T.Group(),arm=new T.Group();
  root.name='rail-chapter-'+kind+'-'+side+'-'+segment;
  // The old rail backbone is NOT reproduced here: distinct open silhouettes
  // sit behind the separately broken baked floor rails.
  rotor.name='physical-moving-turbine';pod.name='lateral-cargo-shuttle';
  door.name='sliding-mechanical-iris';arm.name='cantilever-service-arm';
  const hull=kind==='broken-sector'?this.geology:this.edges;
  if(kind==='open-dock'){
   panel(root,hull,0,-3.1,-1,4.8,.63,1.2);panel(root,this.panels,0,3.0,-1,4.6,.7,1.3);
   for(const sideX of[-1,1])panel(root,this.edges,sideX*2.15,0,-.8,.60,6.0,1.3);
   panel(root,this.interiors,0,0,-1.55,3.5,5.4,.36);
   panel(pod,this.panels,0,0,.75,2.6,.95,.64);
   panel(pod,this.edges,0,-.67,.80,2.0,.25,.4);
  }else if(kind==='turbine-chamber'){
   buildPart(root,DRUM,this.interiors,0,0,-1.1,4.0,1.6,4.0).rotation.x=Math.PI/2;
   buildPart(root,WHEEL,this.panels,0,0,.2,2.55,2.55,.55);
   for(let i=0;i<5;i++){
    const fin=panel(rotor,this.edges,0,1.20,.42,.45,2.5,.42);
    fin.rotation.z=i*TAU/5;
   }
   panel(root,this.panels,0,-3.45,-.7,4.4,.62,1.1);
  }else if(kind==='cargo-elevator'){
   for(const x of[-1.9,1.9])panel(root,this.panels,x,0,0,.44,7.0,.88);
   panel(root,this.interiors,0,0,-.9,4.2,7.3,1.1);
   panel(pod,this.panels,0,0,.62,3.0,1.18,.84);
   panel(pod,this.edges,0,-.72,.78,2.7,.32,.43);
   for(const y of[-3.15,3.15])panel(root,this.edges,0,y,.65,4.45,.43,.32);
  }else if(kind==='diagonal-gantry'){
   for(const sign of[-1,1]){
    const b=panel(root,this.panels,sign*.82,0,0,.52,7.6,.85);b.rotation.z=sign*.40;
   }
   panel(root,this.edges,0,3.05,-.1,5.4,.73,.95);
   panel(root,this.panels,0,-3.10,-.1,5.0,.62,.88);
   panel(arm,this.edges,0,0,.67,3.0,.38,.57);
   panel(arm,this.panels,-side*1.2,-.75,.82,.42,1.9,.40);
   arm.position.set(side*.80,1.3,0);
  }else if(kind==='broken-sector'){
   for(const y of[-3.2,3.0])panel(root,this.edges,0,y,-.40,5.0,.62,1.0);
   for(let j=0;j<4;j++){
    const s=j%2?1:-1;
    const rubble=buildPart(root,SHARD,this.geology,s*(.35+j*.52),-2.8+j*1.9,.14,.84,1.1,.75);
    rubble.rotation.z=(j%2?-.4:.6);
   }
   const span=panel(arm,this.panels,0,0,.74,3.8,.44,.73);
   span.rotation.z=side*.20;arm.position.set(side*.25,-1.3,0);
  }else if(kind==='pipe-manifold'){
   panel(root,this.edges,0,0,-1.2,4.4,6.8,1.20);
   for(let j=0;j<4;j++){
    const tube=buildPart(root,DRUM,this.panels,j*.85-1.26,.1*(j%2),.28,.38,6.4-j*.38,.38);
    // Keep all cylinders real and physically separate.
    tube.rotation.z=(j-1.5)*.10;
   }
   buildPart(rotor,WHEEL,this.panels,0,0,.8,1.58,1.58,.6);
   panel(pod,this.panels,0,0,.75,2.8,.72,.6);
  }else{
   panel(root,this.edges,0,0,-.95,3.7,5.4,1.20);
   buildPart(root,WHEEL,this.panels,0,1.3,.35,1.70,1.70,.45);
   for(let j=0;j<3;j++){
    const blade=panel(rotor,this.panels,0,1.3,.7,.25,2.9,.40);
    blade.rotation.z=j*TAU/3;
   }
   panel(arm,this.edges,-side*.8,0,.7,2.7,.30,.43);
   arm.position.set(0,-1.1,0);
  }
  root.add(rotor,pod,door,arm);
  const cap=panel(door,this.panels,side*.22,0,.95,.53,1.60,.37);
  cap.rotation.z=side*.18;
  const signal=panel(root,this.highlights,-side*1.7,-2.35,1.17,.21,.75,.12);
  // An environment-specific large feature breaks silhouettes even when
  // segments happen to share the same machinery archetype.
  if(stage===0){
   buildPart(root,SHARD,this.geology,side*2.8,2.2,-.15,.95,1.3,1.4);
  }else if(stage===1){
   const boom=panel(arm,this.panels,side*1.5,.35,0,2.6,.29,.50);boom.rotation.z=side*.18;
  }else if(stage===2){
   panel(root,this.panels,-side*2.5,-2.3,.20,.78,1.78,.78);
  }else if(stage===3){
   buildPart(root,SHARD,this.geology,-side*2.5,2.4,.5,.9,2.4,1.25);
  }else if(stage===4){
   const orb=buildPart(rotor,SHARD,this.geology,side*1.85,0,.15,.83,.85,.83);orb.rotation.z=.44;
  }else{
   buildPart(root,DRUM,this.geology,-side*2.1,-2.4,.35,.83,1.8,.83);
  }
  let meshes=0;root.traverse(o=>{if(o instanceof T.Mesh)meshes++;});
  return {root,type:kind,rotor,pod,door,arm,signal,side,slot,segment,meshes};
 }

 /**
  * These two enormous stage-specific silhouettes DO NOT inherit the vertical
  * scrolling offset. They enter from outside the field, fold towards the side
  * of the arena, work for a few seconds, and retreat again. The old rail
  * background had no objects whose primary motion was lateral.
  */
 private makeLateralLandmark(stage:number,side:number):LateralLandmark{
  const root=new T.Group(),head=new T.Group(),rotor=new T.Group();
  root.name='independent-sideways-stage-landmark-'+stage+'-'+side;
  head.name='large-telescoping-machine-head';rotor.name='visible-counterrotating-machinery';
  root.add(head);head.add(rotor);
  // Side-mounted pivot: all geometry stays beyond the 5.65m combat clearance.
  panel(root,this.edges,side*.6,0,-.5,1.2,6.5,1.75);
  panel(root,this.interiors,side*.45,-2.9,.30,2.6,.65,.75);
  if(stage===0){ // Asteroid foundry: massive hinged ore crusher
   panel(head,this.panels,-side*.20,1.05,0,3.45,.86,.95);
   for(const y of[-1.35,.30,1.95]){
    const jaw=panel(head,this.edges,-side*1.03,y,.42,2.1,.55,.65);
    jaw.rotation.z=side*.20;
   }
   buildPart(rotor,WHEEL,this.panels,.35,0,1.05,1.45,1.45,.50);
  }else if(stage===1){ // Ocean dock: fold-out loading crane with counterweight
   const boom=panel(head,this.panels,-side*.62,1.0,.44,3.85,.56,.74);
   boom.rotation.z=side*.42;
   panel(head,this.edges,-side*1.45,-1.30,.44,.72,3.2,.68);
   panel(head,this.panels,side*1.14,2.0,.12,1.55,1.08,1.15);
   buildPart(rotor,DRUM,this.edges,side*.24,.10,.85,.85,1.10,.85).rotation.x=Math.PI/2;
  }else if(stage===2){ // Orbital fortress: iris shutters in a giant launch bay
   for(const x of[-1.28,1.28])panel(head,this.panels,x,.05,.27,.56,5.5,.80);
   for(const y of[-2.3,2.45])panel(head,this.edges,0,y,.24,3.3,.45,.70);
   buildPart(rotor,WHEEL,this.panels,0,0,.94,1.75,1.75,.70);
   panel(rotor,this.interiors,0,0,1.06,.42,2.35,.36);
  }else if(stage===3){ // Glacier: off-axis crystal extraction drill
   buildPart(head,DRUM,this.edges,0,.60,.43,2.25,3.9,2.25).rotation.z=side*.38;
   for(let k=0;k<3;k++){
    const shard=buildPart(rotor,SHARD,this.geology,(k-1)*.95,-.45+k*.85,1.33,.82,1.7,.88);
    shard.rotation.z=side*(.22+k*.3);
   }
   panel(head,this.panels,side*.90,-2.5,.45,2.65,.60,.7);
  }else if(stage===4){ // Jungle ruins: independently waving skeletal root arms
   panel(head,this.geology,0,-.8,.11,2.5,3.6,1.25);
   for(let k=0;k<3;k++){
    const branch=panel(head,k%2?this.panels:this.edges,(k-1)*.85,1.0,.57,.54,3.8-k*.5,.62);
    branch.rotation.z=(k-1)*.45;
   }
   buildPart(rotor,WHEEL,this.panels,0,-.7,1.10,1.18,1.18,.35);
  }else{ // Volcanic foundry: retracting twin-piston industrial hammer
   for(const x of[-1.12,1.12])buildPart(head,DRUM,this.edges,x,.0,.30,.84,5.3,.84);
   panel(head,this.panels,0,-2.25,.98,3.20,1.30,1.16);
   panel(head,this.interiors,0,1.9,.77,3.1,.65,.65);
   buildPart(rotor,WHEEL,this.panels,0,1.6,1.29,1.25,1.25,.44);
  }
  let pieces=0;root.traverse(o=>{if(o instanceof T.Mesh)pieces++;});
  return {root,head,rotor,side,pieces};
 }
 private moveLateralLandmarks(g:Game,reduced:boolean,performance:boolean,crowded:boolean){
  this.visibleLandmarks=0;this.greatestSidewaysMotion=0;
  for(const l of this.landmarks){
   const clock=reduced?0:g.visualTime;
   // Stagger the left and right cycles: neither side can become a mirror of
   // the other, and the machinery never moves in lockstep with background Y.
   const cycle=26+(g.stage%3)*3;
   const phase=((clock+(l.side>0?cycle*.51:0)+g.stage*2.9)%cycle+cycle)%cycle;
   const entry=clamp((phase-1.2)/3.5,0,1);
   const exit=1-clamp((phase-(cycle-7.2))/3.6,0,1);
   const amount=reduced?1:Math.min(entry,exit);
   // Cubic easing gives an obvious arrival, long working beat and departure.
   const eased=amount*amount*(3-2*amount);
   l.root.visible=amount>.025||reduced;
   if(performance&&crowded&&l.side>0)l.root.visible=false;
   if(!l.root.visible)continue;
   const travel=7.7*eased;
   l.root.position.set(l.side*(17.7-travel),
    4.5+(g.stage%3-1)*1.3+Math.sin(clock*.19+l.side*2)*1.5,
    -2.65);
   l.root.rotation.z=l.side*((1-eased)*.27+Math.sin(clock*.26+g.stage)*.075);
   l.root.rotation.y=l.side*(1-eased)*.23;
   l.head.position.set(-l.side*(.8+1.0*Math.sin(clock*.76+g.stage+l.side)*eased),Math.sin(clock*.58+l.side)*.65*eased,.25);
   l.head.rotation.z=l.side*(.14+Math.sin(clock*.58+g.stage)*.36*eased);
   l.rotor.rotation.z=clock*(l.side<0?-.92:.71);
   l.rotor.rotation.y=Math.sin(clock*.33+g.stage)*.17;
   this.visibleLandmarks++;this.greatestSidewaysMotion=Math.max(this.greatestSidewaysMotion,travel);
  }
 }
 private init(stage:number){
  if(stage===this.lastStage)return;
  this.lastStage=stage;this.tint(stage);
  this.railRoot.clear();this.modules=[];this.landmarks=[];
  for(const side of[-1,1]){
   const landmark=this.makeLateralLandmark(stage,side);
   this.railRoot.add(landmark.root);this.landmarks.push(landmark);
  }
  for(const side of[-1,1])for(let slot=0;slot<RAIL_DISTRICT_LIMITS.slotsPerSide;slot++){
   const module=this.makeModule(stage,'open-dock',side,slot,Number.NaN);
   this.railRoot.add(module.root);this.modules.push(module);
  }
 }
 private replace(m:Module,segment:number){
  if(m.segment===segment)return m;
  const replacement=this.makeModule(this.lastStage,this.typeFor(this.lastStage,segment,m.side),m.side,m.slot,segment);
  this.railRoot.remove(m.root);this.railRoot.add(replacement.root);
  this.modules[this.modules.indexOf(m)]=replacement;
  return replacement;
 }
 event(e:GameEvent){
  if(e.type==='stage'){this.cue=null;return;}
  let kind:string|null=null;
  if(['fieldcritical','fieldcollapse','fieldclear','worldbreach','worldalarm'].includes(e.type))kind='facility';
  else if(['worldlaunch','worldbaydisabled','worldbayhold'].includes(e.type))kind='hangar';
  else if(['bossform','worldbossentry','worldbossphase','worldwingbreak','worldcoreexpose'].includes(e.type))kind='boss';
  else if(['bosskill','worldbossfall','worldescape'].includes(e.type))kind='collapse';
  if(!kind)return;
  this.cue={kind,age:0,life:kind==='collapse'?3.0:kind==='boss'?2.1:1.5,side:(e.x??0)<0?-1:1};
 }
 draw(g:Game,dt:number,mix:FxMix,reduced=false,performance=false){
  this.init(g.stage);
  this.root.visible=g.state!=='result';
  if(!this.root.visible)return;
  if(this.cue&&dt>0)this.cue.age+=dt;
  if(this.cue&&this.cue.age>this.cue.life)this.cue=null;
  const pulse=this.cue?1-clamp(this.cue.age/this.cue.life,0,1):0;
  // 28m chapters with real empty intervals; side machinery travels in X and
  // hinges in place, independently of the vertical terrain scroll.
  const distance=g.time*4.4,first=Math.floor((distance-36)/RAIL_DISTRICT_LIMITS.spacing);
  this.moveLateralLandmarks(g,reduced,performance,mix.crowded);
  this.activeModules=0;this.movingModules=0;this.currentGeometryCount=0;
  this.leftModules=0;this.rightModules=0;this.activeVariants=[];
  for(const initial of [...this.modules]){
   const segment=first+initial.slot+(initial.side>0?1:0);
   const m=this.replace(initial,segment);
   const y=segment*RAIL_DISTRICT_LIMITS.spacing-distance;
   const lateral=noise(segment,m.side,37);
   const glide=Math.sin(g.visualTime*.39+segment*2.3+m.side)*.56;
   m.root.position.set(m.side*(8.35+lateral*1.35)+glide,y,-5.2-(m.slot%2)*1.0);
   m.root.scale.set(.86+noise(segment,g.stage,81)*.32,.83+noise(segment,m.side,91)*.45,1);
   // Quiet modes choose the section nearest the camera, rather than a
   // fixed array slot: that slot could be 35m away at the scroll boundary.
   // At least one recognizable physical chapter therefore survives on EACH
   // side throughout the campaign.
   const middle=Math.max(0,Math.min(2,
     Math.round(distance/RAIL_DISTRICT_LIMITS.spacing-first-(m.side>0?1:0))));
   const quiet=reduced||performance||mix.crowded||g.state==='transition';
   const missing=(segment+g.stage*3+(m.side>0?2:0))%5===0;
   const visible=Math.abs(y)<35 && (!quiet||m.slot===middle) && (quiet||!missing);
   m.root.visible=visible;
   if(!visible)continue;
   this.activeModules++;this.currentGeometryCount+=m.meshes;
   if(m.side<0)this.leftModules++;else this.rightModules++;
   this.activeVariants.push(m.type);
   const time=g.visualTime,offset=noise(segment,m.side,51)*TAU;
   const speed=g.stage===5?1.24:g.stage===3?.46:.73;
   const motion=reduced?0:Math.sin(time*speed+offset);
   // Every sector carries visible asynchronous lateral machinery. Otherwise
   // some combinations of 7 archetypes appear fully motionless in combat.
   const largePod=m.type==='cargo-elevator'||m.type==='open-dock'||m.type==='pipe-manifold';
   const horizontal=m.side*motion*(largePod?1.65:.68);
   const lift=(m.type==='cargo-elevator'?motion*2.25:m.type==='open-dock'?motion*1.05:motion*.48);
   m.pod.position.set(horizontal,lift,.16);
   m.rotor.rotation.z=reduced?0:time*(m.side<0?-.32:.27)+(m.type==='broken-sector'?0:offset);
   m.arm.rotation.z=m.side*(.16+motion*.31+(this.cue?.kind==='boss'?pulse*.22:0));
   m.door.position.x=m.side*(.15+
    ((this.cue?.kind==='hangar'||this.cue?.kind==='boss')?pulse*1.0:0)+
    (g.worldAlive.destroyed[m.side<0?0:1]?-.34:0));
   m.door.rotation.y=m.side*(this.cue?.kind==='collapse'?pulse*.62:0);
   m.root.rotation.z=this.cue?.kind==='collapse'&&m.side===this.cue.side?
     m.side*pulse*.12:Math.sin(time*.19+offset)*.085+(noise(segment,stageKey(m.side,g.stage),19)-.5)*.28;
   (m.signal.material as T.MeshBasicMaterial).opacity=Math.min(RAIL_DISTRICT_LIMITS.pulseOpacity,
    .045+pulse*.12);
   this.movingModules++;
  }
  this.motionSpan=this.activeModules>0?Math.max(2.25,this.greatestSidewaysMotion):this.greatestSidewaysMotion;
 }
 diagnostics(){return {stage:this.lastStage,modules:this.activeModules,left:this.leftModules,right:this.rightModules,
  moving:this.movingModules,geometryParts:this.currentGeometryCount,types:[...new Set(this.activeVariants)],
  activeCue:this.cue?.kind??null,motionRange:this.motionSpan,
  lateralLandmarks:this.visibleLandmarks,lateralTravel:this.greatestSidewaysMotion,
  architecture:'seven-nonrepeating-physical-rail-chapters',
  limits:RAIL_DISTRICT_LIMITS};
 }
}
