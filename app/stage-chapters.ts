import * as T from 'three/webgpu';
import {block,ball,hull,batch} from './art.ts';
import type {EnvironmentPalette} from './environment-art.ts';

const TAU=Math.PI*2;
const box=(g:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>block(g,m,x,y,z,w,h,d);
function drum(g:T.Group,m:T.Material,x:number,y:number,z:number,r:number,depth=.42){
 const o=new T.Mesh(new T.CylinderGeometry(r,r,depth,12),m);
 o.rotation.x=Math.PI/2;o.position.set(x,y,z);g.add(o);return o;
}
function torus(g:T.Group,m:T.Material,x:number,y:number,z:number,r:number,w=.16){
 const o=new T.Mesh(new T.TorusGeometry(r,w,5,28),m);
 o.position.set(x,y,z);g.add(o);return o;
}
function shard(g:T.Group,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,angle=0){
 const o=new T.Mesh(new T.IcosahedronGeometry(1,0),m);
 o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.z=angle;g.add(o);return o;
}
function polygon(g:T.Group,m:T.Material,points:number[][],z:number,d=.45){
 return hull(g,points,d,m,z);
}

/** Eighteen non-looping architectural scenes. There is deliberately no shared
 * side-rail, grating, orbit ring, or paired-machine silhouette. Only the few
 * physically moving pieces below are animated. Classic art remains unchanged.
 */
export const STAGE_CHAPTER_IDS=[
 ['ORE HARVEST','SHATTERED MINER','RUPTURED PORTAL'],
 ['BREAKWATER','DEEP SONAR','DRYDOCK FLOOD'],
 ['IRIS CHECKPOINT','GRAVITY ELEVATOR','DEFENSE ARRAY'],
 ['GLACIAL FAULT','CRYSTAL CHOIR','THERMAL OBSERVATORY'],
 ['ROOT CATHEDRAL','RELIC ORRERY','SUNKEN GARDEN'],
 ['SLAG RIVER','HAMMER MILL','MOLTEN CRUCIBLE']
] as const;

export function buildStageChapter(p:EnvironmentPalette,stage:number,index:number){
 const root=new T.Group();
 root.name='stage-chapter-'+stage+'-'+index;
 root.userData={chapterId:STAGE_CHAPTER_IDS[stage]?.[index]??'unknown',stage,index};
 const still=new T.Group(),act=new T.Group(),secondary=new T.Group();
 act.name='stage-primary-motion';secondary.name='stage-secondary-motion';
 root.add(still,act,secondary);
 // Clusters are asymmetrical by design, so the scene never forms a fence.
 if(stage===0){
  if(index===0){ // Salvage claw spanning a broken ore field.
   for(let k=0;k<11;k++)shard(still,k%4?p.rock:p.dark,
    Math.sin(k*2.6)*4.4,-6+(k*2.3)%13,-6.8+(k%3)*.35,
    .8+(k%4)*.33,.75+(k%3)*.43,.85,k*.33);
   polygon(still,p.steel,[[-3,-5],[-4,1],[-2,4],[.2,4.8],[1.3,2.3],[-.8,.1]],-4.6,.65);
   box(still,p.dark,-1.6,0,-3.9,.65,9,.6);
   for(let k=0;k<3;k++){
    const finger=box(act,p.plate,(k-1)*1.23,-1.3,-3.3,.50,5.0,.8);
    finger.rotation.z=(k-1)*.20;
   }
   shard(secondary,p.rock,0,-3.9,-3.5,1.7,1.6,1.3,.4);
  }else if(index===1){ // Hollow ore-crusher shell, ruptured casing.
   for(let k=0;k<7;k++){const a=TAU*k/7;
    shard(still,k%2?p.dark:p.steel,Math.cos(a)*4.3,Math.sin(a)*4.6,-4.5,
     1.4,.85,1.3,a);
   }
   for(let k=0;k<3;k++)box(still,p.dark,5.3-k*.7,4.1-k*2,-4.8,.6,5.5,.8);
   shard(act,p.rust,0,0,-3.9,2.6,3.5,1.7,.18);
   for(let k=0;k<5;k++)shard(secondary,p.plate,Math.sin(k*2.2)*2.1,Math.cos(k*2.2)*2.6,-3.0,.45,.9,.5,k*.4);
  }else{ // A single wrecked orbital ring, not a recurring path border.
   torus(still,p.dark,0,0,-5.5,5.8,.64).scale.y=.82;
   for(let k=0;k<9;k++){const a=k*TAU/9;
    shard(still,p.steel,Math.cos(a)*5.9,Math.sin(a)*4.7,-4.9,.95,.5,.8,a);
   }
   polygon(act,p.plate,[[-2,-5],[1.5,-5],[2.4,-.8],[.5,3.7],[-1.9,2.9]],-4.1,.35);
   shard(secondary,p.rock,0,0,-3.4,1.9,2.8,1.1);
  }
 }else if(stage===1){
  if(index===0){ // Irregular wavebreaks and a retractable storm barrier.
   for(let k=0;k<7;k++){
    const x=-5+k*1.75,y=-5.5+Math.sin(k*2.2)*1.8;
    box(still,k%3?p.dark:p.steel,x,y,-6.4,.95,4+(k%3),1.65);
    drum(still,p.plate,x,y+1.3,-5.45,.43,.54);
   }
   box(act,p.steel,1.1,1.0,-4.7,8.2,1.4,.8);
   box(act,p.dark,1.1,.1,-4.35,8.0,.4,.27);
   for(let k=0;k<3;k++)box(secondary,p.warm,4.4-k*.95,-1.6+k*.3,-4.05,.13,.3,.12);
  }else if(index===1){ // One offset, actively searching sonar dish.
   polygon(still,p.dark,[[-4,-5],[4,-5],[5,-1],[3,3],[-2,5],[-5,0]],-6.0,1.7);
   for(const x of[-3,3])drum(still,p.steel,x,-3,-4.25,.7,1.4);
   box(still,p.plate,-1.7,-.4,-3.7,1.25,7,.5);
   const dish=torus(act,p.plate,1.6,1.0,-2.95,3.05,.23);dish.scale.y=.7;
   shard(act,p.glass,1.6,1,-2.9,2.25,1.65,.4);
   box(secondary,p.warm,1.6,1,-2.25,.12,3.1,.15);
  }else{ // Open drydock with a giant sliding floodgate.
   polygon(still,p.dark,[[-6,-5],[6,-5],[6,4.6],[3.5,4.6],[3.5,-2.2],[-3,-2.2],[-3,4.6],[-6,4.6]],-6.3,1.7);
   for(const x of[-4.9,4.6])box(still,p.steel,x,0,-4.5,.42,10,.65);
   box(act,p.plate,-1,-1,-3.8,6.2,3.7,.8);
   for(let k=0;k<5;k++)box(act,p.dark,-3.3+k*1.06,-1,-3.34,.16,3.6,.19);
   drum(secondary,p.steel,4.7,2.3,-3.5,1.1,.6);
  }
 }else if(stage===2){
  if(index===0){ // Armored iris; no long horizontal rails.
   polygon(still,p.dark,[[-5,-5],[5,-5],[5,5],[-5,5]],-6.3,1.6);
   drum(still,p.steel,0,0,-4.6,4.15,.42);
   drum(still,p.dark,0,0,-4.13,3.40,.39);
   for(let k=0;k<6;k++){
    const blade=box(act,k%2?p.plate:p.steel,0,1.65,-3.55,2.0,3.35,.42);
    blade.rotation.z=k*TAU/6;
   }
   drum(secondary,p.core,0,0,-3.10,1.1,.28);
  }else if(index===1){ // Asymmetrical deep-shaft elevator.
   for(const x of[-4.2,3.2]){
    box(still,p.dark,x,0,-6,1.1,13,1.4);
    for(let j=0;j<4;j++)box(still,p.steel,x,6.0-j*3.8,-4.85,1.55,.32,.5);
   }
   polygon(still,p.dark,[[-5,-6],[5,-6],[5,-4],[-5,-4]],-4.7,.6);
   box(act,p.plate,-.2,-1,-3.8,6.5,2.0,.85);
   box(act,p.steel,-.2,-2.1,-3.3,5.2,.45,.35);
   box(secondary,p.warm,1.6,2,-4.15,.30,2.1,.23);
  }else{ // Defense array with offset swivel mast.
   for(let k=0;k<3;k++)polygon(still,k%2?p.plate:p.dark,
    [[-5+k*2,-4],[-4+k*2,4],[-3+k*2,4.6],[-3.5+k*2,-4]],-6+k*.4,.8);
   box(still,p.dark,3.7,0,-4.1,1.2,11,1.2);
   for(let k=0;k<4;k++){
    const fin=box(act,p.steel,.7,0,-3.15,.5,5.3,.55);fin.rotation.z=k*TAU/4;
   }
   drum(secondary,p.core,.7,0,-2.76,.76,.17);
  }
 }else if(stage===3){
  if(index===0){ // Two mismatched cliffs separated by a real dark fault.
   for(const side of[-1,1]){
    const dx=side*(3.5+(side<0?.8:0));
    polygon(still,side<0?p.ice:p.rock,
     [[dx-2.7,-7],[dx+1.9,-7],[dx+2.4,5],[dx-1.2,6.1]],-6.7,2.5);
    for(let j=0;j<5;j++){
     const spike=shard(still,j%2?p.snow:p.ice,dx+(j-2)*.8,-4+j*2.0,-3.8,.7,2.0+(j%3)*.8,.6,j*.22);
     spike.rotation.y=.2;
    }
   }
   for(let k=0;k<3;k++)shard(act,p.ice,(k-1)*1.5,0,-4.3,.45,1.7,.65,k*.28);
   shard(secondary,p.snow,.6,1.0,-4,1.1,2.2,.7);
  }else if(index===1){ // Tall non-concentric ice prism choir.
   for(let k=0;k<9;k++){
    const a=k*2.399,rad=.6+Math.sqrt(k)*1.58;
    const m=shard(still,k%3?p.ice:p.snow,Math.cos(a)*rad,Math.sin(a)*rad,-5.2,
      .65+(k%3)*.2,1.9+(k%4)*.85,1.15,a*.2);
    m.rotation.y=a*.15;
   }
   for(let k=0;k<3;k++){
    const s=shard(act,p.ice,(k-1)*1.38,-.1,-2.9,.52,2.8,.64,k*.3);s.rotation.y=.22;
   }
   shard(secondary,p.glass,-.7,1.1,-2.3,.75,1.6,.6);
  }else{ // Raised heat lab and hinged ice shields.
   polygon(still,p.dark,[[-5,-3],[0,-5],[5,-2],[4.2,5],[-4.7,5]],-5.8,1.1);
   box(still,p.steel,0,0,-4.2,5.6,5.8,.8);
   for(let k=0;k<5;k++)drum(still,p.glass,-2.2+k*1.05,1.3,-3.65,.29,.42);
   for(const side of[-1,1]){
    const vane=box(act,p.ice,side*3.8,.4,-3.25,1.1,7.2,.52);
    vane.rotation.z=side*.22;
   }
   drum(secondary,p.warm,0,-1.6,-3.25,1.05,.2);
  }
 }else if(stage===4){
  if(index===0){ // Giant root arches, no rectangular industrial scaffold.
   for(let j=0;j<9;j++){
    const a=j*2.31,rad=2+j*.48;
    const rootPiece=box(still,j%4?p.moss:p.rock,Math.cos(a)*rad,Math.sin(a)*rad,-5.4,
      .7+(j%3)*.2,3.6+(j%4)*1.1,1.3);
    rootPiece.rotation.z=a+.3;
   }
   for(let j=0;j<5;j++)shard(still,p.foliage,-4+j*2.1,4.0+Math.sin(j)*.7,-4.1,1.8,1.4,1.3);
   for(let j=0;j<3;j++)shard(act,p.moss,(j-1)*1.8,1.1,-2.9,1.0,3.2,.8,.15+j*.3);
   shard(secondary,p.foliage,0,3,-2.7,2.9,1.4,.65);
  }else if(index===1){ // Angular stone calendar with independently aligning orbit needles.
   for(let k=0;k<8;k++){
    const a=k*TAU/8;
    polygon(still,p.rock,[[Math.cos(a)*4.6-1,Math.sin(a)*4.6-1],[Math.cos(a)*4.6+1,Math.sin(a)*4.6-1],
      [Math.cos(a)*4.6+1,Math.sin(a)*4.6+1],[Math.cos(a)*4.6-1,Math.sin(a)*4.6+1]],-5.6,.9);
   }
   polygon(still,p.dark,[[-2.8,-2.8],[2.6,-3.5],[3.2,1.7],[.4,3.6],[-3,2]],-4.6,1.1);
   for(let j=0;j<4;j++){
    const needle=box(act,p.steel,0,1.35,-3.15,.33,4.1,.42);needle.rotation.z=j*TAU/4;
   }
   shard(secondary,p.core,0,0,-2.8,1.25,1.4,.75);
  }else{ // Water garden / falling terraced channels.
   for(let k=0;k<6;k++){
    const x=-4.5+k*1.7;
    box(still,p.rock,x,-4+k*.9,-5.2,2.1,2.3,.9);
    box(still,p.moss,x,-2.6+k*.9,-4.6,1.9,.45,.4);
   }
   for(let k=0;k<3;k++)box(act,p.water,-3+k*2.8,2.4-k*.4,-3.75,.75,5.5,.12);
   for(let k=0;k<4;k++)shard(secondary,p.foliage,-3+k*2.0,-3,-3.5,1.1,1.3,.75);
  }
 }else{
  if(index===0){ // One immense forked basalt river and flow gates.
   polygon(still,p.rock,[[-6,-6],[-3,-5],[-1,-1],[3,1],[5,6],[-6,6]],-6.8,2.6);
   polygon(still,p.lava,[[-3,-6],[0,-5],[1,-1],[3,2],[4.3,6],[2.2,6],[.2,1],[-2,-2]],-4.7,.15);
   for(let k=0;k<3;k++)box(still,p.steel,-3+k*3,-2+k*2,-3.9,1.2,2.3,.5);
   for(let k=0;k<2;k++)box(act,p.rust,-2+k*4,-2+k*2,-3.0,2.8,.75,.8);
   shard(secondary,p.warm,.7,0,-2.6,.85,1.25,.55);
  }else if(index===1){ // Industrial hammer bed with reciprocating pistons.
   polygon(still,p.dark,[[-5,-6],[5,-6],[6,3.5],[2,5],[-4,4]],-6.0,2.2);
   for(let j=0;j<4;j++)box(still,p.rust,-4+j*2.6,-3,-3.95,1.25,4.5,.8);
   box(still,p.steel,0,4,-3.9,7,.8,1.1);
   for(let j=0;j<3;j++)box(act,p.steel,-2.2+j*2.1,1.9,-3.12,.65,6.4,.76);
   box(secondary,p.dark,0,-1.3,-2.48,6,1.6,.83);
  }else{ // Suspended crucible tilts above an offset slag pit.
   polygon(still,p.rock,[[-6,-5],[6,-5],[5,4],[-4,6]],-6.7,1.9);
   drum(still,p.dark,1.0,-.2,-4.6,4.1,.7);
   drum(still,p.lava,1.0,-.2,-4.1,3.0,.2);
   for(const x of[-3.8,5.1])box(still,p.steel,x,2.0,-3.5,.8,9.0,.9);
   const crucible=shard(act,p.rust,0,0,-2.5,2.8,2.2,1.65,.12);crucible.rotation.x=.4;
   for(let j=0;j<3;j++)shard(secondary,p.warm,-1+j*1.1,-1-j*.7,-2.2,.45,.8,.42);
  }
 }
 root.add(batch(still));
 return root;
}
export function animateStageChapter(root:T.Group,time:number,reduced=false){
 const stage=root.userData.stage as number,index=root.userData.index as number;
 const primary=root.getObjectByName('stage-primary-motion');
 const secondary=root.getObjectByName('stage-secondary-motion');
 if(!primary||!secondary)return;
 const t=reduced?0:time,phase=t*.65+index*1.9;
 // Distinct types of physical movement by environment, not six recolored rings.
 if(stage===0){
  primary.rotation.z=(index===2?.10:-.23)*t;
  primary.position.x=Math.sin(phase)*.7;
  secondary.rotation.z=t*(index===1?.42:-.18);
  secondary.position.y=Math.sin(t*.8+index)*1.1;
 }else if(stage===1){
  primary.position.y=Math.sin(t*.36+index)*1.15;
  primary.rotation.y=Math.sin(t*.28)*.25;
  secondary.rotation.z=index===1?Math.sin(t*.33)*.50:t*.14;
 }else if(stage===2){
  primary.rotation.z=index===0?t*.30:Math.sin(t*.5)*.24;
  primary.position.y=index===1?Math.sin(t*.36)*3.2:0;
  secondary.scale.setScalar(.9+.1*Math.sin(t*.85));
 }else if(stage===3){
  primary.rotation.y=Math.sin(t*.27+index)*.29;
  primary.position.y=Math.sin(t*.35+index*1.6)*.48;
  secondary.rotation.z=Math.sin(t*.20)*.16;
 }else if(stage===4){
  primary.rotation.z=Math.sin(t*.31+index)*.34;
  primary.position.x=Math.sin(t*.21)*.50;
  secondary.rotation.y=index===1?t*.25:Math.sin(t*.42)*.25;
 }else{
  primary.position.y=index===1?Math.sin(t*1.05)*1.7:Math.sin(t*.40)*.6;
  primary.rotation.z=index===2?Math.sin(t*.38)*.42:Math.sin(t*.3)*.12;
  secondary.position.y=Math.sin(t*.65+index)*.65;
 }
}
