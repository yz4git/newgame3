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
  const life=type==='fieldclear'?.86:type==='fieldcollapse'?.66:type==='fieldburst'?.43:.48;
  const color=e.color??(type==='fieldcritical'?0xffcc86:0xffad63);
  this.pulses.push({x:e.x??0,y:e.y??0,age:0,life,size,color,type});
  if(this.pulses.length>12)this.pulses.shift();
  const count=type==='fieldcollapse'?24:type==='fieldburst'?9:type==='fieldcritical'?5:0;
  for(let i=0;i<count;i++){
   const n=++this.serial,a=unit(n+7)*Math.PI*2,vel=type==='fieldcollapse'?4.7:2.8;
   const speed=vel+unit(n+42)*5;
   this.shards.push({
    x:e.x??0,y:e.y??0,z:2.75,
    vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-.6,vz:.7+unit(n+11)*2,
    angle:a,spin:(unit(n+53)-.5)*8,age:0,life:.66+unit(n+23)*.64,
    size:.09+unit(n+34)*.19,
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
 private cores:T.Mesh<T.CircleGeometry,T.MeshBasicMaterial>[]=[];
 private shards:T.InstancedMesh;
 private dummy=new T.Object3D();
 private tint=new T.Color();
 constructor(){
  const ringShape=new T.RingGeometry(.94,1.06,48);
  const coreShape=new T.CircleGeometry(1,24);
  for(let i=0;i<12;i++){
   const ring=new T.Mesh(ringShape,new T.MeshBasicMaterial({color:0xffb87a,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
   const core=new T.Mesh(coreShape,new T.MeshBasicMaterial({color:0xffedce,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
   ring.visible=core.visible=false;ring.frustumCulled=core.frustumCulled=false;
   this.rings.push(ring);this.cores.push(core);this.root.add(ring,core);
  }
  this.shards=new T.InstancedMesh(new T.TetrahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,depthWrite:false,toneMapped:false}),112);
  this.shards.count=0;this.shards.frustumCulled=false;
  this.shards.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.root.add(this.shards);
 }
 event(e:GameEvent){this.motion.event(e);}
 draw(g:Game,dt:number,reduced=false){
  this.motion.update(g,dt,reduced);
  this.rings.forEach((ring,i)=>{
   const p=this.motion.pulses[i],core=this.cores[i];ring.visible=core.visible=!!p;if(!p)return;
   const u=clamp(p.age/p.life,0,1);
   const blast=p.type==='fieldclear'?1.05:p.type==='fieldcollapse'?.8:.62;
   ring.position.set(p.x,p.y,2.9);ring.scale.setScalar((.19+u*blast)*p.size);
   ring.material.opacity=(1-u)**1.9*(p.type==='fieldclear'?.46:.78);
   ring.material.color.setHex(p.color);ring.rotation.z=u*.10;
   core.position.set(p.x,p.y,2.88);core.scale.setScalar((.25+u*.42)*Math.min(3.5,p.size));
   core.material.color.setHex(p.type==='fieldclear'?0xaadfff:0xffe8c5);
   core.material.opacity=Math.max(0,(1-u*3.7))*.68;
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
  const u=clamp(p.age/p.life,0,1),radius=p.size*(.16+u*(p.type==='fieldclear'?1.10:.76));
  const red=(p.color>>16)&255,green=(p.color>>8)&255,blue=p.color&255;
  const rgb=red+','+green+','+blue;
  c.save();
  // Screen-space core plasma bloom, drawn analytically instead of stretching a baked animation sheet.
  if(u<.46){
   const r=Math.min(2.5,p.size)*(.33+u*.48);
   const gradient=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
   gradient.addColorStop(0,'rgba(255,249,221,'+((1-u/.46)*.82)+')');
   gradient.addColorStop(.29,'rgba('+rgb+','+((1-u/.46)*.58)+')');
   gradient.addColorStop(1,'rgba('+rgb+',0)');
   c.fillStyle=gradient;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=(1-u)**2*(p.type==='fieldclear'?.6:.82);
  c.strokeStyle='#'+p.color.toString(16).padStart(6,'0');
  c.lineWidth=Math.max(.03,.11*(1-u*.7));
  c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke();
  if(p.type==='fieldcollapse'){
   c.globalAlpha=(1-u)**2*.28;c.lineWidth=.045;
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
