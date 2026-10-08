import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP} from '../app/sim.ts';
import {BOSS_FORM_NAMES,selectBossForm,bossRestStart,bossMorph,bossOverchargeVolley} from '../app/boss-evolution.ts';
import {SECTOR_SPECTACLES,missionBeacons} from '../app/mission-spectacle.ts';
import {FinishMotion} from '../app/finish-motion.ts';
const idle={x:0,y:0,focus:false};
function boss(stage=0,result='success'){
 const g=new Game();g.start('campaign','normal',stage);
 g.sectorMission.started=true;g.sectorMission.result=result;
 g.spawnBoss();return g;
}
test('Mission outcome locks exactly one of three boss forms at spawn',()=>{
 const good=boss(0,'success'),bad=boss(0,'failed');
 assert.equal(good.boss.form,'shattered');assert.equal(bad.boss.form,'overcharged');
 assert.equal(new Game().sectorMission.started,false);
 const defaultRun=new Game();defaultRun.start();defaultRun.spawnBoss();
 assert.equal(defaultRun.boss.form,'standard');
 for(const mode of ['caravan','bossrush']){
  const g=new Game();g.start(mode);g.sectorMission.started=true;g.sectorMission.result='failed';
  assert.equal(selectBossForm(g),'standard');
 }
 assert.equal(new Set(Object.values(BOSS_FORM_NAMES)).size,3);
});
test('Form cannot change after mission state changes later',()=>{
 const g=boss(2,'success');
 g.sectorMission.result='failed';g.sectorMission.started=false;
 for(let i=0;i<100;i++){g.update(STEP,idle);g.drainEvents();}
 assert.equal(g.boss.form,'shattered');
});
test('Shattered armor extends safe exposure, stronger form leaves less exposure',()=>{
 const g=boss(1,'success'),h=boss(1,'failed'),s=new Game();
 s.start();s.spawnBoss();
 const base=bossRestStart(s.boss,1,0),success=bossRestStart(g.boss,1,0),failure=bossRestStart(h.boss,1,0);
 assert.ok(success<base);assert.ok(failure>base);
 assert.ok(success>5);assert.ok(failure<9.6);
});
test('Visual morph offsets remain near canonical combat hitboxes',()=>{
 for(const stage of [0,2,4,5]){
  for(const result of ['success','failed']){
   const g=boss(stage,result);
   for(const phase of [1,2,3]){
    g.boss.phase=phase;g.boss.age=7.6;
    const morph=bossMorph(g.boss);
    assert.ok(Number.isFinite(morph.wingDelta)&&Math.abs(morph.wingDelta)<=.4);
    assert.ok(Number.isFinite(morph.petalDelta)&&Math.abs(morph.petalDelta)<=.5);
    assert.ok(morph.glow>0&&morph.halo>0);
   }
  }
 }
});
test('Overcharged laser reinforcement waits for late phase, odd cycles, intact wing',()=>{
 const g=boss(3,'failed'),b=g.boss;b.age=7;b.y=9;b.x=0;
 assert.equal(bossOverchargeVolley(g,b,1),0);
 b.phase=2;assert.equal(bossOverchargeVolley(g,b,0),0);
 assert.equal(bossOverchargeVolley(g,b,1),2);
 assert.equal(g.threats.length,2);
 for(const threat of g.threats){
  assert.ok(threat.warmup>=3.1);
  assert.ok(threat.width<=.32);
  assert.ok(threat.bx<=8&&threat.bx>=-8);
 }
 b.parts[0]=0;g.threats=[];assert.equal(bossOverchargeVolley(g,b,3),1);
 assert.ok(g.threats.every(t=>t.source===b.id+2));
 const safe=boss(3,'success');safe.boss.phase=3;
 assert.equal(bossOverchargeVolley(safe,safe.boss,1),0);
});
test('Destroying a wing removes only its reinforcement source',()=>{
 const g=boss(2,'failed'),b=g.boss;b.phase=2;b.age=6;b.x=0;b.y=9;
 bossOverchargeVolley(g,b,1);
 g.clearSource(b.id+1);
 assert.equal(g.threats.filter(t=>!t.dead).length,1);
 assert.equal(g.threats.find(t=>!t.dead).source,b.id+2);
});
test('Every sector has different authored environmental spectacle parameters',()=>{
 assert.equal(SECTOR_SPECTACLES.length,6);
 assert.equal(new Set(SECTOR_SPECTACLES.map(x=>x.kind)).size,6);
 assert.equal(new Set(SECTOR_SPECTACLES.map(x=>x.color)).size,6);
});
test('Mission energy beacons are deterministic and disappear on mission completion',()=>{
 const g=new Game();g.start();g.addCombatNode('mission',0,1,-2,9,80,12);
 const n=g.nodes.at(-1);g.sectorMission.active=true;g.sectorMission.targetId=n.id;g.sectorMission.timeLeft=10;
 g.visualTime=4.75;
 const before=g.score;
 const a=missionBeacons(g),b=missionBeacons(g);
 assert.ok(a);assert.deepEqual(a,b);assert.equal(a.pieces.length,6);
 assert.ok(a.pieces.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.scale>0&&p.alpha>=0&&p.alpha<=.65));
 assert.equal(g.score,before);
 n.dead=true;assert.equal(missionBeacons(g),null);
});
test('Transformation and mission spectacle events stay inside fixed fragment and wave pools',()=>{
 const motion=new FinishMotion();
 for(let i=0;i<30;i++)for(const type of ['missionstart','missionclear','bossform','bosstransform','bossreinforce'])motion.event({type,x:0,y:9,size:4,color:0xff9877});
 assert.ok(motion.fragments.length<=48);assert.ok(motion.waves.length<=4);
 motion.event({type:'stage'});
 assert.equal(motion.fragments.length,0);assert.equal(motion.waves.length,0);
});
test('Actual boss HP phase transition emits transformation event once',()=>{
 const g=boss(0,'failed'),b=g.boss;
 b.age=3.2;b.y=9;b.phase=1;b.hp=b.maxHp*.49;g.drainEvents();g.invulnerable=1000;
 g.update(STEP,idle);
 assert.equal(b.phase,2);
 assert.equal(g.drainEvents().filter(x=>x.type==='bosstransform').length,1);
 for(let i=0;i<60;i++)g.update(STEP,idle);
 assert.equal(g.drainEvents().filter(x=>x.type==='bosstransform').length,0);
});
