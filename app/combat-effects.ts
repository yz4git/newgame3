import * as T from 'three/webgpu';
import {CombatMotion} from './combat-motion.ts';
import {impactFrames,playerMap,finishMaps,debrisFrames} from './visual-assets.ts';
import {FinishMotion} from './finish-motion.ts';
import {atlasFrame} from './surface-motion.ts';
import {usesRebuiltGraphics} from './visual-style.ts';
import type {Game,GameEvent} from './sim.ts';
type FX=T.Sprite|T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
export class CombatEffects {
 root=new T.Group();motion=new CombatMotion();finish=new FinishMotion();
 private rebuilt=usesRebuiltGraphics();
 private impacts:FX[]=[];private echoes:FX[]=[];private fragments:FX[]=[];private waves:FX[]=[];
 private effect(kind:'impact'|'echo'|'fragment'|'wave',index:number){
  if(!this.rebuilt){
   const map=kind==='impact'?impactFrames[0]:kind==='echo'?playerMap:kind==='fragment'?debrisFrames[index%4]:finishMaps.shockwave;
   return new T.Sprite(new T.SpriteMaterial({map,color:kind==='echo'?0x60dcff:0xffffff,
    transparent:true,blending:kind==='impact'||kind==='echo'||kind==='wave'?T.AdditiveBlending:T.NormalBlending,
    alphaTest:kind==='fragment'?.02:0,depthWrite:false,toneMapped:false}));
  }
  // Actual shaded-depth shapes. No camera-facing flash cards in rebuilt graphics.
  const shape=kind==='fragment'?new T.TetrahedronGeometry(.70,0):
   kind==='impact'?new T.IcosahedronGeometry(.60,1):
   kind==='echo'?new T.TorusGeometry(.8,.055,6,24):new T.TorusGeometry(1,.085,7,40);
  return new T.Mesh(shape,new T.MeshBasicMaterial({color:kind==='fragment'?0x9ca6a8:kind==='echo'?0x4f8b9c:
   kind==='wave'?0x6e8995:0xbdb4a4,transparent:true,opacity:.14,depthWrite:false,toneMapped:true}));
 }
 constructor(){
  for(let i=0;i<24;i++){const v=this.effect('impact',i);v.visible=false;this.impacts.push(v);this.root.add(v);}
  for(let i=0;i<6;i++){const v=this.effect('echo',i);v.visible=false;this.echoes.push(v);this.root.add(v);}
  for(let i=0;i<48;i++){const v=this.effect('fragment',i);v.visible=false;this.fragments.push(v);this.root.add(v);}
  for(let i=0;i<4;i++){const v=this.effect('wave',i);v.visible=false;this.waves.push(v);this.root.add(v);}
 }
 event(e:GameEvent){this.motion.event(e);this.finish.event(e);}
 draw(g:Game,dt:number,reduced=false,performance=false){
  this.motion.update(g,dt,reduced);this.finish.update(g,dt,reduced);
  this.impacts.forEach((s,i)=>{
   const p=this.motion.impacts[i];s.visible=!!p;if(!p)return;
   const u=p.age/p.life;
   s.position.set(p.x,p.y-.3125,2);s.scale.setScalar(p.size*(.5+u*.75)*(this.rebuilt?.78:1));
   if(s instanceof T.Sprite)s.material.map=impactFrames[atlasFrame(p.age,p.life)];
   s.material.opacity=(1-u)*(this.rebuilt?.18:.85);s.material.color.setHex(this.rebuilt?0xac9180:p.color);
  });
  this.echoes.forEach((s,i)=>{
   const e=this.motion.echoes[i];s.visible=!!e&&!reduced;if(!e)return;
   s.position.set(e.x,e.y,this.rebuilt?-.10:1);
   if(s instanceof T.Sprite)s.material.rotation=e.roll;else s.rotation.z=e.roll;
   s.material.opacity=(1-e.age/e.life)*(this.rebuilt?.07:.14);
  });
  this.fragments.forEach((s,i)=>{
   const p=this.finish.fragments[i];s.visible=!!p&&i<(performance?24:48)&&!reduced;if(!p)return;
   s.position.set(p.x,p.y,1.85);
   s.scale.set(p.size,p.size*.8,this.rebuilt?p.size*.65:1);
   if(s instanceof T.Sprite){s.material.map=debrisFrames[p.frame];s.material.rotation=p.angle;}
   else s.rotation.set(p.angle*.8,p.angle*.6,p.angle);
   s.material.opacity=Math.min(this.rebuilt?.56:1,(1-p.age/p.life)*(this.rebuilt?.45:3));
  });
  this.waves.forEach((s,i)=>{
   const p=this.finish.waves[i];s.visible=!!p&&!reduced;if(!p)return;
   const u=p.age/p.life;s.position.set(p.x,p.y,this.rebuilt?-.12:.75);s.scale.setScalar(p.size*(.06+u));
   s.material.color.setHex(this.rebuilt?0x82959e:p.color);
   if(s instanceof T.Sprite)s.material.rotation=u*.12;else s.rotation.set(u*.3,u*.22,u*.12);
   s.material.opacity=(1-u)**2*(this.rebuilt?.14:.56);
  });
 }
 diagnostics(){return {...this.motion.diagnostics(),...this.finish.diagnostics(),physical3D:this.rebuilt};}
}
