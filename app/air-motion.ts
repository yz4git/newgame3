import {STAGES} from './stages.ts';
import {wrap} from './motion.ts';
export function airLayers(stage:number,t:number,distance:number,reduced=false){
 const env=STAGES[stage].environment,space=env==='asteroids'||env==='fortress',ice=env==='ice',key=space?'nebula':ice?'aurora':'shafts';
 return [0,1].map(i=>({key,x:Math.sin(t*.06+i*2.7)*((reduced?.4:1)*(ice?4:3))+(i===0?-5:5),y:space?wrap(i*47-distance*.045,92)-46:ice?8+i*18+Math.sin(t*.09+i)*2:wrap(i*32-distance*.05,76)-38,width:space?46:ice?40:42,height:space?40:ice?27:62,angle:Math.sin(t*.07+i)*.04*(reduced?.3:1),opacity:(space?.10:ice?.10:env==='jungle'?.067:env==='lava'?.045:.034)*(i?.65:1)*(1+Math.sin(t*.12+i)*.18),z:space?-26:ice?-7.8:-.7,color:env==='lava'?0xff9855:ice?0xafffee:0xffffff}));
}
