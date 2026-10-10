import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile('app/'+name+'.ts','utf8');

test('World Rebuild uses a texture-free physical material palette, Classic retains textures',async()=>{
 const s=await read('fortress');
 assert.match(s,/const architectural=\(color:number,paint=false\)=>physical/);
 assert.match(s,/const natural=\(map:T\.Texture,color:number,roughness=\.9,bumpScale=\.13\)=>physical/);
 assert.match(s,/terrain:new T\.MeshStandardMaterial\(\{color:0xffffff,vertexColors:true/);
 assert.match(s,/foliage:physical/);
 assert.match(s,/rock:natural\(terrainMaps\.rock/);
 assert.match(s,/new T\.MeshStandardMaterial\(\{map,color,bumpMap:map/);
 assert.match(s,/if\(usesRebuiltGraphics\(\)\)this\.root\.traverse/);
 assert.match(s,/audit\.textureMappedMeshes\+\+/);
 assert.match(s,/audit\.flatImageCards\+\+/);
 assert.match(s,/audit\.sprites\+\+/);
});

test('Large ice / jungle / volcanic banks are tessellated full-volume terrain',async()=>{
 const s=await read('environment-art');
 assert.match(s,/function cliffRelief\(/);
 assert.match(s,/const env=STAGES\[stage\]\.environment,columns=9,rows=9/);
 assert.match(s,/new T\.Float32BufferAttribute\(positions,3\)/);
 assert.match(s,/new T\.Float32BufferAttribute\(colors,3\)/);
 assert.match(s,/geometry\.computeVertexNormals\(\)/);
 assert.match(s,/const mesh=new T\.Mesh\(geometry,p\.terrain\)/);
 assert.match(s,/if\(usesRebuiltGraphics\(\)\)\{\s*cliffRelief/);
 assert.match(s,/vert\(pa\.x,pa\.y,-8\.2,shade\)/);
 assert.match(s,/if\(side>0\)indices\.push\(a,b,c,b,d,c\)/);
 assert.match(s,/else indices\.push\(a,c,b,b,c,d\)/);
});

test('GPU visual review audits actual render scene, not file names or declared 3D status',async()=>{
 const s=await readFile('scripts/visual-playtest.mjs','utf8');
 assert.match(s,/background\?\.physicalAudit\?\.textureMappedMeshes===0/);
 assert.match(s,/background\.physicalAudit\.flatImageCards===0/);
 assert.match(s,/background\.physicalAudit\.sprites===0/);
 assert.match(s,/terrainReliefMeshes>0/);
 assert.match(s,/terrainTriangles>200/);
});

test('World Rebuild orbital-fortress corridor uses raised 3D deck plates, not a giant image floor',async()=>{
 const s=await read('fortress');
 assert.match(s,/Main station corridor previously relied on a huge photographic floor map/);
 assert.match(s,/if\(usesRebuiltGraphics\(\)\)\{\s*\/\/ Main station corridor/);
 assert.match(s,/block\(g,p\.dark,xx,yy,-5\.14,w,1\.85,\.085\)/);
 assert.match(s,/block\(g,\(v\+row\+col\)%5===0\?p\.plate:p\.deck/);
 assert.match(s,/block\(g,p\.rust,xx\+side\*\(w\*\.46\),yy\+end\*\.72/);
 assert.match(s,/Longitudinal cable conduits and cross-members/);
});
