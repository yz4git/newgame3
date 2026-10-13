import * as T from 'three/webgpu';
import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {easeReveal} from './scenery-transitions.ts';
import {worldClock} from './motion.ts';
import {stageSpectaclePose} from './stage-spectacle-timeline.ts';
import {StageSpectacleParticles} from './stage-spectacle-particles.ts';
import {buildEpicSet,animateEpicSet,type EpicSet} from './epic-setpieces.ts';
import {EMPTY_FILM_CUE,type FilmCue} from './film-lighting.ts';
import {episodeFlightPose} from './flight-route.ts';

export const STAGE_SEQUENCE_IDS=[
 ['ORE CANYON RUPTURE','LEVIATHAN MINING SHIP','ORBITAL STATION BREAKUP'],
 ['TIDAL LOCK BREACH','PELAGIC CARRIER FLYOVER','ABYSSAL DREADNOUGHT'],
 ['CITADEL IRIS OPENING','GRAVITY DOCK ASCENT','BASTION CORE BREACH'],
 ['GLACIER FAULTLINE','CASCADE AVALANCHE','BOREALIS OBSERVATORY'],
 ['ANCIENT ROOT ARCHES','COLOSSUS AWAKENING','SANCTUARY BRIDGE COLLAPSE'],
 ['CALDERA ERUPTION','TITAN FORGE STRIKE','CRUCIBLE MELTDOWN']
] as const;
const timing=[.13,.43,.72] as const;
type Chapter=EpicSet&{root:T.Group;id:string;act:number;particles:StageSpectacleParticles;ceiling:number;};
const bounds=new T.Box3();

function construct(stage:number,act:number):Chapter{
 const set=buildEpicSet(stage,act),root=new T.Group();
 root.name='one-time-stage-episode-'+stage+'-'+act;
 set.moving.name='episode-moving-part';set.secondary.name='episode-secondary-part';
 root.add(set.still,set.moving,set.secondary);
 // Measure the entire animated envelope once. No frame-dependent correction:
 // a surfacing hull must really rise, and falling wreckage must keep falling.
 let ceiling=-Infinity;
 for(let tick=0;tick<=96;tick++){
  const elapsed=tick*.25,flight=episodeFlightPose(stage,act,elapsed);
  root.rotation.set(flight.rx,flight.ry,flight.rz);
  animateEpicSet(set,stage,act,stageSpectaclePose(stage,act,elapsed));
  root.updateMatrixWorld(true);
  bounds.setFromObject(root);ceiling=Math.max(ceiling,bounds.max.z);
 }
 const particles=new StageSpectacleParticles(stage,act);
 particles.root.scale.set(1.6,1.6,1);
 particles.root.position.z=ceiling-1;
 root.add(particles.root);
 return {...set,root,id:STAGE_SEQUENCE_IDS[stage][act],act,particles,ceiling};
}

export class StageSequences3D{
 readonly root=new T.Group();
 private chapters:Chapter[]=[];
 private stage=-1;
 private activeIds:string[]=[];
 private activePhases:{id:string;phase:string;impact:number;fragments:number}[]=[];
 private cue:FilmCue={...EMPTY_FILM_CUE};
 private presence=0;
 constructor(){this.root.name='stage-authored-nonrepeating-cinematics';}
 private setStage(stage:number){
  if(this.stage===stage)return;
  for(const c of this.chapters){
   for(const group of[c.still,c.moving,c.secondary])group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
   for(const mat of c.materials)mat.dispose();c.particles.dispose();
  }
  this.root.clear();this.chapters=[];this.stage=stage;
  for(let act=0;act<3;act++){
   const chapter=construct(stage,act);chapter.root.visible=false;
   this.root.add(chapter.root);this.chapters.push(chapter);
  }
 }
 draw(g:Game,dt:number,reduced=false,performance=false,readability=0){
  this.setStage(g.stage);
  this.activeIds=[];this.activePhases=[];this.cue={...EMPTY_FILM_CUE};this.presence=0;
  this.root.visible=g.mode==='campaign'&&g.state!=='result';
  if(!this.root.visible)return;
  const duration=STAGES[g.stage].duration,clock=worldClock(g);
  for(const c of this.chapters){
   const beat=duration*timing[c.act],elapsed=clock-beat;
   // A continuous, one-way flyover of a 35–58 m structure. Long noses enter
   // before their centre; fade is finished before the action reaches the screen.
   const opacity=easeReveal((elapsed+4)/3)*(1-easeReveal((elapsed-16)/5));
   c.root.visible=opacity>.002&&!reduced;
   if(!c.root.visible)continue;
   const phase=stageSpectaclePose(g.stage,c.act,elapsed),flight=episodeFlightPose(g.stage,c.act,elapsed);
   c.root.position.set(flight.x,flight.y,-c.ceiling-1.15);
   c.root.rotation.set(flight.rx,flight.ry,flight.rz);
   animateEpicSet(c,g.stage,c.act,phase);
   for(const mat of c.materials){
    mat.opacity=opacity;
    mat.color.copy(mat.userData.filmColor).multiplyScalar(1-readability*.22);
    mat.emissiveIntensity=mat.userData.filmEmission*(1-readability*.55);
   }
   c.particles.draw(phase,opacity,performance,reduced,readability);
   const fx=c.particles.diagnostics();
   this.activeIds.push(c.id);
   this.activePhases.push({id:c.id,phase:phase.phase,impact:phase.impact,fragments:fx.fragments});
   const weight=opacity*easeReveal((elapsed+.5)/3)*(1-easeReveal((elapsed-12)/5));
   this.presence=Math.max(this.presence,weight);
   if(weight>this.cue.weight)this.cue={impact:phase.impact,anticipation:phase.anticipation,afterglow:phase.afterglow,elapsed,weight};
  }
 }
 impactPulse(){return Math.max(0,...this.activePhases.map(x=>x.impact));}
 filmCue(){return this.cue;}
 sceneryPresence(){return this.presence;}
 soundMoments(){return this.activePhases.filter(x=>x.phase==='warning'||(x.phase==='action'&&x.impact>.5));}
 diagnostics(){
  let solidMeshes=0,triangles=0,activeDraws=0;
  this.root.traverse(o=>{if(o instanceof T.Mesh){
   if(!Array.isArray(o.material)&&o.material.depthWrite)solidMeshes++;
   triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
  }});
  for(const c of this.chapters)if(c.root.visible)c.root.traverse(o=>{if(o instanceof T.Mesh&&o.visible)activeDraws++;});
  return {stage:this.stage,activeEpisodes:this.activeIds,activePhases:this.activePhases,
   availableIds:STAGE_SEQUENCE_IDS[this.stage],stageSpecific:true,loops:0,
   cinematic:{solidMeshes,triangles,activeDraws,beveled:true,attachedDetails:true,
    maximumSpan:Math.max(...this.chapters.map(c=>c.span)),articulatedJoints:this.chapters.reduce((n,c)=>n+c.joints.length,0),filmCue:this.cue}};
 }
}
