import type {Game,Kind} from './sim.ts';
import {STAGES} from './stages.ts';

/** Authored campaign-scale beats. Time is game-world seconds, never screen frames. */
export const WORLD_ALIVE_STAGES=[
 {name:'ASTEROID SIEGE',approach:'QUARRY GATES',bay:'METEOR HANGAR',gate:'MINING LATTICE',boss:'AEGIS ORBITAL CRADLE',escape:'ASTEROID FRACTURE',troops:['interceptor','drone']},
 {name:'PELAGIC ASSAULT',approach:'FLEET PERIMETER',bay:'CARRIER DECK',gate:'FLEET DEFENSE GRID',boss:'LEVIATHAN DRYDOCK',escape:'DOCKS COLLAPSING',troops:['fighter','corvette']},
 {name:'CITADEL BREACH',approach:'OUTER FORTRESS',bay:'CITADEL LAUNCH TUBE',gate:'POWER LATTICE',boss:'HELIX REACTOR VAULT',escape:'CITADEL DECOMPRESSION',troops:['interceptor','lancer']},
 {name:'GLACIER DESCENT',approach:'FROZEN PASS',bay:'CRYSTAL SHAFT',gate:'PRISM ARRAY',boss:'BOREALIS ICE CHAMBER',escape:'GLACIER CALVING',troops:['dart','weaver']},
 {name:'RELIC AWAKENING',approach:'SUNKEN TEMPLE',bay:'ANCIENT PORTAL',gate:'RELIC SEAL',boss:'SERAPH SANCTUARY',escape:'TEMPLE REFORMATION',troops:['sentinel','drone']},
 {name:'FOUNDRY MELTDOWN',approach:'FURNACE APPROACH',bay:'FORGE ASSEMBLY',gate:'PRESSURE NETWORK',boss:'VULCAN CORE FORGE',escape:'MOLTEN CHAIN REACTION',troops:['bomber','strider']}
] as const;
export const WORLD_ALIVE_BUDGET={
 cueStart:.045,firstLaunch:.235,secondLaunch:.685,
 maxExtraEnemies:3,maxActiveEnemies:12,maxLiveBullets:115,
 maxStructuralBeats:4,sourceSideX:5.45,launchY:18.7
} as const;
export interface WorldAliveState{
 stage:number;approach:boolean;launches:[boolean,boolean];launched:number;
 baysOpen:[boolean,boolean];destroyed:[boolean,boolean];escaped:[boolean,boolean];
 bossEntry:boolean;bossPhase:number;wingBroken:[boolean,boolean];bossDefeated:boolean;escape:boolean;lastCue:string;
}
export function initialWorldAlive(stage=0):WorldAliveState{
 return {stage,approach:false,launches:[false,false],launched:0,baysOpen:[true,true],
 destroyed:[false,false],escaped:[false,false],bossEntry:false,bossPhase:0,wingBroken:[false,false],
 bossDefeated:false,escape:false,lastCue:''};
}
export function resetWorldAlive(g:Game){
 g.worldAlive=initialWorldAlive(g.stage);
}
function cue(g:Game,name:string,type:string,x=0,y=14){
 g.worldAlive.lastCue=name;
 g.emit(type,{x,y,size:3.2,color:STAGES[g.stage].color,text:name});
}
/** The actual game's permanent strategic node result opens/shuts physical
 * bays; the next timed hangar launch reacts to that result. No fake targets.
 */
export function reactWorldFacility(g:Game,index:number,outcome:'destroyed'|'escaped'){
 if(g.mode!=='campaign'||g.worldAlive.stage!==g.stage)return;
 if(index<0||index>1)return;
 const s=g.worldAlive,profile=WORLD_ALIVE_STAGES[g.stage];
 s.destroyed[index]=outcome==='destroyed';
 s.escaped[index]=outcome==='escaped';
 s.baysOpen[index]=outcome!=='destroyed';
 cue(g,profile.gate+(outcome==='destroyed'?' / SHUT DOWN':' / ALERT'),outcome==='destroyed'?'worldbreach':'worldalarm',index===0?-5.4:5.4,9);
}
/** Creates visible enemies at the *real* background dock doors rather than
 * decorative craft fading into existence. Limited extras, no new bullet type.
 * Campaign-only so Boss Rush / Caravan balance stays unchanged.
 */
export function updateWorldAlive(g:Game){
 if(g.worldAlive.stage!==g.stage)resetWorldAlive(g);
 if(g.mode!=='campaign'||g.state!=='playing'||g.boss)return;
 const s=g.worldAlive,p=WORLD_ALIVE_STAGES[g.stage],duration=STAGES[g.stage].duration;
 if(!s.approach&&g.time>=duration*WORLD_ALIVE_BUDGET.cueStart){
  s.approach=true;cue(g,p.approach,'worldapproach',0,17);
 }
 for(let index=0;index<2;index++){
  if(s.launches[index]||g.time<duration*(index===0?WORLD_ALIVE_BUDGET.firstLaunch:WORLD_ALIVE_BUDGET.secondLaunch))continue;
  s.launches[index]=true;
  if(!s.baysOpen[index]){
   cue(g,p.bay+' / DISABLED','worldbaydisabled',index===0?-6:6,13);
   continue;
  }
  // Do not overload a busy boss/mission encounter with surprise enemies.
  const allowed=!g.encounter&&!g.sectorMission.active&&g.enemies.filter(e=>!e.dead).length<WORLD_ALIVE_BUDGET.maxActiveEnemies&&g.bullets.length<WORLD_ALIVE_BUDGET.maxLiveBullets;
  if(!allowed){
   cue(g,p.bay+' / HOLD','worldbayhold',index===0?-6:6,13);
   continue;
  }
  const side=index===0?-1:1,x=side*WORLD_ALIVE_BUDGET.sourceSideX;
  const kind=p.troops[index] as Kind;
  const count=index===0?2:WORLD_ALIVE_BUDGET.maxExtraEnemies;
  // The enemy's actual world spawn and its animated hangar mouth match.
  for(let i=0;i<count;i++){
   const enemy=g.spawn(kind,x+side*(i-1)*.47,WORLD_ALIVE_BUDGET.launchY+i*1.25,0,2);
   enemy.shoot=Math.max(enemy.shoot,1.9);
  }
  s.launched+=count;
  cue(g,p.bay+' / LAUNCH','worldlaunch',x,14);
 }
}
export function enterWorldBoss(g:Game){
 if(g.mode!=='campaign')return;
 const s=g.worldAlive;s.bossEntry=true;s.bossPhase=1;
 cue(g,WORLD_ALIVE_STAGES[g.stage].boss+' / OPEN','worldbossentry',0,11);
}
export function updateWorldBoss(g:Game){
 if(g.mode!=='campaign'||!g.boss||g.boss.dead)return;
 const s=g.worldAlive;
 if(!s.bossEntry)enterWorldBoss(g);
 if(s.bossPhase!==g.boss.phase){
  s.bossPhase=g.boss.phase;
  cue(g,WORLD_ALIVE_STAGES[g.stage].boss+' / TRANSFORM','worldbossphase',g.boss.x,g.boss.y);
 }
}
/** Wing failure is driven by the *real* destructible boss part, not
 * a timer; the background reactor physically exposes its corresponding side. */
export function breakWorldBossWing(g:Game,index:number,x:number,y:number){
 if(g.mode!=='campaign'||index<0||index>1||g.worldAlive.wingBroken[index])return;
 g.worldAlive.wingBroken[index]=true;
 cue(g,WORLD_ALIVE_STAGES[g.stage].boss+' / WING '+(index+1)+' DISCONNECTED','worldwingbreak',x,y);
 if(g.worldAlive.wingBroken.every(Boolean))
  cue(g,WORLD_ALIVE_STAGES[g.stage].boss+' / REACTOR EXPOSED','worldcoreexpose',0,y);
}
export function collapseWorldBoss(g:Game){
 if(g.mode!=='campaign')return;
 g.worldAlive.bossDefeated=true;
 cue(g,WORLD_ALIVE_STAGES[g.stage].escape+' / BREAK','worldbossfall',g.boss?.x??0,g.boss?.y??9);
}
export function advanceWorldEscape(g:Game){
 if(g.mode!=='campaign'||!g.worldAlive.bossDefeated||g.worldAlive.escape)return;
 g.worldAlive.escape=true;
 cue(g,WORLD_ALIVE_STAGES[g.stage].escape+' / ESCAPE','worldescape',0,7);
}
