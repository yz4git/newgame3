import {CombatMotion} from './combat-motion.ts';
import {livingMaps,playerMap} from './visual-assets.ts';
import {atlasFrame} from './surface-motion.ts';
import type {Game,GameEvent} from './sim.ts';

export class CanvasCombatEffects {
  motion=new CombatMotion();
  event(e:GameEvent){this.motion.event(e);}
  step(g:Game,dt:number,reduced=false){this.motion.update(g,dt,reduced);}
  drawEchoes(c:CanvasRenderingContext2D){
    for(const e of this.motion.echoes){c.save();c.translate(e.x,e.y);c.rotate(e.roll);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=(1-e.age/e.life)*.12;c.drawImage(playerMap.image,-1.55,-2.125,3.1,4.25);c.restore();}
  }
  drawImpacts(c:CanvasRenderingContext2D){
    const im=livingMaps.impact.image,w=im.width/2,h=im.height/2;
    for(const p of this.motion.impacts){const life=p.age/p.life,frame=atlasFrame(p.age,p.life),size=p.size*(.5+life*.75);c.save();c.translate(p.x,p.y);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=(1-life)*.85;c.drawImage(im,frame%2*w,Math.floor(frame/2)*h,w,h,-size/2,-size/2,size,size);c.restore();}
  }
  diagnostics(){return this.motion.diagnostics();}
}
