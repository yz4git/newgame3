import * as T from 'three/webgpu';
import {usesRebuiltGraphics} from './visual-style.ts';
import {finishMaps} from './visual-assets.ts';
import {airLayers} from './air-motion.ts';
import {worldClock} from './motion.ts';
import type {Game} from './sim.ts';
export class AirEffects {
 root=new T.Group();private rebuilt=usesRebuiltGraphics();private geometry:T.BufferGeometry=this.rebuilt?new T.IcosahedronGeometry(1,2):new T.PlaneGeometry(1,1,8,8);private meshes:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>[]=[];private time=0;private stage=-1;private count=0;
 constructor(){for(let i=0;i<2;i++){
  const material=new T.MeshBasicMaterial(this.rebuilt
    ?{color:0x607789,transparent:true,opacity:.015,depthWrite:false,toneMapped:true}
    :{map:finishMaps.nebula,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  const m=new T.Mesh(this.geometry,material);m.frustumCulled=false;this.meshes.push(m);this.root.add(m);
 }}
 draw(g:Game,performance=false,reduced=false){
  const t=this.time=worldClock(g),layers=airLayers(g.stage,t,t*4.4,reduced);this.count=performance?1:2;
  const pos=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv');
  if(!this.rebuilt){for(let i=0;i<pos.count;i++)pos.setXYZ(i,uv.getX(i)-.5+Math.sin(uv.getY(i)*6+t*.21)*.006*(reduced?.2:1),uv.getY(i)-.5,0);pos.needsUpdate=true;}
  this.meshes.forEach((m,i)=>{
   const p=layers[i];m.visible=i<this.count&&!reduced;
   m.position.set(this.rebuilt?(i?10.5:-10.5):p.x,p.y,this.rebuilt?-16-i*2:p.z);
   m.scale.set(this.rebuilt?p.width*.32:p.width,this.rebuilt?p.height*.35:p.height,this.rebuilt?2.5:1);
   m.rotation.z=p.angle;
   m.rotation.y=this.rebuilt?Math.sin(t*.07+i)*.22:0;
   m.material.opacity=this.rebuilt?Math.min(.025,p.opacity*.13):p.opacity;
   m.material.color.setHex(p.color);
   if(!this.rebuilt&&g.stage!==this.stage){m.material.map=finishMaps[p.key as 'nebula'|'aurora'|'shafts'];m.material.needsUpdate=true;}
  });this.stage=g.stage;
 }
 diagnostics(){return {clock:this.time,layers:this.count,kind:this.stage<0?'none':airLayers(this.stage,0,0)[0].key};}
}
export function drawAirCanvas(c:CanvasRenderingContext2D,g:Game,reduced=false){
 const t=worldClock(g),layers=airLayers(g.stage,t,t*4.4,reduced);
 for(const p of layers){c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=p.opacity;c.drawImage(finishMaps[p.key as 'nebula'|'aurora'|'shafts'].image,-p.width/2,-p.height/2,p.width,p.height);c.restore();}
 return {clock:t,layers:2,kind:layers[0].key};
}
