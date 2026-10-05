import {CombatMotion} from './combat-motion.ts';
import {livingMaps,playerMap,finishMaps} from './visual-assets.ts';
import {FinishMotion} from './finish-motion.ts';
import {atlasFrame} from './surface-motion.ts';
import type {Game,GameEvent} from './sim.ts';

export class CanvasCombatEffects {
  motion=new CombatMotion();finish=new FinishMotion();
  event(e:GameEvent){this.motion.event(e);this.finish.event(e);}
  step(g:Game,dt:number,reduced=false){this.motion.update(g,dt,reduced);this.finish.update(g,dt,reduced);}
  drawWaves(c:CanvasRenderingContext2D){for(const p of this.finish.waves){const u=p.age/p.life,size=p.size*(.06+u);c.save();c.translate(p.x,p.y);c.rotate(u*.12);c.scale(1,-1);c.globalAlpha=(1-u)**2*.56;c.globalCompositeOperation='lighter';c.drawImage(finishMaps.shockwave.image,-size/2,-size/2,size,size);c.restore();}}
  drawFragments(c:CanvasRenderingContext2D){const im=finishMaps.debris.image,w=im.width/2,h=im.height/2;for(const p of this.finish.fragments.slice(0,24)){c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,-1);c.globalAlpha=Math.min(1,(1-p.age/p.life)*3);c.drawImage(im,p.frame%2*w,Math.floor(p.frame/2)*h,w,h,-p.size/2,-p.size*.4,p.size,p.size*.8);c.restore();}}
  drawEchoes(c:CanvasRenderingContext2D){
    for(const e of this.motion.echoes){c.save();c.translate(e.x,e.y);c.rotate(e.roll);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=(1-e.age/e.life)*.12;c.drawImage(playerMap.image,-1.55,-2.125,3.1,4.25);c.restore();}
  }
  drawImpacts(c:CanvasRenderingContext2D){
    const im=livingMaps.impact.image,w=im.width/2,h=im.height/2;
    for(const p of this.motion.impacts){const life=p.age/p.life,frame=atlasFrame(p.age,p.life),size=p.size*(.5+life*.75);c.save();c.translate(p.x,p.y);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=(1-life)*.85;c.drawImage(im,frame%2*w,Math.floor(frame/2)*h,w,h,-size/2,-size/2,size,size);c.restore();}
  }
  diagnostics(){return {...this.motion.diagnostics(),...this.finish.diagnostics()};}
}
