import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {FIELD_OPERATIONS} from '../app/battlefield.ts';
import {fieldPresentation,fieldRewardLabel,FIELD_COLORS} from '../app/field-clarity.ts';
const idle={x:0,y:0,focus:false};
function spawned(stage=0){
 const g=new Game();g.start('campaign','normal',stage);g.time=STAGES[stage].duration*.095;
 g.update(STEP,idle);
 const n=g.nodes.find(n=>n.attach==='field');assert.ok(n,'field spawned');
 return {g,n};
}
test('Every stage has 2 recognizable, uniquely named shootable facilities',()=>{
 assert.equal(FIELD_OPERATIONS.length,6);
 const all=new Set();
 for(let i=0;i<6;i++){assert.equal(FIELD_OPERATIONS[i].length,2);
  const {g,n}=spawned(i);assert.equal(n.index,0);assert.ok(n.radius>=1.5);
  for(const j of FIELD_OPERATIONS[i]){all.add(j.name);assert.ok(j.jp.length>3);}
  assert.ok(g.drainEvents().some(e=>e.type==='fieldwarning'&&e.text.includes('破壊')));
 }
 assert.equal(all.size,12);
});
test('Objective color, description and readable HP follow three clear damage phases',()=>{
 const {g,n}=spawned();g.drainEvents();
 let f=fieldPresentation(n);assert.equal(f.phase,0);assert.equal(f.color,FIELD_COLORS.intact);assert.equal(f.ratio,1);
 assert.ok(f.condition.includes('破壊'));assert.ok(f.japanese.length>2);
 g.damageNode(n,n.maxHp*.40);f=fieldPresentation(n);
 assert.equal(f.phase,1);assert.equal(f.color,FIELD_COLORS.cracked);
 assert.ok(f.condition.includes('装甲'));assert.ok(f.ratio<.61&&f.ratio>.59);
 g.damageNode(n,n.maxHp*.35);f=fieldPresentation(n);
 assert.equal(f.phase,2);assert.equal(f.color,FIELD_COLORS.critical);assert.ok(f.condition.includes('炉心'));
 assert.ok(f.ring>1.8&&f.ring<2.3);
});
test('Facility impacts are rate limited to avoid 60 flashing sparks per second',()=>{
 const {g,n}=spawned();g.drainEvents();
 g.damageNode(n,1);g.damageNode(n,1);g.damageNode(n,1);
 assert.equal(g.drainEvents().filter(e=>e.type==='fieldhit').length,1);
 n.flash=0;g.damageNode(n,1);
 assert.equal(g.drainEvents().filter(e=>e.type==='fieldhit').length,1);
});
test('Destroying a facility clears the entire enemy bullet screen and active beam hazards',()=>{
 const {g,n}=spawned();g.drainEvents();
 const far=g.projectile(8,-8,0,-6,true,1,false,0xffaaaa,{source:999});
 const near=g.projectile(n.x,n.y-4,0,-6,true,1,false,0xffaaaa,{source:998});
 g.projectile(-8,0,0,12,false,1);
 g.addThreat(-6,13,-6,-18,.5,999);
 const before=g.score;g.damageNode(n,10000);
 assert.ok(g.bullets.filter(b=>b.enemy).every(b=>b.dead));
 assert.ok(g.bullets.some(b=>!b.enemy&&!b.dead),'friendly shots unaffected');
 assert.ok(g.threats.every(t=>t.dead));
 assert.ok(g.score>=before+2500);
 assert.ok(g.drainEvents().some(e=>e.type==='fieldclear'&&e.text.includes('敵弾')));
});
test('On-screen objective benefits describe real suppression and boss armor rule',()=>{
 assert.match(fieldRewardLabel(0,0),/射撃停止/);
 assert.match(fieldRewardLabel(1,0),/ボス装甲/);
 assert.match(fieldRewardLabel(2,0),/15%/);
 assert.match(fieldRewardLabel(0,1),/強化/);
});
test('Facility countdown is finite and decreases as it crosses the shooting lane',()=>{
 const {g,n}=spawned();const start=fieldPresentation(n).timeLeft;
 n.age+=2.25;assert.ok(fieldPresentation(n).timeLeft<start);
 n.age=100;assert.equal(fieldPresentation(n).timeLeft,0);
});
