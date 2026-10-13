import * as T from 'three/webgpu';
import {cinematicBox,weatheredRock,bakeRigid} from './cinematic-detail.ts';
import {easeReveal as ease} from './scenery-transitions.ts';
import type {stageSpectaclePose} from './stage-spectacle-timeline.ts';

/** Full-size, articulated environments. Units match the fighter's 2 m wingspan.
 * Rigid subassemblies are baked once. Only authored joints move at runtime. */
type Pose=ReturnType<typeof stageSpectaclePose>;
type Joint={node:T.Group;role:string;index:number;position:T.Vector3;rotation:T.Euler};
export type EpicSet={still:T.Group;moving:T.Group;secondary:T.Group;materials:T.MeshStandardMaterial[];joints:Joint[];span:number;};
const PALETTES=[
 [0x202b3e,0x586778,0x9a8265,0x517b99,0xffa45f],
 [0x132d3e,0x4c7080,0x8c9c9c,0x284a60,0x4dceeb],
 [0x1b2539,0x4d6077,0x929497,0x2c425c,0xffbd78],
 [0x20405a,0x5c9cb5,0xb9d7db,0x365e7e,0x89d8ed],
 [0x263b35,0x667c67,0x9f9e7d,0x405e4b,0x86dab5],
 [0x302729,0x655650,0xa18065,0x584644,0xff813c]
] as const;
const box=(g:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
 const mesh=new T.Mesh(cinematicBox(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;
};
function solid(g:T.Object3D,m:T.Material,points:number[][],z:number,depth:number){
 const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.14,bevelThickness:.14,bevelSegments:1,steps:1,curveSegments:1});
 const mesh=new T.Mesh(geo,m);mesh.position.z=z;g.add(mesh);return mesh;
}
function cylinder(g:T.Object3D,m:T.Material,x:number,y:number,z:number,r:number,h:number,r2=r,segments=20){
 const mesh=new T.Mesh(new T.CylinderGeometry(r,r2,h,segments),m);
 mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return mesh;
}
function ring(g:T.Object3D,m:T.Material,x:number,y:number,z:number,r:number,thickness=.35,arc=Math.PI*2){
 const mesh=new T.Mesh(new T.TorusGeometry(r,thickness,8,48,arc),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;
}
function rock(g:T.Object3D,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,seed:number,detail=2){
 const mesh=new T.Mesh(weatheredRock(seed,detail),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(seed*.11,seed*.19,seed*.71);g.add(mesh);return mesh;
}
function beam(g:T.Object3D,m:T.Material,a:number[],b:number[],r:number){
 const v=new T.Vector3(...a as [number,number,number]),w=new T.Vector3(...b as [number,number,number]);
 const mesh=new T.Mesh(new T.CylinderGeometry(r,r,w.distanceTo(v),8),m);
 mesh.position.copy(v).add(w).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),w.sub(v).normalize());g.add(mesh);return mesh;
}
function pipe(g:T.Object3D,m:T.Material,pts:number[][],r:number){
 const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p as [number,number,number])));
 const mesh=new T.Mesh(new T.TubeGeometry(curve,20,r,7,false),m);g.add(mesh);return mesh;
}
function panels(g:T.Object3D,m:T.Material,trim:T.Material,x:number,y:number,z:number,w:number,h:number,columns=3,rows=6){
 const cw=w/columns,ch=h/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const xx=x+(col-(columns-1)/2)*cw,yy=y+(row-(rows-1)/2)*ch;
  box(g,m,xx,yy,z,cw-.15,ch-.14,.13);
  if((row+col)%3===0)for(let k=0;k<3;k++)box(g,trim,xx,yy+(k-1)*.17,z+.10,cw*.50,.065,.06);
 }
}
function windows(g:T.Object3D,m:T.Material,x:number,y:number,z:number,n:number,step=.55){
 for(let i=0;i<n;i++)box(g,m,x+(i-(n-1)/2)*step,y,z,.27,.12,.1);
}

export function buildEpicSet(stage:number,act:number):EpicSet{
 const still=new T.Group(),moving=new T.Group(),secondary=new T.Group(),joints:Joint[]=[];
 const p=PALETTES[stage];
 const materials=p.map((color,i)=>new T.MeshStandardMaterial({color,
  metalness:stage===3||stage===4?.14:i===2?.75:.52,roughness:i===2?.36:.65,
  emissive:i===4?color:0,emissiveIntensity:i===4?1.35:0,
  transparent:true,depthWrite:true}));
 const [dark,metal,trim,natural,light]=materials;
 const joint=(role:string,index:number,x:number,y:number,z:number,parent=moving)=>{
  const node=new T.Group();node.name=role+'-'+index;node.position.set(x,y,z);parent.add(node);
  joints.push({node,role,index,position:node.position.clone(),rotation:node.rotation.clone()});return node;
 };
 const hull=(g:T.Object3D,w:number,h:number,z:number)=>{
  solid(g,dark,[[-w*.43,-h*.5],[w*.43,-h*.5],[w*.5,h*.18],[w*.22,h*.5],[-w*.16,h*.5],[-w*.5,h*.24]],z,2.8);
  solid(g,metal,[[-w*.36,-h*.46],[w*.36,-h*.46],[w*.40,h*.14],[w*.16,h*.45],[-w*.12,h*.45],[-w*.4,h*.20]],z+2.8,.55);
 };
 const ribs=(g:T.Object3D,x:number,y:number,z:number,n:number)=>{
  for(let i=0;i<n;i++)box(g,i%3===0?trim:dark,x,y+i*.62,z,2.7,.20,.4);
 };
 const engine=(g:T.Object3D,x:number,y:number,z:number,size=1)=>{
  const e=new T.Group();e.position.set(x,y,z);e.rotation.x=-Math.PI/2;g.add(e);
  cylinder(e,dark,0,0,0,size,2.4,size*.83);ring(e,trim,0,0,1.18,size*.92,.13);
  cylinder(e,light,0,0,1.3,size*.62,.18);
  const flame=new T.Mesh(new T.ConeGeometry(size*.56,4.8,12),light);flame.position.z=3.5;flame.rotation.x=Math.PI/2;e.add(flame);
 };

 if(stage===0){
  if(act===0){ // Mining canyon: split a 35 m monolith along its fault.
   for(const side of[-1,1]){
    const cliff=joint('fault',side,side*10,0,-9);
    for(let i=0;i<6;i++)rock(cliff,i%2?natural:metal,side*(i%2)*2,(i-2.5)*5.3,-2,4.5,4.8,5.2,i+side*13);
    for(let i=0;i<7;i++)box(cliff,light,-side*3.5,(i-3)*4,-.2,.12,2.6,.12);
    box(cliff,dark,0,0,3,3.1,21,1.5);panels(cliff,metal,trim,0,0,3.83,2.7,19,1,8);
   }
   for(let i=0;i<5;i++){
    const slab=joint('fracture',i,(i-2)*2.5,3,-6);
    rock(slab,metal,0,0,0,2.1,5,3,i+41);
   }
  }else if(act===1){ // One massive industrial ship crosses the quarry.
   hull(still,20,45,-12);
   for(const side of[-1,1]){
    box(still,dark,side*9.3,-3,-8,3.7,28,4.8);
    panels(still,metal,trim,side*9.3,-3,-5.5,3.4,24,2,10);
    ribs(still,side*9.3,-14,-5.2,9);
    engine(still,side*7.5,-22,-8,1.6);
    const arm=joint('claw',side,side*5,12,-5);
    box(arm,metal,0,-2,-1,2,15,2.2);
    box(arm,trim,0,5,-.2,2.8,4,1.8);
    for(let i=0;i<3;i++)beam(arm,trim,[-.56,-7+i*2.5,-.5],[.56,-4.5+i*2.5,-.5],.12);
    box(arm,dark,-side*1.6,-9,-.4,4.8,2.4,2.5);
    beam(still,trim,[side*7,9,-7],[side*5,19,-5],.28);
   }
   box(still,dark,0,-4,-6.5,6.4,15,3.6);
   panels(still,metal,trim,0,-4,-4.6,5.8,14,3,7);
   windows(still,light,0,3.3,-4.45,10);
   const cutter=joint('cutter',0,0,11,-5);
   ring(cutter,dark,0,0,0,4.7,.7);ring(cutter,trim,0,0,.2,3.8,.26);
   for(let i=0;i<12;i++){const a=i*Math.PI/6;const tooth=box(cutter,trim,Math.cos(a)*4.3,Math.sin(a)*4.3,.4,1.5,2.4,.9);tooth.rotation.z=a;}
   const ore=joint('ore',0,0,13,-7,secondary);rock(ore,natural,0,0,0,4.4,6.1,3.5,7);
  }else{ // A derelict toroidal station tears into separately tumbling sectors.
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,node=joint('ring-break',i,Math.cos(a)*12,Math.sin(a)*12,-7);
    node.rotation.z=a;joints.at(-1)!.rotation.copy(node.rotation);
    box(node,dark,0,0,0,5.5,9,4);panels(node,metal,trim,0,0,2.1,5,8,2,4);
    box(node,light,0,3.2,2.3,3.9,.16,.1);
    beam(node,trim,[-2,-3,2.4],[2,3,2.4],.12);
   }
   rock(still,natural,-17,4,-12,8,11,6,41);
  }
 }else if(stage===1){
  if(act===0){ // Offshore locks fold outward, revealing a deep water channel.
   for(const side of[-1,1]){
    const bastion=new T.Group();hull(bastion,9,38,-13);bastion.position.x=side*15;still.add(bastion);
    for(let i=0;i<6;i++){
     box(still,metal,side*13,(i-2.5)*5.2,-5.5,4.8,4.5,4.5);
     windows(still,light,side*13,(i-2.5)*5.2,-3.1,6);
    }
    const door=joint('floodgate',side,side*12,0,-7);
    box(door,metal,-side*5,0,0,10,15,2.8);
    panels(door,dark,trim,-side*5,0,1.5,9.5,14,3,7);
    for(let i=0;i<4;i++)beam(door,trim,[-side*9,-6+i*4,2],[-side,-4+i*4,2],.18);
   }
  }else if(act===1){ // A 58 m carrier, complete with island, catapults and elevators.
   hull(still,24,58,-12);
   panels(still,metal,dark,-2,-1,-8.55,15,49,4,14);
   for(const side of[-1,1]){
    box(still,trim,side*9.6,-4,-8.35,.12,39,.10);
    for(let i=0;i<17;i++)box(still,light,side*9.7,-23+i*2.8,-8.18,.19,.32,.12);
    engine(still,side*7,-29,-10,1.5);
   }
   box(still,dark,5.6,7,-6,5.2,14,5.2);
   box(still,metal,5.2,9,-3.5,5.8,8,1.5);
   windows(still,light,5.2,6,-2.65,9);
   const radar=joint('radar',0,5.7,11,-2.3);
   beam(radar,trim,[0,-1,-1],[0,1,3],.20);
   const dish=new T.Mesh(new T.SphereGeometry(2.6,28,10,0,Math.PI*2,0,Math.PI*.47),metal);dish.rotation.x=Math.PI/2;dish.scale.z=.5;radar.add(dish);
   ring(radar,trim,0,0,.12,2.58,.12);
   for(let i=0;i<3;i++){
    const lift=joint('deck-lift',i,-4+(i%2)*8,-12+i*12,-8);
    box(lift,dark,0,0,0,5.3,7.5,1.2);panels(lift,trim,metal,0,0,.7,5,7,2,4);
    const jet=solid(lift,metal,[[0,2],[-1.6,-1],[-.5,-.55],[0,-2],[.5,-.55],[1.6,-1]],.8,.32);
    box(jet,dark,0,.2,.6,.32,1.4,.35);
   }
  }else{ // Long pressure hull emerges and rolls, with water breaking around it.
   const sub=joint('sub-rise',0,0,0,-12);
   const pressure=new T.Mesh(new T.SphereGeometry(1,40,20),dark);pressure.scale.set(6.8,27,4.8);sub.add(pressure);
   box(sub,metal,0,-1,3.6,7.2,32,1.8);panels(sub,metal,trim,0,-1,4.6,6.5,29,3,10);
   for(let i=0;i<9;i++){const r=ring(sub,trim,0,-17+i*4.2,0,5.9,.13);r.rotation.x=Math.PI/2;r.scale.y=.75;}
   box(sub,dark,0,6,6.0,3.4,9,3.6);windows(sub,light,0,3.2,7.9,5);
   for(const side of[-1,1])solid(sub,metal,[[side*3,7],[side*11,2],[side*10,-1],[side*3,1]],1,1.2);
   engine(sub,0,-26,0,2.1);
  }
 }else if(stage===2){
  if(act===0){
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a)*14,y=Math.sin(a)*14;
    const block=box(still,dark,x,y,-9,7,12,7);block.rotation.z=a;
    const node=joint('iris',i,Math.cos(a)*8,Math.sin(a)*8,-6);
    node.rotation.z=a;joints.at(-1)!.rotation.copy(node.rotation);
    solid(node,metal,[[-2,-7],[3,-5],[3,5],[0,8],[-3,5]],-1,2.6);
    panels(node,trim,dark,0,0,1.8,4.4,9,2,5);
    box(node,light,-2,0,2,.15,10,.12);
   }
   ring(still,trim,0,0,-6.5,14,.5);ring(still,light,0,0,-6.4,13.1,.12);
  }else if(act===1){
   for(const side of[-1,1]){
    box(still,dark,side*13,0,-13,10,46,18);
    panels(still,metal,trim,side*13,0,-3.9,9,44,3,15);
    for(let k=0;k<8;k++){windows(still,light,side*13,-20+k*5.7,-3.7,12);box(still,trim,side*9, -20+k*5.7,-5,1.8,1.4,4);}
   }
   const lift=joint('elevator',0,0,0,-11);
   box(lift,dark,0,0,0,16,18,3);panels(lift,metal,trim,0,0,1.6,15,17,5,7);
   for(const side of[-1,1])box(lift,light,side*7,0,1.9,.12,14,.12);
   for(let i=0;i<4;i++)box(still,trim,(i-1.5)*5,19,-7,1,10,6);
  }else{
   for(const side of[-1,1]){
    const wing=joint('bastion',side,side*8,0,-8);
    hull(wing,14,35,-4);panels(wing,metal,trim,0,0,-.55,10,29,4,10);
    for(let i=0;i<4;i++)cylinder(wing,trim,side*2,(i-1.5)*7,0,2,2);
    box(wing,light,-side*4,0,.8,.22,25,.2);
   }
   cylinder(still,dark,0,0,-10,8,8);ring(still,light,0,0,-5.8,5.7,.30);
   cylinder(still,metal,0,0,-7,4.5,4);cylinder(still,light,0,0,-4.9,2.2,.2);
  }
 }else if(stage===3){
  // A real, thick canyon wall, with stratified fractures and tilted summits.
  for(const side of[-1,1])for(let i=0;i<5;i++){
   const ice=joint(act===1?'avalanche':'ice-fault',i+(side>0?5:0),side*(12+(i%2)*2),(i-2)*8,-10);
   solid(ice,i%2?metal:natural,[[-5,-5],[3,-6],[5,3],[1,8],[-4,5]],-5,9+(i%3));
   solid(ice,trim,[[-4,-3],[1,-5],[3,2],[-1,5],[-4,3]],5+(i%3),.45);
   for(let j=0;j<3;j++)beam(ice,metal,[-4,-3+j*2,5],[2,1+j*2,5],.065);
  }
  if(act===0){for(let i=0;i<6;i++){const shard=joint('ice-split',i,(i-2.5)*2.3,0,-6);rock(shard,metal,0,0,0,2,7,4,17+i,1);}}
  else if(act===1){
   for(let i=0;i<8;i++){const shard=joint('falling-ice',i,(i-3.5)*2.9,10+(i%3)*3,-7);rock(shard,i%3?metal:trim,0,0,0,2.1,5+(i%3),2.4,i+24,1);}
  }else{
   hull(still,12,30,-13);panels(still,metal,dark,0,0,-9.55,9,25,3,9);
   for(let i=0;i<3;i++){
    const dome=joint('observatory',i,(i%2?1:-1)*3,-9+i*9,-8);
    const shell=new T.Mesh(new T.SphereGeometry(3.5,24,12,0,Math.PI*2,0,Math.PI*.6),trim);shell.rotation.x=Math.PI/2;dome.add(shell);
    cylinder(dome,dark,0,0,0,3.7,1);box(dome,dark,0,0,2.8,.50,5.5,.3);
    box(dome,light,0,-2.2,2.9,.35,.9,.2);
   }
  }
 }else if(stage===4){
  for(const side of[-1,1]){
   solid(still,dark,[[side*8,-22],[side*19,-19],[side*20,19],[side*9,22]],-15,9);
   for(let i=0;i<5;i++){
    const x=side*(12+(i%2)*2),y=(i-2)*8;
    box(still,metal,x,y,-5,5,6.5,4);
    pipe(still,natural,[[x,y-5,-3],[x-side*2,y,-1],[x+side*1,y+5,-2]],.58);
    rock(still,natural,x+side*2,y+2,-4,4,3,2,i+stage);
   }
  }
  if(act===0){
   for(let i=0;i<5;i++){
    const root=joint('root-arch',i,(i-2)*4,1,-6);
    pipe(root,natural,[[-4,-12,-4],[-6,-3,1],[-2,5,3],[4,11,0]],1.3-(i%2)*.3);
    pipe(root,metal,[[-4,-11,-3],[-4,-2,2],[0,6,3]],.28);
   }
  }else if(act===1){ // Monumental carved guardian lifts from its stepped sanctuary.
   for(let i=0;i<5;i++)box(still,i%2?dark:metal,0,-10+i*3,-10+i*.8,22-i*2,11,2.5);
   const guardian=joint('guardian',0,0,3,-7);
   solid(guardian,metal,[[-5,-10],[-8,-3],[-6,8],[-3,12],[3,12],[6,8],[8,-3],[5,-10]],-3,5);
   solid(guardian,trim,[[-4,-5],[-5,4],[-3,8],[3,8],[5,4],[4,-5],[0,-8]],2,1.4);
   for(const side of[-1,1]){
    const brow=box(guardian,dark,side*2.5,3,3.7,4,.7,.7);brow.rotation.z=side*.16;
    box(guardian,light,side*2.4,2.7,4,2.6,.18,.16);
    pipe(guardian,natural,[[side*5,-8,2],[side*7,1,2],[side*4,9,3]],.65);
   }
   solid(guardian,dark,[[-1,2],[1,2],[1.4,-3],[0,-4],[-1.4,-3]],3.5,1.5);
   box(guardian,dark,0,-5.3,3.6,4.2,.55,.5);
   for(let i=0;i<5;i++)box(guardian,trim,(i-2)*2.2,10+(2-Math.abs(i-2))*1.3,1.5,1.4,7,.9);
  }else{
   for(let i=0;i<7;i++){
    const span=joint('bridge-fall',i,0,(i-3)*4,-6);
    box(span,metal,0,0,0,22,3.8,3.8);panels(span,trim,dark,0,0,2,19,3,6,1);
    for(const side of[-1,1])box(span,dark,side*9,0,2.6,1.8,4,2.5);
    pipe(span,natural,[[-10,-1,2],[-3,0,2.4],[4,1,2.2],[10,1,2]],.22);
   }
  }
 }else{
  if(act===0){
   for(let i=0;i<10;i++){
    const a=i*Math.PI/5,crust=joint('volcanic-fault',i,Math.cos(a)*12,Math.sin(a)*15,-9);
    rock(crust,i%2?dark:natural,0,0,0,5.5,6.5,5,i+52);
    pipe(crust,light,[[-2,-4,3],[0,-1,4],[2,1,3],[1,4,3]],.16);
   }
   cylinder(still,dark,0,0,-13,12,4);cylinder(still,light,0,0,-10.8,9,.2);
   for(let i=0;i<5;i++){const vent=joint('magma-jet',i,(i-2)*3,1,-9,secondary);cylinder(vent,light,0,0,0,.38,11,.7,9);}
  }else if(act===1){
   for(const side of[-1,1]){
    box(still,dark,side*13,0,-10,7,38,10);panels(still,metal,trim,side*13,0,-4.9,6,35,2,12);
    for(let i=0;i<7;i++)box(still,light,side*13,-15+i*5,-4.7,3.8,.16,.1);
    pipe(still,trim,[[side*11,-18,-6],[side*10,-10,-4],[side*11,8,-4],[side*11,18,-6]],.6);
   }
   box(still,metal,0,17,-8,25,5,7);panels(still,trim,dark,0,17,-4.4,23,4,8,1);
   for(let i=0;i<3;i++){
    const ram=joint('hammer',i,(i-1)*7,3,-6);
    box(ram,trim,0,5,0,2.4,15,2.6);box(ram,dark,0,8,0,4.5,8,4);
    box(ram,metal,0,-4,0,6.5,5,4.6);panels(ram,trim,dark,0,-4,2.4,6,4,3,2);
    box(ram,light,0,-6,2.5,4.2,.20,.12);
    box(still,dark,(i-1)*7,-13,-8,6.8,6,5);box(still,light,(i-1)*7,-11,-5.4,5,1.6,.3);
   }
  }else{
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,node=joint('reactor-petal',i,Math.cos(a)*10,Math.sin(a)*12,-8);
    node.rotation.z=a;joints.at(-1)!.rotation.copy(node.rotation);
    box(node,dark,0,0,0,5,11,5);panels(node,metal,trim,0,0,2.6,4.4,10,2,5);
    box(node,light,0,0,2.8,.45,8,.2);
   }
   const pot=joint('crucible',0,0,0,-10,secondary);
   cylinder(pot,dark,0,0,0,7,5,5.2);ring(pot,trim,0,0,2.6,7,.42);
   cylinder(pot,light,0,0,2.7,6.4,.20);
   for(let i=0;i<4;i++)beam(still,trim,[-16,-12+i*8,-7],[-8,-8+i*8,-6],.48);
  }
 }
 bakeRigid(still);
 for(const j of joints)bakeRigid(j.node);
 for(const mat of materials){mat.userData.filmColor=mat.color.clone();mat.userData.filmEmission=mat.emissiveIntensity;}
 for(const group of [still,moving,secondary])group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 return {still,moving,secondary,materials,joints,span:stage===1&&act===1?58:44};
}

export function animateEpicSet(set:EpicSet,stage:number,act:number,p:Pose){
 const a=p.action,f=p.fallout,t=p.t;
 for(const j of set.joints){
  const n=j.node,i=j.index,side=i<0?-1:i%2?1:-1;
  n.position.copy(j.position);n.rotation.copy(j.rotation);n.scale.setScalar(1);
  switch(j.role){
   case 'fault':n.position.x+=i*f*6;n.rotation.y=i*f*.18;break;
   case 'fracture':n.position.x+=side*f*(5+i);n.position.y-=f*(i+2);n.rotation.z=side*f*.85;n.position.z-=f*5;break;
   case 'claw':n.rotation.z=i*(.34*(1-a)-.13*a+.35*f);n.position.y-=a*4;break;
   case 'cutter':n.rotation.z=t*.36+a*1.8;break;
   case 'ore':n.scale.setScalar(1-f*.55);n.rotation.y=t*.16;n.position.y-=f*5;break;
   case 'ring-break':n.position.x*=1+f*.52;n.position.y*=1+f*.42;n.rotation.x=side*f*.65;n.rotation.z+=side*f*.45;n.position.z-=f*5;break;
   case 'floodgate':n.rotation.y=i*a*1.05;n.rotation.z=i*a*.16;break;
   case 'radar':n.rotation.y=-.55+a*1.4;n.rotation.z=-.25+t*.07;break;
   case 'deck-lift':n.position.z+=(a*3-3)*(1-i*.12);break;
   case 'sub-rise':n.position.z+=a*8;n.rotation.y=-.25+a*.45;n.position.y+=a*8;break;
   case 'iris':n.position.x*=1+a*.62;n.position.y*=1+a*.62;n.rotation.z+=a*.7;break;
   case 'elevator':n.position.z+=a*7;n.position.y+=a*5;break;
   case 'bastion':n.rotation.y=i*f*.75;n.rotation.z=i*f*.32;n.position.x+=i*f*5;break;
   case 'ice-fault':n.position.x+=(j.position.x>0?1:-1)*a*(2+(i%3));n.rotation.y=side*a*.12;break;
   case 'avalanche':n.rotation.x=f*(.16+(i%3)*.12);n.position.y-=f*(i%3)*4;n.position.x+=side*f*3;break;
   case 'ice-split':n.position.x+=side*f*6;n.position.z-=f*(3+i);n.rotation.z=side*f*.5;break;
   case 'falling-ice':{const drop=ease((t-4.8-i*.12)/4);n.position.y-=drop*(17+i);n.position.x+=side*drop*5;n.position.z-=drop*8;n.rotation.set(drop*1.1,side*drop*.7,side*drop*.8);break;}
   case 'observatory':n.rotation.y=side*a*.5;n.rotation.z=-.4+a*.8;break;
   case 'root-arch':n.position.z+=a*4;n.rotation.y=side*a*.25;n.rotation.z=side*a*.27;break;
   case 'guardian':n.position.z+=a*6;n.rotation.x=-.25*(1-a);n.rotation.z=.12*(1-a);break;
   case 'bridge-fall':{const drop=ease((t-5.6-i*.16)/3.5);n.position.z-=drop*(7+i);n.rotation.x=drop*(.3+i*.07);n.rotation.y=side*drop*.22;break;}
   case 'volcanic-fault':n.position.x*=1+f*.18;n.position.z+=a*(i%3)*1.5;n.rotation.z=side*f*.28;break;
   case 'magma-jet':n.scale.set(.7+f,1,Math.max(.01,Math.sin(a*Math.PI*.87)*1.6));n.position.z+=a*2;break;
   case 'hammer':{const strike=ease((t-4.1-i*.18)/1.7);n.position.y+=5-strike*13+ease((t-7.4-i*.14)/2.6)*5;break;}
   case 'reactor-petal':n.position.x*=1+f*.35;n.position.y*=1+f*.35;n.rotation.y=side*f*.7;break;
   case 'crucible':n.rotation.x=a*.3;n.rotation.z=f*.62;n.position.y-=f*4;break;
  }
 }
}
