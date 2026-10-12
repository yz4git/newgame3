import * as T from 'three/webgpu';
import type {stageSpectaclePose} from './stage-spectacle-timeline.ts';
type Pose=ReturnType<typeof stageSpectaclePose>;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const hash=(x:number)=>{const v=Math.sin(x*84.47+12.7)*43758.5453;return v-Math.floor(v);};
const dummy=new T.Object3D();
const HAZE=[0x9c7d9c,0x549cae,0x5d83a8,0xb8d7e0,0x73946c,0xd07b47];
const CRACK=[0xb5a1a2,0xa8e6ee,0xff8766,0xd4f3ff,0x94c79d,0xf3a66b];
/** Entirely mesh/instanced 3D physical aftermath, no sprite/fullscreen quads.
 * Behind enemy bullets; capped 32 shards, 20 wisps, 7 low-intensity cracks.
 * No time-based wrap or accumulating transient allocation.
 */
export class StageSpectacleParticles{
 readonly root=new T.Group();
 private fragments:T.InstancedMesh;
 private wash:T.InstancedMesh;
 private cracks:T.Group;
 private crackBars:T.Mesh[]=[];
 private materials:T.Material[]=[];
 private last={fragments:0,wash:0,light:0};
 constructor(private stage:number,private act:number){
  this.root.name='physical-stage-impact-'+stage+'-'+act;
  const shardMat=new T.MeshStandardMaterial({color:HAZE[stage],roughness:.77,metalness:stage===2||stage===5?.39:.06,transparent:true,opacity:.72,depthWrite:false});
  const plumeMat=new T.MeshBasicMaterial({color:HAZE[stage],toneMapped:true,transparent:true,opacity:.20,depthWrite:false});
  const crackMat=new T.MeshBasicMaterial({color:CRACK[stage],toneMapped:true,transparent:true,opacity:.24,depthWrite:false});
  this.materials.push(shardMat,plumeMat,crackMat);
  const geometry=stage===3?new T.OctahedronGeometry(1,0)
   :stage===1?new T.IcosahedronGeometry(1,0)
   :stage===4?new T.DodecahedronGeometry(1,0)
   :stage===5?new T.TetrahedronGeometry(1,0)
   :stage===2?new T.BoxGeometry(1,1,1):new T.IcosahedronGeometry(1,0);
  this.fragments=new T.InstancedMesh(geometry,shardMat,32);
  this.wash=new T.InstancedMesh(new T.ConeGeometry(.55,1.6,5,1),plumeMat,20);
  for(const inst of [this.fragments,this.wash]){
   inst.frustumCulled=false;inst.count=0;inst.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(inst);
  }
  this.cracks=new T.Group();this.cracks.name='foreshadowing-fractures-and-pressure';
  for(let k=0;k<7;k++){
   const line=new T.Mesh(new T.BoxGeometry(.14,1,.09),crackMat);
   line.userData.offset=k;this.cracks.add(line);this.crackBars.push(line);
  }
  this.root.add(this.cracks);
 }
 draw(pose:Pose,envelope:number,performance=false,reduced=false){
  const {t,anticipation,action,impact,fallout,afterglow}=pose;
  const beat=5.8,quality=performance?.60:1;
  const pressure=clamp((anticipation*.55+impact*.75+afterglow*.15)*envelope);
  const warningBars=this.crackBars;
  this.cracks.visible=!reduced&&pressure>.004;
  for(let i=0;i<warningBars.length;i++){
   const b=warningBars[i],a=i*Math.PI*2/7;
   // Stage-specific fracture direction and size: cascading sea spray,
   // fractured meteor fault, citadel warning slits, polar ice,
   // spreading root veins and molten cracks.
   const scale=this.stage===1?1.6:this.stage===3?1.35:this.stage===5?1.5:1;
   const opening=this.stage===4?2.5:this.stage===2?4.1:3.7;
   b.position.set(Math.cos(a)*opening,Math.sin(a)*opening*.85,-5.10+(i%3)*.12);
   b.rotation.z=this.stage===1?Math.sin(a)*.22:this.stage===4?a-.4:this.stage===2?a:a+Math.sin(i)*.25;
   b.scale.set(.65,scale*(1.0+action*3.6)*(i%2?.75:1.3),1);
  }
  (warningBars[0]?.material as T.MeshBasicMaterial).opacity=.24*pressure;
  const fade=envelope*(reduced?.20:1);
  const shardCount=reduced?0:performance?16:32;
  const streamCount=reduced?0:performance?10:20;
  let visible=0,clouds=0;
  for(let i=0;i<shardCount;i++){
   // Burst propagates AFTER impact, starting small so not a one-frame pop.
   const since=t-beat-(i%7)*.11;
   const life=2.9+(i%5)*.35;
   const fraction=clamp(since/life);
   if(since<=0||fraction>=1)continue;
   const angle=i*2.399+this.stage*.47;
   const rad=(1.4+hash(i+this.act*31)*4.2)*fraction*(this.stage===3?1.4:1);
   const upward=this.stage===1||this.stage===5;
   const falling=this.stage===3;
   dummy.position.set(
    Math.cos(angle)*rad+(this.stage===2?Math.sin(i)*.6:0),
    Math.sin(angle)*rad*.78+(upward?Math.sin(Math.PI*fraction)*2.6:falling?-fraction*4.8:-fraction*1.6),
    -4.7-(i%4)*.48-fraction*(1+(i%3)*.6));
   dummy.rotation.set(fraction*i*.15,fraction*i*.24,angle+fraction*(i%2?4:-3));
   const fadeIn=clamp(since/.40),fadeOut=clamp((life-since)/1.15);
   const radius=(.23+hash(i+17)*.59)*fadeIn*fadeOut*fade*quality;
   const unit=this.stage===1?[.56,1.5,.6]:this.stage===4?[1.4,.65,.55]:this.stage===5?[.46,1.9,.4]:[1,1.35,.8];
   dummy.scale.set(radius*unit[0],radius*unit[1],radius*unit[2]);
   dummy.updateMatrix();this.fragments.setMatrixAt(visible++,dummy.matrix);
  }
  this.fragments.count=visible;this.fragments.instanceMatrix.needsUpdate=true;
  for(let i=0;i<streamCount;i++){
   const onset=4.2+(i%5)*.20;
   const since=t-onset;
   const span=4.4+(i%4)*.7;
   if(since<=0||since>=span)continue;
   const u=clamp(since/span),a=i*2.399+this.act*1.3;
   const h=this.stage===1?6.0:this.stage===3?3.8:this.stage===5?4.7:2.8;
   dummy.position.set(Math.cos(a)*(1.8+(i%3)*1.25)+Math.sin(t*.35+i)*u,
    Math.sin(a)*2.3+u*h*(this.stage===3?-1:1),-6.6+(i%3)*.20);
   dummy.rotation.set(this.stage===4?.5:0,Math.sin(a)*.35,a*.32);
   const w=(.5+.5*Math.sin(u*Math.PI))*(.26+(i%4)*.11)*fade*quality;
   dummy.scale.set(w*(this.stage===4?2:.8),w*(2.8+(i%3)*1.3),w*.80);
   dummy.updateMatrix();this.wash.setMatrixAt(clouds++,dummy.matrix);
  }
  this.wash.count=clouds;this.wash.instanceMatrix.needsUpdate=true;
  (this.fragments.material as T.MeshStandardMaterial).opacity=.70*fade;
  (this.wash.material as T.MeshBasicMaterial).opacity=(this.stage===1?.16:.12)*fade;
  this.last={fragments:visible,wash:clouds,light:pressure};
 }
 diagnostics(){return this.last;}
 dispose(){
  this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  for(const m of this.materials)m.dispose();
 }
}
