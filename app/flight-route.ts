import {STAGES} from './stages.ts';
import {easeReveal} from './scenery-transitions.ts';

type Key={at:number;x:number;bank:number;side:number;pitch:number;lift:number;name:string};
const key=(at:number,x:number,bank:number,side:number,pitch:number,lift:number,name:string):Key=>({at,x,bank,side,pitch,lift,name});
/** Authored location changes. A turn belongs to a place, not an endlessly
 * oscillating camera. All distances use the same clock as the campaign. */
export const FLIGHT_ROUTES=[
 [key(0,0,0,0,10,12,'ORBITAL APPROACH'),key(.16,-19,-.40,-8,-6,-3,'QUARRY DIVE'),key(.34,22,.48,9,5,6,'REFINERY TURN'),key(.52,7,.16,4,-12,-4,'MINING SHIP PURSUIT'),key(.72,-17,-.43,-8,-4,1,'STATION UNDERPASS'),key(.9,4,.20,5,8,9,'DEFENCE ORBIT'),key(1,0,0,0,13,14,'ORBITAL EXIT')],
 [key(0,0,0,0,12,10,'COASTAL APPROACH'),key(.16,22,.44,8,-3,-3,'BREAKWATER DESCENT'),key(.34,-25,-.52,-9,7,5,'HARBOUR BANK'),key(.52,-5,-.14,-4,-11,-4,'FLEET OVERFLIGHT'),key(.72,20,.46,8,-2,2,'DEEP WATER TURN'),key(.9,2,.08,2,9,9,'COMMAND ISLAND'),key(1,0,0,0,14,14,'OCEAN EXIT')],
 [key(0,0,-.12,-3,13,10,'CITY ORBIT'),key(.16,-22,-.52,-9,-4,-2,'IRIS INSERTION'),key(.34,24,.56,10,-10,-4,'CITADEL SPIRAL'),key(.52,9,.20,5,-15,-2,'GRAVITY SHAFT'),key(.72,-20,-.48,-8,-5,3,'CORE APPROACH'),key(.9,0,0,0,7,8,'DEFENCE VAULT'),key(1,0,.18,3,14,15,'CITADEL ESCAPE')],
 [key(0,0,0,0,12,12,'POLAR APPROACH'),key(.16,17,.38,7,-12,-5,'CHASM DROP'),key(.34,-23,-.48,-9,-5,-1,'FRACTURE BANK'),key(.52,-6,-.16,-4,8,6,'AVALANCHE CLIMB'),key(.72,19,.42,8,-7,-2,'OBSERVATORY DESCENT'),key(.9,0,0,0,9,10,'POLAR GATE'),key(1,0,0,0,14,14,'GLACIAL EXIT')],
 [key(0,0,0,0,8,8,'RIVER APPROACH'),key(.16,-19,-.42,-8,-10,-4,'ROOT ARCH DIVE'),key(.34,23,.48,9,5,4,'CANOPY TURN'),key(.52,3,.10,3,-12,-3,'SANCTUARY ORBIT'),key(.72,-20,-.46,-8,-4,1,'BRIDGE DESCENT'),key(.9,0,0,0,7,8,'TEMPLE COURT'),key(1,0,.12,2,14,13,'RELIC EXIT')],
 [key(0,0,0,0,12,11,'CALDERA APPROACH'),key(.16,21,.46,8,-11,-4,'LAVA DESCENT'),key(.34,-24,-.54,-9,3,4,'FOUNDRY BANK'),key(.52,-4,-.12,-3,-14,-3,'HAMMER UNDERPASS'),key(.72,19,.46,8,-8,-1,'CRUCIBLE INSERTION'),key(.9,0,0,0,7,9,'CORE CHAMBER'),key(1,0,-.18,-3,15,15,'FOUNDRY ESCAPE')]
] as const;

function sample(stage:number,progress:number){
 const keys=FLIGHT_ROUTES[stage],p=Math.max(0,Math.min(1,progress));
 let index=0;while(index<keys.length-2&&p>keys[index+1].at)index++;
 const a=keys[index],b=keys[index+1],t=easeReveal((p-a.at)/(b.at-a.at));
 const mix=(field:'x'|'bank'|'side'|'pitch'|'lift')=>a[field]+(b[field]-a[field])*t;
 return {centre:mix('x'),bank:mix('bank'),eyeX:mix('side'),eyeY:mix('pitch'),eyeZ:mix('lift'),section:a.name,index};
}
export function flightCentre(stage:number,distance:number){return sample(stage,distance/(STAGES[stage].duration*4.4)).centre;}
export function flightFrame(stage:number,time:number,pressure=0,reduced=false,enabled=true){
 const progress=Math.max(0,Math.min(1,time/STAGES[stage].duration)),route=sample(stage,progress);
 const motion=reduced||!enabled?0:1-Math.max(0,Math.min(1,pressure))*.65;
 return {...route,progress,distance:Math.max(0,time)*4.4,
  bank:route.bank*motion,eyeX:route.eyeX*motion,eyeY:route.eyeY*motion,eyeZ:route.eyeZ*motion,
  lookX:route.eyeX*.10*motion,lookY:route.eyeY*.05*motion};
}
export type FlightFrame=ReturnType<typeof flightFrame>;

export function episodeFlightPose(stage:number,act:number,elapsed:number){
 const beat=STAGES[stage].duration*[.13,.43,.72][act];
 const route=flightFrame(stage,beat+elapsed),t=Math.max(0,elapsed);
 const approach=Math.max(0,Math.min(1,(t-1)/10));
 return {x:Math.sin(t*.17+stage*.7)*(act===1?5:2.5)+(stage===0&&act===1?-6+approach*10:0),
  y:46-elapsed*6.5,rx:Math.sin(t*.12+stage*.53)*.15,
  ry:Math.sin(t*.15+stage*.41+act)*.22,
  rz:route.bank*.48+(stage===0&&act===1?-.24:stage===1&&act===1?.14:stage===4&&act===1?-.06:0)};
}
