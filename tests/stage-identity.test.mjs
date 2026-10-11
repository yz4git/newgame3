import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile('app/'+name+'.ts','utf8');
const parseIds=(code,name)=>{
 const match=code.match(new RegExp('export const '+name+'=(\\[[\\s\\S]*?\\]) as const;'));
 assert.ok(match,'missing identity table '+name);
 return JSON.parse(match[1].replaceAll("'",'"'));
};
test('18 non-repeated authored scenes give each stage three distinct environments',async()=>{
 const s=await read('stage-chapters');
 const ids=parseIds(s,'STAGE_CHAPTER_IDS');
 assert.equal(ids.length,6);
 assert.equal(ids.flat().length,18);
 assert.ok(ids.every(a=>a.length===3));
 assert.equal(new Set(ids.flat()).size,18);
 for(let stage=0;stage<6;stage++){
  assert.match(s,new RegExp('stage==='+stage+'|stage===4'));
 }
 for(let chapter=0;chapter<3;chapter++)
  assert.match(s,new RegExp('index==='+chapter));
 assert.match(s,/const merged=batch\(still\)/);
 assert.match(s,/root.remove\(still\);root.add\(merged\)/);
 assert.match(s,/new T\.IcosahedronGeometry/);
 assert.match(s,/new T\.CylinderGeometry/);
 assert.doesNotMatch(s,/PlaneGeometry|SpriteMaterial|CanvasTexture|Math\.random\(/);
});
test('all six independent hero mechanisms replace identical spinning rings',async()=>{
 const s=await read('world-rebuild');
 const ids=parseIds(s,'HERO_MOTION_IDS');
 assert.equal(ids.length,6);
 assert.equal(new Set(ids).size,6);
 assert.match(s,/hero-actuator-/);
 assert.match(s,/kinetic-world-assembly/);
 assert.match(s,/export function animateWorldSetpiece/);
 assert.match(s,/stage===0/);assert.match(s,/stage===1/);
 assert.match(s,/stage===2/);assert.match(s,/stage===3/);
 assert.match(s,/stage===4/);
 assert.match(s,/else\{\s*if\(i<4\)/);
 assert.doesNotMatch(s,/kinetic-ring-|kinetic-arm-/);
 assert.doesNotMatch(s,/Guardrails and service illuminators supply a repeatable/);
});
test('actual renderer uses authored 3D chapters and smooth approach, with Classic unchanged',async()=>{
 const [scene,fortress,visual]=await Promise.all(['scene-art','fortress','visual-style'].map(read));
 assert.match(scene,/if\(usesRebuiltGraphics\(\)\)return buildStageChapter/);
 assert.match(scene,/if\(entry.kind==='artwork'&&usesRebuiltGraphics\(\)\)return buildWorldSetpiece/);
 assert.match(scene,/if\(entry.kind==='artwork'\)/);
 assert.match(fortress,/animateStageChapter\(m,t,reduced\|\|performance\)/);
 assert.match(fortress,/this\.reveal\(m,distanceReveal/);
 assert.match(visual,/classic/);
});
