import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ARCADE,combatHitPoints,laserDamage,attackCue,cueDuration,
 bombHits,bombFalloff,comboReward,sightRay
} from '../app/flight-combat-core.ts';

test('ordinary foes fall to a correctly aimed basic laser, while elites remain durable',()=>{
 assert.ok(laserDamage(1)>=combatHitPoints('normal'));
 assert.ok(laserDamage(2)>laserDamage(1));
 assert.ok(laserDamage(3)>laserDamage(2));
 assert.ok(combatHitPoints('elite')>laserDamage(3));
 assert.ok(combatHitPoints('ground')>laserDamage(2));
 assert.equal(combatHitPoints('boss',221),221);
});
test('hostiles expose a readable prefire window and enforce a global bullet budget',()=>{
 assert.equal(attackCue(-.1,100,0),true);
 assert.equal(attackCue(-.1,100,ARCADE.maxHostileBullets),false);
 assert.equal(attackCue(1,100,0),false);
 assert.equal(attackCue(-.1,250,0),false);
 assert.ok(cueDuration(false)>.65);
 assert.ok(cueDuration(true)>cueDuration(false));
});
test('smart bomb detonates against groups in 3D, with falloff toward edge',()=>{
 const center={x:0,y:10,z:-100};
 assert.ok(bombHits(center,{x:20,y:10,z:-100}));
 assert.ok(bombHits(center,{x:43,y:10,z:-100},6));
 assert.equal(bombHits(center,{x:60,y:10,z:-100}),false);
 assert.ok(bombFalloff(center,center)>bombFalloff(center,{x:30,y:10,z:-100}));
 assert.equal(bombFalloff(center,center),1);
 assert.ok(ARCADE.bombFuse>.3&&ARCADE.bombFuse<.75);
});
test('combos reward aimed multi-kills rather than only survival',()=>{
 assert.equal(comboReward(1).points,0);
 assert.equal(comboReward(2).points,0);
 assert.ok(comboReward(3).points>0);
 assert.ok(comboReward(5).points>comboReward(3).points);
 assert.ok(comboReward(10).points>comboReward(5).points);
});
test('both sight frames sit exactly on a single world-space firing ray',()=>{
 const origin={x:13,y:3,z:-60},dir={x:.08,y:-.06,z:-.995};
 const near=sightRay(origin,dir,70),far=sightRay(origin,dir,145);
 for(const axis of ['x','y','z']){
  assert.ok(Math.abs((near[axis]-origin[axis])/70-(far[axis]-origin[axis])/145)<1e-12);
 }
 assert.ok(near.z>far.z);
});
