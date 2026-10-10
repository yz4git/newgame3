import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../app/sim.ts';
import {FxDirector} from '../app/fx-director.ts';
import {RAIL_DISTRICT_LIMITS,RailDistrictMotion3D} from '../app/rail-district-motion.ts';
const read=n=>readFile('app/'+n+'.ts','utf8');
function testGame(stage=2){
 const g=new Game();g.start('campaign','normal',stage);
 g.time=39;g.enemies=[];g.bullets=[];g.visualTime=5;
 return g;
}
test('old rail template is interrupted and replaced by seven distinct real-3D asymmetric chapters',async()=>{
 const src=await read('fortress');
 for(const name of ['wide dock aperture','huge cylindrical motor',
 'freighter elevator cutout','genuinely open lattice',
 'stepped conduit','offset sensor array','intentionally shattered section']){
  assert.ok(src.includes(name),name);
 }
 assert.match(src,/function railDistrictChapter\(/);
 assert.match(src,/const chapter=\(v\*5\+\(s<0\?3:0\)\+stage\*2\)%7/);
 assert.match(src,/if\(usesRebuiltGraphics\(\)\)\{\s*railDistrictChapter/);
 assert.match(src,/else if\(!open\)/); // unchanged classic graphics
 assert.match(src,/if\(!gap\)/);
});
test('3D rail districts render nonzero different left and right side module groups on all stages',()=>{
 assert.equal(RAIL_DISTRICT_LIMITS.variants,7);
 assert.ok(RAIL_DISTRICT_LIMITS.minCenterClearance>5);
 for(let stage=0;stage<6;stage++){
  const game=testGame(stage),rail=new RailDistrictMotion3D(),fx=new FxDirector();
  rail.draw(game,.016,fx.plan(game));
  const d=rail.diagnostics();
  assert.equal(d.stage,stage);
  assert.ok(d.modules>=2,JSON.stringify(d));
  assert.ok(d.left>=1&&d.right>=1,JSON.stringify(d));
  assert.equal(d.left+d.right,d.modules);
  assert.ok(d.geometryParts>0&&d.geometryParts<=RAIL_DISTRICT_LIMITS.maxSceneMeshes,JSON.stringify(d));
  assert.ok(d.types.length>=2,JSON.stringify(d));
  assert.ok(d.moving>=2);
  assert.equal(d.architecture,'seven-nonrepeating-physical-rail-chapters');
 }
});
test('moving pods and rotating machinery animate independently in x and z',()=>{
 const g=testGame(2),fx=new FxDirector(),r=new RailDistrictMotion3D();
 r.draw(g,.016,fx.plan(g));
 const pods=[],rotors=[];
 r.root.traverse(o=>{
  if(o.name==='lateral-cargo-shuttle')pods.push(o);
  if(o.name==='physical-moving-turbine')rotors.push(o);
 });
 assert.equal(pods.length,6);
 const before=pods.map(p=>[p.position.x,p.position.y]);
 const rotBefore=rotors.map(p=>p.rotation.z);
 g.visualTime=9.1;
 r.draw(g,.016,fx.plan(g));
 assert.ok(pods.some((p,i)=>Math.abs(p.position.x-before[i][0])>.10||Math.abs(p.position.y-before[i][1])>.10));
 assert.ok(rotors.some((p,i)=>Math.abs(p.rotation.z-rotBefore[i])>.30));
});
test('rail modules animate physical shutters in response to facility/boss/escape events without game state writes',()=>{
 const g=testGame(),fx=new FxDirector(),r=new RailDistrictMotion3D();
 r.draw(g,.016,fx.plan(g));
 r.event({type:'fieldcollapse',x:-6,y:8});
 r.draw(g,.16,fx.plan(g));
 assert.equal(r.diagnostics().activeCue,'facility');
 r.event({type:'worldbossentry',x:0,y:8});
 r.draw(g,.16,fx.plan(g));
 assert.equal(r.diagnostics().activeCue,'boss');
 r.event({type:'worldescape',x:0,y:5});
 r.draw(g,.16,fx.plan(g));
 assert.equal(r.diagnostics().activeCue,'collapse');
 assert.ok(r.diagnostics().motionRange>=1);
});
test('performance / bullet-density / reduced-motion protect gameplay center while retaining physical landmarks',()=>{
 const g=testGame(),fx=new FxDirector(),r=new RailDistrictMotion3D();
 for(let i=0;i<42;i++)g.bullets.push({});
 r.draw(g,.016,fx.plan(g),false,true);
 const low=r.diagnostics();
 assert.ok(low.modules<=2,JSON.stringify(low));
 assert.ok(low.left>=1&&low.right>=1);
 r.draw(g,.016,fx.plan(g,true,true),true,true);
 assert.ok(r.diagnostics().modules>=2,'reduced motion keeps static landmark silhouettes');
});
test('only true World Rebuild render mode receives moving rail districts',async()=>{
 const [src,scene,scenic]=await Promise.all(['render','world-alive-scene','scenic-choreography'].map(read));
 assert.match(src,/private railDistricts=usesRebuiltGraphics\(\)\?new RailDistrictMotion3D\(\):null/);
 assert.match(src,/this\.railDistricts\?\.event\(e\)/);
 assert.match(src,/this\.railDistricts\?\.draw\(game,dt,mix/);
 assert.match(src,/railDistricts:this\.railDistricts\?\.diagnostics\(\)\?\?null/);
 assert.match(scene,/No continuous 33 m monorail wall/);
 assert.match(scenic,/former 48\s*\/\/.*vertical rail stripes|former 48/);
});
test('there are no painted sprite rails, white-out, random gameplay changes or invisible collisions',async()=>{
 const src=await read('rail-district-motion');
 assert.doesNotMatch(src,/new T\.Sprite|PlaneGeometry|CanvasTexture|AdditiveBlending|Math\.random|new T\.PointLight|\.spawn\(/);
 assert.match(src,/texture|image|photo/i);
 assert.ok(RAIL_DISTRICT_LIMITS.pulseOpacity<=.18);
});

test('all six stages retain both asymmetric moving rail sides across scrolling and heavy-fire windows',()=>{
 for(let stage=0;stage<6;stage++){
  const g=testGame(stage),fx=new FxDirector(),r=new RailDistrictMotion3D();
  for(const seconds of [0,3,11,19,27,42,61,83,110,144]){
   g.time=seconds;g.visualTime=seconds;
   g.bullets=Array.from({length:42},()=>({}));
   r.draw(g,.016,fx.plan(g),false,true);
   const d=r.diagnostics();
   assert.ok(d.left>=1&&d.right>=1,`missing a side at stage ${stage} t=${seconds}: ${JSON.stringify(d)}`);
   assert.ok(d.types.length===2,`repeated matching left/right section at stage ${stage} t=${seconds}: ${JSON.stringify(d)}`);
   assert.ok(d.modules<=RAIL_DISTRICT_LIMITS.sides);
  }
 }
});
