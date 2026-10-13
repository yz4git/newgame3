import {easeReveal,clamp01} from './scenery-transitions.ts';

/** Six photographic lighting setups. These only drive the existing lights;
 * no extra shadow maps, postprocess targets, flashes or gameplay time changes. */
export const FILM_STOCKS=[
 {name:'ECLIPSE / copper and cobalt',key:0xffd5ac,rim:0x6c92e5,sky:0x95b7d8,ground:0x11141e,fog:0x131c32,exposure:.88,fill:.68,rimPower:2.1,azimuth:-19},
 {name:'PELAGIC / storm silver',key:0xe0f0ff,rim:0x40c9d4,sky:0x9bc7d7,ground:0x112c36,fog:0x163d51,exposure:.86,fill:.77,rimPower:1.8,azimuth:17},
 {name:'CITADEL / tungsten and steel',key:0xffc591,rim:0x629af0,sky:0x829fc9,ground:0x0d1420,fog:0x111e36,exposure:.87,fill:.61,rimPower:2.2,azimuth:-17},
 {name:'BOREALIS / polar blue',key:0xdbefff,rim:0x68c5d7,sky:0xafd7e5,ground:0x122b46,fog:0x284355,exposure:.84,fill:.78,rimPower:1.8,azimuth:21},
 {name:'RELIC / filtered gold',key:0xffd39a,rim:0x54baad,sky:0xa0bdae,ground:0x15261e,fog:0x1b302b,exposure:.90,fill:.66,rimPower:2.0,azimuth:-22},
 {name:'CRUCIBLE / ember and smoke',key:0xffbb86,rim:0x819ccc,sky:0xb49c91,ground:0x281614,fog:0x291c20,exposure:.85,fill:.58,rimPower:2.1,azimuth:18}
] as const;

export interface FilmCue {impact:number;anticipation:number;afterglow:number;elapsed:number;weight:number;}
export const EMPTY_FILM_CUE:FilmCue={impact:0,anticipation:0,afterglow:0,elapsed:0,weight:0};

/** Absolute-time choreography also makes paused frames and review seeks stable. */
export function filmFrame(stage:number,time:number,cue:FilmCue,pressure=0,reduced=false){
 const stock=FILM_STOCKS[stage],quiet=1-clamp01(pressure)*.78;
 const anticipation=cue.anticipation*cue.weight,impact=cue.impact*cue.weight;
 const breath=reduced?0:Math.sin(time*.19+stage*.81)*.018;
 const push=reduced?0:easeReveal((cue.elapsed-1.1)/4.7)*(1-easeReveal((cue.elapsed-7)/4))*cue.weight*quiet;
 return {
  stock,exposure:stock.exposure*(1-impact*.035+breath),
  keyGain:1-anticipation*.08+impact*.12,
  rimGain:1+anticipation*.18+impact*.20,
  fill:stock.fill*(1-anticipation*.08),
  // The directional key sweeps less than 4 degrees. Tangible side faces and
  // moving cast shadows, without a distracting light orbit.
  keyX:stock.azimuth+(reduced?0:Math.sin(time*.10+stage)*1.6),
  keyY:17+stage%3*2,keyZ:25,
  lensPush:push*.018,lensLift:push*3.2,
  lensSide:reduced?0:Math.sin(cue.elapsed*.21+stage*.85)*push*2.8,
  fogNear:72,fogFar:164
 };
}
