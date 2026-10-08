import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {ENCOUNTERS,miniAngle,threatActive} from './encounter-design.ts';
import {minibossMaps,nodeMaps,nodeAtlasMap,battlefieldAtlasMap,battlefieldMaps,livingMaps} from './visual-assets.ts';

const plane=new T.PlaneGeometry(1,1);
function material(color:number,opacity=1){return new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});}
function sprite(map:T.Texture){return new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));}
export function encounterDiagnostics(g:Game){return {miniboss:!!g.encounter,nodes:g.nodes.filter(n=>!n.dead).length,telegraphs:g.threats.filter(t=>!t.dead&&!threatActive(t)).length,activeThreats:g.threats.filter(threatActive).length,shield:!!g.boss?.guard};}
/** Fixed pools. Every pose and warning uses the same simulation clock as collision. */
export class EncounterView {
 root=new T.Group();private mini=sprite(minibossMaps[0]);
 private nodes=Array.from({length:8},()=>({skin:sprite(nodeMaps[0]),back:new T.Mesh(plane,material(0x07121d)),bar:new T.Mesh(plane,material(0xaaffda))}));
 private beams=Array.from({length:12},()=>({band:new T.Mesh(plane,material(0xffb655,.14)),line:new T.Mesh(plane,material(0xffbd6c,.8)),core:new T.Mesh(plane,material(0xfff8e8,.9))}));
 private plumes=[sprite(livingMaps.plume),sprite(livingMaps.plume)];
 private shield=new T.Mesh(new T.RingGeometry(1.86,1.94,64),material(0xb9a3ff,.6));
 private status=encounterDiagnostics({nodes:[],threats:[],encounter:null,boss:null} as unknown as Game);
 constructor(){this.root.add(this.mini,this.shield,...this.plumes);for(const n of this.nodes)this.root.add(n.skin,n.back,n.bar);for(const b of this.beams)this.root.add(b.band,b.line,b.core);this.root.visible=false;}
 draw(g:Game){
  this.root.visible=g.state!=='title'&&g.state!=='result';this.status=encounterDiagnostics(g);
  const m=g.encounter;this.mini.visible=!!m&&!m.dead;
  if(m){this.mini.material.map=minibossMaps[m.stage];this.mini.position.set(m.x,m.y-.5,2.6);this.mini.scale.setScalar(6.2);this.mini.material.rotation=miniAngle(m);this.mini.material.color.setScalar(m.flash>0?1.65:1);}
  for(let i=0;i<this.plumes.length;i++){const p=this.plumes[i];p.visible=this.mini.visible;if(m){p.position.set(m.x+(i?1:-1)*1.3,m.y+2.15,2.55);p.scale.set(.56,1.8+Math.sin(m.age*19)*.15,1);p.material.rotation=Math.PI;p.material.opacity=.72;}}
  for(let i=0;i<this.nodes.length;i++){
   const v=this.nodes[i],n=g.nodes.filter(n=>!n.dead)[i];v.skin.visible=v.back.visible=v.bar.visible=!!n;if(!n)continue;
   v.skin.material.map=n.attach==='field'&&battlefieldAtlasMap.image instanceof HTMLImageElement&&battlefieldAtlasMap.image.naturalWidth>0?battlefieldMaps[n.stage*2+n.index]:nodeMaps[n.stage];v.skin.material.color.setHex(0xffffff).multiplyScalar(n.flash>0?1.65:1);v.skin.material.rotation=n.attach==='field'?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?n.age*.35:Math.sin(n.age*1.4)*.025;v.skin.position.set(n.x,n.y-.5,2.6);v.skin.scale.set(n.attach==='field'?3.35:2.75,n.attach==='field'?3.35:2.75,1);
   const ratio=Math.max(0,n.hp/n.maxHp);v.back.position.set(n.x,n.y-1.85,2.61);v.back.scale.set(2.05,.085,1);v.bar.position.set(n.x-1.0+ratio,n.y-1.85,2.63);v.bar.scale.set(ratio*2,.045,1);v.bar.material.color.setHex(n.attach==='field'?0xffc778:ENCOUNTERS[n.stage].color);
  }
  for(let i=0;i<this.beams.length;i++){
   const v=this.beams[i],t=g.threats.filter(t=>!t.dead)[i];v.band.visible=v.line.visible=!!t;v.core.visible=!!t&&threatActive(t);if(!t)continue;
   const active=threatActive(t),length=Math.hypot(t.bx-t.ax,t.by-t.ay),angle=-Math.atan2(t.bx-t.ax,t.by-t.ay),pulse=.6+Math.abs(Math.sin(t.age*10))*.4;
   for(const [j,p]of [v.band,v.line,v.core].entries()){p.position.set((t.ax+t.bx)/2,(t.ay+t.by)/2,1.02+j*.005);p.rotation.z=angle;p.scale.set(j===0?t.width+.4:j===1?active?t.width:.04:t.width*.32,length,1);}
   v.band.material.color.setHex(active?0xff7656:0xffb655);v.band.material.opacity=active?.28:.12+pulse*.10;v.line.material.color.setHex(active?0xff9966:0xffd089);v.line.material.opacity=active?.95:.5+pulse*.4;
  }
  const b=g.boss;this.shield.visible=!!b&&!b.dead&&b.guard>0;if(b){this.shield.position.set(b.x,b.y-1.4,2.8);this.shield.material.opacity=.38+Math.sin(b.age*9)*.12;}
 }
 diagnostics(){return this.status;}
}
export function drawThreatsCanvas(c:CanvasRenderingContext2D,g:Game){
 for(const t of g.threats){if(t.dead)continue;const active=threatActive(t),pulse=.6+Math.abs(Math.sin(t.age*10))*.4;c.save();c.lineCap='butt';c.strokeStyle=active?'#ff7656':'#ffb655';c.lineWidth=t.width+.4;c.globalAlpha=active?.28:.12+pulse*.1;c.beginPath();c.moveTo(t.ax,t.ay);c.lineTo(t.bx,t.by);c.stroke();c.globalAlpha=active?.95:.5+pulse*.4;c.strokeStyle=active?'#ff9966':'#ffd089';c.lineWidth=active?t.width:.04;c.stroke();if(active){c.strokeStyle='#fff8e8';c.lineWidth=t.width*.32;c.stroke();}c.restore();}
}
export function drawEncounterActorsCanvas(c:CanvasRenderingContext2D,g:Game){
 const m=g.encounter;if(m&&!m.dead){c.save();c.translate(m.x,m.y);c.rotate(miniAngle(m));c.scale(1,-1);for(const s of[-1,1]){c.save();c.translate(s*1.3,-2.65);c.rotate(Math.PI);c.globalAlpha=.72;c.drawImage(livingMaps.plume.image,-.28,-.9,.56,1.8);c.restore();}c.drawImage(minibossMaps[m.stage].image,-3.1,-3.1,6.2,6.2);if(m.flash>0){c.strokeStyle='#fff3d8';c.lineWidth=.05;c.beginPath();c.arc(0,0,2.3,0,Math.PI*2);c.stroke();}c.restore();}
 const im=nodeAtlasMap.image,field=battlefieldAtlasMap.image;for(const n of g.nodes){if(n.dead)continue;c.save();c.translate(n.x,n.y);c.rotate(n.attach==='field'?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?-n.age*.35:Math.sin(n.age*1.4)*.025);c.scale(1,-1);if(n.attach==='field'&&field instanceof HTMLImageElement&&field.naturalWidth>0){const k=n.stage*2+n.index,w=field.width/4,h=field.height/3;c.drawImage(field,k%4*w,Math.floor(k/4)*h,w,h,-1.675,-1.675,3.35,3.35);}else{const w=im.width/3,h=im.height/2;c.drawImage(im,n.stage%3*w,Math.floor(n.stage/3)*h,w,h,-1.375,-1.375,2.75,2.75);}if(n.attach==='field'){c.strokeStyle='#ffd48a';c.lineWidth=.055;c.globalAlpha=.55+.2*Math.sin(n.age*3);c.beginPath();c.arc(0,0,1.66,0,Math.PI*2);c.stroke();}c.restore();c.save();c.fillStyle='#07121d';c.fillRect(n.x-1.025,n.y-1.39,2.05,.085);c.fillStyle='#'+(n.attach==='field'?0xffc778:ENCOUNTERS[n.stage].color).toString(16).padStart(6,'0');c.fillRect(n.x-1,n.y-1.37,2*Math.max(0,n.hp/n.maxHp),.045);c.restore();}
}
export function drawBossShieldCanvas(c:CanvasRenderingContext2D,g:Game){const b=g.boss;if(!b||b.dead||!b.guard)return;c.save();c.globalAlpha=.38+Math.sin(b.age*9)*.12;c.strokeStyle='#b9a3ff';c.lineWidth=.08;c.beginPath();c.arc(b.x,b.y-.85,1.9,0,Math.PI*2);c.stroke();c.restore();}
