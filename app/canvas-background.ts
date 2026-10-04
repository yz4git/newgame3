import {FortressBackground} from './fortress.ts';
import {meshSprite} from './canvas-art.ts';
import {LANDMARKS,stageDistance,zoneAt,rowScenery} from './bg-map.ts';
import {makeCloud} from './bg-art.ts';
import {planetMap,terrainMaps} from './visual-assets.ts';
import {STAGES} from './stages.ts';
import {Game} from './sim.ts';

/** CPU view caches the same textured meshes, rather than rebuilding a flat map. */
export class CanvasFortressBackground {
  private fortress=new FortressBackground();private cloud=makeCloud();private distance=0;private stage=0;
  private planet?:HTMLCanvasElement;private assets=new Map<string,ReturnType<typeof meshSprite>>();
  private cached(key:string,model:()=>Parameters<typeof meshSprite>[1],pixels=32){let asset=this.assets.get(key);if(!asset){asset=meshSprite(key,model(),pixels);this.assets.set(key,asset);}return asset;}
  private asset(c:CanvasRenderingContext2D,asset:ReturnType<typeof meshSprite>,x:number,y:number,scale=1){if(!asset.width)return;c.save();c.translate(x,y);c.scale(scale,-scale);c.drawImage(asset.canvas,asset.left,-asset.top,asset.width,asset.height);c.restore();}
  private planetCanvas(){
    if(this.planet)return this.planet;const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const c=canvas.getContext('2d')!;
    c.beginPath();c.arc(384,384,350,0,Math.PI*2);c.clip();c.drawImage(planetMap.image,0,0,768,768);
    const night=c.createLinearGradient(0,0,768,768);night.addColorStop(0,'#071327f2');night.addColorStop(.35,'#072657a0');night.addColorStop(.65,'#07152900');night.addColorStop(1,'#00051290');c.fillStyle=night;c.fillRect(0,0,768,768);
    c.strokeStyle='#80caff';c.lineWidth=5;c.beginPath();c.arc(384,384,350,0,Math.PI*2);c.stroke();this.planet=canvas;return canvas;
  }
  draw(c:CanvasRenderingContext2D,g:Game){
    this.stage=g.stage;this.distance=g.state==='title'?18+g.visualTime*1.4:stageDistance(g.time);
    const env=STAGES[g.stage].environment;
    if(env==='fortress'){c.save();c.translate(-14,2-this.distance*.018);c.scale(1,-1);c.drawImage(this.planetCanvas(),-24,-24,48,48);c.restore();}
    if(env==='asteroids'){c.save();c.scale(1,-1);c.drawImage(terrainMaps.nebula.image,-16,-30,32,60);c.restore();}
    if(['ocean','ice','jungle','lava'].includes(env)){
      const offset=this.distance*.72%32;
      c.save();c.scale(1,-1);for(let i=-2;i<=2;i++)c.drawImage((env==='lava'?terrainMaps.lava:env==='ice'?terrainMaps.ice:terrainMaps.ocean).image,-16,i*32+offset,32,32);
      c.fillStyle=env==='ice'?'#072944a6':env==='jungle'?'#073a2bc2':env==='lava'?'#29090633':'#063f6320';c.fillRect(-16,-48,32,96);c.restore();
    }
    c.save();c.globalAlpha=.5;
    for(let i=0;i<7;i++)this.asset(c,this.cached('environment-far-'+g.stage+'-'+i,()=>this.fortress.getFar(g.stage,i),20),(i%2?1:-1)*14,((i*13-this.distance*.3)%91+91)%91-45,.6);
    c.globalAlpha=1;const centre=Math.floor(this.distance/8);
    for(let row=centre-4;row<=centre+5;row++){
      const layout=rowScenery(g.stage,row),v=layout.variant,template=()=>this.fortress.getTemplate(g.stage,v);
      const asset=this.cached('environment-'+g.stage+'-'+v,()=>template().getObjectByName('terrain')??template());this.asset(c,asset,0,row*8-this.distance);
      if(layout.installations&&STAGES[g.stage].environment!=='fortress'){
        const equipment=this.cached('equipment-'+g.stage+'-'+v,()=>template().getObjectByName('installations')!);c.save();c.translate(layout.shift,row*8-this.distance);c.scale(1,layout.stretch);this.asset(c,equipment,0,0);c.restore();
      }
    }
    for(let i=0;i<LANDMARKS[g.stage].length;i++){const entry=LANDMARKS[g.stage][i],y=entry.distance-this.distance;if(Math.abs(y)>36)continue;this.asset(c,this.cached('environment-landmark-'+g.stage+'-'+i,()=>this.fortress.getLandmark(g.stage,i)),entry.x,y);}
    c.globalAlpha=.13;for(let i=0;i<4;i++){const x=(i%2?1:-1)*18,y=((i*37-this.distance*(i<2?1.38:.16))%126+126)%126-63;c.drawImage(this.cloud,x-15,y-13,30,26);}c.restore();
  }
  diagnostics(){const env=STAGES[this.stage].environment,fluid=['ocean','ice','jungle','lava'].includes(env);return {technique:'TEXTURED 3D BG CHIPS / CPU CACHE',environment:env,zone:zoneAt(this.stage,this.distance),distance:Math.round(this.distance),layers:fluid?5:4,speeds:[.30,1,1.38,.16],surfaceSpeed:fluid?.72:0,landmarks:LANDMARKS[this.stage].length};}
}
