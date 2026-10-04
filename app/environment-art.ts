import * as T from 'three/webgpu';
import {block,hull,batch} from './art.ts';
import {noise,type Landmark} from './bg-map.ts';
import {STAGES} from './stages.ts';

export interface EnvironmentPalette {
  deck:T.MeshStandardMaterial;plate:T.MeshStandardMaterial;steel:T.MeshStandardMaterial;dark:T.MeshStandardMaterial;core:T.MeshStandardMaterial;
  lamp:T.Material;warm:T.Material;glass:T.MeshPhysicalMaterial;
  rock:T.MeshStandardMaterial;ice:T.MeshStandardMaterial;snow:T.MeshStandardMaterial;moss:T.MeshStandardMaterial;
  water:T.MeshStandardMaterial;lava:T.MeshStandardMaterial;foliage:T.MeshStandardMaterial;foam:T.MeshBasicMaterial;rust:T.MeshStandardMaterial;
}

const TAU=Math.PI*2;
function drum(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,h:number,segments=12){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments).rotateX(Math.PI/2),mat);m.position.set(x,y,z);g.add(m);return m;}
function pipe(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,len:number){const m=new T.Mesh(new T.CylinderGeometry(r,r,len,10),mat);m.position.set(x,y,z);g.add(m);return m;}
function ring(g:T.Group,mat:T.Material,x:number,y:number,z:number,r:number,t:number,segments=40){const m=new T.Mesh(new T.TorusGeometry(r,t,6,segments),mat);m.position.set(x,y,z);g.add(m);return m;}
function platform(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,w:number,h:number,depth=1){
  for(let k=0;k<3;k++){const inset=k*.13,ww=w-inset*2,hh=h-inset*2,a=.65;
    hull(g,[[x-ww/2+a,y-hh/2],[x+ww/2-a,y-hh/2],[x+ww/2,y-hh/2+a],[x+ww/2,y+hh/2-a],[x+ww/2-a,y+hh/2],[x-ww/2+a,y+hh/2],[x-ww/2,y+hh/2-a],[x-ww/2,y-hh/2+a]],k===0?depth:.13,[p.deck,p.steel,p.plate][k],z+(k===0?0:depth+(k-1)*.14));
  }
}
function vents(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,w:number,h:number){block(g,p.dark,x,y,z,w,h,.10);for(let i=0;i<6;i++)block(g,p.steel,x,y+(i-2.5)*h/7,z+.08,w*.87,.055,.04);}
function rail(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,len:number){pipe(g,p.steel,x,y,z,.045,len);for(let i=0;i<5;i++)block(g,p.steel,x,y+(i-2)*len/5,z-.22,.07,.07,.45);}
export function rock(g:T.Group,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,seed:number,detail=1){
  const geo=new T.IcosahedronGeometry(1,detail),v=geo.getAttribute('position');
  for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),n=.76+noise(Math.round(px*43)+seed,Math.round(py*47)+Math.round(pz*53),seed)*.36;v.setXYZ(i,px*n,py*n,pz*n);}
  geo.computeVertexNormals();const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=noise(seed,3)*TAU;g.add(m);return m;
}
function canopy(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,size:number,seed:number){
  const m=new T.Mesh(new T.PlaneGeometry(size,size),p.foliage);m.position.set(x,y,z);m.rotation.z=noise(seed,7)*TAU;g.add(m);
}
function crystal(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,height:number,seed:number){
  const m=new T.Mesh(new T.ConeGeometry(.35+noise(seed,7)*.25,height,5).rotateX(Math.PI/2),p.ice);m.position.set(x,y,z);m.rotation.set(-.50,.12,noise(seed,3));g.add(m);
  ring(g,p.lamp,x,y,z-height/2,.4,.025,12);
}
function cliff(g:T.Group,p:EnvironmentPalette,side:number,v:number,stage:number){
  const env=STAGES[stage].environment,edge=(env==='ice'?4.45:5.25)+(v%3)*.52;
  const points:number[][]=[[side*14,-4.18],[side*14,4.18]];
  for(let i=0;i<7;i++)points.push([side*(edge+noise(v,i,stage+62)*1.45),4.18-i*8.36/6]);
  const base=env==='ice'?p.ice:env==='jungle'?p.moss:p.rock;
  hull(g,points,4.8,base,-7.4);
  if(env!=='lava'){
    const cap=points.map(([x,y],i)=>[x+(env==='ice'&&i>=2?side*1.55:0),y]);hull(g,cap,.37,env==='ice'?p.snow:p.moss,-2.55);
  }
  for(let i=0;i<7;i++){
    const x=side*(edge+.6+noise(v,i,16)*2.4),y=-3.8+i*1.25;
    rock(g,base,x,y,-4.0,.75+noise(i,v)*.8,1.0,1.9,v*17+i*7+side,1);
    if(env==='ice'){
      rock(g,p.snow,x+side*.8,y,-2.1,.80,.74,.20,v*11+i);
      if(i%3===v%3)for(let k=0;k<3;k++)crystal(g,p,x+side*(1+k*.33),y+k*.22,-1.55,1.20+noise(v,i+k,83)*1.5,v+i+k);
    }else if(env==='jungle'){
      canopy(g,p,x+side*1.1,y,-1.4,3.9+noise(v,i,36),v*11+i);
      if(i%3===0)block(g,p.lamp,x-side*.35,y,-2.0,.05,.65,.05);
    }
  }
}
function dish(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number){
  drum(g,p.steel,x,y,z,.55,.14);block(g,p.steel,x,y,z+.45,.18,.18,.80);
  const antenna=new T.Mesh(new T.SphereGeometry(1,16,8,0,TAU,0,Math.PI*.47),p.plate);antenna.rotation.x=.45;antenna.position.set(x,y,z+.62);antenna.scale.set(1,1,.28);g.add(antenna);
  for(const s of[-1,1])block(g,p.steel,x+s*.55,y,z+.88,.8,.03,.04);
  block(g,p.warm,x,y,z+1.14,.12,.12,.08);
}
function outpost(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,w=4,h=5,variant=0){
  platform(g,p,x,y,z,w,h,.85);
  for(const s of[-1,1]){
    rail(g,p,x+s*(w/2-.12),y,z+1.25,h-.5);
    pipe(g,p.steel,x+s*w*.33,y,z+1.0,.10,h*.8);
    for(let i=0;i<3;i++)block(g,p.warm,x+s*(w/2-.30),y+(i-1)*h/3,z+.97,.07,.18,.06);
  }
  if(variant%4===0){
    for(let i=0;i<3;i++)vents(g,p,x+(i-1)*w*.22,y-h*.20,z+1.18,w*.15,1.25);
    dish(g,p,x,y+h*.18,z+1.17);
  }else if(variant%4===1){
    platform(g,p,x,y,z+1.1,w*.60,h*.60,.47);vents(g,p,x,y,z+1.87,w*.43,h*.4);
    for(let i=0;i<3;i++){pipe(g,p.steel,x+(i-1)*.26,y,z+1.9,.09,h*.43);}
    for(const s of[-1,1])block(g,p.lamp,x+s*w*.35,y,z+1.35,.06,h*.53,.05);
  }else if(variant%4===2){
    drum(g,p.dark,x,y,z+1.15,Math.min(w,h)*.35,.15);ring(g,p.plate,x,y,z+1.29,Math.min(w,h)*.32,.055);
    for(const s of[-1,1])block(g,p.plate,x+s*.34,y,z+1.3,.10,1.05,.03);block(g,p.plate,x,y,z+1.3,.8,.09,.03);
    dish(g,p,x+w*.3,y+h*.25,z+1.16);
  }else{
    for(let i=0;i<3;i++){const yy=y+(i-1)*h*.26;block(g,p.rust,x-w*.10,yy,z+1.4,w*.53,h*.20,.52);for(let j=0;j<6;j++)block(g,p.steel,x-w*.10+(j-2.5)*w*.07,yy,z+1.71,.025,h*.18,.045);}
    block(g,p.steel,x+w*.25,y,z+1.65,.18,h*.63,.18);block(g,p.rust,x,y+h*.23,z+1.96,w*.8,.17,.13);
    for(let i=0;i<4;i++){const m=block(g,p.steel,x-w*.25+i*w*.17,y+h*.23,z+2.02,.35,.04,.04);m.rotation.z=i%2?.55:-.55;}
  }
}
function bridge(g:T.Group,p:EnvironmentPalette,x:number,y:number,z:number,w=24){
  block(g,p.dark,x,y,z,w,1.25,.38);block(g,p.plate,x,y,z+.25,w,1.05,.15);
  for(const s of[-1,1]){
    block(g,p.steel,x,y+s*.52,z+.52,w,.06,.06);
    for(let i=0;i<15;i++)block(g,p.steel,x-w/2+.4+i*(w-.8)/14,y+s*.52,z+.32,.07,.07,.40);
  }
  for(let i=0;i<8;i++)block(g,p.warm,x-w/2+1.2+i*(w-2.4)/7,y,z+.36,.10,.07,.05);
}

export function environmentChip(p:EnvironmentPalette,stage:number,v:number){
  const g=new T.Group(),machines=new T.Group(),env=STAGES[stage].environment;
  if(env==='asteroids'){
    for(const s of[-1,1]){
      for(let j=0;j<3;j++){const x=s*(8+noise(v,j,43)*4),y=-3+j*2.8;rock(g,p.rock,x,y,-5.7,2.2+noise(v,j,51)*1.5,1.9+noise(v,j)*1.1,2.1,v*9+j+s,3);}
      if(v%3!==1){outpost(machines,p,s*(9.1+(v%2)),(noise(v,s,92)-.5)*2,-3.9,3.1+noise(v,s,91),4.4+noise(v,s,93)*2.3,v+(s>0?2:0));}
    }
    for(let i=0;i<5;i++){const x=(noise(v,i,68)-.5)*14,y=(noise(v,i,9)-.5)*8;rock(g,p.rock,x,y,-9,.2+noise(v,i,67)*.55,.35,.37,v*17+i);}
    if(v===2||v===6){const x=v===2?-6:7;hull(g,[[x-1,-2],[x+1.6,-1],[x+1,2],[x-1.6,2.4]],.30,p.plate,-6.2);for(let i=0;i<4;i++)block(g,p.steel,x,-1+i,-5.9,3,.08,.12);}
  }else if(env==='ocean'){
    for(const s of[-1,1]){
      const x=s*(8.9+noise(v,s,42)*1.1),y=(noise(v,s,44)-.5)*3;
      if((v+(s>0?2:0))%4!==1){
        for(const ss of[-1,1])for(const yy of[-1,1])drum(machines,p.steel,x+ss*1.55,y+yy*2.05,-6.0,.30,4.0);
        outpost(machines,p,x,y,-3.8,4.3+noise(v,s,81)*2,4.2+noise(v,s,88)*2.8,v+(s>0?2:0));
        if(v%3===0)bridge(machines,p,x-s*3.3,y+2.4,-2.9,4.7);
        block(machines,p.lamp,x+s*1.9,y,-2.3,.07,3.1,.06);
      }
    }
  }else{
    for(const s of[-1,1])cliff(g,p,s,v,stage);
    if(env==='ice'){
      for(let i=0;i<3;i++)rock(g,p.ice,(noise(v,i,42)-.5)*8,(i-1)*2.3,-8,.45,.7,.55,v+i);
      if(v===2||v===6){const x=v===2?-9:9;platform(machines,p,x,0,-2.8,3.9,4.3,.55);block(machines,p.plate,x,0,-1.8,2.5,2.9,.75);block(machines,p.rust,x,0,-1.35,2.54,.29,.13);vents(machines,p,x,0,-.92,1.6,1.7);}
    }else if(env==='jungle'){
      for(const s of[-1,1]){
        const x=s*(7.9+noise(v,s,72));
        if(v%2===0){for(let k=0;k<3;k++)block(machines,p.moss,x,0,-2.4+k*.24,4.8-k*.4,4.4-k*.5,.35);block(machines,p.lamp,x-s*2.02,0,-1.65,.06,2.6,.04);}
        for(let j=0;j<2;j++){canopy(g,p,s*(11+noise(v,j,87)*1.3),j*4-2,-.95,5.4,v*7+j+s);}
        rock(g,p.rock,s*4.8,noise(v,s,56)*6-3,-7.2,.8,.6,.4,v+s);
      }
    }else{
      // The lava bed itself is a separate moving surface below basalt and machinery.
      for(const s of[-1,1]){
        const x=s*(9.7+noise(v,s,32)*.5);
        outpost(machines,p,x,(noise(v,s,78)-.5)*2,-3.7,4.9,6.2,v+(s>0?1:0));
        for(let j=0;j<3;j++){pipe(machines,p.steel,x+s*(.3+j*.4),0,-2.6,.15,7.5);for(let k=0;k<4;k++)block(machines,p.rust,x+s*(.3+j*.4),-2.6+k*1.7,-2.45,.42,.18,.14);}
        for(let j=0;j<2;j++){const xx=x-s*1.1,yy=j*3.6-1.8;drum(machines,p.dark,xx,yy,-2.2,.62,.42);drum(machines,p.lava,xx,yy,-1.96,.44,.12);ring(machines,p.rust,xx,yy,-1.9,.55,.06);}
      }
      if(v===3||v===7)bridge(machines,p,0,1.8,-3.25);
      const points:number[][]=[[-3.0,-4.3],[-3.8,-2.0],[-2.8,.1],[-3.5,2.8],[-2.9,4.3],[3.2,4.3],[2.9,2.0],[3.5,-.3],[2.6,-2.4],[3.0,-4.3]];
      hull(g,points,.63,p.rock,-6.1);
    }
  }
  const root=new T.Group(),terrain=finish(g),equipment=finish(machines);terrain.name='terrain';equipment.name='installations';root.add(terrain,equipment);return root;
}

export function environmentLandmark(p:EnvironmentPalette,entry:Landmark,stage:number):T.Group|undefined{
  const g=new T.Group(),env=STAGES[stage].environment;
  if(entry.kind==='orbital'){
    rock(g,p.rock,0,0,-5.7,4.8,5.8,2.1,stage+13,2);
    ring(g,p.dark,0,0,-3.6,5.4,.49);ring(g,p.plate,0,0,-3.1,5.4,.27);ring(g,p.lamp,0,0,-2.74,5.15,.04);
    for(let i=0;i<14;i++){const a=i/14*TAU,m=block(g,p.steel,Math.cos(a)*5.35,Math.sin(a)*5.35,-2.66,.8,.55,.36);m.rotation.z=a;block(g,p.warm,Math.cos(a)*5.35,Math.sin(a)*5.35,-2.42,.12,.08,.04);}
    outpost(g,p,0,-1,-3.7,3.0,4.1);
  }else if(entry.kind==='oilrig'){
    for(const x of[-2,2])for(const y of[-2.8,2.8])drum(g,p.steel,x,y,-5.3,.48,4.8);
    platform(g,p,0,0,-3.4,6.4,9.5,.85);
    drum(g,p.dark,0,1.5,-2.45,2.3,.08);ring(g,p.plate,0,1.5,-2.36,2.1,.06);
    for(const s of[-1,1])block(g,p.plate,s*.58,1.5,-2.28,.16,1.55,.035);block(g,p.plate,0,1.5,-2.28,1.28,.16,.035);
    for(const s of[-1,1])rail(g,p,s*2.94,0,-2.25,8.7);
    for(let i=0;i<3;i++){block(g,p.rust,(i-1)*1.8,-2.4,-2.10,1.35,2.0,.6);vents(g,p,(i-1)*1.8,-2.4,-1.76,1.05,1.5);}
    dish(g,p,-1.9,3.4,-2.25);bridge(g,p,-5,0,-3.0,5.2);
    drum(g,p.plate,2.7,-2.6,-2.3,.62,.5);
  }else if(entry.kind==='submarine'){
    hull(g,[[0,-8.5],[-1.25,-6.5],[-1.75,3.5],[-1.2,6.6],[0,8.1],[1.2,6.6],[1.75,3.5],[1.25,-6.5]],.77,p.deck,-5.6);
    hull(g,[[-1.0,-6.3],[-1.25,4.0],[0,6.8],[1.25,4.0],[1,-6.3]],.28,p.plate,-4.84);
    for(const s of[-1,1]){pipe(g,p.steel,s*1.28,0,-4.30,.17,11.8);rail(g,p,s*1.39,0,-4.19,12.5);for(let i=0;i<5;i++)vents(g,p,s*.64,-4+i*1.8,-4.28,.52,.74);}
    block(g,p.dark,0,1.7,-4.20,.85,3.0,.77);block(g,p.deck,0,1.7,-3.48,.65,2.7,.4);
    for(let i=0;i<3;i++)block(g,p.steel,(i-1)*.18,2,-2.68,.09,.09,1.1-i*.15);
    block(g,p.lamp,0,-5.5,-4.09,.10,1.1,.04);drum(g,p.steel,0,4.6,-4.34,.6,.21);
    g.rotation.z=-.10;
  }else if(entry.kind==='glacier'){
    for(let i=0;i<9;i++){const x=(noise(i,stage,91)-.5)*5,y=(noise(i,stage,94)-.5)*7;rock(g,p.ice,x,y,-5,1.3,1.7,3.1,i+24,2);rock(g,p.snow,x,y,-1.95,1.13,1.36,.19,i+24);}
    for(let i=0;i<6;i++)crystal(g,p,Math.sin(i*2.4)*2.5,Math.cos(i*2.4)*3.4,-1.7,1.5+i*.13,i+71);
  }else if(entry.kind==='station'){
    rock(g,p.ice,0,0,-5.2,4.8,6.1,2.8,94,2);platform(g,p,0,0,-3,6.8,9.2,.62);
    for(const s of[-1,1]){block(g,p.plate,s*1.57,0,-1.80,2.15,5.8,.70);block(g,p.rust,s*1.57,0,-1.36,2.20,.34,.18);vents(g,p,s*1.57,0,-1.0,1.65,4.35);pipe(g,p.steel,s*2.0,0,-.84,.10,4.5);}
    for(const yy of[-3.25,3.25]){bridge(g,p,0,yy,-2.25,6);dish(g,p,1.9,yy,-2.35);}
    for(let i=0;i<4;i++)pipe(g,p.steel,-3.7+i*.28,0,-1.75,.10,9.5);
  }else if(entry.kind==='temple'||(env==='jungle'&&entry.kind==='gate')){
    for(let i=0;i<5;i++){const r=5.2-i*.3;ring(g,p.moss,0,0,-3.9+i*.26,r,.30,48);}
    ring(g,p.lamp,0,0,-2.52,3.86,.052,64);ring(g,p.steel,0,0,-2.7,3.58,.11,48);
    for(let i=0;i<20;i++){const a=i/20*TAU;const m=block(g,p.moss,Math.cos(a)*4.7,Math.sin(a)*4.7,-2.1,.74,.55,.8);m.rotation.z=a;}
    drum(g,p.dark,0,0,-3.5,3.3,.18);for(let i=0;i<4;i++)ring(g,p.lamp,0,0,-3.27+i*.03,.55+i*.65,.03);
    for(let i=0;i<5;i++){const a=i/5*TAU;canopy(g,p,Math.cos(a)*5.8,Math.sin(a)*5.8,-1.35,2.3,i+84);}
    for(const s of[-1,1]){for(let i=0;i<4;i++)block(g,p.moss,s*5.8,0,-4.0+i*.4,3.3-i*.35,6-i*.55,.5);block(g,p.lamp,s*4.9,0,-2.3,.06,4.4,.05);}
  }else if(entry.kind==='waterfall'){
    for(let i=0;i<6;i++)rock(g,p.moss,(noise(i,stage,83)-.5)*5,(noise(i,stage,47)-.5)*8,-4.5,2.0,2.1,2.4,i+14,2);
    for(let i=0;i<5;i++)block(g,p.moss,0,2.5,-2.8+i*.30,5.5-i*.38,3.5-i*.32,.4);
    for(let i=0;i<7;i++){const x=(i-3)*.21;block(g,p.foam,x,-1,-4.8,.10,6.8+noise(i,stage)*1.2,.10);}
    for(let i=0;i<5;i++)canopy(g,p,(i%2?1:-1)*2.4,i*1.7-3.5,-1.4,3.3,i+48);
    ring(g,p.foam,0,-4.6,-7.0,1.5,.05);
  }else if(entry.kind==='furnace'){
    platform(g,p,0,0,-4.6,6.8,10.3,1.0);
    for(const yy of[-2.7,2.7]){
      drum(g,p.dark,0,yy,-3.2,2.25,.8,16);drum(g,p.steel,0,yy,-2.7,2.12,.5,16);drum(g,p.lava,0,yy,-2.41,1.66,.08,24);ring(g,p.rust,0,yy,-2.33,1.94,.13);
      for(let j=0;j<10;j++){const a=j/10*TAU,m=block(g,p.dark,Math.cos(a)*2.06,yy+Math.sin(a)*2.06,-2.16,.13,.40,.30);m.rotation.z=a;}
    }
    for(const s of[-1,1])for(let i=0;i<3;i++){pipe(g,p.steel,s*(2.43+i*.25),0,-2.66,.13,10.2);block(g,p.warm,s*(2.46+i*.25),0,-2.42,.04,1.8,.035);}
    bridge(g,p,-4,2.7,-3.3,5.8);block(g,p.rust,-2.4,2.7,-2.2,.23,3.1,.24);
    block(g,p.steel,-1.5,2.7,-1.82,3.0,.18,.18);
  }else if(entry.kind==='bridge'){
    for(const yy of[-1.7,1.7])bridge(g,p,0,yy,-3.0,27);
    for(const s of[-1,1]){outpost(g,p,s*9.2,0,-3.7,4.6,6.4);for(const yy of[-2.6,2.6])drum(g,p.steel,s*9.2,yy,-5.5,.37,4);}
    if(env==='ice')for(const s of[-1,1])rock(g,p.snow,s*11.6,0,-3.3,4.0,6.2,.42,s+14);
  }else return;
  return finish(g);
}

/** Merge by material, then dispose only the temporary geometries we own. */
function finish(g:T.Group){
  const owned=new Set<T.BufferGeometry>();g.traverse(o=>{if(o instanceof T.Mesh&&o.geometry.type!=='BoxGeometry')owned.add(o.geometry);});
  const result=batch(g);for(const geo of owned)geo.dispose();return result;
}
