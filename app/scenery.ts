import {STAGES} from './stages.ts';
import {noise} from './bg-map.ts';
export type SceneKind='artwork'|'array'|'ribs'|'crater'|'crane'|'spire'|'arch'|'causeway'|'monolith'|'conveyor';
export interface Scene {id:string;kind:SceneKind;distance:number;x:number;width:number;height:number;angle:number;}
const kinds:SceneKind[][]=[['array','ribs','crater'],['crane','causeway','array'],['spire','ribs','arch'],['arch','crater','spire'],['monolith','causeway','arch'],['conveyor','crane','ribs']];
/** Four authored, non-looping set pieces per world, independent of reusable ground chips. */
export const SCENES:Scene[][]=STAGES.map((stage,s)=>[
 {id:'hero-'+s,kind:'artwork',distance:stage.duration*4.4*.49,x:s===1?-4.8:s===4?5.1:(s%2?6:-6),width:s===1?13.5:16,height:s===1?20:18,angle:(s%2?1:-1)*.10},
 ...kinds[s].map((kind,i)=>({id:'set-'+s+'-'+i,kind,distance:stage.duration*4.4*[.15,.71,.91][i],x:i===2?0:(i%2?1:-1)*(7.5-noise(s,i)*2),width:12+noise(s,i,11)*5,height:13+noise(s,i,12)*7,angle:(noise(s,i,13)-.5)*.34}))
]);
export function sceneVisible(scene:Scene,distance:number){return Math.abs(scene.distance-distance)<36+scene.height*.5;}
export function districtStyle(stage:number,distance:number){const index=STAGES[stage].limits.filter(x=>distance>=x).length;return {index,tint:[0xc0d4e8,0x9fa7bc,0x9fb5c4,0xbdc3b0,0xa9b9cc][index],strength:[.10,.08,.05,.09,.14][index]};}
