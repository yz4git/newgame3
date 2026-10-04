/** Absolute world coordinates: tile art repeats, the composed stage map never wraps. */
export const TILE=4;
export const CHIP_SIZE=256;
export const ATLAS_COLS=8;
export const CHIP_TYPES=12;
export const VARIANTS=4;
export function noise(x:number,y:number,seed=0){let n=Math.imul(x+71,374761393)^Math.imul(y+317,668265263)^Math.imul(seed+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function fortressVariant(stage:number,row:number){const region=Math.floor(Math.max(0,row)/9);return (Math.floor(noise(row,stage,41)*8)+region)%8;}
export function zoneAt(stage:number,distance:number){
  const zones=stage===0?['harbor','city','garden','spaceport','defense']:stage===1?['debris','crystal','wreck','gate','sanctum']:['intake','foundry','coolant','reactor','heart'];
  const limits=stage===0?[44,112,160,234]:stage===1?[56,126,204,276]:[62,144,224,306];
  return zones[limits.filter(v=>distance>=v).length];
}
export function chipAt(stage:number,column:number,row:number,far=false){
  const v=Math.floor(noise(column,row,stage)*4),x=column*4,y=row*4,z=zoneAt(stage,y);
  let kind=0;
  if(far){kind=stage===1?(noise(column,row,12)>.88?7:0):0;}
  else if(stage===0){
    const coast=-6+Math.sin(y*.027)*3;
    if(z==='harbor')kind=x<coast?0:column===0?3:noise(column,row,3)>.48?5:1;
    if(z==='city')kind=column===-1||column===3?3:row%9===3?4:noise(column,row,4)>.30?2:noise(column,row,4)>.18?5:noise(column,row,4)>.07?1:6;
    if(z==='garden')kind=Math.abs(column)<2?6:column===-3?3:2;
    if(z==='spaceport')kind=Math.abs(column)<2?9:Math.abs(column)===2?1:5;
    if(z==='defense')kind=Math.abs(column)<2?1:noise(column,row,6)>.5?8:2;
  }else if(stage===1){
    kind=0;
    const gap=Math.sin(y*.033)*3;
    if(Math.abs(x-gap)>5&&noise(column,row,2)>.32)kind=z==='crystal'||z==='sanctum'?7:z==='wreck'?10:11;
    if(z==='gate'&&Math.abs(column)>1)kind=1;
    if(row===51||row===52)kind=10;
  }else{
    const channel=z==='coolant'?Math.abs(column)<2:column===-2||column===3;
    kind=channel?0:noise(column,row,5)>.58?8:1;
    if(z==='intake'&&!channel)kind=10;
    if(z==='foundry'&&!channel)kind=column%2===0?5:8;
    if(z==='reactor'&&!channel)kind=8;
    if(z==='heart'&&!channel)kind=11;
  }
  return kind*VARIANTS+v;
}
export interface Landmark {distance:number;x:number;kind:'port'|'garden'|'gate'|'reactor'|'wreck';scale:number;}
export const LANDMARKS:Landmark[][]=[
  [{distance:24,x:5,kind:'port',scale:.8},{distance:84,x:-5,kind:'port',scale:1.05},{distance:143,x:2,kind:'garden',scale:1},{distance:198,x:5,kind:'port',scale:1.25},{distance:272,x:0,kind:'gate',scale:1.25}],
  [{distance:32,x:-8,kind:'wreck',scale:.9},{distance:106,x:6,kind:'garden',scale:1},{distance:168,x:-3,kind:'wreck',scale:1.4},{distance:252,x:0,kind:'gate',scale:1.35},{distance:324,x:0,kind:'reactor',scale:1.2}],
  [{distance:30,x:7,kind:'port',scale:1},{distance:100,x:-5,kind:'reactor',scale:.85},{distance:182,x:5,kind:'port',scale:1.1},{distance:268,x:0,kind:'reactor',scale:1.35},{distance:355,x:0,kind:'gate',scale:1.4}],
];
export function stageDistance(time:number){return Math.max(0,time)*4.4;}
