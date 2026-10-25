/**
 * NOVA STRIKE — Arcade rail-shooter combat rules.
 * Deliberately separate from graphics/Three.js so hit cadence, fair attack
 * tells, smart-bomb AoE, and combo rewards can be tested independently.
 * Inspired by classic console rail shooters, using original missions/assets.
 */
import {clamp,dist,type V3} from './nova64-rules.ts';

export const ARCADE={
  normalHp:2,
  eliteHp:7,
  groundHp:6,
  basicLaserDamage:2.3,
  twinLaserDamage:2.6,
  hyperLaserDamage:3.0,
  laserInterval:.125,
  threatWarning:.78,
  bombFuse:.47,
  bombRadius:38,
  bombDamage:65,
  maxHostileBullets:14,
  comboWindow:3.6
} as const;

export type EnemyClass='normal'|'elite'|'ground'|'boss';
export function combatHitPoints(kind:EnemyClass,bossHp=185){
 switch(kind){
  case 'normal':return ARCADE.normalHp;
  case 'elite':return ARCADE.eliteHp;
  case 'ground':return ARCADE.groundHp;
  case 'boss':return bossHp;
 }
}
export function laserDamage(level:number){
 return level>=3?ARCADE.hyperLaserDamage:level===2?ARCADE.twinLaserDamage:ARCADE.basicLaserDamage;
}
export function attackCue(remaining:number,range:number,activeShots:number,boss=false){
 return remaining<=0&&range<(boss?225:185)&&activeShots<ARCADE.maxHostileBullets;
}
export function cueDuration(boss:boolean){return boss?.98:ARCADE.threatWarning;}
export function bombHits(blast:V3,target:V3,targetRadius=0){
 return dist(blast,target)<=ARCADE.bombRadius+targetRadius;
}
export function bombFalloff(blast:V3,target:V3,targetRadius=0){
 const d=Math.max(0,dist(blast,target)-targetRadius);
 return clamp(1-d/(ARCADE.bombRadius*1.4),.42,1);
}
export function comboReward(streak:number){
 if(streak>=10)return {points:streak*45,label:'CHAIN ×'+streak};
 if(streak>=5)return {points:streak*30,label:'CHAIN ×'+streak};
 if(streak>=3)return {points:streak*20,label:'CHAIN ×'+streak};
 return {points:0,label:''};
}
/** A world-space firing ray; near and far sights must lie on this SAME ray. */
export function sightRay(origin:V3,direction:V3,range:number):V3{
 return {x:origin.x+direction.x*range,y:origin.y+direction.y*range,z:origin.z+direction.z*range};
}

/** Distance of a weakpoint to a bullet's forward ray, including the segment
 * before the visible armor collision sphere. Without this, bullets hit the
 * invisible outer boss hitbox BEFORE reaching its glowing weakpoint. */
export function rayMissDistance(origin:V3,velocity:V3,target:V3){
 const vx=velocity.x,vy=velocity.y,vz=velocity.z;
 const len=Math.hypot(vx,vy,vz);
 if(len<1e-8)return Infinity;
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
 const t=(dx*vx+dy*vy+dz*vz)/len;
 if(t<0)return Infinity;
 return Math.hypot(dx-vx*t/len,dy-vy*t/len,dz-vz*t/len);
}
