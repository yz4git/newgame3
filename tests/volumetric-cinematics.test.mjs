import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CINEMATIC_BUDGETS as B,CINEMATIC_FEATURES,CINEMATIC_STAGE_COLORS,CINEMATIC_ENV_MOTION} from '../app/cinematics-spec.ts';
test('World Rebuild cinematic system defines at least 20 independent depth-aware techniques',()=>{
 assert.ok(CINEMATIC_FEATURES.length>=20);
 assert.equal(new Set(CINEMATIC_FEATURES).size,CINEMATIC_FEATURES.length);
 assert.equal(CINEMATIC_STAGE_COLORS.length,6);
 assert.equal(CINEMATIC_ENV_MOTION.length,6);
});
test('Pooled effects respect strict iPhone geometry and visual limits',()=>{
 assert.ok(B.atmosphere<=80&&B.nearFlybys<=16&&B.contrails<=64);
 assert.ok(B.shards<=100&&B.rings<=16&&B.gantries<=3&&B.maxEventsPerFrame<=12);
 assert.ok(B.maxLuminance<=.6);
});
test('Original Classic 2.9.3 never starts the rebuilt 3D cinematic component',async()=>{
 const src=await readFile('app/render.ts','utf8');
 assert.match(src,/private volumetric=usesRebuiltGraphics\(\)\?new VolumetricCinematics\(\):null/);
 assert.match(src,/this\.volumetric\?\.event\(e\)/);
 assert.match(src,/this\.volumetric\?\.draw\(game,dt/);
 const style=await readFile('app/visual-style.ts','utf8');
 assert.match(style,/classic:'Original 2\.9\.3/);
});
test('3D effect groups have actual depth, never full-screen plane blasts',async()=>{
 const s=await readFile('app/volumetric-cinematics.ts','utf8');
 for(const name of ['TetrahedronGeometry','IcosahedronGeometry','TorusGeometry','ConeGeometry','TubeGeometry','CylinderGeometry','BoxGeometry']){
  assert.ok(s.includes(name),name+' required for physical 3D effects');
 }
 assert.match(s,/this\.backdrop\.name='depth-parallax-effects'/);
 assert.match(s,/this\.shipFx\.name='real-engine-volume-and-wingtip-streams'/);
 assert.match(s,/this\.bossHalos/);
 assert.match(s,/this\.warpTunnel/);
 assert.match(s,/this\.enemyJets/);
 assert.match(s,/this\.missileSpirals/);
 assert.doesNotMatch(s,/new T\.PlaneGeometry/);
});
test('Destruction debris, shockwaves and contrails are bounded and recycled',async()=>{
 const s=await readFile('app/volumetric-cinematics.ts','utf8');
 assert.match(s,/this\.shardPool\.length>=LIMIT\.shards/);
 assert.match(s,/this\.trailPool\.length>=LIMIT\.contrails/);
 assert.match(s,/this\.eventsProcessed>=LIMIT\.maxEventsPerFrame/);
 assert.match(s,/Math\.min\(jets,34\)/);
 assert.match(s,/m\.material\.opacity=\(1-u\)/);
});
test('All six major structures possess real moving arms and 3D rotating rings',async()=>{
 const model=await readFile('app/world-rebuild.ts','utf8');
 const bg=await readFile('app/fortress.ts','utf8');
 assert.match(model,/kinetic-world-assembly/);
 assert.match(model,/kinetic-ring-/);
 assert.match(model,/kinetic-arm-/);
 assert.match(model,/export function animateWorldSetpiece/);
 assert.match(bg,/animateWorldSetpiece\(m,t,reduced\|\|performance\)/);
});
