import * as T from 'three/webgpu';
import metalUrl from './textures/fortress-metal-v3.webp?url';
import armourUrl from './textures/fighter-armour-v3.webp?url';
import explosionUrl from './textures/explosion-v3.webp?url';
import planetUrl from './textures/planet-v3.webp?url';
import playerUrl from './textures/player-v3.webp?url';
import fighterUrl from './textures/fighter-v3.webp?url';
import cruiserUrl from './textures/cruiser-v3.webp?url';
import rockUrl from './textures/asteroid-rock-v4.webp?url';
import oceanUrl from './textures/ocean-water-v4.webp?url';
import iceUrl from './textures/glacier-ice-v4.webp?url';
import snowUrl from './textures/wind-snow-v4.webp?url';
import mossUrl from './textures/ancient-moss-v4.webp?url';
import lavaUrl from './textures/molten-lava-v4.webp?url';
import nebulaUrl from './textures/violet-nebula-v4.webp?url';
import canopyUrl from './textures/jungle-canopy-v4.webp?url';
import interceptorUrl from './textures/interceptor-v6.webp?url';
import bomberUrl from './textures/bomber-v6.webp?url';
import corvetteUrl from './textures/corvette-v6.webp?url';
import sentinelUrl from './textures/sentinel-v6.webp?url';
import striderUrl from './textures/strider-v6.webp?url';
import droneUrl from './textures/drone-v6.webp?url';
import lancerUrl from './textures/lancer-v6.webp?url';
import shipyardUrl from './textures/orbital-shipyard-v6.webp?url';
import carrierUrl from './textures/ocean-carrier-v6.webp?url';
import citadelUrl from './textures/fortress-citadel-v6.webp?url';
import arcologyUrl from './textures/glacier-arcology-v6.webp?url';
import sanctuaryUrl from './textures/jungle-sanctuary-v6.webp?url';
import refineryUrl from './textures/lava-refinery-v6.webp?url';
import atlasUrl from './textures/explosion-atlas-v6.webp?url';
import smokeUrl from './textures/smoke-v6.webp?url';
import swellUrl from './textures/ocean-swell-v7.webp?url';
import foamUrl from './textures/wave-foam-v7.webp?url';
import causticUrl from './textures/water-caustics-v7.webp?url';
import waterfallUrl from './textures/waterfall-stream-v7.webp?url';
import ventUrl from './textures/lava-splash-atlas-v7.webp?url';
import plumeUrl from './textures/engine-plume-v7.webp?url';
import impactUrl from './textures/plasma-impact-atlas-v7.webp?url';
import cloudUrl from './textures/cloud-bank-v7.webp?url';
import type {Kind} from './sim.ts';

function neutral(color:string){const c=document.createElement('canvas');c.width=c.height=2;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,2,2);return c;}
export const metalMap=new T.CanvasTexture(neutral('#52616e'));
export const armourMap=new T.CanvasTexture(neutral('#dce1e4'));
export const explosionMap=new T.CanvasTexture(neutral('#ffc888'));
export const planetMap=new T.CanvasTexture(neutral('#184881'));
export const playerMap=new T.CanvasTexture(neutral('#dce1e4')),fighterMap=new T.CanvasTexture(neutral('#f1dddd')),cruiserMap=new T.CanvasTexture(neutral('#dce1e4'));
export const enemyMaps=Object.fromEntries(['interceptor','bomber','corvette','sentinel','strider','drone','lancer'].map(k=>[k,new T.CanvasTexture(neutral('#9cabb8'))])) as Record<string,T.CanvasTexture>;
export const sceneMaps=Array.from({length:6},()=>new T.CanvasTexture(neutral('#364950')));
export const explosionAtlasMap=new T.CanvasTexture(neutral('#ffcf8f')),smokeMap=new T.CanvasTexture(neutral('#70615d'));
export const explosionFrames=Array.from({length:4},(_,i)=>{const t=explosionAtlasMap.clone();t.repeat.set(.5,.5);t.offset.set(i%2*.5,1-(Math.floor(i/2)+1)*.5);return t;});
export const livingMaps={swell:new T.CanvasTexture(neutral('#124b71')),foam:new T.CanvasTexture(neutral('#ffffff00')),caustics:new T.CanvasTexture(neutral('#000')),waterfall:new T.CanvasTexture(neutral('#ffffff00')),vents:new T.CanvasTexture(neutral('#ffffff00')),plume:new T.CanvasTexture(neutral('#ffffff00')),impact:new T.CanvasTexture(neutral('#ffffff00')),cloud:new T.CanvasTexture(neutral('#ffffff00'))};
function atlasFrames(map:T.Texture){return Array.from({length:4},(_,i)=>{const frame=map.clone();frame.repeat.set(.5,.5);frame.offset.set(i%2*.5,1-(Math.floor(i/2)+1)*.5);return frame;});}
export const ventFrames=atlasFrames(livingMaps.vents),impactFrames=atlasFrames(livingMaps.impact);
for(const map of [...Object.values(livingMaps),...ventFrames,...impactFrames])map.colorSpace=T.SRGBColorSpace;
for(const map of [livingMaps.swell,livingMaps.caustics]){map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
export const terrainMaps={rock:new T.CanvasTexture(neutral('#64656b')),ocean:new T.CanvasTexture(neutral('#094963')),ice:new T.CanvasTexture(neutral('#519bbe')),snow:new T.CanvasTexture(neutral('#e6f1f7')),moss:new T.CanvasTexture(neutral('#526148')),lava:new T.CanvasTexture(neutral('#a6440c')),nebula:new T.CanvasTexture(neutral('#090b21')),canopy:new T.CanvasTexture(neutral('#184b2a'))};
for(const map of Object.values(terrainMaps)){map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
terrainMaps.canopy.wrapS=terrainMaps.canopy.wrapT=T.ClampToEdgeWrapping;
for(const map of[metalMap,armourMap]){map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
explosionMap.colorSpace=T.SRGBColorSpace;
planetMap.colorSpace=T.SRGBColorSpace;planetMap.wrapS=T.RepeatWrapping;
for(const map of[playerMap,fighterMap,cruiserMap,...Object.values(enemyMaps),...sceneMaps,explosionAtlasMap,smokeMap,...explosionFrames])map.colorSpace=T.SRGBColorSpace;
const assets:[T.Texture,string][]=[[metalMap,metalUrl],[armourMap,armourUrl],[explosionMap,explosionUrl],[planetMap,planetUrl],[playerMap,playerUrl],[fighterMap,fighterUrl],[cruiserMap,cruiserUrl],[terrainMaps.rock,rockUrl],[terrainMaps.ocean,oceanUrl],[terrainMaps.ice,iceUrl],[terrainMaps.snow,snowUrl],[terrainMaps.moss,mossUrl],[terrainMaps.lava,lavaUrl],[terrainMaps.nebula,nebulaUrl],[terrainMaps.canopy,canopyUrl],
  ...['interceptor','bomber','corvette','sentinel','strider','drone','lancer'].map((k,i)=>[enemyMaps[k],[interceptorUrl,bomberUrl,corvetteUrl,sentinelUrl,striderUrl,droneUrl,lancerUrl][i]] as [T.Texture,string]),
  ...[shipyardUrl,carrierUrl,citadelUrl,arcologyUrl,sanctuaryUrl,refineryUrl].map((url,i)=>[sceneMaps[i],url] as [T.Texture,string]),[explosionAtlasMap,atlasUrl],[smokeMap,smokeUrl],
  ...[swellUrl,foamUrl,causticUrl,waterfallUrl,ventUrl,plumeUrl,impactUrl,cloudUrl].map((url,i)=>[Object.values(livingMaps)[i],url] as [T.Texture,string])];
let loaded=0,pending:Promise<void>|undefined;
export function loadVisualAssets(){
  return pending??=Promise.all(assets.map(([texture,url])=>new Promise<void>(resolve=>{
    const timeout=setTimeout(resolve,25000),image=new Image();image.onload=()=>{clearTimeout(timeout);texture.image=image;texture.needsUpdate=true;const frames=texture===explosionAtlasMap?explosionFrames:texture===livingMaps.vents?ventFrames:texture===livingMaps.impact?impactFrames:[];for(const frame of frames){(frame as T.Texture).image=image;frame.needsUpdate=true;}loaded++;resolve();};image.onerror=()=>{clearTimeout(timeout);console.warn('A visual texture could not be loaded',url);resolve();};image.src=url;
  }))).then(()=>{});
}
export function visualAssetStatus(){return {generated:assets.length,loaded};}
export const skinSizes:Record<string,[number,number]>={interceptor:[3.05,3.6],bomber:[5.4,4.9],corvette:[4.7,6.0],sentinel:[3.8,3.8],strider:[3.65,3.7],drone:[2.45,2.65],lancer:[2.85,4.9]};
export function shipSkin(kind:Kind|'player'){
  const available=(map:T.Texture)=>map.image instanceof HTMLImageElement&&map.image.complete;
  if(kind==='player'&&available(playerMap))return {map:playerMap,width:3.1,height:4.25,color:0xffffff};
  if(kind==='cruiser'&&available(cruiserMap))return {map:cruiserMap,width:5.2,height:6.1,color:0xffffff};
  if(enemyMaps[kind]&&available(enemyMaps[kind])){const [width,height]=skinSizes[kind];return {map:enemyMaps[kind],width,height,color:0xffffff};}
  if(available(fighterMap)&&['fighter','lancer','drone','dart'].includes(kind)){const small=kind==='drone'||kind==='dart';return {map:fighterMap,width:small?1.95:3.1,height:small?2.4:3.5,color:kind==='dart'?0xb69add:kind==='lancer'?0xd2ddf7:0xffffff};}
}
export function surface(c:number,paint=false){return new T.MeshStandardMaterial({color:c,map:paint?armourMap:metalMap,bumpMap:paint?armourMap:metalMap,bumpScale:paint?.027:.085,metalness:paint?.48:.80,roughness:paint?.34:.52,envMapIntensity:.75});}
