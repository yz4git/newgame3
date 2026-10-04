import * as T from 'three/webgpu';
import {STAGES} from './stages.ts';
import {livingMaps,terrainMaps} from './visual-assets.ts';
import {surfaceSample,surfaceFlow,surfaceCrests} from './surface-motion.ts';

const dummy=new T.Object3D(),tint=new T.Color();
/** One lit wave mesh, two refracted-light layers and one bounded foam batch. */
export class LivingSurface {
  root=new T.Group();private geometry=new T.PlaneGeometry(32,96,24,48);
  private base:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>;private lights:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];
  private crests:T.InstancedMesh;private maps:T.Texture[]=[];private time=0;private distance=0;private count=0;
  constructor(private stage:number){
    const env=STAGES[stage].environment,map=(env==='lava'?terrainMaps.lava:env==='ice'?terrainMaps.ice:livingMaps.swell).clone();map.repeat.set(1,3);map.needsUpdate=true;this.maps.push(map);
    const mat=new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:env==='lava'?.035:.10,color:env==='jungle'?0x377c66:env==='ice'?0x486f91:env==='lava'?0x9d4518:0x9ac8e5,roughness:env==='lava'?.75:.26,metalness:env==='lava'?0:.30,emissive:env==='lava'?0xffac6e:0x000000,emissiveMap:env==='lava'?map:null,emissiveIntensity:env==='lava'?1.25:0});
    this.base=new T.Mesh(this.geometry,mat);this.base.position.z=env==='ice'?-9:-7.6;this.base.receiveShadow=true;this.base.name='living-water';this.root.add(this.base);
    for(let i=0;i<2;i++){
      const lightMap=livingMaps.caustics.clone();lightMap.repeat.set(i?1.5:2.3,i?4.5:6.9);lightMap.needsUpdate=true;this.maps.push(lightMap);
      const material=new T.MeshBasicMaterial({map:lightMap,color:env==='lava'?0xff7e2b:env==='jungle'?0x8dd3bb:0xa0e7ff,transparent:true,opacity:env==='lava'?.035:env==='ice'?.05:env==='jungle'?.07:.085,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
      const m=new T.Mesh(this.geometry,material);m.position.z=this.base.position.z+.035+i*.012;m.name='refracted-light-'+i;this.lights.push(m);this.root.add(m);
    }
    this.crests=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:livingMaps.foam,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false,color:0xbce9ed,toneMapped:false}),18);this.crests.setColorAt(0,new T.Color());this.crests.frustumCulled=false;this.crests.instanceMatrix.setUsage(T.DynamicDrawUsage);this.crests.instanceColor!.setUsage(T.DynamicDrawUsage);this.crests.name='wave-crests';this.root.add(this.crests);
  }
  draw(t:number,distance:number,performance=false,reduced=false){
    this.time=t;this.distance=distance;const flow=surfaceFlow(this.stage,t,distance),env=STAGES[this.stage].environment;
    this.base.material.map!.offset.set(flow.u,flow.v);
    this.base.material.emissiveIntensity=env==='lava'?1.16+Math.sin(t*.8)*.18:0;
    this.lights.forEach((m,i)=>{m.material.map!.offset.set(i?flow.lightU:flow.u*2,i?flow.lightV:flow.v*.72);m.visible=!performance||i===0;});
    const pos=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute('uv'),normal=this.geometry.getAttribute('normal');
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),s=surfaceSample(this.stage,x,y+distance*.72,t),n=Math.hypot(s.dx,s.dy,1);
      pos.setZ(i,s.height*(reduced?.4:1));normal.setXYZ(i,-s.dx/n,-s.dy/n,1/n);uv.setXY(i,x/32+.5+s.u,y/96+.5+s.v);
    }pos.needsUpdate=true;uv.needsUpdate=true;normal.needsUpdate=true;
    const patches=surfaceCrests(this.stage,t,distance,reduced),limit=performance?10:18;this.count=Math.min(limit,patches.length);
    for(let i=0;i<this.count;i++){const p=patches[i];dummy.position.set(p.x,p.y,this.base.position.z+.07+p.z);dummy.rotation.set(0,0,p.angle);dummy.scale.set(p.width,p.height,1);dummy.updateMatrix();this.crests.setMatrixAt(i,dummy.matrix);tint.setScalar(p.alpha);this.crests.setColorAt(i,tint);}
    this.crests.count=this.count;this.crests.instanceMatrix.needsUpdate=true;this.crests.instanceColor!.needsUpdate=true;
  }
  diagnostics(){const v=this.geometry.getAttribute('position');return {clock:this.time,kind:STAGES[this.stage].environment,vertices:v.count,crests:this.count,lightLayers:this.lights.filter(m=>m.visible).length,height:v.getZ(420),distance:this.distance};}
  dispose(){this.geometry.dispose();this.base.material.dispose();this.lights.forEach(m=>m.material.dispose());this.crests.geometry.dispose();(this.crests.material as T.Material).dispose();this.maps.forEach(m=>m.dispose());this.root.clear();}
}
