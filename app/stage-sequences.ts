import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {distanceReveal,easeReveal} from './scenery-transitions.ts';
import {worldClock} from './motion.ts';

/** Three ONE-TIME encounters for each campaign world, not modulo-animated props.
 * A separate physical choreography accompanies the actual backgrounds.
 * All geometry is behind the bullet plane, never creates hitboxes or lights.
 */
export const STAGE_SEQUENCE_IDS=[
 ['ORE FRACTURE','HARVESTER DESCENT','DEBRIS GATE BREAK'],
 ['BREAKWATER SURGE','SONAR SEARCH','SUBMARINE RISE'],
 ['IRIS LOCKDOWN','ELEVATOR OVERRIDE','BASTION OPENING'],
 ['ICE FAULT','PRISM AVALANCHE','BOREALIS STATION'],
 ['ROOT DESCENT','TEMPLE AWAKENING','GARDEN OVERGROWTH'],
 ['MOLTEN FAULT','HAMMER IMPACT','CRUCIBLE TILT']
] as const;
const timing=[.13,.43,.72] as const;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
type Chapter={root:T.Group; moving:T.Group;secondary:T.Group;materials:T.Material[];id:string;act:number;};
const add=(g:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;
};
const gem=(g:T.Group,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,seed=0)=>{
 const mesh=new T.Mesh(new T.IcosahedronGeometry(1,0),m);
 mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=seed*.36;g.add(mesh);return mesh;
};
const cylinder=(g:T.Group,m:T.Material,x:number,y:number,z:number,r:number,h:number,segments=12)=>{
 const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),m);
 mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return mesh;
};
const rootTree=(g:T.Group,m:T.Material,x:number,y:number,z:number,length:number,angle:number)=>{
 const mesh=new T.Mesh(new T.CylinderGeometry(.22,.69,length,7),m);
 mesh.position.set(x,y,z);mesh.rotation.z=angle;g.add(mesh);return mesh;
};
const across=(g:T.Group,m:T.Material,x:number,y:number,z:number,s:number)=>{
 const beam=add(g,m,x,y,z,.55,s,.42);beam.rotation.z=s*.07;return beam;
};

function construct(stage:number,act:number):Chapter{
 const root=new T.Group(),still=new T.Group(),moving=new T.Group(),secondary=new T.Group();
 root.name='one-time-stage-episode-'+stage+'-'+act;
 moving.name='episode-moving-part';secondary.name='episode-secondary-part';
 root.add(still,moving,secondary);
 const shades=[
  [0x3d455c,0x77869b,0x82697d,0x4f5368],
  [0x2c5362,0x668c9b,0x477d86,0x2d4659],
  [0x28394f,0x69849d,0x507da3,0x24334a],
  [0x4b6a7c,0x93afbe,0x628ea5,0x587688],
  [0x344b3c,0x668768,0x6d8977,0x26382e],
  [0x4c3430,0x906046,0x91563b,0x352a2b]
 ][stage];
 const materials=[
  new T.MeshStandardMaterial({color:shades[0],metalness:.14,roughness:.86,transparent:true,depthWrite:false}),
  new T.MeshStandardMaterial({color:shades[1],metalness:.26,roughness:.76,transparent:true,depthWrite:false}),
  new T.MeshStandardMaterial({color:shades[2],metalness:.11,roughness:.83,transparent:true,depthWrite:false}),
  new T.MeshBasicMaterial({color:shades[3],transparent:true,opacity:.6,depthWrite:false,toneMapped:true})
 ];
 const [dark,plate,accent,glimmer]=materials;
 const lateral=[-2.6,2.8,.5][act];
 if(stage===0){ // A fractured asteroid passage, a hydraulic collector, a torn exit gate.
  for(let k=0;k<9+(act===2?5:0);k++){
   const ang=k*2.399,r=.7+Math.sqrt(k)*1.65;
   gem(still,k%3===0?plate:dark,lateral+Math.cos(ang)*r,Math.sin(ang)*r,-8.0+(k%3)*.5,
    1.0+(k%4)*.26,1.5+(k%3)*.35,1.6,k+act*5);
  }
  if(act===0){
   for(let k=0;k<6;k++){
    const a=k*Math.PI/3,rock=gem(moving,accent,Math.cos(a)*2.4,Math.sin(a)*2.4,-5.8,.55,1.15,.65,k);
    rock.rotation.y=a*.13;
   }
  }else if(act===1){
   for(let k=0;k<5;k++){
    const arm=add(moving,k%2?plate:dark,lateral+(k-2)*1.1,-.6,-5.6,.44,6.0,.65);
    arm.rotation.z=(k-2)*.17;
   }
   gem(secondary,accent,lateral,-2,-4.8,1.8,2.2,1.1,1);
  }else{
   for(let k=0;k<8;k++){
    const a=k*Math.PI/4;
    const strut=across(moving,plate,lateral+Math.cos(a)*4,Math.sin(a)*4,-5.6,3.2);
    strut.rotation.z=a;
   }
   gem(secondary,accent,lateral,0,-4.7,2.4,2.1,1.5);
  }
 }else if(stage===1){ // Cresting water / sonar sweep / asymmetric submarine.
  if(act===0){
   for(let k=0;k<11;k++){
    const x=-7+k*1.5;
    const slab=add(still,k%3?dark:plate,x,-3+Math.sin(k*.9)*1.5,-8,1.4,5.0+(k%3)*.9,.85);
    slab.rotation.z=(k-5)*.07;
   }
   add(moving,accent,0,1.5,-6.1,13,.52,.50);
   for(let k=0;k<5;k++)gem(secondary,plate,-5+k*2.5,3,-6.4,.4,.5,.4,k);
  }else if(act===1){
   cylinder(still,dark,0,0,-7.5,4.6,.9);
   const dish=cylinder(moving,plate,0,0,-5.7,3.4,.23);dish.scale.y=.65;
   add(moving,glimmer,0,0,-5.2,.20,7.1,.12);
   for(let k=0;k<3;k++)add(still,dark,-4.4+k*4,0,-6.8,.5,8.8,.9);
  }else{
   const hull=gem(still,dark,0,0,-7,6.5,2.3,2.0);hull.rotation.z=.12;
   const tower=add(moving,plate,1.9,2.5,-5.1,2.7,4.0,1.2);tower.rotation.z=.15;
   for(let k=0;k<4;k++){const vane=add(secondary,accent,-4.5+k*2.8,-1.2,-5.0,.55,1.4,.40);vane.rotation.z=k*.2;}
  }
 }else if(stage===2){ // Six-segment blast iris, gravity lift, disintegrating shield.
  for(let k=0;k<6;k++){
   const a=k*Math.PI/3;
   const shield=add(still,k%2?dark:plate,Math.cos(a)*5.0,Math.sin(a)*5.0,-8.1,2.2,4.0,1.8);
   shield.rotation.z=a;
  }
  if(act===0){
   for(let k=0;k<6;k++){
    const a=k*Math.PI/3;
    const vane=add(moving,plate,Math.cos(a)*1.5,Math.sin(a)*1.5,-6.0,1.8,4.0,.55);
    vane.rotation.z=a;
   }
   cylinder(secondary,accent,0,0,-5.5,1.15,.25);
  }else if(act===1){
   for(let k=0;k<4;k++)add(still,dark,(k-1.5)*3,-.4,-6.2,.85,11,1.0);
   add(moving,plate,0,-3,-5.0,8,2.0,1.0);
   add(secondary,glimmer,0,-4,-4.8,7.2,.18,.1);
  }else{
   for(let k=0;k<7;k++){
    const a=k*2.43,r=1+Math.sqrt(k)*1.8;
    gem(moving,k%2?plate:accent,Math.cos(a)*r,Math.sin(a)*r,-5.7,.65,2.1,.5,k);
   }
   cylinder(secondary,accent,0,0,-5.1,2.4,.18);
  }
 }else if(stage===3){ // An ice sheet shears, then an avalanche, then blue boreal station.
  for(let k=0;k<8;k++){
   const a=k*2.47,r=1+Math.sqrt(k)*1.5;
   const m=gem(still,k%3?dark:plate,Math.cos(a)*r,Math.sin(a)*r,-8.4,.95,2.4+(k%4)*.5,1.0,k);
   m.rotation.y=(k-3)*.19;
  }
  if(act===0){
   for(let k=0;k<5;k++)gem(moving,plate,-4+k*2,1,-5.9,.6,3.2,.7,k);
  }else if(act===1){
   for(let k=0;k<11;k++)gem(moving,k%3?plate:accent,Math.sin(k*2.8)*4.0,(k%5-2)*1.6,-5.6,.55,1.3+(k%3),.75,k);
   gem(secondary,glimmer,0,0,-6.4,1.9,3.8,.40);
  }else{
   add(still,dark,1.0,0,-6.2,5,9,2);
   for(let k=0;k<5;k++)cylinder(moving,plate,-2.4+k*1.25,-.7,-5.2,.34,.55);
   for(const s of[-1,1])rootTree(secondary,accent,s*3.0,0,-5.6,7,s*.45);
  }
 }else if(stage===4){ // Entangled roots bloom and a sanctuary altar awakens.
  for(let k=0;k<8;k++){
   const a=(k-3.5)*.29;
   rootTree(still,k%3?dark:plate,Math.sin(a)*5.3,(k%2?1:-1)*2.7,-7.1,7+(k%3),a);
   gem(still,accent,Math.sin(a)*6.5,3.5+(k%3),-6.0,1.4,1.0,.7,k);
  }
  if(act===0){
   for(let k=0;k<5;k++)rootTree(moving,accent,(k-2)*2.1,-1.4,-5.5,7.5,(k-2)*.16);
  }else if(act===1){
   cylinder(still,dark,0,0,-6.7,4.4,.9);
   for(let k=0;k<8;k++){const a=k*Math.PI/4;
    const leaf=gem(moving,k%2?accent:plate,Math.cos(a)*3.0,Math.sin(a)*3.0,-5.3,1.0,1.7,.7,k);
    leaf.rotation.z=a;
   }
   gem(secondary,plate,0,0,-4.8,1.3,1.9,.9);
  }else{
   for(let k=0;k<10;k++){
    const a=k*2.399,r=.7+Math.sqrt(k)*1.5;
    gem(moving,k%2?accent:plate,Math.cos(a)*r,Math.sin(a)*r,-5.4,1.1,1.1,.85,k);
   }
   rootTree(secondary,plate,0,0,-5.6,10,.23);
  }
 }else{ // Magma breach, hammer press, tilted glowing crucible.
  for(let k=0;k<7;k++){
   const a=k*2.39,r=1+Math.sqrt(k)*2.0;
   gem(still,k%2?dark:plate,Math.cos(a)*r,Math.sin(a)*r,-7.7,1.1,1.4,1.5,k);
  }
  if(act===0){
   for(let k=0;k<7;k++)gem(moving,accent,-4+k*1.3,(k%3-1)*1.9,-5.7,.58,1.15,.50,k);
   cylinder(secondary,dark,0,0,-6.1,3.5,1.0);
  }else if(act===1){
   add(still,dark,0,5,-6.3,9,1.0,1.5);
   for(let k=0;k<4;k++){
    cylinder(moving,plate,-3+k*2,0,-5.2,.54,6.1);
    add(moving,accent,-3+k*2,-2.6,-4.9,1.3,1.0,.72);
   }
   add(secondary,glimmer,0,-3.5,-4.7,6,.22,.20);
  }else{
   cylinder(still,dark,0,-.7,-6.6,5.0,1.2);
   cylinder(still,accent,0,-.7,-5.9,3.8,.2);
   const vessel=gem(moving,plate,0,1.5,-5,3.6,3.4,1.8);vessel.rotation.x=.3;
   for(let k=0;k<6;k++)gem(secondary,accent,(k-3)*.9,-2.7+(k%3)*1.2,-4.8,.45,.7,.4,k);
  }
 }
 return {root,moving,secondary,materials,id:STAGE_SEQUENCE_IDS[stage][act],act};
}

export class StageSequences3D{
 readonly root=new T.Group();
 private chapters:Chapter[]=[];
 private stage=-1;
 private activeIds:string[]=[];
 constructor(){this.root.name='stage-authored-nonrepeating-cinematics';}
 private setStage(stage:number){
  if(this.stage===stage)return;
  this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  for(const c of this.chapters)for(const mat of c.materials)mat.dispose();
  this.root.clear();this.chapters=[];
  this.stage=stage;
  for(let act=0;act<3;act++){
   const chapter=construct(stage,act);
   chapter.root.visible=false;
   this.root.add(chapter.root);
   this.chapters.push(chapter);
  }
 }
 draw(g:Game,dt:number,reduced=false,performance=false){
  this.setStage(g.stage);
  this.root.visible=g.mode==='campaign'&&g.state!=='result';
  if(!this.root.visible)return;
  const duration=STAGES[g.stage].duration,clock=worldClock(g);
  this.activeIds=[];
  for(const c of this.chapters){
   const beat=duration*timing[c.act],elapsed=clock-beat;
   // One slow physical pass per event. No wrap(), %, teleports, or RNG.
   const y=52-elapsed*6.0;
   const opacity=distanceReveal(y,23,57);
   c.root.visible=opacity>.002&&!reduced;
   if(!c.root.visible)continue;
   this.activeIds.push(c.id);
   const t=Math.max(0,elapsed),gesture=easeReveal(clamp(t/8));
   c.root.position.set([-.9,1.5,-.6][c.act],y,-.4);
   c.root.rotation.set(0,0,Math.sin(t*.09+g.stage)*.025);
   c.root.scale.setScalar((performance?.84:1)*(.82+.18*gesture));
   for(const mat of c.materials){
    mat.opacity=(mat instanceof T.MeshBasicMaterial ? .60 : 1)*opacity*.80;
   }
   c.moving.rotation.set(0,0,0);
   c.moving.position.set(0,0,0);c.secondary.position.set(0,0,0);
   c.secondary.rotation.set(0,0,0);
   switch(g.stage){
    case 0: // The ore splits violently then drifts off in opposite directions.
     c.moving.rotation.z=t*(c.act===2?.19:.06);
     c.moving.scale.setScalar(.7+.3*gesture);
     c.secondary.position.x=Math.sin(t*.28)*2.4;break;
    case 1: // Storm surge, sonar rotation and one submarine ascent.
     c.moving.position.y=(c.act===2?1:-1)*Math.sin(t*.30)*1.6;
     c.moving.rotation.z=c.act===1?Math.sin(t*.24)*.8:Math.sin(t*.13)*.07;
     c.secondary.rotation.z=t*.12;break;
    case 2: // Blast iris rotates, lift travels, shield sections split.
     c.moving.rotation.z=c.act===0?gesture*.65:Math.sin(t*.27)*.3;
     c.moving.position.y=c.act===1?Math.sin(t*.42)*3:0;
     c.secondary.scale.setScalar(.7+gesture*.30);break;
    case 3: // Ice avalanche drops and individual prisms sway.
     c.moving.position.y=-Math.min(4,t*.33);
     c.moving.rotation.y=Math.sin(t*.28)*.20;
     c.secondary.rotation.z=Math.sin(t*.38)*.09;break;
    case 4: // Forest roots uncurl, altar slowly rotates, giant crown blooms.
     c.moving.rotation.z=Math.sin(t*.18)*.32;
     c.moving.scale.setScalar(.63+gesture*.37);
     c.secondary.rotation.y=t*.15;break;
    case 5: // Forge presses hammer, magma rises, crucible tips.
     c.moving.position.y=c.act===1?Math.sin(t*1.1)*2.2:Math.sin(t*.4)*.8;
     c.moving.rotation.z=c.act===2?Math.sin(t*.26)*.42:0;
     c.secondary.position.y=Math.sin(t*.7)*.75;break;
   }
  }
 }
 diagnostics(){return {stage:this.stage,activeEpisodes:this.activeIds,availableIds:STAGE_SEQUENCE_IDS[this.stage],stageSpecific:true,loops:0};}
}
