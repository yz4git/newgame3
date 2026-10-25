import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEED_MULTIPLIER, cruiseSpeed, boostSpeed, laserSpeed, missileSpeed, enemySpawnRange, displaySpeed } from '../app/flight3d-tuning.ts';

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
