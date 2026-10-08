import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {fieldDamagePhase} from './battlefield.ts';
import {isTerrainActive} from './battlefield-terrain.ts';
import {ENCOUNTERS,miniAngle,threatActive} from './encounter-design.ts';
import {minibossMaps,nodeMaps,nodeAtlasMap,battlefieldAtlasMap,battlefieldMaps,tacticalFxMaps,livingMaps} from './visual-assets.ts';

const plane=new T.PlaneGeometry(1,1);
function material(color:number,opacity=1){return new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});}
function sprite(map:T.Texture){return new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));}
export function encounterDiagnostics(g:Game){return {miniboss:!!g.encounter,nodes:g.nodes.filter(n=>!n.dead).length,telegraphs:g.threats.filter(t=>!t.dead&&!threatActive(t)).length,activeThreats:g.threats.filter(threatActive).length,shield:!!g.boss?.guard};}
/** Fixed pools. Every pose and warning uses the same simulation clock as collision. */
export class EncounterView {
 root=new T.Group();private mini=sprite(minibossMaps[0]);
 private nodes=Array.from({length:8},()=>({skin:sprite(nodeMaps[0]),back:new T.Mesh(plane,material(0x07121d)),bar:new T.Mesh(plane,material(0xaaffda)),critical:sprite(tacticalFxMaps[9])}));
 private collapsing=Array.from({length:3},()=>({skin:sprite(battlefieldMaps[0]),aura:sprite(tacticalFxMaps[0])}));
 private terrain=Array.from({length:12},()=>({skin:sprite(battlefieldMaps[0]),warning:sprite(tacticalFxMaps[4])}));
 private beams=Array.from({length:12},()=>({band:new T.Mesh(plane,material(0xffb655,.14)),line:new T.Mesh(plane,material(0xffbd6c,.8)),core:new T.Mesh(plane,material(0xfff8e8,.9))}));
 private plumes=[sprite(livingMaps.plume),sprite(livingMaps.plume)];
 private shield=new T.Mesh(new T.RingGeometry(1.86,1.94,64),material(0xb9a3ff,.6));
 private status=encounterDiagnostics({nodes:[],threats:[],encounter:null,boss:null} as unknown as Game);
 constructor(){this.root.add(this.mini,this.shield,...this.plumes);for(const n of this.nodes)this.root.add(n.skin,n.back,n.bar,n.critical);for(const c of this.collapsing)this.root.add(c.skin,c.aura);for(const t of this.terrain)this.root.add(t.skin,t.warning);for(const b of this.beams)this.root.add(b.band,b.line,b.core);this.root.visible=false;}
 draw(g:Game){
  this.root.visible=g.state!=='title'&&g.state!=='result';this.status=encounterDiagnostics(g);
  const m=g.encounter;this.mini.visible=!!m&&!m.dead;
  if(m){this.mini.material.map=minibossMaps[m.stage];this.mini.position.set(m.x,m.y-.5,2.6);this.mini.scale.setScalar(6.2);this.mini.material.rotation=miniAngle(m);this.mini.material.color.setScalar(m.flash>0?1.65:1);}
  for(let i=0;i<this.plumes.length;i++){const p=this.plumes[i];p.visible=this.mini.visible;if(m){p.position.set(m.x+(i?1:-1)*1.3,m.y+2.15,2.55);p.scale.set(.56,1.8+Math.sin(m.age*19)*.15,1);p.material.rotation=Math.PI;p.material.opacity=.72;}}
  for(let i=0;i<this.nodes.length;i++){
   const v=this.nodes[i],n=g.nodes.filter(n=>!n.dead)[i];v.skin.visible=v.back.visible=v.bar.visible=!!n;v.critical.visible=!!n&&(n.attach==='field'&&fieldDamagePhase(n.hp,n.maxHp)===2||n.attach==='mission');if(!n)continue;
   v.skin.material.map=(n.attach==='field'||n.attach==='mission')&&battlefieldAtlasMap.image instanceof HTMLImageElement&&battlefieldAtlasMap.image.naturalWidth>0?battlefieldMaps[n.stage*2+n.index]:nodeMaps[n.stage];const phase=n.attach==='field'?fieldDamagePhase(n.hp,n.maxHp):0;v.skin.material.color.setHex(n.attach==='mission'?(n.index===1?0x9ceeff:0xffaa8d):phase===2?0xffaa80:phase===1?0xffe3b8:0xffffff).multiplyScalar(n.flash>0?1.65:1);v.skin.material.opacity=phase===2?.84:1;v.skin.material.rotation=(n.attach==='field'||n.attach==='mission')?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?n.age*.35:Math.sin(n.age*1.4)*.025;v.skin.position.set(n.x,n.y-.5,2.6);v.skin.scale.set(n.attach==='mission'?3.85:n.attach==='field'?3.35:2.75,n.attach==='mission'?3.85:n.attach==='field'?3.35:2.75,1);if(v.critical.visible){v.critical.material.map=tacticalFxMaps[n.attach==='mission'?(n.index===1?3:4):9];v.critical.position.set(n.x,n.y+.14,2.68);v.critical.scale.setScalar(1.28+Math.sin(n.age*9)*.1);v.critical.material.opacity=.45+Math.sin(n.age*6)*.16;}
   const ratio=Math.max(0,n.hp/n.maxHp);v.back.position.set(n.x,n.y-1.85,2.61);v.back.scale.set(2.05,.085,1);v.bar.position.set(n.x-1.0+ratio,n.y-1.85,2.63);v.bar.scale.set(ratio*2,.045,1);v.bar.material.color.setHex(n.attach==='mission'?(n.index===1?0x76edff:0xff9980):n.attach==='field'?0xffc778:ENCOUNTERS[n.stage].color);
  }
  for(let i=0;i<this.collapsing.length;i++){
   const v=this.collapsing[i],wreck=g.battlefield.collapses[i];v.skin.visible=v.aura.visible=!!wreck;if(!wreck)continue;
   const u=Math.min(1,wreck.age/wreck.life);
   v.skin.material.map=battlefieldMaps[wreck.stage*2+wreck.index];v.skin.material.opacity=(1-u)**1.65*.84;
   v.skin.material.color.setHex(wreck.stage===3?0xa3deff:wreck.stage===4?0xb4efcf:0xffc19a);
   v.skin.position.set(wreck.x,wreck.y-u*2.0,2.57);v.skin.material.rotation=Math.sin(u*8+wreck.index)*u*.30;
   v.skin.scale.set(3.35*(1-u*.48),3.35*(1-u*.48),1);
   v.aura.material.map=tacticalFxMaps[wreck.stage===3?11:0];v.aura.material.opacity=Math.max(0,.64-u*.55);
   v.aura.position.set(wreck.x,wreck.y-u*.5,2.59);v.aura.material.rotation=u*.9;v.aura.scale.setScalar(3.5+u*5.5);
  }
  // Pre-allocated sprite pools; both routes share exactly the same collision geometry.
  for(let i=0;i<this.terrain.length;i++){
   const v=this.terrain[i],piece=g.battlefield.terrain[i];
   v.skin.visible=!!piece;v.warning.visible=!!piece&&piece.route==='hazard'&&piece.age<piece.warning;
   if(!piece)continue;
   const active=isTerrainActive(piece),fade=Math.max(.15,Math.min(1,(piece.life-piece.age)/2.5));
   v.skin.material.map=battlefieldMaps[piece.stage*2+piece.index];
   v.skin.material.color.setHex(piece.route==='cover'?0x8d99b0:0xff9f73);
   v.skin.material.opacity=fade*(active?.85:.36);
   v.skin.material.rotation=piece.side*(piece.route==='cover'?.21:-.16)+Math.sin(piece.age*.42)*.06;
   v.skin.position.set(piece.x,piece.y,.86);
   v.skin.scale.set(piece.radius*2.35,piece.radius*2.35,1);
   if(v.warning.visible){
    v.warning.material.opacity=.45+.30*Math.abs(Math.sin(piece.age*8));
    v.warning.position.set(piece.x,piece.y,1.12);
    v.warning.scale.setScalar(piece.radius*2.5);
   }
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
 const im=nodeAtlasMap.image,field=battlefieldAtlasMap.image;for(const n of g.nodes){if(n.dead)continue;c.save();c.translate(n.x,n.y);c.rotate((n.attach==='field'||n.attach==='mission')?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?-n.age*.35:Math.sin(n.age*1.4)*.025);c.scale(1,-1);if((n.attach==='field'||n.attach==='mission')&&field instanceof HTMLImageElement&&field.naturalWidth>0){const k=n.stage*2+n.index,w=field.width/4,h=field.height/3;c.drawImage(field,k%4*w,Math.floor(k/4)*h,w,h,-1.675,-1.675,3.35,3.35);}else{const w=im.width/3,h=im.height/2;c.drawImage(im,n.stage%3*w,Math.floor(n.stage/3)*h,w,h,-1.375,-1.375,2.75,2.75);}if(n.attach==='mission'){c.strokeStyle=n.index===1?'#78e9ff':'#ff987d';c.lineWidth=.085;c.globalAlpha=.7+.2*Math.sin(n.age*8);c.beginPath();c.arc(0,0,1.95,0,Math.PI*2);c.stroke();}
 if(n.attach==='field'){
 const phase=fieldDamagePhase(n.hp,n.maxHp);
 c.strokeStyle=phase===2?'#ff987b':'#ffd48a';c.lineWidth=.055;c.globalAlpha=.55+.2*Math.sin(n.age*3);c.beginPath();c.arc(0,0,1.66,0,Math.PI*2);c.stroke();
 if(phase>0){c.globalAlpha=.8;c.strokeStyle=phase===2?'#ffb494':'#fff0c1';c.lineWidth=.05;
  for(let k=0;k<phase+1;k++){const x=(k-1)*.48;c.beginPath();c.moveTo(x-.35,-.95);c.lineTo(x+.15,-.3);c.lineTo(x-.2,.35);c.lineTo(x+.36,.88);c.stroke();}
  if(phase===2){const fx=tacticalFxMaps[9].image;if(fx instanceof HTMLImageElement&&fx.naturalWidth>0){const w=fx.width/4,h=fx.height/4;c.globalAlpha=.65;c.drawImage(fx,w,h*2,w,h,-.72,-.72,1.44,1.44);}}
 }
}c.restore();c.save();c.fillStyle='#07121d';c.fillRect(n.x-1.025,n.y-1.39,2.05,.085);c.fillStyle='#'+(n.attach==='mission'?(n.index===1?0x76edff:0xff9980):n.attach==='field'?0xffc778:ENCOUNTERS[n.stage].color).toString(16).padStart(6,'0');c.fillRect(n.x-1,n.y-1.37,2*Math.max(0,n.hp/n.maxHp),.045);c.restore();}
 // A dynamic corridor is visible in every renderer, with precise circular danger telegraphs.
 const art=battlefieldAtlasMap.image;
 for(const piece of g.battlefield.terrain){
  const live=isTerrainActive(piece),r=piece.radius;
  c.save();c.translate(piece.x,piece.y);
  if(art instanceof HTMLImageElement&&art.naturalWidth>0){
   const k=piece.stage*2+piece.index,w=art.width/4,h=art.height/3;
   c.save();c.rotate(piece.side*(piece.route==='cover'?.21:-.16));c.scale(1,-1);
   c.globalAlpha=(live?.85:.36)*Math.max(.15,Math.min(1,(piece.life-piece.age)/2.5));
   c.drawImage(art,(k%4)*w,Math.floor(k/4)*h,w,h,-r*1.17,-r*1.17,r*2.34,r*2.34);c.restore();
  }else{c.fillStyle=piece.route==='cover'?'#69899e':'#cb725a';c.globalAlpha=live?.76:.35;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();}
  c.globalAlpha=piece.route==='hazard'?(live?.70:.35+.25*Math.abs(Math.sin(piece.age*8))):.4;
  c.strokeStyle=piece.route==='hazard'?'#ffb36c':'#7ef4ff';c.lineWidth=.08;
  c.beginPath();c.arc(0,0,r+.22,0,Math.PI*2);c.stroke();
  if(piece.route==='hazard'&&!live){c.strokeStyle='#ff685a';c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();}
  c.restore();
 }
 // Collapsing facilities remain visible long enough to sell the multi-stage chain reaction.
 const fieldAtlas=battlefieldAtlasMap.image;
 if(fieldAtlas instanceof HTMLImageElement&&fieldAtlas.naturalWidth>0)for(const wreck of g.battlefield.collapses){
  const u=Math.min(1,wreck.age/wreck.life),k=wreck.stage*2+wreck.index,w=fieldAtlas.width/4,h=fieldAtlas.height/3;
  c.save();c.translate(wreck.x,wreck.y-u*2);c.rotate(Math.sin(u*8+wreck.index)*u*.3);c.scale(1,-1);
  c.globalAlpha=(1-u)**1.65*.84;
  const size=3.35*(1-u*.48);c.drawImage(fieldAtlas,k%4*w,Math.floor(k/4)*h,w,h,-size/2,-size/2,size,size);
  c.restore();
 }
}
export function drawBossShieldCanvas(c:CanvasRenderingContext2D,g:Game){const b=g.boss;if(!b||b.dead||!b.guard)return;c.save();c.globalAlpha=.38+Math.sin(b.age*9)*.12;c.strokeStyle='#b9a3ff';c.lineWidth=.08;c.beginPath();c.arc(b.x,b.y-.85,1.9,0,Math.PI*2);c.stroke();c.restore();}
