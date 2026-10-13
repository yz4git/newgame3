import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
type Blast={x:number;y:number;age:number;size:number;id:number};
/** A pooled ignition -> rolling fire -> cooling smoke sequence replaces the
 * two uniform faceted flash balls. Three draws, no texture, no extra light. */
export class CinematicDetonations {
 readonly root=new T.Group();
 private blasts:Blast[]=[];
 private fire:T.InstancedMesh;
 private smoke:T.InstancedMesh;
 private cores:T.InstancedMesh;
 private dummy=new T.Object3D();
 private color=new T.Color();
 private amber=new T.Color(0xe17b3c);
 private soot=new T.Color(0x39414b);
 private serial=0;
 private lastStage=-1;
 constructor(){
  this.root.name='cinematic-ignition-fire-smoke';
  this.fire=new T.InstancedMesh(new T.IcosahedronGeometry(1,2),new T.MeshStandardMaterial({color:0xffffff,emissive:0x6f280c,emissiveIntensity:.65,roughness:.90,transparent:true,opacity:.44,depthWrite:false}),48);
  this.smoke=new T.InstancedMesh(new T.IcosahedronGeometry(1,2),new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,transparent:true,opacity:.26,depthWrite:false}),48);
  this.cores=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:0xf3ac67,toneMapped:true,transparent:true,opacity:.33,depthWrite:false}),8);
  for(const m of[this.fire,this.smoke,this.cores]){
   m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(m);
  }
  for(const m of[this.fire,this.smoke]){m.setColorAt(0,this.color);m.instanceColor!.setUsage(T.DynamicDrawUsage);}
 }
 event(e:GameEvent){
  if(e.type==='stage'){this.reset();return;}
  if(e.type!=='explode'&&e.type!=='bosskill'&&e.type!=='part')return;
  if(this.blasts.length===8)this.blasts.shift();
  this.blasts.push({x:e.x??0,y:e.y??0,age:0,size:Math.min(1.7,Math.max(.45,Math.sqrt(e.size??1)*.64)),id:++this.serial});
 }
 private reset(){this.blasts=[];this.fire.count=this.smoke.count=this.cores.count=0;}
 draw(g:Game,dt:number,mix:FxMix,reduced=false,performance=false){
  if(this.lastStage!==g.stage){if(this.lastStage!==-1)this.reset();this.lastStage=g.stage;}
  if(dt>0)for(const b of this.blasts)b.age+=dt;
  this.blasts=this.blasts.filter(b=>b.age<3.5);
  let nf=0,ns=0,nc=0;
  const max=performance||mix.crowded?3:8;
  const actors=this.blasts.slice(-max),lobes=reduced?1:performance?3:6;
  for(const b of actors){
   const age=b.age;
   if(age<.65){
    const r=Math.min(.66,b.size*.50)*Math.sin(clamp(age/.65)*Math.PI);
    this.dummy.position.set(b.x,b.y,.32);this.dummy.rotation.set(age,age*.3,0);
    this.dummy.scale.set(r,r*.8,r*.62);this.dummy.updateMatrix();this.cores.setMatrixAt(nc++,this.dummy.matrix);
   }
   for(let i=0;i<lobes;i++){
    const a=i*2.399+b.id*.8,delay=i*.055,t=age-delay;
    if(t<=0)continue;
    if(t<1.35){
     const u=t/1.35,grow=clamp(t/.22),fade=clamp((1.35-t)/.8);
     const r=b.size*(.25+u*.38)*grow*fade;
     this.dummy.position.set(b.x+Math.cos(a)*u*b.size*.7,b.y+Math.sin(a)*u*b.size*.6,-.15+Math.sin(a)*.12);
     this.dummy.rotation.set(a+t,a*.6-t*.8,t*.6);
     this.dummy.scale.set(r,r*(1+.2*Math.sin(a)),r*.62);this.dummy.updateMatrix();this.fire.setMatrixAt(nf,this.dummy.matrix);
     this.color.copy(this.amber).lerp(this.soot,clamp(u*1.13));this.fire.setColorAt(nf++,this.color);
    }
    if(reduced||t<.35)continue;
    const u=clamp((t-.35)/2.8),grow=clamp((t-.35)/.65),fade=clamp((3.1-t)/1.1);
    if(fade<=0)continue;
    const r=b.size*(.36+u*.50)*grow*fade*(1-mix.readability*.45);
    this.dummy.position.set(b.x+Math.cos(a)*(.2+u*.8)*b.size+u*.32,b.y+Math.sin(a)*u*b.size*.75+u*b.size*.8,-.75-u*.45);
    this.dummy.rotation.set(a+u*.9,a*.6,u*.75);
    this.dummy.scale.set(r,r*1.2,r*.72);this.dummy.updateMatrix();this.smoke.setMatrixAt(ns,this.dummy.matrix);
    this.color.setHex(i%2?0x536273:0x394350).lerp(this.soot,u);this.smoke.setColorAt(ns++,this.color);
   }
  }
  this.fire.count=nf;this.smoke.count=ns;this.cores.count=nc;
  for(const m of[this.fire,this.smoke,this.cores]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
 }
 diagnostics(){return {active:this.blasts.length,fire:this.fire.count,smoke:this.smoke.count,cores:this.cores.count,capacity:8,draws:3};}
}
