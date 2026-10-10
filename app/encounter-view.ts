import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {fieldDamagePhase} from './battlefield.ts';
import {fieldPresentation} from './field-clarity.ts';
import {facilityModel,animateFacility,facilityDebrisModel} from './strategic-facility.ts';
import {meshSprite} from './canvas-art.ts';
import {bossModel} from './art.ts';
import {usesRebuiltGraphics} from './visual-style.ts';
import {isTerrainActive} from './battlefield-terrain.ts';
import {missionBeacons} from './mission-spectacle.ts';
import {ENCOUNTERS,miniAngle,threatActive} from './encounter-design.ts';
import {minibossMaps,nodeMaps,nodeAtlasMap,battlefieldAtlasMap,battlefieldMaps,tacticalFxMaps,livingMaps} from './visual-assets.ts';

const plane=new T.PlaneGeometry(1,1);
const physicalCanvasCache=new Map<number,ReturnType<typeof meshSprite>>();
const debrisCanvasCache=new Map<number,ReturnType<typeof meshSprite>>();
function canvasFacilityDebris(stage:number){let raster=debrisCanvasCache.get(stage);if(raster)return raster;
 raster=meshSprite('fallen-world-metal-v30-'+stage,facilityDebrisModel(stage),27);debrisCanvasCache.set(stage,raster);return raster;
}
function canvasFacility(stage:number,index:number){
 const id=stage*2+index,prior=physicalCanvasCache.get(id);if(prior)return prior;
 const model=facilityModel(stage,index);
 const contact=model.getObjectByName('facility-shadow');if(contact)contact.parent?.remove(contact);
 const result=meshSprite('physical-field-v29-'+id,model,27);physicalCanvasCache.set(id,result);
 return result;
}
function material(color:number,opacity=1){return new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});}
function sprite(map:T.Texture){return new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));}
export function encounterDiagnostics(g:Game){return {miniboss:!!g.encounter,nodes:g.nodes.filter(n=>!n.dead).length,telegraphs:g.threats.filter(t=>!t.dead&&!threatActive(t)).length,activeThreats:g.threats.filter(threatActive).length,shield:!!g.boss?.guard};}
/** Fixed pools. Every pose and warning uses the same simulation clock as collision. */
export class EncounterView {
 root=new T.Group();private mini=sprite(minibossMaps[0]);
 private mini3D=Array.from({length:6},(_,stage)=>bossModel(stage));
 private exhaust3D=Array.from({length:2},()=>new T.Mesh(new T.ConeGeometry(.37,1.4,8),new T.MeshBasicMaterial({color:0x378da4,transparent:true,opacity:.3,depthWrite:false,toneMapped:true})));
 private node3D=Array.from({length:8},()=>this.buildNodeMesh());
 private mission3D=Array.from({length:6},()=>new T.Mesh(new T.TorusGeometry(.75,.07,6,32),new T.MeshBasicMaterial({color:0x79bcc3,transparent:true,opacity:.30,depthWrite:false,toneMapped:true})));
 private buildNodeMesh(){
  // A reusable true 3D node, physically thick from all camera directions.
  const g=new T.Group();
  const metal=new T.MeshStandardMaterial({color:0x6d8196,metalness:.62,roughness:.42});
  const armor=new T.MeshStandardMaterial({color:0x26394c,metalness:.40,roughness:.65});
  const core=new T.MeshBasicMaterial({color:0x8cb6bd,toneMapped:true});
  const hull=new T.Mesh(new T.DodecahedronGeometry(.95,0),metal);hull.scale.z=.68;g.add(hull);
  const ring=new T.Mesh(new T.TorusGeometry(.78,.13,7,18),armor);ring.position.z=.38;g.add(ring);
  for(const side of[-1,1]){
   const fin=new T.Mesh(new T.ConeGeometry(.27,.95,5),metal);fin.position.set(side*.75,.0,.28);fin.rotation.z=side*Math.PI/2;g.add(fin);
  }
  const eye=new T.Mesh(new T.OctahedronGeometry(.30),core);eye.position.z=.87;g.add(eye);
  return g;
 }
 private worldFacilities=Array.from({length:12},(_,i)=>facilityModel(Math.floor(i/2),i%2));
 private nodes=Array.from({length:8},()=>({skin:sprite(nodeMaps[0]),back:new T.Mesh(plane,material(0x07121d)),bar:new T.Mesh(plane,material(0xaaffda)),critical:sprite(tacticalFxMaps[9]),backplate:new T.Mesh(new T.CircleGeometry(2.32,48),material(0x020c19,.76)),target:new T.Mesh(new T.RingGeometry(2.01,2.12,6),material(0xffd679,.90)),locator:new T.Mesh(new T.CircleGeometry(.19,3),material(0xffe3a7,.95)),fracture:new T.Mesh(plane,material(0xffb68c,.70))}));
 private terrainStage=-1;
 private debrisTemplates=Array.from({length:6},(_,stage)=>facilityDebrisModel(stage));
 private terrain=Array.from({length:12},()=>({skin:this.debrisTemplates[0].clone(),warning:sprite(tacticalFxMaps[4])}));
 private missionGlow=Array.from({length:6},()=>sprite(tacticalFxMaps[0]));
 private beams=Array.from({length:12},()=>({band:new T.Mesh(plane,material(0xffb655,.14)),line:new T.Mesh(plane,material(0xffbd6c,.8)),core:new T.Mesh(plane,material(0xfff8e8,.9))}));
 private plumes=[sprite(livingMaps.plume),sprite(livingMaps.plume)];
 private shield=new T.Mesh(new T.RingGeometry(1.86,1.94,64),material(0xb9a3ff,.6));
 private status=encounterDiagnostics({nodes:[],threats:[],encounter:null,boss:null} as unknown as Game);
 constructor(){this.root.add(this.mini,...this.mini3D,...this.node3D,...this.mission3D,...this.exhaust3D,this.shield,...this.plumes,...this.worldFacilities);for(const n of this.nodes)this.root.add(n.skin,n.back,n.bar,n.critical,n.backplate,n.target,n.locator,n.fracture);for(const t of this.terrain)this.root.add(t.skin,t.warning);for(const p of this.missionGlow)this.root.add(p);for(const b of this.beams)this.root.add(b.band,b.line,b.core);this.root.visible=false;}
 draw(g:Game){
  this.root.visible=g.state!=='title'&&g.state!=='result';this.status=encounterDiagnostics(g);
  for(const f of this.worldFacilities)f.visible=false;
  const m=g.encounter;const rebuilt=usesRebuiltGraphics();this.mini.visible=!!m&&!m.dead&&!rebuilt;
  this.mini3D.forEach((o,i)=>{
   o.visible=rebuilt&&!!m&&!m.dead&&m.stage===i;
   if(o.visible&&m){o.position.set(m.x,m.y-.5,.55);o.rotation.z=miniAngle(m);o.rotation.y=Math.sin(m.age*.6)*.16;o.scale.setScalar(m.flash>0?.65:.60);}
  });
  if(m){this.mini.material.map=minibossMaps[m.stage];this.mini.position.set(m.x,m.y-.5,2.6);this.mini.scale.setScalar(6.2);this.mini.material.rotation=miniAngle(m);this.mini.material.color.setScalar(m.flash>0?1.65:1);}
  for(let i=0;i<this.plumes.length;i++){
   const p=this.plumes[i],thrust=this.exhaust3D[i];p.visible=this.mini.visible;
   thrust.visible=rebuilt&&!!m&&!m.dead;
   if(m){
     p.position.set(m.x+(i?1:-1)*1.3,m.y+2.15,2.55);
     p.scale.set(.56,1.8+Math.sin(m.age*19)*.15,1);p.material.rotation=Math.PI;p.material.opacity=.72;
     thrust.position.set(m.x+(i?1:-1)*1.3,m.y+2.0,1.15);
     thrust.rotation.z=Math.PI;thrust.scale.y=1.15+Math.sin(m.age*19+i)*.12;
   }
  }
  for(let i=0;i<this.nodes.length;i++){
   const v=this.nodes[i],n=g.nodes.filter(n=>!n.dead)[i];v.skin.visible=!!n&&n.attach!=='field'&&!rebuilt;v.back.visible=v.bar.visible=!!n;v.critical.visible=!!n&&!rebuilt&&(n.attach==='field'&&fieldDamagePhase(n.hp,n.maxHp)===2||n.attach==='mission');v.locator.visible=!!n&&n.attach==='field';v.target.visible=v.backplate.visible=false;v.fracture.visible=!!n&&n.attach==='field'&&fieldDamagePhase(n.hp,n.maxHp)>0;
   const nodeMesh=this.node3D[i];
   nodeMesh.visible=rebuilt&&!!n&&n.attach!=='field';
   if(n&&nodeMesh.visible){
     nodeMesh.position.set(n.x,n.y-.5,.65);
     nodeMesh.rotation.set(Math.sin(n.age*.9)*.1,Math.sin(n.age*.6)*.17,n.age*(n.stage%2?.24:-.28));
     nodeMesh.scale.setScalar(n.attach==='mission'?1.6:1.17);
     const shell=nodeMesh.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
     shell.material.color.setHex(n.flash>0?0xe0dbcd:n.attach==='mission'?0x769caf:0x667d91);
   }
   if(!n)continue;
   v.skin.material.map=(n.attach==='field'||n.attach==='mission')&&battlefieldAtlasMap.image instanceof HTMLImageElement&&battlefieldAtlasMap.image.naturalWidth>0?battlefieldMaps[n.stage*2+n.index]:nodeMaps[n.stage];const phase=n.attach==='field'?fieldDamagePhase(n.hp,n.maxHp):0;v.skin.material.color.setHex(n.attach==='mission'?(n.index===1?0x9ceeff:0xffaa8d):phase===2?0xffaa80:phase===1?0xffe3b8:0xffffff).multiplyScalar(n.flash>0?1.65:1);v.skin.material.opacity=phase===2?.84:1;v.skin.material.rotation=(n.attach==='field'||n.attach==='mission')?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?n.age*.35:Math.sin(n.age*1.4)*.025;v.skin.position.set(n.x,n.y-.5,2.6);v.skin.scale.set(n.attach==='mission'?3.85:n.attach==='field'?3.35:2.75,n.attach==='mission'?3.85:n.attach==='field'?3.35:2.75,1);if(v.critical.visible){v.critical.material.map=tacticalFxMaps[n.attach==='mission'?(n.index===1?3:4):9];v.critical.position.set(n.x,n.y+.14,2.68);v.critical.scale.setScalar(1.28+Math.sin(n.age*9)*.1);v.critical.material.opacity=.45+Math.sin(n.age*6)*.16;}
   const ratio=Math.max(0,n.hp/n.maxHp);
    const field=n.attach==='field'?fieldPresentation(n):null;
    if(field){
      const geometry=this.worldFacilities[n.stage*2+n.index];geometry.visible=true;
      geometry.position.set(n.x,n.y-.42,-.15);geometry.rotation.set(0,0,n.index===1?.04:-.035);geometry.scale.setScalar(1.15);
      animateFacility(geometry,n.age,field.phase,n.flash);
      v.backplate.position.set(n.x,n.y-.5,2.545);v.backplate.material.opacity=.66+.1*Math.sin(n.age*3);
      v.target.position.set(n.x,n.y-.5,2.66);v.target.rotation.z=Math.PI/6+Math.sin(n.age*.9)*.035;
      v.target.scale.setScalar(field.ring/2.02);
      v.target.material.color.setHex(field.color);v.target.material.opacity=.76+Math.sin(n.age*8)*.17;
      v.locator.position.set(n.x,n.y+.15,2.70);v.locator.rotation.z=Math.PI+Math.sin(n.age*5)*.09;
      v.locator.scale.setScalar(.65+field.warning*.13);
      v.locator.material.color.setHex(field.color);v.locator.material.opacity=.9;
      v.fracture.position.set(n.x+.16,n.y-.46,2.69);
      v.fracture.material.color.setHex(field.color);
      v.fracture.material.opacity=field.phase===2?.95:.65;
      v.fracture.rotation.z=-.55+Math.sin(n.age*.8)*.03;
      v.fracture.scale.set(field.phase===2?.075:.055,field.phase===2?2.25:1.45,1);
    }
    const barY=n.y-(field?2.50:1.85),barW=field?4.0:2.05;
    v.back.position.set(n.x,barY,2.71);v.back.scale.set(barW,field?.20:.085,1);
    v.bar.position.set(n.x-barW/2+ratio*barW/2,barY,2.73);v.bar.scale.set(ratio*(barW-.1),field?.12:.045,1);
    v.bar.material.color.setHex(field?field.color:n.attach==='mission'?(n.index===1?0x76edff:0xff9980):ENCOUNTERS[n.stage].color);
  }
  // Keep the original lit facility geometry through collapse, never restore the old billboard.
  for(const wreck of g.battlefield.collapses){
   // Hold the entire building stationary through the initial core detonation, THEN let it fall.
    const hold=.93,u=Math.min(1,Math.max(0,(wreck.age-hold)/(wreck.life-hold)));
    const quake=Math.sin(wreck.age*36)*.045*(1-Math.min(1,wreck.age/hold));
    const model=this.worldFacilities[wreck.stage*2+wreck.index];
   model.visible=true;
   model.position.set(wreck.x+quake,wreck.y-.42-u*1.75,-.25-u*.36);
   model.rotation.set(u*.16*Math.sin(wreck.index+1),u*.1,(wreck.index===1?.04:-.035)+quake+Math.sin(u*8+wreck.index)*u*.18);
   model.scale.setScalar(1.15*(1-u*.43));
   animateFacility(model,wreck.age,2,wreck.age<hold?1:0);
   const core=model.userData.lighting as T.Mesh|undefined;
   if(core&&core.material instanceof T.MeshPhysicalMaterial){
    core.material.emissiveIntensity=Math.max(0,(wreck.age<hold?1.85+Math.sin(wreck.age*43)*.35:1.4)*(1-u));
    core.material.opacity=Math.max(.08,1-u);
   }
  }
  // Both gameplay routes reuse lit, thick fallen metal, not the old facility sticker.
  if(this.terrainStage!==g.stage){for(const v of this.terrain){this.root.remove(v.skin);v.skin=this.debrisTemplates[g.stage].clone();this.root.add(v.skin);}this.terrainStage=g.stage;}
  // Pre-allocated world-space debris pools share exactly the same collision geometry.
  for(let i=0;i<this.terrain.length;i++){
   const v=this.terrain[i],piece=g.battlefield.terrain[i];
   v.skin.visible=!!piece;v.warning.visible=!!piece&&piece.route==='hazard'&&piece.age<piece.warning;
   if(!piece)continue;
   const active=isTerrainActive(piece),fade=Math.max(.15,Math.min(1,(piece.life-piece.age)/2.5));
   v.skin.position.set(piece.x,piece.y,-.25);
   v.skin.rotation.set(piece.side*.045,0,piece.side*(piece.route==='cover'?.21:-.16)+Math.sin(piece.age*.42)*.06);
   const scale=piece.radius*.78*(1-Math.min(.22,(piece.age/piece.life)*.2));
   v.skin.scale.setScalar(scale);
   if(v.warning.visible){
    v.warning.material.opacity=.45+.30*Math.abs(Math.sin(piece.age*8));
    v.warning.position.set(piece.x,piece.y,1.12);
    v.warning.scale.setScalar(piece.radius*2.5);
   }
  }
  const spectacle=missionBeacons(g);
  for(let i=0;i<this.missionGlow.length;i++){
   const marker=this.missionGlow[i],part=spectacle?.pieces[i],physical=this.mission3D[i];marker.visible=!!part&&!rebuilt;physical.visible=!!part&&rebuilt;if(!part||!spectacle)continue;
   marker.material.map=tacticalFxMaps[spectacle.style.fx];
   marker.material.color.setHex(spectacle.style.color);
   marker.material.opacity=part.alpha;
   marker.position.set(part.x,part.y,2.54);marker.scale.setScalar(part.scale*2.8);
   marker.material.rotation=part.angle;physical.position.set(part.x,part.y,-.25);physical.scale.setScalar(part.scale*1.4);physical.rotation.z=part.angle;physical.material.color.setHex(spectacle.style.color);physical.material.opacity=Math.min(.30,part.alpha*.30);
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
 const im=nodeAtlasMap.image,field=battlefieldAtlasMap.image;for(const n of g.nodes){if(n.dead)continue;c.save();c.translate(n.x,n.y);c.rotate((n.attach==='field'||n.attach==='mission')?Math.sin(n.age*.65)*.012:n.stage===0||n.stage===4?-n.age*.35:Math.sin(n.age*1.4)*.025);c.scale(1,-1);if(n.attach==='field'){
  // Same Three.js world geometry as WebGL, CPU-rasterized once for compatibility.
  const structure=canvasFacility(n.stage,n.index);
  if(structure.width>0){c.globalAlpha=1;c.drawImage(structure.canvas,structure.left*1.15,-structure.top*1.15,structure.width*1.15,structure.height*1.15);}
 }
 if(n.attach==='mission'&&field instanceof HTMLImageElement&&field.naturalWidth>0){const k=n.stage*2+n.index,w=field.width/4,h=field.height/3;c.drawImage(field,k%4*w,Math.floor(k/4)*h,w,h,-1.675,-1.675,3.35,3.35);}else if(n.attach!=='field'){const w=im.width/3,h=im.height/2;c.drawImage(im,n.stage%3*w,Math.floor(n.stage/3)*h,w,h,-1.375,-1.375,2.75,2.75);}if(n.attach==='mission'){c.strokeStyle=n.index===1?'#78e9ff':'#ff987d';c.lineWidth=.085;c.globalAlpha=.7+.2*Math.sin(n.age*8);c.beginPath();c.arc(0,0,1.95,0,Math.PI*2);c.stroke();}
 if(n.attach==='field'){
 const phase=fieldDamagePhase(n.hp,n.maxHp);
 const f=fieldPresentation(n),ring=f.ring;
  c.globalAlpha=.6;c.strokeStyle='#'+f.color.toString(16).padStart(6,'0');c.lineWidth=.055;
  c.beginPath();c.arc(0,0,.71+Math.sin(n.age*5)*.025,0,Math.PI*2);c.stroke();
  // Armor fractures overlay the sprite rather than looking like a background decoration.
  if(phase>0){c.strokeStyle='#ffb699';c.lineWidth=.09;c.globalAlpha=.92;c.beginPath();c.moveTo(-.70,-.75);c.lineTo(-.22,-.12);c.lineTo(-.50,.42);c.lineTo(.35,1.12);c.stroke();}
  if(phase===2){c.fillStyle='#ff684e';c.globalAlpha=.36+.2*Math.sin(n.age*12);c.beginPath();c.arc(0,0,.93,0,Math.PI*2);c.fill();}
 if(phase>0){c.globalAlpha=.8;c.strokeStyle=phase===2?'#ffb494':'#fff0c1';c.lineWidth=.05;
  for(let k=0;k<phase+1;k++){const x=(k-1)*.48;c.beginPath();c.moveTo(x-.35,-.95);c.lineTo(x+.15,-.3);c.lineTo(x-.2,.35);c.lineTo(x+.36,.88);c.stroke();}
  if(phase===2){const fx=tacticalFxMaps[9].image;if(fx instanceof HTMLImageElement&&fx.naturalWidth>0){const w=fx.width/4,h=fx.height/4;c.globalAlpha=.65;c.drawImage(fx,w,h*2,w,h,-.72,-.72,1.44,1.44);}}
 }
}c.restore();c.save();
  const f=n.attach==='field'?fieldPresentation(n):null;
  const w=f?4.0:2.05,barY=n.y-(f?2.50:1.39);
  c.fillStyle='#06111c';c.globalAlpha=.94;c.fillRect(n.x-w/2,barY,w,f?.20:.085);
  c.fillStyle='#'+(f?f.color:n.attach==='mission'?(n.index===1?0x76edff:0xff9980):ENCOUNTERS[n.stage].color).toString(16).padStart(6,'0');
  c.globalAlpha=1;c.fillRect(n.x-w/2+.05,barY+.025,(w-.10)*Math.max(0,n.hp/n.maxHp),f?.15:.045);c.restore();}
 // Generated tactical VFX atlas: six world-specific orbital designs.
 const spectacle=missionBeacons(g),fxAtlas=tacticalFxMaps[0].image;
 if(spectacle&&fxAtlas instanceof HTMLImageElement&&fxAtlas.naturalWidth>0){
  const w=fxAtlas.width/4,h=fxAtlas.height/4,k=spectacle.style.fx;
  for(const p of spectacle.pieces){
   c.save();c.translate(p.x,p.y);c.rotate(-p.angle);c.scale(1,-1);c.globalAlpha=Math.max(0,Math.min(.65,p.alpha));
   c.drawImage(fxAtlas,k%4*w,Math.floor(k/4)*h,w,h,-p.scale*1.4,-p.scale*1.4,p.scale*2.8,p.scale*2.8);
   c.restore();
  }
 }
 // A dynamic corridor is visible in every renderer, with precise circular danger telegraphs.
 for(const piece of g.battlefield.terrain){
  const live=isTerrainActive(piece),r=piece.radius;
  c.save();c.translate(piece.x,piece.y);
  const raster=canvasFacilityDebris(piece.stage);
  const scale=r*.78;
  c.save();c.rotate(piece.side*(piece.route==='cover'?.21:-.16));c.globalAlpha=live?.95:.45;
  c.drawImage(raster.canvas,raster.left*scale,-raster.top*scale,raster.width*scale,raster.height*scale);
  c.restore();
  c.globalAlpha=piece.route==='hazard'?(live?.70:.35+.25*Math.abs(Math.sin(piece.age*8))):.4;
  c.strokeStyle=piece.route==='hazard'?'#ffb36c':'#7ef4ff';c.lineWidth=.08;
  c.beginPath();c.arc(0,0,r+.22,0,Math.PI*2);c.stroke();
  if(piece.route==='hazard'&&!live){c.strokeStyle='#ff685a';c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();}
  c.restore();
 }
 // Canvas renders the same physical geometry cached in canvasFacility, not the pre-3D art atlas.
 for(const wreck of g.battlefield.collapses){
  const hold=.93,u=Math.min(1,Math.max(0,(wreck.age-hold)/(wreck.life-hold)));
   const quake=Math.sin(wreck.age*36)*.045*(1-Math.min(1,wreck.age/hold));
   const raster=canvasFacility(wreck.stage,wreck.index);
  c.save();c.translate(wreck.x+quake,wreck.y-u*1.75);
  c.rotate(quake+Math.sin(u*8+wreck.index)*u*.18);c.globalAlpha=(1-u)**1.25;
  const scale=1.15*(1-u*.43);
  c.drawImage(raster.canvas,raster.left*scale,-raster.top*scale,raster.width*scale,raster.height*scale);
  c.restore();
 }
}
export function drawBossShieldCanvas(c:CanvasRenderingContext2D,g:Game){const b=g.boss;if(!b||b.dead||!b.guard)return;c.save();c.globalAlpha=.38+Math.sin(b.age*9)*.12;c.strokeStyle='#b9a3ff';c.lineWidth=.08;c.beginPath();c.arc(b.x,b.y-.85,1.9,0,Math.PI*2);c.stroke();c.restore();}
