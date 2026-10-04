import {STAGES} from './stages.ts';
import {noise} from './bg-map.ts';
import {wrap} from './motion.ts';

export function hasSurface(stage:number){return ['ocean','ice','jungle','lava'].includes(STAGES[stage].environment);}
/** Waves are sampled in absolute surface coordinates. Scroll, pause and retry share one clock. */
export function surfaceSample(stage:number,x:number,y:number,t:number){
  const env=STAGES[stage].environment,amp=env==='ocean'?1:env==='jungle'?.48:env==='ice'?.22:.32;
  const a=x*.56+y*.26-t*1.15,b=x*-.32+y*.64+t*1.47,c=x*1.14+y*.48-t*2.2;
  const height=amp*(Math.sin(a)*.22+Math.sin(b)*.10+Math.sin(c)*.035);
  const dx=amp*(Math.cos(a)*.22*.56-Math.cos(b)*.10*.32+Math.cos(c)*.035*1.14);
  const dy=amp*(Math.cos(a)*.22*.26+Math.cos(b)*.10*.64+Math.cos(c)*.035*.48);
  return {height,dx,dy,u:Math.sin(b)*.013*amp,v:Math.sin(a)*.018*amp,light:1+Math.sin(a)*.13+Math.cos(b)*.07};
}
export function surfaceFlow(stage:number,t:number,distance:number){
  const env=STAGES[stage].environment,speed=env==='lava'?.010:env==='jungle'?.026:.013;
  return {u:wrap(t*.0035,1),v:wrap(distance*.72/32+t*speed,1),lightU:wrap(-t*.014,1),lightV:wrap(distance*.72/32-t*.020,1)};
}
export function surfaceCrests(stage:number,t:number,distance:number,reduced=false){
  const env=STAGES[stage].environment;if(env!=='ocean'&&env!=='jungle'&&env!=='ice')return [];
  const centre=Math.floor(distance*.72/10),result=[];
  for(let row=centre-4;row<=centre+4;row++)for(let col=0;col<2;col++){
    const seed=noise(row,col,stage+211),age=wrap(t*.22+seed*3.1,1),swell=Math.sin(age*Math.PI);
    const x=(col?1:-1)*(2.2+noise(row,col,92)*8),y=row*10+noise(row,col,57)*5-distance*.72+age*2.3;
    const s=surfaceSample(stage,x,y+distance*.72,t);
    result.push({x,y,z:s.height,width:3.6+seed*4.2,height:.75+swell*.7,angle:(seed-.5)*.65,alpha:(reduced?.12:.24)*swell*swell*(env==='ocean'?1:env==='jungle'?.35:.22)});
  }return result;
}
/** Bounded vent pulses, synchronized with absolute scenery rather than wall-clock timers. */
export function ventPulse(index:number,t:number){const age=wrap(t*.18+index*.29,1);return {age,alpha:Math.sin(age*Math.PI)**2,size:.65+age*1.4,frame:Math.min(3,Math.floor(age*4))};}
export function atlasFrame(age:number,life:number){return Math.min(3,Math.max(0,Math.floor(age/life*4)));}
export function waterfallPose(t:number,index:number){return {flow:wrap(t*.54+index*.19,1),width:1+Math.sin(t*2.4+index)*.055,opacity:.34+Math.sin(t*2.1+index)*.065};}
export function wakePose(t:number,index:number){const age=wrap(t*.45+index/3,1);return {age,y:1.7+age*5,width:2.3+age*3.2,height:.65+age*1.1,alpha:Math.sin(age*Math.PI)*.30};}
export function cloudPose(index:number,t:number,distance:number){return {x:(index%2?1:-1)*(17+Math.sin(t*.13+index)*3),y:wrap(index*37-distance*(index<2?1.38:.16),126)-63,angle:Math.sin(t*.09+index)*.07,opacity:.12+Math.sin(t*.17+index)*.025};}
