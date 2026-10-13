import * as T from 'three/webgpu';

/** A little occlusion remains on real faces when the mobile shadow pass is
 * disabled. Colour follows height and surface orientation, never the camera. */
export function shadeSolid(geometry:T.BufferGeometry,amount=.24){
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
 geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
 const range=Math.max(.01,bounds.max.z-bounds.min.z),values=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const height=(p.getZ(i)-bounds.min.z)/range;
  const shade=1-amount*(.45*(1-height)+.55*Math.max(0,-n.getZ(i)));
  values[i*3]=shade;values[i*3+1]=shade;values[i*3+2]=shade;
 }
 geometry.setAttribute('color',new T.BufferAttribute(values,3));return geometry;
}

/** Analytic surface normals give small waves an actual moving reflection in
 * WebGL and WebGPU without shaders, images, normal maps or extra passes. */
export function flowSurface(x:number,y:number,time:number,stage:number,reduced=false,out={height:0,dx:0,dy:0}){
 const clock=reduced?0:time,scale=stage===5?.58:stage===3?.24:1;
 const a=x*.23+y*.13-clock*.84,b=x*-.11+y*.31+clock*.58;
 const c=x*.47+y*.39-clock*1.14;
 const height=scale*(Math.sin(a)*.34+Math.sin(b)*.20+Math.sin(c)*.055);
 const dx=scale*(Math.cos(a)*.34*.23-Math.cos(b)*.20*.11+Math.cos(c)*.055*.47);
 const dy=scale*(Math.cos(a)*.34*.13+Math.cos(b)*.20*.31+Math.cos(c)*.055*.39);
 out.height=height;out.dx=dx;out.dy=dy;return out;
}

/** Sculpted basalt: broad cheeks, inset eye sockets, a projecting nose and
 * an angular jaw. Every change in depth is part of the physical stone mesh. */
export function guardianFace(){
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],nx=14,ny=18;
 const bump=(x:number,y:number,cx:number,cy:number,sx:number,sy:number)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 for(let row=0;row<=ny;row++)for(let col=0;col<=nx;col++){
  const y=-8+row/ny*19,u=col/nx*2-1;
  const width=5.7-Math.max(0,Math.abs(y-1)-6)*.36,x=u*width;
  const cheeks=1.5*(bump(x,y,-3,-.5,2.3,3.6)+bump(x,y,3,-.5,2.3,3.6));
  const nose=3.3*bump(x,y,0,.5,.92,4.1);
  const sockets=1.7*(bump(x,y,-2.4,3.1,1.45,1)+bump(x,y,2.4,3.1,1.45,1));
  const mouth=.85*bump(x,y,0,-5.1,3.2,.65);
  const z=2.8+1.05*(1-u*u)+cheeks+nose-sockets-mouth;
  vertices.push(x,y,z);uvs.push(col/nx,row/ny);
 }
 for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
  const a=row*(nx+1)+col;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);
 }
 const indexed=new T.BufferGeometry();indexed.setAttribute('position',new T.Float32BufferAttribute(vertices,3));indexed.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));indexed.setIndex(indices);
 const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();
 return geometry;
}
