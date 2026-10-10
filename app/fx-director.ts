import type {Game,GameEvent} from './sim.ts';

/** Central visual priority, strictly separate from collision/game state. */
export type FxMoment='ambient'|'combat'|'facility'|'nova'|'boss'|'boss-finish'|'warp';
export interface FxMix {
 readonly moment:FxMoment;
 readonly density:number;
 readonly intensity:number;
 readonly crowded:boolean;
 readonly showFlybys:boolean;
 readonly showAmbientStructures:boolean;
 readonly showBossArchitecture:boolean;
 readonly showWarpArchitecture:boolean;
 readonly cameraRollCap:number;
 readonly cameraZoomCap:number;
 readonly activeAge:number;
}
export const FX_MIX_LIMITS={
 bulletCrowd:38,enemyCrowd:17,
 quietDensity:.23,normalDensity:.56,openDensity:.82,
 maxGameplayRoll:.028,maxGameplayZoom:1.045,
 maxWarpRoll:.30,maxWarpZoom:1.16,
 maxConcurrentShowpieces:3,
 facilityCueSeconds:1.9,novaCueSeconds:1.35,bossFinishSeconds:2.5
} as const;

type Cue={kind:'facility'|'nova'|'boss-finish';start:number;duration:number;priority:number};
/**
 * One owner for priorities, not six independent visual systems deciding when
 * to cover the fight with rings. Pure presentation: never edits Game or uses RNG.
 */
export class FxDirector {
 private cue:Cue|null=null;
 private clock=0;
 private lastStage=-1;
 private lastMoment:FxMoment='ambient';
 event(e:GameEvent){
  if(e.type==='stage'){this.cue=null;return;}
  let next:Omit<Cue,'start'>|null=null;
  if(e.type==='fieldcollapse'||e.type==='fieldclear')next={kind:'facility',priority:2,duration:FX_MIX_LIMITS.facilityCueSeconds};
  else if(e.type==='nova')next={kind:'nova',priority:3,duration:FX_MIX_LIMITS.novaCueSeconds};
  else if(e.type==='bosskill')next={kind:'boss-finish',priority:4,duration:FX_MIX_LIMITS.bossFinishSeconds};
  if(!next)return;
  const pending=this.cue&&this.clock-this.cue.start<this.cue.duration;
  if(pending&&this.cue!.priority>next.priority)return;
  this.cue={...next,start:this.clock};
 }
 plan(g:Game,reduced=false,performance=false):FxMix{
  this.clock=g.visualTime;
  if(this.lastStage!==g.stage){this.lastStage=g.stage;this.cue=null;}
  const age=this.cue?Math.max(0,this.clock-this.cue.start):999;
  if(this.cue&&age>=this.cue.duration)this.cue=null;
  const active=!!this.cue&&age<this.cue.duration;
  const boss=!!g.boss&&!g.boss.dead;
  const crowded=g.bullets.length>=FX_MIX_LIMITS.bulletCrowd||
    g.enemies.filter(e=>!e.dead).length>=FX_MIX_LIMITS.enemyCrowd;
  const moment:FxMoment=g.state==='transition'?'warp':
    active&&this.cue!.kind==='boss-finish'?'boss-finish':
    boss?'boss':active?this.cue!.kind:
    g.state==='playing'?'combat':'ambient';
  const quiet=crowded||performance||reduced||moment==='boss'||moment==='boss-finish';
  const density=reduced?0:performance||crowded?FX_MIX_LIMITS.quietDensity:
    moment==='combat'?FX_MIX_LIMITS.normalDensity:
    moment==='ambient'?FX_MIX_LIMITS.openDensity:.33;
  const strength=active?Math.max(0,1-age/this.cue!.duration):0;
  this.lastMoment=moment;
  return {
   moment,density,intensity:strength,crowded,
   showFlybys:!reduced&&!performance&&!crowded&&!boss&&moment==='combat',
   showAmbientStructures:!quiet&&moment==='combat',
   showBossArchitecture:!reduced&&boss&&moment==='boss',
   showWarpArchitecture:!reduced&&moment==='warp',
   cameraRollCap:reduced?0:moment==='warp'?FX_MIX_LIMITS.maxWarpRoll:FX_MIX_LIMITS.maxGameplayRoll,
   cameraZoomCap:reduced?1:moment==='warp'?FX_MIX_LIMITS.maxWarpZoom:FX_MIX_LIMITS.maxGameplayZoom,
   activeAge:active?age:0
  };
 }
 diagnostics(){return {moment:this.lastMoment,cue:this.cue?.kind??null,clock:this.clock,budget:FX_MIX_LIMITS};}
}
