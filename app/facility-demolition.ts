import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import {animationClockRunning} from './motion.ts';

/** An in-world demolition renderer. No imported explosion atlases or billboard sprites. */
export const FACILITY_DEMOLITION_TYPES=['fieldcollapse','fieldburst','fieldcritical','fieldclear'] as const;
export type DemolitionType=typeof FACILITY_DEMOLITION_TYPES[number];
export function isFacilityDemolition(type:string):type is DemolitionType {
 return FACILITY_DEMOLITION_TYPES.includes(type as DemolitionType);
}
export interface DemolitionPulse {
 x:number;y:number;age:number;life:number;size:number;color:number;type:DemolitionType;
}
export interface MetalShard {
 x:number;y:number;z:number;vx:number;vy:number;vz:number;
 angle:number;spin:number;age:number;life:number;size:number;color:number;
}
const unit=(n:number)=>{const a=Math.sin(n*125.173+9.73)*41753.88;return a-Math.floor(a);};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));

/** Stable effects state, advanced by the same game clock as destruction and hitboxes. */
export class FacilityDemolitionMotion {
 pulses:DemolitionPulse[]=[];
 shards:MetalShard[]=[];
 private serial=0;
 event(e:GameEvent){
  if(e.type==='stage'){this.reset();return;}
  if(!isFacilityDemolition(e.type))return;
  const type=e.type;
  const size=type==='fieldclear'?7.5:type==='fieldcollapse'?4.9:type==='fieldburst'?2.0:2.5;
  // Timings use accelerated GAME time (2.25x real time). The primary detonation must persist ~1 real second.
  const life=type==='fieldclear'?2.4:type==='fieldcollapse'?2.5:type==='fieldburst'?1.5:1.05;
  const color=e.color??(type==='fieldcritical'?0xffcc86:0xffad63);
  this.pulses.push({x:e.x??0,y:e.y??0,age:0,life,size,color,type});
  if(this.pulses.length>12)this.pulses.shift();
  const count=type==='fieldcollapse'?42:type==='fieldburst'?16:type==='fieldcritical'?7:0;
  for(let i=0;i<count;i++){
   const n=++this.serial,a=unit(n+7)*Math.PI*2,vel=type==='fieldcollapse'?4.0:2.8;
   const speed=vel+unit(n+42)*5;
   this.shards.push({
    x:e.x??0,y:e.y??0,z:5.05,
    vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-.6,vz:.7+unit(n+11)*2,
    angle:a,spin:(unit(n+53)-.5)*8,age:0,life:1.2+unit(n+23)*1.05,
    size:.16+unit(n+34)*.24,
    // Silvery chunks dominate: glowing amber is restricted to occasional hot fragments.
    color:i%5===0?color:i%3===0?0x9da6b2:0x555f69
   });
   if(this.shards.length>112)this.shards.shift();
  }
 }
 update(g:Game,dt:number,reduced=false){
  if(!animationClockRunning(g))return;
  for(const p of this.pulses)p.age+=dt;
  this.pulses=this.pulses.filter(p=>p.age<p.life);
  if(reduced){this.shards=[];return;}
  for(const s of this.shards){
   s.age+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
   s.vy-=3.1*dt;s.vz-=3.3*dt;s.angle+=s.spin*dt;
  }
  this.shards=this.shards.filter(s=>s.age<s.life);
 }
 reset(){this.pulses=[];this.shards=[];this.serial=0;}
 diagnostics(){return {pulses:this.pulses.length,shards:this.shards.length};}
}

/** No texture sampling: GPU rings, core discs and genuinely 3D tetrahedral metal fragments. */
export class FacilityDemolition3D {
 root=new T.Group();
 motion=new FacilityDemolitionMotion();
 private rings:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>[]=[];
 private cores:T.Mesh<T.SphereGeometry,T.MeshBasicMaterial>[]=[];
 private halos:T.Mesh<T.CircleGeometry,T.MeshBasicMaterial>[]=[];
 private secondRings:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>[]=[];
 private shards:T.InstancedMesh;
 private dummy=new T.Object3D();
 private tint=new T.Color();
 constructor(){
  const ringShape=new T.RingGeometry(.94,1.06,48);
  const coreShape=new T.SphereGeometry(1,12,8);
  const haloShape=new T.CircleGeometry(1,36);
  const secondaryShape=new T.RingGeometry(.95,1.045,44);
  for(let i=0;i<12;i++){
   const material=(color:number)=>new T.MeshBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide});
   const ring=new T.Mesh(ringShape,material(0xffb87a));
   const core=new T.Mesh(coreShape,material(0xffedce));
   const halo=new T.Mesh(haloShape,material(0xffad4b));
   const second=new T.Mesh(secondaryShape,material(0xffe6ae));
   ring.visible=core.visible=halo.visible=second.visible=false;
   ring.renderOrder=901;second.renderOrder=900;halo.renderOrder=899;core.renderOrder=902;
   ring.frustumCulled=core.frustumCulled=halo.frustumCulled=second.frustumCulled=false;
   this.rings.push(ring);this.secondRings.push(second);this.cores.push(core);this.halos.push(halo);
   this.root.add(halo,second,ring,core);
  }
  this.shards=new T.InstancedMesh(new T.TetrahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}),112);
  this.shards.count=0;this.shards.frustumCulled=false;this.shards.renderOrder=903;
  this.shards.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.root.add(this.shards);
 }
 event(e:GameEvent){this.motion.event(e);}
 draw(g:Game,dt:number,reduced=false){
  this.motion.update(g,dt,reduced);
  this.rings.forEach((ring,i)=>{
   const p=this.motion.pulses[i],core=this.cores[i],halo=this.halos[i],second=this.secondRings[i];
   ring.visible=core.visible=halo.visible=second.visible=!!p;if(!p)return;
   const u=clamp(p.age/p.life,0,1);
   const size=p.size,outer=(.22+u*(p.type==='fieldclear'?1.18:1.04))*size;
   const intensity=Math.pow(1-u,.7);
   const typeColor=p.type==='fieldclear'?0xb6eeff:p.color;
   // All layers are rendered above in-world architecture, not depth-occluded by the falling model.
   ring.position.set(p.x,p.y,6.25);ring.scale.setScalar(outer);
   ring.material.opacity=intensity*(p.type==='fieldclear'?.95:1.0);
   ring.material.color.setHex(typeColor);ring.rotation.z=u*.15;
   second.position.set(p.x,p.y,6.24);
   second.scale.setScalar(outer*(.66+u*.17));
   second.material.color.setHex(0xffe7ad);
   second.material.opacity=intensity*.55;
   halo.position.set(p.x,p.y,6.20);
   halo.scale.setScalar(size*(.65+u*.55));
   halo.material.color.setHex(typeColor);
   halo.material.opacity=(1-u)**1.35*(p.type==='fieldclear'?.15:.23);
   core.position.set(p.x,p.y,6.31);
   const flicker=.95+.12*Math.sin(p.age*27);
   core.scale.setScalar(Math.min(2.8,size*.54)*(.65+u*.28)*flicker);
   core.material.color.setHex(p.type==='fieldclear'?0xd9ffff:0xfff4c9);
   core.material.opacity=Math.max(0,1-u*1.7)*(p.type==='fieldburst'?.78:.98);
  });
  let n=0;
  for(const p of this.motion.shards){
   const fade=1-p.age/p.life;
   this.dummy.position.set(p.x,p.y,p.z);
   this.dummy.rotation.set(.4*p.angle,.2*p.angle,p.angle);
   this.dummy.scale.set(p.size*fade,p.size*(1+.35*fade)*fade,p.size*.5*fade);
   this.dummy.updateMatrix();this.shards.setMatrixAt(n,this.dummy.matrix);
   this.tint.setHex(p.color);this.shards.setColorAt(n,this.tint);n++;
  }
  this.shards.count=n;this.shards.instanceMatrix.needsUpdate=true;
  if(this.shards.instanceColor)this.shards.instanceColor.needsUpdate=true;
 }
 diagnostics(){return this.motion.diagnostics();}
}
/** World-space fallback has the same silhouettes and timing without a sprite atlas. */
export function drawFacilityDemolitionCanvas(c:CanvasRenderingContext2D,motion:FacilityDemolitionMotion,reduced=false){
 for(const p of motion.pulses){
  const u=clamp(p.age/p.life,0,1),radius=p.size*(.22+u*(p.type==='fieldclear'?1.18:1.04));
  const red=(p.color>>16)&255,green=(p.color>>8)&255,blue=p.color&255;
  const rgb=red+','+green+','+blue;
  c.save();
  // Screen-space core plasma bloom, drawn analytically instead of stretching a baked animation sheet.
  if(u<.72){
   const r=Math.min(3.6,p.size)*(.57+u*.52);
   const gradient=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
   gradient.addColorStop(0,'rgba(255,249,221,'+((1-u/.72)*.94)+')');
   gradient.addColorStop(.29,'rgba('+rgb+','+((1-u/.72)*.75)+')');
   gradient.addColorStop(1,'rgba('+rgb+',0)');
   c.fillStyle=gradient;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=(1-u)**.72*(p.type==='fieldclear'?.88:1);
  c.strokeStyle='#'+p.color.toString(16).padStart(6,'0');
  c.lineWidth=Math.max(.05,.20*(1-u*.6));
  c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke();
  if(p.type==='fieldcollapse'){
   c.globalAlpha=(1-u)**.85*.72;c.lineWidth=.10;
   c.beginPath();c.arc(p.x,p.y,radius*.75,0,Math.PI*2);c.stroke();
  }
  c.restore();
 }
 if(reduced)return;
 for(const p of motion.shards){
  const alpha=1-p.age/p.life;
  c.save();c.translate(p.x,p.y);c.rotate(p.angle);
  c.globalAlpha=alpha;
  c.fillStyle='#'+p.color.toString(16).padStart(6,'0');
  c.fillRect(-p.size*.58,-p.size*.28,p.size*1.16,p.size*.56);
  c.strokeStyle='#a9b3be';c.lineWidth=.018;c.strokeRect(-p.size*.58,-p.size*.28,p.size*1.16,p.size*.56);
  c.restore();
 }
}
