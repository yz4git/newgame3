import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,segmentDistance2,STAGES} from '../app/sim.ts';
const still={x:0,y:0,focus:false};
test('Fast projectiles use a swept collision segment',()=>{
  assert.equal(segmentDistance2(0,-5,0,5,0,0),0);
  assert.equal(segmentDistance2(0,-5,0,5,2,0),4);
  const game=new Game();game.start();game.time=1;const e=game.spawn('drone',0,0);
  game.bullets.push({id:99,x:0,y:-2,px:0,py:-2,vx:0,vy:300,radius:.18,damage:10,enemy:false,homing:false,weapon:'wide',age:0,dead:false,grazed:false,hits:[],color:0});
  game.update(STEP,still);assert.ok(e.dead,'A shot crossing the whole enemy in one tick must hit');
});
test('Emergency NOVA clears danger immediately and preserves the run',()=>{
  const g=new Game();g.start();g.invulnerable=0;g.hull=1;
  g.bullets.push({id:99,x:0,y:-10.5,px:0,py:-10.5,vx:0,vy:-12,radius:.25,damage:1,enemy:true,homing:false,weapon:'wide',age:0,dead:false,grazed:false,hits:[],color:0});
  assert.ok(g.nova());g.update(STEP,still);assert.equal(g.hull,1);assert.equal(g.bombs,2);assert.ok(g.invulnerable>2);assert.ok(!g.bullets.some(b=>b.enemy));
});
test('Damage offers invulnerability and a recovery supply without resetting the session',()=>{
  const g=new Game();g.start();g.invulnerable=0;g.power=4;g.hull=3;g.hitPlayer();g.hitPlayer();
  assert.equal(g.hull,2);assert.equal(g.power,3);assert.equal(g.state,'playing');assert.ok(g.pickups.some(p=>p.type==='power'));
});
test('Pause freezes combat clocks and resumes the previous transition state',()=>{
  const g=new Game();g.start();g.update(STEP,still);const t=g.totalTime;g.pause();for(let i=0;i<100;i++)g.update(STEP,still);
  assert.equal(g.totalTime,t);g.resume();g.update(STEP,still);assert.ok(g.totalTime>t);
  g.state='transition';g.transitionTime=3;g.pause();g.resume();assert.equal(g.state,'transition');
});
test('Identical fixed-step input gives an identical seeded encounter',()=>{
  const a=new Game(),b=new Game();a.start();b.start();
  for(let i=0;i<3600;i++){const input={x:Math.sin(i/80),y:Math.cos(i/190)*.3,focus:i%500<80};a.update(STEP,input);b.update(STEP,input);}
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.bullets,b.bullets);
});
test('All six sectors and bosses can be cleared with ordinary weapon collision',()=>{
  const g=new Game();g.start('campaign','normal');g.weapon='laser';g.power=2;
  const sectors=new Set();
  for(let i=0;i<60*600&&g.state!=='result';i++){
    g.invulnerable=1;sectors.add(g.stage);const target={x:g.boss?.x??Math.sin(g.time*.8)*6,y:-9};
    g.update(STEP,{x:0,y:0,focus:false,target});g.drainEvents();
    assert.ok(g.bullets.length<=721);assert.ok(g.enemies.length<100);
  }
  assert.equal(sectors.size,STAGES.length);assert.equal(g.state,'result');assert.equal(g.won,true);assert.ok(g.score>30000);
});
test('Stage selection starts the requested sector with a clean encounter and never changes Caravan',()=>{
  const g=new Game();
  for(let stage=0;stage<STAGES.length;stage++){
    g.start('campaign','casual',stage);assert.equal(g.stage,stage);assert.equal(g.time,0);assert.equal(g.boss,null);
    assert.equal(g.drainEvents()[0].text,STAGES[stage].name);
    g.spawnBoss();g.boss.age=8;assert.ok(g.attackName().length>0);
  }
  g.start('campaign','normal',99);assert.equal(g.stage,STAGES.length-1);
  g.start('campaign','normal',-3);assert.equal(g.stage,0);
  g.start('caravan','normal',5);assert.equal(g.stage,0);
});
test('Caravan always ends at two minutes, including during a boss fight',()=>{
  const g=new Game();g.start('caravan');
  for(let i=0;i<60*122&&g.state!=='result';i++){g.invulnerable=1;g.update(STEP,still);g.drainEvents();}
  assert.equal(g.state,'result');assert.equal(g.won,true);assert.ok(Math.abs(g.totalTime-120)<STEP*1.1);
});

test('Guided weapons preserve speed and cannot exceed their turning limit',async()=>{
  const {turnToward}=await import('../app/sim.ts');
  const v=turnToward(0,40,100,0,.2);
  assert.ok(Math.abs(Math.hypot(v.vx,v.vy)-40)<1e-9);
  assert.ok(Math.abs(Math.atan2(v.vy,v.vx)-(Math.PI/2-.2))<1e-9);
});
test('Focus acquires multiple targets and releases locks when focus ends',()=>{
  const g=new Game();g.start();g.weapon='homing';g.power=2;
  // Keep both targets alive while testing acquisition and release at faster speeds.
  for(const x of[-3,3]){const e=g.spawn('fighter',x,11);e.hp=e.maxHp=100;}
  for(let i=0;i<28;i++)g.update(STEP,{...still,focus:true});
  assert.equal(g.locks.filter(l=>l.progress===1).length,2);
  assert.ok(g.bullets.some(b=>b.targetId!==undefined&&b.trail.length>0));
  g.update(STEP,still);assert.equal(g.locks.length,0);
});
function enemyBullet(id,x,y,source){return {id,x,y,px:x,py:y,vx:0,vy:-5,radius:.24,damage:1,enemy:true,homing:false,weapon:'wide',age:0,dead:false,grazed:false,hits:[],color:0xffcc88,source};}
test('A reactor detonation damages neighbours and cancels only local threats',()=>{
  const g=new Game();g.start();const cruiser=g.spawn('cruiser',0,3),near=g.spawn('fighter',2,3),far=g.spawn('fighter',8,3);
  g.bullets.push(enemyBullet(300,1,2),enemyBullet(301,9,2));
  g.damageEnemy(cruiser,100);
  assert.ok(near.dead);assert.ok(!far.dead);assert.equal(g.resonances,1);assert.equal(g.cancelled,1);
  assert.equal(g.bullets[0].dead,true);assert.equal(g.bullets[1].dead,false);
});
test('A turret snapshots its aim with a visible preparation window',()=>{
  const g=new Game();g.start();const tank=g.spawn('tank',5,8);tank.shoot=-2;g.player.x=-4;
  g.update(STEP,still);assert.equal(tank.charging,true);assert.equal(tank.aimX,-4);
  assert.ok(tank.shoot>.45);assert.ok(!g.bullets.some(b=>b.enemy));
  g.player.x=8;for(let i=0;i<32;i++)g.update(STEP,still);
  const bullet=g.bullets.find(b=>b.enemy&&b.source===tank.id);assert.ok(bullet);assert.ok(bullet.vx<0,'The shot must travel to the locked position, not the new player position');
});
test('Breaking a separated boss wing cancels its bullets and keeps other sources',async()=>{
  const {bossPartPosition}=await import('../app/sim.ts');
  const g=new Game();g.start();g.stage=1;g.spawnBoss();g.boss.y=9;g.boss.age=12;g.boss.x=Math.sin(12*.55)*2.8;g.boss.spread=1.6;
  g.boss.parts[0]=1;const pos=bossPartPosition(g.boss,0);
  g.bullets.push(enemyBullet(401,4,-8,g.boss.id+1),enemyBullet(402,7,-8,g.boss.id+2));
  g.bullets.push({...enemyBullet(403,pos.x,pos.y-.5),enemy:false,vy:60,damage:10,weapon:'laser'});
  g.update(STEP,still);
  assert.equal(g.boss.parts[0],0);assert.equal(g.cancelled,1);
  assert.ok(g.bullets.some(b=>b.id===402));assert.ok(!g.bullets.some(b=>b.id===401));
});

test('Boss encounters end within a bounded time instead of permitting endless score farming',()=>{
  const g=new Game();g.start();g.time=100;g.spawnBoss();g.boss.encounterTime=89.8;g.boss.y=9;g.player.x=10;g.player.y=-14;
  for(let i=0;i<30&&g.state==='playing';i++){g.invulnerable=3;g.update(STEP,still);}
  assert.equal(g.state,'result');assert.equal(g.won,false);assert.equal(g.failureReason,'timeout');assert.ok(g.boss.hp>0);
});

test('Five new classes telegraph distinct attacks, preserve aim snapshots and stay in projectile bounds',()=>{
 const counts={interceptor:2,bomber:3,corvette:4,sentinel:8,strider:2};for(const kind of Object.keys(counts)){const g=new Game();g.start();g.time=5;g.waveIndex=999;g.player.x=-6;g.shotTimer=100;const e=g.spawn(kind,5,10);e.hp=e.maxHp=100;e.shoot=0;g.update(STEP,still);assert.ok(e.charging);assert.equal(e.aimX,-6);assert.ok(e.shoot>.45);assert.equal(g.bullets.filter(b=>b.source===e.id).length,0);g.player.x=6;for(let i=0;i<32;i++)g.update(STEP,still);const shots=g.bullets.filter(b=>b.source===e.id);assert.equal(shots.length,counts[kind]);if(kind==='bomber')assert.ok(shots.every(b=>b.shape==='missile'&&b.accel>0));if(kind==='sentinel')assert.ok(shots.every(b=>b.shape==='diamond'&&Math.abs(b.turn)>0));if(kind!=='sentinel')assert.ok(shots.some(b=>b.vx<0));assert.equal(e.ground,kind==='strider');}
});
test('Opening sector introduces all five new classes through ordinary scheduled waves',()=>{
 const g=new Game();g.start();g.invulnerable=1000;g.shotTimer=1000;const kinds=new Set();for(let i=0;i<60*30;i++){g.update(STEP,still);g.enemies.forEach(e=>kinds.add(e.kind));g.drainEvents();}for(const kind of ['interceptor','bomber','corvette','sentinel','strider'])assert.ok(kinds.has(kind),kind+' must be reachable in normal play');
});
