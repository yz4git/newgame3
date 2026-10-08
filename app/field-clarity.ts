import type {CombatNode} from './encounter-design.ts';
import {FIELD_OPERATIONS,fieldDamagePhase} from './battlefield.ts';
/** Shared visual language between WebGL, Canvas and DOM. Not a background prop. */
export const FIELD_COLORS={intact:0xffd679,cracked:0xff9f62,critical:0xff6269} as const;
export function fieldPresentation(n:CombatNode){
 const phase=fieldDamagePhase(n.hp,n.maxHp);
 const fraction=Math.max(0,Math.min(1,n.hp/Math.max(1,n.maxHp)));
 return {
  phase,ratio:fraction,color:phase===2?FIELD_COLORS.critical:phase===1?FIELD_COLORS.cracked:FIELD_COLORS.intact,
  condition:phase===2?'CORE EXPOSED / 炉心露出':phase===1?'ARMOUR BROKEN / 装甲破損':'DESTROY THIS / 破壊せよ',
  name:FIELD_OPERATIONS[n.stage][n.index].name,
  japanese:FIELD_OPERATIONS[n.stage][n.index].jp,
  /** The structure is embedded in the environment and advances at the same 4.4 units/sec as the background. */
  timeLeft:Math.max(0,8.3-n.age),
  ring:2.02+Math.sin(n.age*4.5)*.09,
  warning:n.age<2.9?1-n.age/2.9:0,
 };
}
export function fieldRewardLabel(destroyed:number,escaped:number){
 if(escaped>0)return '防衛網強化 · 増援接近';
 if(destroyed>=2)return 'BOSS PARTS −15% / 敵弾消去・残骸で防御';
 return '敵弾消去 + 射撃停止 / 2基でボス装甲−15%';
}
