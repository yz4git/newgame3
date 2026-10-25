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
const stoneArch=new T.TorusGeometry(12,2.25,6,22,Math.PI);
const archRim=new T.TorusGeometry(12,.32,4,22,Math.PI);
const cylinder=new T.CylinderGeometry(1,1,1,8);
const COLORS=[
 {earth:0x293e3a,grass:0x526d47,road:0x293b4a,water:0x254a5e,rock:0x626a6d,wall:0x68757b,top:0xa0b0b6,glow:0xffcb83},
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
 return scene===0&&(-z<330||(-z>=1480&&-z<3450));
}
export function heightAt(scene:number,x:number,z:number){
 const center=routeCenter(scene,z).x,d=-z;
 const side=Math.abs(x-center);
 const big=Math.sin(x*.019+scene*2)*Math.cos(z*.015+scene)*2.9+
  Math.sin(x*.053+z*.012+scene)*1.18;
 const canyon=scene===0&&d>1480&&d<3450;
 if(scene===0&&d<330)return -15.85+big*.15;
 if(canyon){
  const river=side<31?-.6:Math.min(24,(side-31)*.48);
  return -16.0+river+(side>33?big*.95:0);
 }
 if(scene===1)return -17+Math.max(0,(side-25)*.10)+big*.45;
 if(scene===3)return -16+(side>25?(side-25)*.12:0)+big*.9;
 if(scene===4)return -16+(side>33?(side-33)*.07:0)+big*.8;
 if(scene===5)return -17+(side>42?(side-42)*.045:0)+big*.85;
 return -15.7+Math.max(0,side-25)*(scene===0?.092:.036)+big*(scene===0?.83:.55);
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
 private waterfallMat=new T.ShaderMaterial({
  uniforms:{uTime:{value:0}},
  vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec3 vP; uniform float uTime; void main(){'+
   'float wave=0.5+0.5*sin(vP.x*0.7+vP.y*0.3+uTime*3.2);'+
   'float stream=pow(0.5+0.5*sin(vP.y*1.25+vP.x*0.5+uTime*4.9),4.0);'+
   'float foam=pow(0.5+0.5*sin(vP.x*2.0-vP.y*0.5+uTime*5.6),7.0);'+
   'vec3 color=mix(vec3(0.18,0.46,0.56),vec3(0.7,0.9,0.97),stream*0.38+foam*0.29);'+
   'gl_FragColor=vec4(color,0.22+0.20*wave+0.16*foam);}',
  side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.NormalBlending
 });
 private roadMat=mat(0x2f3a43,.95);
 private roadLine=new T.MeshBasicMaterial({color:0xbdd9df});
 private seaFoam=new T.MeshBasicMaterial({color:0x9bc7cc,transparent:true,opacity:.20,depthWrite:false});
 private wallMat=mat(0x8299a7,.49);
 private trimMat=mat(0xc0cfd2,.43);
 private emitter=new T.MeshBasicMaterial({color:0x72def6,toneMapped:false});
 private stone=mat(0x687c7b,.89);
 private foliage=mat(0x366c57,.94);
 private weathered=mat(0x565f66,.86);
 private oxidized=mat(0x42606e,.69);
 private ceramic=mat(0xb3aa98,.82);
 private girders=mat(0x2e3d4b,.7);
 private amber=new T.MeshBasicMaterial({color:0xffd59b});
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
  const sideCount=this.allRange?37:31,rows=13,verts=[],normals=[],colors=[],indices=[];
  const palette=COLORS[this.sceneId];
  const low=new T.Color(palette.earth),green=new T.Color(palette.grass);
  const roadCenter=routeCenter(this.sceneId,z).x;
  for(let j=0;j<rows;j++){
   const lz=HALF-j*TILE/(rows-1),wz=z+lz;
   for(let i=0;i<sideCount;i++){
    const width=this.allRange?650:520;
    const x=-width*.5+i*width/(sideCount-1)+roadCenter;
    const h=heightAt(this.sceneId,x,wz);
    verts.push(x,h,lz);
    const grain=u(Math.floor(x*.32)*13+Math.floor(wz*.26)*11+this.sceneId*17);
    const t=clamp(.17+.58*Math.sin(x*.046+wz*.021+this.sceneId)*Math.sin(x*.014-wz*.018)
       +.31*grain+.16*Math.sin(x*.11+wz*.14),0,1);
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
   const intro=this.sceneId===0&&-z<330;
   const canal=this.sceneId===0&&coastZone(this.sceneId,z)&&!intro;
   item(group,box,this.seaMaterial,routeCenter(this.sceneId,z).x,level-.08,0,canal?68:250,.16,TILE+.12);
   // Short, faint strips and irregular orientation read as water reflections
   // rather than the bright straight white stripes seen in the old screenshots.
   for(let i=0;i<(canal?5:8);i++){
    const x=routeCenter(this.sceneId,z).x+(u(i*9+z)-.5)*(canal?52:185);
    const streak=item(group,box,this.seaFoam,x,level+.033,(u(i*7+z)-.5)*TILE,4+u(i+z+4)*13,.022,.24+u(i+z)*.33);
    streak.rotation.y=(u(i+z+99)-.5)*.7;
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
  const base=heightAt(this.sceneId,x,zWorld),variant=Math.abs(style)%5;
  const w=width*(variant===3?1.65:variant===4?1.4:1);
  const h=height*(variant===2?.63:variant===4?.44:1);
  const core=variant===0?this.weathered:variant===1?this.oxidized:variant===2?this.ceramic:variant===3?this.girders:this.wallMat;
  if(variant===0){
   // Stepped high-rise, uneven silhouette and broad mechanical top.
   item(group,box,core,x,base+h*.39,zLocal,w,h*.78,w*.8);
   item(group,box,this.trimMat,x+w*.09,base+h*.83,zLocal-w*.04,w*.65,h*.35,w*.61);
   item(group,box,this.girders,x-w*.13,base+h+1.1,zLocal+w*.12,w*.38,2.2,w*.4);
   for(let f=0;f<Math.min(6,Math.floor(h/6));f++){
    item(group,box,this.roadMat,x,base+3+f*6,zLocal+w*.405,w*.75,.24,.08);
    for(let k=0;k<3;k++)if((f+k+style)%4!==0)
     item(group,box,this.amber,x+(k-1)*w*.22,base+4+f*6,zLocal+w*.41,w*.115,1.0,.09);
   }
  }else if(variant===1){
   // Cylindrical observation tower with dark ring and off-centre antenna.
   item(group,cylinder,core,x,base+h*.5,zLocal,w*.51,h,w*.51);
   for(let f=0;f<Math.min(6,Math.floor(h/8));f++)
    item(group,cylinder,this.roadMat,x,base+4+f*8,zLocal,w*.58,.65,w*.58);
   item(group,cylinder,this.trimMat,x,base+h+1,zLocal,w*.7,2,w*.7);
   item(group,ico,this.amber,x+w*.22,base+h+3,zLocal,.5,.7,.5);
  }else if(variant===2){
   // Low damaged industrial block with concrete tiers and hangar doors.
   item(group,box,core,x,base+h*.5,zLocal,w,h,w*1.25);
   item(group,box,this.girders,x,base+h+.4,zLocal,w*1.2,.9,w*1.35);
   for(let k=0;k<3;k++)item(group,box,this.roadMat,x+(k-1)*w*.26,base+h*.25,zLocal+w*.634,w*.19,h*.34,.12);
   item(group,box,this.emitter,x,base+h*.8,zLocal+w*.64,w*.32,.2,.12);
  }else if(variant===3){
   // Broken skyscraper with an asymmetric split upper level.
   item(group,box,core,x,base+h*.40,zLocal,w,h*.8,w*.7);
   item(group,box,this.wallMat,x-w*.16,base+h*.83,zLocal,w*.62,h*.37,w*.8);
   item(group,box,this.trimMat,x+w*.2,base+h*.75,zLocal-w*.13,w*.32,1,w*.5);
   item(group,box,this.girders,x-w*.12,base+h+1,zLocal,w*.38,2,w*.3);
   for(let f=0;f<Math.min(5,Math.floor(h/8));f++)
    item(group,box,this.amber,x-w*.18,base+3+f*7,zLocal+w*.358,w*.36,.17,.08);
  }else{
   // Horizontal refinery housing rather than another tower.
   item(group,box,core,x,base+h*.5,zLocal,w,h,w*1.6);
   item(group,box,this.girders,x,base+h+.2,zLocal,w*1.08,.55,w*1.67);
   for(const sign of [-1,1]){
    item(group,cylinder,this.oxidized,x+sign*w*.26,base+h+2.5,zLocal,w*.16,5,w*.16);
    item(group,box,this.amber,x+sign*w*.3,base+h*.53,zLocal+w*.804,w*.15,.4,.07);
   }
  }
  colliders.push({x,y:base+h*.5,z:zWorld,rx:w*.58,ry:h*.55,rz:w*(variant===4?.84:.5),kind:'building'});
 }
 private urbanOverpass(group:T.Group,colliders:Collider[],center:number,tileZ:number){
  const base=heightAt(this.sceneId,center,tileZ);
  // Diagonal service bridge over the player's flight line. Wings can fly under.
  for(const side of [-1,1]){
   item(group,box,this.weathered,center+side*15,base+11,0,2.3,23,3);
   colliders.push({x:center+side*15,y:base+11,z:tileZ,rx:1.2,ry:11.5,rz:2.2,kind:'tower'});
  }
  item(group,box,this.girders,center,base+24,0,34,2.2,4);
  for(const side of [-1,1])item(group,box,this.trimMat,center,base+26,side*1.65,34,.45,.36);
  colliders.push({x:center,y:base+24,z:tileZ,rx:17,ry:1.3,rz:2.5,kind:'bridge'});
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
  const pedestal=15,openingRadius=12;
  for(const sign of [-1,1]){
   const bx=x+sign*openingRadius;
   item(group,box,this.stone,bx,base+pedestal*.5,local,4.6,pedestal,7.1);
   item(group,box,this.trimMat,bx,base+pedestal*.92,local,5.8,.9,8.1);
   item(group,box,this.weathered,bx+sign*1.9,base+3.5,local,2.0,7.2,8);
   colliders.push({x:bx,y:base+pedestal*.5,z:gate.z,rx:2.9,ry:pedestal*.5,rz:4,kind:'rock'});
  }
  // Genuine low-poly curved masonry arch. The opening remains flyable and the
  // semicircle silhouette is recognizable from the third-person camera.
  item(group,stoneArch,this.stone,x,base+pedestal,local,1,1,1.0);
  item(group,archRim,this.ceramic,x,base+pedestal,local-2.1,1,1,1.02);
  for(const sign of [-1,1]){
   item(group,ico,this.weathered,x+sign*13.1,base+pedestal+2.5,local,3.3,4.2,4.5);
  }
  // Approximate top rim collision; the two side pillars are separate volumes.
  colliders.push({x,y:base+pedestal+openingRadius,z:gate.z,rx:8.7,ry:2.8,rz:4,kind:'bridge'});
 }
 private addTile(z:number){
  const tileZ=Math.round(z/TILE)*TILE,colliders:Collider[]=[],group=new T.Group();
  group.position.z=tileZ;
  this.tileGround(group,tileZ);
  const stage=this.sceneId,d=-tileZ;
  const coast=coastZone(stage,tileZ),center=routeCenter(stage,tileZ).x;
  const city=stage===0&&d>=320&&d<1470;
  const coastStart=stage===0&&d<320;
  const cityAfter=stage===0&&d>3450;
  const buildings=city?7:coastStart?5:8;
  for(let i=0;i<buildings;i++){
   const n=Math.round(tileZ*1.13)+stage*1003+i*31;
   const sign=i%2===0?1:-1;
   const distance=city?(34+u(n+2)*42):coastStart?(28+u(n+2)*60):coast?42+u(n+2)*35:stage===2?16+u(n+2)*48:22+u(n+2)*67;
   const x=center+sign*distance,local=(u(n+5)-.5)*TILE*.91,wz=tileZ+local;
   if(city||stage===2){
    const style=i+(Math.floor(d/TILE)*3);
    const width=6+u(n+4)*12;
    const height=10+u(n+6)*(city?48:36);
    this.makeTower(group,colliders,x,local,wz,width,height,style);
   }else if(coastStart){
    this.makeRock(group,colliders,x,local,wz,n);
    if(i%2===0)this.makeForest(group,colliders,x+sign*4,local+8,wz+8,i);
   }else if(stage===1){
    if(i%3===0)this.makeTower(group,colliders,x,local,wz,7+u(n)*8,8+u(n+1)*15,i);
    else this.makeCrane(group,colliders,x,local,wz,i);
   }else if(stage===4)this.makeForest(group,colliders,x,local,wz,i);
   else if(stage===5)this.makeCrane(group,colliders,x,local,wz,i);
   else this.makeRock(group,colliders,x,local,wz,n);
  }
  if(city&&Math.floor(d/TILE)%4===2)this.urbanOverpass(group,colliders,center,tileZ);
  if(city||cityAfter)for(let i=0;i<5;i++){
   const n=i+Math.floor(d)*7,sign=i%2?1:-1;
   const x=center+sign*(13+u(n)*47),zl=(u(n+11)-.5)*TILE;
   const y=heightAt(stage,x,tileZ+zl)+.7;
   const rubble=item(group,ico,i%3===0?this.oxidized:this.stone,x,y,zl,1.5+u(n+9)*3.5,1.0+u(n+3)*2,2+u(n+6)*3);
   rubble.rotation.z=u(n+8)*Math.PI;
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
  this.waterfallMat.uniforms.uTime.value=performance.now()*.001;
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
