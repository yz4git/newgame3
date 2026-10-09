import * as T from 'three/webgpu';
import {block,hull,batch} from './art.ts';
import {rock,type EnvironmentPalette} from './environment-art.ts';
import {sceneMaps} from './visual-assets.ts';
import {STAGES} from './stages.ts';
import type {Scene} from './scenery.ts';
import {usesRebuiltGraphics} from './visual-style.ts';
import {buildWorldSetpiece} from './world-rebuild.ts';
/** Authored scenery sits below the combat plane and never affects hit detection. */
export function sceneModel(p:EnvironmentPalette,entry:Scene,stage:number){
 const g=new T.Group(),env=STAGES[stage].environment;
 if(entry.kind==='artwork'&&usesRebuiltGraphics())return buildWorldSetpiece(p,stage,entry.width,entry.height);
 if(entry.kind==='artwork'){const mat=new T.MeshBasicMaterial({map:sceneMaps[stage],color:0xb3c0c9,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false});const m=new T.Mesh(new T.PlaneGeometry(entry.width,entry.height),mat);m.position.z=.10;m.name='generated-landmark';g.add(m);return g;}
 const metal=p.plate,natural=env==='ice'?p.ice:env==='jungle'?p.moss:p.rock;
 const ring=(r:number,t:number,z=-3)=>{const m=new T.Mesh(new T.TorusGeometry(r,t,6,40),natural);m.position.z=z;g.add(m);return m;};
 if(entry.kind==='array'){
  block(g,p.dark,0,0,-4,1.8,12,.7);
  for(const side of[-1,1])for(let j=0;j<3;j++){const x=side*4.2,y=(j-1)*4;block(g,p.steel,x/2,y,-3.5,4.8,.18,.18);block(g,p.dark,x,y,-3.35,4.2,3.5,.22);for(let i=0;i<6;i++)block(g,p.glass,x-1.75+i*.70,y,-3.20,.64,3.23,.035);for(const yy of[-1.6,0,1.6])block(g,p.lamp,x,y+yy,-3.12,3.9,.045,.04);}
 }else if(entry.kind==='ribs'){
  hull(g,[[-2.3,-7],[-4,-2],[-3.5,5],[0,7.5],[3.9,4.8],[3,-5]],.4,p.dark,-5.2);
  for(let i=0;i<13;i++){const y=(i-6)*.95,w=2.3+Math.sin(i*.4)*1.1;for(const side of[-1,1]){const m=block(g,metal,side*w,y,-3.5,.16,.18,2.3);m.rotation.y=side*.38;block(g,p.steel,side*w*.5,y,-2.65,w,.13,.14);}}for(const x of[-1.4,1.4])block(g,p.rust,x,0,-4.1,.35,12,.35);
 }else if(entry.kind==='crater'){
  for(let i=0;i<16;i++){const a=i*Math.PI/8;rock(g,natural,Math.cos(a)*5.2,Math.sin(a)*6.0,-4.0,1.0,1.4,1.9,i+stage*20,1);}ring(4.8,.26,-4.1);ring(4.1,.14,-4.45);for(let i=0;i<4;i++){const a=i*2.4;rock(g,natural,Math.cos(a)*2.9,Math.sin(a)*3.0,-5.4,.7,.9,.4,i+83);}
 }else if(entry.kind==='crane'){
  for(const x of[-4,4]){block(g,p.deck,x,0,-4.5,2.5,13,.9);block(g,p.steel,x,0,-3.55,.35,13,.25);for(const y of[-4.5,4.5])block(g,p.rust,x,y,-2.8,.6,.6,1.7);}
  for(const y of[-4,4]){block(g,p.rust,0,y,-1.9,9.2,.55,.4);for(let j=0;j<8;j++){const m=block(g,p.steel,-3.5+j,y,-1.45,.83,.06,.08);m.rotation.z=j%2?.48:-.48;}}block(g,p.steel,.7,4,-1.4,.8,.9,.35);block(g,p.warm,.7,4,-1.15,.14,.14,.04);
 }else if(entry.kind==='spire'){
  for(let k=0;k<6;k++){const w=7-k*.85;block(g,env==='ice'?p.ice:p.deck,0,0,-5+k*.46,w,w*1.2,.50);}for(const side of[-1,1]){block(g,metal,side*2.6,1,-3.2,.65,6.8,2.0);block(g,p.lamp,side*2.6,1,-2.16,.13,6.3,.04);}ring(3.7,.13,-3.2);block(g,p.core,0,0,-2.1,1.4,2.8,.25);
 }else if(entry.kind==='arch'){
  const r=ring(5.5,.70,-3.1);r.scale.y=.83;const trim=new T.Mesh(new T.TorusGeometry(5.4,.055,5,48),p.lamp);trim.scale.y=.83;trim.position.z=-2.6;g.add(trim);for(const side of[-1,1]){rock(g,natural,side*5.3,0,-4,1.8,5.0,2.4,stage+side*7);for(let j=0;j<4;j++)block(g,metal,side*5.3,j*1.7-2.5,-2.1,.65,.32,.4);}
 }else if(entry.kind==='causeway'){
  for(const y of[-2.5,2.5]){block(g,p.dark,0,y,-3.9,18,1.8,.60);block(g,env==='jungle'?p.moss:metal,0,y,-3.5,18,1.6,.3);for(let i=0;i<17;i++)block(g,p.steel,i-8,y,-3.3,.055,1.5,.09);for(const side of[-1,1])block(g,p.lamp,0,y+side*.72,-3.24,17.8,.05,.035);}for(const x of[-7,7])for(const y of[-2.5,2.5])block(g,p.deck,x,y,-4.5,1.5,2.0,2.0);
 }else if(entry.kind==='monolith'){
  for(let i=0;i<5;i++)block(g,p.moss,0,0,-5+i*.34,9-i*.95,11-i,.45);for(const side of[-1,1])for(let j=0;j<5;j++)block(g,p.moss,side*(3.4-j*.4),0,-3.1+j*.35,.7,5.6-j*.5,.42);ring(2.0,.32,-2.7);const halo=new T.Mesh(new T.TorusGeometry(1.7,.055,5,40),p.lamp);halo.position.z=-2.35;g.add(halo);for(let i=0;i<8;i++){const a=i*Math.PI/4,m=block(g,p.moss,Math.cos(a)*2.9,Math.sin(a)*3.7,-2.6,.35,1.1,.75);m.rotation.z=a;}
 }else if(entry.kind==='conveyor'){
  for(const x of[-3,3]){block(g,p.dark,x,0,-4.2,2.8,17,.7);block(g,p.rust,x,0,-3.8,2.4,17,.2);for(let i=0;i<24;i++)block(g,p.steel,x,(i-11.5)*.65,-3.61,2.3,.1,.13);for(let i=0;i<4;i++){block(g,p.dark,x,i*4.1-6,-3.3,1.5,2,.5);block(g,p.lava,x,i*4.1-6,-3.0,1.1,1.6,.08);}for(const side of[-1,1])block(g,p.warm,x+side*1.24,0,-3.56,.06,16.8,.03);}
 }
 const owned=new Set<T.BufferGeometry>();g.traverse(o=>{if(o instanceof T.Mesh&&o.geometry.type!=='BoxGeometry')owned.add(o.geometry);});const result=batch(g);for(const geo of owned)geo.dispose();return result;
}
