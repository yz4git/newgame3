import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ScenicChoreography3D} from '../app/scenic-choreography.ts';
import {Game} from '../app/sim.ts';
import {FxDirector} from '../app/fx-director.ts';
const read=name=>readFile('app/'+name+'.ts','utf8');

test('All six World Rebuild stages have physical animated background mechanisms',async()=>{
 const src=await read('scenic-choreography');
 for(let i=0;i<6;i++)assert.ok(src.includes('stage==='+i), 'Missing stage '+i);
 assert.match(src,/makeMachinery\(stage:number,index:number\)/);
 for(const token of ['mining clamps','shipyard cranes','cable array',
 'crystal turbines','living antenna','pressure-cage vanes']){
  assert.ok(src.includes(token),token);
 }
 assert.match(src,/rig\.hinge\.rotation\.z=/);
 assert.match(src,/rig\.rotor\.rotation\.z=/);
 assert.match(src,/rig\.ram\.position\.y=/);
});
test('Actual 3D distant traffic, scenery/weather and responsive background architecture are bounded',async()=>{
 const src=await read('scenic-choreography');
 assert.match(src,/new T\.InstancedMesh\(geo,mat,max\)/);
 assert.match(src,/new T\.DodecahedronGeometry|new T\.IcosahedronGeometry/);
 for(const obj of ['deep-stage-volume-particles','moving-cable-guides',
 'small-real-3d-freight-escort-'])assert.ok(src.includes(obj),obj);
 assert.match(src,/environmentParticles:84,cableSegments:48,reactiveWalls:0/);
 assert.match(src,/this\.motes\.count=count/);
 assert.match(src,/this\.lines\.count=n/);
 assert.match(src,/mix\.showFlybys/);
 assert.match(src,/mix\.crowded/);
 assert.match(src,/this\.cue\.age\+=dt/);
 assert.doesNotMatch(src,/new T\.PlaneGeometry|new T\.Sprite|AdditiveBlending|Math\.random|\.bullets\.push/);
});
test('Background is linked to the priority orchestrator but never to the Classic mode',async()=>{
 const s=await read('render');
 assert.match(s,/private scenic=usesRebuiltGraphics\(\)\?new ScenicChoreography3D\(\):null/);
 assert.match(s,/this\.scenic\?\.event\(e\)/);
 assert.match(s,/this\.scenic\?\.draw\(game,dt,mix,visualReduced/);
 assert.match(s,/scenic:this\.scenic\?\.diagnostics\(\)\?\?null/);
});
test('Facility, boss and mission events never rebuild the shared decorative side walls',()=>{
 const scene=new ScenicChoreography3D(),g=new Game(),director=new FxDirector();
 for(let stage=0;stage<6;stage++){
  g.start('campaign','normal',stage);g.time=21;g.visualTime=21;
  const before=g.snapshot();
  for(const type of['fieldcollapse','fieldclear','fieldcritical','bossform','bosstransform','missionstart','missionclear','bosskill']){
   scene.event({type,x:0,y:7.5,size:4});scene.draw(g,.6,director.plan(g));
   assert.equal(scene.diagnostics().reactiveWallUnits,0);
   scene.root.traverse(o=>assert.ok(!['left-reactive-wall','right-reactive-wall','event-reactive-world-machinery'].includes(o.name)));
  }
  assert.deepEqual(g.snapshot(),before);
 }
});
