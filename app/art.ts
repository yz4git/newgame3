import * as T from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from './sim.ts';

let panelMap:T.CanvasTexture|undefined;
function panels(){
  if(panelMap)return panelMap;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#e5e9eb';ctx.fillRect(0,0,256,256);
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const x=i*64,y=j*64;ctx.fillStyle=(i+j)%3===0?'#cdd2d6':'#eef0f1';ctx.fillRect(x+2,y+2,60,60);
    ctx.strokeStyle='#828d94';ctx.lineWidth=1;ctx.strokeRect(x+2.5,y+2.5,59,59);
    ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x+4,y+60);ctx.lineTo(x+59,y+60);ctx.stroke();
    ctx.fillStyle='#7e8d98';for(const [rx,ry]of[[6,6],[58,6],[6,58],[58,58]])ctx.fillRect(x+rx,y+ry,1.5,1.5);
    if((i+j)%2===0){ctx.fillStyle='#9aa9b1';ctx.fillRect(x+12,y+19,2,28);ctx.fillRect(x+48,y+36,7,1);}
  }
  panelMap=new T.CanvasTexture(canvas);panelMap.colorSpace=T.SRGBColorSpace;panelMap.wrapS=panelMap.wrapT=T.RepeatWrapping;panelMap.anisotropy=4;return panelMap;
}
export const metal=(c: number,emission=0)=>new T.MeshStandardMaterial({color:c,map:panels(),metalness:.72,roughness:.34,emissive:c,emissiveIntensity:emission,envMapIntensity:.8});
export const glow=(c: number,p=2)=>new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(p),toneMapped:false});
const boxGeometry=new T.BoxGeometry(1,1,1);
const sphereGeometry=new T.IcosahedronGeometry(1,1);
const shotGeometry=new T.SphereGeometry(1,6,4);
const dummy=new T.Object3D();
export const cyan=glow(0x52e7ff,2.6),gold=glow(0xffc765,2.6),pink=glow(0xff668f,2.0);
export const white=metal(0xd6e8ee),navy=metal(0x203d60),dark=metal(0x101d30),steel=metal(0x617787);
export function block(g: T.Group,mat: T.Material,x: number,y: number,z: number,sx: number,sy: number,sz: number) {
  const m=new T.Mesh(boxGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;
}
export function hull(g:T.Group,points:number[][],depth:number,mat:T.Material,z=0){
  const s=new T.Shape();s.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);s.closePath();
  const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.07,bevelThickness:.05});
  const m=new T.Mesh(geo,mat);m.position.z=z;g.add(m);return m;
}
export function ball(g:T.Group,mat:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=new T.Mesh(sphereGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
export function batch(group:T.Group){
  group.updateMatrixWorld(true);const bucket=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)){
    const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);
    const list=bucket.get(o.material)||[];list.push(geo);bucket.set(o.material,list);
  }});
  const result=new T.Group();for(const [mat,list]of bucket){const geo=mergeGeometries(list,false);if(geo)result.add(new T.Mesh(geo,mat));for(const item of list)item.dispose();}
  return result;
}
const cockpit=new T.MeshPhysicalMaterial({color:0x163457,metalness:.65,roughness:.13,clearcoat:1,clearcoatRoughness:.08,emissive:0x15516b,emissiveIntensity:.18});
const alloy=metal(0x9facb8),red=metal(0x9a394b),violet=metal(0x66527f),bronze=metal(0x846744);
function disc(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,depth=.1){
  const m=new T.Mesh(new T.CylinderGeometry(r,r,depth,16),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;
}
function turbine(g:T.Group,x:number,y:number,z:number,r:number,accent:T.Material){
  disc(g,dark,x,y,z,r,.18);disc(g,steel,x,y,z+.08,r*.8,.12);
  const ring=new T.Mesh(new T.TorusGeometry(r*.75,r*.11,6,16),alloy);ring.position.set(x,y,z+.18);g.add(ring);
  disc(g,accent,x,y,z+.18,r*.4,.035);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,m=block(g,steel,x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,z+.16,r*.14,r*.45,.04);m.rotation.z=a;}
}
function vents(g:T.Group,x:number,y:number,z:number,mat:T.Material,count=5,wide=.35){
  block(g,dark,x,y,z,wide+.08,count*.11+.05,.07);
  for(let i=0;i<count;i++)block(g,mat,x,y+(i-(count-1)/2)*.11,z+.05,wide,.035,.035);
}
export function shipModel(kind:Kind|'player'){
  const g=new T.Group();
  if(kind==='player'){
    hull(g,[[0,1.9],[-.35,.75],[-.5,-.85],[-.30,-1.35],[.3,-1.35],[.5,-.85],[.35,.75]],.32,white);
    hull(g,[[0,1.75],[-.14,.9],[-.18,.55],[.18,.55],[.14,.9]],.05,alloy,.34);
    hull(g,[[0,.85],[-.26,.15],[-.21,-.55],[.21,-.55],[.26,.15]],.23,cockpit,.36);
    block(g,navy,0,-.78,.4,.31,.65,.09);vents(g,0,-.79,.48,alloy,4,.22);
    for(const side of[-1,1]){
      hull(g,[[side*.35,.5],[side*1.78,-.63],[side*1.65,-1.2],[side*.38,-.84]],.16,navy);
      hull(g,[[side*.48,.2],[side*1.6,-.67],[side*1.48,-.95],[side*.50,-.61]],.07,white,.18);
      hull(g,[[side*.55,-.2],[side*.9,-.32],[side*1.33,-.73],[side*1.19,-.77]],.04,red,.27);
      block(g,alloy,side*.62,-.65,.37,.30,1.26,.28);
      vents(g,side*.62,-.40,.54,steel,5,.23);
      turbine(g,side*.62,-1.06,.39,.21,cyan);
      hull(g,[[side*.73,-.76],[side*.98,-1.34],[side*.81,-1.4]],.24,navy,.34);
      block(g,steel,side*1.50,-.38,.20,.12,.85,.11);block(g,cyan,side*1.5,.02,.23,.08,.08,.04);
      for(let j=0;j<3;j++)block(g,gold,side*1.20,-.84+j*.08,.27,.21,.02,.02);
    }
  }else if(kind==='drone'||kind==='dart'){
    const paint=kind==='dart'?violet:red,accent=kind==='dart'?pink:gold;
    hull(g,[[0,-1.1],[-.36,-.35],[-.85,.55],[-.68,.85],[-.22,.43],[0,.85],[.22,.43],[.68,.85],[.85,.55],[.36,-.35]],.23,paint);
    hull(g,[[0,-.9],[-.19,-.1],[-.13,.45],[.13,.45],[.19,-.1]],.08,alloy,.25);
    hull(g,[[0,-.45],[-.12,.1],[.12,.1]],.10,cockpit,.34);
    for(const side of[-1,1]){vents(g,side*.49,.44,.27,steel,3,.22);block(g,accent,side*.62,-.02,.28,.065,.36,.05);}
    turbine(g,0,.57,.27,.18,accent);
  }else if(kind==='fighter'||kind==='lancer'){
    const paint=kind==='lancer'?alloy:red,accent=kind==='lancer'?pink:gold;
    hull(g,[[0,-1.45],[-.35,-.55],[-1.45,.43],[-1.2,1.02],[-.47,.55],[0,1.20],[.47,.55],[1.2,1.02],[1.45,.43],[.35,-.55]],.4,paint);
    hull(g,[[0,-1.15],[-.22,-.25],[-.19,.55],[.19,.55],[.22,-.25]],.14,dark,.42);
    hull(g,[[0,-.75],[-.13,-.25],[.13,-.25]],.09,cockpit,.57);
    for(const side of[-1,1]){
      block(g,steel,side*.85,.21,.44,.36,1,.18);vents(g,side*.85,.31,.57,alloy,5,.25);
      block(g,accent,side*.85,-.27,.51,.19,.12,.07);turbine(g,side*.40,.63,.49,.18,accent);
      hull(g,[[side*.5,.37],[side*1.30,.59],[side*1.16,.77]],.03,navy,.44);
    }
    if(kind==='lancer'){block(g,bronze,0,-1.13,.46,.22,.7,.18);block(g,pink,0,-1.42,.49,.17,.08,.08);}
  }else if(kind==='weaver'){
    disc(g,dark,0,0,.07,1.03,.35);disc(g,violet,0,0,.34,.75,.22);turbine(g,0,0,.48,.49,pink);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+Math.PI/4,fin=new T.Group();
      hull(fin,[[.45,0],[1.45,-.24],[1.15,.50],[.50,.35]],.20,violet,.08);
      block(fin,alloy,1,.05,.33,.55,.10,.07);block(fin,pink,1.1,.16,.34,.35,.04,.05);
      fin.rotation.z=a;g.add(fin);
    }
  }else if(kind==='tank'){
    hull(g,[[-.8,-.95],[-1,.2],[-.6,.95],[.6,.95],[1,.2],[.8,-.95]],.36,bronze);
    for(const side of[-1,1]){block(g,dark,side*.9,0,.15,.42,2.0,.38);vents(g,side*.9,0,.36,steel,12,.37);}
    disc(g,steel,0,0,.44,.67,.18);hull(g,[[-.45,-.55],[-.60,.20],[-.32,.48],[.32,.48],[.60,.2],[.45,-.55]],.2,bronze,.50);
    for(const side of[-1,1]){block(g,alloy,side*.24,-.80,.62,.14,1.0,.15);block(g,gold,side*.24,-1.27,.64,.10,.08,.07);}
    disc(g,dark,0,.13,.74,.18,.08);block(g,gold,0,-.30,.76,.25,.05,.02);
  }else if(kind==='carrier'){
    hull(g,[[-.5,-1.1],[-1.1,-.1],[-1,.8],[-.6,1.1],[.6,1.1],[1,.8],[1.1,-.1],[.5,-1.1]],.38,navy);
    block(g,white,0,-.10,.44,.8,1.2,.16);block(g,cyan,0,-.10,.62,.12,.6,.03);block(g,cyan,0,-.10,.62,.6,.12,.03);
    for(const side of[-1,1]){vents(g,side*.79,.25,.42,steel,5,.20);turbine(g,side*.68,.68,.47,.23,cyan);}
  }else if(kind==='relic'){
    block(g,dark,0,0,0,1.8,1.8,.3);disc(g,bronze,0,0,.25,.76,.17);
    const ring=new T.Mesh(new T.TorusGeometry(.60,.055,6,24),gold);ring.position.z=.5;g.add(ring);
    const core=ball(g,gold,0,0,.5,.35,.35,.20);core.rotation.z=Math.PI/4;
    for(const side of[-1,1]){block(g,alloy,side*.67,0,.34,.18,1.1,.13);block(g,navy,0,side*.67,.34,1.1,.18,.13);}
  }else{
    hull(g,[[0,-2.4],[-1.35,-1.3],[-1.85,.9],[-1.5,2],[1.5,2],[1.85,.9],[1.35,-1.3]],.70,navy);
    hull(g,[[-.8,-1.3],[-.68,1.0],[.68,1.0],[.8,-1.3]],.30,bronze,.70);turbine(g,0,-.15,1.05,.55,gold);
    for(const side of[-1,1]){
      block(g,alloy,side*1.25,-.15,.70,.40,2.8,.36);vents(g,side*1.25,.28,.92,steel,9,.32);
      block(g,gold,side*1.25,-1.5,.81,.28,.12,.08);turbine(g,side*.75,1.30,.83,.27,pink);
      block(g,red,side*1.2,1.15,.87,.32,.10,.04);
    }
  }
  return batch(g);
}
export function bossModel(stage:number){
  const g=new T.Group(),paint=metal([0x627b8c,0x746284,0x666778][stage]),accent=[cyan,pink,gold][stage];
  const body=new T.Group();
  hull(body,[[0,-3.15],[-1.6,-1.75],[-2,.7],[-1.35,2.55],[1.35,2.55],[2,.7],[1.6,-1.75]],.90,paint);
  hull(body,[[-.85,-2.2],[-.85,1.6],[.85,1.6],[.85,-2.2]],.30,dark,.9);
  turbine(body,0,-.85,1.35,.72,accent);
  for(const side of[-1,1]){
    hull(body,[[side*.9,-2],[side*1.54,-1],[side*1.6,1.3],[side*.9,1.75]],.23,alloy,1.0);
    vents(body,side*1.2,.45,1.25,steel,10,.40);
    block(body,accent,side*1.32,-1.0,1.29,.08,.62,.06);
    turbine(body,side*1.20,1.70,1.1,.28,accent);
  }
  if(stage===0){
    block(body,navy,0,1.25,1.15,1.30,1.1,.40);hull(body,[[-.6,.9],[-.42,1.7],[.42,1.7],[.6,.9]],.12,cockpit,1.55);
    for(let i=0;i<5;i++)block(body,alloy,-.52+i*.26,.84,1.52,.06,.45,.06);
    for(const side of[-1,1]){block(body,bronze,side*.67,-2.40,1.10,.4,1.25,.27);block(body,accent,side*.67,-2.99,1.16,.26,.12,.08);}
  }else if(stage===1){
    for(const side of[-1,1])hull(body,[[side*.2,1.65],[side*1.45,3.0],[side*1.12,1.05]],.18,violet,.4);
    hull(body,[[0,-2.8],[-.35,-1.9],[.35,-1.9]],.2,alloy,1.1);
  }else{
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;const m=block(body,bronze,Math.cos(a)*1.2,Math.sin(a)*1.2+.1,1.5,.52,.36,.20);m.rotation.z=a;}
    vents(body,0,1.62,1.1,alloy,6,.8);
  }
  g.add(batch(body));
  for(let i=0;i<2;i++){
    const wing=new T.Group(),side=i===0?-1:1;
    if(stage===1){
      hull(wing,[[side*1.35,1.2],[side*3.7,2.5],[side*5.2,.3],[side*4.7,-1.55],[side*3,-2],[side*2,-.75]],.38,violet);
      hull(wing,[[side*2.2,1],[side*3.7,1.8],[side*4.5,.35],[side*3.3,-.4]],.11,paint,.42);
    }else{
      hull(wing,[[side*1.5,1.4],[side*3.1,2],[side*5.0,.4],[side*4.6,-1.25],[side*3.0,-1.8],[side*2,-.6]],.65,paint);
      hull(wing,[[side*2.1,1],[side*3.8,1.35],[side*4.3,.3],[side*3.9,-.5],[side*2.4,-.45]],.20,navy,.67);
    }
    block(wing,dark,side*3.0,-.3,.73,1.10,2.4,.25);
    for(const offset of[-.25,.25]){block(wing,alloy,side*3.0+offset,-.7,.94,.23,1.65,.22);block(wing,accent,side*3.0+offset,-1.54,1,.16,.13,.08);}
    turbine(wing,side*3.72,.70,.89,.43,accent);vents(wing,side*2.5,.55,.8,steel,5,.35);
    for(let j=0;j<3;j++){block(wing,bronze,side*(4.05+j*.20),-.24,.69,.13,.75,.09);block(wing,accent,side*(4.05+j*.20),.20,.76,.08,.06,.03);}
    if(stage===2)for(let j=0;j<3;j++)block(wing,paint,side*(3.8+j*.38),-.85,.60,.22,1.8-j*.25,.28);
    const w=batch(wing);w.name='wing'+i;g.add(w);
  }
  const rotor=new T.Group();rotor.name='rotor';
  for(let i=0;i<6;i++){const a=i*Math.PI/3,fin=block(rotor,alloy,Math.cos(a)*.80,Math.sin(a)*.80,1.51,.10,.36,.06);fin.rotation.z=a;}
  rotor.position.y=-.85;g.add(rotor);
  return g;
}
export function radialTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.16,'rgba(255,255,255,.7)');grad.addColorStop(.5,'rgba(255,255,255,.13)');grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);return new T.CanvasTexture(c);
}
export function environmentTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d')!;
  const sky=ctx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#111c39');sky.addColorStop(.38,'#496888');sky.addColorStop(.48,'#c5deee');sky.addColorStop(.57,'#32445c');sky.addColorStop(1,'#080d15');ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
  const sun=ctx.createRadialGradient(130,80,0,130,80,48);sun.addColorStop(0,'#fff2dd');sun.addColorStop(.3,'#fff2ddaa');sun.addColorStop(1,'#fff2dd00');ctx.fillStyle=sun;ctx.fillRect(0,0,512,256);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.mapping=T.EquirectangularReflectionMapping;return map;
}
export function effectTexture(kind:'fire'|'smoke'|'shadow'){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;
  const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  const stops=kind==='fire'?[[0,'#ffffff'],[.08,'#fffbe7'],[.25,'#ffda93dd'],[.45,'#ff8e3044'],[1,'#ff4a0000']]:kind==='shadow'?[[0,'#02091488'],[.45,'#02091455'],[1,'#02091400']]:[[0,'#5162789a'],[.35,'#394c6078'],[.75,'#23384e25'],[1,'#23384e00']];
  for(const[at,color]of stops)gradient.addColorStop(at as number,color as string);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export function planetModel(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d')!;
  for(let row=0;row<512;row++){
    const v=.5+.25*Math.sin(row*.037)+.09*Math.sin(row*.171);ctx.fillStyle=`rgb(${Math.round(62+v*46)},${Math.round(66+v*45)},${Math.round(92+v*75)})`;ctx.fillRect(0,row,1024,1);
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const planet=new T.Mesh(new T.SphereGeometry(18,48,32),new T.MeshStandardMaterial({map:tex,roughness:1,metalness:0}));
  planet.position.set(-10,27,-27);planet.rotation.z=.27;return planet;
}
export function terrainDetail(group:T.Group,stage:number,n:number,mats:T.Material[],edge:T.Material,lights:T.Material){
  if(stage===0){
    for(const side of[-1,1]){
      const x=side*(8.2+n%3*.50),y=(n%2?1:-1)*1.1;
      block(group,mats[2],x,y,-2.8,2.5,3.4,.22);
      block(group,mats[1],x,y,-2.05,2.10,2.7,1.5+n%3*.28);
      block(group,mats[0],x,y,-1.14,1.88,2.5,.16);
      for(let j=0;j<5;j++)block(group,lights,x-side*1.065,y-1.15+j*.48,-1.65,.035,.25,.25);
      for(let j=0;j<3;j++){block(group,mats[2],x-.6+j*.6,y+.5,-.96,.42,.80,.24);vents(group,x-.6+j*.6,y+.5,-.83,mats[1],4,.27);}
      block(group,mats[1],x+side*.56,y-.70,-.60,.42,.50,.6);block(group,edge,x+side*.56,y-.70,-.28,.15,.18,.03);
      // Street trenches, rails and service conduits sit below the flight plane.
      block(group,mats[2],side*5.35,0,-3.25,.32,8.6,.30);
      for(let j=0;j<3;j++)block(group,mats[1],side*(5.38+j*.12),0,-3.04,.065,8.5,.055);
      for(let j=0;j<4;j++)block(group,mats[1],side*6.0,-3+j*2,-2.76,.35,.35,.8);
    }
    if(n%3===0){
      block(group,mats[2],0,1.0,-3.3,10.2,1.6,.18);
      for(let j=0;j<8;j++)block(group,mats[1],-4.1+j*1.2,1,-3.18,.65,1.1,.025);
    }
    for(let j=0;j<5;j++){block(group,lights,0,-3.5+j*1.6,-3.29,.04,.55,.025);for(const side of[-1,1])block(group,mats[1],side*3.5,-3.5+j*1.6,-3.28,.07,.55,.025);}
    if(n===3||n===8){
      for(const side of[-1,1]){block(group,mats[1],side*11.2,0,-.1,2.8,6.2,5.0);block(group,mats[0],side*11.2,0,2.4,2.4,5.9,.2);
        for(let j=0;j<8;j++){block(group,lights,side*9.77,-2.5+j*.7,1.5,.025,.35,.6);block(group,edge,side*11.2,-2.5+j*.7,2.55,1.8,.025,.025);}}
      block(group,mats[1],0,2.2,-3.0,20,1.3,.85);block(group,mats[2],0,2.2,-2.52,18.7,.85,.13);
      for(let j=0;j<18;j++)block(group,lights,-8.5+j,2.2,-2.44,.27,.36,.02);
    }
  }else if(stage===1){
    for(const side of[-1,1]){
      for(let j=0;j<4;j++){
        const shard=new T.Mesh(new T.ConeGeometry(.46,3.6+j*.4,5),mats[j%2]);shard.position.set(side*(9.1+j*.5),-2+j*1.6,-3.2);shard.rotation.set(.42,0,-side*(.2+j*.07));group.add(shard);
        const vein=block(group,lights,side*(9.1+j*.5),-.3+j*1.6,-2.1,.055,1.2,.03);vein.rotation.z=-side*.32;
      }
      if(n%3===1){const debris=ball(group,mats[2],side*7.2,.5,-5.4,1.4,.7,.6);debris.rotation.z=n*.5;block(group,mats[1],side*7.2,.5,-4.8,2.8,.3,.2);}
    }
    if(n%4===1){
      const arch=new T.Mesh(new T.TorusGeometry(13,.40,8,64),mats[0]);arch.position.set(0,0,-6);arch.rotation.x=.30;group.add(arch);
      for(let j=0;j<16;j++){const a=j*Math.PI/8,m=block(group,mats[1],Math.cos(a)*13,Math.sin(a)*13,-5.5,1.3,.7,.7);m.rotation.z=a;block(group,edge,Math.cos(a)*12.45,Math.sin(a)*12.45,-5.0,.21,.26,.05);}
    }
  }else{
    for(const side of[-1,1]){
      for(let j=0;j<7;j++){block(group,mats[2],side*7.3,-3.7+j*1.15,-2.65,1.8,.80,.15);block(group,mats[1],side*7.3,-3.7+j*1.15,-2.42,1.5,.15,.37);}
      block(group,mats[0],side*9.5,0,-1.7,1.4,7.8,.6);
      for(let j=0;j<10;j++)block(group,mats[2],side*9.5,-3.4+j*.74,-1.32,1.0,.13,.03);
      if(n%2===0){const pipe=new T.Mesh(new T.CylinderGeometry(.24,.24,8,10),mats[1]);pipe.position.set(side*6.05,0,-2.85);group.add(pipe);}
    }
    if(n%3===1){
      const vessel=new T.Mesh(new T.CylinderGeometry(3.65,3.65,.45,40),mats[2]);vessel.rotation.x=Math.PI/2;vessel.position.z=-3.45;group.add(vessel);
      const ring=new T.Mesh(new T.TorusGeometry(3.3,.17,8,48),edge);ring.position.z=-3.12;group.add(ring);
      disc(group,mats[1],0,0,-3.15,2.8,.2);disc(group,lights,0,0,-2.95,1.8,.025);disc(group,mats[2],0,0,-2.9,1.4,.05);
      for(let j=0;j<12;j++){const a=j*Math.PI/6,m=block(group,mats[1],Math.cos(a)*2.6,Math.sin(a)*2.6,-2.92,.30,1.10,.25);m.rotation.z=a;}
    }
  }
}
