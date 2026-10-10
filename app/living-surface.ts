import * as T from 'three/webgpu';
import {STAGES} from './stages.ts';
import {livingMaps,terrainMaps} from './visual-assets.ts';
import {surfaceSample,surfaceFlow,surfaceCrests} from './surface-motion.ts';
import {usesRebuiltGraphics} from './visual-style.ts';

const dummy=new T.Object3D(),tint=new T.Color();
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
/**
 * Classic retains its texel-rendered 2D water/lava. World Rebuild instead uses
 * a SOLID, side-walled height-field with CPU-driven vertex colors, 3D surf
 * seams and actual protruding rocks. No ocean / magma image is ever drawn there.
 */
export class LivingSurface {
 root=new T.Group();
 private rebuilt=usesRebuiltGraphics();
 private geometry:T.BufferGeometry=this.rebuilt
  ?new T.BoxGeometry(32,96,.72,36,68,1)
  :new T.PlaneGeometry(32,96,24,48);
 private originalZ:Float32Array|null=null;
 private base:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 private lights:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>[]=[];
 private crests:T.InstancedMesh;
 private volumes:T.InstancedMesh|null=null;
 private streaks:T.InstancedMesh|null=null;
 private maps:T.Texture[]=[];
 private time=0;private distance=0;private count=0;
 constructor(private stage:number){
  this.root.name=this.rebuilt?'physical-procedural-heightfield':'classic-textured-surface';
  const env=STAGES[stage].environment;
  let mat:T.MeshStandardMaterial;
  if(this.rebuilt){
   const position=this.geometry.getAttribute('position');
   this.originalZ=Float32Array.from({length:position.count},(_,i)=>position.getZ(i));
   this.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(position.count*3),3));
   mat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:env==='ocean'?.08:env==='ice'?.12:.05,
    roughness:env==='lava'?.82:env==='ice'?.44:env==='jungle'?.67:.45,side:T.FrontSide});
  }else{
   const map=(env==='lava'?terrainMaps.lava:env==='ice'?terrainMaps.ice:livingMaps.swell).clone();
   map.repeat.set(1,3);map.needsUpdate=true;this.maps.push(map);
   mat=new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:env==='lava'?.035:.10,
    color:env==='jungle'?0x377c66:env==='ice'?0x486f91:env==='lava'?0x9d4518:0x9ac8e5,
    roughness:env==='lava'?.75:.26,metalness:env==='lava'?0:.30,
    emissive:env==='lava'?0xffac6e:0x000000,
    emissiveMap:env==='lava'?map:null,emissiveIntensity:env==='lava'?1.25:0});
  }
  this.base=new T.Mesh(this.geometry,mat);
  this.base.position.z=env==='ice'?-9:-7.6;
  this.base.receiveShadow=true;
  this.base.name=this.rebuilt?'solid-procedural-terrain-volume':'living-water';
  this.root.add(this.base);
  if(!this.rebuilt)for(let i=0;i<2;i++){
   const lightMap=livingMaps.caustics.clone();lightMap.repeat.set(i?1.5:2.3,i?4.5:6.9);
   lightMap.needsUpdate=true;this.maps.push(lightMap);
   const material=new T.MeshBasicMaterial({map:lightMap,
    color:env==='lava'?0xff7e2b:env==='jungle'?0x8dd3bb:0xa0e7ff,
    transparent:true,opacity:env==='lava'?.035:env==='ice'?.05:env==='jungle'?.07:.085,
    blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
   const m=new T.Mesh(this.geometry,material);
   m.position.z=this.base.position.z+.035+i*.012;
   m.name='refracted-light-'+i;this.lights.push(m);this.root.add(m);
  }
  this.crests=new T.InstancedMesh(new T.TorusGeometry(.70,.060,6,24),
   new T.MeshBasicMaterial({color:0x8cbdbe,transparent:true,opacity:.27,depthWrite:false,toneMapped:true}),18);
  this.crests.setColorAt(0,new T.Color());this.crests.frustumCulled=false;
  this.crests.instanceMatrix.setUsage(T.DynamicDrawUsage);
  this.crests.instanceColor!.setUsage(T.DynamicDrawUsage);
  this.crests.name='wave-crests';this.root.add(this.crests);
  if(this.rebuilt){
   this.volumes=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
    new T.MeshStandardMaterial({color:env==='lava'?0x2c2526:env==='ice'?0x5c95a7:env==='jungle'?0x305c4b:0x3d6474,
     metalness:env==='lava'?.08:.15,roughness:.76}),36);
   this.volumes.name='edge-rocks-physical-3d';this.volumes.frustumCulled=false;
   this.volumes.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(this.volumes);
   this.streaks=new T.InstancedMesh(new T.CylinderGeometry(.12,.18,1,6),
    new T.MeshStandardMaterial({color:env==='lava'?0xa95426:env==='ice'?0x8ebac4:env==='jungle'?0x467970:0x4a8d9c,
     metalness:.12,roughness:.62}),64);
   this.streaks.name='flow-ridges-physical-3d';this.streaks.frustumCulled=false;
   this.streaks.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(this.streaks);
  }
 }
 draw(t:number,distance:number,performance=false,reduced=false){
  this.time=t;this.distance=distance;
  const flow=surfaceFlow(this.stage,t,distance),env=STAGES[this.stage].environment;
  if(!this.rebuilt){
   this.base.material.map!.offset.set(flow.u,flow.v);
   this.base.material.emissiveIntensity=env==='lava'?1.16+Math.sin(t*.8)*.18:0;
   this.lights.forEach((m,i)=>{m.material.map!.offset.set(i?flow.lightU:flow.u*2,i?flow.lightV:flow.v*.72);m.visible=!performance||i===0;});
  }
  const pos=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv'),normal=this.geometry.getAttribute('normal');
  const colors=this.rebuilt?this.geometry.getAttribute('color'):null;
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),y=pos.getY(i),s=surfaceSample(this.stage,x,y+distance*.72,t);
   if(!this.rebuilt){
    const n=Math.hypot(s.dx,s.dy,1);
    pos.setZ(i,s.height*(reduced?.4:1));
    normal.setXYZ(i,-s.dx/n,-s.dy/n,1/n);
    uv.setXY(i,x/32+.5+s.u,y/96+.5+s.v);
    continue;
   }
   const original=this.originalZ![i],top=original>0;
   // Actual varying geometry, not a static 2D image with a bump texture.
   const swell=(s.height*(env==='ocean'?3.3:2.25)+Math.sin(x*.91+y*.30-t*1.4)*(env==='ocean'?.25:.17)
     +(env==='lava'?Math.abs(Math.sin(x*1.33+(y+distance*.72)*.47-t*.60))*.24:0))*(reduced?.42:1);
   pos.setZ(i,original+(top?swell:0));
   // Vertex-defined materials: light scatters across 3D waves, glowing cracks
   // and banks. Deliberately avoid white-hot colors which obscure enemy bullets.
   const a=Math.sin(x*.53+(y+distance*.72)*.31-t*1.33);
   const b=Math.sin(x*1.81-(y+distance*.72)*.72+t*2.1);
   const n=clamp(.50+a*.25+b*.15+s.height*.5,0,1);
   let r:number,g:number,bl:number;
   if(env==='lava'){
    // Intersecting molten fissures expose hot glowing seams between
    // dark, physically raised basalt crust; never a giant flat orange texture.
    const seam=Math.max(0,Math.sin(x*1.16+(y+distance*.72)*.59-t*.66)
      +.46*Math.sin(x*.45-(y+distance*.72)*.29+t*.40)-.22);
    const hot=clamp(seam*seam*.55,0,1);
    r=.026+hot*.46;g=.012+hot*.115;bl=.010+hot*.024;
   }else if(env==='ocean'){
    r=.009+n*.035;g=.052+n*.10;bl=.083+n*.15;
   }else if(env==='ice'){
    r=.024+n*.068;g=.085+n*.16;bl=.14+n*.19;
   }else{
    r=.019+n*.040;g=.065+n*.09;bl=.057+n*.080;
   }
   // The underside and sidewalls are dark solid matter, not a floating card.
   if(!top){r*=.55;g*=.55;bl*=.58;}
   colors!.setXYZ(i,r,g,bl);
  }
  pos.needsUpdate=true;
  if(this.rebuilt){
   colors!.needsUpdate=true;this.geometry.computeVertexNormals();
  }else{uv.needsUpdate=true;normal.needsUpdate=true;}
  const patches=surfaceCrests(this.stage,t,distance,reduced),limit=performance?10:18;
  this.count=Math.min(limit,patches.length);
  for(let i=0;i<this.count;i++){
   const p=patches[i];dummy.position.set(p.x,p.y,this.base.position.z+(this.rebuilt?.42:.07)+p.z*(this.rebuilt?2.25:1));
   dummy.rotation.set(0,0,p.angle);
   dummy.scale.set(p.width,p.height,1);dummy.updateMatrix();this.crests.setMatrixAt(i,dummy.matrix);
   tint.setScalar(p.alpha);this.crests.setColorAt(i,tint);
  }
  this.crests.count=this.count;this.crests.instanceMatrix.needsUpdate=true;this.crests.instanceColor!.needsUpdate=true;
  if(this.rebuilt){
   // Geometric islands/wavelets travel in absolute world coordinates as the
   // camera scrolls. Keep the center lane clear and instance counts bounded.
   let n=0;const rockCount=performance?14:36;
   for(let i=0;i<rockCount;i++){
    const y=((i*9.7-distance*.72)%104+104)%104-52;
    const x=(env==='lava'&&i%6===0)?Math.sin(i*3.37)*4.2:(i%2?1:-1)*(7.0+((i*7)%17)*.43);
    const z=surfaceSample(this.stage,x,y+distance*.72,t).height*2.25;
    const size=.32+(i%5)*.10;
    dummy.position.set(x,y,this.base.position.z+.38+z+size*.28);
    dummy.rotation.set(i*.62,t*.05+i*.2,i*.41);
    dummy.scale.set(size,env==='lava'?size*1.1:size*.62,size*(env==='ice'?1.7:.60));
    dummy.updateMatrix();this.volumes!.setMatrixAt(n++,dummy.matrix);
   }
   this.volumes!.count=n;this.volumes!.instanceMatrix.needsUpdate=true;
   const seamCount=performance?24:64;let q=0;
   for(let i=0;i<seamCount;i++){
    const y=((i*4.35-distance*.72*.95)%96+96)%96-48;
    const x=((env==='ocean'||env==='lava')&&i%7===0)?Math.sin(i*2.3)*4.1:(i%2?1:-1)*(5.7+((i*13)%19)*.41);
    const z=surfaceSample(this.stage,x,y+distance*.72,t).height*2.25;
    dummy.position.set(x,y,this.base.position.z+.48+z);
    dummy.rotation.set(.05,Math.sin(t*.21+i)*.32,.2*Math.sin(i*4.7+t*.16));
    const w=.23+(i%5)*.11;
    dummy.scale.set(w,env==='lava'?.7:1.35,w*.48);
    dummy.updateMatrix();this.streaks!.setMatrixAt(q++,dummy.matrix);
   }
   this.streaks!.count=q;this.streaks!.instanceMatrix.needsUpdate=true;
  }
 }
 diagnostics(){const v=this.geometry.getAttribute('position');return {
  clock:this.time,kind:STAGES[this.stage].environment,physical3D:this.rebuilt,
  textureBackplate:!this.rebuilt,vertices:v.count,
  rocks:this.volumes?.count??0,flowRidges:this.streaks?.count??0,
  crests:this.count,lightLayers:this.lights.filter(m=>m.visible).length,
  height:v.getZ(420),distance:this.distance
 };}
 dispose(){
  this.geometry.dispose();this.base.material.dispose();
  this.lights.forEach(m=>m.material.dispose());
  this.crests.geometry.dispose();(this.crests.material as T.Material).dispose();
  if(this.volumes){this.volumes.geometry.dispose();(this.volumes.material as T.Material).dispose();}
  if(this.streaks){this.streaks.geometry.dispose();(this.streaks.material as T.Material).dispose();}
  this.maps.forEach(m=>m.dispose());this.root.clear();
 }
}
