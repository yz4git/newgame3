import * as T from 'three/webgpu';
import {finishMaps} from './visual-assets.ts';
import {airLayers} from './air-motion.ts';
import {worldClock} from './motion.ts';
import type {Game} from './sim.ts';
export class AirEffects {
 root=new T.Group();private geometry=new T.PlaneGeometry(1,1,8,8);private meshes:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];private time=0;private stage=-1;private count=0;
 constructor(){for(let i=0;i<2;i++){const m=new T.Mesh(this.geometry,new T.MeshBasicMaterial({map:finishMaps.nebula,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));m.frustumCulled=false;this.meshes.push(m);this.root.add(m);}}
 draw(g:Game,performance=false,reduced=false){
  const t=this.time=worldClock(g),layers=airLayers(g.stage,t,t*4.4,reduced);this.count=performance?1:2;
  const pos=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv');
  for(let i=0;i<pos.count;i++)pos.setXYZ(i,uv.getX(i)-.5+Math.sin(uv.getY(i)*6+t*.21)*.006*(reduced?.2:1),uv.getY(i)-.5,0);pos.needsUpdate=true;
  this.meshes.forEach((m,i)=>{const p=layers[i];m.visible=i<this.count;m.position.set(p.x,p.y,p.z);m.scale.set(p.width,p.height,1);m.rotation.z=p.angle;m.material.opacity=p.opacity;m.material.color.setHex(p.color);if(g.stage!==this.stage){m.material.map=finishMaps[p.key as 'nebula'|'aurora'|'shafts'];m.material.needsUpdate=true;}});this.stage=g.stage;
 }
 diagnostics(){return {clock:this.time,layers:this.count,kind:this.stage<0?'none':airLayers(this.stage,0,0)[0].key};}
}
export function drawAirCanvas(c:CanvasRenderingContext2D,g:Game,reduced=false){
 const t=worldClock(g),layers=airLayers(g.stage,t,t*4.4,reduced);
 for(const p of layers){c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=p.opacity;c.drawImage(finishMaps[p.key as 'nebula'|'aurora'|'shafts'].image,-p.width/2,-p.height/2,p.width,p.height);c.restore();}
 return {clock:t,layers:2,kind:layers[0].key};
}
