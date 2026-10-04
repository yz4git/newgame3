import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,GAME_SPEED} from '../app/sim.ts';
import {stageDistance} from '../app/bg-map.ts';
const still={x:0,y:0,focus:false};

test('One real second advances scrolling and enemies by 2.25 seconds of combat',()=>{
  const g=new Game();g.start();g.shotTimer=100;const e=g.spawn('drone',9,18);
  for(let i=0;i<60;i++)g.update(STEP,still);
  assert.ok(Math.abs(g.time-GAME_SPEED)<1e-9);
  assert.ok(Math.abs(g.totalTime-1)<1e-9);
  assert.ok(Math.abs(e.y-(18-7*GAME_SPEED))<1e-9);
  assert.ok(Math.abs(stageDistance(g.time)-9.9)<1e-9);
});
test('Player movement and projectiles use the same accelerated combat clock',()=>{
  const g=new Game();g.start();g.shotTimer=100;
  const b={id:99,x:8,y:10,px:8,py:10,vx:0,vy:-6,radius:.24,damage:1,enemy:true,homing:false,weapon:'wide',age:0,dead:false,grazed:false,hits:[],color:0};
  g.bullets.push(b);
  for(let i=0;i<15;i++)g.update(STEP,{x:1,y:0,focus:false});
  assert.ok(Math.abs(g.player.x-18*.25*GAME_SPEED)<1e-9);
  assert.ok(Math.abs(b.y-(10-6*.25*GAME_SPEED))<1e-9);
});
test('Faster boss attacks retain a ninety-second real encounter limit',()=>{
  const g=new Game();g.start();g.time=100;g.spawnBoss();g.shotTimer=100;g.invulnerable=100;
  for(let i=0;i<60;i++)g.update(STEP,still);
  assert.ok(Math.abs(g.boss.age-2.25)<1e-9);
  assert.ok(Math.abs(g.boss.encounterTime-1)<1e-9);
  g.boss.encounterTime=89.9;
  for(let i=0;i<10&&g.state==='playing';i++)g.update(STEP,still);
  assert.equal(g.state,'result');assert.equal(g.failureReason,'timeout');
});
test('Caravan keeps spawning after the accelerated boss fight until the real two-minute end',()=>{
  const g=new Game();g.start('caravan');g.time=110;g.totalTime=110/GAME_SPEED;g.spawnBoss();g.boss.hp=1;
  g.nova();assert.equal(g.boss,null);g.update(STEP,still);g.enemies=[];
  const times=[],spawn=g.spawn.bind(g);g.spawn=(...args)=>{times.push(g.time);return spawn(...args);};
  for(let i=0;i<60*40;i++){g.invulnerable=1;g.update(STEP,still);g.drainEvents();}
  assert.equal(g.state,'playing');assert.ok(times.some(t=>t>160),'Enemies must still arrive after the former four-wave tail');
});
