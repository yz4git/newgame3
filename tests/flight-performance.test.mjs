import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRenderScale,adaptivePixelRatio,MIN_RENDER_SCALE} from '../app/flight-performance.ts';
test('render quality only steps down after sustained low FPS',()=>{
 assert.equal(nextRenderScale(1,12,1,0),1);
 assert.equal(nextRenderScale(1,12,2.8,0),.84);
 assert.equal(nextRenderScale(.84,12,2.8,0),.68);
 assert.equal(nextRenderScale(.68,12,2.8,0),MIN_RENDER_SCALE);
});
test('renderer recovers slowly and never exceeds native maximum',()=>{
 assert.equal(nextRenderScale(.67,60,1,1),.67);
 assert.equal(nextRenderScale(.67,60,0,7),.77);
 assert.equal(nextRenderScale(1,60,0,7),1);
 assert.equal(nextRenderScale(.84,42,5,12),.84);
 assert.ok(Math.abs(adaptivePixelRatio(1.35,.67)-.9045)<1e-9);
 assert.equal(adaptivePixelRatio(1.35,1),1.35);
});
