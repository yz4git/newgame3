import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
 'small-real-3d-freight-escort-','left-reactive-wall','right-reactive-wall'])assert.ok(src.includes(obj),obj);
 assert.match(src,/environmentParticles:84,cableSegments:48,reactiveWalls:2/);
 assert.match(src,/this\.motes\.count=count/);
 assert.match(src,/this\.lines\.count=n/);
 assert.match(src,/mix\.showFlybys/);
 assert.match(src,/mix\.crowded/);
 assert.match(src,/this\.cue\.age\+=dt/);
 assert.match(src,/this\.warning\[j\]\.material as T\.MeshBasicMaterial/);
 assert.doesNotMatch(src,/new T\.PlaneGeometry|new T\.Sprite|AdditiveBlending|Math\.random|\.bullets\.push/);
});
test('Background is linked to the priority orchestrator but never to the Classic mode',async()=>{
 const s=await read('render');
 assert.match(s,/private scenic=usesRebuiltGraphics\(\)\?new ScenicChoreography3D\(\):null/);
 assert.match(s,/this\.scenic\?\.event\(e\)/);
 assert.match(s,/this\.scenic\?\.draw\(game,dt,mix,visualReduced/);
 assert.match(s,/scenic:this\.scenic\?\.diagnostics\(\)\?\?null/);
});
test('Facility failure, boss and missions physically reconfigure background equipment without bright overlays',async()=>{
 const src=await read('scenic-choreography');
 for(const event of ['fieldcollapse','fieldclear','fieldcritical','bossform','bosstransform','missionstart','missionclear','bosskill'])
  assert.ok(src.includes(event),event);
 assert.match(src,/this\.shutters\[j\]\.rotation\.y=side\*opening\*\.52/);
 assert.match(src,/this\.facade\[j\]/);
 assert.match(src,/this\.reaction\.visible=engaged/);
 assert.match(src,/this\.accents=new T\.MeshBasicMaterial\(\{color:0x5a8994,transparent:true,opacity:\.26,depthWrite:false,toneMapped:true\}\)/);
});
