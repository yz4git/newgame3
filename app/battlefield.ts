import type {Game} from './sim.ts';
import type {CombatNode} from './encounter-design.ts';
import {STAGES} from './stages.ts';
import {reactWorldFacility} from './world-alive.ts';
import {terrainSpawn,updateTerrain,type TerrainPiece,type TerrainRoute} from './battlefield-terrain.ts';

/** Two fixed strategic encounters per world. Clearing changes the fight, fleeing raises stakes. */
export const FIELD_OPERATIONS=[
 [{name:'METEOR REACTOR',jp:'隕石帯の連鎖炉',kind:'reactor'}, {name:'ORBITAL RELAY',jp:'環状施設の通信塔',kind:'relay'}],
 [{name:'CARRIER REACTOR',jp:'空母の動力炉',kind:'reactor'}, {name:'FLEET COMMAND',jp:'艦隊指揮塔',kind:'relay'}],
 [{name:'POWER LATTICE',jp:'レーザー送電網',kind:'relay'}, {name:'CITADEL REACTOR',jp:'要塞主動力炉',kind:'reactor'}],
 [{name:'PRISM CONTROLLER',jp:'氷晶反射制御器',kind:'relay'}, {name:'GLACIER CORE',jp:'氷峡谷の共鳴炉',kind:'reactor'}],
 [{name:'RELIC BEACON',jp:'古代兵器の信号塔',kind:'relay'}, {name:'TEMPLE REACTOR',jp:'遺跡の星核反応炉',kind:'reactor'}],
 [{name:'PRESSURE CHAMBER',jp:'溶岩炉の圧力弁',kind:'reactor'}, {name:'FURNACE CONTROL',jp:'工場の統制塔',kind:'relay'}],
] as const;

/** Persisting cinematic wrecks are decorative, bounded and deterministic. */
export interface BattlefieldCollapse {
 stage:number;index:number;x:number;y:number;age:number;life:number;burst:number;
}
export function fieldDamagePhase(hp:number,maxHp:number):0|1|2{
 if(maxHp<=0||hp/maxHp<=.32)return 2;
 return hp/maxHp<=.68?1:0;
}
export const STAGE_COLLAPSE_TITLES=[
 'METEOR SHATTER / 隕石帯の連鎖崩落',
 'FLEET BLACKOUT / 艦隊防衛網が停止',
 'CITADEL CASCADE / 要塞送電網が崩壊',
 'PRISM FRACTURE / 氷晶群が砕ける',
 'RELIC AWAKENING / 遺跡が共鳴',
 'FURNACE MELTDOWN / 溶岩炉心が暴走'
] as const;
export interface BattlefieldState {
 seen:[boolean,boolean];outcomes:[null|'destroyed'|'escaped',null|'destroyed'|'escaped'];destroyed:number;escaped:number;stageDestroyed:number;stageEscaped:number;
 reactions:number;suppression:number;alert:number;mostReactions:number;
 fractures:number;criticals:number;collapses:BattlefieldCollapse[];
 terrain:TerrainPiece[];terrainSerial:number;terrainCreated:number;shotsBlocked:number;hazardsCleared:number;rerouted:number;route:TerrainRoute|null;
}
export function initialBattlefield():BattlefieldState{
 return {seen:[false,false],outcomes:[null,null],destroyed:0,escaped:0,stageDestroyed:0,stageEscaped:0,reactions:0,suppression:0,alert:0,mostReactions:0,fractures:0,criticals:0,collapses:[],terrain:[],terrainSerial:0,terrainCreated:0,shotsBlocked:0,hazardsCleared:0,rerouted:0,route:null};
}
export function nextBattlefieldStage(g:Game){
 const b=g.battlefield;b.seen=[false,false];b.outcomes=[null,null];b.stageDestroyed=0;b.stageEscaped=0;b.suppression=0;b.alert=0;b.collapses=[];b.terrain=[];b.route=null;
}
function escapeNode(g:Game,n:CombatNode){
 n.dead=true;g.clearSource(n.id);
 const op=FIELD_OPERATIONS[g.stage][n.index];
 const b=g.battlefield;b.outcomes[n.index]='escaped';b.escaped++;b.stageEscaped++;b.alert=Math.max(b.alert,10);
 reactWorldFacility(g,n.index,'escaped');
 // Escaped controller summons two faster reinforcements but pays +25% during the alert.
 for(const side of [-1,1])g.spawn(g.stage===1||g.stage===2?'corvette':g.stage===4?'sentinel':'interceptor',side*6.3,18+(side+1)*1.8);
 if(g.stage===2||g.stage===5)g.addThreat(n.x,n.y,g.player.x,-18,.48,n.id,2,1.25);
 terrainSpawn(g,'hazard',n.index,n.x);
 g.emit('fieldrisk',{x:n.x,y:n.y,text:op.name+' ESCAPED / 増援出現・得点 +25%'});
}
/** Two feedback thresholds make sustained focused fire visibly alter each strategic target. */
export function damageBattlefieldNode(g:Game,n:CombatNode,damage:number){
 if(n.dead||n.attach!=='field')return;
 const before=n.hp/n.maxHp,wasFlashing=n.flash>0;
 n.hp=Math.max(0,n.hp-Math.max(0,damage));n.flash=.12;
 if(damage>0&&!wasFlashing)g.emit('fieldhit',{x:n.x,y:n.y,size:1.8,color:0xffd289});
 if(n.hp<=0){destroyBattlefieldNode(g,n);return;}
 const after=n.hp/n.maxHp;
 if(before>.68&&after<=.68){
  g.battlefield.fractures++;
  g.clearSource(n.id,true);
  n.shoot=Math.max(n.shoot,2.8);
  g.emit('fieldfracture',{x:n.x,y:n.y,size:1.8,color:0xffc176,text:FIELD_OPERATIONS[g.stage][n.index].name+' / ARMOUR BROKEN'});
 }
 if(before>.32&&after<=.32){
  g.battlefield.criticals++;
  n.shoot=Math.max(n.shoot,5);
  const reactor=FIELD_OPERATIONS[g.stage][n.index].kind==='reactor';
  g.battlefieldPulse(n.x,n.y,reactor?4.5:3.8,reactor?24:18);
  g.emit('fieldcritical',{x:n.x,y:n.y,size:2.5,color:reactor?0xffa051:0x79ecff,text:'CORE EXPOSED / 集中砲火で連鎖崩壊'});
 }
}
export function updateBattlefield(g:Game,dt:number){
 const st=g.battlefield;
 st.suppression=Math.max(0,st.suppression-dt);
 st.alert=Math.max(0,st.alert-dt);
 updateTerrain(g,dt);
 for(const c of st.collapses){
  c.age+=dt;
  const thresholds=[.32,.9,1.52,2.12];
  while(c.burst<thresholds.length&&c.age>=thresholds[c.burst]){
   const a=c.stage*1.27+c.index*2.91+c.burst*2.3;
   const x=c.x+Math.cos(a)*(1+c.burst*.48),y=c.y+Math.sin(a)*(.6+c.burst*.3);
   g.emit('fieldburst',{x,y,size:1.5+c.burst*.45,color:c.stage===3?0x94ebff:c.stage===4?0x7df9ce:0xffa968});
   c.burst++;
  }
 }
 st.collapses=st.collapses.filter(c=>c.age<c.life);
 if(g.mode!=='campaign'||g.boss)return;
 const duration=STAGES[g.stage].duration;
 for(let i=0;i<2;i++){
  if(st.seen[i]||g.time<duration*(i===0?.095:.615)||g.time>duration-4)continue;
  const before=g.nodes.length;
  g.addCombatNode('field',0,i,i===0?-3.25:3.25,19,44+g.stage*6,8.3);
  if(g.nodes.length===before)continue;
  const n=g.nodes[g.nodes.length-1];n.radius=2.7;n.shoot=2.7;
  st.seen[i]=true;
  g.emit('fieldwarning',{x:n.x,y:n.y,size:3.5,color:0xffd679,text:'破壊可能な戦略施設 / '+FIELD_OPERATIONS[g.stage][i].jp+' · 撃って破壊！'});
 }
 for(const n of g.nodes){
  if(n.dead||n.attach!=='field')continue;
  n.age+=dt;n.flash=Math.max(0,n.flash-dt);n.y-=4.4*dt;
  if(n.age>=8.3||n.y<-17){escapeNode(g,n);continue;}
  if(n.y<g.player.y+4||n.age<1.4)continue;
  n.shoot-=dt;
  if(n.shoot<=0){
   const op=FIELD_OPERATIONS[g.stage][n.index];
   if(g.stage===2&&op.kind==='relay')g.addThreat(n.x,n.y,g.player.x,-18,.45,n.id,2.1,1.3);
   else if(g.stage===3)for(const a of[-2.55,-Math.PI/2,-.58])g.projectile(n.x,n.y,Math.cos(a)*6,Math.sin(a)*6,true,1,false,0xb7eeff,{source:n.id,shape:'diamond',ricochets:1});
   else if(g.stage===4)g.fan(n.x,n.y,5,6.2,-Math.PI/2+Math.sin(n.age*.8)*.25,.2,n.id,0xffa4ee,.10);
   else if(g.stage===5)g.aimed(n.x,n.y,5.8,4,.20,n.id,g.player,1.7);
   else if(op.kind==='relay')g.aimed(n.x,n.y,6.2,3,.24,n.id);
   else g.fan(n.x,n.y,5,6.0,-Math.PI/2,.26,n.id,0xffd28e);
   // Damaged cores fire less frequently; damage rewards sustained pressure.
   n.shoot=fieldDamagePhase(n.hp,n.maxHp)===2?6.4:fieldDamagePhase(n.hp,n.maxHp)===1?4.8:3.5;
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
 // A screen-wide cancellation is an immediate, readable payoff for destroying a strategic target.
 let clearedShots=0;for(const shot of g.bullets)if(shot.enemy&&!shot.dead){shot.dead=true;clearedShots++;}
 for(const threat of g.threats)threat.dead=true;
 if(clearedShots>0){g.cancelled+=clearedShots;g.addScore(clearedShots*40*g.multiplier);}
 const reactions=g.kills-before,st=g.battlefield;
 st.reactions+=reactions;st.mostReactions=Math.max(st.mostReactions,reactions);
 st.outcomes[n.index]='destroyed';st.destroyed++;st.stageDestroyed++;st.suppression=Math.max(st.suppression,reactor?5:9);st.alert=0;
 reactWorldFacility(g,n.index,'destroyed');
 st.collapses.push({stage:g.stage,index:n.index,x:n.x,y:n.y,age:0,life:3.3,burst:0});
 if(st.collapses.length>3)st.collapses.shift();
 g.emit('fieldcollapse',{x:n.x,y:n.y,size:reactor?5.4:4.6,color:reactor?0xffb05d:0x78e9ff,text:STAGE_COLLAPSE_TITLES[g.stage]});
 terrainSpawn(g,'cover',n.index,n.x);
 g.energy=Math.min(100,g.energy+15+Math.min(20,cleared));
 g.addScore((reactor?2500:3000)*g.multiplier);g.pickup('medal',n.x,n.y);
 if(st.stageDestroyed===2)g.pickup('power',n.x,n.y+1.7);
 // Each world pays a different tactical dividend beyond the universal bullet conversion.
 if(g.stage===1&&n.index===1)g.pickup('repair',n.x+1,n.y);
 if(g.stage===2&&n.index===0)for(const t of g.threats)t.dead=true;
 if(g.stage===3&&n.index===0)for(const linked of [...g.nodes])if(linked.attach==='stage'&&!linked.dead)g.damageNode(linked,linked.hp+1);
 if(g.stage===4&&n.index===0)g.pickup('power',n.x-1,n.y);
 if(g.stage===5&&n.index===0)g.energy=Math.min(100,g.energy+12);
 // Facility-specific fieldcollapse + fieldclear now own the whole explosion.
 // Never emit the generic 2-D explosion atlas or resonance sprite for a world-space structure.
 g.emit('fieldclear',{x:n.x,y:n.y,size:7.5,color:0xffe48b,text:'敵弾すべて消去 '+(cleared+clearedShots)+' / '+(st.stageDestroyed===2?'ボス兵装 -15%':'敵射撃停止・残骸で防御')});
}
