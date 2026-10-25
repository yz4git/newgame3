import * as T from 'three';

/** Original stage-one guardian silhouettes: airborne dreadnought or siege walker. */
const metal=()=>new T.MeshStandardMaterial({color:0x52677b,metalness:.78,roughness:.37,flatShading:true});
const navy=()=>new T.MeshStandardMaterial({color:0x172a3f,metalness:.84,roughness:.28,flatShading:true});
const trim=()=>new T.MeshStandardMaterial({color:0xb4c4c8,metalness:.71,roughness:.26,flatShading:true});
const warning=()=>new T.MeshBasicMaterial({color:0xffa469,toneMapped:false});
const energy=()=>new T.MeshStandardMaterial({color:0xffb472,emissive:0xff7029,emissiveIntensity:2.5,metalness:.18,roughness:.25});
const thruster=()=>new T.MeshBasicMaterial({color:0x85e8ff,toneMapped:false});
function cub(g:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,rz=0){
 const p=new T.Mesh(new T.BoxGeometry(w,h,d),m);
 p.position.set(x,y,z);p.rotation.z=rz;g.add(p);return p;
}
function orb(g:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
 const p=new T.Mesh(new T.IcosahedronGeometry(1,1),m);
 p.scale.set(w,h,d);p.position.set(x,y,z);g.add(p);return p;
}
function engine(g:T.Group,x:number,y:number,z:number,m:T.Material,dark:T.Material,hot:T.Material,scale=1){
 const part=new T.Group();part.position.set(x,y,z);part.scale.setScalar(scale);
 const nozzle=new T.Mesh(new T.CylinderGeometry(2,2.5,8,10),m);
 nozzle.rotation.x=Math.PI/2;part.add(nozzle);
 const throat=new T.Mesh(new T.CylinderGeometry(1.45,1.45,8.4,10),dark);
 throat.rotation.x=Math.PI/2;part.add(throat);
 for(const pos of [-3.9,4.2]){
  const rim=new T.Mesh(new T.TorusGeometry(1.65,.3,8,12),hot);
  rim.position.z=pos;part.add(rim);
 }
 g.add(part);return part;
}
function gun(g:T.Group,x:number,y:number,z:number,armor:T.Material,light:T.Material,sign:number){
 const unit=new T.Group();unit.position.set(x,y,z);
 cub(unit,armor,0,0,0,2.8,2.8,3.8);
 for(const s of [-1,1]){
  const barrel=new T.Mesh(new T.CylinderGeometry(.4,.52,9,8),armor);
  barrel.rotation.x=Math.PI/2;barrel.position.set(s*.75,0,-5.5);unit.add(barrel);
  orb(unit,light,s*.75,0,-10,.5,.5,.5);
 }
 unit.rotation.z=sign*.07;g.add(unit);
 return unit;
}
export function createFirstStageBoss(hardRoute=false){
 const root=new T.Group(),armor=metal(),dark=navy(),edge=trim(),hot=warning(),reactor=energy(),after=thruster();
 root.userData.variant=hardRoute?'walker':'carrier';
 root.userData.parts=[] as T.Object3D[];
 if(!hardRoute){
  // Six broad silhouette layers. Engines, swept wings and massive central
  // docking deck clearly read as a capital ship, not an enlarged fighter.
  cub(root,dark,0,0,0,17,5.5,24);
  cub(root,armor,0,3.1,-1.5,11,3.3,12);
  cub(root,edge,0,5.4,-1,7.5,1,9.5);
  const nose=new T.Mesh(new T.ConeGeometry(5,13,4),armor);
  nose.rotation.x=-Math.PI/2;nose.rotation.y=Math.PI/4;
  nose.position.set(0,0,-14);root.add(nose);
  for(const s of [-1,1]){
   cub(root,armor,s*12.4,.0,1.5,14,2,15,s*.12);
   cub(root,edge,s*17.0,.45,-2,8,.75,9,s*.15);
   cub(root,dark,s*16,-1,8,6,2.8,8);
   cub(root,armor,s*6.6,4.1,-4,4,5.8,7);
   engine(root,s*16.5,-1.0,6.8,armor,dark,after,.95);
   gun(root,s*8,-1.2,-10,armor,hot,s);
   for(let n=0;n<3;n++)cub(root,hot,s*(9.5+n*3),1.35,-2+n*3,1.6,.17,2.1);
  }
  cub(root,dark,0,6,-3,5,4.3,7);
  orb(root,hot,0,9.1,-5,.55,.5,.6);
  const core=orb(root,reactor,0,0.2,-17,3.0,2.7,2.1);
  const ring=new T.Mesh(new T.TorusGeometry(3.3,.55,8,20),hot);
  ring.position.copy(core.position);ring.position.z-=.4;root.add(ring);
  root.userData.weakpoint=core;
  root.userData.reactorMaterial=reactor;
  root.userData.parts.push(ring);
 }else{
  // Heavy walking assault platform with articulated knees, broad feet,
  // separate moving gun arms and armour shielding the reactor.
  cub(root,dark,0,5.5,0,17,8,14);
  cub(root,armor,0,9.3,-1,15,3.1,12);
  cub(root,edge,0,12.1,-2,10,2,8);
  cub(root,dark,0,14,-1.9,8,3.5,6);
  orb(root,hot,0,15,-5,.9,.9,.5);
  const legs:T.Group[]=[];
  for(const s of [-1,1]){
   const leg=new T.Group();leg.position.set(s*9,1,1.3);
   cub(leg,armor,0,-5.2,0,4.5,11,4.9,s*.1);
   orb(leg,edge,0,-10.6,-.4,2.7,2.7,2.7);
   cub(leg,dark,s*.7,-16,1.5,3.8,12,4.4,s*.08);
   cub(leg,armor,s*.9,-22,-1.5,6.9,2.5,10);
   root.add(leg);legs.push(leg);
   gun(root,s*13,6,-2.8,armor,hot,s);
   cub(root,armor,s*8.4,9.3,.8,7,2.3,11,s*.14);
   engine(root,s*5.8,4.2,8,armor,dark,after,.65);
  }
  const core=orb(root,reactor,0,5,-8.0,3.3,3.1,1.8);
  const rim=new T.Mesh(new T.TorusGeometry(3.5,.75,7,16),hot);
  rim.position.copy(core.position);rim.position.z-=.45;root.add(rim);
  const shields:T.Group[]=[];
  for(const s of [-1,1]){
   const panel=new T.Group();panel.position.set(s*5.1,5.3,-7);
   cub(panel,edge,s*.9,0,0,3.2,5.5,1.3,s*.13);
   root.add(panel);shields.push(panel);
  }
  root.userData.legs=legs;
  root.userData.shields=shields;
  root.userData.weakpoint=core;
  root.userData.reactorMaterial=reactor;
 }
 // Model local -Z is its nose/face; stage renderer rotates the model 180deg
 // so the guardian turns toward the oncoming aircraft.
 return root;
}
export function animateFirstStageBoss(model:T.Group,time:number,phase:number){
 const variant=model.userData.variant;
 if(variant==='walker'){
  const legs=model.userData.legs as T.Group[]|undefined;
  for(let i=0;i<(legs?.length||0);i++){
   legs![i].rotation.z=Math.sin(time*(phase===3?2:1.1)+i*Math.PI)*(.065+phase*.035);
   legs![i].rotation.x=Math.cos(time*1.2+i*Math.PI)*.06;
  }
  const shields=model.userData.shields as T.Group[]|undefined;
  for(let i=0;i<(shields?.length||0);i++){
   const s=i===0?-1:1;
   shields![i].rotation.y=s*(phase===1?.02:phase===2?.52:.98);
  }
 }else{
  model.rotation.z=Math.sin(time*.53)*.025;
  model.rotation.x=Math.sin(time*.42)*.017;
 }
 const emissive=model.userData.reactorMaterial as T.MeshStandardMaterial|undefined;
 if(emissive)emissive.emissiveIntensity=1.8+phase*.68+Math.sin(time*(2.2+phase*.45))*.45;
}
