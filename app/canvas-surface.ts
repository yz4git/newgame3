import {STAGES} from './stages.ts';
import {livingMaps,terrainMaps} from './visual-assets.ts';
import {surfaceSample,surfaceFlow,surfaceCrests} from './surface-motion.ts';
import {wrap} from './motion.ts';
const lightPatterns=new WeakMap<CanvasRenderingContext2D,CanvasPattern>();

function strip(c:CanvasRenderingContext2D,im:HTMLImageElement|HTMLCanvasElement,y:number,h:number,x0:number,x1:number,sourceY:number,sourceHeight:number){
  const v=wrap(sourceY/32,1),first=Math.min(sourceHeight,(1-v)*32),dest=first/sourceHeight*h;
  c.save();c.translate(x0,y);c.transform(1,0,(x1-x0)/h,1,0,0);
  c.drawImage(im,0,v*im.height,im.width,first/32*im.height,-16,0,32,dest+.006);
  if(first<sourceHeight)c.drawImage(im,0,0,im.width,(sourceHeight-first)/32*im.height,-16,dest,32,h-dest+.006);
  c.restore();
}
/** Shared waves rendered as bounded texture bands, independent flowing light and organic crests. */
export function drawCanvasSurface(c:CanvasRenderingContext2D,stage:number,t:number,distance:number,reduced=false){
  const env=STAGES[stage].environment,flow=surfaceFlow(stage,t,distance);
  const im=(env==='lava'?terrainMaps.lava:env==='ice'?terrainMaps.ice:livingMaps.swell).image;
  c.save();c.beginPath();c.rect(-16,-48,32,96);c.clip();c.scale(1,-1);
  for(let i=-5;i<5;i++){
    const y=i*6,a=surfaceSample(stage,0,-y+distance*.72,t),b=surfaceSample(stage,0,-y-6+distance*.72,t);
    strip(c,im,y,6,a.u*32,b.u*32,y-flow.v*32-a.v*96,6-(b.v-a.v)*96);
  }
  c.fillStyle=env==='ice'?'#072944a6':env==='jungle'?'#073a2ba6':env==='lava'?'#29090622':'#063f6315';c.fillRect(-16,-48,32,96);
  c.globalCompositeOperation='lighter';const light=livingMaps.caustics.image;
  let pattern=lightPatterns.get(c);if(!pattern){const created=c.createPattern(light,'repeat');if(created){pattern=created;lightPatterns.set(c,created);}}
  for(let layer=0;layer<(reduced?1:2);layer++){
    c.globalAlpha=(env==='lava'?.025:env==='ice'?.035:env==='jungle'?.065:.075)*(layer?.6:1);
    const offset=(layer?flow.lightV:flow.v*.72)*32,x=(layer?flow.lightU:flow.u*2)*32;
    if(pattern){pattern.setTransform(new DOMMatrix([32/light.width,0,0,32/light.height,x,offset]));c.fillStyle=pattern;c.fillRect(-16,-30,32,60);}
  }
  c.restore();
  const crests=surfaceCrests(stage,t,distance,reduced);
  for(const p of crests){if(Math.abs(p.y)>28)continue;c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,-1);c.globalCompositeOperation='lighter';c.globalAlpha=p.alpha;c.drawImage(livingMaps.foam.image,-p.width/2,-p.height/2,p.width,p.height);c.restore();}
  return {clock:t,kind:env,vertices:0,bands:10,crests:crests.length,lightLayers:reduced?1:2,height:surfaceSample(stage,0,distance*.72,t).height,distance};
}
