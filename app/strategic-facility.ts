import * as T from 'three/webgpu';
import {block,ball,batch,hull,metal,glow} from './art.ts';
import {STAGES} from './stages.ts';
import {metalMap} from './visual-assets.ts';

/** Real world-space structures, not billboards. The same lit geometry is CPU-rasterized on older iPhones. */
const palettes=[
 {plate:0x67798b,trim:0xb1a89b,dark:0x253345,light:0xffb15a},
 {plate:0x597787,trim:0xb7c7c8,dark:0x263947,light:0x51e5f5},
 {plate:0x6d7e93,trim:0xc0bdaf,dark:0x222a42,light:0xffb46e},
 {plate:0x8296a4,trim:0xd0deeb,dark:0x243b54,light:0x8cdeff},
 {plate:0x75877a,trim:0xc2bea7,dark:0x273b34,light:0x75f2d3},
 {plate:0x7e6863,trim:0xb9a6a0,dark:0x38272b,light:0xff9d56},
] as const;
const matCache=new Map<string,T.Material>();
function material(hex:number,emission=0){
 const key=hex+'_'+emission;let m=matCache.get(key);
 if(!m){m=metal(hex,emission);matCache.set(key,m);}return m;
}
function emissive(hex:number){const key='glow'+hex;let m=matCache.get(key);if(!m){m=glow(hex,1.8);matCache.set(key,m);}return m;}
function cylinder(g:T.Group,r:number,h:number,z:number,material:T.Material,x=0,y=0,segments=12){
 const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),material);
 m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;
}
function ring(g:T.Group,r:number,tube:number,z:number,material:T.Material,x=0,y=0){
 const m=new T.Mesh(new T.TorusGeometry(r,tube,5,32),material);
 m.position.set(x,y,z);g.add(m);return m;
}
function beam(g:T.Group,m:T.Material,x:number,y:number,z:number,length:number,angle:number,width=.28){
 const part=block(g,m,x,y,z,width,length,.20);part.rotation.z=angle;return part;
}
function pad(g:T.Group,x:number,y:number,z:number,w:number,h:number,material:T.Material){
 const bevel=.23;
 hull(g,[[x-w/2+bevel,y-h/2],[x+w/2-bevel,y-h/2],[x+w/2,y-h/2+bevel],[x+w/2,y+h/2-bevel],[x+w/2-bevel,y+h/2],[x-w/2+bevel,y+h/2],[x-w/2,y+h/2-bevel],[x-w/2,y-h/2+bevel]],.34,material,z);
}
export interface StrategicFacilityModel extends T.Group{
 userData:{reactor?:T.Group;inner?:T.Group;lighting?:T.Mesh;stage?:number;variant?:number;[key:string]:unknown};
}
export function facilityModel(stage:number,index:number):StrategicFacilityModel{
 const p=palettes[stage%palettes.length],g=new T.Group() as StrategicFacilityModel;
 g.name='in-world-facility-'+stage+'-'+index;
 const steel=material(p.plate),bright=material(p.trim),dark=material(p.dark),edge=material(0x293643),lamp=emissive(p.light);
 const worn=material(stage===3?0x97b6c0:stage===4?0x626a5c:0x515c66);
 const deck=new T.Group();
 const broad=index===0?1:1.18;
 // Footprint and foundations sit on the same Z layers as the background's actual 3-D architecture.
 cylinder(deck,2.05*broad,.76,-2.55,dark);
 cylinder(deck,1.95*broad,.47,-2.04,steel);
 cylinder(deck,1.76*broad,.24,-1.73,bright);
 cylinder(deck,1.64*broad,.35,-1.51,worn);
 cylinder(deck,1.23*broad,.24,-1.23,dark);
 ring(deck,1.84*broad,.10,-1.38,bright);
 ring(deck,1.54*broad,.065,-1.17,steel);
 // Four three-dimensional pylons tied to the foundation, with visible thickness and occlusion.
 const armAngles=stage===1?[-.12,Math.PI-.12,Math.PI/2,-Math.PI/2]:[0,Math.PI/2,Math.PI,3*Math.PI/2];
 for(let j=0;j<4;j++){
  const a=armAngles[j]+(index===1?.12:0),dx=Math.cos(a),dy=Math.sin(a);
  const length=(stage===2||stage===5?1.92:1.67)+(index===1?.27:0);
  beam(deck,dark,dx*2.13,dy*2.13,-1.85,length,a-Math.PI/2,.79);
  beam(deck,steel,dx*2.09,dy*2.09,-1.56,length*.87,a-Math.PI/2,.51);
  const px=dx*2.86,py=dy*2.86;
  cylinder(deck,.59,.74,-2.02,dark,px,py);
  cylinder(deck,.51,.24,-1.56,steel,px,py);
  cylinder(deck,.35,.12,-1.39,bright,px,py);
  cylinder(deck,.17,.32,-1.21,lamp,px,py);
  for(let k=-1;k<=1;k++)block(deck,k===0?bright:dark,px+dy*k*.30,py-dx*k*.30,-1.30,.12,.24,.12);
 }
 // Industrial support girders, small bolted metal plates and alternating glowing marker lamps.
 for(let j=0;j<12;j++){
  const a=j*Math.PI/6,dx=Math.cos(a),dy=Math.sin(a);
  block(deck,j%3===0?bright:edge,dx*1.60,dy*1.60,-1.09,.29,.20,.13).rotation.z=a;
  if(j%2===0)cylinder(deck,.075,.10,-1.00,lamp,dx*1.66,dy*1.66,8);
 }
 // Stage silhouettes follow the same model families as the real scenery: decks, towers, refineries.
 if(stage===0){
  for(const side of[-1,1]){
   cylinder(deck,.27,1.45,-.84,steel,side*.91,.55);
   cylinder(deck,.13,.15,.01,lamp,side*.91,.55);
   beam(deck,bright,side*1.0,-.93,-1.00,1.95,side*.17,.29);
  }
 }else if(stage===1){
  // Sea carrier relay: lower, long landing deck with gantry and aviation warning lights.
  pad(deck,0,.72,-1.0,2.8,2.1,steel);
  for(const side of[-1,1]){
   block(deck,dark,side*.96,.75,-.62,.29,1.70,.24);
   block(deck,bright,side*.97,.75,-.45,.08,1.59,.08);
   cylinder(deck,.2,.8,-.43,steel,side*1.1,-1.01);
  }
 }else if(stage===2){
  // Deep fortress: stepped gun towers and traversing command spine.
  for(const side of[-1,1]){
   pad(deck,side*.73,.18,-1.1,.93,1.28,steel);
   cylinder(deck,.31,1.33,-.39,steel,side*.73,.18);
   cylinder(deck,.16,.12,.36,lamp,side*.73,.18);
  }
 }else if(stage===3){
  // Cryogenic plant: heavily angled ice-metal protective fins with deep recessed generators.
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5+.3,dx=Math.cos(a),dy=Math.sin(a);
   const spike=new T.Mesh(new T.ConeGeometry(.38,1.10,5),bright);
   spike.rotation.x=Math.PI/2;spike.position.set(dx*1.03,dy*1.03,-.51);deck.add(spike);
  }
 }else if(stage===4){
  // Ruined ancient complex: support piers and relic fins grow out of the floor.
  for(const side of[-1,1]){
   pad(deck,side*.92,.36,-1.10,.60,1.65,worn);
   cylinder(deck,.28,.74,-.66,dark,side*.92,.36);
   cylinder(deck,.09,.10,-.20,lamp,side*.92,.36);
  }
 }else{
  // Molten refinery: high chimneys, visible industrial pipes, molten containment vats.
  for(const side of[-1,1]){
   cylinder(deck,.33,1.50,-.61,steel,side*.86,-.24);
   cylinder(deck,.28,.11,.21,dark,side*.86,-.24);
   for(let j=0;j<2;j++)beam(deck,bright,side*1.0,(-1+j)*.49,-.99,1.6,side*.22,.15);
  }
 }
 // Different reactors/relay silhouettes. Distinct variants, but neither rotates in screen space.
 if(index===0){
  cylinder(deck,.86,.33,-.89,dark);
  ring(deck,.87,.11,-.66,bright);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;
   cylinder(deck,.12,.78,-.23,steel,Math.cos(a)*.91,Math.sin(a)*.91,8);
   cylinder(deck,.075,.10,.21,lamp,Math.cos(a)*.91,Math.sin(a)*.91,8);
  }
 }else{
  pad(deck,0,.08,-.95,2.16,.76,steel);
  for(const side of[-1,1]){
   cylinder(deck,.27,.84,-.34,steel,side*.69,0);
   cylinder(deck,.13,.21,.14,lamp,side*.69,0);
  }
 }
 g.add(batch(deck)); // one GPU draw call per shared material, not 90 individually textured objects.
 const reactor=new T.Group();
 // Raised luminous machinery remains embedded in the metal shell, not a billboard glued on top.
 const core=new T.Mesh(new T.IcosahedronGeometry(index===0?.54:.42,1),new T.MeshPhysicalMaterial({
  color:p.light,emissive:p.light,emissiveIntensity:1.6,roughness:.22,metalness:.28,transparent:true,opacity:.95
 }));
 core.position.z=-.35;reactor.add(core);
 ring(reactor,index===0?.70:.53,.08,-.46,lamp);
 ring(reactor,index===0?.52:.41,.065,-.16,bright);
 reactor.position.z=0;g.add(reactor);
 const shadow=new T.Mesh(new T.CircleGeometry(3.5,48),new T.MeshBasicMaterial({color:0x020710,transparent:true,opacity:.25,depthWrite:false}));
 shadow.scale.set(1,.72,1);shadow.position.set(.18,-.48,-3.55);
 g.add(shadow);
 // Invisible in combat gameplay? No: these are true side walls and contact geometry.
 g.userData={reactor,inner:deck,lighting:core,stage,variant:index};
 g.traverse(o=>{if(o instanceof T.Mesh&&o!==core&&o!==shadow){o.castShadow=true;o.receiveShadow=true;}});
 return g;
}
export function animateFacility(model:StrategicFacilityModel,age:number,damagePhase:number,flash:number){
 const core=model.userData.lighting as T.Mesh|undefined;
 if(core){
  const mat=core.material as T.MeshPhysicalMaterial;
  mat.emissiveIntensity=(damagePhase===2?2.9:damagePhase===1?2.1:1.4)*(flash>0?1.9:1)*(1+.09*Math.sin(age*9));
  mat.opacity=damagePhase===2?.98:.93;
 }
 const rotor=model.userData.reactor as T.Group|undefined;
 if(rotor){rotor.rotation.z=Math.sin(age*.72)*.045;rotor.scale.setScalar(damagePhase===2?1.16:1);}
}
export const fieldWorldSpecs={models:STAGES.length*2,worldZ:-2.8,footprintRadius:3.5,visualScale:1} as const;
