import test from 'node:test';
import assert from 'node:assert/strict';
import {
 STAGE1,crossedDistance,distanceToScriptSeconds,missionProgress,
 enemyFlightOffset,enemyFlightSpeed,interceptTarget,ringMilestone,contextualManeuver
} from '../app/flight-stage-direction.ts';
import {gateCount,gateZ} from '../app/flight-terrain.ts';

test('opening stage follows physical narrative order, irrespective of boost/brake time',()=>{
 assert.ok(STAGE1.checkpoint<STAGE1.escortEncounter);
 assert.ok(STAGE1.escortEncounter<STAGE1.escortDeadline);
 assert.ok(STAGE1.escortDeadline<-gateZ(0));
 assert.ok(-gateZ(gateCount()-1)<STAGE1.waterfallApproach);
 assert.ok(STAGE1.waterfallApproach<STAGE1.waterfallPassage);
 assert.ok(STAGE1.waterfallPassage<STAGE1.boss);
 assert.equal(crossedDistance(-1000,-1085,STAGE1.checkpoint),true);
 assert.equal(crossedDistance(-1300,-1325,STAGE1.escortEncounter),true);
 assert.equal(crossedDistance(-1080,-1075,STAGE1.checkpoint),false);
 assert.equal(distanceToScriptSeconds(-228),3);
});
test('distance drives score/progress bar instead of wall clock or throttle',()=>{
 assert.equal(missionProgress(0,true,50,55),0);
 assert.equal(missionProgress(STAGE1.boss,true,0,55),1);
 assert.equal(missionProgress(STAGE1.boss*.5,true,42,55),.5);
 assert.equal(missionProgress(0,false,30,60),.5);
});
test('enemy formations each have distinct readable lateral/y-motions with continuous sampling',()=>{
 const types=['vee','crossfire','squad','intercept','pincer','heavy','flypast'];
 for(const type of types){
  const start=enemyFlightOffset(type,0,1,.31);
  const midway=enemyFlightOffset(type,1.5,1,.31);
  const end=enemyFlightOffset(type,3.0,1,.31);
  for(const v of [start,midway,end])assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z));
  assert.ok(Math.hypot(end.x-start.x,end.y-start.y)>.45,'enemy fails to maneuver: '+type);
  assert.ok(Number.isFinite(enemyFlightSpeed(type)));
  assert.ok(enemyFlightSpeed(type)<=60&&enemyFlightSpeed(type)>=-50);
  const dt=.001,one=enemyFlightOffset(type,1.5,1,.31),two=enemyFlightOffset(type,1.5+dt,1,.31);
  assert.ok(Math.hypot(one.x-two.x,one.y-two.y)<.2,'trajectory snaps suddenly: '+type);
 }
 assert.ok(enemyFlightSpeed('flypast')>enemyFlightSpeed('squad'));
});
test('hostile fire leads the moving ship by a finite bounded amount',()=>{
 const e={x:0,y:0,z:-100},p={x:6,y:4,z:-40};
 const still=interceptTarget(e,p,{x:0,y:0,z:0},90);
 const moving=interceptTarget(e,p,{x:14,y:3,z:-76},90);
 assert.deepEqual(still,p);
 assert.ok(moving.x>still.x);
 assert.ok(moving.z<still.z);
 assert.ok(Math.abs(moving.z-still.z)<60);
});
test('manual gold ring milestones: every third expands shield, sixth adds ship',()=>{
 assert.equal(ringMilestone(0),null);
 assert.equal(ringMilestone(1),null);
 assert.equal(ringMilestone(3),'shield');
 assert.equal(ringMilestone(6),'life');
 assert.equal(ringMilestone(9),'shield');
 assert.equal(ringMilestone(12),'life');
});

test('Star Fox contextual maneuvers depend on active pitch and flight mode',()=>{
 assert.equal(contextualManeuver(true,true,false,false),'loop');
 assert.equal(contextualManeuver(true,true,false,true),'loop');
 assert.equal(contextualManeuver(true,false,true,true),'uturn');
 assert.equal(contextualManeuver(true,false,true,false),null);
 assert.equal(contextualManeuver(false,true,false,true),null);
 assert.equal(contextualManeuver(true,true,true,true),'loop');
});
