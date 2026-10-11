import * as T from 'three/webgpu';
import {block,hull,ball,batch} from './art.ts';
import type {EnvironmentPalette} from './environment-art.ts';
import {STAGES} from './stages.ts';
import {WORLD_REBUILD_STAGES} from './world-rebuild-spec.ts';

/**
 * Six physical centrepiece structures. They are placed beneath the flight plane,
 * share the camera/light/material palette with terrain and strategic installations,
 * and are CPU rasterized from the SAME geometry on Canvas-only devices.
 * No full-screen matte paintings or perpendicular billboard sheets.
 */

const cy=(g:T.Group,r:number,z:number,mat:T.Material,x=0,y=0,h=.35,segments=14)=>{
 const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat);
 m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;
};
const ring=(g:T.Group,r:number,z:number,mat:T.Material,x=0,y=0)=>{
 const m=new T.Mesh(new T.TorusGeometry(r,.14,6,28),mat);
 m.position.set(x,y,z);g.add(m);return m;
};
const slab=(g:T.Group,mat:T.Material,x:number,y:number,z:number,w:number,h:number,depth=.42)=>{
 const chamfer=Math.min(.42,w*.18,h*.18);
 return hull(g,[[x-w/2+chamfer,y-h/2],[x+w/2-chamfer,y-h/2],[x+w/2,y-h/2+chamfer],[x+w/2,y+h/2-chamfer],[x+w/2-chamfer,y+h/2],[x-w/2+chamfer,y+h/2],[x-w/2,y+h/2-chamfer],[x-w/2,y-h/2+chamfer]],depth,mat,z);
};
const ribs=(g:T.Group,p:EnvironmentPalette,x:number,y:number,len:number,count=7,step=.36)=>{
 for(let i=0;i<count;i++){
  const dx=(i-(count-1)/2)*step;
  block(g,i%3===0?p.plate:p.steel,x+dx,y,-2.6,.09,len,.15);
  block(g,p.dark,x+dx,y,-2.38,.045,len*.81,.055);
 }
};
const uplight=(g:T.Group,mat:T.Material,x:number,y:number,z:number)=>ball(g,mat,x,y,z,.11,.20,.10);
function scaffold(g:T.Group,p:EnvironmentPalette,x:number,y:number,w:number,h:number){
 slab(g,p.dark,x,y,-5.28,w,h,.72);
 slab(g,p.steel,x,y,-4.56,w*.93,h*.91,.43);
 slab(g,p.plate,x,y,-4.15,w*.88,h*.83,.17);
 for(const s of[-1,1]){
  block(g,p.steel,x+s*w*.39,y,-3.84,.22,h*.64,.25);
  for(let t=-2;t<=2;t++)uplight(g,p.lamp,x+s*w*.39,y+t*h*.11,-3.68);
 }
}
// Non-rectangular foundations replace the repeated double-layer scaffold.
// Silhouettes are authored for each biome; there is no global floor or rail.
function oreCrust(g:T.Group,p:EnvironmentPalette,x:number,y:number,scale=1){
 for(let k=0;k<7;k++){
  const a=k*2.399,r=(1.4+Math.sqrt(k)*1.65)*scale;
  const b=new T.Mesh(new T.IcosahedronGeometry(.8+(k%3)*.27,k%4?0:1),k%3?p.rock:p.steel);
  b.position.set(x+Math.cos(a)*r,y+Math.sin(a)*r,-6.6+(k%3)*.4);
  b.scale.set(1.3,1.6+(k%3)*.5,1.35);
  b.rotation.set(a*.2,k*.25,a);g.add(b);
 }
}
function glacierShelf(g:T.Group,p:EnvironmentPalette,x:number,y:number,w:number){
 hull(g,[[x-w*.55,y-5.4],[x-w*.38,y+2.7],[x-w*.2,y+5.8],[x+w*.18,y+5],[x+w*.55,y-3.9]],1.5,p.rock,-7.3);
 for(let k=0;k<6;k++){
  const crystal=new T.Mesh(new T.OctahedronGeometry(.9+(k%3)*.22,0),k%3===0?p.snow:p.ice);
  crystal.position.set(x+(k-2.5)*w*.155,y-3.5+(k%3)*3.4,-4.8+(k%2)*.5);
  crystal.scale.set(.7,1.3+(k%4)*.5,1.0);crystal.rotation.z=(k-2.5)*.15;g.add(crystal);
 }
}
function ancientRoot(g:T.Group,p:EnvironmentPalette,x:number,y:number,length:number){
 for(let k=0;k<6;k++){
  const a=(k-2.5)*.41;
  const m=new T.Mesh(new T.CylinderGeometry(.12,.47,length*(.62+(k%3)*.13),7),p.moss);
  m.position.set(x+Math.sin(a)*1.4,y+(k%2?1:-1)*1.2,-5.8+(k%3)*.5);
  m.rotation.z=a;g.add(m);
  const leaf=new T.Mesh(new T.IcosahedronGeometry(.95+(k%2)*.45,0),p.foliage);
  leaf.position.set(x+Math.sin(a)*2.6,y+length*.3*(k%2?1:-1),-4.4);
  leaf.scale.set(1.4,1.0,.70);g.add(leaf);
 }
}
function foundryChamber(g:T.Group,p:EnvironmentPalette,x:number,y:number,size:number){
 hull(g,[[x-size*.5,y-size*.35],[x-size*.37,y+size*.41],[x-size*.10,y+size*.55],[x+size*.46,y+size*.20],[x+size*.53,y-size*.30]],1.9,p.rock,-6.7);
 cy(g,size*.30,-4.65,p.dark,x,y,.55);
 cy(g,size*.22,-4.18,p.lava,x,y,.10);
 for(let k=0;k<4;k++){
  const a=k*Math.PI/2+.2;
  const b=block(g,k%2?p.rust:p.steel,x+Math.cos(a)*size*.38,y+Math.sin(a)*size*.38,-4.30,.6,2.3,.85);
  b.rotation.z=a;
 }
}
const TAU=Math.PI*2;
export const HERO_MOTION_IDS=['ore-grabber','tidal-floodgates','iris-citadel','prism-resonance','root-altar','forge-press'] as const;

function gantry(g:T.Group,p:EnvironmentPalette,x:number,y:number,w:number,h:number,depth=-3.4){
 block(g,p.dark,x,y,depth,w,h,.24);
 block(g,p.steel,x,y,depth+.20,w*.95,h*.66,.13);
 ribs(g,p,x,y,h*.67,8,w*.10);
 for(const s of[-1,1]){block(g,p.plate,x+s*w*.48,y,depth+.18,.22,h*.97,.21);}
}
export function buildWorldSetpiece(p:EnvironmentPalette,stage:number,width:number,height:number){
 const g=new T.Group();g.name='world-rebuild-'+WORLD_REBUILD_STAGES[stage].id;
 const h=height;
 switch(stage){
 case 0:{ // An orbital quarry wrapped in heavy girder frames and socketed excavator pylons
  oreCrust(g,p,0,0,1.2);
  cy(g,2.45,-3.79,p.dark,0,.2,.80);cy(g,2.18,-3.38,p.steel,0,.2,.26);
  ring(g,2.13,-3.11,p.plate,0,.2);ring(g,1.30,-3.03,p.lamp,0,.2);
  cy(g,1.16,-2.91,p.dark,0,.2,.40);
  cy(g,.78,-2.58,p.core,0,.2,.22);
  for(const side of[-1,1]){
   oreCrust(g,p,side*5.8,3.5,.47);
   for(let i=0;i<3;i++){block(g,p.plate,side*(3.3+i*.88),1.5-i*.9,-3.0,.62,.27,.25);}
  }
  break;
 }
 case 1:{ // A physically constructed ship deck aligned to the coastal background
  // A single irregular ship hull, not the shared rectangular scaffolding.
   hull(g,[[-5,-6.4],[-6.0,2.8],[-3.6,6.8],[3.2,6.3],[5.9,2],[5,-5.9]],1.8,p.dark,-6.5);
   hull(g,[[-4.0,-5.9],[-4.6,2.7],[-2.8,5.4],[2.9,5.0],[4.7,2.0],[4.0,-5.6]],.50,p.plate,-4.7);
  block(g,p.dark,1.2,-.5,-4.0,1.15,9.0,.65);
  for(const side of[-1,1]){
   hull(g,[[side*3.7,-5.4],[side*5.7,-3],[side*6.3,3],[side*4.1,6]],1.0,p.steel,-5.7);
   cy(g,1.08,-3.54,p.dark,side*4.4,-2.7,.49);
   cy(g,.74,-3.17,p.steel,side*4.4,-2.7,.30);
   for(let j=0;j<4;j++)block(g,p.lamp,side*4.52,-4.8+j*2.9,-3.30,.13,.45,.08);
  }
  for(let i=-2;i<=2;i++)block(g,p.warm,i*1.4,-5.5,-3.04,.27,.10,.06);
  block(g,p.glass,0,3.2,-2.89,2.1,3.2,.45);
  break;
 }
 case 2:{ // Stacked citadel roofs, docking spine and real raised defense towers
  // Citadel's angled blast walls frame a single six-bladed central iris.
   hull(g,[[-4.5,-6.5],[4.5,-6.5],[6.2,-3],[6.0,3.1],[3.8,6.4],[-3.8,6.4],[-6.1,3]],1.8,p.dark,-6.2);
  for(const side of[-1,1]){
   hull(g,[[side*4.5,-6.2],[side*7,-3.8],[side*6.6,3.8],[side*4.3,5.2]],1.3,p.steel,-5.4);
   cy(g,.75,-2.24,p.dark,side*5.1,2.1,.58);
   cy(g,.45,-1.88,p.core,side*5.1,2.1,.21);
  }
  cy(g,3.8,-4.1,p.dark,0,0,.65);
  for(let i=0;i<6;i++){
   const y=-5.1+i*2.1;
   block(g,p.steel,0,y,-2.71,6.1,.30,.18);
   for(const side of[-1,1])uplight(g,p.lamp,side*2.9,y,-2.54);
  }
  break;
 }
 case 3:{ // Cold scientific research station with jagged 3D thermal barriers
  glacierShelf(g,p,0,0,8.8);
  for(const side of[-1,1]){
   glacierShelf(g,p,side*5.4,-1.1,3.2);
   for(let i=0;i<6;i++){
    const y=-4.1+i*1.6;
    const crystal=new T.Mesh(new T.ConeGeometry(.65,2.6+(i%3)*.6,5),p.ice);
    crystal.rotation.x=Math.PI/2;crystal.position.set(side*(4.7+(i%2)*.6),y,-2.9);
    crystal.rotation.z=side*(i%2?.24:-.12);g.add(crystal);
    cy(g,.22,-2.45,p.glass,side*2.55,y,.70);
   }
  }
  glacierShelf(g,p,0,1.4,3.0);
  for(let i=-2;i<=2;i++)block(g,p.lamp,i*.63,-1.5,-2.45,.13,3.5,.10);
  break;
 }
 case 4:{ // Ancient raised temple, broken overgrown spans and recessed central core
  ancientRoot(g,p,0,0,10.8);
  slab(g,p.moss,0,.8,-3.85,7.3,10.2,.72);
  for(const side of[-1,1]){
   ancientRoot(g,p,side*4.6,-1.5,8.7);
   for(let j=0;j<4;j++){
    const y=-4+j*2.7;
    cy(g,.57,-2.92,p.moss,side*4.6,y,.78);
    cy(g,.29,-2.49,p.steel,side*4.6,y,.25);
   }
  }
  for(let j=0;j<5;j++){
   const y=3.8-j*2.4;
   block(g,p.dark,0,y,-3.17,6.7,.27,.28);
   block(g,p.moss,0,y+.12,-3.0,6.3,.12,.13);
  }
  cy(g,1.46,-2.71,p.dark,0,.9,.29);
  cy(g,1.09,-2.38,p.core,0,.9,.15);
  break;
 }
 case 5:{ // Molten foundry's heat vaults, long industrial transfer pipes and armored towers
  foundryChamber(g,p,0,0,11.4);
  // Furnace shaft is offset to leave a visible lava basin.
   block(g,p.dark,-2.6,2.2,-4.1,1.4,8.9,.95);
  for(const side of[-1,1]){
   foundryChamber(g,p,side*5.3,-1.3,4.1);
   for(let i=0;i<3;i++){
    cy(g,.69,-3.05,p.steel,side*(4.05+(i%2)*1.1),-3.9+i*3.3,1.25);
    cy(g,.52,-2.28,p.dark,side*(4.05+(i%2)*1.1),-3.9+i*3.3,.28);
    cy(g,.29,-2.07,p.core,side*(4.05+(i%2)*1.1),-3.9+i*3.3,.11);
   }
   for(let i=0;i<3;i++)block(g,p.steel,side*(1.9+i*.6),-1.8+i*2.3,-2.70,.29,5.5,.41);
  }
  cy(g,1.9,-3.22,p.dark,0,.9,.88);
  cy(g,1.55,-2.65,p.steel,0,.9,.22);
  cy(g,1.04,-2.39,p.core,0,.9,.17);
  ring(g,1.7,-2.19,p.warm,0,.9);
  break;
 }
 }
 // Physical centrepiece motion has six different mechanisms, not one reused
 // three-ring/four-arm layer painted six ways. All are behind combat actors.
 const result=batch(g);
 const machinery=new T.Group();
 machinery.name='kinetic-world-assembly';
 machinery.userData.motionId=HERO_MOTION_IDS[stage];
 const actor=(index:number,x:number,y:number,z:number)=>{
  const joint=new T.Group();
  joint.name='hero-actuator-'+index;
  joint.position.set(x,y,z);
  joint.userData.baseX=x;joint.userData.baseY=y;joint.userData.baseZ=z;
  machinery.add(joint);return joint;
 };
 if(stage===0){ // An off-axis six-finger ore collector physically grips a core.
  const grip=actor(0,0,0,-1.95);
  const ore=new T.Mesh(new T.IcosahedronGeometry(1.45,1),p.rock);
  ore.scale.set(1.1,1.3,.65);grip.add(ore);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   const claw=actor(i+1,Math.cos(a)*2.8,Math.sin(a)*2.8,-1.85);
   const m=new T.Mesh(new T.BoxGeometry(.48,2.8,.55),i%2?p.plate:p.steel);
   m.rotation.z=a-Math.PI/2;claw.add(m);
   const tip=new T.Mesh(new T.BoxGeometry(.68,.45,.65),p.dark);
   tip.position.set(-Math.cos(a)*.5,-Math.sin(a)*.5,.20);claw.add(tip);
  }
 }else if(stage===1){ // Independently counter-moving seawall doors and sonar dish.
  for(let i=0;i<5;i++){
   const gate=actor(i,-3.8+i*1.65,-.4+(i%2)*.4,-2.15);
   const blade=new T.Mesh(new T.BoxGeometry(1.2,5.5-(i%3)*.9,.73),i%2?p.steel:p.plate);
   gate.add(blade);
   const collar=new T.Mesh(new T.BoxGeometry(1.32,.48,.84),p.dark);
   collar.position.y=-2.7;gate.add(collar);
  }
  const sonar=actor(5,2.8,3,-1.65);
  const disc=new T.Mesh(new T.CylinderGeometry(1.65,1.65,.20,18),p.glass);
  disc.rotation.x=Math.PI/2;sonar.add(disc);
  const beam=new T.Mesh(new T.BoxGeometry(.24,4.4,.18),p.lamp);sonar.add(beam);
 }else if(stage===2){ // A mechanically coupled hexagonal defense iris.
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   const shutter=actor(i,Math.cos(a)*1.9,Math.sin(a)*1.9,-1.70);
   const blade=new T.Mesh(new T.BoxGeometry(1.8,3.5,.58),i%2?p.steel:p.plate);
   blade.rotation.z=a;shutter.add(blade);
  }
  for(let i=0;i<2;i++){
   const ram=actor(6+i,i?4.4:-4.4,-.8,-1.50);
   const housing=new T.Mesh(new T.BoxGeometry(.8,5.9,1.05),p.dark);ram.add(housing);
   const blade=new T.Mesh(new T.BoxGeometry(.48,3.0,.8),p.core);
   blade.position.y=1.25;ram.add(blade);
  }
 }else if(stage===3){ // Slowly oscillating crystal tuning forks, not machines.
  for(let i=0;i<7;i++){
   const a=i*2.399,r=1.4+Math.sqrt(i)*.8;
   const crystal=actor(i,Math.cos(a)*r,Math.sin(a)*r*.85,-1.95);
   const shard=new T.Mesh(new T.OctahedronGeometry(1,0),i%3?p.ice:p.snow);
   shard.scale.set(.42+(i%3)*.12,2+(i%4)*.6,.7);
   shard.rotation.z=(i-3)*.12;crystal.add(shard);
  }
 }else if(stage===4){ // Root tendrils surround a non-concentric stone altar.
  for(let i=0;i<5;i++){
   const a=i*TAU/5;
   const root=actor(i,Math.cos(a)*3,Math.sin(a)*2.9,-2.10);
   const wood=new T.Mesh(new T.CylinderGeometry(.28,.75,4.5+(i%2)*.8,7),p.moss);
   wood.rotation.z=a+.7;root.add(wood);
   const leaves=new T.Mesh(new T.IcosahedronGeometry(1.1,0),p.foliage);
   leaves.position.set(Math.cos(a)*.8,Math.sin(a)*1.4,.15);
   leaves.scale.y=.65;root.add(leaves);
  }
  const altar=actor(5,0,.4,-1.72);
  const stone=new T.Mesh(new T.OctahedronGeometry(1.2,0),p.core);
  altar.add(stone);
 }else{ // Large independent forging plungers and tilted melt crucible.
  for(let i=0;i<4;i++){
   const press=actor(i,-3.15+i*2.1,1.6,-1.95);
   const ram=new T.Mesh(new T.CylinderGeometry(.34,.47,5.8,9),p.steel);
   press.add(ram);
   const head=new T.Mesh(new T.BoxGeometry(1.45,.8,1.2),p.rust);
   head.position.y=-2.8;press.add(head);
  }
  const vessel=actor(4,0,-2.8,-1.5);
  const bowl=new T.Mesh(new T.CylinderGeometry(1.7,1.08,1.8,12),p.dark);
  bowl.rotation.x=Math.PI/2;vessel.add(bowl);
  const melt=new T.Mesh(new T.CylinderGeometry(1.3,1.3,.10,12),p.lava);
  melt.rotation.x=Math.PI/2;melt.position.z=.95;vessel.add(melt);
 }
 result.add(machinery);
 result.name='physical-world-centrepiece-'+stage;
 result.userData={stage,worldScale:true,materialFamily:STAGES[stage].environment};
 return result;
}

/** Each physical hero landmark follows a distinct motion language.
 * Slower in glacial ruins, hydraulic in the ocean and citadel, rapid in lava.
 */
export function animateWorldSetpiece(scene:T.Group,time:number,reduced=false){
 const motion=scene.getObjectByName('kinetic-world-assembly');
 if(!motion)return;
 const stage=scene.userData.stage as number;
 const nodes=motion.children.filter(o=>o.name.startsWith('hero-actuator-'));
 const t=reduced?0:time;
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];
  const x=node.userData.baseX as number,y=node.userData.baseY as number;
  node.position.x=x;node.position.y=y;
  node.rotation.set(0,0,0);
  node.scale.setScalar(1);
  if(stage===0){
   const orbit=t*.12+(i-1)*.13;
   if(i===0){node.rotation.set(t*.10,t*.19,t*.30);}
   else{
    node.rotation.z=Math.sin(orbit*2+i)*.19;
    node.position.x=x*(.94+.06*Math.sin(orbit));
    node.position.y=y*(.94+.06*Math.sin(orbit));
   }
  }else if(stage===1){
   if(i<5){
    node.position.y=y+Math.sin(t*.52+i*.77)*1.25;
    node.rotation.z=Math.sin(t*.22+i*.75)*.075;
   }else{node.rotation.z=Math.sin(t*.34)*.60;node.rotation.y=Math.sin(t*.18)*.25;}
  }else if(stage===2){
   if(i<6){
    const open=.1+.5*(.5+.5*Math.sin(t*.38));
    node.rotation.z=(i%2?1:-1)*open;
    node.position.x=x*(1+.12*Math.sin(t*.38));
    node.position.y=y*(1+.12*Math.sin(t*.38));
   }else{node.position.y=y+Math.sin(t*.68+i)*1.10;}
  }else if(stage===3){
   node.rotation.y=Math.sin(t*.21+i*1.2)*.20;
   node.rotation.z=Math.sin(t*.28+i*.75)*.09;
   node.position.y=y+Math.sin(t*.30+i*.90)*.38;
  }else if(stage===4){
   node.rotation.z=Math.sin(t*.22+i*1.3)*.23;
   node.rotation.y=Math.sin(t*.18+i)*.14;
   if(i===5){node.rotation.z=t*.19;node.position.y=y+Math.sin(t*.56)*.6;}
  }else{
   if(i<4){node.position.y=y+Math.sin(t*1.1+i*1.65)*1.7;}
   else{node.rotation.z=Math.sin(t*.37)*.42;node.rotation.y=Math.sin(t*.28)*.28;}
  }
 }
}
