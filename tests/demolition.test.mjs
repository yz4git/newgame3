import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES,GAME_SPEED} from '../app/sim.ts';
import {fieldDamagePhase,STAGE_COLLAPSE_TITLES,FIELD_OPERATIONS,updateBattlefield} from '../app/battlefield.ts';
const still={x:0,y:0,focus:false};
function target(stage=0){
 const g=new Game();g.start('campaign','normal',stage);
 g.time=STAGES[stage].duration*.095;g.update(STEP,still);
 const n=g.nodes.find(n=>n.attach==='field');
 assert.ok(n,'strategic target is present in stage '+stage);
 return {g,n};
}
test('Integrity tiers correctly map intact, fractured and exposed facility cores',()=>{
 assert.equal(fieldDamagePhase(100,100),0);assert.equal(fieldDamagePhase(69,100),0);
 assert.equal(fieldDamagePhase(68,100),1);assert.equal(fieldDamagePhase(33,100),1);
 assert.equal(fieldDamagePhase(32,100),2);assert.equal(fieldDamagePhase(0,100),2);
});
test('Two nonlethal thresholds each trigger once, cancel owned shots and soften enemy fire',()=>{
 const {g,n}=target();g.drainEvents();
 g.projectile(n.x,n.y,0,-4,true,1,false,0xffd38a,{source:n.id});
 g.damageNode(n,n.maxHp*.35);
 assert.equal(fieldDamagePhase(n.hp,n.maxHp),1);
 assert.equal(g.battlefield.fractures,1);
 assert.equal(g.battlefield.criticals,0);
 assert.equal(g.bullets.filter(b=>b.enemy&&!b.dead&&b.source===n.id).length,0);
 assert.equal(g.drainEvents().filter(e=>e.type==='fieldfracture').length,1);
 g.damageNode(n,n.maxHp*.37);
 assert.equal(fieldDamagePhase(n.hp,n.maxHp),2);
 assert.equal(g.battlefield.criticals,1);
 assert.ok(n.shoot>=5);
 assert.equal(g.drainEvents().filter(e=>e.type==='fieldcritical').length,1);
 g.damageNode(n,1);g.damageNode(n,1);
 assert.equal(g.battlefield.fractures,1);
 assert.equal(g.battlefield.criticals,1);
});
test('Every sector receives a unique authored collapse title and a persistent wreck',()=>{
 assert.equal(STAGE_COLLAPSE_TITLES.length,6);
 assert.equal(new Set(STAGE_COLLAPSE_TITLES).size,6);
 assert.equal(FIELD_OPERATIONS.length,6);
 for(let stage=0;stage<6;stage++){
  const {g,n}=target(stage);g.drainEvents();
  g.damageNode(n,1000);
  assert.equal(g.battlefield.collapses.length,1);
  const wreck=g.battlefield.collapses[0];
  assert.equal(wreck.stage,stage);assert.equal(wreck.index,0);assert.equal(wreck.burst,0);
  assert.equal(g.drainEvents().find(e=>e.type==='fieldcollapse')?.text,STAGE_COLLAPSE_TITLES[stage]);
  g.damageNode(n,1000);
  assert.equal(g.battlefield.collapses.length,1,'destroy once only');
 }
});
test('Cinematic chain bursts occur at fixed thresholds, are bounded and expire',()=>{
 const {g,n}=target(2);g.drainEvents();g.damageNode(n,999);g.drainEvents();
 assert.equal(g.battlefield.collapses.length,1);
 updateBattlefield(g,.31);assert.equal(g.battlefield.collapses[0].burst,0);
 updateBattlefield(g,.02);assert.equal(g.battlefield.collapses[0].burst,1);
 updateBattlefield(g,.60);assert.equal(g.battlefield.collapses[0].burst,2);
 updateBattlefield(g,1.25);assert.equal(g.battlefield.collapses[0].burst,4);
 const bursts=g.drainEvents().filter(e=>e.type==='fieldburst');
 assert.equal(bursts.length,4);
 assert.ok(bursts.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.size>0));
 updateBattlefield(g,2);assert.equal(g.battlefield.collapses.length,0);
 updateBattlefield(g,1);assert.equal(g.drainEvents().filter(e=>e.type==='fieldburst').length,0);
});
test('Paused gameplay freezes strategic wrecks and stage transitions reset them',()=>{
 const {g,n}=target(1);g.damageNode(n,1000);
 const start=g.battlefield.collapses[0].age;g.pause();
 for(let i=0;i<60;i++)g.update(STEP,still);
 assert.equal(g.battlefield.collapses[0].age,start);
 g.resume();g.update(STEP,still);
 assert.ok(g.battlefield.collapses[0].age>start);
 g.stage=0;g.battlefield.collapses=[{stage:0,index:0,x:0,y:3,age:0,life:3.3,burst:0}];
 g.state='transition';g.transitionTime=STEP*GAME_SPEED/2;
 g.update(STEP,still);
 assert.equal(g.stage,1);
 assert.deepEqual(g.battlefield.collapses,[]);
});
test('Low-motion long sessions keep demolition state and event counts bounded',()=>{
 const g=new Game();g.start();g.battlefield.seen=[true,true];
 for(let i=0;i<60*150&&g.state==='playing';i++){
  g.invulnerable=1;g.update(STEP,still);g.drainEvents();
  assert.ok(g.battlefield.collapses.length<=3);
  assert.ok(g.events.length<=600);
 }
});
