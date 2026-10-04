import type {Game,GameEvent} from './sim.ts';
import {animationClockRunning,playerPose} from './motion.ts';

export interface Impact {x:number;y:number;age:number;life:number;size:number;color:number;}
export interface Echo {x:number;y:number;age:number;life:number;roll:number;}
/** Decorative history is bounded and never changes combat, RNG or player input. */
export class CombatMotion {
  impacts:Impact[]=[];echoes:Echo[]=[];private lastEcho=-1;
  event(e:GameEvent){
    if(e.type==='stage'){this.impacts=[];this.echoes=[];this.lastEcho=-1;return;}
    if(!['hit','nova','resonance','phase','damage'].includes(e.type))return;
    const large=e.type==='nova'||e.type==='resonance'||e.type==='phase';
    this.impacts.push({x:e.x??0,y:e.y??0,age:0,life:large?.48:.28,size:large?e.type==='nova'?7:4.5:e.type==='damage'?2.0:1.35,color:e.color??(e.type==='damage'?0xffb566:0x8cecff)});
    if(this.impacts.length>24)this.impacts.shift();
  }
  update(g:Game,dt:number,reduced=false){
    if(!animationClockRunning(g))return;
    for(const p of this.impacts)p.age+=dt;this.impacts=this.impacts.filter(p=>p.age<p.life);
    for(const e of this.echoes)e.age+=dt;this.echoes=this.echoes.filter(e=>e.age<e.life);
    if(!reduced&&g.state==='playing'&&g.hull>0&&(g.overdrive>0||Math.abs(g.player.vx)>11)&&g.visualTime-this.lastEcho>=.08&&dt>0){
      this.lastEcho=g.visualTime;this.echoes.push({x:g.player.x,y:g.player.y,age:0,life:.42,roll:playerPose(g).roll});if(this.echoes.length>6)this.echoes.shift();
    }
  }
  diagnostics(){return {impacts:this.impacts.length,echoes:this.echoes.length};}
}
