import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {routeCenter,seed,clamp,swept,type V3} from './nova64-rules.ts';

/**
 * The course is not a scrolling wallpaper: an actual lit height-field stretches
 * below the player, and buildings / arches / rock ridges occupy world coordinates.
 * All mission assets are procedurally original.
 */
export type Collider={x:number;y:number;z:number;rx:number;ry:number;rz:number;kind:'building'|'rock'|'tower'|'bridge'};
export type Gate={z:number;passed:boolean;missed:boolean;index:number};
type Tile={group:T.Group;z:number;colliders:Collider[]};
const TILE=90,HALF=45,COUNT=17,CHANNEL=120;
const box=new T.BoxGeometry(1,1,1);
const ico=new T.IcosahedronGeometry(1,1);
const cone=new T.ConeGeometry(1,1,6);
const torus=new T.TorusGeometry(1,.09,7,36);
const cylinder=new T.CylinderGeometry(1,1,1,8);
const COLORS=[
 {earth:0x496949,grass:0x648247,road:0x273747,water:0x246987,rock:0x6b7975,wall:0x8c9ca2,top:0xa8bdc1,glow:0x83ebef},
 {earth:0x275475,grass:0x377e89,road:0x345060,water:0x15749c,rock:0x729496,wall:0x809fa3,top:0xb4dcdf,glow:0x61f1e0},
 {earth:0x404464,grass:0x4d6071,road:0x222738,water:0x1a3860,rock:0x56617a,wall:0x7c91b0,top:0xa5c2d1,glow:0xc8a3ff},
 {earth:0x779eb1,grass:0xb4cdd4,road:0x557080,water:0x3981a9,rock:0xbed6de,wall:0x9cbcc9,top:0xe1f7ff,glow:0x9beaff},
 {earth:0x265a46,grass:0x447d54,road:0x506a4a,water:0x258f7d,rock:0x4b7067,wall:0x8da887,top:0xa5caa0,glow:0x7fffc9},
 {earth:0x7a403c,grass:0x9a5a4c,road:0x442b35,water:0xdd6a2f,rock:0x8e594d,wall:0x96837f,top:0xe4b888,glow:0xffc16a}
];
function u(seedNo:number){return seed(seedNo*.131+17.2);}
function mat(color:number,roughness=.65){return new T.MeshStandardMaterial({color,roughness,metalness:1-roughness,flatShading:true});}
function item(group:T.Group,geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
 const mesh=new T.Mesh(geometry,material);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;
}
function traverseDispose(root:T.Object3D){
 const geos=new Set<T.BufferGeometry>();
 root.traverse(o=>{if(o instanceof T.Mesh&&!([box,ico,cone,torus,cylinder].includes(o.geometry))&&!geos.has(o.geometry)){geos.add(o.geometry);o.geometry.dispose();}});
}
// Geometry batching keeps dense urban sequences inexpensive on iPhone.
function bake(group:T.Group){
 const buckets=new Map<T.Material,T.BufferGeometry[]>();
 for(const o of [...group.children]){
  if(!(o instanceof T.Mesh))continue;
  o.updateMatrix();
  let geo=o.geometry.clone().applyMatrix4(o.matrix);
  if(geo.index){const expanded=geo.toNonIndexed();geo.dispose();geo=expanded;}
  for(const k of Object.keys(geo.attributes))if(k!=='position'&&k!=='normal'&&k!=='color')geo.deleteAttribute(k);
  const p=buckets.get(o.material)||[];p.push(geo);buckets.set(o.material,p);
  group.remove(o);
 }
 for(const [material,geos] of buckets){
  const colored=geos.some(g=>g.hasAttribute('color'));
  // Ground has vertex colors, other geometry has no color; never merge unlike layouts.
  for(const g of geos){
   if(colored&&!g.hasAttribute('color')){
    const count=g.getAttribute('position').count;
    g.setAttribute('color',new T.Float32BufferAttribute(Array(count*3).fill(1),3));
   }
  }
  const merged=mergeGeometries(geos,false);
  if(merged)group.add(new T.Mesh(merged,material));
  for(const g of geos)g.dispose();
 }
}
export function coastZone(scene:number,z:number){
 return scene===0&&-z>=1480&&-z<3450;
}
export function heightAt(scene:number,x:number,z:number){
 const center=routeCenter(scene,z).x,d=-z;
 const side=Math.abs(x-center);
 const big=Math.sin(x*.019+scene*2)*Math.cos(z*.015+scene)*2.9+
  Math.sin(x*.053+z*.012+scene)*1.18;
 const canyon=scene===0&&d>1480&&d<3450;
 if(canyon){
  const river=side<31?-.6:Math.min(24,(side-31)*.48);
  return -16.0+river+(side>33?big*.95:0);
 }
 if(scene===1)return -17+Math.max(0,(side-25)*.10)+big*.45;
 if(scene===3)return -16+(side>25?(side-25)*.12:0)+big*.9;
 if(scene===4)return -16+(side>33?(side-33)*.07:0)+big*.8;
 if(scene===5)return -17+(side>42?(side-42)*.045:0)+big*.85;
 return -15.7+Math.max(0,side-25)*.036+big*.55;
}
export function waterLevel(scene:number,z:number){
 return scene===1?-16.2:coastZone(scene,z)?-15.35:scene===5?-16.15:-100;
}
export function gateZ(index:number){return -(1790+index*183);}
export function gateCount(){return 7;}
export function passesGate(from:V3,to:V3,gateZValue:number,scene:number){
 if(!(from.z>=gateZValue&&to.z<=gateZValue))return false;
 const t=clamp((from.z-gateZValue)/Math.max(1e-8,from.z-to.z),0,1);
 const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
 const center=routeCenter(scene,gateZValue);
 return Math.abs(x-center.x)<7.6&&y>-10.3&&y<7.8;
}
export class GroundWorld{
 readonly root=new T.Group();
 readonly gates:Gate[]=Array.from({length:7},(_,index)=>({z:gateZ(index),index,passed:false,missed:false}));
 private tiles:Tile[]=[];
 private count=0;
 private sceneId=0;
 private allRange=false;
 private groundMaterial=mat(0xffffff,.9);
 private seaMaterial=new T.MeshStandardMaterial({color:0x317b9b,metalness:.42,roughness:.25,transparent:true,opacity:.94,side:T.DoubleSide,depthWrite:true});
 private waterfallMat=new T.MeshStandardMaterial({color:0x9bdfee,metalness:.15,roughness:.21,transparent:true,opacity:.54,side:T.DoubleSide,depthWrite:false});
 private roadMat=mat(0x2f3a43,.95);
 private roadLine=new T.MeshBasicMaterial({color:0xbdd9df});
 private wallMat=mat(0x8299a7,.49);
 private trimMat=mat(0xc0cfd2,.43);
 private emitter=new T.MeshBasicMaterial({color:0x72def6,toneMapped:false});
 private stone=mat(0x687c7b,.89);
 private foliage=mat(0x366c57,.94);
 private lava=new T.MeshBasicMaterial({color:0xff6937});
 readonly gateState={passed:0,missed:0,lastCross:-1};
 constructor(){this.groundMaterial.vertexColors=true;}
 configure(scene:number,z:number,allRange:boolean){
  this.clear();this.sceneId=scene;this.allRange=allRange;this.count=0;
  const color=COLORS[scene];this.roadMat.color.setHex(color.road);
  this.wallMat.color.setHex(color.wall);this.trimMat.color.setHex(color.top);
  this.emitter.color.setHex(color.glow);this.stone.color.setHex(color.rock);
  this.foliage.color.setHex(color.grass);
  this.seaMaterial.color.setHex(color.water);
  this.gateState.passed=0;this.gateState.missed=0;this.gateState.lastCross=-1;
  for(const g of this.gates){g.passed=false;g.missed=false;}
  for(let i=0;i<COUNT;i++){
   const tileZ=allRange?(-720+i*TILE):z-i*TILE;
   this.addTile(tileZ);
  }
 }
 private tileGround(group:T.Group,z:number){
  const sideCount=this.allRange?37:23,rows=13,verts=[],normals=[],colors=[],indices=[];
  const palette=COLORS[this.sceneId];
  const low=new T.Color(palette.earth),green=new T.Color(palette.grass);
  const roadCenter=routeCenter(this.sceneId,z).x;
  for(let j=0;j<rows;j++){
   const lz=HALF-j*TILE/(rows-1),wz=z+lz;
   for(let i=0;i<sideCount;i++){
    const width=this.allRange?650:270;
    const x=-width*.5+i*width/(sideCount-1)+roadCenter;
    const h=heightAt(this.sceneId,x,wz);
    verts.push(x,h,lz);
    const t=clamp(.27+.26*Math.sin(x*.055+wz*.024+this.sceneId)+.12*u(i*13+j*7+Math.floor(z/90)),0,1);
    const c=low.clone().lerp(green,t);
    colors.push(c.r,c.g,c.b);
    normals.push(0,1,0);
   }
  }
  for(let j=0;j<rows-1;j++)for(let i=0;i<sideCount-1;i++){
   const a=j*sideCount+i,b=a+sideCount;
   indices.push(a,a+1,b,a+1,b+1,b);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const surface=new T.Mesh(geometry,this.groundMaterial);surface.receiveShadow=true;group.add(surface);
  const ocean=coastZone(this.sceneId,z)||this.sceneId===1||this.sceneId===5;
  if(ocean){
   const level=waterLevel(this.sceneId,z);
   item(group,box,this.seaMaterial,routeCenter(this.sceneId,z).x,level-.08,0,coastZone(this.sceneId,z)?68:230,.16,TILE+.1);
   if(coastZone(this.sceneId,z)){
    for(let i=0;i<9;i++){
     const w=24+u(i*7+z)*30,x=routeCenter(this.sceneId,z).x+(u(i+z+7)-.5)*46;
     item(group,box,this.roadLine,x,level+.08,(u(i*8+z)-.5)*TILE,w*.7,.028,.11);
    }
   }
  }else{
   // Visible physically placed continuous roadway with markings and guardrails.
   for(let k=0;k<6;k++){
    const lz=-HALF+(k+.5)*TILE/6,wz=z+lz,c=routeCenter(this.sceneId,wz);
    const h=heightAt(this.sceneId,c.x,wz)+.24;
    const road=item(group,box,this.roadMat,c.x,h,lz,18,.28,TILE/6+.18);
    road.rotation.y=Math.atan2(routeCenter(this.sceneId,wz-5).x-routeCenter(this.sceneId,wz+5).x,10);
    item(group,box,this.roadLine,c.x,h+.16,lz,0.23,.027,7);
    for(const s of [-1,1]){
     item(group,box,this.trimMat,c.x+s*9.1,h+.48,lz,.22,.9,TILE/6);
     item(group,box,this.roadLine,c.x+s*8.65,h+.22,lz,.08,.03,TILE/6);
    }
   }
  }
 }
 private makeTower(group:T.Group,colliders:Collider[],x:number,zLocal:number,zWorld:number,width:number,height:number,style:number){
  const base=heightAt(this.sceneId,x,zWorld),y=base+height/2;
  item(group,box,this.wallMat,x,y,zLocal,width,height,width*.8);
  item(group,box,this.trimMat,x,base+height+.18,zLocal,width*1.07,.32,width*.86);
  item(group,box,this.roadMat,x,base+height-.8,zLocal,width*.84,.25,width*.9);
  for(let f=0;f<Math.min(11,Math.floor(height/3));f++){
   const yy=base+2.5+f*3;
   for(const s of [-1,1]){
    item(group,box,this.emitter,x+s*width*.501,yy,zLocal,.05,.19,width*.53);
    item(group,box,this.emitter,x,yy,zLocal+s*width*.402,width*.7,.16,.05);
   }
  }
  if(style%3===0){
   const spire=item(group,cylinder,this.trimMat,x,base+height+3,zLocal,.18,5,.18);
   spire.rotation.x=style%2*.1;
   item(group,ico,this.emitter,x,base+height+5.4,zLocal,.45,.45,.45);
  }else if(style%3===1){
   item(group,cylinder,this.wallMat,x,base+height+1.4,zLocal,width*.36,2,width*.36);
   item(group,ico,this.emitter,x,base+height+2.7,zLocal,.49,.31,.49);
  }
  colliders.push({x,y,z:zWorld,rx:width*.52,ry:height*.5,rz:width*.43,kind:'building'});
 }
 private makeRock(group:T.Group,colliders:Collider[],x:number,zLocal:number,zWorld:number,n:number){
  const w=4+u(n)*9,h=8+u(n+7)*22,y=heightAt(this.sceneId,x,zWorld)+h*.42;
  const rock=item(group,ico,this.stone,x,y,zLocal,w,h,w*(.65+u(n+11)*.5));
  rock.rotation.z=(u(n+4)-.5)*.37;
  colliders.push({x,y,z:zWorld,rx:w*.77,ry:h*.7,rz:w*.8,kind:'rock'});
  if(this.sceneId===3)item(group,cone,this.trimMat,x,y+h*.48,zLocal,w*.53,h*.68,w*.53);
 }
 private makeCrane(group:T.Group,colliders:Collider[],x:number,zLocal:number,zWorld:number,i:number){
  const base=heightAt(this.sceneId,x,zWorld),height=14+(i%3)*8;
  item(group,box,this.wallMat,x,base+height/2,zLocal,1.0,height,1.05);
  item(group,box,this.trimMat,x,base+height,zLocal,9,.7,.9);
  item(group,box,this.wallMat,x+(i%2?2:-2),base+height-4,zLocal,.55,8,.55);
  item(group,ico,this.emitter,x,base+height,zLocal,.5,.5,.5);
  colliders.push({x,y:base+height*.5,z:zWorld,rx:1.4,ry:height*.5,rz:1.4,kind:'tower'});
 }
 private makeForest(group:T.Group,colliders:Collider[],x:number,zLocal:number,zWorld:number,i:number){
  const base=heightAt(this.sceneId,x,zWorld),h=12+u(i*4)*16;
  item(group,cylinder,this.wallMat,x,base+h*.5,zLocal,.75,h,.75);
  for(let p=0;p<4;p++){
   const dx=(u(i*6+p)-.5)*5,yy=base+h*(.65+p*.08);
   item(group,ico,this.foliage,x+dx,yy,zLocal+(u(p+i*3)-.5)*4,4.3,2.8,4.1);
  }
  colliders.push({x,y:base+h*.5,z:zWorld,rx:1.1,ry:h*.6,rz:1.1,kind:'tower'});
 }
 private makeArch(group:T.Group,colliders:Collider[],gate:Gate,local:number){
  const center=routeCenter(this.sceneId,gate.z),x=center.x,base=heightAt(this.sceneId,x,gate.z);
  const height=26,span=21;
  for(const sign of [-1,1]){
   item(group,box,this.stone,x+sign*span*.5,base+height*.5,local,4.4,height,6.5);
   item(group,box,this.trimMat,x+sign*span*.5,base+height*.93,local,5.1,1.3,7.5);
   colliders.push({x:x+sign*span*.5,y:base+height*.5,z:gate.z,rx:2.4,ry:height*.5,rz:3.3,kind:'rock'});
  }
  item(group,box,this.stone,x,base+height+1,local,span+4,4,7);
  item(group,box,this.trimMat,x,base+height+3,local,span+5.3,1.2,8);
  for(const sign of [-1,1])item(group,ico,this.stone,x+sign*12,base+height+4,local,4.6,4.2,5);
  colliders.push({x,y:base+height+1,z:gate.z,rx:span*.52,ry:2.4,rz:3.5,kind:'bridge'});
 }
 private addTile(z:number){
  const tileZ=Math.round(z/TILE)*TILE,colliders:Collider[]=[],group=new T.Group();
  group.position.z=tileZ;
  this.tileGround(group,tileZ);
  const stage=this.sceneId,d=-tileZ;
  const coast=coastZone(stage,tileZ),center=routeCenter(stage,tileZ).x;
  for(let i=0;i<8;i++){
   const n=Math.round(tileZ*1.13)+stage*1003+i*31;
   const sign=i%2===0?1:-1;
   const distance=coast?41+u(n+2)*35:stage===2?16+u(n+2)*48:22+u(n+2)*67;
   const x=center+sign*distance,local=(u(n+5)-.5)*TILE*.91,wz=tileZ+local;
   if(stage===0&&!coast||stage===2){
    this.makeTower(group,colliders,x,local,wz,4+u(n+4)*9,12+u(n+6)*39,i);
   }else if(stage===1){
    if(i%3===0)this.makeTower(group,colliders,x,local,wz,7+u(n)*8,8+u(n+1)*15,i);
    else this.makeCrane(group,colliders,x,local,wz,i);
   }else if(stage===4)this.makeForest(group,colliders,x,local,wz,i);
   else if(stage===5)this.makeCrane(group,colliders,x,local,wz,i);
   else this.makeRock(group,colliders,x,local,wz,n);
  }
  if(stage===0&&d>900&&d<1430){
   for(const s of [-1,1]){
    const x=center+s*20;
    this.makeTower(group,colliders,x,0,tileZ,8,20+u(d+s)*12,Math.round(d+s));
   }
  }
  if(stage===0&&d>3250&&d<3460){
   const x=center;
   // A real traversable, translucent waterfall between solid canyon cliffs.
   // Unlike the old solid cuboid it does not block the chase view or look like a wall.
   for(const side of [-1,1]){
    item(group,box,this.stone,x+side*39,-4,0,15,35,12);
    item(group,ico,this.stone,x+side*35,12,-4,15,10,18);
   }
   for(let n=0;n<12;n++){
    const strip=this.waterfallMat;
    const width=5+u(n+tileZ)*2.2;
    item(group,box,strip,x-34+n*6.1,-3.6,0,width,24,.34);
   }
   for(let n=0;n<9;n++){
    item(group,box,this.seaMaterial,x-30+n*7,-15.2,4.5,5.4,.22,5);
   }
  }
  if(stage===0)for(const gate of this.gates)
   if(Math.abs(gate.z-tileZ)<=HALF-.8)this.makeArch(group,colliders,gate,gate.z-tileZ);
  bake(group);
  this.root.add(group);this.tiles.push({group,z:tileZ,colliders});
 }
 step(playerZ:number,allRange:boolean){
  if(allRange)return;
  let iterations=0;
  while(iterations++<7){
   const beyond=this.tiles.find(t=>t.z>playerZ+TILE*1.4);
   if(!beyond)break;
   let front=Infinity;
   for(const t of this.tiles)front=Math.min(front,t.z);
   this.root.remove(beyond.group);traverseDispose(beyond.group);
   this.tiles.splice(this.tiles.indexOf(beyond),1);
   this.addTile(front-TILE);
  }
 }
 collisions(from:V3,to:V3,radius=1.25){
  for(const tile of this.tiles){
   if(Math.abs(tile.z-to.z)>120)continue;
   for(const b of tile.colliders){
    const c={x:clamp(to.x,b.x-b.rx,b.x+b.rx),y:clamp(to.y,b.y-b.ry,b.y+b.ry),z:clamp(to.z,b.z-b.rz,b.z+b.rz)};
    if(Math.hypot(to.x-c.x,to.y-c.y,to.z-c.z)<radius)return b;
    const midpoint={x:(from.x+to.x)*.5,y:(from.y+to.y)*.5,z:(from.z+to.z)*.5};
    if(Math.abs(midpoint.z-b.z)<8&&Math.abs(midpoint.x-b.x)<b.rx+radius&&Math.abs(midpoint.y-b.y)<b.ry+radius)return b;
   }
  }
  return null;
 }
 gatesCrossed(from:V3,to:V3){
  const result:{index:number;passed:boolean}[]=[];
  if(this.sceneId!==0)return result;
  for(const gate of this.gates){
   if(gate.passed||gate.missed||from.z<gate.z||to.z>gate.z)continue;
   const passed=passesGate(from,to,gate.z,this.sceneId);
   gate.passed=passed;gate.missed=!passed;
   if(passed)this.gateState.passed++;else this.gateState.missed++;
   this.gateState.lastCross=gate.index;
   result.push({index:gate.index,passed});
  }
  return result;
 }
 clear(){
  for(const t of this.tiles){this.root.remove(t.group);traverseDispose(t.group);}
  this.tiles.length=0;
 }
 get mode(){return this.sceneId;}
 get tilesCount(){return this.tiles.length;}
}
