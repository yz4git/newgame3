import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEPTH_SPECTACLE_FEATURES as F,DEPTH_SPECTACLE_BUDGET as B} from '../app/depth-spectacle-spec.ts';

test('3.2 adds at least 16 distinct world-space cinematic behaviors',()=>{
 assert.ok(F.length>=16);
 assert.equal(new Set(F).size,F.length);
 assert.ok(B.maxLuminance<=.6);
});
test('New geometry budgets remain phone-safe and strictly finite',()=>{
 assert.ok(B.tracers<=128&&B.threats<=20&&B.locks<=24);
 assert.ok(B.enemyVortices<=64&&B.ghosts<=12&&B.iris<=8);
 assert.ok(B.pulses<=36&&B.dust<=72&&B.pickups<=24);
});
test('New spectacle is isolated to rebuilt 3D and receives real gameplay events',async()=>{
 const view=await readFile('app/render.ts','utf8');
 assert.match(view,/private depthSpectacle=usesRebuiltGraphics\(\)\?new DepthSpectacle\(\):null/);
 assert.match(view,/this\.depthSpectacle\?\.event\(e\)/);
 assert.match(view,/this\.depthSpectacle\?\.draw\(game,dt/);
 assert.match(view,/depthSpectacle:this\.depthSpectacle\?\.diagnostics\(\)/);
});
test('Reactions are physically positioned, bounded and never fullscreen flashes',async()=>{
 const src=await readFile('app/depth-spectacle.ts','utf8');
 for(const label of ['ballistic-velocity-3d-streaks','threat-telegraph-depth-rails','active-weapon-depth-rods','three-axis-lock-on-gyroscopes','rotating-physical-salvage-orbits','enemy-wing-pressure-vortices','banked-hull-afterimage-fins','boss-reactive-mechanical-iris','nova-physical-expanding-shell','structural-collapse-3d-debris']){
  assert.ok(src.includes(label),label);
 }
 assert.doesNotMatch(src,/new T\.PlaneGeometry|blending:T\.AdditiveBlending|new T\.PointLight/);
 assert.match(src,/this\.dustPool\.length>=CAP\.dust/);
 assert.match(src,/this\.pulsePool\.length>=CAP\.pulses/);
 assert.match(src,/this\.ghosts\.length>CAP\.ghosts/);
 assert.match(src,/this\.root\.visible=active/);
 assert.match(src,/this\.shield\.visible=this\.shieldAge<\.7&&!reduced/);
});
test('Visual component cannot change score, damage, spawn or simulation RNG',async()=>{
 const src=await readFile('app/depth-spectacle.ts','utf8');
 assert.doesNotMatch(src,/Math\.random\(|g\.emit\(|g\.damage\(|g\.score\s*[+\-=]|g\.hull\s*=/);
});
