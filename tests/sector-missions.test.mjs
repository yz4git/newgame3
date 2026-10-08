import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {SECTOR_MISSIONS,startSectorMission,updateSectorMission,initialSectorMission,resetSectorMission} from '../app/sector-missions.ts';
const idle={x:0,y:0,focus:false};
function ready(stage=0,outcome='destroyed'){
 const g=new Game();g.start('campaign','normal',stage);
 g.battlefield.seen=[true,true];g.battlefield.outcomes=[outcome,null];
 g.battlefield.stageDestroyed=outcome==='destroyed'?1:0;
 g.battlefield.stageEscaped=outcome==='escaped'?1:0;
 g.encounterSeen.stage=true;g.encounterSeen.mini=true;
 g.time=STAGES[stage].duration*.76+.1;g.update(STEP,idle);
 const n=g.nodes.find(n=>n.attach==='mission'&&!n.dead);
 assert.ok(n,'mission spawned on sector '+stage);
 return {g,n};
}
test('Six sectors each get a unique named, time-bounded late event',()=>{
 assert.equal(SECTOR_MISSIONS.length,STAGES.length);
 assert.equal(new Set(SECTOR_MISSIONS.map(p=>p.name)).size,6);
 for(let stage=0;stage<6;stage++){
  const {g,n}=ready(stage);
  assert.equal(g.sectorMission.name,SECTOR_MISSIONS[stage].safe);
  assert.equal(g.sectorMission.route,'secure');assert.equal(g.sectorMission.active,true);
  assert.equal(n.radius,1.6);assert.ok(n.hp>0&&n.maxHp>0);
  assert.ok(g.sectorMission.timeLeft>0);
 }
});
test('First facility fate determines branch even if second facility was later destroyed',()=>{
 const g=new Game();g.start();
 g.battlefield.outcomes=['escaped','destroyed'];g.battlefield.stageDestroyed=1;
 g.battlefield.seen=[true,true];g.encounterSeen={stage:true,mini:true};
 g.time=STAGES[0].duration*.8;g.update(STEP,idle);
 assert.equal(g.sectorMission.route,'intercept');
 assert.equal(g.sectorMission.name,SECTOR_MISSIONS[0].risky);
});
test('Destroying a mission target rewards the player once and weakens the boss',()=>{
 const {g,n}=ready(1);
 const before=g.score,baseHp=100+g.stage*45;
 g.damageNode(n,n.maxHp+5);
 assert.equal(g.sectorMission.result,'success');assert.equal(g.sectorMission.totalSuccess,1);
 assert.ok(g.score>=before+3600);assert.equal(g.sectorMission.active,false);
 assert.ok(g.pickups.some(p=>p.type==='repair'));
 g.damageNode(n,1000);assert.equal(g.sectorMission.totalSuccess,1);
 const event=g.drainEvents().find(e=>e.type==='missionclear');assert.ok(event);
 g.spawnBoss();
 assert.ok(g.boss.parts[0]<baseHp);
});
test('Escaping mission objective changes boss outcome, only once',()=>{
 const {g,n}=ready(4,'escaped');
 const hpBefore=n.hp;n.age=n.life-.025;
 updateSectorMission(g,.05);
 assert.equal(g.sectorMission.result,'failed');assert.equal(g.sectorMission.totalFailed,1);
 assert.equal(n.dead,true);
 updateSectorMission(g,.05);assert.equal(g.sectorMission.totalFailed,1);
 assert.equal(n.hp,hpBefore);
 g.spawnBoss();assert.ok(g.boss.parts[0]>(100+g.stage*45));
});
test('Completing intercept mission cancels some added risk compared to failure',()=>{
 const ok=ready(3,'escaped'),fail=ready(3,'escaped');
 ok.g.damageNode(ok.n,999);
 fail.n.age=fail.n.life;updateSectorMission(fail.g,.01);
 ok.g.spawnBoss();fail.g.spawnBoss();
 assert.ok(ok.g.boss.parts[0]<fail.g.boss.parts[0]);
});
test('Mission stage reset preserves cumulative totals and removes timers',()=>{
 const {g,n}=ready(2);g.damageNode(n,999);
 g.sectorMission.stageSuccess=1;
 resetSectorMission(g);
 assert.equal(g.sectorMission.active,false);assert.equal(g.sectorMission.started,false);
 assert.equal(g.sectorMission.stageSuccess,0);
 assert.equal(g.sectorMission.totalSuccess,1);
});
test('Midboss still active prevents a late mission from unfairly overlapping',()=>{
 const g=new Game();g.start();g.battlefield.seen=[true,true];
 g.encounterSeen={stage:true,mini:true};
 g.encounter={id:999,stage:0,x:0,y:8,hp:90,maxHp:90,age:0,shoot:2,flash:0,attack:0,cycle:0,dead:false};
 g.time=STAGES[0].duration*.8;
 startSectorMission(g); // direct API supports mission start, normal update defers.
 assert.equal(g.sectorMission.started,true);
 const h=new Game();h.start();h.battlefield.seen=[true,true];
 h.encounterSeen={stage:true,mini:true};h.encounter={...g.encounter};
 h.time=STAGES[0].duration*.8;
 h.update(STEP,idle);assert.equal(h.sectorMission.started,false);
 h.encounter=null;h.update(STEP,idle);assert.equal(h.sectorMission.started,true);
});
test('Boss rush and caravan cannot launch campaign-only missions',()=>{
 for(const mode of ['bossrush','caravan']){
  const g=new Game();g.start(mode);g.time=STAGES[0].duration*.95;
  startSectorMission(g);updateSectorMission(g,1);
  assert.equal(g.sectorMission.active,false);assert.equal(g.nodes.filter(n=>n.attach==='mission').length,0);
 }
});
test('Mission state serialization remains bounded and consistent during long simulations',()=>{
 const {g,n}=ready();g.drainEvents();
 g.invulnerable=900;
 for(let i=0;i<300&&g.state==='playing';i++){
  g.update(STEP,idle);g.drainEvents();
  assert.ok(g.nodes.filter(x=>x.attach==='mission'&&!x.dead).length<=1);
  assert.ok(g.events.length<=600);
 }
 assert.equal(g.sectorMission.totalSuccess+g.sectorMission.totalFailed,1);
});
