import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {worldClock} from './motion.ts';
import {flightFrame,flightCentre,type FlightFrame} from './flight-route.ts';
import {cinematicBox} from './cinematic-detail.ts';

const COLOURS=[
 [0x26313d,0x566172,0x81919e,0x263d58,0x526074,0xd1a376],
 [0x173d50,0x466779,0x8cabb9,0x224a5a,0x326b83,0x91c6d0],
 [0x1e2c40,0x516577,0x9caaad,0x25374b,0x294461,0xb69c79],
 [0x345b72,0x628d9f,0xb7cdd0,0x285878,0x4e8094,0xa0c8d1],
 [0x233d32,0x596852,0x949277,0x284636,0x386554,0xb7b192],
 [0x3b2927,0x62534b,0x9e8770,0x342524,0x573329,0xce854b]
] as const;
const dummy=new T.Object3D(),a=new T.Vector3(),b=new T.Vector3(),up=new T.Vector3(0,1,0);
const noise=(n:number)=>{const x=Math.sin(n*127.13+17.7)*43758.5453;return x-Math.floor(x);};
type Instance={x:number;y:number;z:number;sx:number;sy:number;sz:number;rz:number;color:number;rx?:number;quaternion?:T.Quaternion};
type Batch={geometry:T.BufferGeometry;material:T.MeshStandardMaterial;items:Instance[];mesh?:T.InstancedMesh};

/** Finite landscapes attach every district to a real landmass. Their path
 * bends through six authored worlds; nothing wraps into repeated side rails. */
export class FlightWorlds3D{
 readonly root=new T.Group();
 private stage=-1;private batches:Batch[]=[];private surfaces:T.Mesh[]=[];
 private frame:FlightFrame=flightFrame(0,0);private triangles=0;private instances=0;
 constructor(){this.root.name='continuous-3d-flight-world';}
 private setStage(stage:number){
  if(this.stage===stage)return;this.stage=stage;
  this.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  this.root.clear();this.batches=[];this.surfaces=[];
  const c=COLOURS[stage],length=STAGES[stage].duration*4.4;
  const batch=(geometry:T.BufferGeometry,color:number,metalness=.35,roughness=.64)=>{
   const value:Batch={geometry,material:new T.MeshStandardMaterial({color,metalness,roughness}),items:[]};this.batches.push(value);return value;
  };
  const armor=batch(cinematicBox(1,1,1),0xffffff,.50,.57);
  const rocks=batch(new T.IcosahedronGeometry(1,1),0xffffff,.04,.96);
  const columns=batch(new T.CylinderGeometry(.85,1,1,10),0xffffff,.52,.48);
  const crowns=batch(new T.IcosahedronGeometry(1,1),0xffffff,.06,.90);
  const lamps=batch(new T.BoxGeometry(1,1,1),c[5],.15,.55);
  lamps.material.emissive.setHex(c[5]);lamps.material.emissiveIntensity=.34;
  const add=(set:Batch,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,rz=0,rx=0)=>set.items.push({x,y,z,sx,sy,sz,color,rz,rx});
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number=c[1],rz=0)=>add(armor,x,y,z,w,h,d,color,rz);
  const beam=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,width:number,color:number=c[2])=>{
   a.set(x1,y1,z1);b.set(x2,y2,z2);const height=a.distanceTo(b);
   const q=new T.Quaternion().setFromUnitVectors(up,b.sub(a).normalize());
   armor.items.push({x:(x1+x2)/2,y:(y1+y2)/2,z:(z1+z2)/2,sx:width,sy:height,sz:width,rz:0,color,quaternion:q});
  };
  const building=(x:number,y:number,w:number,h:number,height:number,seed:number)=>{
   box(x,y,-37+height/2,w,h,height,c[0]);
   box(x,y,-37+height+.7,w+.7,h+.6,1.4,c[1]);
   box(x-w*.22,y+h*.13,-37+height+1.8,w*.48,h*.53,.9,c[2]);
   for(let i=0;i<3;i++)add(lamps,x+(i-1)*w*.25,y-h*.5-.03,-35+height*.62,w*.12,.09,.20,c[5]);
   if(seed%3===0)box(x+w*.40,y,-37+height*.5,.42,h*.75,height*.73,c[2]);
  };
  // Both banks are continuous, thick 3D terrain, with a curved route between
  // them. The channel is lower than the banks and all collision actors.
  for(const side of[-1,1]){
   const geometry=new T.BufferGeometry(),vertices:number[]=[],colors:number[]=[],indices:number[]=[];
   const rows=80,cols=10;
   for(let iy=0;iy<=rows;iy++)for(let ix=0;ix<=cols;ix++){
    const y=-85+(length+190)*iy/rows,edge=stage===1?23:stage===2?12:stage===4?15:12;
    const x=flightCentre(stage,y)+side*(edge+ix/cols*65);
    const relief=stage===3?9+14*noise(iy*.81+ix*9):stage===0?5+11*noise(iy+ix*13):stage===4?4+7*noise(iy*.72+ix*7):stage===5?3+8*noise(iy+ix*4):0;
    const z=-38+relief*Math.sin(ix/cols*Math.PI*.65);
    vertices.push(x,y,z);
    const color=new T.Color(stage===3?c[ix>3?2:1]:stage===4?c[ix>4?3:1]:c[ix%3?0:1]);color.multiplyScalar(.79+noise(ix+iy*2.6)*.26);colors.push(color.r,color.g,color.b);
   }
   for(let iy=0;iy<rows;iy++)for(let ix=0;ix<cols;ix++){
    const i=iy*(cols+1)+ix;indices.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);
   }
   // Vertical inner face makes the channel a real canyon/coastline.
   for(let iy=0;iy<rows;iy++){
    const i=iy*(cols+1),j=(iy+1)*(cols+1),n=vertices.length/3;
    vertices.push(vertices[i*3],vertices[i*3+1],-59,vertices[j*3],vertices[j*3+1],-59);
    const color=new T.Color(c[0]);colors.push(color.r,color.g,color.b,color.r,color.g,color.b);indices.push(i,n,j,j,n,n+1);
   }
   geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.89,metalness:stage===2?.42:.04}));mesh.receiveShadow=true;mesh.name='continuous-channel-bank-'+side;this.root.add(mesh);
  }
  if(stage===1||stage===3||stage===4||stage===5){
   const geometry=new T.PlaneGeometry(205,length+205,16,55);geometry.translate(0,length/2,-48);
   const material=new T.MeshStandardMaterial({color:c[4],metalness:stage===1?.3:.05,roughness:stage===1?.37:.68,side:T.DoubleSide,
    emissive:stage===5?0x732610:0,emissiveIntensity:stage===5?.22:0});
   const mesh=new T.Mesh(geometry,material);mesh.name='deep-continuous-river-surface';mesh.receiveShadow=true;this.root.add(mesh);this.surfaces.push(mesh);
  }
  // Districts have different sizes, setbacks, orientation and elevation.
  for(let chapter=0;chapter<7;chapter++){
   const y=18+chapter*(length-25)/7,centre=flightCentre(stage,y),side=chapter%2?-1:1;
   const x=centre+side*(24+(chapter%3)*7);
   if(stage===0){
    for(let i=0;i<8;i++){const xx=x+(noise(i+chapter*11)-.5)*23,yy=y+(noise(i*7+chapter)-.5)*24;add(rocks,xx,yy,-24,7+noise(i)*5,8+noise(i+3)*7,9,c[1],i*.83);}
    box(x,y,-24,15,30,3,c[0],side*.21);
    for(let i=0;i<3;i++)building(x+(i-1)*5,y-7+i*7,4.2,7,5+i*3,chapter+i);
    beam(x-9,y-12,-19,x+9,y+11,-15,.6);
    for(let i=0;i<3;i++)add(columns,x+side*7,y-7+i*7,-21,2.6,5,2.6,c[2],0,Math.PI/2);
   }else if(stage===1){
    box(x,y,-39,24,36,9,c[0]);box(x,y,-34,23,35,1,c[2]);
    for(let i=0;i<6;i++)building(x+(i%3-1)*6.5,y+(Math.floor(i/3)-.5)*14,4.5,8,5+noise(i+chapter*17)*10,i+chapter);
    const dock=x-side*19;box(dock,y,-36,18,4,3,c[1]);box(dock-side*5,y+12,-39,9,26,5,c[0],side*.1);box(dock-side*5,y+10,-35.9,8,23,1.2,c[2],side*.1);
    box(dock-side*4,y+14,-33.4,3.2,7,4,c[1]);
    for(let i=0;i<3;i++)beam(x-side*8,y-12+i*10,-33,x-side*17,y-12+i*10,-19,.55,c[2]);
   }else if(stage===2){
    box(x,y,-38,27,43,5,c[0],side*.12);
    for(let i=0;i<9;i++){const xx=x+(i%3-1)*7.3,yy=y+(Math.floor(i/3)-1)*11;building(xx,yy,4+noise(i+chapter)*2,7,7+noise(i*3+chapter)*16,i+chapter);}
    box(centre,y+17,-37,44,5,4,c[1],side*.11);
    beam(x,y-13,-21,x-side*19,y+17,-30,1.0);
   }else if(stage===3){
    for(let i=0;i<9;i++){const xx=x+(noise(i+chapter*13)-.5)*23,yy=y+(noise(i*3+chapter*7)-.5)*30;add(rocks,xx,yy,-24,6,9,11+noise(i+chapter)*8,i%3?c[1]:c[2],i*.77);}
    if(chapter%2===1){box(x,y,-20,11,18,2,c[2]);building(x,y,7,13,12,chapter);add(crowns,x,y,-10,6,8,4,c[2]);}
   }else if(stage===4){
    for(let i=0;i<14;i++){
     const xx=x+(noise(i*5+chapter)-.5)*32,yy=y+(noise(i+chapter*19)-.5)*39,height=7+noise(i+4)*8;
     add(columns,xx,yy,-34+height/2,.72,height,.72,c[0],0,Math.PI/2);
     add(crowns,xx,yy,-34+height,4+noise(i)*2,5+noise(i+2)*2,3.8,i%3===0?c[1]:c[3],i*.52);
    }
    if(chapter%2===0){for(let tier=0;tier<4;tier++)box(x-side*9,y,-35+tier*2.4,18-tier*3,23-tier*4,2.4,tier%2?c[2]:c[1]);building(x-side*9,y+1,5,7,14,chapter);}
    beam(centre-18,y+14,-28,centre+19,y+5,-28,3.1,c[1]);
   }else{
    box(x,y,-36,27,38,5,c[0]);
    for(let i=0;i<5;i++){const yy=y+(i-2)*7;building(x+(i%2?6:-6),yy,7,5,8+noise(i+chapter)*7,i);add(columns,x-side*12,yy,-25,3.3,14,3.3,c[1],0,Math.PI/2);}
    beam(centre-23,y-8,-28,centre+26,y+8,-23,1.9,c[2]);
    box(x,y,-33,18,31,1,c[5]);
   }
  }
  // Finite transverse structures mark changes of place, never long rails.
  for(let i=0;i<3;i++){
   const y=length*[.18,.48,.77][i],x=flightCentre(stage,y);
   if(stage===2||stage===5){
    for(const side of[-1,1]){box(x+side*18,y,-20,7,9,25,c[1]);box(x+side*18,y,-6.8,8,10,1.4,c[2]);}
    beam(x-18,y,-7,x+18,y+5,-7,1.8,c[2]);
    for(let j=0;j<5;j++)add(lamps,x+(j-2)*5,y+.4,-6.5,1.8,.22,.12,c[5]);
   }else if(stage===4){
    for(const side of[-1,1])box(x+side*17,y,-21,4,8,22,c[1]);box(x,y,-9,37,6,3,c[2],.06);
   }else if(stage===0){
    beam(x-22,y-9,-16,x+22,y+10,-13,2.8,c[0]);
   }
  }
  this.instances=0;this.triangles=0;
  for(const [i,set]of this.batches.entries()){
   const mesh=new T.InstancedMesh(set.geometry,set.material,Math.max(1,set.items.length));mesh.count=set.items.length;mesh.name='flight-world-batch-'+i;mesh.frustumCulled=false;mesh.receiveShadow=true;
   for(let j=0;j<set.items.length;j++){
    const p=set.items[j];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx??0,0,p.rz);if(p.quaternion)dummy.quaternion.copy(p.quaternion);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);mesh.setColorAt(j,new T.Color(p.color));
   }
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;set.mesh=mesh;this.root.add(mesh);this.instances+=mesh.count;
   this.triangles+=(set.geometry.index?.count??set.geometry.getAttribute('position').count)/3*mesh.count;
  }
  for(const child of this.root.children)if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh))this.triangles+=(child.geometry.index?.count??child.geometry.getAttribute('position').count)/3;
 }
 draw(g:Game,reduced=false,performance=false,pressure=0){
  this.setStage(g.stage);
  // The final district holds through a long boss fight; escape resumes travel.
  const clock=g.state==='title'?g.visualTime*.35:Math.min(g.time,STAGES[g.stage].duration)+Math.max(0,worldClock(g)-g.time);
  const active=g.mode==='campaign'||g.state==='title';
  this.frame=flightFrame(g.stage,clock,pressure,reduced,active);this.root.visible=active&&g.state!=='result';
  if(!this.root.visible)return;
  this.root.position.set(-this.frame.centre,-this.frame.distance,0);this.root.rotation.z=0;
  // Rotate about the flight position, not the centre of the kilometre-long
  // map. This turns the terrain beneath the player without moving hitboxes.
  const turn=this.frame.bank,cos=Math.cos(turn),sin=Math.sin(turn);
  this.root.rotation.z=turn;
  this.root.position.set(-this.frame.centre*cos+this.frame.distance*sin,-this.frame.centre*sin-this.frame.distance*cos,0);
  for(const mesh of this.surfaces){
   const positions=mesh.geometry.getAttribute('position'),base=-48;
   for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),motion=reduced?0:Math.sin(x*.075+y*.053-clock*.73)*.65+Math.sin(y*.12+clock*.47)*.27;
    positions.setZ(i,base+motion);
   }
   positions.needsUpdate=true;if(!performance)mesh.geometry.computeVertexNormals();
  }
 }
 cameraFrame(){return this.frame;}
 diagnostics(){return {stage:this.stage,section:this.frame.section,progress:this.frame.progress,bank:this.frame.bank,eye:[this.frame.eyeX,this.frame.eyeY,this.frame.eyeZ],instances:this.instances,triangles:this.triangles,draws:this.root.children.length,finite:true,textureCards:0};}
}
