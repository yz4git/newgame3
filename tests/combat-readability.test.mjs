import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../app/sim.ts';
import {FxDirector,FX_MIX_LIMITS} from '../app/fx-director.ts';

test('scene motion backs down progressively before dense bullets hide the ship',()=>{
 const g=new Game();g.start('campaign','normal',2);
 const fx=new FxDirector();
 const empty=fx.plan(g);
 assert.equal(empty.readability,0);
 g.bullets=Array.from({length:12},()=>({}));
 const medium=fx.plan(g);
 assert.ok(medium.readability>.2 && medium.readability<1);
 assert.ok(medium.density<empty.density);
 assert.equal(medium.showAmbientStructures,false);
 assert.equal(medium.showFlybys,false);
 g.bullets=Array.from({length:FX_MIX_LIMITS.bulletCrowd+10},()=>({}));
 const dense=fx.plan(g);
 assert.equal(dense.crowded,true);
 assert.equal(dense.density,FX_MIX_LIMITS.quietDensity);
 assert.equal(dense.showAmbientStructures,false);
 assert.ok(dense.readability>=medium.readability);
 assert.ok(FX_MIX_LIMITS.maxGameplayRoll<=.012);
 assert.ok(FX_MIX_LIMITS.maxGameplayZoom<=1.02);
});

test('visual planning never touches combat simulation, saves or enemy hitboxes',()=>{
 const g=new Game();g.start('campaign','normal',3);
 const before=g.snapshot();
 const fx=new FxDirector();
 for(let i=0;i<20;i++)fx.plan(g);
 assert.deepEqual(g.snapshot(),before);
});

test('3D rails and stage scenery retreat from the danger corridor; Classic remains separate',async()=>{
 const read=n=>readFile('app/'+n+'.ts','utf8');
 const [rails,scenic,world,render,fortress]=await Promise.all(
  ['rail-district-motion','scenic-choreography','world-alive-scene','render','fortress'].map(read));
 assert.match(rails,/readability>\.62/);
 assert.match(rails,/mix\.readability>\.30/);
 assert.match(rails,/this\.panels\.color\.setHex\(palette\[0\]\)\.multiplyScalar\(\.66\)/);
 assert.match(scenic,/mix\.readability<\.32/);
 assert.match(world,/mix\.readability<\.30/);
 assert.match(render,/setColorAt\(coreCount\+\+,this\.shotColor\.setHex\(0xffe1bf\)\)/);
 assert.match(render,/setColorAt\(coreCount\+\+,this\.shotColor\.setHex\(0xbbf5ff\)\)/);
 assert.match(render,/usesRebuiltGraphics\(\)\?\.20:\.52/);
 assert.match(fortress,/if\(usesRebuiltGraphics\(\)\)/);
 assert.match(fortress,/physical\?\.46:env/);
});
