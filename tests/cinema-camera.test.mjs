import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {fitCinemaCamera,poseCinemaCamera} from '../app/cinema-camera.ts';
import {filmFrame} from '../app/film-lighting.ts';
import {FxDirector} from '../app/fx-director.ts';
import {Game} from '../app/sim.ts';

test('perspective dolly keeps every flight corner visible and touch rays invert projection',()=>{
 for(const [w,h]of[[390,844],[375,667],[430,932],[768,1024]]){
  const camera=new T.PerspectiveCamera(50,w/h,.1,260);fitCinemaCamera(camera,w,h);
  for(let stage=0;stage<6;stage++)for(const elapsed of[0,2,4.5,5.8,8.4,12]){
   const film=filmFrame(stage,elapsed,{weight:1,elapsed,anticipation:.5,impact:1,afterglow:.5});
   poseCinemaCamera(camera,film,.012,1.018);
   for(const x of[-10.2,0,10.2])for(const y of[-14.4,0,14.8]){
    const world=new T.Vector3(x,y,1),screen=world.clone().project(camera);
    assert.ok(Math.abs(screen.x)<.94&&Math.abs(screen.y)<.90,`clipped ${w}/${h}, stage ${stage}, ${x}/${y}: ${screen.toArray()}`);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(screen.x,screen.y),camera);
    const hit=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-1),new T.Vector3());
    assert.ok(hit.distanceTo(world)<1e-8);
   }
  }
 }
});
test('own weapons do not cancel the scenery, while hostile projectiles do',()=>{
 const g=new Game();g.start();const director=new FxDirector();
 for(let i=0;i<70;i++)g.projectile(0,0,0,20,false);
 assert.equal(director.plan(g).readability,0);
 for(let i=0;i<30;i++)g.projectile(0,0,0,-10,true);
 assert.equal(director.plan(g).readability,1);
 for(const b of g.bullets)if(b.enemy)b.dead=true;
 assert.equal(director.plan(g).readability,0);
});
