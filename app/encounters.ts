import type {Game} from './sim.ts';
import {STAGES} from './stages.ts';
import {ENCOUNTERS,encounterTimes,threatActive} from './encounter-design.ts';
import {segmentDistance2} from './sim.ts';

export function spawnStageEncounter(g:Game){
 const profile=ENCOUNTERS[g.stage];g.encounterSeen.stage=true;
 const xs=g.stage===4?[-6,0,6]:[-6,6];
 xs.forEach((x,i)=>g.addCombatNode('stage',0,i,x,11+(i%2)*1.8,32+g.stage*3,16));
 if(g.stage===1){g.spawn('corvette',-3,18);g.spawn('corvette',3,21);}
 g.emit('encounter',{text:profile.event+' / '+profile.hint});
}
export function spawnMiniboss(g:Game){
 g.encounterSeen.mini=true;g.clearEncounterSources('stage');
 const hp=140+g.stage*25;
 g.encounter={id:g.nextCombatId(),stage:g.stage,x:0,y:22,hp,maxHp:hp,age:0,shoot:2.3,flash:0,attack:0,cycle:-1,dead:false};
 if(g.stage===2||g.stage===3||g.stage===4)for(let i=0;i<2;i++)g.addCombatNode('mini',g.encounter.id,i,(i?1:-1)*4.8,9,25,22);
 g.emit('midboss',{text:ENCOUNTERS[g.stage].mini+' / '+ENCOUNTERS[g.stage].hint});
}
export function updateEncounters(g:Game,dt:number){
 if(!g.boss&&g.mode==='campaign'){
  const t=encounterTimes(g.stage,STAGES[g.stage].duration);
  if(g.time<STAGES[g.stage].duration){if(!g.encounterSeen.stage&&g.time>=t.event)spawnStageEncounter(g);if(!g.encounterSeen.mini&&g.time>=t.mini)spawnMiniboss(g);}
 }
 const m=g.encounter;
 if(m&&!m.dead){
  m.age+=dt;m.flash=Math.max(0,m.flash-dt);m.y+=(8.8-m.y)*Math.min(1,dt*1.5);m.x=Math.sin(m.age*(g.stage===4?.9:.48))*([3,3.6,2.2,3.4,3.5,2.5][g.stage]);
  if(m.age>=22){g.clearEncounterSources('mini');g.encounter=null;g.emit('encounter',{text:'TARGET WITHDRAWN / 本隊へ進行'});}
  else if(m.age>3){
   const cycle=Math.floor((m.age-3)/6);m.attack=cycle%2;
   if(cycle!==m.cycle){m.cycle=cycle;m.shoot=1.9;if((g.stage===2||g.stage===5)&&m.attack===1)g.addThreat(m.x,m.y-1,g.player.x,-18,.5,m.id);}
   m.shoot-=dt;
   if(m.shoot<=0){
    const count=g.difficulty==='casual'?4:6;
    if(g.stage===0)g.fan(m.x,m.y-1,count,6.4,-Math.PI/2+Math.sin(m.age)*.4,.24,m.id,0xffc58a,.10);
    if(g.stage===1){g.aimed(m.x-1.2,m.y-1,5.5,2,.20,m.id,g.player,1.5);g.aimed(m.x+1.2,m.y-1,5.5,2,.20,m.id,g.player,1.5);}
    if(g.stage===2)g.fan(m.x,m.y-1,5,6.5,-Math.PI/2,.29,m.id);
    if(g.stage===3)for(const a of[-2.6,-Math.PI/2,-.54])g.projectile(m.x,m.y-1,Math.cos(a)*6,Math.sin(a)*6,true,1,false,0xb7eeff,{source:m.id,ricochets:1,shape:'diamond'});
    if(g.stage===4)for(const s of[-1,1])g.fan(m.x+s,m.y-1,4,6.0,-Math.PI/2+s*.4,.2,m.id,0xffa4ee,-s*.14);
    if(g.stage===5)g.aimed(m.x,m.y-1,5.1,5,.19,m.id,g.player,1.5);
    m.shoot=m.hp<m.maxHp*.5?1.15:1.55;g.emit('enemyshot',{x:m.x,y:m.y-1,source:m.id});
   }
  }
 }
 for(const n of g.nodes){
  if(n.dead)continue;n.age+=dt;n.flash=Math.max(0,n.flash-dt);
  if(n.attach==='mini'){if(!g.encounter){n.dead=true;continue;}const a=n.age*.6+n.index*Math.PI;n.x=g.encounter.x+Math.cos(a)*4.3;n.y=g.encounter.y+Math.sin(a)*1.4;}
  else if(n.attach==='boss'){
   const b=g.boss;if(!b||b.dead||b.parts[n.index]<=0){n.dead=true;g.clearSource(n.id);continue;}
   if(g.stage===4){const a=n.age*.9+n.index*Math.PI;n.x=b.x+Math.cos(a)*4.5;n.y=b.y+Math.sin(a)*2.1;}else{n.x=b.x+n.baseX;n.y=b.y-.5;}
  }else{n.x=n.baseX+(g.stage===0?Math.sin(n.age*.6+n.index)*1.2:g.stage===4?Math.sin(n.age*.9+n.index*2)*2:0);n.y=n.baseY-n.age*.46;}
  if(n.age>n.life){n.dead=true;g.clearSource(n.id);continue;}
  n.shoot-=dt;if(n.shoot>0||n.y<g.player.y+3||n.age<(n.attach==='mini'?3.1:1.8))continue;
  if(n.stage===0)g.fan(n.x,n.y,4,6.0,-Math.PI/2+Math.sin(n.age)*.4,.22,n.id,0xffc58a,.10);
  if(n.stage===1)g.aimed(n.x,n.y,6.2,3,.22,n.id);
  if(n.stage===2||n.stage===5)g.addThreat(n.x,n.y,n.x,-18,n.stage===2?.45:.55,n.id,2.05,1.25);
  if(n.stage===3)for(const a of[-2.6,-.54])g.projectile(n.x,n.y,Math.cos(a)*6,Math.sin(a)*6,true,1,false,0xb7eeff,{source:n.id,ricochets:1,shape:'diamond'});
  if(n.stage===4)g.aimed(n.x,n.y,6.2,2,.22,n.id);
  n.shoot=n.stage===2||n.stage===5?6.2:3.2;g.emit('enemyshot',{x:n.x,y:n.y,source:n.id});
 }
 for(const t of g.threats){if(t.dead)continue;t.age+=dt;if(threatActive(t)&&segmentDistance2(t.ax,t.ay,t.bx,t.by,g.player.x,g.player.y)<(t.width/2+.20)**2)g.hitPlayer();if(t.age>=t.warmup+t.duration)t.dead=true;}
 g.nodes=g.nodes.filter(n=>!n.dead);g.threats=g.threats.filter(t=>!t.dead);
}
