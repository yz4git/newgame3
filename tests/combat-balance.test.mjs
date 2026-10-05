import test from 'node:test';
import assert from 'node:assert/strict';
import {STEP} from '../app/sim.ts';
import {isolated,emittedDamage,enemyFight,minibossFight,bossFight} from '../scripts/combat-probe.mjs';

const still={x:0,y:0,focus:false};
test('Every armed enemy fires in every formation, keeps its prepared aim and enters cooldown',()=>{
 const counts={tank:2,fighter:5,cruiser:9,weaver:6,lancer:3,dart:1,drone:1,interceptor:2,bomber:3,corvette:4,sentinel:8,strider:2};
 const aimed=new Set(['tank','lancer','dart','drone','interceptor','bomber','corvette','strider']);
 for(const [kind,count] of Object.entries(counts))for(let pattern=0;pattern<=6;pattern++){
  const g=isolated(1);g.shotTimer=1000;g.player.x=-8;g.player.y=-14;
  const e=g.spawn(kind,4,10,0,pattern);e.shoot=0;
  g.update(STEP,still);g.drainEvents();
  assert.ok(e.charging,`${kind}/${pattern}: charge`);assert.equal(e.aimX,-8);
  assert.equal(g.bullets.filter(b=>b.source===e.id).length,0);
  g.player.x=8;let shots=0;
  for(let i=0;i<13;i++){g.update(STEP,still);shots+=g.drainEvents().filter(v=>v.type==='enemyshot'&&v.source===e.id).length;}
  const bullets=g.bullets.filter(b=>b.source===e.id);
  assert.equal(bullets.length,count,`${kind}/${pattern}: volley`);assert.equal(shots,1);
  assert.ok(!e.charging&&e.shoot>1,`${kind}/${pattern}: cooldown`);
  if(aimed.has(kind))assert.ok(bullets.every(b=>b.vx<0),`${kind}/${pattern}: prepared aim`);
  for(let i=0;i<8;i++){g.update(STEP,still);assert.ok(!g.drainEvents().some(v=>v.type==='enemyshot'&&v.source===e.id));}
 }
});
test('Crossing and weaving formations continue moving while charging and firing',()=>{
 for(const pattern of [5,6]){
  const g=isolated(1);g.shotTimer=1000;const e=g.spawn('interceptor',4,10,0,pattern);e.shoot=0;
  const positions=[];
  for(let i=0;i<50;i++){g.update(STEP,still);positions.push(e.x);g.drainEvents();}
  assert.ok(Math.max(...positions)-Math.min(...positions)>.8);assert.ok(e.volley>0);
  assert.ok(g.bullets.some(b=>b.enemy&&b.source===e.id));
 }
});
test('Each power level is useful, while maximum focused output and OVERDRIVE stay bounded',()=>{
 for(const weapon of ['wide','laser','homing']){
  let previous=0;
  for(let power=1;power<=4;power++){
   const out=emittedDamage(weapon,power,true).damagePerSecond;
   assert.ok(out>previous*1.08,`${weapon}: level ${power} should improve output`);previous=out;
   if(power===1)assert.ok(out>=45&&out<=100,`${weapon}: viable base output`);
   if(power===4)assert.ok(out<=170,`${weapon}: maximum single-target output budget`);
  }
  const boost=emittedDamage(weapon,4,true,true).damagePerSecond;
  assert.ok(boost/previous>=1.3&&boost/previous<=1.4,`${weapon}: controlled temporary boost`);
  assert.ok(enemyFight('drone',weapon,1).killed,`${weapon}: base weapon can destroy a scout`);
 }
});
test('The weakest equipment can clear every final boss and intercept every miniboss with ordinary shots',()=>{
 for(const weapon of ['wide','laser','homing'])for(let stage=0;stage<6;stage++){
  const boss=bossFight(stage,weapon,1,true,true);
  assert.ok(boss.killed,`${weapon}/${stage}: boss progression`);assert.ok(boss.seconds<85);
  assert.deepEqual(boss.phases,[1,2,3]);assert.equal(boss.powerAtEnd,1);
  assert.ok(minibossFight(stage,weapon,1).killed,`${weapon}/${stage}: miniboss before withdrawal`);
 }
});
test('A maximum-power laser cannot skip the final furnace fight in a few seconds',()=>{
 const result=bossFight(5,'laser',4);
 assert.ok(result.killed);assert.ok(result.seconds>=9&&result.seconds<16);
 assert.deepEqual(result.phases,[1,2,3]);assert.ok(result.volleys>=12);
});
test('Wide coverage, laser piercing and lock-on tracking retain their separate jobs',()=>{
 const wide=isolated(1,'wide',3);const spread=[-3,0,3].map(x=>wide.spawn('drone',x,10));
 for(let i=0;i<120&&spread.some(e=>!e.dead);i++){wide.update(STEP,still);wide.drainEvents();}
 assert.ok(spread.every(e=>e.hp<=0),'Wide should cover a separated row without tracking');
 const laser=isolated(1,'laser',1);const line=[-3,0,3].map(y=>laser.spawn('drone',0,y));
 for(let i=0;i<35&&line.some(e=>!e.dead);i++){laser.update(STEP,{...still,focus:true});laser.drainEvents();}
 assert.ok(line.every(e=>e.hp<=0),'Laser should pierce aligned enemies');
 const homing=isolated(1,'homing',1),target=homing.spawn('tank',4,9);
 for(let i=0;i<100&&!target.dead;i++){homing.update(STEP,{...still,focus:true});homing.drainEvents();}
 assert.ok(target.hp<=0,'Homing should reach an off-axis target');assert.ok(homing.lockKills>0);
});
test('Three NOVAs suppress danger without removing a fresh boss or miniboss by themselves',async()=>{
 const {spawnMiniboss}=await import('../app/encounters.ts');
 for(const kind of ['boss','mini']){
  const g=isolated();g.shotTimer=1000;
  if(kind==='boss')g.spawnBoss();else spawnMiniboss(g);
  const target=kind==='boss'?g.boss:g.encounter;
  for(let n=0;n<3;n++){
   g.projectile(0,-9,0,-2,true,1,false,0xffa73b,{source:target.id});g.addThreat(0,9,0,-18,.5,target.id);
   assert.ok(g.nova());assert.ok(g.bullets.filter(b=>b.enemy).every(b=>b.dead));
   assert.ok(g.threats.every(t=>t.dead));assert.ok(g.invulnerable>0);
   for(let i=0;i<33;i++){g.update(STEP,still);g.drainEvents();}
  }
  assert.equal(g.bombs,0);assert.ok(!target.dead&&target.hp>0);
  assert.equal(g.state,'playing');
 }
});
