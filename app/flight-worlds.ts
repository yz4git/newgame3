import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {worldClock} from './motion.ts';
import {flightFrame,flightCentre,type FlightFrame} from './flight-route.ts';
import {cinematicBox,weatheredRock} from './cinematic-detail.ts';
import {shadeSolid,flowSurface} from './physical-surface.ts';
import {stageTerrain,WORLD_IDENTITIES,WORLD_COLOURS} from './stage-terrain.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const dummy=new T.Object3D(),a=new T.Vector3(),b=new T.Vector3(),up=new T.Vector3(0,1,0);
const surfaceSample={height:0,dx:0,dy:0};
const noise=(n:number)=>{const x=Math.sin(n*127.13+17.7)*43758.5453;return x-Math.floor(x);};
type Instance={x:number;y:number;z:number;sx:number;sy:number;sz:number;rz:number;color:number;rx?:number;quaternion?:T.Quaternion};
type Batch={geometry:T.BufferGeometry;material:T.MeshStandardMaterial;items:Instance[];mesh?:T.InstancedMesh};

function hullGeometry(){
 const s=new T.Shape();s.moveTo(-.46,-.5);s.lineTo(.46,-.5);s.lineTo(.38,.30);s.lineTo(0,.64);s.lineTo(-.38,.30);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:.32,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:1,steps:1,curveSegments:1});g.translate(0,0,-.16);return g;
}
function canopyGeometry(){
 const parts=[[-.35,-.10,.0],[.35,.13,.12],[0,.47,-.13]].map(([x,y,z])=>{
  const g=weatheredRock(11,0);g.scale(.76,.82,.64);g.translate(x,y,z);return g;
 });
 const result=mergeGeometries(parts,false);for(const p of parts)p.dispose();if(!result)throw new Error('Canopy merge failed');return result;
}

/** Six finite physical worlds have different terrain and placement rules.
 * Their authored paths never wrap into repeated side rails. */
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
  const c=WORLD_COLOURS[stage],length=STAGES[stage].duration*4.4;
  this.root.userData.identity=WORLD_IDENTITIES[stage].id;
  const batch=(geometry:T.BufferGeometry,color:number,metalness=.35,roughness=.64)=>{
   const value:Batch={geometry:shadeSolid(geometry),material:new T.MeshStandardMaterial({color,metalness,roughness,vertexColors:true}),items:[]};this.batches.push(value);return value;
  };
  const armor=batch(cinematicBox(1,1,1),0xffffff,stage===4?.06:.64,stage===4?.92:stage===2?.38:.51);
  const rocks=batch(weatheredRock(stage*7+3,stage===3?2:1),0xffffff,.04,stage===3?.43:.91);
  const columns=batch(new T.CylinderGeometry(.85,1,1,12),0xffffff,stage===4?0:.60,stage===4?.98:.45);
  const canopy=stage===4?canopyGeometry():stage===1?hullGeometry():stage===3?new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2):weatheredRock(stage*13+9,1);
  const crowns=batch(canopy,0xffffff,stage===1?.62:.06,stage===1?.45:.90);
  const lamps=batch(new T.BoxGeometry(1,1,1),0xffffff,.15,.55);
  lamps.material.emissive.setHex(c[5]);lamps.material.emissiveIntensity=stage===2?1.15:stage===5?.65:.34;
  // One shared detail batch serves facade recesses, roof equipment, deck
  // seams and carved stone. A thousand fittings cost one additional draw.
  const fittings=batch(new T.BoxGeometry(1,1,1),0xffffff,stage===4?.07:.62,.48);
  const rings=[0,1,2,5].includes(stage)?batch(new T.TorusGeometry(1,.07,6,32),0xffffff,.68,.40):null;
  const add=(set:Batch,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,rz=0,rx=0)=>set.items.push({x,y,z,sx,sy,sz,color,rz,rx});
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number=c[1],rz=0)=>add(armor,x,y,z,w,h,d,color,rz);
  const fit=(x:number,y:number,z:number,w:number,h:number,d:number,color:number=c[1],rz=0)=>add(fittings,x,y,z,w,h,d,color,rz);
  const beam=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,width:number,color:number=c[2])=>{
   a.set(x1,y1,z1);b.set(x2,y2,z2);const height=a.distanceTo(b);
   const q=new T.Quaternion().setFromUnitVectors(up,b.sub(a).normalize());
   (stage===4||stage===5?columns:armor).items.push({x:(x1+x2)/2,y:(y1+y2)/2,z:(z1+z2)/2,sx:width,sy:height,sz:width,rz:0,color,quaternion:q});
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
  const terrain=stageTerrain(stage,length,c);
  if(terrain.meshes.length)this.root.add(...terrain.meshes);this.surfaces=terrain.surfaces;
  // Each world has its own objects and placement language. No common
  // district slab or transverse gate is repeated through all six campaigns.
  for(let chapter=0;chapter<7;chapter++){
   const y=18+chapter*(length-25)/7,centre=flightCentre(stage,y),side=chapter%2?-1:1;
   const offset=stage===0?16+(chapter%3)*5:stage===1?26+(chapter%3)*6:stage===2?[-12,14,-8,17,4,-16,8][chapter]:stage===3?15+(chapter%3)*3:stage===4?14+(chapter%3)*3:18+(chapter%3)*4;
   const x=centre+(stage===2?offset:side*offset);
   if(stage===0){
    // Orbital salvage yards: circular hubs and suspended solar wings.
    const z=-32+(chapter%3)*2;
    add(columns,x,y,z,5.5,4.8,5.5,c[0],0,Math.PI/2);
    add(rings!,x,y,z+2.6,6.0,6.0,6.0,c[2]);
    for(let arm=0;arm<4;arm++){
     const angle=arm*Math.PI/2+chapter*.19,dx=Math.cos(angle),dy=Math.sin(angle);
     beam(x+dx*3,y+dy*3,z+1,x+dx*13,y+dy*13,z+1,.38,c[2]);
     const xx=x+dx*12,yy=y+dy*12;
     box(xx,yy,z+1.3,6.2,9.6,.42,c[0],angle);
     for(let panel=0;panel<4;panel++){
      const local=(panel-1.5)*2.1;fit(xx-dy*local,yy+dx*local,z+1.58,5.6,1.84,.12,c[3],angle);
      fit(xx-dy*local,yy+dx*local,z+1.67,5.5,.06,.045,c[2],angle);
     }
    }
    if(chapter%3===1){
     add(rings!,x,y,z+6,10,10,10,c[1],chapter*.13,.64);
     for(let pod=0;pod<6;pod++){const a=pod*Math.PI/3;add(columns,x+Math.cos(a)*8,y+Math.sin(a)*8,z+2,1.6,4.8,1.6,c[2],0,Math.PI/2);}
    }
    for(let lamp=0;lamp<4;lamp++){const a=lamp*Math.PI/2;add(lamps,x+Math.cos(a)*4.8,y+Math.sin(a)*4.8,z+3.1,.65,.95,.22,c[5],a);}
   }else if(stage===1){
    // Separate islands support low maritime architecture, loading cranes and
    // breakwaters. They never become two continuous channel walls.
    box(x,y,-39,24,34,7,c[0]);box(x,y,-35,23,33,1.0,c[1]);deckDetail(x,y,-34.43,21,31);
    for(let i=0;i<3;i++)building(x+(i-1)*6.7,y+5+(i%2)*3,4.8,8.5,5+noise(i+chapter*17)*7,i+chapter);
    box(x,y-9,-33.2,15,5.3,2.2,c[2]);
    for(let i=0;i<3;i++){
     const yy=y-12+i*10;
     beam(x-side*8,yy,-34,x-side*15,yy,-20,.45,c[2]);
     beam(x-side*15,yy,-20,x-side*21,yy+1,-21,.24,c[2]);beam(x-side*20,yy+1,-21,x-side*20,yy+1,-33,.075,c[0]);
     box(x+side*7,yy,-32.0,3.6,5.1,2.8,i%2?c[1]:c[3]);
     for(let rib=0;rib<4;rib++)fit(x+side*7+(rib-1.5)*.74,yy,-30.54,.13,4.6,.10,c[2]);
    }
    add(columns,x+side*5,y+13,-24.0,3.1,2.4,3.1,c[1],0,Math.PI/2);
    add(rings!,x+side*5,y+13,-22.7,2.7,2.7,2.7,c[2],0,.46);
   }else if(stage===2){
    // The route threads through the city itself, including near-central
    // towers. Buildings belong to streets rather than a remote side island.
    for(let i=0;i<9;i++){
     const xx=x+(i%3-1)*9.0,yy=y+(Math.floor(i/3)-1)*13;
     const height=8+noise(i*3+chapter*13)*17;
     building(xx,yy,5.0+noise(i+chapter)*1.8,8.5,height,i+chapter);
     fit(xx,yy,-37.08,7.5,11,.38,c[1]);
    }
    const road=flightCentre(stage,y);
    fit(road,y,-37.84,6.8,37,.14,0x0b1120);
    for(let dash=0;dash<6;dash++)fit(road,y+(dash-2.5)*5.5,-37.74,.12,2.4,.08,c[2]);
    for(const lane of[-1,1])fit(road+lane*3.25,y,-37.72,.10,34,.08,c[1]);
    for(let sign=0;sign<3;sign++)add(lamps,x+(sign-1)*9,y+19,-24+sign*2,1.5,.17,.30,c[5]);
   }else if(stage===3){
    // Pure polar geology dominates; one scientific outpost contrasts with
    // broken ice fins instead of repeating industrial block districts.
    for(let i=0;i<9;i++){
     const xx=x+(noise(i+chapter*13)-.5)*23,yy=y+(noise(i*3+chapter*7)-.5)*33;
     add(rocks,xx,yy,-29,4.6+noise(i)*3,7+noise(i+2)*5,9+noise(i+chapter)*10,i%3?c[1]:c[2],i*.77);
     if(i%3===0){add(rocks,xx+1.2,yy+1.8,-22,3.1,5,3.4,c[2],i*.42);fit(xx,yy,-18.5,.10,4.2,.10,c[0],i*.31);}
    }
    if(chapter===2||chapter===5){
     const xx=x-side*4;add(columns,xx,y,-27,5.4,2.8,5.4,c[0],0,Math.PI/2);
     add(crowns,xx,y,-25.4,5.0,6.0,4.1,c[2]);
     beam(xx+4,y,-27,xx+4,y,-16,.16,c[1]);fit(xx+4,y,-16,.9,1.8,.12,c[0]);
    }
   }else if(stage===4){
    // Irregular multi-lobed canopies, woody limbs and submerged mangrove
    // roots establish a dense rainforest instead of the city roof silhouette.
    for(let i=0;i<22;i++){
     const xx=x+(noise(i*5+chapter)-.5)*38,yy=y+(noise(i+chapter*19)-.5)*43;
     const local=Math.abs(xx-flightCentre(stage,yy)),base=local<8?-49:-40,height=16+noise(i+4)*9;
     add(columns,xx,yy,base+height/2,.52,height,.52,c[0],0,Math.PI/2);
     add(crowns,xx,yy,base+height,3.6+noise(i)*1.8,4.0+noise(i+2)*2.0,3.6,i%4===0?0x4a703e:c[3],i*.52);
     add(crowns,xx+2.1,yy+1.4,base+height-1.5,2.5,3.0,2.8,0x315c37,i*.83);
     beam(xx,yy,base+height*.46,xx+2.4,yy+1.7,base+height-1.3,.22,c[0]);
     for(const root of[-1,1])beam(xx,yy,base+3.7,xx+root*2.1,yy+root*.8,base-1.6,.28,c[0]);
    }
    if(chapter===1||chapter===4||chapter===6){
     const xx=x-side*7;
     for(let tier=0;tier<4;tier++)box(xx,y,-37+tier*2.4,20-tier*3.4,24-tier*4.2,2.4,tier%2?c[2]:c[1]);
     building(xx,y+2,6.3,7.8,13,chapter);
     for(let step=0;step<9;step++)fit(xx,y-16+step*.74,-36+step*.40,5.6,1.2,.6,c[2]);
     for(const side of[-1,1])add(rocks,xx+side*10,y-3,-33,4.5,6.5,7,c[1],side*.44);
    }
   }else{
    // Circular thermal works sit on basalt craters: silos, radial pipework,
    // hot annular vents and tapered stacks replace square city blocks.
    const z=-36;
    add(columns,x,y,z,7.5,8.0,7.5,c[0],0,Math.PI/2);
    add(columns,x,y,z+4.3,6.1,1.0,6.1,c[1],0,Math.PI/2);
    add(rings!,x,y,z+5.0,5.8,5.8,5.8,c[2]);
    add(columns,x,y,z+5.0,3.8,.24,3.8,c[5],0,Math.PI/2);
    for(let spoke=0;spoke<8;spoke++){
     const a=spoke*Math.PI/4+chapter*.17,xx=x+Math.cos(a)*12,yy=y+Math.sin(a)*12;
     beam(x+Math.cos(a)*6,y+Math.sin(a)*6,z+2.5,xx,yy,z-2,.52,c[2]);
     add(columns,xx,yy,-32,1.6,10+(spoke%3)*2,1.6,c[spoke%2?1:0],0,Math.PI/2);
     add(lamps,xx,yy,-26,1.5,.35,.28,c[5],a);
     fit(xx,yy,-25.8,1.0,1.0,.15,c[0],a);
    }
    for(let k=0;k<3;k++){
     const yy=y-8+k*8;beam(x-side*12,yy,-35,x-side*23,yy+3,-43,.60,c[1]);
    }
   }
  }
  if(stage===0){
   // The asteroid field has true empty space between drifting rock masses.
   for(let i=0;i<92;i++){
    const y=-80+(length+175)*i/91,x=flightCentre(stage,y)+(noise(i*7.3)-.5)*94;
    const size=2.5+noise(i*11)*7.5;
    add(rocks,x,y,-37-noise(i*13)*15,size,size*(.8+noise(i)*.8),size*.8,i%5?c[1]:c[2],i*.81);
   }
   for(let i=0;i<3;i++){
    const y=length*[.17,.48,.78][i],x=flightCentre(stage,y)+(i%2?15:-13);
    add(rings!,x,y,-33,17,17,17,c[1],i*.36,.58);
    for(let j=0;j<6;j++){const a=j*Math.PI/3;box(x+Math.cos(a)*17,y+Math.sin(a)*17,-33,4.1,6.2,2.1,c[0],a);}
   }
  }else if(stage===1){
   // A finite convoy crosses open water. Actual pointed hulls and low island
   // cabins give scale; shallow geometric wakes remain part of the sea.
   for(let i=0;i<10;i++){
    const y=-60+(length+125)*i/9,x=flightCentre(stage,y)+(i%2?1:-1)*(3.0+noise(i*3)*6.2),angle=(noise(i*7)-.5)*.60;
    const cos=Math.cos(angle),sin=Math.sin(angle),w=4.2+noise(i)*2.6,h=14+noise(i+3)*7;
    add(crowns,x,y,-45,w,h,4,c[0],angle);
    const local=(xx:number,yy:number,z:number,sx:number,sy:number,sz:number,color:number)=>fit(x+xx*cos-yy*sin,y+xx*sin+yy*cos,z,sx,sy,sz,color,angle);
    local(0,0,-44.2,w*.63,h*.69,.40,c[2]);local(0,h*.12,-42.6,w*.47,h*.28,2.8,c[1]);
    for(let rib=0;rib<3;rib++)local(0,-h*.27+rib*h*.14,-43.96,w*.55,.14,.10,c[0]);
    for(const side of[-1,1]){
     const ax=x+side*w*.35*cos+h*.52*sin,ay=y+side*w*.35*sin-h*.52*cos;
     beam(ax,ay,-47.55,ax+side*2*cos+6*sin,ay+side*2*sin-6*cos,-47.55,.10,c[2]);
    }
   }
  }else if(stage===2){
   for(let i=0;i<3;i++){
    const y=length*[.18,.47,.76][i],x=flightCentre(stage,y),angle=i%2?-.22:.14;
    box(x,y,-20.3,51,4.4,1.0,c[1],angle);
    for(let j=0;j<9;j++)fit(x+(j-4)*5.3,y+(j-4)*5.3*Math.sin(angle),-19.74,4.6,3.3,.16,c[0],angle);
    for(const side of[-1,1]){
     beam(x+side*21,y+side*3,-37,x+side*21,y+side*3,-20.3,1.2,c[2]);
     beam(x+side*20,y+side*3,-20,x+side*12,y+side*2,-16,.38,c[2]);
    }
   }
  }else if(stage===4){
   for(let i=0;i<4;i++){
    const y=length*[.19,.39,.61,.81][i],x=flightCentre(stage,y)+(i%2?11:-11);
    add(rocks,x,y+4.6,-36,8.2,3.6,11,c[1],.13);
    for(const side of[-1,1])add(rocks,x+side*5,y+4.8,-38,4,4,8,c[1],side*.41);
   }
   for(let arch=0;arch<3;arch++){
    const y=length*[.15,.47,.76][arch],x=flightCentre(stage,y),points:number[][]=[];
    for(let i=0;i<=9;i++){const t=i/9;points.push([x-17+t*34,y+Math.sin(t*Math.PI)*3,-37+Math.sin(t*Math.PI)*19]);}
    for(let i=0;i<9;i++)beam(...points[i] as [number,number,number],...points[i+1] as [number,number,number],.92,c[0]);
   }
  }
  this.instances=0;this.triangles=0;this.detailInstances=fittings.items.length;
  for(const [i,set]of this.batches.entries()){
   const mesh=new T.InstancedMesh(set.geometry,set.material,Math.max(1,set.items.length));mesh.count=set.items.length;mesh.name=WORLD_IDENTITIES[stage].id+'-batch-'+i;mesh.frustumCulled=false;mesh.receiveShadow=true;
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
   const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal'),mask=mesh.geometry.getAttribute('flowMask');
   const base=mesh.userData.flowPositions as Float32Array,baseNormals=mesh.userData.flowNormals as Float32Array;
   for(let i=0;i<positions.count;i++){
    const x=base[i*3],y=base[i*3+1],z=base[i*3+2];
    if(mask.getX(i)===0){
     const phase=z*.61-(reduced?0:clock)*1.9+x*.11,ripple=Math.sin(phase)*.12,slope=Math.cos(phase)*.12*.61;
     positions.setXYZ(i,x,y+ripple,z);
     a.set(baseNormals[i*3],baseNormals[i*3+1],baseNormals[i*3+2]-slope*baseNormals[i*3+1]).normalize();
    }else{
     const wave=flowSurface(x,y,clock,g.stage,reduced,surfaceSample);
     positions.setXYZ(i,x,y,z+wave.height);a.set(-wave.dx,-wave.dy,1).normalize();
    }
    normals.setXYZ(i,a.x,a.y,a.z);
   }
   positions.needsUpdate=true;normals.needsUpdate=true;
  }
 }
 cameraFrame(){return this.frame;}
 diagnostics(){return {stage:this.stage,identity:WORLD_IDENTITIES[this.stage]?.id,topology:WORLD_IDENTITIES[this.stage]?.topology,terrain:this.root.children.filter(o=>!o.name.includes('-batch-')).map(o=>o.name),section:this.frame.section,progress:this.frame.progress,bank:this.frame.bank,eye:[this.frame.eyeX,this.frame.eyeY,this.frame.eyeZ],instances:this.instances,details:this.detailInstances,triangles:this.triangles,draws:this.root.children.length,finite:true,textureCards:0};}
}
