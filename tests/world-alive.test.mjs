import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../app/sim.ts';
import {
 WORLD_ALIVE_STAGES,WORLD_ALIVE_BUDGET,updateWorldAlive,initialWorldAlive,
 reactWorldFacility,enterWorldBoss,updateWorldBoss,collapseWorldBoss,advanceWorldEscape
} from '../app/world-alive.ts';
import {STAGES} from '../app/stages.ts';
import {readFile} from 'node:fs/promises';

test('six complete non-repeated authored siege/launch/boss/escape programs',()=>{
 assert.equal(WORLD_ALIVE_STAGES.length,STAGES.length);
 for(const field of ['name','approach','bay','gate','boss','escape']){
  assert.equal(new Set(WORLD_ALIVE_STAGES.map(x=>x[field])).size,6,field);
 }
 assert.ok(WORLD_ALIVE_BUDGET.maxExtraEnemies<=3);
 assert.ok(WORLD_ALIVE_BUDGET.maxActiveEnemies<=12);
});

test('stage gates become real timed enemy hangars and emit aligned 3D cues',()=>{
 for(let stage=0;stage<6;stage++){
  const g=new Game();g.start('campaign','normal',stage);
  assert.equal(g.worldAlive.stage,stage);
  g.time=STAGES[stage].duration*.25;
  updateWorldAlive(g);
  assert.equal(g.worldAlive.approach,true);
  assert.equal(g.worldAlive.launches[0],true);
  assert.equal(g.worldAlive.launched,2);
  assert.equal(g.enemies.length,2);
  assert.equal(g.events.some(e=>e.type==='worldapproach'),true);
  const launches=g.events.filter(e=>e.type==='worldlaunch');
  assert.equal(launches.length,1);
  assert.ok(g.enemies.every(e=>e.origin<0 && e.y>=WORLD_ALIVE_BUDGET.launchY));
  updateWorldAlive(g);
  assert.equal(g.enemies.length,2,'no additional enemies on repeated ticks');
 }
});

test('destroying an installation before its launch physically closes bay and suppresses a sortie',()=>{
 const g=new Game();g.start('campaign','normal',2);
 reactWorldFacility(g,0,'destroyed');
 assert.equal(g.worldAlive.baysOpen[0],false);
 g.time=STAGES[2].duration*.25;
 updateWorldAlive(g);
 assert.equal(g.enemies.length,0);
 assert.equal(g.worldAlive.launched,0);
 assert.equal(g.events.filter(e=>e.type==='worldbaydisabled').length,1);
 g.time=STAGES[2].duration*.70;
 reactWorldFacility(g,1,'escaped');
 updateWorldAlive(g);
 assert.equal(g.worldAlive.launched,3);
 assert.equal(g.worldAlive.escaped[1],true);
 assert.equal(g.enemies.length,3);
 assert.ok(g.events.some(e=>e.type==='worldalarm'));
 assert.ok(g.events.some(e=>e.type==='worldbreach'));
});

test('overcrowding prevents additive sortie spam; noncampaign balances unchanged',()=>{
 const g=new Game();g.start('campaign','normal',5);
 g.time=STAGES[5].duration*.25;
 for(let i=0;i<WORLD_ALIVE_BUDGET.maxActiveEnemies;i++)g.spawn('drone',0,19+i);
 updateWorldAlive(g);
 assert.equal(g.worldAlive.launched,0);
 assert.ok(g.events.some(e=>e.type==='worldbayhold'));
 const rush=new Game();rush.start('bossrush','normal',2);
 rush.time=120;updateWorldAlive(rush);
 assert.equal(rush.worldAlive.launched,0);
 assert.equal(rush.events.some(e=>e.type==='worldlaunch'),false);
});

test('campaign boss entry, phase change, structural collapse and escape are synchronized',()=>{
 const g=new Game();g.start('campaign','normal',1);
 g.spawnBoss();
 assert.equal(g.worldAlive.bossEntry,true);
 assert.ok(g.events.some(e=>e.type==='worldbossentry'));
 g.boss.phase=2;
 updateWorldBoss(g);
 assert.equal(g.worldAlive.bossPhase,2);
 assert.ok(g.events.some(e=>e.type==='worldbossphase'));
 collapseWorldBoss(g);advanceWorldEscape(g);
 assert.equal(g.worldAlive.bossDefeated,true);
 assert.equal(g.worldAlive.escape,true);
 assert.ok(g.events.some(e=>e.type==='worldescape'));
 const count=g.events.filter(e=>e.type==='worldescape').length;
 advanceWorldEscape(g);
 assert.equal(g.events.filter(e=>e.type==='worldescape').length,count);
 assert.equal(initialWorldAlive(3).stage,3);
});

test('rendering 4.0 connects to real game state, 3D topology and explicit scene diagnostics',async()=>{
 const [sim,battle,view,scene]=await Promise.all(['sim','battlefield','render','world-alive-scene'].map(s=>readFile('app/'+s+'.ts','utf8')));
 assert.match(sim,/worldAlive:WorldAliveState=initialWorldAlive\(\)/);
 assert.match(sim,/updateWorldAlive\(this\)/);
 assert.match(sim,/enterWorldBoss\(this\)/);
 assert.match(sim,/collapseWorldBoss\(this\)/);
 assert.match(battle,/reactWorldFacility\(g,n.index,'destroyed'\)/);
 assert.match(battle,/reactWorldFacility\(g,n.index,'escaped'\)/);
 assert.match(view,/private aliveScene=usesRebuiltGraphics\(\)\?new WorldAliveScene\(\):null/);
 assert.match(view,/this\.aliveScene\?\.event\(e\)/);
 assert.match(view,/this\.aliveScene\?\.draw\(game,dt,mix/);
 assert.match(scene,/real-gameplay-hangar-/);
 assert.match(scene,/reactive-.*-dock/);
 assert.match(scene,/this\.vault\.cores/);
 assert.match(scene,/WORLD_ALIVE_BUDGET\.firstLaunch/);
 assert.doesNotMatch(scene,/new T\.PlaneGeometry|new T\.Sprite|AdditiveBlending|Math\.random|new T\.PointLight/);
});

test('true destruction path on game nodes closes a real hangar before its launch',()=>{
 const g=new Game();g.start('campaign','normal',3);
 g.addCombatNode('field',0,0,-3.25,8,45,8.3);
 const n=g.nodes.find(n=>n.attach==='field'&&n.index===0);
 assert.ok(n);
 g.damageNode(n,n.hp+5);
 assert.equal(g.battlefield.outcomes[0],'destroyed');
 assert.deepEqual(g.worldAlive.destroyed,[true,false]);
 assert.equal(g.worldAlive.baysOpen[0],false);
 g.time=STAGES[3].duration*.25;updateWorldAlive(g);
 assert.equal(g.worldAlive.launched,0);
});
test('boss hitbox part damage truly drives wing mechanisms, central reactor and post-NOVA escape',()=>{
 const g=new Game();g.start('campaign','normal',4);g.spawnBoss();
 const partMax=g.boss.maxPart;
 g.damagePart(0,partMax+2);
 assert.deepEqual(g.worldAlive.wingBroken,[true,false]);
 assert.equal(g.boss.parts[0],0);
 g.damagePart(1,partMax+2);
 assert.deepEqual(g.worldAlive.wingBroken,[true,true]);
 assert.ok(g.events.some(e=>e.type==='worldcoreexpose'));
 g.boss.hp=1;
 assert.equal(g.nova(),true);
 assert.equal(g.state,'transition');
 assert.equal(g.worldAlive.bossDefeated,true);
 assert.equal(g.worldAlive.escape,true);
 assert.ok(g.events.some(e=>e.type==='worldbossfall'));
});
