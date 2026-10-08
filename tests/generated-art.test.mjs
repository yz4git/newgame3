import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const path=(p)=>new URL('../'+p,import.meta.url);
const atlasFiles=[
 'field-strategic-12-v21.avif','player-ships-3-v21.avif','field-fx-16-v21.avif',
 'sector-badges-10-v21.avif','sector-thumbnails-6-v21.avif','title-hero-v21.avif'
];
test('Six generated art atlases ship as valid and mobile-size AVIF images',()=>{
 let bytes=0;
 for(const filename of atlasFiles){
  const p=path('app/textures/v21/'+filename),data=readFileSync(p);
  assert.equal(data.toString('ascii',4,8),'ftyp',filename+' must be AVIF');
  assert.equal(data.toString('ascii',8,12),'avif',filename+' brand');
  assert.ok(data.length>2000&&data.length<30000,filename+' compressed');
  bytes+=data.length;
 }
 assert.ok(bytes<100000,'all six image atlases should be under 100KB combined');
});
test('Generated art is connected to GPU, Canvas and mobile menu, with fallback',()=>{
 const read=(name)=>readFileSync(path(name),'utf8');
 const loader=read('app/visual-assets.ts'),view=read('app/encounter-view.ts');
 const gpu=read('app/render.ts'),canvas=read('app/canvas.ts'),style=read('app/style.css');
 assert.match(loader,/battlefieldMaps=cells\(battlefieldAtlasMap,4,3\)/);
 assert.match(loader,/playerShipMaps=cells\(playerShipsAtlasMap,3,1\)/);
 assert.match(loader,/tacticalFxMaps=cells\(tacticalFxAtlasMap,4,4\)/);
 assert.match(view,/battlefieldMaps\[n.stage\*2\+n.index\]/);
 assert.match(view,/field\.naturalWidth>0/);
 assert.match(gpu,/playerShipMaps\[game.shipClass/);
 assert.match(canvas,/playerShipsAtlasMap\.image/);
 for(const filename of ['title-hero-v21.avif','sector-thumbnails-6-v21.avif','sector-badges-10-v21.avif','field-fx-16-v21.avif'])assert.ok(style.includes(filename));
});
