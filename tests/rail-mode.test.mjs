import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_DURATION, createRailWaves, formationOffset, trackCenter, trackYaw, clampRail, rollDeflects, ROLL_DURATION, bossPhase, collisionSegment } from '../app/rail-mode.ts';
test('each of the six routes has deterministic action/relief waves and boss space',()=>{
 for(let stage=0;stage<6;stage++){
  const waves=createRailWaves(stage);
  assert.equal(waves.length,10);
  assert.equal(waves[0].at,2.5);
  assert.ok(waves[9].at<STAGE_DURATION-5);
  assert.ok(waves.every(w=>w.count>=3 && w.count<=5));
  assert.ok(waves.some(w=>w.support));
  assert.ok(waves.every((w,i)=>i===0||w.at>waves[i-1].at));
 }
});
test('rail navigation is continuous and camera yaw is finite',()=>{
 for(let stage=0;stage<6;stage++)for(let z=0;z>-4500;z-=15){
  const p=trackCenter(stage,z);
  const n=trackCenter(stage,z-1);
  assert.ok(Math.abs(p.x-n.x)<.1&&Math.abs(p.y-n.y)<.1);
  assert.ok(Number.isFinite(trackYaw(stage,z)));
 }
});
test('formation design is finite and distinct',()=>{
 const points=['vee','cross','squad','pincer','guard','weave'].map(kind=>formationOffset(kind,0,4,1));
 assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,6);
});
test('barrel roll opens a bounded projectile deflection window',()=>{
 assert.equal(rollDeflects(ROLL_DURATION),true);
 assert.equal(rollDeflects(.25),true);
 assert.equal(rollDeflects(0),false);
 assert.equal(rollDeflects(ROLL_DURATION+1),false);
 assert.equal(bossPhase(100,100),1);
 assert.equal(bossPhase(50,100),2);
 assert.equal(bossPhase(20,100),3);
});
test('steering limits and continuous ray-hit geometry',()=>{
 assert.deepEqual(clampRail(50,-50),{x:9.2,y:-6.1});
 assert.equal(collisionSegment({x:0,y:0,z:0},{x:0,y:0,z:-90},{x:0,y:0,z:-50},1),true);
 assert.equal(collisionSegment({x:0,y:0,z:0},{x:0,y:0,z:-90},{x:6,y:0,z:-50},1),false);
});
