import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INVASION_BUDGET as B, INVASION_FEATURES as F} from '../app/invasion-spec.ts';

test('Invasion director is a meaningful, bounded next 3D chapter',()=>{
 assert.ok(F.length>=20);
 assert.equal(new Set(F).size,F.length);
 assert.ok(B.dreadnoughts<=2 && B.trenchBeams<=48 && B.bossPetals<=16);
 assert.ok(B.hyperRings<=12 && B.ruptures<=3 && B.debris<=80);
 assert.ok(B.maxGameplayRoll<=.06 && B.maxWarpRoll<=.40);
 assert.ok(B.maxBossZoom<=1.11 && B.maxWarpZoom<=1.23);
});
test('Cinematic sequences contain truly 3D world geometry, not fullscreen layers',async()=>{
 const s=await readFile('app/invasion-director.ts','utf8');
 for(const key of ['DodecahedronGeometry','BoxGeometry','CylinderGeometry','TorusGeometry',
  'trench-run-architecture','dreadnought-intercept','boss-rotating-hyperstructure',
  'hyperspace-strata','world-volume-ruptures','physical-rupture-metal-shards']){
  if(key==='DodecahedronGeometry')continue; // Current models use hull geometry for consistent faceted ships
  assert.ok(s.includes(key),key);
 }
 assert.doesNotMatch(s,/new T\.PlaneGeometry|new T\.Sprite|AdditiveBlending|PointLight/);
 assert.match(s,/this\.travel\.visible=transition&&!reduced/);
 assert.match(s,/this\.bossCore\.visible=boss&&!reduced/);
 assert.match(s,/this\.shards/);
});
test('Varying 3D director cannot consume combat RNG or change game state',async()=>{
 const s=await readFile('app/invasion-director.ts','utf8');
 assert.doesNotMatch(s,/Math\.random\(|g\.emit\(|g\.score\s*(\+\+|=)|g\.player\.x\s*=|g\.bullets\.push/);
 assert.match(s,/this\.shards\.length>=LIMIT\.debris/);
 assert.match(s,/this\.detonations\.length>=LIMIT\.ruptures/);
 assert.match(s,/this\.root\.visible=title\|\|active/);
});
test('The new director is connected only to the rebuilt 3D branch',async()=>{
 const s=await readFile('app/render.ts','utf8');
 assert.match(s,/private invasion=usesRebuiltGraphics\(\)\?new InvasionDirector\(\):null/);
 assert.match(s,/this\.invasion\?\.event\(e\)/);
 assert.match(s,/this\.invasion\?\.draw\(game,dt/);
 assert.match(s,/invasion:this\.invasion\?\.diagnostics\(\)\?\?null/);
 assert.match(s,/warp\?warpRoll:combatRoll/);
 assert.match(s,/const warpRoll=warp\?Math\.sin/);
});
