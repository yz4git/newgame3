import type {Game,Enemy,Boss,Kind} from './sim.ts';
import {STAGES} from './stages.ts';
import {ENCOUNTERS,encounterTimes} from './encounter-design.ts';
import {WEAPON_BALANCE} from './player-balance.ts';

export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
export const wrap=(v:number,length:number)=>((v%length)+length)%length;
export const presentationState=(g:Game)=>g.state==='paused'?g.resumeState:g.state;
export interface ShipPose {mode:string;roll:number;bank:number;flex:number;thrust:number;charge:number;recoil:number;turret:number;rotor:number;glow:number;}
/** Pose follows the simulation clock; rendering never advances combat or consumes its RNG. */
export function playerPose(g:Game):ShipPose{
  const t=g.visualTime,p=g.player,boost=g.overdrive>0,launch=presentationState(g)==='playing'&&g.time<2.6;
  return {mode:g.hull<=0?'wreck':boost?'overdrive':p.focus?'focus':launch?'launch':Math.abs(p.vx)>3?'bank':'cruise',
    roll:clamp(-p.vx*.0105,-.30,.30),bank:clamp(p.vx*.025,-.46,.46),flex:p.focus?.13:boost?.82:launch?1-smooth(g.time/2.6):.35,
    thrust:boost?1.65:p.focus?.65:1+clamp(p.vy/35,-.3,.35),charge:boost?1:p.focus?.55:0,
    recoil:Math.pow(clamp(g.shotTimer/WEAPON_BALANCE[g.weapon].interval),4),turret:0,rotor:t*8,glow:boost?1.4:1};
}
export function enemyPose(e:Enemy,p:{x:number;y:number}):ShipPose{
  let vx=e.kind==='dart'?Math.cos(e.age*1.5+e.phase)*3.3:e.kind==='fighter'?Math.cos(e.age*1.1+e.phase)*1.32:e.kind==='weaver'?Math.cos(e.age*.85)*.94:e.kind==='drone'&&e.pattern===1?Math.cos(e.age)*1.75:0;
  if(e.pattern===4)vx=-Math.sign(e.origin)*Math.sin((18-e.y)/7*.78)*4.2;
  if(e.kind==='interceptor'&&e.pattern<4)vx=Math.cos(e.age*1.7+e.phase)*4.08;
  if(e.kind==='bomber')vx=Math.cos(e.age*.55+e.phase)*.3575;
  if(e.kind==='corvette')vx=Math.cos(e.age*.6+e.phase)*.48;
  if(e.kind==='sentinel')vx=Math.cos(e.age*1.3+e.phase)*2.21;
  if(e.pattern===5)vx=-e.origin*Math.sin(e.age*.75)*.75;
  if(e.pattern===6)vx=Math.cos(e.age*.95+e.phase)*1.9;
  const charge=e.charging?smooth(1-e.shoot/.48):0;
  const turret=e.ground?Math.atan2((e.charging?e.aimX:p.x)-e.x,-((e.charging?e.aimY:p.y)-e.y)):0;
  return {mode:e.flash>0?'hit':e.recoil>0?'fire':e.charging?'charge':e.age<.8?'deploy':e.kind==='weaver'?'spin':e.kind==='strider'?'walk':e.kind==='sentinel'?'hover':e.kind==='interceptor'?'sweep':e.kind==='bomber'?'glide':e.kind==='corvette'?'patrol':'cruise',
    roll:e.ground?0:clamp(vx*.035,-.27,.27),bank:e.ground?0:clamp(vx*.055,-.38,.38),
    flex:e.kind==='carrier'?.5+.5*Math.sin(e.age*2):e.kind==='sentinel'?.3+charge*.65+.12*Math.sin(e.age*3):e.kind==='bomber'?.35+charge*.35:charge*.85+.16*Math.sin(e.age*2+e.phase),
    thrust:e.kind==='dart'||e.kind==='interceptor'?1.4:e.kind==='bomber'?1.2:.85+Math.sin(e.age*9+e.phase)*.10,charge,recoil:clamp(e.recoil/.24),turret,
    rotor:e.age*(e.kind==='weaver'?2.5:7)+e.phase,glow:e.hp/e.maxHp<.35?.75+Math.sin(e.age*24)*.25:1};
}
export function bossPose(b:Boss){
  const entry=smooth(b.age/3),charge=b.warning>0?clamp(1-b.warning/2.05):b.beam>0?1:0;
  return {mode:b.dead?'collapse':b.age<3?'deploy':b.rest?'exposed':b.phase>=2?'enraged':charge>0?'charge':'attack',
    deploy:entry,open:b.rest?1:charge*.45,charge,recoil:clamp(b.recoil/.24),rotor:b.age*(b.rest?1.2:b.phase>=2?4:2.5),glow:b.rest?1.4:b.phase>=2?1.15:.8};
}
export const WORLD_CUES=[
  {speaker:'ESCORT / LYRA',intro:'環状基地を突破。星核の信号を追え。',middle:'前方に大型の残骸。編隊を逃さず撃ち抜こう。',feature:'ORBITAL DEBRIS'},
  {speaker:'BRIDGE / MIRA',intro:'海上基地に接近。輸送艦の間を抜ける。',middle:'制圧艦が出港した。補給機を確保して迎撃。',feature:'OCEAN OPERATIONS'},
  {speaker:'CONTROL / ORION',intro:'要塞内へ進入。防衛炉を破壊して道を開け。',middle:'封鎖ゲートが起動。星核の守りを崩そう。',feature:'DEFENCE GRID'},
  {speaker:'SCOUT / LYRA',intro:'氷峡谷へ降下。吹雪の奥に熱源を確認。',middle:'氷晶群を通過。極地守護艦が接近中。',feature:'GLACIAL FRONT'},
  {speaker:'ANALYST / MIRA',intro:'密林の古代遺跡。星核に反応している。',middle:'環状遺跡が覚醒。防衛機の砲台を狙おう。',feature:'RELIC AWAKENING'},
  {speaker:'CONTROL / ORION',intro:'兵器工場の最深部。星核を取り戻せ。',middle:'中枢炉の出力が上昇。最後の守りを突破。',feature:'FOUNDRY OVERLOAD'},
] as const;
export function worldClock(g:Game){return g.state==='title'?g.visualTime:g.time+(presentationState(g)==='transition'?clamp(3.5-g.transitionTime,0,3.5):g.state==='result'&&g.won&&g.boss?.dead&&g.mode==='campaign'?3.5:0);}
export function stageCue(g:Game){
  const time=g.time,cue=WORLD_CUES[g.stage],boss=g.boss;
  if(g.state!=='playing')return null;
  if(boss&&!boss.dead&&boss.age<3)return {kind:'boss',key:'boss-'+boss.id,title:'HOSTILE SIGNATURE',text:STAGES[g.stage].boss,progress:smooth(boss.age/3)};
  const mini=g.encounter;if(mini&&!mini.dead&&mini.age<3)return {kind:'boss',key:'mid-'+mini.id,title:'MIDBOSS INBOUND',text:ENCOUNTERS[g.stage].mini,progress:smooth(mini.age/3)};
  const eventTime=encounterTimes(g.stage,STAGES[g.stage].duration).event;
  if(g.encounterSeen.stage&&time>=eventTime&&time<eventTime+4.5&&!boss&&!mini)return {kind:'radio',key:'event-'+g.stage,title:ENCOUNTERS[g.stage].event,text:ENCOUNTERS[g.stage].hint,progress:clamp((time-eventTime)/4.5)};
  if(time<2.6)return {kind:'intro',key:'intro-'+g.stage,title:'SECTOR '+String(g.stage+1).padStart(2,'0'),text:STAGES[g.stage].name,progress:smooth(time/2.6)};
  const middle=STAGES[g.stage].duration*.68;
  if(time>=5&&time<10.6)return {kind:'radio',key:'radio-a-'+g.stage,title:cue.speaker,text:cue.intro,progress:clamp((time-5)/5.6)};
  if(time>=middle&&time<middle+5.6&&!boss)return {kind:'radio',key:'radio-b-'+g.stage,title:cue.speaker,text:cue.middle,progress:clamp((time-middle)/5.6)};
  return null;
}
export function animationClockRunning(g:Game){return g.state==='playing'||g.state==='transition'||g.state==='title';}

/** Normalized cutout coordinates. Central hulls remain fixed; only limbs and panels deform. */
export function skinWarp(kind:Kind,x:number,y:number,t:number,flex:number):[number,number]{
 if(kind==='strider'){const limb=smooth((Math.abs(x)-.16)/.21)*smooth((Math.abs(y)-.06)/.27),stride=Math.sin(t*7+(x*y>0?0:Math.PI));return [x+Math.sign(x)*Math.cos(t*7+(x*y>0?0:Math.PI))*.028*limb,y+stride*.046*limb];}
 if(kind==='sentinel'){const outer=smooth((Math.hypot(x,y)-.13)/.25),open=(flex*.12+Math.sin(t*2.3)*.012)*outer;return [x*(1+open),y*(1+open)];}
 if(kind==='bomber'){const wing=smooth((Math.abs(x)-.14)/.31);return [x*(1-flex*.055*wing),y+wing*(Math.sin(t*2.1)*.012-flex*.035)];}return [x,y];
}
