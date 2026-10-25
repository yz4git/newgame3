import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RAIL_X_MAX,CAMERA_DEADZONE,railCameraPan,railCameraPanY,
 railMoveTarget,railViewportOffset,railEdgeWarning,railAimPoint
} from '../app/flight-corridor-scroll.ts';
import {routeCenter} from '../app/nova64-rules.ts';

test('wide rail world allows movement far beyond original +-9.4 corridor',()=>{
 assert.ok(RAIL_X_MAX>=40);
 assert.equal(railMoveTarget(0,42),42);
 assert.equal(railMoveTarget(30,90),RAIL_X_MAX);
 assert.equal(railMoveTarget(-30,-90),-RAIL_X_MAX);
});
test('camera dead zone: ship moves on screen before scenery scrolls',()=>{
 for(const x of [-CAMERA_DEADZONE,0,CAMERA_DEADZONE]){
  assert.equal(railCameraPan(x),0);
  assert.equal(railViewportOffset(x),x);
 }
 assert.ok(railCameraPan(44)>28);
 assert.ok(railCameraPan(-44)<-28);
 assert.ok(railViewportOffset(44)>7 && railViewportOffset(44)<10);
 assert.ok(railViewportOffset(-44)<-7 && railViewportOffset(-44)>-10);
});
test('camera pan is smooth, monotonic, bounded, symmetric and continuous at dead zone',()=>{
 const d=1e-6;
 assert.ok(Math.abs(railCameraPan(CAMERA_DEADZONE+d))<d);
 let previous=-Infinity;
 for(let x=-RAIL_X_MAX;x<=RAIL_X_MAX;x+=.25){
  const pan=railCameraPan(x);
  assert.ok(Number.isFinite(pan));
  assert.ok(pan>=previous);
  assert.ok(Math.abs(pan)<=RAIL_X_MAX);
  assert.ok(Math.abs(pan+railCameraPan(-x))<1e-9);
  previous=pan;
 }
 assert.ok(railCameraPanY(8)>railCameraPanY(-5));
});
test('edge alert is hidden in center and peaks only at physical screen limits',()=>{
 assert.equal(railEdgeWarning(0),0);
 assert.equal(railEdgeWarning(36),0);
 assert.ok(railEdgeWarning(42)>.4);
 assert.equal(railEdgeWarning(RAIL_X_MAX),1);
 assert.equal(railEdgeWarning(-RAIL_X_MAX),1);
});
test('reticle and lasers follow the world-space ship across full flight width',()=>{
 for(const x of [-44,-20,0,20,44]){
  const z=-350,aim=railAimPoint(0,z,x,2,145);
  const center=routeCenter(0,z-145);
  assert.equal(aim.z,z-145);
  assert.ok(Math.abs(aim.x-center.x-x*.96)<1e-8);
  assert.ok(aim.x>center.x-45 && aim.x<center.x+45);
 }
});

test('screen-edge craft has room for full wings even with 44-unit rail travel',()=>{
 assert.ok(railCameraPan(44)>35);
 assert.ok(railViewportOffset(44)<10);
 assert.ok(railViewportOffset(-44)>-10);
});
