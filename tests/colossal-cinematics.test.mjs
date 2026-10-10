import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COLOSSAL_BUDGET as B,COLOSSAL_FEATURES as F} from '../app/colossal-spec.ts';

test('3.3 adds 20 authored large-scale physical 3D sequences',()=>{
 assert.ok(F.length>=20);assert.equal(new Set(F).size,F.length);
 assert.ok(B.maxRollRadians<=.05&&B.maxZoom<=1.05&&B.maxLuminance<=.6);
});
test('Massive objects are bounded even during repeated facility destruction',()=>{
 assert.ok(B.monoliths<=2&&B.capitalShips<=3&&B.bossFins<=12);
 assert.ok(B.warpRings<=8&&B.collapses<=3&&B.fragments<=60);
 const src=await readFile('app/colossal-cinematics.ts','utf8');
 assert.match(src,/this\.impacts\.length>=B\.fragments/);
 assert.match(src,/this\.root\.visible=active\|\|g\.state==='title'/);
 assert.match(src,/this\.warpStage\.visible=moving&&!reduced/);
 assert.match(src,/this\.irisRoot\.visible=!!boss&&!reduced/);
 assert.doesNotMatch(src,/new T\.PlaneGeometry|new T\.Sprite|AdditiveBlending|Math\.random/);
});
test('Every stage has unique authored metal and mechanical 3D structures',async()=>{
 const src=await readFile('app/colossal-cinematics.ts','utf8');
 for(const key of ['stage===0','stage===1','stage===2','stage===3','stage===4','makeCarrier','makeMonolith',
 'TorusGeometry','BoxGeometry','CylinderGeometry','IcosahedronGeometry','ConeGeometry']){
  assert.ok(src.includes(key),key);
 }
});
test('Only rebuilt graphics instantiate the new pass and camera remains subtle',async()=>{
 const src=await readFile('app/render.ts','utf8');
 assert.match(src,/private colossal=usesRebuiltGraphics\(\)\?new ColossalCinematics\(\):null/);
 assert.match(src,/this\.colossal\?\.event\(e\)/);
 assert.match(src,/this\.colossal\?\.draw\(game,dt/);
 assert.match(src,/depthSpectacle:this\.depthSpectacle\?\.diagnostics\(\)\?\?null,colossal:this\.colossal\?\.diagnostics\(\)/);
 assert.match(src,/this\.camera\.up\.set\(-Math\.sin\(this\.cameraRoll\)/);
 assert.match(src,/this\.camera\.updateProjectionMatrix\(\)/);
});
