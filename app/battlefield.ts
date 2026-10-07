import type {Game} from './sim.ts';
import type {CombatNode} from './encounter-design.ts';
import {STAGES} from './stages.ts';

/** Two fixed strategic encounters per world. Clearing changes the fight, fleeing raises stakes. */
export const FIELD_OPERATIONS=[
 [{name:'METEOR REACTOR',jp:'隕石帯の連鎖炉',kind:'reactor'}, {name:'ORBITAL RELAY',jp:'環状施設の通信塔',kind:'relay'}],
 [{name:'CARRIER REACTOR',jp:'空母の動力炉',kind:'reactor'}, {name:'FLEET COMMAND',jp:'艦隊指揮塔',kind:'relay'}],
 [{name:'POWER LATTICE',jp:'レーザー送電網',kind:'relay'}, {name:'CITADEL REACTOR',jp:'要塞主動力炉',kind:'reactor'}],
 [{name:'PRISM CONTROLLER',jp:'氷晶反射制御器',kind:'relay'}, {name:'GLACIER CORE',jp:'氷峡谷の共鳴炉',kind:'reactor'}],
 [{name:'RELIC BEACON',jp:'古代兵器の信号塔',kind:'relay'}, {name:'TEMPLE REACTOR',jp:'遺跡の星核反応炉',kind:'reactor'}],
 [{name:'PRESSURE CHAMBER',jp:'溶岩炉の圧力弁',kind:'reactor'}, {name:'FURNACE CONTROL',jp:'工場の統制塔',kind:'relay'}],
] as const;

export interface BattlefieldState {
 seen:[boolean,boolean];destroyed:number;escaped:number;stageDestroyed:number;stageEscaped:number;
 reactions:number;suppression:number;alert:number;mostReactions:number;
}
export function initialBattlefield():BattlefieldState{
 return {seen:[false,false],destroyed:0,escaped:0,stageDestroyed:0,stageEscaped:0,reactions:0,suppression:0,alert:0,mostReactions:0};
}
export function nextBattlefieldStage(g:Game){
 const b=g.battlefield;b.seen=[false,false];b.stageDestroyed=0;b.stageEscaped=0;b.suppression=0;b.alert=0;
}
function escapeNode(g:Game,n:CombatNode){
 n.dead=true;g.clearSource(n.id);
 const op=FIELD_OPERATIONS[g.stage][n.index];
 const b=g.battlefield;b.escaped++;b.stageEscaped++;b.alert=Math.max(b.alert,10);
 // Escaped controller summons two faster reinforcements but pays +25% during the alert.
 for(const side of [-1,1])g.spawn(g.stage===1||g.stage===2?'corvette':g.stage===4?'sentinel':'interceptor',side*6.3,18+(side+1)*1.8);
 if(g.stage===2||g.stage===5)g.addThreat(n.x,n.y,g.player.x,-18,.48,n.id,2,1.25);
 g.emit('fieldrisk',{x:n.x,y:n.y,text:op.name+' ESCAPED / 増援出現・得点 +25%'});
}
export function updateBattlefield(g:Game,dt:number){
 const st=g.battlefield;
 st.suppression=Math.max(0,st.suppression-dt);
 st.alert=Math.max(0,st.alert-dt);
 if(g.mode!=='campaign'||g.boss)return;
 const duration=STAGES[g.stage].duration;
 for(let i=0;i<2;i++){
  if(st.seen[i]||g.time<duration*(i===0?.095:.615)||g.time>duration-4)continue;
  const before=g.nodes.length;
  g.addCombatNode('field',0,i,i===0?-3.25:3.25,15,52+g.stage*7,21);
  if(g.nodes.length===before)continue;
  const n=g.nodes[g.nodes.length-1];n.radius=1.5;n.shoot=2.7;
  st.seen[i]=true;
  g.emit('fieldwarning',{x:n.x,y:n.y,text:'STRATEGIC TARGET / '+FIELD_OPERATIONS[g.stage][i].jp+' — 破壊で戦況が変わる'});
 }
 for(const n of g.nodes){
  if(n.dead||n.attach!=='field')continue;
  n.age+=dt;n.flash=Math.max(0,n.flash-dt);n.y-=1.52*dt;
  if(n.age>=21||n.y<-17){escapeNode(g,n);continue;}
  if(n.y<g.player.y+4||n.age<2.4)continue;
  n.shoot-=dt;
  if(n.shoot<=0){
   const op=FIELD_OPERATIONS[g.stage][n.index];
   if(g.stage===2&&op.kind==='relay')g.addThreat(n.x,n.y,g.player.x,-18,.45,n.id,2.1,1.3);
   else if(g.stage===3)for(const a of[-2.55,-Math.PI/2,-.58])g.projectile(n.x,n.y,Math.cos(a)*6,Math.sin(a)*6,true,1,false,0xb7eeff,{source:n.id,shape:'diamond',ricochets:1});
   else if(g.stage===4)g.fan(n.x,n.y,5,6.2,-Math.PI/2+Math.sin(n.age*.8)*.25,.2,n.id,0xffa4ee,.10);
   else if(g.stage===5)g.aimed(n.x,n.y,5.8,4,.20,n.id,g.player,1.7);
   else if(op.kind==='relay')g.aimed(n.x,n.y,6.2,3,.24,n.id);
   else g.fan(n.x,n.y,5,6.0,-Math.PI/2,.26,n.id,0xffd28e);
   n.shoot=3.5;
  }
 }
}
/** The canonical damageNode path calls this exactly once when a target is defeated. */
export function destroyBattlefieldNode(g:Game,n:CombatNode){
 if(n.dead||n.attach!=='field')return;
 const op=FIELD_OPERATIONS[g.stage][n.index],reactor=op.kind==='reactor';
 n.hp=0;n.dead=true;g.clearSource(n.id,true);
 const before=g.kills,radius=reactor?8.4:5.6;
 const cleared=g.battlefieldPulse(n.x,n.y,radius,reactor?85:45);
 const reactions=g.kills-before,st=g.battlefield;
 st.reactions+=reactions;st.mostReactions=Math.max(st.mostReactions,reactions);
 st.destroyed++;st.stageDestroyed++;st.suppression=Math.max(st.suppression,reactor?5:9);st.alert=0;
 g.energy=Math.min(100,g.energy+15+Math.min(20,cleared));
 g.addScore((reactor?2500:3000)*g.multiplier);g.pickup('medal',n.x,n.y);
 if(st.stageDestroyed===2)g.pickup('power',n.x,n.y+1.7);
 // Each world pays a different tactical dividend beyond the universal bullet conversion.
 if(g.stage===1&&n.index===1)g.pickup('repair',n.x+1,n.y);
 if(g.stage===2&&n.index===0)for(const t of g.threats)t.dead=true;
 if(g.stage===3&&n.index===0)for(const linked of [...g.nodes])if(linked.attach==='stage'&&!linked.dead)g.damageNode(linked,linked.hp+1);
 if(g.stage===4&&n.index===0)g.pickup('power',n.x-1,n.y);
 if(g.stage===5&&n.index===0)g.energy=Math.min(100,g.energy+12);
 g.emit('explode',{x:n.x,y:n.y,size:reactor?3.8:2.7});
 g.emit('resonance',{x:n.x,y:n.y,size:radius,color:reactor?0xffbb62:0x5ce9ff});
 g.emit('fieldclear',{x:n.x,y:n.y,text:op.name+' BREAK / '+reactions+' CHAIN KILLS · '+cleared+' CANCEL / 敵射撃停止'});
}
