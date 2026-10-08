import type {Game} from './sim.ts';
import type {CombatNode} from './encounter-design.ts';
import {STAGES} from './stages.ts';

/** Six authored late-sector events. Route is chosen by the first strategic objective. */
export const SECTOR_MISSIONS=[
 {name:'METEOR BREACH',jp:'隕石嵐・防衛網突破',safe:'ORBITAL JAMMER',risky:'RAIDER COMMAND',enemy:'interceptor',color:0xc598ff},
 {name:'FLEET INTERCEPT',jp:'空母艦隊・迎撃戦',safe:'FLEET RADAR',risky:'STRIKE FLAGSHIP',enemy:'corvette',color:0x49e4ff},
 {name:'CITADEL LOCKDOWN',jp:'要塞内部・電源遮断',safe:'POWER SWITCH',risky:'RAIL COMMAND',enemy:'lancer',color:0x49baff},
 {name:'PRISM STORM',jp:'氷晶嵐・共鳴装置',safe:'PRISM GATE',risky:'FROST COMMAND',enemy:'sentinel',color:0x9aeaff},
 {name:'RELIC AWAKENING',jp:'古代遺跡・防衛機構',safe:'ANCIENT SEAL',risky:'RELIC OVERSEER',enemy:'strider',color:0x71ffe0},
 {name:'FURNACE MELTDOWN',jp:'工場炉心・最終制圧',safe:'COOLANT VALVE',risky:'FURNACE WARDEN',enemy:'bomber',color:0xff8c38}
] as const;
export type MissionRoute='secure'|'intercept';
export interface SectorMission {
 started:boolean;active:boolean;result:'pending'|'success'|'failed';route:MissionRoute|null;
 stageSuccess:number;stageFailed:number;totalSuccess:number;totalFailed:number;timeLeft:number;
 targetId:number;supportSent:boolean;name:string;
}
export function initialSectorMission():SectorMission{
 return {started:false,active:false,result:'pending',route:null,stageSuccess:0,stageFailed:0,totalSuccess:0,totalFailed:0,timeLeft:0,targetId:0,supportSent:false,name:''};
}
export function resetSectorMission(g:Game){
 const m=g.sectorMission;m.started=false;m.active=false;m.result='pending';m.route=null;
 m.stageSuccess=0;m.stageFailed=0;m.timeLeft=0;m.targetId=0;m.supportSent=false;m.name='';
}
function support(g:Game,route:MissionRoute,round:number){
 const profile=SECTOR_MISSIONS[g.stage];
 if(g.enemies.filter(e=>!e.dead).length>=40)return;
 const count=route==='secure'?2:3;
 for(let i=0;i<count;i++){
  const kind=route==='secure'?'drone':profile.enemy;
  g.spawn(kind,(i-(count-1)/2)*5.2+(round%2?.4:-.4),20+i*1.9);
 }
}
export function startSectorMission(g:Game){
 if(g.mode!=='campaign'||g.sectorMission.started||g.boss)return;
 const m=g.sectorMission,profile=SECTOR_MISSIONS[g.stage];
 const route:MissionRoute=g.battlefield.outcomes[0]==='destroyed'?'secure':'intercept';
 // The authored set piece remains a regular target: player weapons and NOVA both work.
 const before=g.nodes.length;
 g.addCombatNode('mission',0,route==='secure'?1:0,route==='secure'?-2.8:2.8,15.2,
   (route==='secure'?36:48)+g.stage*5,11.6);
 if(g.nodes.length===before)return;
 const node=g.nodes[g.nodes.length-1];
 node.radius=1.6;node.shoot=2.7;
 m.started=true;m.active=true;m.result='pending';m.route=route;m.targetId=node.id;
 m.timeLeft=11.6;m.name=route==='secure'?profile.safe:profile.risky;m.supportSent=false;
 support(g,route,0);
 g.emit('missionstart',{x:node.x,y:node.y,color:route==='secure'?0x70efff:0xffa572,
  text:profile.name+' / '+profile.jp+' · '+m.name+' を破壊せよ'});
}
export function completeSectorMission(g:Game,n:CombatNode){
 const m=g.sectorMission;if(!m.active||n.id!==m.targetId||n.dead)return;
 m.active=false;m.result='success';m.stageSuccess++;m.totalSuccess++;
 n.dead=true;n.hp=0;g.clearSource(n.id,true);
 const reward=(m.route==='secure'?3600:5400)*g.multiplier;
 g.addScore(reward);g.energy=Math.min(100,g.energy+20);
 g.pickup(m.route==='secure'?'repair':'power',n.x,n.y);
 g.emit('explode',{x:n.x,y:n.y,size:3.8,color:0x8ceeff});
 g.emit('missionclear',{x:n.x,y:n.y,size:4.6,color:0x7fffdc,
  text:SECTOR_MISSIONS[g.stage].name+' COMPLETE / BOSS WEAKENED'});
}
export function failSectorMission(g:Game,n:CombatNode){
 const m=g.sectorMission;if(!m.active||n.id!==m.targetId)return;
 m.active=false;m.result='failed';m.stageFailed++;m.totalFailed++;
 n.dead=true;g.clearSource(n.id);
 g.emit('missionfail',{x:n.x,y:n.y,color:0xff806f,
  text:SECTOR_MISSIONS[g.stage].name+' FAILED / BOSS REINFORCED'});
}
export function updateSectorMission(g:Game,dt:number){
 if(g.mode!=='campaign'||g.boss)return;
 const m=g.sectorMission;
 // Delay the final event until the main midboss is gone; otherwise fights overlap unfairly.
 if(!m.started&&g.time>=STAGES[g.stage].duration*.76&&!g.encounter)startSectorMission(g);
 if(!m.active)return;
 const n=g.nodes.find(n=>n.id===m.targetId&&!n.dead);
 if(!n){m.active=false;return;}
 n.age+=dt;n.flash=Math.max(0,n.flash-dt);n.y-=1.55*dt;
 n.x=n.baseX+Math.sin(n.age*.45)*(m.route==='secure'?.55:1.1);
 m.timeLeft=Math.max(0,n.life-n.age);
 if(n.age>=n.life||n.y<-17){failSectorMission(g,n);return;}
 if(n.age>4.5&&!m.supportSent){
  support(g,m.route!,1);m.supportSent=true;
  g.emit('missionsupport',{text:m.route==='secure'?'DEFENSE DRONES / ジャマーを守る敵を排除':'ENEMY REINFORCEMENT / 強襲部隊接近'});
 }
 n.shoot-=dt;
 if(n.age<2.1||n.shoot>0||n.y<g.player.y+4)return;
 const source=n.id;
 if(g.stage===2||g.stage===5)g.addThreat(n.x,n.y,g.player.x,-18,.34,source,2.15,.95);
 else if(g.stage===3)for(const a of[-2.42,-Math.PI/2,-.72])g.projectile(n.x,n.y,Math.cos(a)*6,Math.sin(a)*6,true,1,false,0x9feaff,{source,shape:'diamond'});
 else if(g.stage===4)g.fan(n.x,n.y,5,5.9,-Math.PI/2+Math.sin(n.age)*.18,.23,source,0xd7a5ff);
 else if(m.route==='secure')g.aimed(n.x,n.y,6.1,2,.2,source);
 else g.fan(n.x,n.y,5,6.5,-Math.PI/2,.21,source,0xffb180);
 n.shoot=m.route==='secure'?3.7:3.0;
}
