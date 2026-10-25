/**
 * Authored first-stage beats and approach trajectories, separated from drawing.
 * Coordinates progress by the actual route distance: boost and brake move
 * checkpoints, escort rescue, seven arches and the boss together.
 */
import {clamp,type WaveType,type V3} from './nova64-rules.ts';

export const STAGE1={
 checkpoint:1080,
 escortEncounter:1320,
 escortDeadline:1740,
 archesPreview:1615,
 canyonReveal:1500,
 waterfallApproach:3130,
 waterfallPassage:3465,
 boss:4190,
 nominalSpeed:76,
} as const;

export function crossedDistance(previousZ:number,currentZ:number,distance:number){
 return previousZ > -distance && currentZ <= -distance;
}
export function distanceToScriptSeconds(z:number){
 return Math.max(0,-z/STAGE1.nominalSpeed);
}
export function missionProgress(distance:number,isOpening:boolean,elapsed:number,duration:number){
 return clamp(isOpening?distance/STAGE1.boss:elapsed/duration,0,1);
}
/**
 * These fly-past animations keep a target on screen several seconds, rather
 * than the prior stationary cones that disappeared after one second.
 * Position is a *relative offset* to the enemy's initial world position.
 */
export function enemyFlightOffset(type:WaveType,age:number,index:number,seed:number):V3 {
 const side=index%2===0?1:-1;
 const t=Math.max(0,age),phase=seed*6.283;
 switch(type){
 case 'vee':
  return {x:Math.sin(t*1.1+phase)*1.4,y:Math.sin(t*.76+phase)*.9,z:0};
 case 'crossfire':
  return {x:side*(Math.min(t/3.5,1)*-13)+Math.sin(t*2.4+phase)*2.3,y:Math.sin(t*2+phase)*3.2,z:0};
 case 'squad':
  return {x:Math.sin(t*.85+index*.65)*4.5,y:Math.sin(t*.91+index)*1.4,z:0};
 case 'intercept':
  return {x:Math.sin(t*1.2+phase)*3.3,y:-Math.min(7,t*2.8)+Math.sin(t*2.3+phase)*1.5,z:0};
 case 'pincer':
  return {x:-side*Math.min(23,t*8)+Math.sin(t*2+phase)*1.5,y:Math.sin(t*1.5+phase)*2.7,z:0};
 case 'heavy':
  return {x:Math.sin(t*.65+phase)*1.9,y:Math.sin(t*.81+index)*1.3,z:0};
 case 'flypast':
  return {x:side*(t<2?0:Math.min(16,(t-2)*10)),y:Math.sin(t*3+phase)*3.0,z:0};
 }
}
/** Enemy's longitudinal velocity relative to the fixed world, not the player. */
export function enemyFlightSpeed(type:WaveType){
 switch(type){
 case 'flypast':return 53;
 case 'crossfire':return -15;
 case 'intercept':return -13;
 case 'pincer':return -22;
 case 'squad':return -27;
 case 'heavy':return -34;
 case 'vee':return -28;
 }
}
/** Simple look-ahead lead to avoid shooting purely at the old player position. */
export function interceptTarget(enemy:V3,player:V3,playerVelocity:V3,projectileSpeed:number):V3{
 const dx=player.x-enemy.x,dy=player.y-enemy.y,dz=player.z-enemy.z;
 const travel=Math.min(1.1,Math.hypot(dx,dy,dz)/Math.max(projectileSpeed,25));
 return {x:player.x+playerVelocity.x*travel*.54,
         y:player.y+playerVelocity.y*travel*.54,
         z:player.z+playerVelocity.z*travel*.54};
}

/** Gold rings follow the manual: 3 for extra shield, 6 for an extra craft. */
export function ringMilestone(total:number):'shield'|'life'|null {
 if(!Number.isInteger(total)||total<=0)return null;
 if(total%6===0)return 'life';
 if(total%6===3)return 'shield';
 return null;
}
