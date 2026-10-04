import * as T from 'three/webgpu';
import {block,hull,ball,batch,glow} from './art.ts';
import {surface,metalMap} from './visual-assets.ts';
import {noise,zoneAt,stageDistance,fortressVariant,LANDMARKS,type Landmark} from './bg-map.ts';
export {fortressVariant} from './bg-map.ts';
import {makeCloud} from './bg-art.ts';
import {Game} from './sim.ts';

const ROW=8;
interface Palette {deck:T.MeshStandardMaterial;plate:T.MeshStandardMaterial;steel:T.MeshStandardMaterial;dark:T.MeshStandardMaterial;core:T.MeshStandardMaterial;lamp:T.Material;warm:T.Material;glass:T.MeshPhysicalMaterial;}
function tube(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,length:number){const m=new T.Mesh(new T.CylinderGeometry(r,r,length,12),mat);m.position.set(x,y,z);g.add(m);return m;}
function drum(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,depth:number){const m=tube(g,mat,x,y,z,r,depth);m.rotation.x=Math.PI/2;return m;}
function octagon(g:T.Group,mat:T.Material,x:number,y:number,z:number,w:number,h:number,depth:number){const c=.32;return hull(g,[[x-w/2+c,y-h/2],[x+w/2-c,y-h/2],[x+w/2,y-h/2+c],[x+w/2,y+h/2-c],[x+w/2-c,y+h/2],[x-w/2+c,y+h/2],[x-w/2,y+h/2-c],[x-w/2,y-h/2+c]],depth,mat,z);}
function grating(g:T.Group,p:Palette,x:number,y:number,z:number,w:number,h:number){block(g,p.dark,x,y,z,w,h,.10);for(let i=0;i<7;i++)block(g,p.steel,x,y+(i-3)*h/8,z+.07,w*.9,.035,.045);}
function terrace(g:T.Group,p:Palette,x:number,y:number,w:number,h:number,variant:number){
  // Baked panel material plus actual stepped geometry expose side walls in the camera.
  octagon(g,p.dark,x+.14,y+.20,-5.16,w+.38,h+.34,.18);
  octagon(g,p.deck,x,y,-5.0,w,h,1.35);
  octagon(g,p.steel,x,y,-3.65,w-.15,h-.15,.12);
  octagon(g,p.plate,x,y,-3.51,w-.34,h-.34,.20);
  for(const s of[-1,1]){
    block(g,p.dark,x+s*(w/2-.22),y,-3.25,.18,h-.65,.22);
    for(let j=0;j<4;j++){block(g,j%2?p.warm:p.lamp,x+s*(w/2-.19),y+(j-1.5)*(h-.5)/4,-3.05,.065,.23,.06);}
    for(let j=0;j<3;j++)block(g,p.steel,x+s*(w/2-.33),y+(j-1)*(h-.7)/3,-3.05,.28,.06,.08);
  }
  if(variant%3===0){
    const z=-3.05;drum(g,p.dark,x,y,z,1.30,.28);drum(g,p.steel,x,y,z+.17,1.05,.19);drum(g,p.plate,x,y,z+.32,.77,.24);
    const dome=new T.Mesh(new T.SphereGeometry(.61,16,8),p.glass);dome.position.set(x,y,z+.55);dome.scale.z=.31/.61;g.add(dome);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;block(g,p.steel,x+Math.cos(a)*1.07,y+Math.sin(a)*1.07,z+.24,.15,.15,.08);}
    ball(g,p.warm,x,y,z+.83,.11,.11,.06);
  }else if(variant%3===1){
    for(const s of[-1,1]){
      octagon(g,p.plate,x+s*.80,y,-3.19,1.15,h*.65,.45);grating(g,p,x+s*.80,y+.1,-2.68,.73,h*.42);
      block(g,p.lamp,x+s*.80,y-h*.29,-2.64,.68,.05,.04);
    }
  }else{
    drum(g,p.dark,x,y,-3.17,1.29,.20);drum(g,p.plate,x,y,-3.05,1.15,.18);
    for(let i=0;i<10;i++){const a=i*Math.PI/5,b=block(g,p.steel,x+Math.cos(a)*.68,y+Math.sin(a)*.68,-2.76,.10,.74,.10);b.rotation.z=a;}
    drum(g,p.dark,x,y,-2.82,.39,.19);ball(g,p.lamp,x,y,-2.69,.18,.18,.045);
  }
  for(let j=0;j<2;j++)grating(g,p,x+(j?1:-1)*w*.30,y-h*.32,-3.23,w*.19,.46);
}
export function fortressChip(p:Palette,stage:number,v:number){
  const g=new T.Group();const shift=(v%3-1)*.6;
  // A central causeway with access floors, bolted rails and exposed utility ledges.
  const floor=block(g,p.deck,shift,0,-5.35,8.5,8,.32);floor.geometry=floor.geometry.clone();
  const uv=floor.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++){let u=uv.getX(i),vv=uv.getY(i);if(v%2){const t=u;u=vv;vv=t;}if(v&2)u=1-u;if(v&4)vv=1-vv;uv.setXY(i,u*.68+noise(v,stage,14)*.30,vv*.68+noise(v,stage,22)*.30);}
  for(const s of[-1,1]){
    block(g,p.dark,shift+s*4.30,0,-5.05,.40,8,.52);block(g,p.steel,shift+s*4.42,0,-4.80,.14,8,.13);
    for(let i=0;i<4;i++){block(g,p.warm,shift+s*4.11,-3+i*2,-4.97,.035,.27,.025);block(g,p.plate,shift+s*3.90,-3+i*2,-5.11,.35,.33,.12);}
    const sideVariant=(v+(s>0?3:0))%8,x=s*(7.9+noise(v,s,stage)*1.0),roofWidth=4.7+noise(v,s,27)*1.0,roofHeight=5.7+noise(v,s,29)*2.0,roofY=(noise(v,s,31)-.5)*1.1;
    const open=stage===1?(sideVariant===1||sideVariant===6):(sideVariant===4);
    if(!open){
      terrace(g,p,x,roofY,roofWidth,roofHeight,sideVariant);
      for(let j=0;j<3;j++){
        const xx=x+s*(1.34+j*.38);tube(g,j===1?p.plate:p.steel,xx,0,-2.62,.13+(j===1?.08:0),7.6-j*.3);
        for(let k=0;k<4;k++)block(g,p.dark,xx,-2.7+k*1.8,-2.42,.31,.14,.12);
      }
      const xx=x-s*1.8;
      block(g,p.dark,xx,.2,-2.87,.67,4.8,.27);block(g,p.steel,xx,.2,-2.67,.52,4.5,.13);block(g,p.lamp,xx,.2,-2.58,.14,3.85,.07);
      for(const yy of[-2.03,2.43])block(g,p.plate,xx,yy,-2.41,.68,.28,.27);
      for(let j=0;j<4;j++)block(g,p.plate,x+s*2.3,-2.6+j*1.7,-2.18,.25,.46,.50);
      // Raised machinery remains below the lowest combat surface.
      if(sideVariant===5){octagon(g,p.deck,x,.4,-3.0,2.2,3.8,.68);grating(g,p,x,.4,-2.28,1.64,2.85);}
      if(sideVariant===2||sideVariant===7){for(const ss of[-1,1]){octagon(g,p.steel,x+ss*.6,roofY+roofHeight*.3,-2.85,.86,1.35,.55);grating(g,p,x+ss*.6,roofY+roofHeight*.3,-2.23,.51,.77);}}
      for(let j=0;j<5;j++){const yy=j*1.4-2.8;block(g,p.dark,x-s*2.45,yy,-4.26,.48,.26,.31);block(g,p.steel,x-s*2.45,yy,-3.99,.34,.13,.08);}
    }else{
      for(const yy of[-3.75,3.65]){block(g,p.plate,x,yy,-5.13,5.45,.42,.42);block(g,p.lamp,x,yy,-4.89,4.8,.055,.03);}
      for(const ss of[-1,1])block(g,p.deck,x+ss*2.4,0,-5.8,.33,7.1,.68);
      if(stage===1)for(let j=0;j<3;j++){const shard=ball(g,p.steel,x+noise(j,v,3)*3-1.5,j*2-2,-8.0,1.1,.75,.9);shard.rotation.set(v*.4,j*.5,v);}
    }
  }
  if(v===3||v===7){
    block(g,p.dark,0,2.4,-4.98,23,.62,.55);block(g,p.plate,0,2.4,-4.64,23,.51,.14);
    for(let i=0;i<14;i++)block(g,p.warm,-10.8+i*1.65,2.4,-4.53,.21,.035,.025);
  }
  const chunk=batch(g);floor.geometry.dispose();
  chunk.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});return chunk;
}
function landmarkModel(p:Palette,entry:Landmark,stage:number){
  const g=new T.Group();
  if(entry.kind==='gate'){
    const ring=new T.Mesh(new T.TorusGeometry(5.8,.66,6,32),p.plate);ring.position.z=-4.0;g.add(ring);
    const conduit=new T.Mesh(new T.TorusGeometry(5.6,.075,5,48),p.lamp);conduit.position.z=-3.3;g.add(conduit);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=5.9,m=block(g,p.dark,Math.cos(a)*r,Math.sin(a)*r,-3.5,.34,1.1,.28);m.rotation.z=a;}
    for(const s of[-1,1]){terrace(g,p,s*7,0,3,9,1);tube(g,p.steel,s*6.5,0,-2.9,.24,13);}
  }else if(entry.kind==='reactor'){
    terrace(g,p,0,0,6.4,9,2);drum(g,p.dark,0,0,-3.0,2.4,.28);drum(g,p.steel,0,0,-2.8,2.1,.30);
    const core=drum(g,p.core,0,0,-2.48,1.64,.12);core.scale.y=.82;
    for(let i=-4;i<=4;i++){const x=i*.31,h=Math.sqrt(Math.max(0,1.64*1.64-x*x))*1.64;block(g,p.steel,x,0,-2.31,.055,h,.12);}
    for(const y of[-.72,.72])block(g,p.plate,0,y,-2.20,2.85,.10,.12);
    drum(g,p.dark,0,0,-2.17,.38,.12);drum(g,p.steel,0,0,-2.09,.27,.09);ball(g,p.warm,0,0,-2.03,.11,.11,.04);
    for(let i=0;i<16;i++){const a=i*Math.PI/8,m=block(g,p.plate,Math.cos(a)*1.9,Math.sin(a)*1.9,-2.35,.15,.77,.18);m.rotation.z=a;}
    for(const s of[-1,1]){tube(g,p.steel,s*2.3,0,-2.34,.19,8.3);tube(g,p.dark,s*2.7,0,-2.6,.23,8.9);}
  }else if(entry.kind==='port'){
    terrace(g,p,0,0,5.7,11,1);
    for(const s of[-1,1]){
      tube(g,p.steel,s*2.32,0,-2.36,.23,12);tube(g,p.dark,s*1.91,0,-2.8,.18,12);
      for(let i=0;i<6;i++)block(g,p.plate,s*2.3,i*1.8-4.5,-2.11,.64,.23,.18);
    }
    block(g,p.dark,0,0,-2.70,.80,7.8,.22);block(g,p.lamp,0,0,-2.53,.16,7.2,.04);
    for(const s of[-1,1])octagon(g,p.plate,0,s*4.6,-2.6,2.9,1.1,.42);
  }else if(entry.kind==='garden'){
    terrace(g,p,0,0,6,9,2);
    for(let i=0;i<4;i++){
      const x=(i%2?1:-1)*1.4,y=i<2?-2.25:2.25;
      drum(g,p.steel,x,y,-2.8,.77,.22);const glass=ball(g,p.glass,x,y,-2.50,.61,1.0,.36);glass.rotation.z=stage===1?.35:0;
      block(g,p.lamp,x,y,-2.11,.09,1.5,.045);
    }
  }else{
    // A broken cruiser embedded in the deck, with torn ribs and dark engines.
    hull(g,[[-2,-5],[-3.4,-2.8],[-3.1,2.5],[-1.4,5.3],[1.3,4.8],[2.8,1],[2.2,-3.5]],.46,p.dark,-4.1);
    for(const s of[-1,1]){
      hull(g,[[s*.4,-4.6],[s*2.5,-2.7],[s*2.3,3.2],[s*.7,4.9]],.50,p.plate,-3.7);
      tube(g,p.steel,s*1.6,0,-2.9,.24,7.4);
      for(let i=0;i<8;i++){const m=block(g,p.steel,s*1.5,-3.3+i*.9,-2.9,2.1,.11,.12);m.rotation.z=s*.17;}
    }
    drum(g,p.dark,0,-3.3,-3.28,.86,.32);block(g,p.warm,-.8,-1.2,-2.63,.14,.31,.08);
    g.rotation.z=.22;
  }
  return batch(g);
}
export class FortressBackground {
  root=new T.Group();private stage=-1;private templates:T.Group[]=[];private rows=new Map<number,T.Group>();private materials:T.Material[]=[];private objects:T.Group[]=[];
  private far:T.Group[]=[];private clouds:T.Sprite[]=[];private cloudTexture:T.CanvasTexture;distance=0;
  constructor(){this.cloudTexture=new T.CanvasTexture(makeCloud());this.cloudTexture.colorSpace=T.SRGBColorSpace;this.setStage(0);}
  private setStage(stage:number){
    if(stage===this.stage)return;this.stage=stage;this.root.clear();this.rows.clear();for(const t of [...this.templates,...this.objects,...this.far])t.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});for(const m of this.materials)m.dispose();this.objects=[];this.far=[];this.clouds=[];
    const p:Palette={deck:surface(0x9aa7b5),plate:surface(0xa6b2bc),steel:surface(0x6e8194,true),dark:surface(0x384754),core:new T.MeshStandardMaterial({map:metalMap,bumpMap:metalMap,bumpScale:.085,color:0x285779,roughness:.25,metalness:.6,emissive:0x31b4ff,emissiveMap:metalMap,emissiveIntensity:4}),lamp:glow(stage===2?0x24acff:stage===1?0x5469ff:0x1fafff,2.25),warm:glow(0xff9b47,1.75),glass:new T.MeshPhysicalMaterial({color:0x17263b,metalness:.68,roughness:.13,clearcoat:1})};
    this.materials=Object.values(p);this.templates=Array.from({length:8},(_,v)=>fortressChip(p,stage,v));
    this.objects=LANDMARKS[stage].map(entry=>{const m=landmarkModel(p,entry,stage);m.scale.set(entry.scale,entry.scale,1);m.position.x=entry.x;m.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.root.add(m);return m;});
    for(let i=0;i<7;i++){
      const g=new T.Group(),x=(i%2?1:-1)*(8+noise(i,stage)*4);
      for(let j=0;j<6;j++){const m=block(g,p.dark,(noise(i,j,5)-.5)*5,j*1.4-4,0,.6+noise(i,j)*1.4,1.3,.4+noise(i,j,9));m.rotation.z=noise(i,j,3)*.2;}
      const m=batch(g);m.position.set(x,0,-18);this.root.add(m);this.far.push(m);
    }
    for(let i=0;i<4;i++){
      const mat=new T.SpriteMaterial({map:this.cloudTexture,color:stage===2?0x9b8171:0x617a9b,transparent:true,opacity:i<2?.12:.10,depthWrite:false});this.materials.push(mat);
      const cloud=new T.Sprite(mat);cloud.position.z=i<2?3:-12;cloud.scale.set(30,26,1);this.root.add(cloud);this.clouds.push(cloud);
    }
  }
  draw(g:Game){
    this.setStage(g.stage);this.distance=g.state==='title'?18+g.visualTime*1.4:stageDistance(g.time);const centre=Math.floor(this.distance/ROW),live=new Set<number>();
    for(let row=centre-4;row<=centre+5;row++){
      live.add(row);let m=this.rows.get(row);if(!m){m=this.templates[fortressVariant(g.stage,row)].clone();this.rows.set(row,m);this.root.add(m);}m.position.y=row*ROW-this.distance;
    }
    for(const [row,m]of this.rows)if(!live.has(row)){this.root.remove(m);this.rows.delete(row);}
    this.objects.forEach((m,i)=>{m.position.y=LANDMARKS[g.stage][i].distance-this.distance;m.visible=Math.abs(m.position.y)<42;});
    this.far.forEach((m,i)=>{m.position.y=((i*13-this.distance*.30)%91+91)%91-45;});
    this.clouds.forEach((m,i)=>{m.position.x=(i%2?1:-1)*(18+Math.sin(this.distance*.008+i)*3);m.position.y=((i*37-this.distance*(i<2?1.38:.16))%126+126)%126-63;});
  }
  getTemplate(stage:number,variant:number){this.setStage(stage);return this.templates[variant];}
  getLandmark(stage:number,index:number){this.setStage(stage);const m=this.objects[index].clone();m.position.set(0,0,0);return m;}
  diagnostics(){return {technique:'TEXTURED 3D BG CHIPS',zone:zoneAt(this.stage,this.distance),distance:Math.round(this.distance),layers:4,speeds:[.30,1,1.38,.16],chunks:this.rows.size,landmarks:5};}
}
