import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import {Game} from '../app/sim.ts';
import {STAGES} from '../app/stages.ts';
import {StageSequences3D} from '../app/stage-sequences.ts';
import {CinematicDetonations} from '../app/cinematic-detonations.ts';
import {FxDirector} from '../app/fx-director.ts';
import {filmFrame,FILM_STOCKS} from '../app/film-lighting.ts';

test('all 18 solid animated sets remain behind the player and bullet plane',()=>{
 const scenes=new StageSequences3D(),g=new Game();
 for(let stage=0;stage<6;stage++){
  g.start('campaign','normal',stage);
  for(let act=0;act<3;act++)for(const t of [0,2.4,4.7,5.8,6.4,8,11,14]){
   g.time=STAGES[stage].duration*[.13,.43,.72][act]+t;g.visualTime=g.time;
   scenes.draw(g,.016);scenes.root.updateMatrixWorld(true);
   const chapter=scenes.root.children[act];
   // Audit actual vertices after every parent articulation, including newly
   // attached pistons/bolts, rather than checking the source for coordinates.
   for(const group of chapter.children.slice(0,3)){
    if(group.children.length===0)continue;
    const bounds=new T.Box3().setFromObject(group);
    assert.ok(bounds.max.z<.75,`stage ${stage}, act ${act}, t ${t}: foreground z=${bounds.max.z}`);
    assert.ok(Number.isFinite(bounds.min.x+ bounds.max.z));
   }
  }
  const d=scenes.diagnostics().cinematic;
  assert.ok(d.solidMeshes>20);
  assert.ok(d.triangles<40000,'all three finite sets fit the mobile geometry budget');
 }
});

test('seeking, pausing, reduced motion and restarting leave no stale film cue',()=>{
 const scenes=new StageSequences3D(),g=new Game();g.start('campaign','normal',2);
 g.time=STAGES[2].duration*.43+6.1;
 scenes.draw(g,.016);const cue={...scenes.filmCue()};
 assert.ok(cue.impact>.8);
 g.state='paused';scenes.draw(g,0);
 assert.deepEqual(scenes.filmCue(),cue);
 g.state='playing';scenes.draw(g,0,true);
 assert.equal(scenes.filmCue().weight,0);
 g.mode='bossrush';scenes.draw(g,.016);
 assert.deepEqual(scenes.diagnostics().activeEpisodes,[]);
 assert.equal(scenes.impactPulse(),0);
 g.start('campaign','normal',2);scenes.draw(g,.016);
 assert.equal(scenes.impactPulse(),0);
});

test('physical opacity becomes solid in view and repeated crowd adaptation is reversible',()=>{
 const scenes=new StageSequences3D(),g=new Game();g.start('campaign','normal',5);
 g.time=STAGES[5].duration*.43+8;scenes.draw(g,.016);
 const chapter=scenes.root.children[1],materials=new Set();
 chapter.children.slice(0,3).forEach(p=>p.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.isMeshStandardMaterial)materials.add(o.material);}));
 const rest=[...materials].map(m=>m.color.clone());
 for(const m of materials)assert.equal(m.opacity,1);
 scenes.draw(g,.016,false,false,1);
 assert.ok([...materials][0].color.r<rest[0].r);
 for(let i=0;i<30;i++)scenes.draw(g,0,false,false,1);
 scenes.draw(g,.016,false,false,0);
 [...materials].forEach((m,i)=>assert.ok(m.color.equals(rest[i]),'no accumulating darkness'));
});

test('film lighting has six looks, bounded exposure and no camera animation in reduced motion',()=>{
 assert.equal(new Set(FILM_STOCKS.map(x=>x.name)).size,6);
 const cue={weight:1,elapsed:5.8,impact:1,anticipation:1,afterglow:0};
 for(let s=0;s<6;s++){
  const f=filmFrame(s,18,cue),quiet=filmFrame(s,18,cue,1),reduced=filmFrame(s,18,cue,0,true);
  assert.ok(f.exposure>.80&&f.exposure<.92);
  assert.ok(f.lensPush<=.018&&f.lensLift<=3.2&&Math.abs(f.lensSide)<=2.8);
  assert.ok(quiet.lensPush<f.lensPush);
  assert.equal(reduced.lensPush,0);assert.equal(reduced.lensLift,0);
  assert.ok(f.fogNear>50,'projectiles at the gameplay depth must stay clear');
 }
});

test('explosions roll into smoke, pause exactly, then release their fixed pool',()=>{
 const g=new Game();g.start();const mix=new FxDirector().plan(g),fx=new CinematicDetonations();
 for(let i=0;i<50;i++)fx.event({type:'explode',x:i%4,y:8,size:2});
 fx.draw(g,.4,mix);let d=fx.diagnostics();
 assert.equal(d.active,8);assert.ok(d.fire>0&&d.fire<=48&&d.cores<=8);
 fx.draw(g,.5,mix);assert.ok(fx.diagnostics().smoke>0);
 const before=fx.root.children.map(m=>Array.from(m.instanceMatrix.array));
 fx.draw(g,0,mix);
 assert.deepEqual(fx.root.children.map(m=>Array.from(m.instanceMatrix.array)),before);
 fx.draw(g,4,mix);assert.equal(fx.diagnostics().active,0);
 assert.ok(fx.root.children.every(m=>m.count===0));
 fx.event({type:'explode',size:1});fx.event({type:'stage'});
 assert.equal(fx.diagnostics().active,0);
});
