import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {playerPose,enemyPose,bossPose,worldClock,stageCue} from '../app/motion.ts';
const idle={x:0,y:0,focus:false};

test('Pause freezes poses, weather and scripted communications; retry restarts their clocks',()=>{
  const launch=new Game();launch.start();launch.update(STEP,idle);const launchPose=playerPose(launch);launch.pause();assert.deepEqual(playerPose(launch),launchPose);
  const g=new Game();g.start('campaign','normal',3);for(let i=0;i<160;i++)g.update(STEP,idle);
  const e=g.spawn('fighter',4,10);e.age=1.8;const before={pose:playerPose(g),enemy:enemyPose(e,g.player),cue:stageCue(g),clock:worldClock(g),visual:g.visualTime};
  g.pause();for(let i=0;i<120;i++)g.update(STEP,idle);
  assert.deepEqual(playerPose(g),before.pose);assert.deepEqual(enemyPose(e,g.player),before.enemy);assert.equal(worldClock(g),before.clock);assert.equal(g.visualTime,before.visual);
  g.resume();assert.deepEqual(stageCue(g),before.cue);g.start('campaign','normal',3);assert.equal(g.visualTime,0);assert.equal(worldClock(g),0);assert.equal(stageCue(g).kind,'intro');
});
test('Stage-specific radio cues and boss arrival play once in bounded windows without changing combat',()=>{
  const lines=new Set();for(let stage=0;stage<STAGES.length;stage++){
    const g=new Game();g.start('campaign','normal',stage);g.time=6;const before=g.snapshot();lines.add(stageCue(g).text);for(let i=0;i<60;i++)stageCue(g);assert.deepEqual(g.snapshot(),before);
    g.time=12;assert.equal(stageCue(g),null);g.spawnBoss();assert.equal(stageCue(g).kind,'boss');g.boss.age=3.1;assert.equal(stageCue(g),null);
  }assert.equal(lines.size,6);
});
test('Movement, focus, overdrive, charging and real shots drive distinct poses with finite values',()=>{
  const g=new Game();g.start();g.time=5;g.player.vx=18;assert.equal(playerPose(g).mode,'bank');g.player.focus=true;assert.equal(playerPose(g).mode,'focus');g.overdrive=1;assert.equal(playerPose(g).mode,'overdrive');
  const e=g.spawn('tank',-6,10);e.charging=true;e.shoot=.06;e.aimX=4;e.aimY=-10;assert.equal(enemyPose(e,g.player).mode,'charge');assert.ok(enemyPose(e,g.player).charge>.9);assert.ok(enemyPose(e,g.player).turret>0);
  g.overdrive=0;e.shoot=.01;g.update(STEP,idle);assert.ok(g.bullets.some(b=>b.enemy&&b.source===e.id));assert.ok(e.recoil>0);assert.equal(enemyPose(e,g.player).mode,'fire');
  for(const kind of ['drone','dart','fighter','tank','cruiser','carrier','relic','weaver','lancer']){const enemy=g.spawn(kind,3,8);enemy.age=2;for(const value of Object.values(enemyPose(enemy,g.player)))if(typeof value==='number')assert.ok(Number.isFinite(value));}
});
test('Boss armour opens during vulnerability and death transition scenery keeps moving without advancing combat',()=>{
  const g=new Game();g.start();g.spawnBoss();const b=g.boss;b.age=10;const closed=bossPose(b);b.rest=true;assert.ok(bossPose(b).open>closed.open);b.phase=2;b.rest=false;assert.equal(bossPose(b).mode,'enraged');
  g.state='transition';g.transitionTime=3.5;const before={time:g.time,visual:g.visualTime};g.update(STEP,idle);assert.equal(g.time,before.time);assert.ok(worldClock(g)>g.time);assert.ok(g.visualTime>before.visual);g.pause();const clock=worldClock(g);g.update(STEP,idle);assert.equal(worldClock(g),clock);
  g.stage=5;g.resume();g.transitionTime=.01;g.boss.dead=true;g.update(STEP,idle);assert.equal(g.state,'result');assert.equal(worldClock(g),g.time+3.5);
});
