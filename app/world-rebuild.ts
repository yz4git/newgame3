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
  scaffold(g,p,0,0,8.8,12.4);
  cy(g,2.45,-3.79,p.dark,0,.2,.80);cy(g,2.18,-3.38,p.steel,0,.2,.26);
  ring(g,2.13,-3.11,p.plate,0,.2);ring(g,1.30,-3.03,p.lamp,0,.2);
  cy(g,1.16,-2.91,p.dark,0,.2,.40);
  cy(g,.78,-2.58,p.core,0,.2,.22);
  for(const side of[-1,1]){
   gantry(g,p,side*5.2,0,2.2,10.9);
   scaffold(g,p,side*5.1,3.5,2.7,4.3);
   for(let i=0;i<3;i++){block(g,p.plate,side*(3.3+i*.88),1.5-i*.9,-3.0,.62,.27,.25);}
  }
  break;
 }
 case 1:{ // A physically constructed ship deck aligned to the coastal background
  scaffold(g,p,0,0,10.9,14.2);
  gantry(g,p,0,0,5.2,12.6);
  for(const side of[-1,1]){
   scaffold(g,p,side*4.6,.7,2.9,12.9);
   cy(g,1.08,-3.54,p.dark,side*4.4,-2.7,.49);
   cy(g,.74,-3.17,p.steel,side*4.4,-2.7,.30);
   for(let j=0;j<4;j++)block(g,p.lamp,side*4.52,-4.8+j*2.9,-3.30,.13,.45,.08);
  }
  for(let i=-2;i<=2;i++)block(g,p.warm,i*1.4,-5.5,-3.04,.27,.10,.06);
  block(g,p.glass,0,3.2,-2.89,2.1,3.2,.45);
  break;
 }
 case 2:{ // Stacked citadel roofs, docking spine and real raised defense towers
  scaffold(g,p,0,0,9.3,14.4);
  for(const side of[-1,1]){
   scaffold(g,p,side*5.25,-.6,4.2,12.0);
   scaffold(g,p,side*5.10,1.55,3.5,5.3);
   scaffold(g,p,side*5.15,1.85,2.4,3.8);
   cy(g,.75,-2.24,p.dark,side*5.1,2.1,.58);
   cy(g,.45,-1.88,p.core,side*5.1,2.1,.21);
  }
  gantry(g,p,0,-.9,4.4,13.3);
  for(let i=0;i<6;i++){
   const y=-5.1+i*2.1;
   block(g,p.steel,0,y,-2.71,6.1,.30,.18);
   for(const side of[-1,1])uplight(g,p.lamp,side*2.9,y,-2.54);
  }
  break;
 }
 case 3:{ // Cold scientific research station with jagged 3D thermal barriers
  scaffold(g,p,0,0,8.5,12.5);
  for(const side of[-1,1]){
   scaffold(g,p,side*4.3,-.9,3.2,10.8);
   for(let i=0;i<6;i++){
    const y=-4.1+i*1.6;
    const crystal=new T.Mesh(new T.ConeGeometry(.65,2.6+(i%3)*.6,5),p.ice);
    crystal.rotation.x=Math.PI/2;crystal.position.set(side*(4.7+(i%2)*.6),y,-2.9);
    crystal.rotation.z=side*(i%2?.24:-.12);g.add(crystal);
    cy(g,.22,-2.45,p.glass,side*2.55,y,.70);
   }
  }
  scaffold(g,p,0,1.4,4.1,7.8);
  for(let i=-2;i<=2;i++)block(g,p.lamp,i*.63,-1.5,-2.45,.13,3.5,.10);
  break;
 }
 case 4:{ // Ancient raised temple, broken overgrown spans and recessed central core
  scaffold(g,p,0,0,9.0,14.2);
  slab(g,p.moss,0,.8,-3.85,7.3,10.2,.72);
  for(const side of[-1,1]){
   scaffold(g,p,side*4.4,-1.5,3.3,9.6);
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
  scaffold(g,p,0,0,10.8,13.6);
  gantry(g,p,0,0,4.3,12.9);
  for(const side of[-1,1]){
   scaffold(g,p,side*4.6,-1.3,3.6,10.2);
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
 // Guardrails and service illuminators supply a repeatable real-world scale cue.
 for(const side of[-1,1])for(let j=0;j<7;j++){
  const x=side*Math.min(6.5,width*.40),y=(j-3)*Math.min(1.9,h*.13);
  block(g,p.steel,x,y,-4.7,.16,.43,.49);
  if(j%2===0)uplight(g,p.lamp,x,y,-4.34);
 }
 const result=batch(g);
 result.name='physical-world-centrepiece-'+stage;
 result.userData={stage,worldScale:true,materialFamily:STAGES[stage].environment};
 return result;
}
