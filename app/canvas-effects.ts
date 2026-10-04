import {LANDMARKS,noise,stageDistance} from './bg-map.ts';
import {STAGES} from './stages.ts';
import {worldClock,wrap,presentationState,WORLD_CUES} from './motion.ts';
import {shipSprite} from './canvas-art.ts';
import {terrainMaps,smokeMap} from './visual-assets.ts';
import type {Game} from './sim.ts';
import {SCENES,sceneVisible} from './scenery.ts';

export function canvasGlow(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string,alpha=.6){
  if(size<=0||alpha<=0)return;const grad=c.createRadialGradient(x,y,0,x,y,size);grad.addColorStop(0,color);grad.addColorStop(.25,color+'a0');grad.addColorStop(1,color+'00');c.save();c.globalAlpha=alpha;c.globalCompositeOperation='lighter';c.fillStyle=grad;c.fillRect(x-size,y-size,size*2,size*2);c.restore();
}
export class CanvasStageEffects{
  private stage=0;private clock=0;private ambient=0;private flyover=false;
  draw(c:CanvasRenderingContext2D,g:Game,reduced=false){
    this.stage=g.stage;const env=STAGES[g.stage].environment,t=this.clock=worldClock(g),distance=g.state==='title'?18+t*1.4:stageDistance(t),color='#'+STAGES[g.stage].color.toString(16).padStart(6,'0');
    c.save();c.lineWidth=.045;
    for(const entry of LANDMARKS[g.stage]){
      const y=entry.distance-distance;if(Math.abs(y)>34)continue;c.save();c.translate(entry.x,y);c.scale(entry.scale,entry.scale);
      if(['orbital','gate','temple'].includes(entry.kind)){
        const r=entry.kind==='gate'?5.7:entry.kind==='orbital'?4.7:2.6;c.rotate(t*(entry.kind==='temple'?.5:.18));c.strokeStyle=color;c.globalAlpha=.5;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;canvasGlow(c,Math.cos(a)*r,Math.sin(a)*r,.20,color,.7);}
      }else if(entry.kind==='submarine'){
        c.strokeStyle='#b5eaff';for(let i=0;i<3;i++){const a=wrap(t*.8+i/3,1);c.globalAlpha=(1-a)*.3;c.beginPath();c.ellipse(0,1.8+a*4,1+a*2.2,(1+a*2.2)*.6,0,0,Math.PI);c.stroke();}
      }else if(entry.kind==='furnace'||entry.kind==='reactor'){
        const pressure=.5+.5*Math.sin(t*2);c.fillStyle='#98a1a8';for(const s of[-1,1])c.fillRect(s*1.75-.08,Math.sin(t*2.7)*.55-1.5,.16,3);canvasGlow(c,0,1,2+pressure,'#bfa297',.12+pressure*.06);
      }else if(entry.kind==='waterfall'||entry.kind==='glacier'){
        for(let i=0;i<3;i++)canvasGlow(c,(i-1)*1.5,Math.sin(t*.7+i)*.6,2.6,'#c6eaf4',.08+.04*Math.sin(t*1.3+i));
      }else{
        c.rotate(t*.7);c.globalAlpha=.12;c.fillStyle=color;c.beginPath();c.moveTo(0,0);c.arc(0,0,3.4,Math.PI/2,Math.PI/2+.5);c.closePath();c.fill();
      }c.restore();
    }
    for(const entry of SCENES[g.stage]){if(!sceneVisible(entry,distance))continue;c.save();c.translate(entry.x,entry.distance-distance);c.rotate(entry.angle);if(entry.kind==='artwork'){for(let j=0;j<3;j++)canvasGlow(c,(j-1)*2.8,1+j*.8,.45,color,.3+Math.sin(t*2+j)*.15);if(['lava','ice','jungle'].includes(env))for(let j=0;j<3;j++){const a=wrap(t*.24+j/3,1),w=2.6+a*3.7,h=4+a*4.3;c.save();c.translate((j-1)*3.8,j*.6-1+a*3.1);c.scale(1,-1);c.globalAlpha=Math.sin(a*Math.PI)*(env==='lava'?.21:.10);c.drawImage(smokeMap.image,-w/2,-h/2,w,h);c.restore();}}else if(entry.kind==='crane'){c.fillStyle='#8a6c4a';c.fillRect(Math.sin(t*.55)*3-.25,3.65,.5,.7);}else if(entry.kind!=='array'){c.rotate(t*.7);for(let j=0;j<6;j++){const a=j*Math.PI/3;canvasGlow(c,Math.cos(a)*3.1,Math.sin(a)*3.1,.16,color,.45);}}c.restore();}
    if(env==='jungle'&&!reduced)for(let i=0;i<12;i++){c.save();c.translate((i%2?1:-1)*(10.9+noise(i,g.stage)),wrap(i*5-distance,60)-30);c.rotate(Math.sin(t*.9+i)*.06);c.scale(1,-1);c.globalAlpha=.7;c.drawImage(terrainMaps.canopy.image,-2,-2,4,4);c.restore();}
    const flight=t<16?(t-8)/7:(t-STAGES[g.stage].duration*.62)/7;this.flyover=!reduced&&!g.boss&&presentationState(g)!=='transition'&&flight>0&&flight<1;
    if(this.flyover){c.save();c.globalAlpha=.6;c.translate(-18+flight*36,13-flight*9);c.rotate(-.28);
      for(let i=0;i<3;i++){c.save();c.translate((i-1)*2.9,i===1?2:0);
        if(env==='ocean'||env==='ice'){c.fillStyle='#98acb9';c.beginPath();c.ellipse(0,0,.38,1.1,0,0,Math.PI*2);c.fill();c.save();c.rotate(t*22);c.strokeStyle='#99bdcb';c.lineWidth=.065;c.beginPath();c.moveTo(-1.5,0);c.lineTo(1.5,0);c.moveTo(0,-1.5);c.lineTo(0,1.5);c.stroke();c.restore();}
        else{const a=shipSprite('player');c.rotate(-.58);c.scale(.60,-.60);c.drawImage(a.canvas,a.left,-a.top,a.width,a.height);}c.restore();
      }c.restore();
    }
    this.ambient=reduced?14:env==='ice'?70:env==='lava'?55:42;c.fillStyle=env==='lava'?'#ffc59d':env==='jungle'?'#b2ffd6':'#d7eeff';
    for(let i=0;i<this.ambient;i++){const seed=noise(i,g.stage,94),edge=env==='lava'||env==='asteroids'||env==='jungle',x=edge?(i%2?1:-1)*(7.2+seed*6):seed*27-13.5,y=wrap(noise(i,g.stage*37+13)*54-t*(env==='lava'?-2.2:env==='ice'?4.8:2.1),54)-27,size=.035+seed*.08;c.globalAlpha=.3+Math.sin(t+i)*.1;c.fillRect(x+(reduced?0:Math.sin(t*(.4+seed)+i)*.5),y,size,size*(env==='ice'?2.8:env==='ocean'?8:env==='asteroids'&&i%7===0?6:1.3));}
    c.restore();
  }
  diagnostics(){return {feature:WORLD_CUES[this.stage].feature,clock:this.clock,ambient:this.ambient,mechanisms:9,flyover:this.flyover};}
}
