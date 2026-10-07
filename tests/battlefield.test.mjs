import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {FIELD_OPERATIONS} from '../app/battlefield.ts';
const still={x:0,y:0,focus:false};
test('All six stages define two distinct battlefield targets',()=>{
 assert.equal(FIELD_OPERATIONS.length,STAGES.length);
 for(const operations of FIELD_OPERATIONS){assert.equal(operations.length,2);assert.notEqual(operations[0].name,operations[1].name);}
});
test('Field reactor destruction cascades kills and clears projectiles once',()=>{
 const g=new Game();g.start();g.time=STAGES[0].duration*.095;
 g.update(STEP,still);const field=g.nodes.find(n=>n.attach==='field');
 assert.ok(field);
 const enemy=g.spawn('drone',field.x+1,field.y-1);
 g.projectile(field.x,field.y,0,-3,true,1,false,0xffab78,{source:500});
 g.damageNode(field,1000);
 assert.equal(g.battlefield.destroyed,1);assert.equal(g.battlefield.stageDestroyed,1);
 assert.equal(enemy.dead,true);assert.ok(g.battlefield.suppression>0);
 assert.ok(!g.bullets.some(b=>b.enemy&&!b.dead));assert.ok(g.battlefield.reactions>=1);
 g.damageNode(field,1000);assert.equal(g.battlefield.destroyed,1);
});
test('Missed objectives send reinforcements and open the dangerous score route',()=>{
 const g=new Game();g.start();g.time=STAGES[0].duration*.095;
 g.update(STEP,still);const field=g.nodes.find(n=>n.attach==='field');
 assert.ok(field);field.age=20.99;field.y=-16;
 const count=g.enemies.length;g.update(STEP,still);
 assert.equal(g.battlefield.stageEscaped,1);assert.equal(g.battlefield.escaped,1);
 assert.ok(g.battlefield.alert>0);assert.ok(g.enemies.length>=count+2);
});
test('Securing both objectives weakens the boss, missing an objective strengthens it',()=>{
 const secure=new Game();secure.start();secure.battlefield.stageDestroyed=2;secure.spawnBoss();
 const risky=new Game();risky.start();risky.battlefield.stageEscaped=1;risky.spawnBoss();
 assert.ok(secure.boss.parts[0]<100);assert.ok(risky.boss.parts[0]>100);
});
test('Boss rush is enemy-wave-free and spawns a real boss in the first sector',()=>{
 const g=new Game();g.start('bossrush','normal',5);
 assert.equal(g.stage,0);assert.equal(g.power,3);
 for(let i=0;i<50;i++)g.update(STEP,still);
 assert.ok(g.boss);assert.equal(g.enemies.length,0);
});
test('Selected ships affect movement, firepower and initial hull',()=>{
 const falcon=new Game(),bulwark=new Game();
 falcon.start('campaign','normal',0,'falcon');
 bulwark.start('campaign','normal',0,'bulwark');
 assert.ok(falcon.hull<bulwark.hull);
 falcon.update(STEP,{x:1,y:0,focus:false});bulwark.update(STEP,{x:1,y:0,focus:false});
 assert.ok(falcon.player.x>bulwark.player.x);
 assert.ok(falcon.bullets[0].damage>bulwark.bullets[0].damage);
});
