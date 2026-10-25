import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEED_MULTIPLIER, cruiseSpeed, boostSpeed, laserSpeed, missileSpeed, enemySpawnRange, displaySpeed, sweptCollision } from '../app/flight3d-tuning.ts';

test('flight speed is exactly triple the previous normal and boost velocities', () => {
  for (let stage = 0; stage < 6; stage++)
    assert.ok(Math.abs(cruiseSpeed(stage) - (20 + stage * 1.3) * 3) < 1e-8);
  assert.equal(SPEED_MULTIPLIER, 3);
  assert.equal(boostSpeed(), 135);
  assert.equal(displaySpeed(cruiseSpeed(0)), 720);
  assert.equal(displaySpeed(boostSpeed()), 1620);
});
test('forward rounds never fall behind a boosting player', () => {
  for (let stage = 0; stage < 6; stage++) {
    for (const speed of [cruiseSpeed(stage), boostSpeed()]) {
      assert.ok(laserSpeed(speed) > speed);
      assert.ok(missileSpeed(speed) > speed);
      assert.ok(enemySpawnRange > speed);
      assert.ok(enemySpawnRange / speed > 1.4);
    }
  }
});

test('continuous swept collision catches full-speed tunnelling in 3D', () => {
  const ship0={x:0,y:1,z:0},ship1={x:0,y:1,z:-6};
  const foe={x:0,y:1,z:-3};
  assert.equal(sweptCollision(ship0,ship1,foe,foe,1),true);
  assert.equal(sweptCollision(ship0,ship1,{x:5,y:1,z:-3},{x:5,y:1,z:-3},1),false);
  assert.equal(sweptCollision(ship0,ship1,{x:3,y:1,z:-3},{x:-3,y:1,z:-3},.8),true);
  assert.equal(sweptCollision(ship0,ship0,ship0,ship0,.5),true);
});
