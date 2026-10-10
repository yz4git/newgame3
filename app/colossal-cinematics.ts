import * as T from 'three/webgpu';
import type {Game,GameEvent} from './sim.ts';
import {COLOSSAL_BUDGET as B,COLOSSAL_FEATURES} from './colossal-spec.ts';

const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const mod=(x:number,n:number)=>((x%n)+n)%n;
const smooth=(x:number)=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
const rnd=(x:number)=>{const n=Math.sin(x*127.1+17.31)*43758.545;return n-Math.floor(n);};
const boxGeo=new T.BoxGeometry(1,1,1);
const cylinderGeo=new T.CylinderGeometry(.5,.5,1,12);
const coneGeo=new T.ConeGeometry(.5,1,7);
const rockGeo=new T.IcosahedronGeometry(1,1);
const torusGeo=new T.TorusGeometry(1,.085,7,48);
const temp=new T.Object3D();
interface Collapse {
 root:T.Group;
 chunks:T.Mesh[];
 core:T.Mesh;
 rings:T.Mesh[];
 x:number;y:number;age:number;life:number;size:number;
}
/**
 * Massive 3D moving setpieces and combat-linked cinematic architecture.
 * These are real, lit geometry with world-space parallax, not screen-facing sprites.
 * Never alters hitboxes, simulation time, score or game RNG.
 */
export class ColossalCinematics {
 readonly root=new T.Group();
 private geography=new T.Group();
 private flight=new T.Group();
 private bossStage=new T.Group();
 private warpStage=new T.Group();
 private breakStage=new T.Group();
 private shell=new T.MeshStandardMaterial({color:0x3b566c,roughness:.55,metalness:.52});
 private plate=new T.MeshStandardMaterial({color:0x557389,roughness:.42,metalness:.68});
 private dark=new T.MeshStandardMaterial({color:0x182d40,roughness:.69,metalness:.35});
 private rim=new T.MeshStandardMaterial({color:0x7da3b2,roughness:.31,metalness:.74});
 private pulse=new T.MeshBasicMaterial({color:0x6ca1b5,transparent:true,opacity:.30,depthWrite:false,toneMapped:true,side:T.DoubleSide});
 private wreck=new T.MeshStandardMaterial({color:0x6e766e,roughness:.86,metalness:.13});
 private stage=-1;
 private t=0;
 private monoliths:T.Group[]=[];
 private monolithRotors:T.Object3D[][]=[];
 private carriers:T.Group[]=[];
 private carrierTurbines:T.Object3D[][]=[];
 private irisRoot=new T.Group();
 private irisFins:T.Mesh[]=[];
 private irisSegments:T.Mesh[]=[];
 private gateRings:T.Mesh[]=[];
 private gateBraces:T.Mesh[]=[];
 private impact:T.InstancedMesh;
 private impacts:{x:number;y:number;z:number;age:number;life:number;vx:number;vy:number;vz:number;size:number;spin:number}[]=[];
 private collapses:Collapse[]=[];
 private bossArrivalAge=999;
 private transitionEvent=false;
 private diagnosticsCount=0;
 constructor(){
  this.root.name='colossal-world-cinematics-v33';
  this.geography.name='giant-world-setpieces';
  this.flight.name='capital-ship-three-dimensional-flyovers';
  this.bossStage.name='boss-iris-architecture';
  this.warpStage.name='perspective-warp-tunnel';
  this.breakStage.name='facility-mechanical-collapse';
  this.root.add(this.geography,this.flight,this.bossStage,this.warpStage,this.breakStage);
  for(let i=0;i<B.capitalShips;i++){
   const carrier=this.makeCarrier(i);
   this.carriers.push(carrier.group);this.carrierTurbines.push(carrier.engines);
   this.flight.add(carrier.group);
  }
  // The boss's rotating vault is below the combat plane, never over hostile bullets.
  for(let i=0;i<B.bossFins;i++){
   const fin=this.mesh(this.plate,boxGeo,this.irisRoot,.0,.0,0,.65,2.6,.28);
   fin.userData.index=i;this.irisFins.push(fin);
  }
  for(let i=0;i<3;i++){
   const ring=this.mesh(i===1?this.rim:this.dark,torusGeo,this.irisRoot,0,0,-.5-i*.65,4.2+i*1.25,4.2+i*1.25,1);
   this.irisSegments.push(ring);
  }
  this.bossStage.add(this.irisRoot);this.irisRoot.visible=false;
  // A true 3D entry tunnel, with crossing ribs behind the player, never flash quads.
  for(let i=0;i<B.warpRings;i++){
   const ring=this.mesh(i%3===0?this.rim:this.shell,torusGeo,this.warpStage,0,0,-10,9,9,1);
   ring.rotation.x=.34;this.gateRings.push(ring);
   const brace=this.mesh(this.plate,boxGeo,this.warpStage,0,0,-10,.15,19,.24);
   this.gateBraces.push(brace);
  }
  // Shared instanced iron slabs twist into depth when a facility fails.
  this.impact=new T.InstancedMesh(boxGeo,new T.MeshStandardMaterial({color:0x919da5,metalness:.48,roughness:.52}),B.fragments);
  this.impact.name='flying-deep-structural-armor';this.impact.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.impact.frustumCulled=false;this.impact.count=0;this.breakStage.add(this.impact);
  for(let i=0;i<B.collapses;i++){
   const root=new T.Group(),chunks:T.Mesh[]=[],rings:T.Mesh[]=[];
   root.name='collapsing-three-dimensional-structure-'+i;
   for(let j=0;j<9;j++){
    const a=j*Math.PI*2/9;
    const b=this.mesh(j%3?this.shell:this.rim,boxGeo,root,Math.cos(a)*1.5,Math.sin(a)*1.3,-.8,.75,.9,1.2);
    chunks.push(b);
   }
   for(let j=0;j<2;j++){
    const ring=this.mesh(j?this.rim:this.plate,torusGeo,root,0,0,-.2-j*.9,1,1,1);ring.visible=false;rings.push(ring);
   }
   const core=this.mesh(this.dark,cylinderGeo,root,0,0,-1.8,1.0,2.6,1.0);
   root.visible=false;this.breakStage.add(root);
   this.collapses.push({root,chunks,core,rings,x:0,y:0,age:999,life:2.6,size:1});
  }
 }
 private mesh(mat:T.Material,geo:T.BufferGeometry,parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number){
  const m=new T.Mesh(geo,mat);
  m.position.set(x,y,z);m.scale.set(w,h,d);
  m.castShadow=false;m.receiveShadow=true;
  parent.add(m);return m;
 }
 private makeCarrier(i:number){
  const g=new T.Group(),engines:T.Object3D[]=[];
  // A kilometre-scale silhouette with visible belly, hangars, command bridge and engine nacelles.
  this.mesh(this.dark,boxGeo,g,0,0,0,5.4,15.5,1.3);
  this.mesh(this.shell,boxGeo,g,0,-1.0,.85,4.5,11.6,.6);
  this.mesh(this.plate,boxGeo,g,0,5.4,.8,3.1,4.3,.9);
  this.mesh(this.rim,boxGeo,g,0,7.0,1.25,1.3,2.4,.45);
  this.mesh(this.dark,boxGeo,g,0,-5.7,-.6,3.6,5.3,1.7);
  this.mesh(this.rim,boxGeo,g,0,0,1.24,.14,9.8,.12);
  for(const side of[-1,1]){
   const wing=this.mesh(this.shell,boxGeo,g,side*4.2,-1.7,-.3,4.8,4.6,.68);wing.rotation.y=side*.15;
   this.mesh(this.plate,boxGeo,g,side*5.2,-1.4,.1,2.2,1.15,.4);
   this.mesh(this.dark,boxGeo,g,side*2.1,-5.4,-1,1.6,4.5,1.9);
   this.mesh(this.rim,cylinderGeo,g,side*2.1,-7.5,-1.2,.85,1.0,.85);
   for(let j=0;j<3;j++)this.mesh(this.rim,boxGeo,g,side*(1.75+j*1.05),2.5,.93,.12,3.0,.15);
   const engine=this.mesh(this.pulse,coneGeo,g,side*2.1,-8.4,-1.1,.95,2.2,.95);
   engine.rotation.z=Math.PI;engines.push(engine);
  }
  if(i===1){
   this.mesh(this.shell,boxGeo,g,0,2.8,1.0,2.2,4.6,1.9);
   this.mesh(this.rim,boxGeo,g,0,3.5,2.15,1.5,1.4,.15);
  }
  return {group:g,engines};
 }
 private makeMonolith(stage:number,index:number){
  const g=new T.Group(),rotors:T.Object3D[]=[];
  const side=index?1:-1;
  const beam=(x:number,y:number,z:number,w:number,h:number,d:number,mat=this.shell)=>this.mesh(mat,boxGeo,g,x,y,z,w,h,d);
  if(stage===0){
   // Broken rotating asteroid fortress with enormous skeletal docking hoops.
   beam(0,-1,-2,3.2,16,3.2,this.dark);
   for(let j=0;j<6;j++){
    const a=j*Math.PI/3;
    const m=this.mesh(this.wreck,rockGeo,g,Math.sin(a)*2.9,Math.cos(a)*5.5,-1.4,2.0+rnd(j+index)*1.6,2.4,2.3);
    m.rotation.set(a*.3,a*.6,a*.5);
   }
   for(let j=0;j<3;j++){
    const hoop=this.mesh(j%2?this.rim:this.plate,torusGeo,g,0,-4+j*4,-.8,5.7,5.1,1);
    hoop.rotation.y=.25;hoop.rotation.x=.17;rotors.push(hoop);
   }
   for(const x of[-3.4,3.4])beam(x,0,-.5,.65,16,1.1,this.plate);
  }else if(stage===1){
   // A colossal sea base flies by beneath the battlefield, with multiple docks.
   beam(0,0,-2,8.4,20,2.3,this.dark);
   beam(0,1,-.65,6.4,17,.35,this.plate);
   for(let j=0;j<7;j++){
    const y=-8+j*2.6;
    beam(-3.6,y,-.30,.4,.17,.2,this.rim);
    beam(3.6,y,-.30,.4,.17,.2,this.rim);
   }
   for(const x of[-4,4]){
    beam(x,-5,.1,1.7,6,2.2,this.shell);
    beam(x,2,.5,1.3,3,2.5,this.dark);
    for(let j=0;j<3;j++)beam(x,1+j*2,2.05,.8,.18,.14,this.rim);
   }
   const mast=beam(0,5,1,1.3,4,3,this.shell);mast.rotation.y=.07;
   this.mesh(this.rim,torusGeo,g,0,7,3.1,2.3,2.3,.8);
  }else if(stage===2){
   // Star-fortress transit corridors with actual thickness and a moving vault.
   for(const x of[-4.0,4.0])beam(x,0,-1,2.0,22,4.3,this.dark);
   for(let j=0;j<8;j++){
    const y=-9+j*2.6;beam(0,y,0,11,.55,1.8,j%2?this.shell:this.plate);
   }
   for(let j=0;j<3;j++){
    const ring=this.mesh(j%2?this.rim:this.shell,torusGeo,g,0,-5+j*5,1.6,4.2,4.2,1);
    ring.rotation.x=.65;rotors.push(ring);
   }
   for(const x of[-5,5])beam(x,0,1,.5,20,.5,this.rim);
  }else if(stage===3){
   // Glacier-scale 3D spires and bridges with icy layered silhouettes.
   beam(0,0,-3,7.5,20,3,this.wreck);
   for(let j=0;j<11;j++){
    const x=(rnd(j+index*20)-.5)*6.7,y=-8+j*1.55;
    const spire=this.mesh(j%3===0?this.rim:this.shell,coneGeo,g,x,y,-.6,1.3+rnd(j)*1.4,4.2+rnd(j+4)*4.0,2);
    spire.rotation.z=(rnd(j+8)-.5)*.4;
   }
   for(let j=0;j<5;j++)beam(0,-7+j*3.5,.35,8,.3,.35,this.rim);
   this.mesh(this.rim,torusGeo,g,0,-2,2.1,4.6,4.6,.7);
  }else if(stage===4){
   // Massive ruined temple rising from the foliage with kinetic astronomical orrery.
   for(let j=0;j<5;j++){
    const h=18-j*2.8;beam(0,0,-3+j*.5,8-j*1.0,h,1.0,j%2?this.wreck:this.shell);
   }
   for(const x of[-3.5,3.5]){
    beam(x,-.5,1.5,1.2,14,3,this.wreck);
    for(let j=0;j<4;j++)beam(x,-5+j*3,3.15,1.4,.35,.28,this.rim);
   }
   for(let j=0;j<2;j++){
    const ring=this.mesh(this.rim,torusGeo,g,0,3,3.5+j*.5,2.8+j*1.2,2.8+j*1.2,1);
    rotors.push(ring);
   }
   this.mesh(this.dark,cylinderGeo,g,0,3,3.8,1.4,2.4,1.4);
  }else{
   // Furnace's suspended blast machinery with pistons and pressure drums.
   for(const x of[-3.7,3.7]){
    beam(x,0,-1.8,1.9,20,3.2,this.dark);
    for(let j=0;j<6;j++){
     const y=-8+j*3.1;
     beam(x,y,.05,2.2,.6,.9,this.shell);
     this.mesh(this.rim,cylinderGeo,g,x,y,1.1,1.4,2.0,1.4);
    }
   }
   for(let j=0;j<5;j++)beam(0,-8+j*4,0,9,.85,1.2,j%2?this.shell:this.plate);
   for(let j=0;j<3;j++){
    const ring=this.mesh(this.rim,torusGeo,g,0,-6+j*6,1.8,3.1,3.1,1);
    ring.rotation.y=.45;rotors.push(ring);
   }
  }
  g.userData.side=side;
  return {group:g,rotors};
 }
 private setStage(stage:number){
  if(this.stage===stage)return;
  this.stage=stage;
  for(const g of this.monoliths)this.geography.remove(g);
  this.monoliths=[];this.monolithRotors=[];
  for(let i=0;i<B.monoliths;i++){
   const item=this.makeMonolith(stage,i);
   this.monoliths.push(item.group);this.monolithRotors.push(item.rotors);
   this.geography.add(item.group);
  }
  const tint=[0x6b738a,0x54758a,0x496480,0x849aa6,0x627d70,0x8b6354][stage];
  this.shell.color.setHex(tint);
  this.plate.color.setHex([0x8490ab,0x688e9f,0x7996b3,0x92b8c7,0x71987e,0xa67a5a][stage]);
  this.dark.color.setHex([0x202c43,0x233e50,0x1a293f,0x30495b,0x253f3b,0x402b2b][stage]);
  this.rim.color.setHex([0x8398ae,0x85aeb6,0x89adc2,0xb3d1d9,0x9ab69d,0xb59d79][stage]);
  this.pulse.color.setHex([0x819cbe,0x81b6ba,0x7eb1ce,0xb1d2d8,0xa3c5ab,0xc19b7f][stage]);
 }
 event(e:GameEvent){
  if(e.type==='stage'){
   this.impact.count=0;this.impacts=[];
   for(const c of this.collapses){c.age=999;c.root.visible=false;}
   this.bossArrivalAge=999;this.transitionEvent=false;
   return;
  }
  if(e.type==='warning'||e.type==='bossform'||e.type==='bosstransform'){
   this.bossArrivalAge=0;
  }
  if(e.type==='fieldcollapse'||e.type==='fieldclear'){
   const c=this.collapses.reduce((a,b)=>a.age>=a.life?a:b);
   c.age=0;c.life=2.6;c.x=e.x??0;c.y=e.y??0;c.size=clamp((e.size??3)*.43,1,2.4);
   c.root.visible=true;
   for(let i=0;i<18;i++){
    if(this.impacts.length>=B.fragments)this.impacts.shift();
    const k=++this.diagnosticsCount,a=rnd(k+4)*Math.PI*2,v=3.0+rnd(k+12)*4.0;
    this.impacts.push({x:c.x,y:c.y,z:.3,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:1.2+rnd(k+22)*4,
     size:.23+rnd(k+32)*.65,spin:(rnd(k+43)-.5)*11,age:0,life:.8+rnd(k+54)*1.2});
   }
  }
  if(e.type==='bosskill'||e.type==='nova'){
   this.bossArrivalAge=0;
  }
 }
 draw(g:Game,dt:number,reduced=false,performance=false){
  const active=g.state==='playing'||g.state==='transition';
  this.root.visible=active||g.state==='title';
  if(!this.root.visible)return;
  this.t=g.visualTime;
  this.setStage(g.stage);
  const t=this.t,speed=1+(g.stage===1?.2:0),moving=g.state==='transition';
  for(let i=0;i<this.monoliths.length;i++){
   const piece=this.monoliths[i],side=i?1:-1;
   piece.visible=!reduced&&(!performance||i===0);
   piece.position.set(side*(13.1+(i%2)*1.0),mod(25+i*51-t*3.9*speed,118)-59,-8.6-i*2);
   piece.rotation.set(.10*side,Math.sin(t*.1+i)*.1,side*(.025+Math.sin(t*.26+i)*.045));
   piece.scale.setScalar(i?1.05:1.17);
   for(let j=0;j<this.monolithRotors[i].length;j++){
    const rotor=this.monolithRotors[i][j];
    rotor.rotation.z=t*(j%2?-.16:.19)+j*.34;
   }
  }
  // 3.4 invasion director owns the opening encounter; fleet patrol resumes later.
  this.flight.visible=!reduced&&(!g.boss||g.boss.dead)&&g.time>11&&g.state==='playing';
  // Capital ships execute a foreground side pass and a deep center-lane departure.
  for(let i=0;i<this.carriers.length;i++){
   const craft=this.carriers[i];
   craft.visible=!reduced&&(!performance||i===0);
   const phase=mod(t*3.8+i*31.5,111);
   const passage=phase/111;
   const side=i===0?-1:i===1?1:0;
   const lateral=side*(11.6+Math.sin(phase*.11)*1.5)+(i===2?Math.sin(t*.25)*2:0);
   craft.position.set(lateral,47-phase,-7.8-i*2.1);
   craft.rotation.set(Math.sin(t*.12+i)*.08,side*.18,side*(.13+.06*Math.sin(t*.4+i)));
   const scale=(i===2?.8:i===1?1.13:1.30)*(1+Math.sin(passage*Math.PI)*.12);
   craft.scale.setScalar(scale);
   for(let j=0;j<this.carrierTurbines[i].length;j++){
    const flame=this.carrierTurbines[i][j] as T.Mesh;
    flame.scale.y=1.8+Math.sin(t*14+i+j)*.25;
   }
  }
  const boss=g.boss&&!g.boss.dead?g.boss:null;
  this.irisRoot.visible=false; // 3.4 boss megastructure replaces the duplicate 3.3 rings
  if(boss&&this.irisRoot.visible){
   const age=clamp(boss.age/2.5,0,1);
   const size=5.7+smooth(age)*1.8;
   this.irisRoot.position.set(boss.x,boss.y,-3.35);
   this.irisRoot.scale.setScalar(.65+smooth(age)*.60);
   const firing=boss.warning>0||boss.beam>0;
   for(let i=0;i<this.irisFins.length;i++){
    const fin=this.irisFins[i],a=i*Math.PI*2/B.bossFins+t*(firing?.12:.035);
    const r=size*(.55+Math.sin(t*.32+i)*.025);
    fin.position.set(Math.cos(a)*r,Math.sin(a)*r,-.5+Math.sin(t+i)*.32);
    fin.rotation.set(.28*Math.sin(a),.3*Math.cos(a),a-Math.PI/2);
    fin.scale.set(.64,firing?3.6:2.4,.28);
   }
   for(let i=0;i<this.irisSegments.length;i++){
    const ring=this.irisSegments[i];
    ring.rotation.set(.28*Math.sin(t*.2+i),.28*Math.cos(t*.3+i),t*(i%2?.13:-.16));
    ring.scale.setScalar(size*(1+i*.33));
   }
  }
  this.warpStage.visible=false; // prevent 7 legacy hoops overlapping 12 new warp rings
  if(this.warpStage.visible){
   for(let i=0;i<this.gateRings.length;i++){
    const ring=this.gateRings[i],brace=this.gateBraces[i];
    const u=mod(t*2.8+i*.57,4.7)/4.7;
    const z=-28+u*23;
    const radius=5+u*7.7;
    ring.position.set(0,0,z);ring.scale.set(radius,radius*.9,1);
    ring.rotation.set(.13+Math.sin(t*.3+i)*.15,.18*Math.sin(t*.4+i),t*(i%2?.16:-.13)+i);
    brace.position.set(0,0,z-.05);
    brace.rotation.set(.1,.0,ring.rotation.z);
    brace.scale.set(.18,radius*1.9,.24);
   }
  }
  for(const c of this.collapses){
   if(dt>0&&c.age<c.life)c.age+=dt;
   c.root.visible=active&&c.age<c.life&&!reduced;
   if(!c.root.visible)continue;
   const u=clamp(c.age/c.life,0,1),p=smooth(u);
   c.root.position.set(c.x,c.y,-.8);
   c.root.scale.setScalar(c.size);
   c.core.rotation.z=-u*.72;
   c.core.scale.set(1-u*.55,2.6*(1-u*.72),1-u*.5);
   c.core.position.y=-u*2.4;
   for(let j=0;j<c.chunks.length;j++){
    const a=j*Math.PI*2/c.chunks.length,b=c.chunks[j];
    const spread=p*(2.4+(j%3)*.55);
    b.position.set(Math.cos(a)*(1.4+spread),Math.sin(a)*(1.1+spread)-u*1.2,-.8-u*(j%2?.8:1.7));
    b.rotation.set(u*(j%2?2.2:-1.3),u*(j%3?1.1:-1.2),a+u*(j%2?1.5:-1.8));
    b.scale.set(.75*(1-u*.35),.95*(1-u*.43),1.3*(1-u*.6));
   }
   // Legacy opaque meter-wide toroids grew to screen-filling foreground circles.
   // The 3.4 3D rupture frames plus 3.5 depth-tested facility waves already
   // supply the blast; keep the tumbling reactor pieces but suppress these duplicates.
   for(const ring of c.rings)ring.visible=false;
  }
  if(dt>0){
   for(const p of this.impacts){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=4.6*dt;}
  }
  this.impacts=this.impacts.filter(p=>p.age<p.life);
  let n=0;
  for(const p of this.impacts){
   if(n>=B.fragments||reduced)break;
   const life=clamp(1-p.age/p.life,0,1);
   temp.position.set(p.x,p.y,p.z);
   temp.rotation.set(p.age*p.spin,p.age*p.spin*.72,p.age*p.spin*.5);
   temp.scale.set(p.size*life*.8,p.size*life*1.65,p.size*life*.8);
   temp.updateMatrix();this.impact.setMatrixAt(n++,temp.matrix);
  }
  this.impact.count=n;this.impact.instanceMatrix.needsUpdate=true;
 }
 diagnostics(){
  return {features:COLOSSAL_FEATURES.length,stage:this.stage,monoliths:this.monoliths.filter(m=>m.visible).length,
   carriers:this.carriers.filter(m=>m.visible).length,bossIris:this.irisRoot.visible,
   warpRings:this.warpStage.visible?this.gateRings.length:0,collapseStructures:this.collapses.filter(c=>c.root.visible).length,
   deepFragments:this.impact.count,limits:B};
 }
}
