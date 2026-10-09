import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORLD_REBUILD_STAGES} from '../app/world-rebuild-spec.ts';
import {Game,STAGES,STEP} from '../app/sim.ts';
import {visualStyleInfo,currentVisualStyle,setVisualStyle,usesRebuiltGraphics} from '../app/visual-style.ts';
test('All six campaigns have their own physical set piece identity',()=>{
 assert.equal(WORLD_REBUILD_STAGES.length,STAGES.length);
 assert.equal(new Set(WORLD_REBUILD_STAGES.map(x=>x.id)).size,6);
 assert.ok(WORLD_REBUILD_STAGES.every(x=>x.parts>=6&&x.focus.length>5));
});
test('Classic 2.9.3 is independently archived, World Rebuild can be switched reversibly',async()=>{
 assert.equal(visualStyleInfo.classic.includes('2.9.3'),true);
 const start=currentVisualStyle();
 try{
  setVisualStyle('classic');assert.equal(currentVisualStyle(),'classic');assert.equal(usesRebuiltGraphics(),false);
  setVisualStyle('rebuilt');assert.equal(currentVisualStyle(),'rebuilt');assert.equal(usesRebuiltGraphics(),true);
 }finally{setVisualStyle(start);}
});
test('Enemy and boss meshes do not have full-area billboards in rebuilt mode',async()=>{
 const source=await readFile('app/art.ts','utf8');
 assert.match(source,/const skin=usesRebuiltGraphics\(\)\?undefined:shipSkin\(kind\)/);
 assert.match(source,/if\(!usesRebuiltGraphics\(\)&&bossSkin\(stage\)\)/);
 assert.match(source,/variant==='falcon'/);assert.match(source,/variant==='bulwark'/);
 const canvas=await readFile('app/canvas-art.ts','utf8');
 assert.match(canvas,/usesRebuiltGraphics\(\)/);
 assert.match(canvas,/playerWorldSprite/);
});
test('World models replace each stage full-screen billboard without altering gameplay',async()=>{
 const source=await readFile('app/scene-art.ts','utf8');
 assert.match(source,/entry.kind==='artwork'&&usesRebuiltGraphics\(\)/);
 assert.match(source,/buildWorldSetpiece\(p,stage,entry.width,entry.height\)/);
 const canvas=await readFile('app/canvas-background.ts','utf8');
 assert.match(canvas,/e.kind==='artwork'&&!usesRebuiltGraphics\(\)/);
 const game=new Game();for(let stage=0;stage<6;stage++){
  game.start('campaign','normal',stage,'striker');game.update(STEP,{x:0,y:0,focus:false});
  assert.equal(game.stage,stage);assert.equal(game.state,'playing');
 }
});
test('Rebuilt graphic materials and geometry are consistent with the active terrain depth',async()=>{
 const arch=await readFile('app/world-rebuild.ts','utf8');
 assert.match(arch,/import type \{EnvironmentPalette\}/);
 assert.match(arch,/result=batch\(g\)/);
 assert.match(arch,/result.userData=\{stage,worldScale:true/);
 assert.doesNotMatch(arch,/SpriteMaterial|PlaneGeometry|sceneMaps/);
 const doc=await readFile('app/index.html','utf8');
 assert.match(doc,/data-visual="rebuilt"/);assert.match(doc,/data-visual="classic"/);
});
