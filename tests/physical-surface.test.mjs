import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {flowSurface,guardianFace,shadeSolid} from '../app/physical-surface.ts';
import {FlightWorlds3D} from '../app/flight-worlds.ts';
import {Game} from '../app/sim.ts';

test('moving surface normals follow the physical slope, including the performance renderer',()=>{
 for(const stage of[1,3,4,5])for(let i=0;i<30;i++){
  const x=i*3.79-52,y=i*17.3-81,time=i*.81,epsilon=1e-4;
  const wave=flowSurface(x,y,time,stage);
  const dx=(flowSurface(x+epsilon,y,time,stage).height-flowSurface(x-epsilon,y,time,stage).height)/(epsilon*2);
  const dy=(flowSurface(x,y+epsilon,time,stage).height-flowSurface(x,y-epsilon,time,stage).height)/(epsilon*2);
  assert.ok(Math.abs(wave.dx-dx)<1e-8&&Math.abs(wave.dy-dy)<1e-8);
  assert.ok(Math.abs(wave.height)<.6);
 }
 const world=new FlightWorlds3D(),g=new Game();g.start('campaign','normal',1);g.time=25;
 world.draw(g,false,true);
 const surface=world.root.getObjectByName('deep-continuous-river-surface');
 const p=surface.geometry.getAttribute('position'),n=surface.geometry.getAttribute('normal');
 for(let i=0;i<p.count;i+=131){
  const wave=flowSurface(p.getX(i),p.getY(i),25,1),normal=new T.Vector3(n.getX(i),n.getY(i),n.getZ(i));
  assert.ok(Math.abs(p.getZ(i)+48-wave.height)<3e-6);
  assert.ok(Math.abs(normal.length()-1)<1e-6);
  assert.ok(Math.abs(normal.dot(new T.Vector3(1,0,wave.dx)))<1e-6);
 }
 const positions=Array.from(p.array),normals=Array.from(n.array),geometry=surface.geometry;
 g.pause();world.draw(g,false,true);
 assert.deepEqual(Array.from(p.array),positions);assert.deepEqual(Array.from(n.array),normals);
 assert.equal(surface.geometry,geometry,'waves never allocate replacement geometry');
 g.resume();world.draw(g,true,true);const reduced=Array.from(p.array);g.time=40;world.draw(g,true,true);
 assert.deepEqual(Array.from(p.array),reduced,'reduced motion retains a fixed sculpted surface');
});

test('the guardian is a faceted sculpture with recessed sockets and a projecting nose',()=>{
 const geo=guardianFace(),p=geo.getAttribute('position'),n=geo.getAttribute('normal');
 assert.equal(geo.getAttribute('uv').count,p.count,'sculpture is compatible with rigid geometry merging');
 geo.computeBoundingBox();assert.ok(geo.boundingBox.max.z-geo.boundingBox.min.z>3.5);
 let lateral=0;
 for(let i=0;i<p.count;i++){
  assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
  if(Math.abs(n.getX(i))>.2)lateral++;
 }
 assert.ok(lateral>p.count*.2,'the visible face has tangible side-facing stone facets');
});

test('physical face shading retains material relief when mobile cast shadows are disabled',()=>{
 const geo=shadeSolid(new T.BoxGeometry(3,5,8)),p=geo.getAttribute('position'),c=geo.getAttribute('color');
 let top=0,bottom=1;
 for(let i=0;i<p.count;i++){
  if(p.getZ(i)>0)top=Math.max(top,c.getX(i));else bottom=Math.min(bottom,c.getX(i));
  assert.ok(c.getX(i)>.6&&c.getX(i)<=1);
 }
 assert.ok(top-bottom>.20);
});
