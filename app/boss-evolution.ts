import type {Boss,Game} from './sim.ts';
/** Branch outcome is frozen at boss spawn. Caravan & boss rush keep their established balance. */
export type BossForm='standard'|'shattered'|'overcharged';
export const BOSS_FORM_NAMES={
 standard:'CLASSIC / 標準形態',shattered:'SHATTERED / 装甲破砕形態',overcharged:'OVERCHARGED / 兵装強化形態'
} as const;
export const BOSS_FORM_PALETTE={
 standard:0x9cddff,shattered:0x84fff0,overcharged:0xff9b64
} as const;
/** Context is consulted once, before the boss fight starts, never during the fight. */
export function selectBossForm(g:Game):BossForm{
 if(g.mode!=='campaign'||!g.sectorMission.started)return 'standard';
 if(g.sectorMission.result==='success')return 'shattered';
 if(g.sectorMission.result==='failed')return 'overcharged';
 return 'standard';
}
export function bossRestStart(b:Pick<Boss,'form'|'phase'>,stage:number,broken:number):number{
 const base=stage===5?7.0-broken*.55:7.3;
 return Math.max(5.45,base+(b.form==='shattered'?-1.05:b.form==='overcharged'?.45:0));
}
/** Visible armature changes are deliberately small enough to preserve actual hitboxes. */
export function bossMorph(b:Pick<Boss,'form'|'phase'|'age'|'rest'>){
 const phaseBoost=b.phase===3?1:b.phase===2?.6:.25;
 const bloom=b.rest?1:.55+Math.sin(b.age*3.1)*.12;
 if(b.form==='shattered')return {color:0x83ffda,wingDelta:-.32*phaseBoost,petalDelta:.46*phaseBoost,halo:1.4+phaseBoost,glow:bloom*.78,armor:.64,rotation:b.age*.27};
 if(b.form==='overcharged')return {color:0xff9762,wingDelta:.38*phaseBoost,petalDelta:-.12*phaseBoost,halo:1.6+phaseBoost*.55,glow:bloom*1.25,armor:1.13,rotation:-b.age*.38};
 return {color:0xc1eaff,wingDelta:0,petalDelta:0,halo:1.15,glow:bloom*.45,armor:1,rotation:b.age*.17};
}
export function bossFormReadout(b:Pick<Boss,'form'|'phase'>){
 return BOSS_FORM_NAMES[b.form]+' / PHASE '+b.phase;
}
/** Explicitly telegraphed reinforcement lasers: part ownership cancels them on wing destruction. */
export function bossOverchargeVolley(g:Game,b:Boss,cycle:number){
 if(b.form!=='overcharged'||b.phase<2||cycle%2!==1)return 0;
 let created=0;
 for(let i=0;i<2;i++){
  if(b.parts[i]<=0)continue;
  const direction=i===0?-1:1;
  const x=b.x+direction*3.45;
  const dest=Math.max(-8,Math.min(8,g.player.x+direction*2.8));
  g.addThreat(x,b.y-2.2,dest,-17,.32,b.id+i+1,3.1,.70);
  created++;
 }
 if(created)g.emit('bossreinforce',{x:b.x,y:b.y,size:2.5,color:BOSS_FORM_PALETTE.overcharged,text:'OVERCHARGED LASERS / 兵装拡張・回避予告'});
 return created;
}
