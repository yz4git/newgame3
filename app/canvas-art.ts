import * as T from 'three/webgpu';
import { shipModel, bossModel } from './art.ts';
import type { Kind } from './sim.ts';

interface SpriteAsset { canvas:HTMLCanvasElement;left:number;top:number;width:number;height:number; }
interface Face {points:number[][];depth:number;color:string;}
const cache=new Map<string,SpriteAsset>();

// Rasterize our own meshes once on the CPU. GPU-disabled devices retain the
// same silhouettes and armour detail, without maintaining a second asset set.
function raster(key:string,model:T.Object3D):SpriteAsset {
  const saved=cache.get(key);if(saved)return saved;
  model.updateMatrixWorld(true);const faces:Face[]=[];let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  model.traverse(object=>{
    if(!(object instanceof T.Mesh)||Array.isArray(object.material))return;
    const geo=object.geometry,index=geo.index,vertices=geo.getAttribute('position'),normals=geo.getAttribute('normal');
    const material=object.material as T.MeshStandardMaterial|T.MeshBasicMaterial;
    const normalMatrix=new T.Matrix3().getNormalMatrix(object.matrixWorld);
    for(let i=0;i<(index?.count??vertices.count);i+=3){
      const points:number[][]=[];let depth=0;const normal=new T.Vector3();
      for(let j=0;j<3;j++){
        const id=index?index.getX(i+j):i+j,v=new T.Vector3().fromBufferAttribute(vertices,id).applyMatrix4(object.matrixWorld);
        const x=v.x,y=v.y*.98+v.z*.19;points.push([x,y]);depth+=v.z*.98-v.y*.19;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.max(top,y);bottom=Math.min(bottom,y);
        if(normals)normal.add(new T.Vector3().fromBufferAttribute(normals,id).applyNormalMatrix(normalMatrix));
      }
      normal.normalize();const basic=material instanceof T.MeshBasicMaterial;
      const shade=basic?1:Math.max(.26,Math.min(1.38,.58-normal.x*.26+normal.y*.24+normal.z*.53));
      const color=material.color.clone().multiplyScalar(shade);
      if(!basic){const p=material as T.MeshStandardMaterial;color.add(p.emissive.clone().multiplyScalar(p.emissiveIntensity));}
      color.convertLinearToSRGB();faces.push({points,depth:depth/3,color:'#'+color.getHexString(T.LinearSRGBColorSpace)});
    }
  });
  left-=.12;top+=.12;right+=.12;bottom-=.12;const width=right-left,height=top-bottom,pixels=48;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*pixels);canvas.height=Math.ceil(height*pixels);
  const ctx=canvas.getContext('2d')!;ctx.scale(pixels,pixels);ctx.translate(-left,top);ctx.scale(1,-1);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();}
  const result={canvas,left,top,width,height};cache.set(key,result);return result;
}
export function shipSprite(kind:Kind|'player'){return cache.get(kind)??raster(kind,shipModel(kind));}
export function bossSprite(stage:number,part:'core'|'wing0'|'wing1'){
  const key='boss'+stage+part,existing=cache.get(key);if(existing)return existing;
  const model=bossModel(stage);
  if(part==='core'){for(let i=0;i<2;i++)model.remove(model.getObjectByName('wing'+i)!);}
  else {const wing=model.getObjectByName(part)!;model.clear();model.add(wing);}
  return raster(key,model);
}
