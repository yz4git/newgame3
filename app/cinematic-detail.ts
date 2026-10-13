import * as T from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Chamfers catch the moving key light. Unlike a flat bevel texture these
 * remain true side faces in both rendering backends and the shadow pass. */
export function cinematicBox(w:number,h:number,d:number){
 const b=Math.min(.10,w*.10,h*.10,d*.20),x=w/2-b,y=h/2-b;
 const shape=new T.Shape();shape.moveTo(-x,-y);shape.lineTo(x,-y);
 shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth:d-b*2,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,steps:1,curveSegments:1});
 geometry.translate(0,0,-d/2+b);return geometry;
}

export function weatheredRock(seed:number,detail=1){
 const g=new T.IcosahedronGeometry(1,detail),p=g.getAttribute('position');
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  // Coordinate-based noise preserves shared positions at facet boundaries.
  const r=1+.085*Math.sin(x*7+seed)*Math.sin(y*6-seed*.7)+.065*Math.cos(z*9+x*3+seed);
  p.setXYZ(i,x*r,y*r,z*r);
 }
 g.computeVertexNormals();return g;
}

const mesh=(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number)=>{
 const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;parent.add(m);return m;
};
const plate=(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(parent,cinematicBox(w,h,d),mat,x,y,z);
function pipe(parent:T.Object3D,mat:T.Material,points:number[][],radius:number){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));
 return mesh(parent,new T.TubeGeometry(curve,18,radius,6,false),mat,0,0,0);
}

/** Bake only rigid members, per material; moving assemblies retain their pivots. */
function bakeRigid(group:T.Object3D){
 group.updateMatrixWorld(true);
 const inverse=group.matrixWorld.clone().invert();
 const batches=new Map<T.Material,T.BufferGeometry[]>(),old=new Set<T.BufferGeometry>();
 group.traverse(o=>{
  if(!(o instanceof T.Mesh)||Array.isArray(o.material))return;
  let geo=o.geometry.clone();if(geo.index){const plain=geo.toNonIndexed();geo.dispose();geo=plain;}
  // All geometries use position/normal/uv; no images or alpha cards are needed.
  geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  const list=batches.get(o.material)??[];list.push(geo);batches.set(o.material,list);old.add(o.geometry);
 });
 group.clear();
 for(const [material,list]of batches){
  const geometry=mergeGeometries(list,false);
  for(const g of list)g.dispose();
  if(!geometry)throw new Error('Incompatible cinematic geometry');
  const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;group.add(m);
 }
 for(const g of old)g.dispose();
}

function panelSkin(m:T.Mesh,dark:T.Material,metal:T.Material){
 m.geometry.computeBoundingBox();const b=m.geometry.boundingBox!;
 const w=b.max.x-b.min.x,h=b.max.y-b.min.y,z=b.max.z+.035;
 if(w<.8||h<1.2)return;
 const detail=new T.Group();detail.name='attached-machined-surface';m.add(detail);
 plate(detail,dark,0,0,z,w*.74,h*.71,.08);
 for(const side of[-1,1]){
  plate(detail,metal,side*w*.42,0,z+.045,.055,h*.76,.07);
  for(let j=0;j<3;j++){
   const bolt=mesh(detail,new T.CylinderGeometry(.065,.065,.09,6),metal,side*w*.32,(j-1)*h*.27,z+.11);
   bolt.rotation.x=Math.PI/2;
  }
 }
 for(let j=0;j<3;j++)plate(detail,metal,0,(j-1)*h*.20,z+.06,w*.43,.055,.065);
 bakeRigid(detail);
}

/** Details belong to their actual supporting mesh so joints do not float
 * when an iris opens, a plate shears, or a crane arm pivots. */
export function finishCinematicChapter(stage:number,act:number,still:T.Group,moving:T.Group,secondary:T.Group,materials:T.Material[]){
 const [dark,metal,accent]=materials;
 const gunmetal=new T.MeshStandardMaterial({color:0x17232d,metalness:.72,roughness:.38,transparent:true,depthWrite:true});
 const edge=new T.MeshStandardMaterial({color:stage===5?0xb18c6e:0x9ba7ad,metalness:.82,roughness:.30,transparent:true,depthWrite:true});
 const light=new T.MeshStandardMaterial({color:0x43606c,emissive:[0xc67c50,0x49c8d5,0xd48250,0x71b9dc,0x64b58c,0xe4813e][stage],emissiveIntensity:.60,roughness:.42,metalness:.25,transparent:true,depthWrite:true});
 materials.push(gunmetal,edge,light);
 // Industrial surfaces have recesses, bolted edge trims and inset vents.
 if(stage===0||stage===1||stage===2||stage===5){
  for(const group of [still,moving]){
   let n=0;for(const obj of [...group.children]){
    if(obj instanceof T.Mesh&&obj.geometry.type==='ExtrudeGeometry'&&n++<4)panelSkin(obj,gunmetal,edge);
   }
  }
 }
 if(stage===0){
  // Tiny connected mining equipment establishes scale against the fractured ore.
  plate(still,gunmetal,-5.1,1.8,-5.6,2.3,3.8,.8);
  for(let k=0;k<3;k++){
   plate(still,metal,-5.1,-.3+k*1.25,-5.05,1.85,.12,.25);
   plate(still,light,-5.6+k*.5,3.1,-5.05,.16,.32,.16);
  }
  pipe(still,edge,[[-5,3,-5.3],[-4,4,-5.4],[-3.2,3.5,-6.1]],.14);
  if(act===1){
   for(const arm of moving.children){
    if(!(arm instanceof T.Mesh))continue;
    // Hydraulic piston is a child of its articulated grabber finger.
    mesh(arm,new T.CylinderGeometry(.10,.10,3.5,10),edge,0,.7,.4);
    mesh(arm,new T.CylinderGeometry(.20,.20,1.1,10),gunmetal,0,1.9,.4);
   }
  }
 }else if(stage===1){
  if(act===2){
   const hull=still.children.find(o=>o instanceof T.Mesh&&o.geometry.type==='IcosahedronGeometry') as T.Mesh|undefined;
   if(hull){hull.geometry.dispose();hull.geometry=new T.SphereGeometry(1,32,16);}
   // Pressure hull: visible ribs, recessed deck and hull-connected screws.
   plate(still,gunmetal,0,.1,-5.12,9.8,1.7,.32);
   for(let k=0;k<7;k++){
    const rib=mesh(still,new T.TorusGeometry(1.92,.075,6,24),edge,-4.4+k*1.38,-.25,-7);
    rib.rotation.y=Math.PI/2;rib.scale.y=.98;
    plate(still,light,-3.8+k*1.22,.30,-4.92,.28,.14,.07);
   }
   for(const side of[-1,1]){
    const hub=mesh(still,new T.CylinderGeometry(.55,.55,.8,12),gunmetal,side*5.4,-.4,-6.6);hub.rotation.z=Math.PI/2;
   }
  }else{
   for(let i=0;i<4;i++){
    plate(still,gunmetal,-5+i*3.1,-3.6,-6.9,1.6,2,.8);
    plate(still,light,-5+i*3.1,-3,-6.42,.75,.14,.08);
   }
  }
 }else if(stage===2){
  // Layered iris/bastion housing with thick bevels and radial bearings.
  const rim=mesh(still,new T.TorusGeometry(4.7,.28,8,48),gunmetal,0,0,-6.3);
  rim.scale.y=act===1?1.15:1;
  for(let k=0;k<12;k++){
   const a=k*Math.PI/6,x=Math.cos(a)*4.7,y=Math.sin(a)*4.7;
   const bearing=mesh(still,new T.CylinderGeometry(.22,.22,.4,10),edge,x,y,-5.94);bearing.rotation.x=Math.PI/2;
   if(k%3===0)plate(still,light,x,y,-5.67,.14,.36,.09);
  }
 }else if(stage===3){
  // Cracks follow the crystal surface, with depth at each fractured fork.
  for(const side of[-1,1])for(let k=0;k<3;k++){
   const x=side*(3.8+k*.65),y=-3.5+k*2.6;
   pipe(still,accent,[[x,y,-6.6],[x-side*.5,y+1.0,-5.8],[x+side*.1,y+2.1,-6.2]],.055);
  }
  if(act===2){
   plate(still,gunmetal,1,0,-5.1,3.4,6.4,.45);
   for(let k=0;k<5;k++)plate(still,light,.8,-2.7+k*1.3,-4.83,2.6,.14,.09);
  }
 }else if(stage===4){
  // Curved root systems wrap around real stepped stone, not straight rods.
  for(const side of[-1,1]){
   pipe(still,dark,[[side*5,-5,-7],[side*3.8,-1,-6.1],[side*5,3,-6.5],[side*2.6,6,-7]],.32);
   pipe(still,accent,[[side*5,-3,-6.5],[side*2.8,0,-5.8],[side*3.3,3,-6]],.14);
  }
  if(act===1){
   for(let k=0;k<3;k++){
    plate(still,dark,-.3,-2.8+k*.55,-5.6+k*.22,6.3-k*.8,1.6,.5);
    plate(still,light,-.3,-2.25+k*.55,-5.30+k*.22,3.8-k*.6,.07,.08);
   }
  }
 }else{
  for(const side of[-1,1]){
   pipe(still,gunmetal,[[side*4.9,4,-6.1],[side*4.6,2,-5.8],[side*5.1,-1,-5.9],[side*4.4,-4,-6.2]],.20);
   for(let k=0;k<4;k++)plate(still,light,side*5,3.3-k*2,-5.35,.32,.65,.16);
  }
  if(act===1){
   for(const ram of moving.children){
    if(!(ram instanceof T.Mesh)||ram.geometry.type!=='CylinderGeometry')continue;
    ram.rotation.x=0; // Hammer piston axis runs along its actual striking motion.
    mesh(ram,new T.CylinderGeometry(.37,.37,3.8,16),edge,0,1.6,0);
    mesh(ram,new T.TorusGeometry(.66,.11,6,20),gunmetal,0,-1.9,0).rotation.x=Math.PI/2;
   }
  }
 }
 // Rigid scenery is merged into a handful of draws. Moving joints retain
 // all attached surface details and original animation addresses.
 bakeRigid(still);
 for(const g of[still,moving,secondary])g.traverse(o=>{
  if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}
 });
}
