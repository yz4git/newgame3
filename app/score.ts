import asteroids from './soundtracks/asteroids-v8.mp3?url';
import ocean from './soundtracks/ocean-v8.mp3?url';
import fortress from './soundtracks/fortress-v8.mp3?url';
import ice from './soundtracks/ice-v8.mp3?url';
import jungle from './soundtracks/jungle-v8.mp3?url';
import lava from './soundtracks/lava-v8.mp3?url';
import title from './soundtracks/title-v8.mp3?url';
import boss from './soundtracks/boss-v8.mp3?url';
import type {State} from './sim.ts';
export const scoreUrls=[asteroids,ocean,fortress,ice,jungle,lava,title,boss];
export const scoreNames=['Orbital Pulse','Blue Squadron','Citadel Circuit','Prismatic Flight','Emerald Mechanism','Foundry Pressure','The Last Signal','Reactor Pursuit'];
export function scoreFor(state:State,stage:number,boss:boolean){return state==='paused'?-1:state==='title'||state==='result'?6:boss?7:stage;}
