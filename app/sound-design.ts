/** Original cached effects. Pure synthesis never consumes the combat RNG. */
export const effectDurations={wide:.085,laser:.13,homing:.14,enemy:.105,hit:.075,explosion:.65,heavy:1,nova:1.05,collapse:2,damage:.44,collect:.40,lock:.11,radio:.13,phase:.36,warning:.46,menu:.065,finish:.88} as const;
export type EffectName=keyof typeof effectDurations;
export function effectSamples(name:EffectName,rate:number){
 const length=Math.ceil(effectDurations[name]*rate),data=new Float32Array(length);
 let seed=173+Object.keys(effectDurations).indexOf(name)*7919,low=0,phase=0,peak=0;
 const notes=[523.25,659.25,783.99,1046.5];
 for(let i=0;i<length;i++){
  const t=i/rate,u=t/effectDurations[name];seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
  const white=(seed>>>0)/2147483648-1;low+=(white-low)*.15;
  let y=0,f=100;
  if(['wide','laser','homing','enemy'].includes(name)){
   f=name==='wide'?1400*Math.exp(-t*18)+180:name==='laser'?850-450*u:name==='homing'?460+780*u:260-160*u;
   phase+=2*Math.PI*f/rate;y=(Math.sin(phase+Math.sin(phase*2)*.24)+Math.sin(phase*2)*.20+low*.24)*Math.exp(-u*4.6);
  }else if(['explosion','heavy','nova','collapse'].includes(name)){
   phase+=2*Math.PI*(35+90*Math.exp(-t*13))/rate;
   y=(Math.sin(phase)*.45+low*1.2+(white-low)*Math.exp(-t*30)*.32)*Math.exp(-t*(name==='explosion'?7:3.5));
   if(name==='nova')y+=(Math.sin(t*2*Math.PI*(210+280*u))+white*.18)*Math.sin(Math.PI*u)*Math.exp(-u*2)*.26;
   if(name==='collapse')for(let n=1;n<8;n++){const a=t-n*.19;if(a>=0)y+=(Math.sin(2*Math.PI*(58+n*7)*a)*.26+low*.70)*Math.exp(-a*15);}
  }else if(name==='collect'||name==='finish'){
   const span=name==='collect'?.065:.14,slot=Math.min(3,Math.floor(t/span)),local=t-slot*span,n=notes[slot],gate=Math.min(1,local/.003,slot<3?(span-local)/.010:1);
   y=(Math.sin(2*Math.PI*n*local)+.22*Math.sin(2*Math.PI*n*2*local))*Math.exp(-local*15)*.50*Math.max(0,gate);
  }else if(name==='damage')y=(Math.sin(2*Math.PI*150*t)*.45+low*.65+Math.sin(2*Math.PI*330*t)*.20)*Math.exp(-t*10);
  else if(name==='warning'){const a=t%.23;y=(Math.sin(t*2*Math.PI*880)+Math.sin(t*2*Math.PI*1320)*.2)*Math.min(1,a/.006)*Math.exp(-a*22)*.32;}
  else if(name==='phase'){phase+=2*Math.PI*(360+1300*u*u)/rate;y=(Math.sin(phase)+.2*Math.sin(phase*2)+low*.15)*Math.sin(Math.PI*u)*.48;}
  else {const f=name==='lock'?1600:name==='radio'?1150:name==='hit'?520:900;y=(Math.sin(2*Math.PI*f*t)*.45+low*(name==='radio'?.55:.10))*Math.exp(-u*5);}
  const edge=Math.min(1,t/.002,(effectDurations[name]-t)/.016);data[i]=Math.tanh(y*1.2)*Math.max(0,edge);peak=Math.max(peak,Math.abs(data[i]));
 }
 if(peak>.90)for(let i=0;i<length;i++)data[i]*=.90/peak;
 return data;
}
export const soundDefaults={master:.75,music:.62,effects:.80};
export type SoundBus=keyof typeof soundDefaults;
export function safeVolume(value:number){return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;}
export function stereoPosition(x=0){return Math.max(-.65,Math.min(.65,x/12*.65));}
