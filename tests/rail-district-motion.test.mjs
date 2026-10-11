import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=n=>readFile('app/'+n+'.ts','utf8');

test('no repeated side rail machinery is mounted in the actual World Rebuild renderer',async()=>{
 const render=await read('render');
 assert.doesNotMatch(render,/RailDistrictMotion3D|new RailDistrictMotion3D/);
 assert.doesNotMatch(render,/this\.railDistricts\?\.(?:draw|event)/);
 assert.match(render,/railDistricts:null/);
});

test('fortress chip no longer builds artificial rail chapters or repeated edge roofs',async()=>{
 const src=await read('fortress');
 assert.doesNotMatch(src,/railDistrictChapter\(/);
 assert.doesNotMatch(src,/function railDistrictChapter/);
 assert.match(src,/if\(usesRebuiltGraphics\(\)\)continue; \/\/ No edge wedges, roofs or rail modules/);
 assert.match(src,/if\(!usesRebuiltGraphics\(\)\&\&\(v===3\|\|v===7\)\)/);
 assert.match(src,/if\(!usesRebuiltGraphics\(\)\)this\.root\.add\(m\)/);
});

test('only finite natural landmarks are allowed in the rebuilt terrain rows',async()=>{
 const src=await read('fortress');
 assert.match(src,/terrain\.visible=landscapeBeats\.includes\(row\)/);
 assert.match(src,/installations\.visible=!usesRebuiltGraphics\(\)&&layout\.installations/);
 assert.match(src,/this\.objects\.forEach/);
 assert.match(src,/this\.scenes\.forEach/);
 assert.match(src,/this\.surface\?\.draw/);
});

test('looping ambient edge structures are gone; event-based combat architecture stays',async()=>{
 const [scenic,world,script]=await Promise.all([
  read('scenic-choreography'),read('world-alive-scene'),
  readFile('scripts/visual-playtest.mjs','utf8')
 ]);
 assert.match(scenic,/const show=false/);
 assert.match(scenic,/this\.patrolCount=0/);
 assert.match(scenic,/if\(false&&rails&&servicing\)/);
 assert.match(world,/p\.visible=!reduced&&g\.state==='transition'/);
 assert.match(script,/results\.sideRemoval/);
 assert.match(script,/railChildren!==0/);
});
