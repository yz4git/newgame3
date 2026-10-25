import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFirstStageBoss,animateFirstStageBoss} from '../app/flight-boss-visuals.ts';

test('stage-one normal route has giant multi-engine airborne carrier silhouette and exposed core',()=>{
 const model=createFirstStageBoss(false);
 assert.equal(model.userData.variant,'carrier');
 assert.ok(model.userData.weakpoint instanceof T.Mesh);
 let meshes=0,minX=Infinity,maxX=-Infinity;
 model.updateMatrixWorld(true);
 model.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  meshes++;
  const box=new T.Box3().setFromObject(o);
  minX=Math.min(minX,box.min.x);maxX=Math.max(maxX,box.max.x);
 });
 assert.ok(meshes>=25);
 assert.ok(maxX-minX>38,'capital ship silhouette should span much wider than an ordinary fighter');
 animateFirstStageBoss(model,1,3);
 assert.ok(model.userData.reactorMaterial.emissiveIntensity>1.4);
});
test('alternate route guardian is a moving walker with legs and opening shields',()=>{
 const m=createFirstStageBoss(true);
 assert.equal(m.userData.variant,'walker');
 assert.equal(m.userData.legs.length,2);
 assert.equal(m.userData.shields.length,2);
 assert.ok(m.userData.weakpoint instanceof T.Mesh);
 animateFirstStageBoss(m,1.3,1);
 const phase1=m.userData.shields[0].rotation.y;
 animateFirstStageBoss(m,1.3,3);
 assert.ok(Math.abs(m.userData.shields[0].rotation.y)>Math.abs(phase1)+.5);
 assert.ok(Math.abs(m.userData.legs[0].rotation.z)>.01);
});
