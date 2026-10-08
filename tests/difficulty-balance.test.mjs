import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES,SHIPS} from '../app/sim.ts';
import {DIFFICULTY_BALANCE,stageRecovery,regainBombAfterHit} from '../app/difficulty-balance.ts';
import {startSectorMission} from '../app/sector-missions.ts';
const still={x:0,y:0,focus:false};
test('Difficulty profiles make score extends, free hull, boss endurance and invulnerability distinct',()=>{
 const a=DIFFICULTY_BALANCE;
 assert.ok(a.casual.extendEvery<a.normal.extendEvery&&a.normal.extendEvery<a.expert.extendEvery);
 assert.ok(a.casual.hitInvulnerable>a.normal.hitInvulnerable&&a.normal.hitInvulnerable>a.expert.hitInvulnerable);
 assert.ok(a.casual.bossHealth<a.normal.bossHealth&&a.normal.bossHealth<a.expert.bossHealth);
 assert.ok(a.casual.missionHealth<a.normal.missionHealth&&a.normal.missionHealth<a.expert.missionHealth);
});
test('Score extends no longer supply a guaranteed free hull every 80k on Expert',()=>{
 for(const difficulty of ['casual','normal','expert']){
  const g=new Game();g.start('campaign',difficulty);
  g.hull=1;
  const n=DIFFICULTY_BALANCE[difficulty].extendEvery;
  g.addScore(n-1);assert.equal(g.hull,1);
  g.addScore(1);assert.equal(g.hull,2);
 }
});
test('Normal and Expert preserve saved NOVAs rather than returning a bomb on every hit',()=>{
 for(const [difficulty,bombs,expected] of [
  ['casual',2,3],['normal',3,3],['normal',2,2],['normal',0,1],['expert',2,2],['expert',0,0]
 ]){
  const g=new Game();g.start('campaign',difficulty);g.bombs=bombs;g.invulnerable=0;
  const hp=g.hull;g.hitPlayer();
  assert.equal(g.hull,hp-1,difficulty);
  assert.equal(g.bombs,expected,difficulty+' '+bombs);
  assert.equal(g.invulnerable,DIFFICULTY_BALANCE[difficulty].hitInvulnerable);
 }
});
test('Stage recovery retains a low-hull safety net without erasing difficulty difference',()=>{
 const cases=[['casual',3,4],['normal',3,3],['normal',2,3],['expert',2,2],['expert',1,2]];
 for(const [difficulty,health,wanted] of cases){
  const g=new Game();g.start('campaign',difficulty);g.hull=health;
  g.state='transition';g.transitionTime=STEP;
  g.update(STEP,still);
  assert.equal(g.stage,1);assert.equal(g.hull,wanted,difficulty+' / '+health);
 }
 assert.equal(stageRecovery(4,'normal'),0);
 assert.equal(regainBombAfterHit(0,'normal'),1);
});
test('Risky glass-cannon Falcon does meaningfully more damage but has one less initial hull',()=>{
 assert.ok(SHIPS.falcon.speed>SHIPS.striker.speed);
 assert.ok(SHIPS.falcon.damage>=1.15);
 assert.ok(SHIPS.falcon.damage>SHIPS.bulwark.damage*1.20);
 const f=new Game();f.start('campaign','normal',0,'falcon');
 const b=new Game();b.start('campaign','normal',0,'bulwark');
 assert.equal(f.hull+2,b.hull);f.update(STEP,still);b.update(STEP,still);
 assert.ok(f.bullets[0].damage>b.bullets[0].damage);
});
test('All six boss stages reflect selected difficulty with no hidden loss of phases',()=>{
 for(let i=0;i<STAGES.length;i++){
  const bosses=['casual','normal','expert'].map(d=>{const g=new Game();g.start('campaign',d,i);g.spawnBoss();return g.boss;});
  assert.ok(bosses[0].maxHp<bosses[1].maxHp&&bosses[1].maxHp<bosses[2].maxHp);
  assert.equal(bosses[1].maxHp,460+i*220);
  assert.ok(bosses.every(b=>b.phase===1&&b.hp===b.maxHp));
 }
});
test('Late-stage priority missions now require focused shooting, but gain a fair window',()=>{
 for(let i=0;i<6;i++){
  for(const diff of ['casual','normal','expert']){
   const g=new Game();g.start('campaign',diff,i);
   g.battlefield.outcomes=['destroyed',null];
   startSectorMission(g);
   const n=g.nodes.find(x=>x.attach==='mission');
   assert.ok(n);assert.equal(n.life,12.4);assert.ok(n.hp>50);
   assert.equal(g.sectorMission.timeLeft,12.4);
   assert.ok(n.maxHp<200);
  }
 }
});
