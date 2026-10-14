import {STAGES} from './stages.ts';
import {easeReveal} from './scenery-transitions.ts';

type Key={at:number;x:number;bank:number;side:number;pitch:number;lift:number;name:string};
const key=(at:number,x:number,bank:number,side:number,pitch:number,lift:number,name:string):Key=>({at,x,bank,side,pitch,lift,name});
/** Authored location changes. A turn belongs to a place, not an endlessly
 * oscillating camera. All distances use the same clock as the campaign. */
export const FLIGHT_ROUTES=[
 [key(0,0,.08,2,8,14,'LUNAR DEBRIS APPROACH'),key(.16,-16,-.28,-6,4,9,'SOLAR ARRAY DRIFT'),key(.34,21,.54,10,10,15,'ORBITAL SALVAGE TURN'),key(.52,8,.30,6,-3,8,'MINING SHIP PURSUIT'),key(.72,-19,-.48,-9,5,10,'BROKEN HABITAT ORBIT'),key(.9,3,.16,4,12,15,'DEFENCE ORBIT'),key(1,0,0,0,13,15,'ORBITAL EXIT')],
 [key(0,0,0,0,-3,-6,'OPEN SEA APPROACH'),key(.16,15,.12,3,-7,-8,'OFFSHORE ISLANDS'),key(.34,-18,-.20,-4,-4,-7,'HARBOUR LOW PASS'),key(.52,-4,-.06,-2,-8,-9,'FLEET OVERFLIGHT'),key(.72,13,.17,4,-5,-6,'OCEAN CONVOY TURN'),key(.9,1,.04,1,1,-1,'COMMAND ISLAND'),key(1,0,0,0,8,5,'OCEAN EXIT')],
 [key(0,0,-.12,-3,8,5,'NIGHT CITY INSERTION'),key(.16,-22,-.46,-9,-8,-5,'IRIS INSERTION'),key(.34,24,.58,10,-14,-6,'SKYSCRAPER SPIRAL'),key(.52,8,.12,4,-15,-4,'GRAVITY SHAFT'),key(.72,-20,-.52,-9,-9,-2,'ELEVATED INTERCHANGE'),key(.9,0,0,0,3,6,'DEFENCE VAULT'),key(1,0,.18,3,12,14,'CITADEL ESCAPE')],
 [key(0,0,0,0,13,13,'POLAR RIDGE APPROACH'),key(.16,12,.16,4,-15,-9,'CREVASSE DESCENT'),key(.34,-16,-.26,-5,-11,-6,'GLACIER WALL PASS'),key(.52,-5,-.08,-2,12,11,'AVALANCHE CLIMB'),key(.72,15,.22,5,-12,-5,'OBSERVATORY DESCENT'),key(.9,0,0,0,8,9,'POLAR GATE'),key(1,0,0,0,14,14,'GLACIAL EXIT')],
 [key(0,0,0,0,-3,-5,'MANGROVE APPROACH'),key(.16,-17,-.30,-6,-9,-7,'ROOT ARCH THREAD'),key(.34,20,.39,7,-6,-5,'CANOPY WEAVE'),key(.52,2,.07,2,-10,-7,'WATERFALL SANCTUARY'),key(.72,-18,-.36,-7,-5,-4,'VINE BRIDGE DESCENT'),key(.9,0,0,0,4,4,'TEMPLE COURT'),key(1,0,.12,2,11,10,'RELIC EXIT')],
 [key(0,0,0,0,12,15,'CALDERA RIM APPROACH'),key(.16,20,.40,7,-12,-6,'VOLCANIC DROP'),key(.34,-23,-.50,-9,7,9,'RADIAL FURNACE ORBIT'),key(.52,-3,-.08,-2,-14,-4,'HAMMER UNDERPASS'),key(.72,19,.48,8,-9,-3,'CRUCIBLE INSERTION'),key(.9,0,0,0,11,14,'THERMAL PULL UP'),key(1,0,-.18,-3,15,17,'FOUNDRY ESCAPE')]
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
 const speeds=[5.9,7.1,6.4,5.7,5.8,6.3],drift=stage===1?.75:stage===4?2.3:act===1?5:2.5;
 const liftIn=easeReveal((t-1)/5),recede=easeReveal((t-10)/7);
 return {x:Math.sin(t*.17+stage*.7)*drift+(stage===0&&act===1?-9+approach*15:0),
  y:46-elapsed*speeds[stage],depth:-(1-liftIn)*[11,3,7,9,4,8][stage]-recede*[5,2,4,6,3,9][stage],
  rx:stage===1?.025:Math.sin(t*.12+stage*.53)*(stage===3?.23:.15),
  ry:Math.sin(t*.15+stage*.41+act)*(stage===1?.055:stage===2?.28:.22),
  rz:route.bank*(stage===1?.20:.48)+(stage===0&&act===1?-.24:stage===1&&act===1?.08:stage===4&&act===1?-.06:0)};
}
