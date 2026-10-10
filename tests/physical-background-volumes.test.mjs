import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=name=>readFile('app/'+name+'.ts','utf8');

test('World Rebuild background waterways are side-walled volumetric 3D geometry with no painted image',async()=>{
 const s=await source('living-surface');
 assert.match(s,/new T\.BoxGeometry\(32,96,\.72,36,68,1\)/);
 assert.match(s,/new T\.MeshStandardMaterial\(\{color:0xffffff,vertexColors:true/);
 assert.match(s,/this\.geometry\.setAttribute\('color'/);
 assert.match(s,/this\.originalZ=Float32Array\.from/);
 assert.match(s,/colors!\.setXYZ\(i,r,g,bl\)/);
 assert.match(s,/this\.geometry\.computeVertexNormals\(\)/);
 assert.match(s,/textureBackplate:!this\.rebuilt/);
 assert.match(s,/this\.rebuilt\?new T\.BoxGeometry/);
 assert.match(s,/if\(!this\.rebuilt\)\{/);
 assert.doesNotMatch(s,/this\.rebuilt.*map:terrainMaps\.lava/);
});
test('Ocean, ice, jungle and lava have deliberately different shaded physical volumes',async()=>{
 const s=await source('living-surface');
 for(const env of ["env==='lava'","env==='ocean'","env==='ice'","env==='jungle'"])assert.ok(s.includes(env),env);
 assert.match(s,/new T\.IcosahedronGeometry\(1,0\)/);
 assert.match(s,/new T\.CylinderGeometry\(\.12,\.18,1,6\)/);
 assert.match(s,/const rockCount=performance\?14:36/);
 assert.match(s,/const seamCount=performance\?24:64/);
 assert.match(s,/dummy\.position\.set\(x,y,this\.base\.position\.z/);
});
test('World Rebuild foliage is genuine branching 3D volume, never an alpha card',async()=>{
 const s=await source('environment-art');
 const canopy=s.slice(s.indexOf('function canopy('),s.indexOf('function crystal('));
 assert.match(canopy,/new T\.CylinderGeometry/);
 assert.match(canopy,/new T\.IcosahedronGeometry/);
 assert.doesNotMatch(canopy,/PlaneGeometry|Sprite\(|map:/);
});
test('Space sky is a physical 3D distance field, not a static image background',async()=>{
 const s=await source('render');
 const sky=s.slice(s.indexOf("if(theme.environment==='asteroids')"),s.indexOf('this.key.color.setHex'));
 assert.match(sky,/new T\.SphereGeometry\(82,24,12\)/);
 assert.match(sky,/3d-nebular-distance-clouds/);
 assert.match(sky,/new T\.InstancedMesh\(new T\.IcosahedronGeometry/);
 assert.doesNotMatch(sky.slice(sky.indexOf('if(usesRebuiltGraphics())'),sky.indexOf('}else{')),/map:terrainMaps\.nebula/);
 assert.match(sky,/new T\.PlaneGeometry\(46,76\)/); // Classic remains intact
});
test('World Rebuild mode preserves Classic and does not change gameplay geometry',async()=>{
 const [surface,style,sim]=await Promise.all([source('living-surface'),source('visual-style'),source('sim')]);
 assert.match(surface,/this\.rebuilt=usesRebuiltGraphics\(\)/);
 assert.match(surface,/new T\.PlaneGeometry\(32,96,24,48\)/);
 assert.match(style,/return localStorage\.getItem\(KEY\)==='classic'\?'classic':'rebuilt'/);
 assert.ok(sim.includes('export class Game'));
});
