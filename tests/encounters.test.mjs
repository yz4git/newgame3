import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,GAME_SPEED,W,STAGES,bossPartPosition} from '../app/sim.ts';
import {spawnStageEncounter,spawnMiniboss} from '../app/encounters.ts';
import {encounterTimes,threatActive} from '../app/encounter-design.ts';
import {bossCoreDamage} from '../app/boss-patterns.ts';
import {stageCue,bossPose} from '../app/motion.ts';

const still={x:0,y:0,focus:false};
function isolated(stage=0){const g=new Game();g.start('campaign','normal',stage);g.waveIndex=999;g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.shotTimer=1000;g.invulnerable=1000;return g;}
function step(g,count){for(let i=0;i<count;i++){g.update(STEP,still);g.drainEvents();}}

test('Every campaign sector reaches one event and one miniboss, while Caravan retains its timed waves',()=>{
 for(let s=0;s<6;s++){
  const g=isolated(s);g.encounterSeen={stage:false,mini:false};const t=encounterTimes(s,STAGES[s].duration);g.time=t.event-STEP*GAME_SPEED;g.update(STEP,still);assert.ok(g.encounterSeen.stage);assert.equal(g.nodes.length,s===4?3:2);
  step(g,5);assert.equal(g.nodes.length,s===4?3:2);g.time=t.mini-STEP*GAME_SPEED;g.update(STEP,still);assert.equal(g.encounter.stage,s);assert.ok(g.encounterSeen.mini);assert.ok(g.nodes.every(n=>n.attach==='mini'));
  const id=g.encounter.id;step(g,100);assert.equal(g.encounter.id,id);
 }
 const g=new Game();g.start('caravan');g.invulnerable=1000;step(g,1500);assert.equal(g.encounter,null);assert.equal(g.encounterSeen.stage,false);assert.equal(g.encounterSeen.mini,false);
});
test('Midboss windows suppress ordinary waves and restore a supply wave before each final boss',()=>{
 for(let s=0;s<6;s++){const g=isolated(s),t=encounterTimes(s,STAGES[s].duration).mini;assert.ok(g.schedule.every(w=>w.at<t-2||w.at>t+23));assert.ok(g.schedule.some(w=>w.kind==='carrier'&&w.at>t+23&&w.at<STAGES[s].duration));}
});
test('Early miniboss kills resume ordinary combat and resupply without waiting for the withdrawal timer',()=>{
 const g=new Game();g.start();g.time=encounterTimes(0,STAGES[0].duration).mini+5;g.waveIndex=g.schedule.findIndex(w=>w.at>g.time);const previous=g.schedule[g.waveIndex];spawnMiniboss(g);g.damageMiniboss(10000);const next=g.schedule.slice(g.waveIndex,g.waveIndex+3);assert.deepEqual(next.slice(0,2).map(w=>w.kind),['drone','carrier']);assert.ok(next[1].at<previous.at);assert.deepEqual(next[2],previous);const length=g.schedule.length;g.damageMiniboss(10000);assert.equal(g.schedule.length,length);
});
test('Stage machinery waits until its instruction panel has disappeared before starting a volley',()=>{
 const g=isolated(2);spawnStageEncounter(g);const t=encounterTimes(2,STAGES[2].duration).event;g.time=t;step(g,118);assert.ok(stageCue(g));assert.equal(g.threats.length,0);step(g,35);assert.equal(stageCue(g),null);assert.ok(g.threats.length>0);
});
test('All six minibosses can be destroyed with normal automatic weapon collision and reward exactly once',()=>{
 for(let s=0;s<6;s++){
  const g=isolated(s);spawnMiniboss(g);g.weapon='laser';g.power=4;g.shotTimer=0;g.encounter.age=3.1;g.encounter.y=8.8;
  for(let i=0;i<500&&g.encounter;i++){g.player.x=g.encounter.x;g.player.y=g.encounter.y-6;g.update(STEP,{...still,focus:true});g.drainEvents();}
  assert.equal(g.encounter,null,'sector '+s);assert.equal(g.kills,1);assert.ok(g.score>=5000+s*1000);assert.ok(g.pickups.some(p=>p.type==='repair'));assert.ok(g.nodes.every(n=>n.attach!=='mini'||n.dead));const score=g.score;g.damageMiniboss(10000);assert.equal(g.score,score);
 }
});
test('Unfinished minibosses withdraw, cancel their sources and allow final boss progression',()=>{
 for(let s=0;s<6;s++){const g=isolated(s);spawnMiniboss(g);const m=g.encounter;g.addThreat(0,10,0,-18,.5,m.id);g.projectile(0,10,0,-2,true,1,false,0xffa73b,{source:m.id});m.age=21.99;g.update(STEP,still);assert.equal(g.encounter,null);assert.ok(g.bullets.every(b=>b.source!==m.id));assert.equal(g.threats.length,0);g.time=STAGES[s].duration;g.update(STEP,still);assert.ok(g.boss&&!g.boss.dead);}
});
test('Laser warnings last at least 0.7 real seconds, damage only the advertised segment, and respect invulnerability',()=>{
 const g=isolated();g.invulnerable=0;g.player.x=0;g.addThreat(0,8,0,-18,.5,77,.1,1.4);const t=g.threats[0];assert.ok(t.warmup/GAME_SPEED>=.7);
 step(g,41);assert.equal(g.hull,3);assert.equal(threatActive(t),false);g.update(STEP,still);assert.equal(g.hull,2);assert.equal(threatActive(t),true);step(g,10);assert.equal(g.hull,2);
 const outside=isolated();outside.invulnerable=0;outside.player.x=.46;outside.addThreat(0,8,0,-18,.5,78,.1);step(outside,50);assert.equal(outside.hull,3);
 const diagonal=isolated();diagonal.invulnerable=0;diagonal.player.x=-2;diagonal.player.y=0;diagonal.addThreat(-7,10,3,-10,.5,79,.1);step(diagonal,42);assert.equal(diagonal.hull,2);
});
test('Destroying a node removes only its owned shots and lasers through ordinary swept projectile collision',()=>{
 const g=isolated(2);spawnStageEncounter(g);const [a,b]=g.nodes;g.addThreat(a.x,a.y,a.x,-18,.5,a.id);g.addThreat(b.x,b.y,b.x,-18,.5,b.id);g.projectile(a.x,a.y,0,-2,true,1,false,0xffa73b,{source:a.id});g.projectile(b.x,b.y,0,-2,true,1,false,0xffa73b,{source:b.id});
 g.projectile(a.x,a.y-4,0,300,false,100);g.update(STEP,still);assert.ok(a.dead);assert.ok(!b.dead);assert.ok(g.threats.every(t=>t.source!==a.id));assert.ok(!g.threats.find(t=>t.source===b.id).dead);assert.ok(g.bullets.every(p=>p.source!==a.id));assert.ok(g.bullets.some(p=>p.source===b.id));
});
test('Escort destruction exposes miniboss cores and lock-on targets include both machinery and minibosses',()=>{
 const g=isolated(4);spawnMiniboss(g);g.encounter.y=8.8;g.encounter.age=3.1;const m=g.encounter,hp=m.hp;g.damageMiniboss(10);assert.equal(hp-m.hp,7);for(const n of g.nodes)g.damageNode(n,100);const after=m.hp;g.damageMiniboss(10);assert.equal(after-m.hp,12.5);
 g.nodes=[];g.addCombatNode('stage',0,0,-2,6,100,20);g.weapon='homing';for(let i=0;i<18;i++)g.update(STEP,{...still,focus:true});assert.ok(g.locks.some(l=>l.id===m.id));assert.ok(g.locks.some(l=>l.id===g.nodes[0].id));
});
test('Ice bullets reflect once with active crystals and stop reflecting after the last crystal breaks',()=>{
 const g=isolated(3);g.addCombatNode('stage',0,0,0,10,100,20);g.projectile(W-.02,5,6,-2,true,1,false,0xb7eeff,{ricochets:1,shape:'diamond'});const b=g.bullets.at(-1);g.update(STEP,still);assert.equal(b.ricochets,0);assert.ok(b.vx<0);assert.equal(b.x,W);
 g.damageNode(g.nodes[0],1000);g.projectile(W-.02,5,6,-2,true,1,false,0xb7eeff,{ricochets:1});const unreflected=g.bullets.at(-1);g.update(STEP,still);assert.equal(unreflected.ricochets,1);assert.ok(unreflected.vx>0&&unreflected.x>W);
});
test('Six final bosses run distinct bounded controllers and enter all three HP phases safely',()=>{
 const traces=[];for(let s=0;s<6;s++){
  const g=isolated(s);g.spawnBoss();const b=g.boss;b.age=3;b.y=9;const trace=new Set();
  for(let i=0;i<920;i++){g.update(STEP,still);for(const p of g.bullets.filter(p=>p.enemy))trace.add([p.shape,p.turn,p.accel,p.ricochets,Math.round(p.vx),Math.round(p.vy)].join(':'));for(const t of g.threats)trace.add('beam:'+t.width);assert.ok(g.bullets.length<=721&&g.nodes.length<=8&&g.threats.length<=12);for(const v of [b.x,b.y,b.hp,b.heat,b.warning])assert.ok(Number.isFinite(v));g.drainEvents();}
  traces.push([...trace].sort().join('|'));b.hp=b.maxHp*.5;g.update(STEP,still);assert.equal(b.phase,2);assert.ok(g.drainEvents().some(e=>e.type==='phase'&&e.value===2));b.hp=b.maxHp*.2;g.update(STEP,still);assert.equal(b.phase,3);assert.ok(g.drainEvents().some(e=>e.type==='phase'&&e.value===3));assert.ok(bossPose(b).glow>1);assert.ok(g.invulnerable>0);
 }assert.equal(new Set(traces).size,6);
});
test('Breaking a final boss wing cancels its beam and support machinery and prevents that source firing again',()=>{
 const g=isolated(2);g.spawnBoss();const b=g.boss;b.age=3;b.y=9;g.update(STEP,still);assert.equal(g.threats.length,2);const other=g.threats.find(t=>t.source===b.id+2);const p=bossPartPosition(b,0);g.addCombatNode('boss',b.id+1,0,-6,9,100,20);const node=g.nodes.at(-1);g.addThreat(-6,9,-6,-18,.5,node.id);g.projectile(p.x,p.y-4,0,300,false,1000);g.update(STEP,still);assert.equal(b.parts[0],0);assert.ok(g.threats.filter(t=>t.source===b.id+1||t.source===node.id).every(t=>t.dead));assert.ok(!other.dead);
 step(g,850);assert.ok(g.bullets.every(p=>p.source!==b.id+1));assert.ok(g.threats.every(t=>t.source!==b.id+1));assert.ok(g.nodes.every(n=>n.index!==0));
});
test('Orbital armor opens after both wings break; damaged furnace vents lengthen cooling windows',()=>{
 const orbit=isolated();orbit.spawnBoss();orbit.boss.age=3;orbit.update(STEP,still);assert.equal(bossCoreDamage(orbit,orbit.boss),.45);orbit.boss.parts=[0,0];orbit.update(STEP,still);assert.equal(orbit.boss.guard,0);assert.equal(bossCoreDamage(orbit,orbit.boss),1);orbit.boss.patternTime=8;orbit.update(STEP,still);assert.equal(bossCoreDamage(orbit,orbit.boss),1.6);
 const furnace=isolated(5);furnace.spawnBoss();furnace.boss.age=3;furnace.boss.cycle=0;furnace.boss.patternTime=6.2;furnace.update(STEP,still);assert.equal(furnace.boss.rest,false);furnace.boss.parts=[0,0];furnace.update(STEP,still);assert.equal(furnace.boss.rest,true);assert.equal(furnace.boss.heat,0);
});
test('NOVA, pause, retry and stage transitions reset new threats without duplicate encounters or RNG drift',()=>{
 const g=isolated(2);spawnMiniboss(g);g.addThreat(0,10,0,-18,.5,g.encounter.id);const saved=structuredClone([g.encounter,g.nodes,g.threats]);g.pause();step(g,20);assert.deepEqual([g.encounter,g.nodes,g.threats],saved);g.resume();assert.ok(g.nova());assert.ok(g.threats.every(t=>t.dead));assert.ok(g.nodes.every(n=>n.dead));g.start();assert.equal(g.encounter,null);assert.equal(g.nodes.length,0);assert.equal(g.threats.length,0);assert.deepEqual(g.encounterSeen,{stage:false,mini:false});
 g.nodes=[{dead:false}];g.state='transition';g.transitionTime=.001;g.update(STEP,still);assert.equal(g.stage,1);assert.equal(g.nodes.length,0);assert.deepEqual(g.encounterSeen,{stage:false,mini:false});
 const a=isolated(3),b=isolated(3);spawnStageEncounter(a);spawnStageEncounter(b);spawnMiniboss(a);spawnMiniboss(b);step(a,200);step(b,200);assert.deepEqual([a.encounter,a.nodes,a.threats,a.bullets],[b.encounter,b.nodes,b.threats,b.bullets]);
});
test('Miniboss and combat event communications have bounded windows and freeze with the simulation',()=>{
 const g=isolated(1);spawnMiniboss(g);g.encounter.age=1;assert.equal(stageCue(g).title,'MIDBOSS INBOUND');g.pause();assert.equal(stageCue(g),null);g.resume();g.encounter.age=4;assert.notEqual(stageCue(g)?.title,'MIDBOSS INBOUND');g.encounter=null;g.time=encounterTimes(1,STAGES[1].duration).event+1;assert.ok(stageCue(g).title.includes('FLEET AMBUSH'));g.time+=5;assert.notEqual(stageCue(g)?.title,'FLEET AMBUSH / 艦隊襲撃');
});
