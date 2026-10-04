/** Absolute world coordinates: tile art repeats, the composed stage map never wraps. */
import {STAGES} from './stages.ts';
export const TILE=4;
export const CHIP_SIZE=256;
export const ATLAS_COLS=8;
export const CHIP_TYPES=12;
export const VARIANTS=4;
export function noise(x:number,y:number,seed=0){let n=Math.imul(x+71,374761393)^Math.imul(y+317,668265263)^Math.imul(seed+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function fortressVariant(stage:number,row:number){const region=Math.floor(Math.max(0,row)/9);return (Math.floor(noise(row,stage,41)*8)+region)%8;}
export function rowScenery(stage:number,row:number){
  const theme=STAGES[stage],district=theme.limits.filter(limit=>row*8>=limit).length;
  const density=theme.environment==='fortress'?1:theme.environment==='asteroids'?.20+district*.13:theme.environment==='ocean'?.32+district*.09:theme.environment==='ice'?(district===3?.95:.18):theme.environment==='jungle'?.28+district*.12:.48+district*.1;
  return {variant:fortressVariant(stage,row),installations:noise(row,stage,68)<density,shift:(noise(row,stage,79)-.5)*1.3,stretch:.78+noise(row,stage,81)*.37};
}
export function zoneAt(stage:number,distance:number){
  const {zones,limits}=STAGES[stage];
  return zones[limits.filter(v=>distance>=v).length];
}
export function chipAt(stage:number,column:number,row:number,far=false){
  const v=Math.floor(noise(column,row,stage)*4),x=column*4,y=row*4,z=zoneAt(stage,y),env=STAGES[stage].environment;
  let kind=0;
  if(far){kind=env==='asteroids'?(noise(column,row,12)>.88?11:0):0;}
  else if(env==='fortress'){
    const coast=-6+Math.sin(y*.027)*3;
    if(z==='harbor')kind=x<coast?0:column===0?3:noise(column,row,3)>.48?5:1;
    if(z==='city')kind=column===-1||column===3?3:row%9===3?4:noise(column,row,4)>.30?2:noise(column,row,4)>.18?5:noise(column,row,4)>.07?1:6;
    if(z==='garden')kind=Math.abs(column)<2?6:column===-3?3:2;
    if(z==='spaceport')kind=Math.abs(column)<2?9:Math.abs(column)===2?1:5;
    if(z==='defense')kind=Math.abs(column)<2?1:noise(column,row,6)>.5?8:2;
  }else if(env==='asteroids'){
    const gap=Math.sin(y*.033)*3;
    if(Math.abs(x-gap)>5&&noise(column,row,2)>.32)kind=z==='wreckage'?10:11;
    if(z==='orbital-ring'&&Math.abs(column)>1)kind=1;
  }else if(env==='ocean'){
    if(Math.abs(column)>=2&&noise(column,row,3)>.38)kind=z==='fleet'?10:5;
  }else if(env==='ice'||env==='jungle'){
    const edge=5+Math.sin(y*.022)*1.7;
    if(Math.abs(x)>edge)kind=env==='ice'?(z==='research'?5:7):(z==='temple'||z==='sanctuary'?10:6);
  }else if(env==='lava'){
    kind=Math.abs(column)<1?11:Math.abs(column)>=2?(noise(column,row,5)>.48?8:5):0;
  }
  return kind*VARIANTS+v;
}
export interface Landmark {distance:number;x:number;kind:'port'|'garden'|'gate'|'reactor'|'wreck'|'orbital'|'oilrig'|'submarine'|'glacier'|'station'|'temple'|'waterfall'|'furnace'|'bridge';scale:number;}
export const LANDMARKS:Landmark[][]=[
  [{distance:30,x:-8,kind:'orbital',scale:1},{distance:91,x:7,kind:'wreck',scale:.9},{distance:151,x:-6,kind:'port',scale:.8},{distance:214,x:7,kind:'orbital',scale:1.1},{distance:290,x:0,kind:'gate',scale:1.2}],
  [{distance:24,x:8,kind:'oilrig',scale:.95},{distance:87,x:-6,kind:'submarine',scale:1},{distance:160,x:8,kind:'oilrig',scale:1.2},{distance:233,x:-8,kind:'submarine',scale:1.15},{distance:318,x:0,kind:'bridge',scale:1}],
  [{distance:24,x:5,kind:'port',scale:.8},{distance:84,x:-5,kind:'port',scale:1.05},{distance:143,x:2,kind:'garden',scale:1},{distance:224,x:5,kind:'port',scale:1.25},{distance:337,x:0,kind:'gate',scale:1.25}],
  [{distance:26,x:-8,kind:'glacier',scale:1},{distance:97,x:8,kind:'station',scale:1},{distance:166,x:-7,kind:'glacier',scale:1.1},{distance:241,x:7,kind:'station',scale:1.1},{distance:328,x:0,kind:'bridge',scale:1}],
  [{distance:27,x:-7,kind:'waterfall',scale:1},{distance:91,x:6,kind:'temple',scale:1.1},{distance:174,x:-6,kind:'waterfall',scale:1.2},{distance:247,x:6.5,kind:'temple',scale:1.25},{distance:350,x:0,kind:'gate',scale:1.15}],
  [{distance:25,x:8,kind:'furnace',scale:1},{distance:103,x:-7,kind:'furnace',scale:1.1},{distance:186,x:0,kind:'bridge',scale:1},{distance:272,x:8,kind:'furnace',scale:1.2},{distance:371,x:0,kind:'reactor',scale:1.25}],
];
export function stageDistance(time:number){return Math.max(0,time)*4.4;}
