import type {Game} from './sim.ts';
export const SECTOR_SPECTACLES=[
 {name:'METEOR FRACTURE',kind:'fragments',color:0xc99eff,fx:0,spin:1.45,radius:3.2},
 {name:'ABYSSAL SURGE',kind:'wake',color:0x6ce7ff,fx:1,spin:.72,radius:3.6},
 {name:'CITADEL ARRAY',kind:'lattice',color:0x72baff,fx:3,spin:1.2,radius:3.5},
 {name:'ICE PRISM STORM',kind:'prism',color:0xbbf3ff,fx:11,spin:-1.05,radius:3.05},
 {name:'RELIC AWAKENING',kind:'sigils',color:0x87ffca,fx:9,spin:-.65,radius:3.4},
 {name:'FURNACE PRESSURE',kind:'meltdown',color:0xff9561,fx:8,spin:1.5,radius:3.2},
] as const;
export interface EventBeacon {x:number;y:number;scale:number;angle:number;alpha:number;}
/** Shared math for GPU and Canvas, independent from RNG, combat or wall-clock time. */
export function missionBeacons(g:Game):{style:typeof SECTOR_SPECTACLES[number];pieces:EventBeacon[]}|null{
 const m=g.sectorMission;
 if(!m.active||g.mode!=='campaign')return null;
 const n=g.nodes.find(n=>n.id===m.targetId&&!n.dead);
 if(!n)return null;
 const style=SECTOR_SPECTACLES[g.stage];
 const elapsed=n.life-m.timeLeft,progress=Math.max(0,Math.min(1,elapsed/n.life));
 const pieces:EventBeacon[]=[];
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3+g.visualTime*style.spin*(i%2?.44:.27);
  const radius=style.radius*(1+progress*.12);
  pieces.push({
   x:n.x+Math.cos(a)*radius,y:n.y+Math.sin(a)*radius*.65,
   scale:1.0+(i%3)*.25+.25*Math.sin(g.visualTime*2+i),
   angle:a+(style.kind==='lattice'?Math.PI/4:0),
   alpha:(.26+.14*Math.sin(g.visualTime*3+i))*(1-.3*progress)
  });
 }
 return {style,pieces};
}
