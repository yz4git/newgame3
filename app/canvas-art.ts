import * as T from 'three/webgpu';
import { shipModel, bossModel } from './art.ts';
import type { Kind } from './sim.ts';
import {shipSkin} from './visual-assets.ts';

interface SpriteAsset { canvas:HTMLCanvasElement;left:number;top:number;width:number;height:number; }
interface Face {points:number[][];depth:number;color:string;uv?:number[][];image?:HTMLImageElement|HTMLCanvasElement;}
const cache=new Map<string,SpriteAsset>();

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
      normal.normalize();const basic=material instanceof T.MeshBasicMaterial;
      const shade=basic?1:Math.max(.26,Math.min(1.38,.58-normal.x*.26+normal.y*.24+normal.z*.53));
      const color=material.color.clone().multiplyScalar(shade);
      if(!basic){const p=material as T.MeshStandardMaterial;color.add(p.emissive.clone().multiplyScalar(p.emissiveIntensity));}
      color.convertLinearToSRGB();faces.push({points,depth:depth/3,color:'#'+color.getHexString(T.LinearSRGBColorSpace),uv,image:material.map?.image as HTMLImageElement|HTMLCanvasElement|undefined});
    }
  });
  left-=.12;top+=.12;right+=.12;bottom-=.12;const width=right-left,height=top-bottom;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*pixels);canvas.height=Math.ceil(height*pixels);
  const ctx=canvas.getContext('2d')!;ctx.scale(pixels,pixels);ctx.translate(-left,top);ctx.scale(1,-1);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){
    ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
    if(!face.image||face.uv?.length!==3||face.uv.some(p=>p.some(v=>v<0||v>1)))continue;
    const [[u0,v0],[u1,v1],[u2,v2]]=face.uv.map(([u,v])=>[u*face.image!.width,v*face.image!.height]);
    const [[x0,y0],[x1,y1],[x2,y2]]=face.points,d=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);if(Math.abs(d)<.01)continue;
    const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/d,b=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/d;
    const cc=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/d,dd=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/d;
    ctx.save();ctx.clip();ctx.transform(a,b,cc,dd,x0-a*u0-cc*v0,y0-b*u0-dd*v0);ctx.drawImage(face.image,0,0);ctx.restore();
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
  const model=bossModel(stage);
  if(part==='core'){for(let i=0;i<2;i++)model.remove(model.getObjectByName('wing'+i)!);}
  else {const wing=model.getObjectByName(part)!;model.clear();model.add(wing);}
  return meshSprite(key,model);
}
