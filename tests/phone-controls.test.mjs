import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {pointerDragDelta} from '../app/touch-controls.ts';
import {playerMarker,positionPlayerMarker} from '../app/player-marker.ts';
import {fitCinemaCamera,poseCinemaCamera} from '../app/cinema-camera.ts';
import {flightFrame} from '../app/flight-route.ts';
import {filmFrame,EMPTY_FILM_CUE} from '../app/film-lighting.ts';

test('a camera bank between finger events cannot introduce drag motion',()=>{
 for(const [w,h]of[[390,844],[375,667],[430,932]]){
  const camera=new T.PerspectiveCamera(50,w/h,.1,260);fitCinemaCamera(camera,w,h);
  const project=(x,y)=>{
   const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/w*2-1,1-y/h*2),camera);
   return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-1),new T.Vector3());
  };
  const finger={x:w*.48,y:h*.62};let former;
  for(let stage=0;stage<6;stage++)for(const progress of[.16,.34,.52,.72]){
   const time=STAGES[stage].duration*progress;
   poseCinemaCamera(camera,filmFrame(stage,time,EMPTY_FILM_CUE),.012,1.018,0,flightFrame(stage,time));
   const still=pointerDragDelta(finger,finger,project);
   assert.deepEqual(still,{x:0,y:0},'a fixed finger keeps the same target after every camera move');
   const move=pointerDragDelta(finger,{x:finger.x+2,y:finger.y-2},project);
   assert.ok(move.x>0&&move.y>0&&Math.hypot(move.x,move.y)<.35,'a two-pixel move stays small during a large bank');
   if(stage===2&&progress===.16)former=project(finger.x,finger.y);
   if(stage===2&&progress===.34)assert.ok(former.distanceTo(project(finger.x,finger.y))>.4,'this replay crosses a real camera projection change');
  }
 }
});

test('the visible white hit circle matches the actual collision threshold in every difficulty',()=>{
 const marker=playerMarker();
 const ring=marker.children[1];ring.geometry.computeBoundingBox();
 for(const difficulty of['casual','normal','expert'])for(const inside of[true,false]){
  const g=new Game();g.start('campaign',difficulty);g.time=5;g.invulnerable=0;g.shotTimer=900;g.schedule=[];
  positionPlayerMarker(marker,g);
  assert.deepEqual(marker.position.toArray(),[g.player.x,g.player.y,1]);
  const radius=ring.geometry.boundingBox.max.x*marker.scale.x;
  const hull=g.hull;
  g.projectile(marker.position.x+radius+(inside?-.005:.005),marker.position.y,0,0,true,1,false,0xffa73b,{radius:0});
  g.update(STEP,{x:0,y:0,focus:false});
  assert.equal(g.hull,hull-(inside?1:0),'the drawn ring describes the same boundary as simulation');
  const before=marker.scale.clone();g.invulnerable=3;g.player.focus=true;g.visualTime=32;
  positionPlayerMarker(marker,g);assert.deepEqual(marker.scale.toArray(),before.toArray(),'the hit circle never pulses larger');
 }
 assert.ok(marker.children.every(mesh=>!mesh.material.depthTest&&!mesh.material.depthWrite&&mesh.renderOrder>=60),'the small dark-edged point stays visible over the craft');
});
