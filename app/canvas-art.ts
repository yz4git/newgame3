import * as T from 'three/webgpu';
import { shipModel, bossModel } from './art.ts';
import type { Kind } from './sim.ts';
import {shipSkin,bossSkin,bossMaps} from './visual-assets.ts';
import {skinWarp} from './motion.ts';

interface SpriteAsset { canvas:HTMLCanvasElement;left:number;top:number;width:number;height:number; }
interface Face {points:number[][];depth:number;color:string;uv?:number[][];image?:HTMLImageElement|HTMLCanvasElement;cutout?:boolean;}
const cache=new Map<string,SpriteAsset>();
export function dropSprite(key:string){cache.delete(key);}

// Rasterize our own meshes once on the CPU. GPU-disabled devices retain the
// same silhouettes and armour detail, without maintaining a second asset set.
export function meshSprite(key:string,model:T.Object3D,pixels=48):SpriteAsset {
  const saved=cache.get(key);if(saved)return saved;
  model.updateMatrixWorld(true);const faces:Face[]=[];let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  model.traverse(object=>{
    if(!(object instanceof T.Mesh)||Array.isArray(object.material))return;
    const geo=object.geometry,index=geo.index,vertices=geo.getAttribute('position'),normals=geo.getAttribute('normal'),texUV=geo.getAttribute('uv');
    const material=object.material as T.MeshStandardMaterial|T.MeshBasicMaterial;
    const normalMatrix=new T.Matrix3().getNormalMatrix(object.matrixWorld);
    for(let i=0;i<(index?.count??vertices.count);i+=3){
      const points:number[][]=[],uv:number[][]=[];let depth=0;const normal=new T.Vector3();
      for(let j=0;j<3;j++){
        const id=index?index.getX(i+j):i+j,v=new T.Vector3().fromBufferAttribute(vertices,id).applyMatrix4(object.matrixWorld);
        const x=v.x,y=v.y*.954+v.z*.298;points.push([x,y]);depth+=v.z*.954-v.y*.298;
        if(texUV)uv.push([texUV.getX(id),1-texUV.getY(id)]);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.max(top,y);bottom=Math.min(bottom,y);
        if(normals)normal.add(new T.Vector3().fromBufferAttribute(normals,id).applyNormalMatrix(normalMatrix));
      }
      normal.normalize();if(material.side!==T.DoubleSide&&normal.z*.954-normal.y*.298<=.005)continue;const basic=material instanceof T.MeshBasicMaterial;
      const shade=basic?1:Math.max(.26,Math.min(1.38,.58-normal.x*.26+normal.y*.24+normal.z*.53));
      const color=material.color.clone().multiplyScalar(shade);
      if(!basic){const p=material as T.MeshStandardMaterial;color.add(p.emissive.clone().multiplyScalar(p.emissiveIntensity));}
      color.convertLinearToSRGB();faces.push({points,depth:depth/3,color:'#'+color.getHexString(T.LinearSRGBColorSpace),uv,cutout:material.alphaTest>0,image:material.map?.image as HTMLImageElement|HTMLCanvasElement|undefined});
    }
  });
  if(!faces.length){const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const result={canvas,left:0,top:0,width:0,height:0};cache.set(key,result);return result;}
  left-=.12;top+=.12;right+=.12;bottom-=.12;const width=right-left,height=top-bottom;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*pixels);canvas.height=Math.ceil(height*pixels);
  const ctx=canvas.getContext('2d')!;ctx.scale(pixels,pixels);ctx.translate(-left,top);ctx.scale(1,-1);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){
    ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=face.color;if(!face.cutout)ctx.fill();
    if(!face.image||face.uv?.length!==3||face.uv.some(p=>p.some(v=>v<0||v>1)))continue;
    const [[u0,v0],[u1,v1],[u2,v2]]=face.uv.map(([u,v])=>[u*face.image!.width,v*face.image!.height]);
    const [[x0,y0],[x1,y1],[x2,y2]]=face.points,d=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);if(Math.abs(d)<.01)continue;
    const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/d,b=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/d;
    const cc=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/d,dd=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/d;
    ctx.save();ctx.clip();ctx.transform(a,b,cc,dd,x0-a*u0-cc*v0,y0-b*u0-dd*v0);const minU=Math.max(0,Math.min(u0,u1,u2)-1),minV=Math.max(0,Math.min(v0,v1,v2)-1),maxU=Math.min(face.image.width,Math.max(u0,u1,u2)+1),maxV=Math.min(face.image.height,Math.max(v0,v1,v2)+1);if(maxU>minU&&maxV>minV)ctx.drawImage(face.image,minU,minV,maxU-minU,maxV-minV,minU,minV,maxU-minU,maxV-minV);ctx.restore();
    if(face.cutout)continue;
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=face.color;ctx.fill();ctx.restore();
  }
  const result={canvas,left,top,width,height};cache.set(key,result);return result;
}
export function shipSprite(kind:Kind|'player'){
  const existing=cache.get(kind);if(existing)return existing;
  const skin=shipSkin(kind);if(!skin)return meshSprite(kind,shipModel(kind));
  const canvas=document.createElement('canvas'),image=skin.map.image as unknown as HTMLImageElement;canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d')!;c.drawImage(image,0,0);
  if(skin.color!==0xffffff){c.globalCompositeOperation='multiply';c.fillStyle='#'+skin.color.toString(16).padStart(6,'0');c.fillRect(0,0,canvas.width,canvas.height);c.globalCompositeOperation='destination-in';c.drawImage(image,0,0);}
  const result={canvas,left:-skin.width/2,top:skin.height/2,width:skin.width,height:skin.height};cache.set(kind,result);return result;
}
export function bossSprite(stage:number,part:'core'|'wing0'|'wing1'){
  const key='boss'+stage+part,existing=cache.get(key);if(existing)return existing;
  const index=part==='core'?0:part==='wing0'?1:2,skin=bossSkin(stage,index);
  if(skin){
    for(const k of cache.keys())if(k.startsWith('boss')&&!k.startsWith('boss'+stage))cache.delete(k);
    const image=bossMaps[stage].image as unknown as HTMLImageElement,col=[1,0,2][index],canvas=document.createElement('canvas');canvas.width=Math.round(image.width/3);canvas.height=image.height;
    canvas.getContext('2d')!.drawImage(image,col*image.width/3,0,image.width/3,image.height,0,0,canvas.width,canvas.height);
    const result={canvas,left:skin.x-skin.width/2,top:skin.height/2,width:skin.width,height:skin.height};cache.set(key,result);return result;
  }
  const model=bossModel(stage);
  if(part==='core'){for(let i=0;i<2;i++)model.remove(model.getObjectByName('wing'+i)!);}
  else {const wing=model.getObjectByName(part)!;model.clear();model.add(wing);}
  return meshSprite(key,model);
}
export function tankSprite(part:'chassis'|'turret'){
  const key='tank-'+part,existing=cache.get(key);if(existing)return existing;
  const model=shipModel('tank'),turret=model.getObjectByName('turret')!;
  if(part==='chassis')model.remove(turret);else{model.clear();model.add(turret);}
  return meshSprite(key,model);
}

/** Affine textured triangles match the GPU cutout deformation without new per-frame bitmaps. */
export function drawWarpedSprite(c:CanvasRenderingContext2D,asset:SpriteAsset,warp:(x:number,y:number)=>[number,number]){
 const cells=6,im=asset.canvas;
 for(let row=0;row<cells;row++)for(let col=0;col<cells;col++){
  const u0=col/cells,u1=(col+1)/cells,v0=row/cells,v1=(row+1)/cells;
  const p=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>{const [x,y]=warp(u-.5,.5-v);return [x*asset.width,-y*asset.height];});
  const tex=[[u0*im.width,v0*im.height],[u1*im.width,v0*im.height],[u1*im.width,v1*im.height],[u0*im.width,v1*im.height]];
  for(const ids of[[0,1,2],[0,2,3]]){
   const [[x0,y0],[x1,y1],[x2,y2]]=ids.map(i=>p[i]),[[a0,b0],[a1,b1],[a2,b2]]=ids.map(i=>tex[i]);
   const d=(a1-a0)*(b2-b0)-(a2-a0)*(b1-b0),a=((x1-x0)*(b2-b0)-(x2-x0)*(b1-b0))/d,b=((y1-y0)*(b2-b0)-(y2-y0)*(b1-b0))/d;
   const cc=((x2-x0)*(a1-a0)-(x1-x0)*(a2-a0))/d,dd=((y2-y0)*(a1-a0)-(y1-y0)*(a2-a0))/d;
   c.save();c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.lineTo(x2,y2);c.closePath();c.clip();c.transform(a,b,cc,dd,x0-a*a0-cc*b0,y0-b*a0-dd*b0);c.drawImage(im,u0*im.width,v0*im.height,im.width/cells,im.height/cells,u0*im.width,v0*im.height,im.width/cells,im.height/cells);c.restore();
  }
 }
}
const warpedFrames=new Map<string,SpriteAsset>();
export function warpedSprite(asset:SpriteAsset,kind:Kind,t:number,flex:number){
 const frame=Math.floor(t*18),panel=Math.round(flex*16),key=kind+':'+frame+':'+panel,saved=warpedFrames.get(key);if(saved)return saved;
 const width=asset.width*1.18,height=asset.height*1.18,pixels=320/Math.max(width,height),canvas=document.createElement('canvas');
 canvas.width=Math.ceil(width*pixels);canvas.height=Math.ceil(height*pixels);const c=canvas.getContext('2d')!;c.translate(canvas.width/2,canvas.height/2);c.scale(pixels,pixels);
 drawWarpedSprite(c,asset,(x,y)=>skinWarp(kind,x,y,frame/18,panel/16));
 const baked={canvas,left:-width/2,top:height/2,width,height};warpedFrames.set(key,baked);if(warpedFrames.size>24)warpedFrames.delete(warpedFrames.keys().next().value!);return baked;
}
