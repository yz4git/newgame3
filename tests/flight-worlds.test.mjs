import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {Game} from '../app/sim.ts';
import {STAGES} from '../app/stages.ts';
import {flightFrame,FLIGHT_ROUTES} from '../app/flight-route.ts';
import {FlightWorlds3D} from '../app/flight-worlds.ts';
import {fitCinemaCamera,poseCinemaCamera} from '../app/cinema-camera.ts';
import {filmFrame,EMPTY_FILM_CUE} from '../app/film-lighting.ts';

test('all six authored flights keep the entire corridor visible and touch rays exact during dives and banks',()=>{
 for(const [w,h]of[[390,844],[375,667],[430,932],[768,1024]]){
  const camera=new T.PerspectiveCamera(50,w/h,.1,260);fitCinemaCamera(camera,w,h);
  for(let stage=0;stage<6;stage++)for(let step=0;step<=40;step++)for(const pressure of[0,1]){
   const time=STAGES[stage].duration*step/40;
   poseCinemaCamera(camera,filmFrame(stage,time,EMPTY_FILM_CUE),.012,1.02,0,flightFrame(stage,time,pressure));
   for(const x of[-10.2,10.2])for(const y of[-14.4,14.8]){
    const world=new T.Vector3(x,y,1),screen=world.clone().project(camera);
    assert.ok(Math.abs(screen.x)<.94&&Math.abs(screen.y)<.90,`clipped stage ${stage} time ${time}: ${screen.toArray()}`);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(screen.x,screen.y),camera);
    const hit=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-1),new T.Vector3());
    assert.ok(hit.distanceTo(world)<1e-8);
   }
  }
 }
});

test('continuous worlds are finite, substantial, behind combat and bounded in GPU draws',()=>{
 const world=new FlightWorlds3D(),g=new Game();
 for(let stage=0;stage<6;stage++){
  g.start('campaign','normal',stage);g.time=STAGES[stage].duration*.34;world.draw(g);
  const d=world.diagnostics(),bounds=new T.Box3().setFromObject(world.root);
  assert.ok(d.instances>50&&d.instances<700);
  assert.ok(d.triangles>6000&&d.triangles<80000&&d.draws<=8);
  assert.ok(bounds.max.z<-.75,`scenery crosses gameplay plane: ${stage}/${bounds.max.z}`);
  assert.ok(bounds.max.y-bounds.min.y>400);
  assert.equal(d.textureCards,0);assert.equal(d.finite,true);
  const before=g.snapshot(),geometry=world.root.children.map(x=>x.geometry);
  world.root.updateMatrix();const paused=world.root.matrix.clone();
  g.state='paused';g.resumeState='playing';world.draw(g);world.root.updateMatrix();
  assert.deepEqual(world.root.matrix.elements,paused.elements);
  assert.deepEqual(world.root.children.map(x=>x.geometry),geometry);
  g.state='playing';assert.deepEqual(g.snapshot(),before);
 }
});

test('flight direction varies by place, quietens under pressure and stays stable with reduced motion',()=>{
 assert.equal(new Set(FLIGHT_ROUTES.map(x=>x.map(k=>k.name).join('/'))).size,6);
 for(let stage=0;stage<6;stage++){
  const time=STAGES[stage].duration*.34,full=flightFrame(stage,time),quiet=flightFrame(stage,time,1),reduced=flightFrame(stage,time,0,true);
  assert.ok(Math.abs(full.bank)>.4&&Math.abs(full.eyeX)>=9);
  assert.ok(Math.abs(quiet.bank)<Math.abs(full.bank));
  assert.ok(reduced.bank===0&&reduced.eyeX===0&&reduced.eyeY===0&&reduced.eyeZ===0);
  const epsilon=1e-4;
  const left=flightFrame(stage,time-epsilon),right=flightFrame(stage,time+epsilon);
  assert.ok(Math.abs(left.bank-right.bank)<1e-4&&Math.abs(left.eyeX-right.eyeX)<1e-3);
 }
});

test('hostile salvo pressure eases the lens back and pausing retains the current bank',()=>{
 const world=new FlightWorlds3D(),g=new Game();g.start('campaign','normal',2);g.time=82*.34;
 world.draw(g,false,false,0,1/60);const full=world.diagnostics().bank;
 g.time+=1/60;world.draw(g,false,false,1,1/60);const first=world.diagnostics().bank;
 assert.ok(Math.abs(first)<Math.abs(full)&&Math.abs(first)>Math.abs(full)*.85);
 g.state='paused';g.resumeState='playing';world.draw(g,false,false,0,1/60);
 assert.equal(world.diagnostics().bank,first);
 g.state='playing';world.draw(g,false,false,1,.4);
 assert.ok(Math.abs(world.diagnostics().bank)<Math.abs(first));
});
