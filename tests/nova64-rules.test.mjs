import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,routeCenter,routeSelection,scriptWaves,formation,swept,V,clampArena,deflectDuringRoll,ROLL_SECONDS,bossPhase,missionGrade} from '../app/nova64-rules.ts';
test('campaign graph has 6 unique missions, a branch and an all-range finale',()=>{
 assert.equal(MISSIONS.length,6);
 assert.equal(new Set(MISSIONS.map(m=>m.id)).size,6);
 assert.equal(MISSIONS[0].next.length,2);
 assert.equal(MISSIONS[5].mode,'all-range');
 assert.equal(MISSIONS[5].next.length,0);
 for(const m of MISSIONS){assert.ok(m.duration>=50);for(const to of m.next)assert.ok(to>m.id&&to<MISSIONS.length);}
});
test('deterministic stages, authored waves with intervals',()=>{
 for(const m of MISSIONS){
  const waves=scriptWaves(m);
  assert.ok(waves.length>=7);
  assert.ok(waves.every((x,i)=>x.count>=3&&x.at<m.duration&&(i===0||x.at>waves[i-1].at)));
  for(let z=-3000;z<0;z+=101){
   const a=routeCenter(m.scene,z),b=routeCenter(m.scene,z-1);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.2);
  }
 }
});
test('flight manoeuvres, physical sweeps and formations',()=>{
 const forms=['vee','crossfire','squad','intercept','pincer','heavy','flypast'].map(x=>formation(x,0,5,1));
 assert.equal(new Set(forms.map(x=>JSON.stringify(x))).size,7);
 assert.equal(deflectDuringRoll(ROLL_SECONDS),true);
 assert.equal(deflectDuringRoll(0),false);
 assert.equal(swept(V(0,0,0),V(0,0,-10),V(0,0,-5),V(0,0,-5),1),true);
 assert.equal(swept(V(0,0,0),V(0,0,-10),V(6,0,-5),V(6,0,-5),1),false);
 const p=clampArena(V(300,3,0));assert.equal(p.x,175);
});
test('boss phases, routes and grading use achieved performance',()=>{
 assert.equal(bossPhase(100,100),1);assert.equal(bossPhase(50,100),2);assert.equal(bossPhase(10,100),3);
 assert.equal(routeSelection(MISSIONS[0],5,2,false),1);
 assert.equal(routeSelection(MISSIONS[0],16,2,false),2);
 assert.equal(routeSelection(MISSIONS[0],0,0,true),2);
 assert.equal(routeSelection(MISSIONS[3],0,0,false),5);
 assert.equal(missionGrade(0,4,0),'C');
});
