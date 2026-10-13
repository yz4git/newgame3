import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {worldClock} from './motion.ts';
import {flightFrame,flightCentre,type FlightFrame} from './flight-route.ts';
import {cinematicBox,weatheredRock} from './cinematic-detail.ts';
import {shadeSolid,flowSurface} from './physical-surface.ts';

const COLOURS=[
 [0x26313d,0x566172,0x81919e,0x263d58,0x526074,0xd1a376],
 [0x173d50,0x466779,0x8cabb9,0x224a5a,0x326b83,0x91c6d0],
 [0x1e2c40,0x516577,0x9caaad,0x25374b,0x294461,0xb69c79],
 [0x345b72,0x628d9f,0xb7cdd0,0x285878,0x4e8094,0xa0c8d1],
 [0x233d32,0x596852,0x949277,0x284636,0x386554,0xb7b192],
 [0x3b2927,0x62534b,0x9e8770,0x342524,0x573329,0xce854b]
] as const;
const dummy=new T.Object3D(),a=new T.Vector3(),b=new T.Vector3(),up=new T.Vector3(0,1,0);
const surfaceSample={height:0,dx:0,dy:0};
const noise=(n:number)=>{const x=Math.sin(n*127.13+17.7)*43758.5453;return x-Math.floor(x);};
type Instance={x:number;y:number;z:number;sx:number;sy:number;sz:number;rz:number;color:number;rx?:number;quaternion?:T.Quaternion};
type Batch={geometry:T.BufferGeometry;material:T.MeshStandardMaterial;items:Instance[];mesh?:T.InstancedMesh};

/** Finite landscapes attach every district to a real landmass. Their path
 * bends through six authored worlds; nothing wraps into repeated side rails. */
export class FlightWorlds3D{
 readonly root=new T.Group();
 private stage=-1;private batches:Batch[]=[];private surfaces:T.Mesh[]=[];
 private detailInstances=0;
 private frame:FlightFrame=flightFrame(0,0);private triangles=0;private instances=0;
 private cameraPressure=0;private lastClock=NaN;
 constructor(){this.root.name='continuous-3d-flight-world';}
 private setStage(stage:number){
  if(this.stage===stage)return;this.stage=stage;this.lastClock=NaN;
  this.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  this.root.clear();this.batches=[];this.surfaces=[];
  const c=COLOURS[stage],length=STAGES[stage].duration*4.4;
  const batch=(geometry:T.BufferGeometry,color:number,metalness=.35,roughness=.64)=>{
   const value:Batch={geometry:shadeSolid(geometry),material:new T.MeshStandardMaterial({color,metalness,roughness,vertexColors:true}),items:[]};this.batches.push(value);return value;
  };
  const armor=batch(cinematicBox(1,1,1),0xffffff,.50,.57);
  const rocks=batch(weatheredRock(stage*7+3,1),0xffffff,.04,stage===3?.49:.91);
  const columns=batch(new T.CylinderGeometry(.85,1,1,10),0xffffff,.52,.48);
  const crowns=batch(weatheredRock(stage*13+9,1),0xffffff,.06,.90);
  const lamps=batch(new T.BoxGeometry(1,1,1),c[5],.15,.55);
  lamps.material.emissive.setHex(c[5]);lamps.material.emissiveIntensity=.34;
  // One shared detail batch serves facade recesses, roof equipment, deck
  // seams and carved stone. A thousand fittings cost one additional draw.
  const fittings=batch(new T.BoxGeometry(1,1,1),0xffffff,stage===4?.07:.62,.48);
  const add=(set:Batch,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,rz=0,rx=0)=>set.items.push({x,y,z,sx,sy,sz,color,rz,rx});
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number=c[1],rz=0)=>add(armor,x,y,z,w,h,d,color,rz);
  const fit=(x:number,y:number,z:number,w:number,h:number,d:number,color:number=c[1],rz=0)=>add(fittings,x,y,z,w,h,d,color,rz);
  const beam=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,width:number,color:number=c[2])=>{
   a.set(x1,y1,z1);b.set(x2,y2,z2);const height=a.distanceTo(b);
   const q=new T.Quaternion().setFromUnitVectors(up,b.sub(a).normalize());
   armor.items.push({x:(x1+x2)/2,y:(y1+y2)/2,z:(z1+z2)/2,sx:width,sy:height,sz:width,rz:0,color,quaternion:q});
  };
  const building=(x:number,y:number,w:number,h:number,height:number,seed:number)=>{
   const roof=-37+height,style=seed%3;
   box(x,y,-37+height/2,w,h,height,c[0]);
   box(x,y,roof+.42,w+.36,h+.38,.84,c[1]);
   if(stage===4){
    // Sanctuary towers use carved buttresses, recessed doors and layered
    // lintels rather than industrial vents or illuminated office windows.
    for(const side of[-1,1]){box(x+side*w*.37,y,-37+height*.5,w*.20,h+.6,height*.9,c[2]);fit(x+side*w*.35,y,roof+.88,w*.13,h*.85,.10,c[0]);}
    fit(x,y-h*.5-.045,-37+height*.39,w*.32,.10,height*.61,c[0]);
    for(let tier=0;tier<3;tier++)box(x,y,roof+.85+tier*.65,w*(.95-tier*.2),h*(.9-tier*.2),.55,tier%2?c[1]:c[2]);
    return;
   }
   // Glazing sits inside projecting mullions and floor ledges. Sides remain
   // readable during the authored banks, not only from straight overhead.
   const floors=Math.min(4,Math.max(2,Math.floor(height/4)));
   fit(x,y-h*.5-.035,-37+height*.53,w*.77,.08,height*.74,c[0]);
   for(let floor=0;floor<floors;floor++){
    const z=-36+height*(floor+1)/(floors+1);
    fit(x,y-h*.5-.11,z,w*.91,.27,.13,c[2]);
    for(let column=0;column<3;column++)add(lamps,x+(column-1)*w*.24,y-h*.5-.088,z+.55,w*.14,.09,.32,c[5]);
    if(style!==1)for(const side of[-1,1])fit(x+side*(w*.5+.035),y,z,.10,h*.70,.22,c[1]);
   }
   for(const side of[-1,1])fit(x+side*w*.42,y-h*.5-.08,-37+height*.52,.16,.22,height*.91,c[2]);
   // A raised inset roof, a ventilation bank, service hatch and parapets.
   fit(x,y,roof+.86,w*.84,h*.84,.08,c[0]);
   for(const side of[-1,1])fit(x+side*w*.46,y,roof+1,.14,h*.89,.36,c[2]);
   const vx=x-w*.20,vy=y+h*.12;
   box(vx,vy,roof+1.20,w*.44,h*.40,.75,c[1]);
   for(let i=0;i<4;i++)fit(vx+(i-1.5)*w*.085,vy,roof+1.60,w*.045,h*.29,.10,c[0]);
   fit(x+w*.22,y-h*.23,roof+.94,w*.27,h*.20,.16,c[2]);
   fit(x+w*.22,y-h*.23,roof+1.04,w*.17,h*.12,.06,c[0]);
   if(style===0){
    add(columns,x+w*.28,y+h*.25,roof+1.5,w*.13,1.8,w*.13,c[2],0,Math.PI/2);
    beam(x+w*.27,y+h*.26,roof+2.5,x+w*.27,y+h*.26,roof+4,.11,c[2]);
   }else if(style===1){
    box(x+w*.34,y+h*.21,roof+1.6,w*.19,h*.20,2.3,c[0]);
    for(let i=0;i<3;i++)fit(x+w*.34,y+h*.21,roof+1+(i*.6),w*.23,h*.24,.10,c[2]);
   }
  };
  const deckDetail=(x:number,y:number,z:number,w:number,h:number)=>{
   for(let row=0;row<4;row++)for(let column=0;column<3;column++){
    const xx=x+(column-1)*w*.25,yy=y+(row-1.5)*h*.22;
    fit(xx,yy,z,w*.23,h*.20,.08,(row+column)%3?c[1]:c[0]);
   }
   for(const side of[-1,1])for(let i=0;i<6;i++)fit(x+side*w*.46,y+(i-2.5)*h*.13,z+.08,.19,h*.08,.07,c[2]);
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
    const color=new T.Color(stage===3?c[ix>3?2:1]:stage===4?c[ix>4?3:1]:c[0]);
    color.lerp(new T.Color(c[1]),noise(ix*.6+iy*.21)*.40).multiplyScalar(.84+noise(ix+iy*2.6)*.22);colors.push(color.r,color.g,color.b);
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
  if(stage===2){
   // A recessed, curved concourse connects the city districts; the old
   // foreground planet must not cover the space the player is flying through.
   const vertices:number[]=[],indices:number[]=[];
   for(let row=0;row<=80;row++)for(let column=0;column<=8;column++){
    const y=-85+(length+190)*row/80;
    vertices.push(flightCentre(stage,y)-12+column*3,y,-42+(column%2)*.18);
   }
   for(let row=0;row<80;row++)for(let column=0;column<8;column++){
    const n=row*9+column;indices.push(n,n+9,n+1,n+1,n+9,n+10);
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const deck=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x304453,metalness:.45,roughness:.61,side:T.DoubleSide}));deck.name='recessed-curved-citadel-concourse';deck.receiveShadow=true;this.root.add(deck);
  }
  if(stage===1||stage===3||stage===4||stage===5){
   const geometry=new T.PlaneGeometry(205,length+205,40,120);geometry.translate(0,length/2,-48);
   const positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3);
   const deep=new T.Color(stage===5?0x76260d:c[4]),shallow=new T.Color(stage===5?0xe66d1d:stage===1?0x73a6ad:stage===3?0x81b1c6:0x527b65);
   for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),vein=Math.sin(x*.11+Math.sin(y*.055)*2.1)*Math.sin(y*.17+x*.035);
    const color=deep.clone().lerp(shallow,Math.max(0,vein)*(stage===5?.86:.42));colors.set([color.r,color.g,color.b],i*3);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));
   const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:stage===1?.68:stage===5?.12:.26,roughness:stage===1?.24:stage===3?.31:.41,side:T.DoubleSide,
    emissive:stage===5?0xa1320b:0,emissiveIntensity:stage===5?.35:0});
   const mesh=new T.Mesh(geometry,material);mesh.name='deep-continuous-river-surface';mesh.receiveShadow=true;this.root.add(mesh);this.surfaces.push(mesh);
  }
  // Districts have different sizes, setbacks, orientation and elevation.
  for(let chapter=0;chapter<7;chapter++){
   const y=18+chapter*(length-25)/7,centre=flightCentre(stage,y),side=chapter%2?-1:1;
   const x=centre+side*(24+(chapter%3)*7);
   if(stage===0){
    for(let i=0;i<8;i++){const xx=x+(noise(i+chapter*11)-.5)*23,yy=y+(noise(i*7+chapter)-.5)*24;add(rocks,xx,yy,-24,7+noise(i)*5,8+noise(i+3)*7,9,c[1],i*.83);}
    box(x,y,-24,15,30,3,c[0],side*.21);deckDetail(x,y,-22.43,13,27);
    for(let i=0;i<3;i++)building(x+(i-1)*5,y-7+i*7,4.2,7,5+i*3,chapter+i);
    beam(x-9,y-12,-19,x+9,y+11,-15,.6);
    for(let i=0;i<3;i++)add(columns,x+side*7,y-7+i*7,-21,2.6,5,2.6,c[2],0,Math.PI/2);
   }else if(stage===1){
    box(x,y,-39,24,36,9,c[0]);box(x,y,-34,23,35,1,c[1]);deckDetail(x,y,-33.44,21,33);
    for(let i=0;i<6;i++)building(x+(i%3-1)*6.5,y+(Math.floor(i/3)-.5)*14,4.5,8,5+noise(i+chapter*17)*10,i+chapter);
    const dock=x-side*19;box(dock,y,-36,18,4,3,c[1]);box(dock-side*5,y+12,-39,9,26,5,c[0],side*.1);box(dock-side*5,y+10,-35.9,8,23,1.2,c[2],side*.1);
    box(dock-side*4,y+14,-33.4,3.2,7,4,c[1]);
    for(let i=0;i<3;i++){
     const yy=y-12+i*10;beam(x-side*8,yy,-33,x-side*17,yy,-19,.55,c[2]);
     beam(x-side*17,yy,-19,x-side*22,yy+1,-20,.24,c[2]);beam(x-side*21,yy+1,-20,x-side*21,yy+1,-31,.08,c[0]);
     box(x+side*7,yy,-31.8,3.7,5.2,2.8,i%2?c[1]:c[3]);
     for(let rib=0;rib<4;rib++)fit(x+side*7+(rib-1.5)*.75,yy,-30.34,.13,4.8,.10,c[2]);
    }
   }else if(stage===2){
    box(x,y,-38,27,43,5,c[0],side*.12);deckDetail(x,y,-35.43,24,38);
    box(centre,y+3,-40.7,20,28,.8,c[1],side*.07);
    box(centre+side*8,y-8,-40.15,2,21,.4,c[0],side*.22);
    for(let i=0;i<9;i++){const xx=x+(i%3-1)*7.3,yy=y+(Math.floor(i/3)-1)*11;building(xx,yy,4+noise(i+chapter)*2,7,7+noise(i*3+chapter)*16,i+chapter);}
    box(centre,y+17,-37,44,5,4,c[1],side*.11);
    deckDetail(centre,y+3,-40.22,18,25);
    for(let i=0;i<4;i++){
     const xx=centre+(i-1.5)*4.4;fit(xx,y+17,-34.88,3.9,3.7,.13,c[0]);
     beam(xx-1.8,y+15,-37,xx+1.8,y+19,-34.8,.15,c[2]);
    }
    beam(x,y-13,-21,x-side*19,y+17,-30,1.0);
   }else if(stage===3){
    for(let i=0;i<9;i++){
     const xx=x+(noise(i+chapter*13)-.5)*23,yy=y+(noise(i*3+chapter*7)-.5)*30,height=11+noise(i+chapter)*8;
     add(rocks,xx,yy,-24,6,9,height,i%3?c[1]:c[2],i*.77);
     for(let crack=0;crack<2;crack++)beam(xx-3,yy-3+crack*4,-24+height*.55,xx+2,yy+crack*4,-24+height*.83,.09,c[0]);
    }
    if(chapter%2===1){box(x,y,-20,11,18,2,c[2]);building(x,y,7,13,12,chapter);add(crowns,x,y,-10,6,8,4,c[2]);}
   }else if(stage===4){
    for(let i=0;i<14;i++){
     const xx=x+(noise(i*5+chapter)-.5)*32,yy=y+(noise(i+chapter*19)-.5)*39,height=7+noise(i+4)*8;
     add(columns,xx,yy,-34+height/2,.72,height,.72,c[0],0,Math.PI/2);
     add(crowns,xx,yy,-34+height,3.8+noise(i)*2,4.5+noise(i+2)*2,3.3,i%3===0?c[1]:c[3],i*.52);
     add(crowns,xx+2.4,yy+1.7,-35+height,2.8,3.2,2.4,c[3],i*.83);
     beam(xx,yy,-34+height*.35,xx+2.2,yy+1.7,-35+height,.23,c[1]);
    }
    if(chapter%2===0){for(let tier=0;tier<4;tier++)box(x-side*9,y,-35+tier*2.4,18-tier*3,23-tier*4,2.4,tier%2?c[2]:c[1]);building(x-side*9,y+1,5,7,14,chapter);
     for(let step=0;step<7;step++)fit(x-side*9,y-15+step*.7,-34+step*.45,5,1.1,.6,c[2]);
    }
    beam(centre-18,y+14,-28,centre+19,y+5,-28,3.1,c[1]);
   }else{
    box(x,y,-36,27,38,5,c[0]);deckDetail(x,y,-33.43,24,35);
    for(let i=0;i<5;i++){const yy=y+(i-2)*7;building(x+(i%2?6:-6),yy,7,5,8+noise(i+chapter)*7,i);add(columns,x-side*12,yy,-25,3.3,14,3.3,c[1],0,Math.PI/2);}
    beam(centre-23,y-8,-28,centre+26,y+8,-23,1.9,c[2]);
    for(let i=0;i<5;i++){
     const yy=y+(i-2)*6.2;fit(x,yy,-32.88,3.2,4.9,.15,c[0]);add(lamps,x,yy,-32.76,1.8,3.2,.09,c[5]);
     for(const side of[-1,1])beam(x+side*2,yy-2.5,-32.7,x+side*2,yy+2.5,-32.7,.16,c[2]);
    }
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
  this.instances=0;this.triangles=0;this.detailInstances=fittings.items.length;
  for(const [i,set]of this.batches.entries()){
   const mesh=new T.InstancedMesh(set.geometry,set.material,Math.max(1,set.items.length));mesh.count=set.items.length;mesh.name='flight-world-batch-'+i;mesh.frustumCulled=false;mesh.receiveShadow=true;
   mesh.castShadow=set===armor||set===rocks||set===columns||set===crowns;
   for(let j=0;j<set.items.length;j++){
    const p=set.items[j];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx??0,0,p.rz);if(p.quaternion)dummy.quaternion.copy(p.quaternion);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);mesh.setColorAt(j,new T.Color(p.color));
   }
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;set.mesh=mesh;this.root.add(mesh);this.instances+=mesh.count;
   this.triangles+=(set.geometry.index?.count??set.geometry.getAttribute('position').count)/3*mesh.count;
  }
  for(const child of this.root.children)if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh))this.triangles+=(child.geometry.index?.count??child.geometry.getAttribute('position').count)/3;
 }
 draw(g:Game,reduced=false,performance=false,pressure=0,dt=0){
  this.setStage(g.stage);
  // The final district holds through a long boss fight; escape resumes travel.
  const clock=g.state==='title'?g.visualTime*.35:Math.min(g.time,STAGES[g.stage].duration)+Math.max(0,worldClock(g)-g.time);
  const active=g.mode==='campaign'||g.state==='title';
  // Dense salvos should ease the lens back, never snap it to another angle.
  // Pausing retains the last pressure as well as the last route position.
  if(!Number.isFinite(this.lastClock)||Math.abs(clock-this.lastClock)>2)this.cameraPressure=pressure;
  else if(g.state!=='paused'&&dt>0)this.cameraPressure+=(pressure-this.cameraPressure)*(1-Math.exp(-dt*2.5));
  this.lastClock=clock;
  this.frame=flightFrame(g.stage,clock,this.cameraPressure,reduced,active);this.root.visible=active&&g.state!=='result';
  if(!this.root.visible)return;
  this.root.position.set(-this.frame.centre,-this.frame.distance,0);this.root.rotation.z=0;
  // Rotate about the flight position, not the centre of the kilometre-long
  // map. This turns the terrain beneath the player without moving hitboxes.
  const turn=this.frame.bank,cos=Math.cos(turn),sin=Math.sin(turn);
  this.root.rotation.z=turn;
  this.root.position.set(-this.frame.centre*cos+this.frame.distance*sin,-this.frame.centre*sin-this.frame.distance*cos,0);
  for(const mesh of this.surfaces){
   const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal'),base=-48;
   for(let i=0;i<positions.count;i++){
    const wave=flowSurface(positions.getX(i),positions.getY(i),clock,g.stage,reduced,surfaceSample);
    positions.setZ(i,base+wave.height);a.set(-wave.dx,-wave.dy,1).normalize();normals.setXYZ(i,a.x,a.y,a.z);
   }
   positions.needsUpdate=true;normals.needsUpdate=true;
  }
 }
 cameraFrame(){return this.frame;}
 diagnostics(){return {stage:this.stage,section:this.frame.section,progress:this.frame.progress,bank:this.frame.bank,eye:[this.frame.eyeX,this.frame.eyeY,this.frame.eyeZ],instances:this.instances,details:this.detailInstances,triangles:this.triangles,draws:this.root.children.length,finite:true,textureCards:0};}
}
