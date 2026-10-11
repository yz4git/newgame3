import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {readFile} from 'node:fs/promises';
import {buildStageChapter,animateStageChapter,STAGE_CHAPTER_IDS} from '../app/stage-chapters.ts';
import {buildWorldSetpiece,animateWorldSetpiece,HERO_MOTION_IDS} from '../app/world-rebuild.ts';
const palette=()=>{
 const mat=()=>new T.MeshStandardMaterial({color:0x445b6c,roughness:.84,metalness:.12});
 const p={};
 for(const key of ['deck','plate','steel','dark','core','lamp','warm','glass',
  'rock','ice','snow','moss','water','lava','foliage','foam','rust','terrain'])p[key]=mat();
 return p;
};
const countMeshes=o=>{let n=0;o.traverse(x=>{if(x instanceof T.Mesh)n++});return n};
test('all 18 secondary architectural chapters have unique names and real 3D depth',()=>{
 assert.equal(STAGE_CHAPTER_IDS.length,6);
 const ids=STAGE_CHAPTER_IDS.flat();
 assert.equal(ids.length,18);
 assert.equal(new Set(ids).size,18);
 for(let stage=0;stage<6;stage++)for(let index=0;index<3;index++){
  const p=palette(),model=buildStageChapter(p,stage,index);
  assert.equal(model.userData.chapterId,STAGE_CHAPTER_IDS[stage][index]);
  const actuator=model.getObjectByName('stage-primary-motion');
  const secondary=model.getObjectByName('stage-secondary-motion');
  assert.ok(actuator?.children.length>0,STAGE_CHAPTER_IDS[stage][index]);
  assert.ok(secondary?.children.length>0,STAGE_CHAPTER_IDS[stage][index]);
  assert.ok(countMeshes(model)>=7,'not enough real meshes: '+STAGE_CHAPTER_IDS[stage][index]);
  const before=actuator.position.toArray().concat([actuator.rotation.z]);
  animateStageChapter(model,8.17);
  const after=actuator.position.toArray().concat([actuator.rotation.z]);
  assert.notDeepEqual(after,before,'chapter must have its own physical choreography: '+model.name);
  model.traverse(o=>{if(o instanceof T.Mesh)assert.notEqual(o.geometry.type,'PlaneGeometry');});
  model.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  for(const m of Object.values(p))m.dispose();
 }
});
test('six protagonist landmarks use different dynamic assemblies, not ring and arm templates',()=>{
 assert.equal(HERO_MOTION_IDS.length,6);
 assert.equal(new Set(HERO_MOTION_IDS).size,6);
 const signatures=[];
 for(let stage=0;stage<6;stage++){
  const p=palette(),model=buildWorldSetpiece(p,stage,16,18);
  const kinetic=model.getObjectByName('kinetic-world-assembly');
  assert.equal(kinetic?.userData.motionId,HERO_MOTION_IDS[stage]);
  const acts=kinetic.children.filter(o=>o.name.startsWith('hero-actuator-'));
  assert.ok(acts.length>=4,stage+' is missing physical moving pieces');
  assert.equal(kinetic.children.some(o=>o.name.startsWith('kinetic-ring-')),false);
  const before=acts.map(o=>o.position.toArray().concat(o.rotation.z));
  animateWorldSetpiece(model,4.33);
  const after=acts.map(o=>o.position.toArray().concat(o.rotation.z));
  assert.notDeepEqual(after,before,'static hero '+stage);
  signatures.push(acts.length+'-'+HERO_MOTION_IDS[stage]);
  model.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  for(const m of Object.values(p))m.dispose();
 }
 assert.equal(new Set(signatures).size,6);
});
test('World Rebuild selects stage-authored chapters while Classic keeps original prop assets',async()=>{
 const [scene,fortress]=await Promise.all(['scene-art','fortress']
  .map(n=>readFile('app/'+n+'.ts','utf8')));
 assert.match(scene,/if\(usesRebuiltGraphics\(\)\)return buildStageChapter/);
 assert.match(scene,/if\(entry.kind==='artwork'&&usesRebuiltGraphics\(\)\)return buildWorldSetpiece/);
 assert.match(scene,/if\(entry.kind==='artwork'\)/);
 assert.match(fortress,/animateStageChapter\(m,t,reduced\|\|performance\)/);
 assert.match(fortress,/this\.reveal\(m,distanceReveal/);
 assert.doesNotMatch(scene,/new T\.SpriteMaterial/);
});
