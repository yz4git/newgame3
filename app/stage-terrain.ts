import * as T from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {flightCentre} from './flight-route.ts';
import {shadeSolid} from './physical-surface.ts';

export const WORLD_IDENTITIES=[
 {id:'orbital-debris',name:'ORBITAL SALVAGE',topology:'open-void',sky:0x030611},
 {id:'pelagic-archipelago',name:'PELAGIC FLEET',topology:'open-ocean-islands',sky:0x17445c},
 {id:'vertical-citadel',name:'NEON CITADEL',topology:'layered-city',sky:0x060817},
 {id:'polar-fracture',name:'POLAR CHASM',topology:'jagged-glacial-gorge',sky:0x648ea1},
 {id:'canopy-sanctuary',name:'CANOPY SANCTUARY',topology:'rainforest-waterfalls',sky:0x18382b},
 {id:'radial-caldera',name:'CRUCIBLE CALDERA',topology:'open-caldera-craters',sky:0x251012}
] as const;
export const WORLD_COLOURS=[
 [0x121b2d,0x45546c,0xa89172,0x142a49,0x35445e,0xffa364],
 [0x153849,0x547b88,0xc0d2d1,0x244759,0x125b78,0xa5dbde],
 [0x13192e,0x354367,0x91a4ba,0x24284d,0x253557,0x77bce8],
 [0x204863,0x5794ad,0xd1e3e5,0x326884,0x225775,0xbce7ec],
 [0x292c20,0x5e7050,0xb1b293,0x183f2c,0x1c5a48,0xc9d2a6],
 [0x21191c,0x493d38,0xa8825e,0x30242b,0x912907,0xff752b]
] as const;
const noise=(n:number)=>{const x=Math.sin(n*127.13+17.7)*43758.5453;return x-Math.floor(x);};

function geometry(vertices:number[],indices:number[],colors:number[]){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);
 g.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((_,i)=>i%3===0?[vertices[i]*.02,vertices[i+1]*.02]:[]),2));
 g.computeVertexNormals();return g;
}
const physical=(g:T.BufferGeometry,name:string,roughness=.86,metalness=.02)=>{
 const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness,metalness,side:T.DoubleSide}));
 mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=true;return mesh;
};

/** Only the glacial gorge and rainforest have banks. Space, sea, city and
 * caldera are built from different physical ground topologies. */
function bank(stage:number,length:number,side:number,c:readonly number[]){
 const v:number[]=[],rgb:number[]=[],idx:number[]=[],rows=90,cols=10;
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const y=-85+(length+190)*row/rows,u=col/cols;
  const edge=stage===3?8+Math.sin(y*.055)*2.8+noise(row*.41+side)*2:5.5+Math.sin(y*.072+side)*2.2;
  const x=flightCentre(stage,y)+side*(edge+Math.pow(u,.8)*67);
  const height=stage===3?10+noise(row*.68+col*7)*18:3+noise(row*.31+col*9)*10;
  let terrace=0;
  if(stage===4)for(const at of[.19,.39,.61,.81])terrace=Math.max(terrace,11*Math.exp(-(((y-length*at)/8)**2+(u/.15)**2)));
  const z=stage===3?-37+height*(.32+Math.sin(u*Math.PI*.65)*.68):-37+height*Math.sin(u*Math.PI*.68)+terrace;
  v.push(x,y,z);
  const color=new T.Color(stage===3?c[1]:c[3]);
  color.lerp(new T.Color(stage===3?c[2]:c[1]),stage===3?Math.max(0,(z+31)/22):noise(row*.7+col)*.35);
  color.multiplyScalar(.86+noise(row+col*17)*.20);rgb.push(color.r,color.g,color.b);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const n=row*(cols+1)+col,r=n+cols+1;
  if(side>0)idx.push(n,n+1,r,n+1,r+1,r);else idx.push(n,r,n+1,n+1,r,r+1);
 }
 for(let row=0;row<rows;row++){
  const a=row*(cols+1),b=(row+1)*(cols+1),n=v.length/3;
  v.push(v[a*3],v[a*3+1],-62,v[b*3],v[b*3+1],-62);
  const color=new T.Color(c[0]);rgb.push(color.r,color.g,color.b,color.r,color.g,color.b);
  idx.push(a,n,b,b,n,n+1);
 }
 let g=geometry(v,idx,rgb);
 if(stage===3){const faceted=g.toNonIndexed();g.dispose();g=faceted;g.computeVertexNormals();}
 return physical(g,(stage===3?'jagged-glacial-cliff-':'rainforest-river-bank-')+side,stage===3?.48:.96);
}

function mound(x:number,y:number,rx:number,ry:number,seed:number,c:readonly number[],crater=false){
 const v:number[]=[],rgb:number[]=[],idx:number[]=[],segments=28,radii=crater?[.32,.60,1,1.16]:[0,.35,.77,1.10];
 for(let ring=0;ring<radii.length;ring++)for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,r=radii[ring]*(.92+noise(seed+i*1.3)*.15);
  const z=crater?[-48,-29,-40,-54][ring]+noise(seed+i+ring*31)*2:[-32,-33,-39,-52][ring]+noise(seed+i+ring*31)*1.6;
  v.push(x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r,z);
  const color=new T.Color(crater?c[ring===1?1:0]:ring<2?0x47715b:ring===2?0x9ba185:c[0]);
  color.multiplyScalar(.84+noise(seed+i+ring*9)*.23);rgb.push(color.r,color.g,color.b);
 }
 for(let ring=0;ring<radii.length-1;ring++)for(let i=0;i<segments;i++){
  const a=ring*segments+i,b=ring*segments+(i+1)%segments,d=a+segments,e=b+segments;idx.push(a,d,b,b,d,e);
 }
 return geometry(v,idx,rgb);
}

function waterfall(x:number,y:number,seed:number){
 const v:number[]=[],rgb:number[]=[],idx:number[]=[],uv:number[]=[],mask:number[]=[],rows=14,cols=4;
 for(const side of[-1,1])for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const t=row/rows,xx=x+(col/cols-.5)*(6.8-t*1.3);
  v.push(xx,y+Math.sin(t*Math.PI)*1.2+side*.22,-26-t*22);
  const color=new T.Color(row>11?0xb6e0d6:0x60b0ac);color.multiplyScalar(.87+noise(seed+row+col)*.13);
  rgb.push(color.r,color.g,color.b);uv.push(col/cols,t);mask.push(0);
 }
 const face=(rows+1)*(cols+1);
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const a=row*(cols+1)+col,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1,a+face,a+1+face,b+face,a+1+face,b+1+face,b+face);
 }
 // Side faces make the falling sheet a thin water volume, not an alpha card.
 for(let row=0;row<rows;row++)for(const col of[0,cols]){
  const a=row*(cols+1)+col,b=a+cols+1;idx.push(a,a+face,b,b,a+face,b+face);
 }
 const g=geometry(v,idx,rgb);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('flowMask',new T.Float32BufferAttribute(mask,1));return g;
}

function flow(stage:number,length:number,c:readonly number[]){
 let g:T.BufferGeometry=new T.PlaneGeometry(205,length+205,40,120);
 const base=stage===3?-56:stage===5?-51:-48;g.translate(0,length/2,base);
 const p=g.getAttribute('position'),rgb=new Float32Array(p.count*3),mask=new Float32Array(p.count).fill(1);
 const dark=new T.Color(stage===5?0x682007:c[4]);
 const light=new T.Color(stage===5?0xf87921:stage===1?0x498eaa:stage===3?0x88b9c6:0x5b9481);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i);
  let vein=Math.max(0,Math.sin(x*.11+Math.sin(y*.055)*2.1)*Math.sin(y*.17+x*.035));
  if(stage===3)vein=Math.abs(Math.sin(x*.22+Math.sin(y*.084)*2.8))>.97?0:1;
  const color=dark.clone().lerp(light,vein*(stage===5?.90:stage===3?.52:.44));rgb.set([color.r,color.g,color.b],i*3);
 }
 g.setAttribute('color',new T.BufferAttribute(rgb,3));g.setAttribute('flowMask',new T.BufferAttribute(mask,1));
 if(stage===4){
  const parts=[g];for(let i=0;i<4;i++){const y=length*[.19,.39,.61,.81][i],x=flightCentre(stage,y)+(i%2?11:-11);parts.push(waterfall(x,y,17+i));}
  const joined=mergeGeometries(parts,false);if(!joined)throw new Error('Waterfall geometry mismatch');for(const p of parts)p.dispose();g=joined;
 }
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:stage===1?.62:stage===5?.12:.24,
  roughness:stage===1?.23:stage===3?.31:.39,side:T.DoubleSide,emissive:stage===5?0xb12e08:0,emissiveIntensity:stage===5?.42:0});
 const mesh=new T.Mesh(g,m);mesh.name=stage===1?'open-pelagic-water':stage===3?'fractured-frozen-chasm-floor':stage===4?'rainforest-river-and-waterfalls':'molten-caldera-surface';mesh.receiveShadow=true;
 mesh.userData.flowPositions=new Float32Array(g.getAttribute('position').array);
 mesh.userData.flowNormals=new Float32Array(g.getAttribute('normal').array);return mesh;
}

export function stageTerrain(stage:number,length:number,c:readonly number[]){
 const meshes:T.Mesh[]=[],surfaces:T.Mesh[]=[];
 if(stage===1||stage===5){
  const parts=[];
  for(let i=0;i<7;i++){
   const y=18+i*(length-25)/7,x=flightCentre(stage,y)+(i%2?-1:1)*(stage===1?32:18+(i%3)*4);
   parts.push(mound(x,y,stage===1?18:19,stage===1?23:18,stage*19+i,c,stage===5));
  }
  const merged=mergeGeometries(parts,false);if(!merged)throw new Error('Terrain merge failed');for(const p of parts)p.dispose();
  meshes.push(physical(merged,stage===1?'separate-coastal-islands':'radial-basalt-calderas',stage===1?.92:.78));
 }
 if(stage===2){
  const g=shadeSolid(new T.BoxGeometry(190,length+190,7),.20);g.translate(0,length/2,-41.5);
  const mesh=physical(g,'solid-city-foundation',.74,.20);(mesh.material as T.MeshStandardMaterial).color.setHex(c[0]);meshes.push(mesh);
 }
 if(stage===3||stage===4)for(const side of[-1,1])meshes.push(bank(stage,length,side,c));
 if([1,3,4,5].includes(stage)){const surface=flow(stage,length,c);meshes.push(surface);surfaces.push(surface);}
 return {meshes,surfaces};
}

export function orbitalMoon(){
 const g=new T.SphereGeometry(1,36,20),p=g.getAttribute('position'),rgb=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),crust=Math.sin(x*16+y*4)*Math.sin(y*13-z*9)+Math.sin(z*21+x*7)*.4;
  const relief=1+crust*.008;p.setXYZ(i,x*relief,y*relief,z*relief);
  const color=new T.Color(0x536c81).lerp(new T.Color(0xb2bcb9),Math.max(0,Math.min(1,.50+crust*.22)));rgb.set([color.r,color.g,color.b],i*3);
 }
 g.setAttribute('color',new T.BufferAttribute(rgb,3));g.computeVertexNormals();
 const moon=physical(g,'distant-sculpted-orbital-moon',.99);moon.position.set(29,18,-91);moon.scale.setScalar(32);moon.castShadow=false;moon.receiveShadow=false;return moon;
}
