import * as T from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from './sim.ts';
import {STAGES} from './stages.ts';
import {armourMap,planetMap,shipSkin} from './visual-assets.ts';

export const metal=(c:number,emission=0)=>new T.MeshStandardMaterial({color:c,map:armourMap,bumpMap:armourMap,bumpScale:.027,metalness:.55,roughness:.34,emissive:c,emissiveIntensity:emission,envMapIntensity:1.0});
export const glow=(c: number,p=2)=>new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(p),toneMapped:false});
const boxGeometry=new T.BoxGeometry(1,1,1);
const sphereGeometry=new T.IcosahedronGeometry(1,1);
const shotGeometry=new T.SphereGeometry(1,6,4);
const shadowProxy=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false});
const dummy=new T.Object3D();
export const cyan=glow(0x52e7ff,2.6),gold=glow(0xffc765,2.6),pink=glow(0xff668f,2.0);
export const white=metal(0xd6e8ee),navy=metal(0x203d60),dark=metal(0x101d30),steel=metal(0x617787);
export function block(g: T.Group,mat: T.Material,x: number,y: number,z: number,sx: number,sy: number,sz: number) {
  const m=new T.Mesh(boxGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;
}
export function hull(g:T.Group,points:number[][],depth:number,mat:T.Material,z=0){
  const s=new T.Shape();s.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);s.closePath();
  const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.045});
  const pos=geo.getAttribute('position'),uv=geo.getAttribute('uv'),norm=geo.getAttribute('normal');geo.computeBoundingBox();const bounds=geo.boundingBox!;
  for(let i=0;i<pos.count;i++)if(Math.abs(norm.getZ(i))>.7)uv.setXY(i,(pos.getX(i)-bounds.min.x)/(bounds.max.x-bounds.min.x||1),(pos.getY(i)-bounds.min.y)/(bounds.max.y-bounds.min.y||1));
  const m=new T.Mesh(geo,mat);m.position.z=z;g.add(m);return m;
}
export function ball(g:T.Group,mat:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=new T.Mesh(sphereGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
export function batch(group:T.Group){
  group.updateMatrixWorld(true);const bucket=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)){
    const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);
    const list=bucket.get(o.material)||[];list.push(geo);bucket.set(o.material,list);
  }});
  const result=new T.Group();for(const [mat,list]of bucket){const geo=mergeGeometries(list,false);if(geo){const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);}for(const item of list)item.dispose();}
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
function loft(g:T.Group,sections:number[][],mat:T.Material){
  const positions:number[]=[],uvs:number[]=[];
  const point=(i:number,j:number)=>{const[y,w,h,z]=sections[i],a=j/8*Math.PI*2;return [Math.cos(a)*w,y,z+Math.sin(a)*h];};
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<8;j++)for(const[a,b]of[[i,j],[i+1,j+1],[i+1,j],[i,j],[i,j+1],[i+1,j+1]]){positions.push(...point(a,b));uvs.push(b/8,a/(sections.length-1));}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();g.add(new T.Mesh(geo,mat));
}
export function shipModel(kind:Kind|'player'){
  const g=new T.Group(),attachments:T.Group[]=[];
  if(kind==='player'){
    loft(g,[[1.9,.015,.035,.09],[1.1,.15,.17,.14],[.35,.36,.30,.17],[-.55,.39,.25,.13],[-1.35,.20,.16,.10]],white);
    hull(g,[[0,1.75],[-.14,.9],[-.18,.55],[.18,.55],[.14,.9]],.05,alloy,.34);
    loft(g,[[.88,.025,.025,.36],[.45,.19,.13,.47],[-.10,.22,.19,.46],[-.54,.14,.06,.39]],cockpit);
    block(g,navy,0,-.78,.4,.31,.65,.09);vents(g,0,-.79,.48,alloy,4,.22);
    // Raised canopy frame, nose avionics and split control surfaces.
    hull(g,[[0,1.48],[-.065,1.12],[-.045,.91],[.045,.91],[.065,1.12]],.035,navy,.42);
    for(const s of[-1,1]){
      hull(g,[[s*.25,.12],[s*.22,-.55],[s*.28,-.58],[s*.32,.13]],.045,alloy,.53);
      hull(g,[[s*.28,.68],[s*.73,.35],[s*.72,.18],[s*.34,.38]],.065,white,.14);
      hull(g,[[s*.83,-.72],[s*1.48,-1.10],[s*1.20,-1.20],[s*.78,-.94]],.045,alloy,.28);
      block(g,dark,s*.60,-.05,.51,.19,.28,.10);
      block(g,white,s*.62,-.71,.57,.18,.38,.035);
      for(let i=0;i<3;i++)block(g,red,s*.60,-.58-i*.055,.60,.13,.018,.012);
      block(g,s<0?pink:cyan,s*1.64,-.87,.24,.055,.12,.035);
    }
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
    loft(g,[[.72,.09,.07,.26],[.17,.19,.16,.32],[-.43,.13,.11,.26],[-1.08,.01,.01,.17]],white);
    for(const s of[-1,1])hull(g,[[s*.28,.20],[s*.73,.60],[s*.67,.77],[s*.26,.40]],.035,white,.28);
    hull(g,[[0,-.45],[-.12,.1],[.12,.1]],.10,cockpit,.34);
    for(const side of[-1,1]){vents(g,side*.49,.44,.27,steel,3,.22);block(g,accent,side*.62,-.02,.28,.065,.36,.05);}
    turbine(g,0,.57,.27,.18,accent);
  }else if(kind==='fighter'||kind==='lancer'){
    const paint=kind==='lancer'?alloy:red,accent=kind==='lancer'?pink:gold;
    hull(g,[[0,-1.45],[-.35,-.55],[-1.45,.43],[-1.2,1.02],[-.47,.55],[0,1.20],[.47,.55],[1.2,1.02],[1.45,.43],[.35,-.55]],.4,paint);
    hull(g,[[0,-1.15],[-.22,-.25],[-.19,.55],[.19,.55],[.22,-.25]],.14,dark,.42);
    loft(g,[[.97,.13,.08,.52],[.25,.32,.23,.57],[-.4,.24,.18,.55],[-1.45,.015,.02,.37]],white);
    for(const s of[-1,1])hull(g,[[s*.42,.32],[s*1.33,.50],[s*1.10,.86],[s*.40,.53]],.05,white,.44);
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
    const turret=new T.Group();disc(turret,steel,0,0,.44,.67,.18);hull(turret,[[-.45,-.55],[-.60,.20],[-.32,.48],[.32,.48],[.60,.2],[.45,-.55]],.2,bronze,.50);
    for(const side of[-1,1]){block(turret,alloy,side*.24,-.80,.62,.14,1.0,.15);block(turret,gold,side*.24,-1.27,.64,.10,.08,.07);}
    disc(turret,dark,0,.13,.74,.18,.08);block(turret,gold,0,-.30,.76,.25,.05,.02);
    const moving=batch(turret);moving.name='turret';attachments.push(moving);
  }else if(kind==='carrier'){
    hull(g,[[-.5,-1.1],[-1.1,-.1],[-1,.8],[-.6,1.1],[.6,1.1],[1,.8],[1.1,-.1],[.5,-1.1]],.38,navy);
    block(g,white,0,-.10,.44,.8,1.2,.16);block(g,cyan,0,-.10,.62,.12,.6,.03);block(g,cyan,0,-.10,.62,.6,.12,.03);
    for(const side of[-1,1]){vents(g,side*.79,.25,.42,steel,5,.20);turbine(g,side*.68,.68,.47,.23,cyan);}
  }else if(kind==='relic'){
    block(g,dark,0,0,0,1.8,1.8,.3);disc(g,bronze,0,0,.25,.76,.17);
    const ring=new T.Mesh(new T.TorusGeometry(.60,.055,6,24),gold);ring.position.z=.5;g.add(ring);
    const core=ball(g,gold,0,0,.5,.35,.35,.20);core.rotation.z=Math.PI/4;
    for(const side of[-1,1]){block(g,alloy,side*.67,0,.34,.18,1.1,.13);block(g,navy,0,side*.67,.34,1.1,.18,.13);}
  }else if(['interceptor','bomber','corvette','sentinel','strider'].includes(kind)){
    const width=kind==='bomber'?2.2:kind==='corvette'?1.6:kind==='interceptor'?1.4:1.3,length=kind==='corvette'?2.5:1.6;
    hull(g,[[0,-length],[-width*.35,-length*.5],[-width,.35],[-width*.8,length*.7],[0,length],[width*.8,length*.7],[width,.35],[width*.35,-length*.5]],.32,kind==='bomber'||kind==='strider'?bronze:kind==='sentinel'?violet:navy);
    loft(g,[[length,.15,.1,.35],[.3,.32,.22,.48],[-length*.75,.18,.14,.38]],white);
    if(kind==='strider')for(const side of[-1,1])for(const end of[-1,1]){const m=block(g,bronze,side*1.15,end*.85,.18,.20,1.1,.2);m.rotation.z=side*end*.65;}
    if(kind==='sentinel')turbine(g,0,0,.45,.6,pink);
    for(const side of[-1,1])turbine(g,side*width*.58,length*.62,.42,.22,kind==='sentinel'?pink:cyan);
  }else{
    hull(g,[[0,-2.4],[-1.1,-1.3],[-1.85,.9],[-1.5,2],[1.5,2],[1.85,.9],[1.1,-1.3]],.66,dark);
    loft(g,[[2.05,.24,.20,.65],[1.2,.44,.40,.72],[-.15,.49,.37,.75],[-1.7,.24,.19,.61],[-2.48,.025,.03,.42]],white);
    hull(g,[[-.16,-2.1],[-.29,-.45],[-.26,1.6],[.26,1.6],[.29,-.45],[.16,-2.1]],.10,red,1.12);
    hull(g,[[-.12,-.95],[-.2,-.12],[.2,-.12],[.12,-.95]],.15,cockpit,1.24);
    for(const side of[-1,1]){
      hull(g,[[side*.78,-1.3],[side*1.50,-1.8],[side*1.78,-.7],[side*1.69,1.72],[side*.84,1.89]],.60,white,.55);
      block(g,red,side*1.25,.36,1.19,.33,2.33,.08);vents(g,side*1.25,.28,1.26,steel,8,.38);
      block(g,alloy,side*1.25,-1.3,.77,.38,1.12,.28);turbine(g,side*1.25,-1.38,1.09,.42,gold);
      const gun=new T.Mesh(new T.CylinderGeometry(.12,.15,2.5,12),steel);gun.position.set(side*.69,-1.0,.92);g.add(gun);
      for(let j=0;j<3;j++)block(g,alloy,side*.69,-1.8+j*.70,1.0,.37,.17,.13);
      block(g,gold,side*.69,-2.3,.93,.13,.10,.10);turbine(g,side*.75,1.56,.94,.27,gold);
      for(let j=0;j<4;j++)block(g,alloy,side*1.58,-.8+j*.58,1.12,.16,.11,.06);
    }
  }
  const result=batch(g);if(kind==='player')result.traverse(o=>{if(o instanceof T.Mesh)o.geometry.scale(.8,1.14,1.2);});
  if(kind==='cruiser')result.traverse(o=>{if(o instanceof T.Mesh)o.geometry.scale(1.25,1.22,1);});
  const skin=shipSkin(kind);if(skin){
    const geometries:T.BufferGeometry[]=[];result.traverse(o=>{if(o instanceof T.Mesh)geometries.push(o.geometry);});const proxy=mergeGeometries(geometries,false);result.clear();for(const geometry of geometries)geometry.dispose();if(proxy){const mesh=new T.Mesh(proxy,shadowProxy);mesh.castShadow=true;result.add(mesh);}
    if(['strider','sentinel','bomber'].includes(kind)){
      const mesh=new T.Mesh(new T.PlaneGeometry(skin.width,skin.height,12,12),new T.MeshBasicMaterial({map:skin.map,color:skin.color,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false,side:T.DoubleSide}));
      mesh.name='skin';mesh.position.z=1.62;mesh.userData.deformSkin=true;mesh.userData.skinWidth=skin.width;mesh.userData.skinHeight=skin.height;mesh.userData.animated=true;mesh.frustumCulled=false;result.add(mesh);
    }else{const sprite=new T.Sprite(new T.SpriteMaterial({map:skin.map,color:skin.color,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false}));sprite.name='skin';sprite.position.z=1.62;sprite.scale.set(skin.width,skin.height,1);result.add(sprite);}
  }
  for(const attachment of attachments)result.add(attachment);
  return result;
}
export function bossModel(stage:number){
  const style=STAGES[stage].bossStyle;
  const g=new T.Group(),paint=metal([0x627b8c,0x746284,0x666778][style]),accent=glow(STAGES[stage].color,2.2);
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
  if(style===0){
    block(body,navy,0,1.25,1.15,1.30,1.1,.40);hull(body,[[-.6,.9],[-.42,1.7],[.42,1.7],[.6,.9]],.12,cockpit,1.55);
    for(let i=0;i<5;i++)block(body,alloy,-.52+i*.26,.84,1.52,.06,.45,.06);
    for(const side of[-1,1]){block(body,bronze,side*.67,-2.40,1.10,.4,1.25,.27);block(body,accent,side*.67,-2.99,1.16,.26,.12,.08);}
  }else if(style===1){
    for(const side of[-1,1])hull(body,[[side*.2,1.65],[side*1.45,3.0],[side*1.12,1.05]],.18,violet,.4);
    hull(body,[[0,-2.8],[-.35,-1.9],[.35,-1.9]],.2,alloy,1.1);
  }else{
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;const m=block(body,bronze,Math.cos(a)*1.2,Math.sin(a)*1.2+.1,1.5,.52,.36,.20);m.rotation.z=a;}
    vents(body,0,1.62,1.1,alloy,6,.8);
  }
  if(stage===0)for(const side of[-1,1]){block(body,dark,side*2.0,1.7,.4,.6,3.4,.25);for(let j=0;j<5;j++)block(body,navy,side*2.0,.4+j*.65,.6,.53,.56,.05);}
  if(stage===1)for(const side of[-1,1]){hull(body,[[side*1.1,2],[side*2.3,3.4],[side*2.4,1.2],[side*1.5,-.2]],.16,alloy,.4);vents(body,side*1.6,1.4,.65,steel,8,.35);}
  if(stage===2)for(const side of[-1,1]){block(body,bronze,side*1.65,1.9,1,.6,2.0,.7);block(body,accent,side*1.65,1.9,1.37,.12,1.7,.06);}
  if(stage===3)for(let i=0;i<5;i++){const x=(i-2)*.65;hull(body,[[x-.22,1.5],[x-.30,2.5],[x,3.6-Math.abs(i-2)*.3],[x+.30,2.5],[x+.22,1.5]],.18,metal(0x9ebfcf),.6);}
  if(stage===4)for(const side of[-1,1]){hull(body,[[side*.5,1.8],[side*2.0,3.6],[side*2.7,2.8],[side*1.7,1.0]],.25,metal(0x658b77),.4);for(let i=0;i<4;i++)block(body,accent,side*(1.0+i*.22),2+i*.2,.72,.12,.30,.05);}
  if(stage===5)for(const side of[-1,1]){hull(body,[[side*1.2,1.2],[side*2.2,3.0],[side*2.8,2.5],[side*1.9,.1]],.3,bronze,.5);for(let j=0;j<4;j++)block(body,accent,side*1.75,.3+j*.42,1.24,.30,.08,.06);}
  g.add(batch(body));
  for(let i=0;i<2;i++){
    const wing=new T.Group(),side=i===0?-1:1;
    if(style===1){
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
    if(style===2)for(let j=0;j<3;j++)block(wing,paint,side*(3.8+j*.38),-.85,.60,.22,1.8-j*.25,.28);
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
  const planet=new T.Group();
  const surface=new T.Mesh(new T.SphereGeometry(23,48,32).toNonIndexed(),new T.MeshStandardMaterial({map:planetMap,roughness:1,metalness:0,color:0x8bb8ec}));surface.rotation.set(.2,1.85,.38);planet.add(surface);
  const halo=new T.Mesh(new T.SphereGeometry(23.17,48,32).toNonIndexed(),new T.MeshBasicMaterial({color:0x43a3e9,side:T.BackSide,transparent:true,opacity:.54}));planet.add(halo);
  planet.position.set(-16,9,-50);return planet;
}
