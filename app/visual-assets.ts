import * as T from 'three/webgpu';
import metalUrl from './textures/fortress-metal-v3.webp?url';
import armourUrl from './textures/fighter-armour-v3.webp?url';
import explosionUrl from './textures/explosion-v3.webp?url';
import planetUrl from './textures/planet-v3.webp?url';
import playerUrl from './textures/player-v3.webp?url';
import fighterUrl from './textures/fighter-v3.webp?url';
import cruiserUrl from './textures/cruiser-v3.webp?url';
import type {Kind} from './sim.ts';

function neutral(color:string){const c=document.createElement('canvas');c.width=c.height=2;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,2,2);return c;}
export const metalMap=new T.CanvasTexture(neutral('#52616e'));
export const armourMap=new T.CanvasTexture(neutral('#dce1e4'));
export const explosionMap=new T.CanvasTexture(neutral('#ffc888'));
export const planetMap=new T.CanvasTexture(neutral('#184881'));
export const playerMap=new T.CanvasTexture(neutral('#dce1e4')),fighterMap=new T.CanvasTexture(neutral('#f1dddd')),cruiserMap=new T.CanvasTexture(neutral('#dce1e4'));
for(const map of[metalMap,armourMap]){map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
explosionMap.colorSpace=T.SRGBColorSpace;
planetMap.colorSpace=T.SRGBColorSpace;planetMap.wrapS=T.RepeatWrapping;
for(const map of[playerMap,fighterMap,cruiserMap])map.colorSpace=T.SRGBColorSpace;
let loaded=0,pending:Promise<void>|undefined;
export function loadVisualAssets(){
  return pending??=Promise.all([[metalMap,metalUrl],[armourMap,armourUrl],[explosionMap,explosionUrl],[planetMap,planetUrl],[playerMap,playerUrl],[fighterMap,fighterUrl],[cruiserMap,cruiserUrl]].map(([texture,url])=>new Promise<void>(resolve=>{
    const timeout=setTimeout(resolve,8000),image=new Image();image.onload=()=>{clearTimeout(timeout);const t=texture as T.Texture;t.image=image;t.needsUpdate=true;loaded++;resolve();};image.onerror=()=>{clearTimeout(timeout);console.warn('A visual texture could not be loaded',url);resolve();};image.src=url as string;
  }))).then(()=>{});
}
export function visualAssetStatus(){return {generated:7,loaded};}
export function shipSkin(kind:Kind|'player'){
  const available=(map:T.Texture)=>map.image instanceof HTMLImageElement&&map.image.complete;
  if(kind==='player'&&available(playerMap))return {map:playerMap,width:3.1,height:4.25,color:0xffffff};
  if(kind==='cruiser'&&available(cruiserMap))return {map:cruiserMap,width:5.2,height:6.1,color:0xffffff};
  if(available(fighterMap)&&['fighter','lancer','drone','dart'].includes(kind)){const small=kind==='drone'||kind==='dart';return {map:fighterMap,width:small?1.95:3.1,height:small?2.4:3.5,color:kind==='dart'?0xb69add:kind==='lancer'?0xd2ddf7:0xffffff};}
}
export function surface(c:number,paint=false){return new T.MeshStandardMaterial({color:c,map:paint?armourMap:metalMap,bumpMap:paint?armourMap:metalMap,bumpScale:paint?.027:.085,metalness:paint?.48:.80,roughness:paint?.34:.52,envMapIntensity:.75});}
