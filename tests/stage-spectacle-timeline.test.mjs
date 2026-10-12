import test from 'node:test';
import assert from 'node:assert/strict';
import {stageSpectaclePose,SPECTACLE_TIMING} from '../app/stage-spectacle-timeline.ts';
test('all 18 authored spectacles pass through legible warning, impact, lasting aftermath',()=>{
 for(let stage=0;stage<6;stage++)for(let act=0;act<3;act++){
  const approach=stageSpectaclePose(stage,act,.3);
  const warning=stageSpectaclePose(stage,act,2.4);
  const motion=stageSpectaclePose(stage,act,4.7);
  const hit=stageSpectaclePose(stage,act,SPECTACLE_TIMING.impact);
  const fallout=stageSpectaclePose(stage,act,9.8);
  assert.equal(approach.phase,'approach');
  assert.equal(warning.phase,'warning');
  assert.ok(warning.anticipation>.25);
  assert.equal(motion.phase,'action');
  assert.ok(motion.action>0&&motion.action<1);
  assert.ok(hit.impact>.98);
  assert.ok(fallout.fallout>.95);
  assert.equal(fallout.phase,'aftermath');
  assert.equal(fallout.action,1,'destroyed geometry remains transformed');
  assert.notEqual(stageSpectaclePose(stage,act,5.5).intensity,0);
  assert.equal(stageSpectaclePose(stage,act,21).active,false);
 }
});
test('seekable deterministic animation phases progress smoothly with dropped frames',()=>{
 for(let stage=0;stage<6;stage++){
  let previous=stageSpectaclePose(stage,1,0);
  for(let tick=1;tick<=320;tick++){
   const now=stageSpectaclePose(stage,1,tick*.05);
   assert.ok(now.action>=previous.action);
   assert.ok(now.fallout>=previous.fallout);
   assert.ok(now.action-previous.action<.08);
   assert.ok(now.fallout-previous.fallout<.08);
   assert.deepEqual(stageSpectaclePose(stage,1,tick*.05),now);
   previous=now;
  }
 }
});
test('showpiece geometry is finite, different by stage and does not change gameplay',async()=>{
 const {readFile}=await import('node:fs/promises');
 const [scenes,fx]=await Promise.all(['stage-sequences','stage-spectacle-particles'].map(s=>readFile('app/'+s+'.ts','utf8')));
 assert.match(scenes,/stageSpectaclePose\(g.stage,c.act,elapsed\)/);
 assert.match(scenes,/object.position.set\(rest.x,rest.y,rest.z\)/);
 assert.match(scenes,/c.particles.draw\(phase,opacity,performance,reduced\)/);
 assert.match(fx,/new T.InstancedMesh\(geometry,shardMat,32\)/);
 assert.match(fx,/new T.InstancedMesh\(new T.ConeGeometry\(\.55,1\.6,5,1\),plumeMat,20\)/);
 assert.match(fx,/this.fragments.count=visible/);
 assert.match(fx,/this.wash.count=clouds/);
 for(const code of [scenes,fx])assert.doesNotMatch(code,/Math.random\(|PlaneGeometry|SpriteMaterial|scene.add\(new T.PointLight/);
});
