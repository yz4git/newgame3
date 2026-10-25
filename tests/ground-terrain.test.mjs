import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GroundWorld,heightAt,waterLevel,coastZone,gateCount,gateZ,passesGate} from '../app/flight-terrain.ts';
import {routeCenter} from '../app/nova64-rules.ts';

test('each of six planetary environments has a real visible upward-facing 3D terrain',()=>{
 for(let stage=0;stage<6;stage++){
  const ground=new GroundWorld();ground.configure(stage,0,false);
  assert.equal(ground.tilesCount,12);
  assert.equal(ground.root.children.length,12);
  let triangles=0,has3D=false,upward=false;
  for(const section of ground.root.children)section.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   const geo=o.geometry;
   triangles+=(geo.index?.count||geo.getAttribute('position').count)/3;
   const attr=geo.getAttribute('position'),normal=geo.getAttribute('normal');
   if(attr&&attr.count>150){
    let low=Infinity,high=-Infinity;
    for(let i=0;i<attr.count;i++){const y=attr.getY(i);low=Math.min(low,y);high=Math.max(high,y);}
    if(high-low>1.3)has3D=true;
    for(let i=0;i<normal.count;i++){if(normal.getY(i)>.4){upward=true;break;}}
   }
  });
  assert.ok(triangles>1300,'no spatial 3D floor for stage '+stage);
  assert.ok(has3D,'lacks sculpted topography in stage '+stage);
  assert.ok(upward,'no visible upward terrain faces in stage '+stage);
  ground.clear();assert.equal(ground.tilesCount,0);
 }
});
test('opening level progresses from water intro to city, river canyon and waterfall',()=>{
 assert.equal(coastZone(0,-80),true);
 assert.equal(coastZone(0,-300),true);
 assert.equal(coastZone(0,-450),false);
 assert.equal(coastZone(0,-2200),true);
 assert.equal(coastZone(0,-3600),false);
 const c=routeCenter(0,-2200);
 assert.ok(waterLevel(0,-2200)>heightAt(0,c.x,-2200));
 assert.ok(heightAt(0,c.x+90,-2200)>heightAt(0,c.x,-2200)+8);
});
test('seven stone arches require flying below bridges near track center',()=>{
 assert.equal(gateCount(),7);
 for(let i=0;i<gateCount();i++){
  const z=gateZ(i),center=routeCenter(0,z);
  assert.ok(z<0);
  assert.equal(passesGate({x:center.x,y:1,z:z+4},{x:center.x,y:1,z:z-4},z,0),true);
  assert.equal(passesGate({x:center.x+15,y:1,z:z+4},{x:center.x+15,y:1,z:z-4},z,0),false);
  assert.equal(passesGate({x:center.x,y:13,z:z+4},{x:center.x,y:13,z:z-4},z,0),false);
 }
});
test('physical arches track success/failure exactly once',()=>{
 const w=new GroundWorld();w.configure(0,-1790,false);
 const z=gateZ(0),center=routeCenter(0,z);
 const a={x:center.x,y:1,z:z+3},b={x:center.x,y:1,z:z-3};
 assert.deepEqual(w.gatesCrossed(a,b),[{index:0,passed:true}]);
 assert.deepEqual(w.gatesCrossed(a,b),[]);
 assert.equal(w.gateState.passed,1);
 const z2=gateZ(1),offset=routeCenter(0,z2).x+20;
 assert.deepEqual(w.gatesCrossed({x:offset,y:1,z:z2+3},{x:offset,y:1,z:z2-3}),[{index:1,passed:false}]);
 assert.equal(w.gateState.missed,1);w.clear();
});
test('terrain streams ahead without increasing the bounded 12-tile corridor render budget',()=>{
 const w=new GroundWorld();w.configure(0,0,false);
 for(let z=0;z>-4200;z-=75){
  w.step(z,false);
  assert.equal(w.tilesCount,12);
  const deepest=Math.min(...w.root.children.map(g=>g.position.z));
  const closest=Math.max(...w.root.children.map(g=>g.position.z));
  assert.ok(closest>=z-130,'ground falls behind ship');
  assert.ok(deepest<=z-180,'ground fails to extend ahead');
 }
 w.clear();
});

test('all-range city and volcanic missions have ground across the entire combat arena',()=>{
 for(const stage of [2,5]){
  const world=new GroundWorld();world.configure(stage,0,true);
  assert.equal(world.tilesCount,17);
  let minX=Infinity,maxX=-Infinity;
  for(const group of world.root.children)group.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   const a=o.geometry.getAttribute('position');
   if(!a||a.count<300) return;
   for(let i=0;i<a.count;i++){minX=Math.min(minX,a.getX(i));maxX=Math.max(maxX,a.getX(i));}
  });
  assert.ok(minX< -250 && maxX >250,'arena ground width should surround the whole field');
  world.clear();
 }
});

test('a wide-scrolling chase camera is never trapped inside tall city architecture',()=>{
 for(const depth of [440,760,970,1200,1380]){
  const world=new GroundWorld();
  world.configure(0,-depth,false);
  for(const lane of [-44,-35,-20,0,20,35,44]){
   const z=-depth+15,route=routeCenter(0,-depth);
   // On a wide corridor the camera follows roughly 82% of outer-lane
   // displacement. In normal flight it stays about 4.3 above the course.
   const x=route.x+Math.sign(lane)*Math.max(0,Math.abs(lane)-6.5)*.82;
   const y=route.y+4.3;
   assert.equal(world.collisions({x,y,z},{x,y,z},2.5),null,
    'camera blocked by a city structure at depth '+depth+', lane '+lane);
  }
  world.clear();
 }
});
