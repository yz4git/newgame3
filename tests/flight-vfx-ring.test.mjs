import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {FlightVfx} from '../app/flight3d-visuals.ts';

test('explosion flash cannot turn into a giant opaque foreground ring',()=>{
 const fx=new FlightVfx(true);
 fx.burst(new T.Vector3(0,0,0),10,0xffaa77);
 const ring=fx.root.children.find(x=>x instanceof T.Mesh&&x.geometry instanceof T.RingGeometry);
 assert.ok(ring,'must show a modest impact ring');
 assert.ok(ring.material.opacity<=.26,'initial ring is too opaque');
 for(const dt of [.05,.1,.12,.13,.13]){
  fx.update(new T.Vector3(),2,dt,76,false);
  assert.ok(ring.scale.x<=3,'ring can obscure boss and ship');
  assert.ok(ring.material.opacity<=.25,'ring became opaque');
 }
 fx.clear();
});
