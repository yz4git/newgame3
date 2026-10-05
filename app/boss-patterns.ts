import type {Game,Boss,Bullet} from './sim.ts';
import {bossPartPosition,GAME_SPEED} from './sim.ts';
import {BOSS_ATTACKS} from './encounter-design.ts';

function wing(g:Game,b:Boss,i:number,shot:(x:number,y:number,source:number)=>void){if(b.parts[i]>0){const p=bossPartPosition(b,i);shot(p.x,p.y-1,b.id+i+1);}}
function ring(g:Game,x:number,y:number,count:number,speed:number,gap:number,source:number,extra:Partial<Bullet>={}){
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2,delta=Math.atan2(Math.sin(a-gap),Math.cos(a-gap));if(Math.abs(delta)<.36)continue;g.projectile(x,y,Math.cos(a)*speed,Math.sin(a)*speed,true,1,false,0xffb46d,{source,...extra});}
}
export function bossCoreDamage(g:Game,b:Boss){return b.rest?1.6:g.stage===0&&b.guard>0?.45:1;}
/** Six controllers share only timing, source ownership and safe projectile helpers. */
export function updateBossPattern(g:Game,dt:number){
 const b=g.boss;if(!b||b.dead)return;
 b.age+=dt;b.encounterTime+=dt/GAME_SPEED;b.flash=Math.max(0,b.flash-dt);b.recoil=Math.max(0,b.recoil-dt);
 if(g.mode==='campaign'&&b.encounterTime>=90){g.finish(false,'timeout');return;}
 if(g.mode==='campaign'&&b.encounterTime>=70&&b.encounterTime-dt/GAME_SPEED<70)g.emit('beam',{text:'20 SEC LEFT / ボス制限時間'});
 b.y+=((b.age<3?9.2:9+Math.sin(b.age*.65)*.7)-b.y)*dt*1.9;
 b.x=Math.sin(b.age*.55)*([0,0,1,0,0,1][g.stage]?3.3:2.8);
 if(b.age<3)return;
 const phase=b.hp<b.maxHp*.28?3:b.hp<b.maxHp*.62?2:1;
 if(phase>b.phase){b.phase=phase;b.patternTime=0;b.cycle=-1;g.clearBossThreats();g.invulnerable=Math.max(g.invulnerable,.8);g.emit('phase',{x:b.x,y:b.y,color:0xffae73,value:phase,text:'PHASE 0'+phase+' / ATTACK PATTERN SHIFT'});}
 b.patternTime+=dt;const period=9.6,cycle=Math.floor(b.patternTime/period),elapsed=b.patternTime%period;
 const broken=b.parts.filter(p=>p<=0).length;
 b.rest=elapsed>(g.stage===5?7.0-broken*.55:7.3);b.guard=g.stage===0&&!b.rest&&broken<2?1:0;b.heat=g.stage===5&&!b.rest?Math.min(1,elapsed/6.8)*(1-broken*.24):0;
 b.spread=g.stage===1&&cycle%3===1&&!b.rest?Math.min(1.6,elapsed*1.7):Math.max(0,b.spread-dt*3);
 if(cycle!==b.cycle){
  b.cycle=cycle;b.attack=cycle%3;b.shoot=2.05;g.emit('pattern',{text:BOSS_ATTACKS[g.stage][b.attack]});
  if(b.attack===0){
   if(g.stage===1||g.stage===3||g.stage===4)for(let i=0;i<2;i++)if(b.parts[i]>0)g.addCombatNode('boss',b.id+i+1,i,(i?1:-1)*6.5,8,36+g.stage*4,8.5);
  }
  if(b.attack===2&&g.stage===0)for(let i=0;i<2;i++)wing(g,b,i,(x,y,source)=>g.addThreat(x,y,g.player.x+(i?2:-2),-18,.52,source));
  if(g.stage===2&&(b.attack===0||b.attack===2))for(let i=0;i<2;i++)wing(g,b,i,(x,y,source)=>g.addThreat(x,y,b.attack===0?(i?7:-7):g.player.x+(i?2.6:-2.6),-18,.44,source));
  if(g.stage===3&&b.attack===2)for(let i=0;i<2;i++)wing(g,b,i,(x,y,source)=>g.addThreat(x,y,i?-5:5,-18,.45,source,2.15,1.25));
  if(g.stage===5&&b.attack===1)for(let i=0;i<2;i++)wing(g,b,i,(x,y,source)=>g.addThreat(x,y,x,-18,.60,source,2.2,1.6));
 }
 b.warning=Math.max(0,...g.threats.filter(t=>t.source>=b.id&&t.source<=b.id+2&&!t.dead).map(t=>t.warmup-t.age));b.beam=0;
 if(b.rest){b.shoot=Math.max(.6,b.shoot);return;}b.shoot-=dt;if(b.shoot>0)return;
 const speed=g.difficulty==='casual'?.83:g.difficulty==='expert'?1.14:1,fast=b.phase>1,before=g.bullets.length;b.recoil=.24;
 switch(g.stage){
  case 0:
   if(b.attack===0){const pivot=Math.sin(b.age*.75)*.52;g.fan(b.x,b.y-1.8,broken===2?5:9,6.8,-Math.PI/2+pivot,.17,b.id,0xffc587,pivot*.10);b.shoot=fast?.72:.95;}
   else if(b.attack===1){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.aimed(x,y,8.4,3,.2,s));b.shoot=fast?.82:1.1;}
   else{g.fan(b.x,b.y-2,5,6.3,-Math.PI/2,.37,b.id);b.shoot=1.25;}break;
  case 1:
   if(b.attack===0){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.fan(x,y,4,6.5,-Math.PI/2+(i?.30:-.30),.19,s));b.shoot=fast?.84:1.08;}
   else if(b.attack===1){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>{g.aimed(x,y,4.8,2,.23,s,g.player,2.0);g.bullets.slice(-2).forEach(p=>{if(p.source===s)p.shape='missile';});});b.shoot=1.1;}
   else{for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.fan(x,y,5,6.5,-Math.PI/2+(i?-.42:.42),.2,s));g.aimed(b.x,b.y-2,7,1,.1,b.id);b.shoot=1.3;}break;
  case 2:
   if(b.attack===1){const swing=Math.sin(b.age*.8)*.48;for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.fan(x,y,5,7,-Math.PI/2+swing,.2,s));b.shoot=fast?.78:1.05;}
   else{g.fan(b.x,b.y-2,5,6.0,-Math.PI/2,.30,b.id);b.shoot=1.45;}break;
  case 3:
   if(b.attack===0){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>{for(const a of[-2.65,-.49])g.projectile(x,y,Math.cos(a)*6.2*speed,Math.sin(a)*6.2*speed,true,1,false,0xb7eeff,{source:s,ricochets:1,shape:'diamond'});});b.shoot=fast?.85:1.2;}
   else if(b.attack===1){const offset=Math.sin(b.age*.6)*.5;g.fan(b.x+offset,b.y-2,b.phase===3?8:6,6.3,-Math.PI/2,.26,b.id,0xb7eeff);b.shoot=fast?.84:1.1;}
   else{g.aimed(b.x,b.y-2,6.2,2,.3,b.id);b.shoot=1.4;}break;
  case 4:
   if(b.attack===0){g.aimed(b.x,b.y-2,6.3,3,.23,b.id);b.shoot=1.2;}
   else if(b.attack===1){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.fan(x,y,4,6.1,-Math.PI/2+(i?.44:-.44),.22,s,0xffa4ee,(i?-1:1)*.17));b.shoot=fast?.8:1.1;}
   else{const gap=Math.atan2(g.player.y-b.y,g.player.x-b.x);ring(g,b.x,b.y-1,broken===2?14:20,5.6*speed,gap,b.id);b.shoot=1.6;}break;
  case 5:
   if(b.attack===0){for(let i=0;i<2;i++)wing(g,b,i,(x,y,s)=>g.aimed(x,y,5.2,3,.24,s,g.player,1.7));b.shoot=fast?.8:1.12;}
   else if(b.attack===1){g.fan(b.x,b.y-2,5,5.8,-Math.PI/2,.31,b.id);b.shoot=1.35;}
   else{g.fan(b.x,b.y-2,broken===2?5:9,6.4,-Math.PI/2+Math.sin(b.age)*.3,.2,b.id,0xffbd74);b.shoot=fast?.78:1.02;}break;
 }
 if(b.phase===3)b.shoot*=.86;
 if(g.bullets.length>before)g.emit('enemyshot',{x:b.x,y:b.y-1,source:b.id,kind:'boss'});
}
