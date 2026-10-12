import {easeReveal} from './scenery-transitions.ts';

export const SPECTACLE_TIMING={warning:1.1,breach:3.6,impact:5.8,settle:9.0} as const;
export type SpectaclePhase='approach'|'warning'|'action'|'aftermath';
const c=(x:number)=>Math.max(0,Math.min(1,x));
/** Pure analytic timeline: stable across dropped frames, pause, screenshot seeks
 * and stage restart. Art-only, no game state, RNG or hitboxes. */
export function stageSpectaclePose(stage:number,act:number,elapsed:number){
 const t=Math.max(0,elapsed);
 const [warning,breach,impact,settle]=Object.values(SPECTACLE_TIMING);
 const anticipation=easeReveal((t-warning)/1.4)*(1-easeReveal((t-breach)/1.5));
 const motion=easeReveal((t-breach)/(impact-breach));
 const strike=c(1-Math.abs(t-impact)/.90);
 const falling=easeReveal((t-impact)/3.2);
 const lingering=falling*(1-easeReveal((t-12)/6));
 const phase:SpectaclePhase=t<warning?'approach':t<breach?'warning':t<settle?'action':'aftermath';
 const duration=18.2;
 // Stage motifs vary: the port surges, citadel locks, glacier shears,
 // roots bloom, forge hammers and asteroid machinery crushes rock.
 const distinctiveness=[.94,1.08,1.00,.92,.84,1.15][stage]*
  [1,.94,1.10][act];
 return {
  phase,anticipation,action:motion,impact:strike*strike,
  fallout:falling,afterglow:lingering,gateOpen:motion,
  intensity:distinctiveness,active:elapsed>=-1&&elapsed<duration,
  t,elapsed
 };
}
