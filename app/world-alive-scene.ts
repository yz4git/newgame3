import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import type {FxMix} from './fx-director.ts';
import {WORLD_ALIVE_STAGES,WORLD_ALIVE_BUDGET} from './world-alive.ts';
import {STAGES} from './stages.ts';

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const ease=(x:number)=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
const TAU=Math.PI*2;
const hash=(n:number)=>{const v=Math.sin(n*89.3+19.5)*43758.5453;return v-Math.floor(v);};
const box=new T.BoxGeometry(1,1,1);
const cylinder=new T.CylinderGeometry(.5,.5,1,9);
const torus=new T.TorusGeometry(1,.11,8,36);
const octa=new T.OctahedronGeometry(1,0);
const temp=new T.Object3D();

interface Bay {
 root:T.Group;lid:T.Group;engine:T.Group;panel:T.Mesh;internal:T.Group;
 side:number;index:number;
}
interface BossVault {
 root:T.Group;arms:T.Group[];cores:T.Mesh[];shields:T.Group[];center:T.Group;reactor:T.Mesh;covers:T.Mesh[];
}
interface Rupture {
 x:number;y:number;z:number;age:number;life:number;speedX:number;speedY:number;speedZ:number;size:number;spin:number;
}
/** A genuine, stage-authored architectural counterpart to the real campaign
 * state machine. Bay doors, orbital ring clamps, boss vaults and exit passages
 * respond to actual nodes, enemy sorties, boss phases and boss defeat.
 * z <= -3.8; zero extra collision surfaces, no extra screen-space bloom.
 */
export class WorldAliveScene {
 readonly root=new T.Group();
 private main=new T.Group();
 private bayLayer=new T.Group();
 private bossLayer=new T.Group();
 private fractureLayer=new T.Group();
 private archMat=new T.MeshStandardMaterial({color:0x465974,metalness:.48,roughness:.53});
 private panelMat=new T.MeshStandardMaterial({color:0x697f9e,metalness:.62,roughness:.41});
 private innerMat=new T.MeshStandardMaterial({color:0x233849,metalness:.39,roughness:.65});
 private coreMat=new T.MeshBasicMaterial({color:0x7099a7,transparent:true,opacity:.38,depthWrite:false,toneMapped:true});
 private burntMat=new T.MeshStandardMaterial({color:0x443d3c,metalness:.22,roughness:.81});
 private bays:Bay[]=[];
 private structures:T.Group[]=[];
 private rotors:T.Group[]=[];
 private vault:BossVault;
 private fragments:T.InstancedMesh;
 private splinters:Rupture[]=[];
 private effectCount=0;
 private lastStage=-1;
 private lastCue='';
 private lastRupture=0;
 private clock=0;
 private intro=0;
 private bossVisible=false;
 private centerExposed=false;
 private riftOpen=0;
 private worldMode='approach';
 constructor(){
  this.root.name='world-alive-v40-physical-megafortresses';
  this.main.name='living-stage-megastructures';
  this.bayLayer.name='real-enemy-launch-bays';
  this.bossLayer.name='boss-hangar-and-structural-breakup';
  this.fractureLayer.name='world-space-industrial-debris';
  this.root.add(this.main,this.bayLayer,this.bossLayer,this.fractureLayer);
  this.vault={root:new T.Group(),arms:[],cores:[],shields:[],center:new T.Group(),reactor:new T.Mesh(octa,this.coreMat),covers:[]};
  this.bossLayer.add(this.vault.root);
  const shards=new T.InstancedMesh(octa,this.panelMat,48);
  shards.name='falling-station-and-armor-geometry';shards.instanceMatrix.setUsage(T.DynamicDrawUsage);
  shards.count=0;shards.frustumCulled=false;this.fractureLayer.add(shards);
  this.fragments=shards;
 }
 private part(parent:T.Object3D,geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const m=new T.Mesh(geometry,mat);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;
  parent.add(m);return m;
 }
 private wall(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  return this.part(parent,box,mat,x,y,z,w,h,d);
 }
 private tube(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  return this.part(parent,cylinder,mat,x,y,z,w,h,d);
 }
 private circle(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,r:number){
  return this.part(parent,torus,mat,x,y,z,r,r,1);
 }
 private makeBay(side:number,index:number,stage:number):Bay{
  const root=new T.Group(),lid=new T.Group(),engine=new T.Group(),internal=new T.Group();
  root.name='real-gameplay-hangar-'+index+'-stage-'+stage;
  // Real entrance is on the same left/right lane as spawn() in Game.
  root.position.set(side*7.65,14,-5.6);
  this.wall(root,this.innerMat,0,0,-1,4.7,8.1,1.7);
  this.wall(root,this.panelMat,-side*1.8,0,.06,.46,8.0,.73);
  this.wall(root,this.panelMat,side*1.8,0,.06,.46,8.0,.73);
  for(let j=0;j<4;j++){
   const y=-3+j*2.05;
   this.wall(root,this.archMat,0,y,.20,4.1,.37,.40);
  }
  lid.position.set(side*.8,0,.55);root.add(lid);
  this.wall(lid,this.panelMat,0,0,0,2.3,6.6,.6);
  for(let j=0;j<4;j++)this.wall(lid,this.archMat,0,-2.55+j*1.75,.36,2.25,.11,.13);
  engine.position.set(-side*1.0,1.1,.8);root.add(engine);
  this.circle(engine,this.archMat,0,0,.2,1.18);
  this.tube(engine,this.innerMat,0,0,-.3,1.45,1.4,1.45);
  this.tube(engine,this.coreMat,0,0,.28,.55,.38,.55);
  root.add(internal);
  for(let j=0;j<3;j++){
   this.wall(internal,this.coreMat,-side*(.5+j*.45),-2+j*1.75,.23,.16,.67,.18);
  }
  this.bayLayer.add(root);
  return {root,lid,engine,panel:this.wall(root,this.burntMat,0,0,-1.7,4.0,7.3,.26),internal,side,index};
 }
 private makeMegastructure(side:number,stage:number,index:number){
  const g=new T.Group(),rotor=new T.Group();
  g.name='authored-stage-'+stage+'-colossal-side-'+index;
  const x=side*11.4;g.position.set(x,-3,-13.3-index*1.6);
  this.wall(g,this.innerMat,0,0,-1,4.9,33,3.8);
  for(let j=0;j<8;j++){
   this.wall(g,j%3?this.archMat:this.panelMat,0,-14+j*4.0,1.13,5.1,.42,.95);
   this.wall(g,this.panelMat,-side*1.75,-14+j*4.0,1.6,.28,3.6,.26);
  }
  rotor.position.set(-side*.35,5,.9);g.add(rotor);
  const theme=STAGES[stage].environment;
  if(theme==='asteroids'){
   // Mining fortress: huge concentric ore-processing jaws and rotating cranes.
   for(let j=0;j<3;j++){
    const tooth=this.wall(rotor,this.panelMat,Math.cos(j*TAU/3)*2.4,Math.sin(j*TAU/3)*2.4,0,.65,4.0,.55);
    tooth.rotation.z=j*TAU/3;
   }
   this.circle(rotor,this.archMat,0,0,-.3,3.4);
   for(let j=0;j<6;j++)this.part(g,octa,this.burntMat,(hash(j+stage*7)-.5)*3.8,-12+j*4.5,.9,1.5,1.2,1.8);
  }else if(theme==='ocean'){
   // Physical carrier docks, rising cargo elevators and articulated cranes.
   for(let j=0;j<3;j++){
    const boom=this.wall(rotor,this.panelMat,side*(1.3+j*1.1),2.2-j*.9,.5,.52,6.0,.5);
    boom.rotation.z=side*.42;
   }
   for(let j=0;j<5;j++)this.tube(g,this.archMat,-side*1.3,-12+j*5,2,.72,3.0,.72);
   this.circle(rotor,this.innerMat,0,0,1.1,2.2);
  }else if(theme==='fortress'){
   // Massive service gantries and diagonal physically extruded cable frames.
   for(let j=0;j<4;j++){
    this.wall(g,this.archMat,side*(1.4+j*.33),-13+j*6,2.4,.65,8.5,.8);
    const beam=this.wall(g,this.panelMat,0,-12+j*7,.9,4.2,.31,.9);beam.rotation.z=side*.26;
   }
   for(let j=0;j<3;j++){const beam=this.wall(rotor,this.panelMat,0,0,.5,4.1,.26,.42);beam.rotation.z=j*TAU/3;}
   this.circle(rotor,this.archMat,0,0,-.3,2.8);
  }else if(theme==='ice'){
   // Massive crystal spires with layered support arches around canyon.
   for(let j=0;j<11;j++){
    const spike=this.part(g,octa,j%3?this.panelMat:this.burntMat,side*(hash(j*9+4)-.5)*3.4,-14+j*2.8,1.1,1.1,2.7+j%3,1.7);
    spike.rotation.y=j*.13;
   }
   for(let j=0;j<5;j++)this.part(rotor,octa,this.panelMat,Math.cos(j*TAU/5)*2.1,Math.sin(j*TAU/5)*2.1,0,.7,2.7,1.0);
  }else if(theme==='jungle'){
   // Moving temple clockwork under physical vine/stone arches.
   for(let j=0;j<7;j++){
    this.wall(g,j%2?this.archMat:this.burntMat,side*(j%3)*.6,-13+j*4,1.3,3.3,1.4,.92);
    this.part(g,octa,this.burntMat,side*1.5,-13+j*4.2,2.1,1.1,1.2,1.5);
   }
   this.circle(rotor,this.panelMat,0,0,1.2,3.0);
   for(let j=0;j<3;j++)this.part(rotor,octa,this.coreMat,Math.cos(j*TAU/3)*2.5,Math.sin(j*TAU/3)*2.5,1,.6,.9,.9);
  }else{
   // Foundry: furnace walls with reciprocating rams and huge impellers.
   for(let j=0;j<6;j++){
    this.tube(g,this.archMat,side*(j%2?1.4:-1.4),-13+j*5,1.1,.85,3.5,.85);
    this.wall(g,this.burntMat,0,-12+j*5.2,2.05,4.0,1.15,.7);
   }
   this.circle(rotor,this.panelMat,0,0,.2,3.1);
   for(let j=0;j<5;j++){
    const blade=this.wall(rotor,this.archMat,0,1.6,.9,.43,3.2,.44);blade.rotation.z=j*TAU/5;
   }
  }
  this.main.add(g);
  this.rotors.push(rotor);
  return g;
 }
 private buildVault(stage:number){
  const v=this.vault;
  v.root.clear();v.arms=[];v.cores=[];v.shields=[];v.covers=[];
  v.center=new T.Group();v.center.position.set(0,-1.35,-5.0);v.root.add(v.center);
  this.tube(v.center,this.innerMat,0,0,-.6,2.8,4.2,2.8);
  v.reactor=this.part(v.center,octa,this.coreMat,0,0,.9,1.5,1.8,1.2);
  for(const side of[-1,1]){
   const armor=this.wall(v.center,this.panelMat,side*1.0,0,1.7,1.1,3.1,.52);
   v.covers.push(armor);
  }
  for(let i=0;i<4;i++){
   const fin=this.wall(v.center,this.archMat,0,0,.35,.35,5.2,.35);
   fin.rotation.z=i*Math.PI/4;
  }
  v.root.name='reactive-'+WORLD_ALIVE_STAGES[stage].boss+'-dock';
  const sideTint=this.archMat;
  for(const side of[-1,1]){
   const a=new T.Group();
   a.position.set(side*9.8,0,-8.5);
   v.root.add(a);v.arms.push(a);
   this.wall(a,this.innerMat,0,0,-1.5,4.0,18,2.6);
   for(let j=0;j<5;j++)this.wall(a,this.panelMat,-side*.75,-7+j*3.6,.15,4.2,.44,.8);
   const support=this.wall(a,sideTint,-side*2.0,-3.4,1.6,4.0,.75,1.2);
   support.rotation.z=side*.26;
   const brace=this.circle(a,this.panelMat,-side*.55,4.0,.5,1.85);
   brace.rotation.y=side*.4;
   const core=this.part(a,octa,this.coreMat,-side*1.1,-1.2,1.9,.85,1.5,.7);
   v.cores.push(core);
   const shield=new T.Group();shield.position.set(-side*.70,-5.1,1.25);
   a.add(shield);v.shields.push(shield);
   this.wall(shield,this.panelMat,0,0,0,1.15,5.0,.55);
   this.wall(shield,this.burntMat,0,-2.5,.23,1.35,.33,.31);
  }
 }
 private setStage(stage:number){
  if(this.lastStage===stage)return;
  this.lastStage=stage;
  const colors=[
   [0x566079,0x8f9da9,0x262d42,0x8390ba,0x424458],
   [0x546e86,0x9faeb7,0x20384a,0x75aeb9,0x364a57],
   [0x526e8b,0x8aa6ba,0x24354e,0x6f9db9,0x374252],
   [0x789db2,0xa5ccd5,0x314959,0x88b7c3,0x627788],
   [0x526855,0x77987b,0x2c4237,0x7da58a,0x384c3e],
   [0x695047,0x987c60,0x392823,0xb88e64,0x554037]
  ][stage]??[0x526b7f,0x8197a3,0x25374a,0x6b97a6,0x3b4955];
  this.archMat.color.setHex(colors[0]);this.panelMat.color.setHex(colors[1]);
  this.innerMat.color.setHex(colors[2]);this.coreMat.color.setHex(colors[3]);this.burntMat.color.setHex(colors[4]);
  this.main.clear();this.bayLayer.clear();this.rotors=[];this.structures=[];
  this.bays=[this.makeBay(-1,0,stage),this.makeBay(1,1,stage)];
  this.structures=[this.makeMegastructure(-1,stage,0),this.makeMegastructure(1,stage,1)];
  this.buildVault(stage);
  this.splinters.length=0;this.fragments.count=0;this.lastCue='';
 }
 event(e:GameEvent){
  if(e.type==='stage'){this.lastCue='';return;}
  if(!e.type.startsWith('world')&&!['fieldburst','bosstransform'].includes(e.type))return;
  this.lastCue=e.type;
  if(['worldbreach','worldbossfall','worldescape','worldwingbreak','worldcoreexpose','fieldburst'].includes(e.type)){
   // Each rupture sheds real metal away from the projectile plane. The
   // positions and velocities derive from a deterministic counter, not RNG.
   const count=e.type==='worldbossfall'?24:e.type==='worldescape'?12:e.type==='worldcoreexpose'?16:9;
   for(let j=0;j<count;j++){
    if(this.splinters.length>=48)this.splinters.shift();
    const n=++this.lastRupture,ang=TAU*hash(n+3),speed=1.8+hash(n+7)*4.2;
    this.splinters.push({x:e.x??0,y:e.y??8,z:-6.0,
      speedX:Math.cos(ang)*speed,speedY:Math.sin(ang)*speed,
      speedZ:-2-hash(n+9)*3.5,size:.22+hash(n+11)*.55,spin:(hash(n+14)-.5)*8,age:0,life:1.5+hash(n+16)*1.0});
   }
  }
 }
 draw(g:Game,dt:number,mix:FxMix,reduced=false,performance=false){
  this.setStage(g.stage);
  this.clock=g.visualTime;
  this.root.visible=g.state!=='result'&&g.mode==='campaign';
  if(!this.root.visible){this.fragments.count=0;return;}
  const world=g.worldAlive,t=this.clock,duration=STAGES[g.stage].duration;
  const underway=g.state==='playing'||g.state==='transition';
  const approach=ease(clamp((g.time/duration-.025)/.16,0,1));
  this.intro=approach;
  for(let i=0;i<this.structures.length;i++){
   const p=this.structures[i],side=i===0?-1:1;
   p.visible=!reduced&&(!performance||i===0);
   // The bulk of a real megastructure arrives from the distant horizon and
   // glides along the perimeter, never wiping the center attack lane.
   p.position.set(side*(11.5-(1-approach)*1.1),-3.5+(1-approach)*36+Math.sin(t*.17+i)*1.2,-13.4-i*1.4);
   p.rotation.z=side*Math.sin(t*.09+i)*.035;
  }
  for(let i=0;i<this.rotors.length;i++){
   this.rotors[i].rotation.z=t*(i%2?-0.12:.15)*(g.stage===5?2.1:1);
  }
  let opens=0;
  for(const bay of this.bays){
   const disabled=world.destroyed[bay.index],alarm=world.escaped[bay.index];
   const launchAge=world.launches[bay.index]?Math.max(0,g.time-duration*(bay.index===0?WORLD_ALIVE_BUDGET.firstLaunch:WORLD_ALIVE_BUDGET.secondLaunch)):999;
   const preparing=clamp(1-Math.abs(launchAge-1.3)/2.0,0,1);
   const liveOpen=disabled?0:alarm?.45:.12;
   const opening=Math.max(liveOpen,!disabled?preparing:0);
   bay.root.visible=underway&&!reduced;
   bay.root.position.y=12.5+Math.sin(t*.22+bay.index)*.22;
   bay.lid.position.x=bay.side*(.8+opening*2.15);
   bay.lid.rotation.y=bay.side*opening*.66;
   bay.engine.rotation.z=t*(alarm?.64:.25)*(bay.side);
   bay.engine.scale.setScalar(disabled?.82:1+opening*.18);
   bay.internal.visible=!disabled;
   bay.panel.visible=disabled;
   bay.panel.rotation.set(disabled?.45:0,0,bay.side*(disabled?.15:0));
   if(opening>.38)opens++;
  }
  this.riftOpen=opens;
  const aliveBoss=!!g.boss&&!g.boss.dead;
  const v=this.vault;
  this.bossVisible=aliveBoss&&!reduced;
  v.root.visible=this.bossVisible;
  const defeated=world.bossDefeated;
  this.centerExposed=world.wingBroken.every(Boolean);
  const b=g.boss;
  if(b&&this.bossVisible){
   const morph=ease(clamp(b.age/2.5,0,1)),broken=b.parts.filter(hp=>hp<=0).length;
   const phaseExpansion=(b.phase-1)*.22;
   v.center.rotation.z=t*(b.phase>=3?.23:.10);
   v.reactor.rotation.set(t*.22,t*.31,t*.48);
   v.reactor.scale.setScalar(broken===2?1.5:broken===1?1.06:.70);
   for(let k=0;k<2;k++){
    const armor=v.covers[k],side=k===0?-1:1;
    armor.position.x=side*(1.0+(b.parts[k]<=0?1.45:phaseExpansion));
    armor.rotation.y=side*(b.parts[k]<=0?.88:phaseExpansion);
   }
   v.root.position.set(b.x,b.y,-3.6);
   for(let i=0;i<v.arms.length;i++){
    const side=i===0?-1:1,a=v.arms[i],s=v.shields[i];
    a.position.x=side*(9.9-morph*1.2+broken*.34+phaseExpansion*.65);
    a.rotation.z=side*(.06+morph*.08+broken*.04+phaseExpansion*.10);
    s.position.x=-side*(.7+(b.parts[i]<=0?1.8:Math.sin(t*.7+i)*.20));
    s.rotation.y=side*(b.parts[i]<=0?.75:.12);
    v.cores[i].visible=b.parts[i]>0;
    v.cores[i].rotation.set(t*.29+i,t*.15,t*.50);
    v.cores[i].scale.set(.85,1.5,1.0+(Math.sin(t*1.2+i)*.12));
   }
  }
  if(dt>0)for(const piece of this.splinters){
   piece.age+=dt;piece.x+=piece.speedX*dt;piece.y+=piece.speedY*dt;
   piece.z+=piece.speedZ*dt;piece.speedY-=3.8*dt;
  }
  this.splinters=this.splinters.filter(p=>p.age<p.life);
  let count=0;
  const max=performance?14:mix.crowded?20:48;
  for(const p of this.splinters){
   if(count>=max||reduced)break;
   const decay=1-p.age/p.life;
   temp.position.set(p.x,p.y,p.z);temp.rotation.set(p.age*p.spin,p.age*p.spin*.7,p.age*p.spin*.35);
   temp.scale.set(p.size*decay,p.size*decay*.9,p.size*decay*1.7);
   temp.updateMatrix();this.fragments.setMatrixAt(count++,temp.matrix);
  }
  this.fragments.count=count;this.fragments.instanceMatrix.needsUpdate=true;
  // The stage exit tears its real architecture away rather than adding a
  // fullscreen light. Both structures peel outward during the final escape.
  if(defeated||g.state==='transition'){
   const travel=g.state==='transition'?ease(clamp((3.5-g.transitionTime)/3.5,0,1)):.1;
   for(let i=0;i<this.structures.length;i++){
    const side=i===0?-1:1;
    this.structures[i].position.x+=side*travel*4.0;
    this.structures[i].rotation.y=side*travel*.28;
   }
   v.root.visible=false;
  }else{
   for(const p of this.structures)p.rotation.y=0;
  }
  this.worldMode=g.state==='transition'?'escape':aliveBoss?'boss-vault':world.destroyed.some(Boolean)?'breached':
   world.launches.some(Boolean)?'assault':'approach';
 }
 diagnostics(){return {stage:this.lastStage,mode:this.worldMode,
  stageName:WORLD_ALIVE_STAGES[this.lastStage]?.name??'unknown',
  structureCount:this.structures.filter(s=>s.visible).length,
  hangars:this.bays.filter(b=>b.root.visible).length,openHangars:this.riftOpen,
  bossVault:this.bossVisible,reactorFaces:this.vault.cores.filter(c=>c.visible).length,
  centerExposed:this.centerExposed,
  fallingFragments:this.fragments.count,lastCue:this.lastCue,approach:this.intro,
  limits:{megastructures:2,hangars:2,bossArms:2,fragments:48,liveLights:0}};
 }
}
