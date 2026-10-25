/**
 * NOVA STRIKE – NEW independent console-style 3D shooting simulation.
 * Pure, deterministic game rules are separated from Three.js presentation.
 * Inspired by on-rails/all-range shooter mechanics; original missions and assets.
 */
export type Mode='corridor'|'all-range';
export type Phase='title'|'intro'|'combat'|'boss'|'clear'|'route'|'gameover'|'ending'|'pause';
export type V3={x:number;y:number;z:number};
export type Mission={id:number;name:string;description:string;scene:number;mode:Mode;duration:number;boss:string;difficulty:number;next:number[]};
export const MISSIONS:readonly Mission[]=[
  {id:0,name:'OUTER PERIMETER',description:'衛星軌道の防衛線',scene:0,mode:'corridor',duration:55,boss:'STATION BREAKER',difficulty:1,next:[1,2]},
  {id:1,name:'BLUE CURRENT',description:'海上突入と艦隊防衛',scene:1,mode:'corridor',duration:61,boss:'TIDAL DREADNOUGHT',difficulty:1,next:[3,4]},
  {id:2,name:'CITY UNDER SIEGE',description:'都市上空・全方位戦',scene:2,mode:'all-range',duration:56,boss:'SKY CITADEL',difficulty:2,next:[4,3]},
  {id:3,name:'GLASS FRONTIER',description:'氷海峡谷の突破',scene:3,mode:'corridor',duration:64,boss:'ICE JAVELIN',difficulty:2,next:[5]},
  {id:4,name:'EMERALD DESCENT',description:'高密度森林の回廊',scene:4,mode:'corridor',duration:64,boss:'TEMPLE SENTINEL',difficulty:3,next:[5]},
  {id:5,name:'CRUCIBLE ZERO',description:'決戦・全方位空間',scene:5,mode:'all-range',duration:68,boss:'CRUCIBLE OVERMIND',difficulty:3,next:[]}
] as const;
export const V=(x=0,y=0,z=0):V3=>({x,y,z});
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*clamp(t,0,1);
export const length=(p:V3)=>Math.hypot(p.x,p.y,p.z);
export const dist=(a:V3,b:V3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export const normalize=(p:V3):V3=>{const n=length(p)||1;return V(p.x/n,p.y/n,p.z/n)};
export const sub=(a:V3,b:V3)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
export const add=(a:V3,b:V3)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
export const mul=(p:V3,k:number)=>V(p.x*k,p.y*k,p.z*k);
export const seed=(n:number)=>{const t=Math.sin(n*127.13+31.71)*43758.5453;return t-Math.floor(t)};
export function routeCenter(scene:number,z:number):V3 {
 const d=-z,scale=scene===4?1.35:1;
 return V(
 (scene===0?(Math.sin(d*.0021)*9.8+Math.sin(d*.006)*3.8):Math.sin(d*.0015+scene*1.3)*5.5+Math.sin(d*.0031+scene)*2.4)*scale,
 Math.sin(d*.0018+scene*.66)*1.7+Math.cos(d*.0032+scene)*1.15,0);
}
export function laneLimit(x:number,y:number){return V(clamp(x,-9.4,9.4),clamp(y,-6.7,7.8),0);}
export type WaveType='vee'|'crossfire'|'squad'|'intercept'|'pincer'|'heavy'|'flypast';
export type Beat={at:number;type:WaveType;count:number;altitude:number;elite:boolean};
const kinds:WaveType[]=['vee','crossfire','squad','intercept','pincer','heavy','flypast'];
export function scriptWaves(mission:Mission):Beat[]{
 if(mission.mode==='all-range'){
  return [4,10,17,24,32,39,45].map((at,i)=>({at,type:kinds[(i+mission.id)%kinds.length],count:3+(i%3),altitude:i%3,elite:i===3||i===5}));
 }
 const times=mission.id===0
  ? [2.0,5.5,9,12.5,16.1,19.3,43.2,46.8,50]
  : [2.4,6.7,11.2,15.6,20.3,25,30,34.5,39,44,49,54];
 return times.filter(at=>at<mission.duration-3)
 .map((at,i)=>({at,type:kinds[(i+mission.id*2)%kinds.length],count:mission.id===0?4+(i%3):3+(i%3),altitude:i%3,elite:i===4||i===7||i===12}));
}
export function formation(type:WaveType,index:number,count:number,age:number):V3{
 const mid=index-(count-1)/2;
 switch(type){
 case 'vee':return V(mid*3,-Math.abs(mid)*1.9,Math.abs(mid)*7);
 case 'crossfire':return V(mid*4,Math.sin(index*2.1)*2.8,Math.floor(index/2)*8);
 case 'squad':return V(mid*2.5,Math.cos(index*2)*2.2,(index%2)*5);
 case 'intercept':return V(mid*2.1+Math.sin(index+age)*2,Math.sin(age+index)*3.6,(index%2)*3);
 case 'pincer':return V((index%2?1:-1)*(5.2+Math.floor(index/2)*1.5),Math.sin(index)*2,Math.floor(index/2)*6);
 case 'heavy':return V(mid*3.5,Math.cos(index)*1.4,index%2*7);
 case 'flypast':return V(mid*3,Math.sin(index*1.8)*3.1,Math.abs(mid)*9);
 }
}
export function bossPhase(hp:number,max:number){const ratio=hp/Math.max(1,max);return ratio>.66?1:ratio>.32?2:3;}
export function swept(a:V3,b:V3,c:V3,d:V3,r:number){
 const rel=sub(a,c),delta=sub(sub(b,a),sub(d,c));
 const n=delta.x*delta.x+delta.y*delta.y+delta.z*delta.z;
 const t=n>1e-9?clamp(-(rel.x*delta.x+rel.y*delta.y+rel.z*delta.z)/n,0,1):0;
 return length(add(rel,mul(delta,t)))<=r;
}
export const ROLL_SECONDS=.65;
export const ROLL_REUSE=.72;
export const SOMERSAULT_SECONDS=.88;
export const LOCK_CHARGE=.72;
export function deflectDuringRoll(remaining:number){return remaining>.08&&remaining<=ROLL_SECONDS;}
export function routeSelection(mission:Mission,hits:number,wingmenAlive:number,shortcutTaken:boolean){
 if(mission.next.length<=1)return mission.next[0]??-1;
 // More demanding route is unlocked by active performance or a shortcut.
 return shortcutTaken||hits>=12+mission.id*2&&wingmenAlive>=1?mission.next[1]:mission.next[0];
}
export function missionGrade(hits:number,damage:number,wingmenAlive:number){
 const total=hits*65+wingmenAlive*300-damage*90;
 return total>=2200?'S':total>=1350?'A':total>=700?'B':'C';
}
export function clampArena(p:V3,radius=175){
 const d=Math.hypot(p.x,p.z);
 return d>radius?V(p.x*radius/d,p.y,p.z*radius/d):p;
}
