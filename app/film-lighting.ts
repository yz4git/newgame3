import {easeReveal,clamp01} from './scenery-transitions.ts';

/** Six photographic lighting setups. These only drive the existing lights;
 * no extra shadow maps, postprocess targets, flashes or gameplay time changes. */
export const FILM_STOCKS=[
 {name:'ECLIPSE / hard vacuum',key:0xffd8b1,rim:0x778fe5,sky:0x617dab,ground:0x101525,fog:0x090f20,exposure:.88,fill:.63,rimPower:2.0,azimuth:-26,near:112,far:236},
 {name:'PELAGIC / sea daylight',key:0xfff1da,rim:0x6ed1dd,sky:0xb5dbe2,ground:0x17455a,fog:0x356b83,exposure:.88,fill:.94,rimPower:1.65,azimuth:22,near:104,far:220},
 {name:'CITADEL / violet night',key:0xc9d9ff,rim:0x9e7ddb,sky:0x7286b8,ground:0x161529,fog:0x10112c,exposure:.88,fill:.72,rimPower:2.4,azimuth:-18,near:91,far:192},
 {name:'BOREALIS / arctic white',key:0xf0f7ff,rim:0x85d5ec,sky:0xc2e6ec,ground:0x2d526a,fog:0x6b99ac,exposure:.86,fill:1.02,rimPower:1.6,azimuth:25,near:96,far:212},
 {name:'RELIC / canopy gold',key:0xffd699,rim:0x4f9781,sky:0xa5c08c,ground:0x25392a,fog:0x254c38,exposure:.89,fill:.81,rimPower:1.8,azimuth:-24,near:82,far:168},
 {name:'CRUCIBLE / lava uplight',key:0xffbf88,rim:0xf46d35,sky:0xa3919d,ground:0x782b17,fog:0x33161b,exposure:.85,fill:.65,rimPower:2.3,azimuth:18,near:96,far:190}
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
  fogNear:stock.near,fogFar:stock.far
 };
}
