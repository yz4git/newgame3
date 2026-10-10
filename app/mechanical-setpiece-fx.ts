import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
const TAU=Math.PI*2;
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const fract=(x:number)=>x-Math.floor(x);
const hash=(n:number)=>fract(Math.sin(n*91.73+38.1)*43758.545);
type Chapter='fracture'|'collapse'|'boss-morph'|'boss-finish';
type Beat={chapter:Chapter;age:number;life:number;x:number;y:number;scale:number;serial:number};

/** Actual machinery that opens, buckles, shears and falls into scene depth.
 * All parts are instanced. No flat flash quads, emissive floods or duplicate
 * billboard rings. Presentation stays behind combat Z and cannot block shots.
 */
export class MechanicalSetpieceFX {
 readonly root=new T.Group();
 private steel=new T.MeshStandardMaterial({color:0x6e8190,metalness:.51,roughness:.52,side:T.DoubleSide});
 private damaged=new T.MeshStandardMaterial({color:0x493c39,metalness:.42,roughness:.66,side:T.DoubleSide});
 private inner=new T.MeshStandardMaterial({color:0x916447,metalness:.34,roughness:.58,side:T.DoubleSide});
 private panel:T.InstancedMesh;
 private piston:T.InstancedMesh;
 private core:T.InstancedMesh;
 private dummy=new T.Object3D();
 private beats:Beat[]=[];
 private serial=0;
 private lastStage=-1;
 constructor(){
  this.root.name='orchestrated-mechanical-3d-setpieces';
  const inst=(name:string,g:T.BufferGeometry,m:T.Material,n:number)=>{
   const part=new T.InstancedMesh(g,m,n);
   part.name=name;part.frustumCulled=false;
   part.instanceMatrix.setUsage(T.DynamicDrawUsage);
   part.count=0;this.root.add(part);return part;
  };
  this.panel=inst('fractured-armour-panels',new T.BoxGeometry(1,1,1),this.steel,36);
  this.piston=inst('telescoping-reactor-pistons',new T.CylinderGeometry(.22,.32,1,7),this.damaged,24);
  this.core=inst('exposed-physical-reactor-faces',new T.DodecahedronGeometry(1,0),this.inner,3);
 }
 event(e:GameEvent){
  if(e.type==='stage'){this.beats=[];this.panel.count=this.piston.count=this.core.count=0;return;}
  const kind:Chapter|null=e.type==='fieldcritical'?'fracture':
   e.type==='fieldcollapse'?'collapse':
   e.type==='bosstransform'||e.type==='bossform'?'boss-morph':
   e.type==='bosskill'?'boss-finish':null;
  if(!kind)return;
  const life=kind==='fracture'?.85:kind==='boss-morph'?1.55:kind==='boss-finish'?2.7:2.35;
  if(this.beats.length>=3)this.beats.shift();
  this.beats.push({
   chapter:kind,age:0,life,x:e.x??0,y:e.y??0,
   scale:clamp((e.size??3)*.22,.9,2.4),serial:++this.serial
  });
 }
 draw(g:Game,dt:number,mix:FxMix,reduced=false,performance=false){
  if(this.lastStage!==g.stage){this.lastStage=g.stage;this.beats=[];}
  this.root.visible=!reduced&&(g.state==='playing'||g.state==='transition');
  if(dt>0)for(const b of this.beats)b.age+=dt;
  this.beats=this.beats.filter(b=>b.age<b.life);
  if(!this.root.visible){
   this.panel.count=this.piston.count=this.core.count=0;return;
  }
  const warm=[0x847286,0x5e95a1,0x7f94a8,0x97b8cb,0x6a9676,0xa4744c];
  this.steel.color.setHex(warm[g.stage]??0x7b8394);
  this.inner.color.setHex(g.stage===5?0xba7044:0x789eaf);
  let np=0,nr=0,nc=0;
  const sequence=performance||mix.crowded?this.beats.slice(-1):this.beats;
  for(const b of sequence){
   const u=clamp(b.age/b.life,0,1),isBoss=b.chapter.startsWith('boss');
   const split=b.chapter==='fracture'?.22:b.chapter==='boss-morph'?.48:1;
   const unfold=clamp(u*2.8,0,1),fall=clamp((u-.36)/.64,0,1);
   const size=b.scale*(isBoss?1.5:1.0);
   const plates=performance||mix.crowded?6:12;
   for(let j=0;j<plates&&np<36;j++){
    const a=j*TAU/plates+(isBoss?.13:0),r=(isBoss?2.15:1.35)*size;
    const lift=(unfold*split)*(1.15+j%3*.26)*size;
    const x=b.x+Math.cos(a)*(r+lift),y=b.y+Math.sin(a)*(r+lift)-fall*2.7;
    const z=(isBoss?-.8:-2.4)-fall*(2.8+j%3*.44);
    this.dummy.position.set(x,y,z);
    this.dummy.rotation.set(fall*j*.33,u*2*(j%2?1:-1),a+u*.9*(j%2?1:-1));
    const fade=1-u*.67;
    this.dummy.scale.set(size*.45*fade,size*(.96-j%3*.11)*fade,size*.28);
    this.dummy.updateMatrix();this.panel.setMatrixAt(np++,this.dummy.matrix);
   }
   for(let j=0;j<(performance||mix.crowded?4:8)&&nr<24;j++){
    const a=j*TAU/8;
    const p=(.85+unfold*.75)*size;
    this.dummy.position.set(b.x+Math.cos(a)*p,b.y+Math.sin(a)*p,-2.5-fall);
    this.dummy.rotation.set(u*.28,0,a-Math.PI/2);
    this.dummy.scale.set(size*.4,size*(1.1+unfold*.58)*(1-fall*.6),size*.4);
    this.dummy.updateMatrix();this.piston.setMatrixAt(nr++,this.dummy.matrix);
   }
   if(nc<3){
    this.dummy.position.set(b.x,b.y,-2.65-fall*2.1);
    this.dummy.rotation.set(u*1.1,u*.82,u*1.6);
    const swell=size*(b.chapter==='fracture'?.57:.85)*(1-u*.7);
    this.dummy.scale.set(swell,swell*.82,swell*.58);
    this.dummy.updateMatrix();this.core.setMatrixAt(nc++,this.dummy.matrix);
   }
  }
  this.panel.count=np;this.piston.count=nr;this.core.count=nc;
  for(const mesh of[this.panel,this.piston,this.core])mesh.instanceMatrix.needsUpdate=true;
 }
 diagnostics(){return {active:this.beats.length,chapters:this.beats.map(b=>b.chapter),panels:this.panel.count,pistons:this.piston.count,reactors:this.core.count,limits:{beats:3,panels:36,pistons:24,cores:3}};}
}
