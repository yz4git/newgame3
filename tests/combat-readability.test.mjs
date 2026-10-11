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

test('The real World Rebuild removes repeating side architecture and preserves bullet colors',async()=>{
 const [render,fortress,scenic,world]=await Promise.all(
 ['render','fortress','scenic-choreography','world-alive-scene'].map(n=>readFile('app/'+n+'.ts','utf8')));
 assert.doesNotMatch(render,/RailDistrictMotion3D/);
 assert.match(render,/railDistricts:null/);
 assert.match(render,/setColorAt\(coreCount\+\+,this\.shotColor\.setHex\(0xffe1bf\)\)/);
 assert.match(render,/setColorAt\(coreCount\+\+,this\.shotColor\.setHex\(0xbbf5ff\)\)/);
 assert.match(render,/usesRebuiltGraphics\(\)\?\.20:\.52/);
 assert.match(fortress,/if\(usesRebuiltGraphics\(\)\)continue; \/\/ No edge wedges/);
 assert.match(fortress,/lamp:physical\?new T\.MeshBasicMaterial/);
 assert.match(scenic,/this\.patrolCount=0/);
 assert.match(world,/p\.visible=!reduced&&g\.state==='transition'/);
});

test('World Rebuild grades actual background materials without dimming foreground game assets',async()=>{
 const read=n=>readFile('app/'+n+'.ts','utf8');
 const [background,world,scenic,surface,cliffs,volume,render]=await Promise.all(
  ['fortress','world-alive-scene','scenic-choreography',
    'living-surface','environment-art','volumetric-cinematics','render'].map(read));
 assert.match(background,/toneMapped:true\}\):glow\(STAGES\[stage\]\.color/);
 assert.match(background,/new T\.Color\(color\)\.multiplyScalar\(paint\?\.43:\.47\)/);
 assert.match(background,/emissiveIntensity:\.31/);
 assert.match(background,/terrain\.visible=landscapeBeats\.includes\(row\)/);
 assert.match(world,/panelMat\.color\.setHex\(colors\[1\]\)\.multiplyScalar\(\.39\)/);
 assert.match(scenic,/bright\.color\.setHex\(tint\[1\]\)\.multiplyScalar\(\.41\)/);
 assert.match(surface,/if\(this\.rebuilt\)mat\.color\.multiplyScalar\(\.56\)/);
 assert.match(cliffs,/baseColor=new T\.Color\([\s\S]*?\)\.multiplyScalar\(\.57\)/);
 assert.match(volume,/lanterns\.material as T\.MeshBasicMaterial\)\.color\.copy\(envColor\)/);
 // Illumination is not globally reduced, which would also dull the
 // foreground players, enemies and target markers.
 assert.match(render,/this\.key\.color\.setHex\(theme\.sun\);this\.key\.intensity=theme\.light/);
 assert.match(render,/this\.shotColor\.setHex\(bullet\.enemy\?/);
});
