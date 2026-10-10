import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FACILITY_GLARE_LIMITS} from '../app/facility-demolition.ts';
const file=name=>readFile('app/'+name+'.ts','utf8');

test('Rebuilt 3D aircraft and boss silhouettes never use a ship or boss atlas',async()=>{
 const [art,rig,encounter]=await Promise.all([file('art'),file('animation-rig'),file('encounter-view')]);
 assert.match(art,/usesRebuiltGraphics\(\)\?undefined:shipSkin\(kind\)/);
 assert.match(art,/if\(!usesRebuiltGraphics\(\)&&bossSkin\(stage\)\)/);
 assert.match(rig,/new T\.Mesh\(geometry,new T\.MeshBasicMaterial/);
 assert.match(rig,/new T\.DodecahedronGeometry/);
 assert.match(encounter,/this\.mini3D=Array\.from|mini3D=Array\.from/);
 assert.match(encounter,/this\.node3D=Array\.from|node3D=Array\.from/);
 assert.match(encounter,/v\.skin\.visible=!!n&&n\.attach!=='field'&&!rebuilt/);
 assert.match(encounter,/geometry\.position\.set\(n\.x,n\.y-\.42/);
});
test('Rebuilt sky, backdrop atmosphere, fog, waterfalls and tiny escorts are physically 3D',async()=>{
 const [render,fortress,stage,air,scene,living]=await Promise.all([
 file('render'),file('fortress'),file('stage-effects'),file('air-effects'),file('scene-art'),file('living-surface')
 ]);
 assert.match(render,/new T\.SphereGeometry\(82,24,12\)/);
 assert.match(fortress,/volumetric-cloud-bank/);
 assert.match(stage,/new T\.CylinderGeometry\(\.65,\.86,7\.8/);
 assert.match(stage,/new T\.IcosahedronGeometry\(1,1\)/);
 assert.match(stage,/Real small escort hull/);
 assert.match(air,/new T\.IcosahedronGeometry\(1,2\)/);
 assert.match(scene,/if\(entry\.kind==='artwork'&&usesRebuiltGraphics\(\)\)return buildWorldSetpiece/);
 assert.match(living,/new T\.TorusGeometry\(\.70,\.060/);
});
test('Rebuilt effects use 3D impact volumes, not billboard sprites, and tactical effects stay visible',async()=>{
 const [render,fx,fac,world]=await Promise.all([file('render'),file('combat-effects'),file('facility-demolition'),file('colossal-cinematics')]);
 assert.match(fx,/if\(!this\.rebuilt\)/);
 assert.match(fx,/new T\.TetrahedronGeometry\(\.70,0\)/);
 assert.match(render,/usesRebuiltGraphics\(\)\?new T\.SphereGeometry\(\.5,6,4\)/);
 assert.match(render,/usesRebuiltGraphics\(\)\?5:45/);
 assert.match(render,/usesRebuiltGraphics\(\)\?\.31:\.52/);
 assert.match(fac,/depthTest:true/);
 assert.doesNotMatch(fac,/depthTest:false/);
 assert.match(world,/this\.warpStage\.visible=false/);
 assert.match(world,/this\.irisRoot\.visible=false/);
 assert.ok(FACILITY_GLARE_LIMITS.coreOpacity<=.25);
 assert.ok(FACILITY_GLARE_LIMITS.blastRingOpacity<=.30);
});
test('Classic retains original 2D assets while rebuilt graphics remains the default',async()=>{
 const [art,stage,render,style]=await Promise.all([file('art'),file('stage-effects'),file('render'),file('visual-style')]);
 assert.match(art,/const skin=usesRebuiltGraphics\(\)\?undefined:shipSkin/);
 assert.match(stage,/this\.weather=new T\.InstancedMesh/);
 assert.match(render,/new T\.PlaneGeometry\(46,76\)/);
 assert.match(style,/return localStorage\.getItem\(KEY\)==='classic'\?'classic':'rebuilt'/);
});
