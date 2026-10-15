import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../app/sim.ts';
import {bossEscapeFrame} from '../app/boss-finish.ts';
import {InvasionDirector} from '../app/invasion-director.ts';
import {FxDirector} from '../app/fx-director.ts';
import {FinishMotion} from '../app/finish-motion.ts';

test('Actual boss defeat retains a clear rupture before a bounded, ring-free escape in all six worlds',()=>{
 for(let stage=0;stage<6;stage++){
  const g=new Game();g.start('campaign','normal',stage);
  const director=new InvasionDirector(),fx=new FxDirector();
  director.draw(g,0);fx.plan(g);
  g.spawnBoss();g.boss.hp=1;g.nova();
  for(const e of g.drainEvents()){director.event(e);fx.event(e);}
  assert.equal(g.state,'transition');
  assert.equal(g.boss.dead,true);
  const travel=director.root.getObjectByName('hyperspace-strata');
  travel.traverse(o=>assert.notEqual(o.geometry?.type,'TorusGeometry'));
  let previous=0;
  for(const age of [0,.2,.6,.9,1.3,1.8,2.6,3.3,3.5]){
   g.transitionTime=3.5-age;
   const before=g.snapshot(),frame=bossEscapeFrame(g.transitionTime),mix=fx.plan(g);
   director.draw(g,.016,false,false,mix);
   assert.deepEqual(g.snapshot(),before,'presentation must not edit progression or consume RNG');
   assert.ok(frame.departure>=previous&&frame.departure<=1);previous=frame.departure;
   const d=director.diagnostics();
   if(age<=.9){assert.equal(frame.departure,0);assert.equal(mix.moment,'boss-finish');assert.equal(d.travelStreaks,0);}
   if(age>=1.3&&age<3.5){assert.equal(mix.moment,'warp');assert.equal(d.travelStreaks,24);}
   assert.ok(d.armorFragments>0,'physical breakup is retained');
  }
  director.draw(g,0,true,false,fx.plan(g,true));assert.equal(director.diagnostics().travelStreaks,0);
 }
});

test('A boss finish clears existing waves and rejects the trailing NOVA in either event order',()=>{
 for(const order of [['nova','bosskill'],['bosskill','nova']]){
  const g=new Game();g.start();const finish=new FinishMotion();
  for(const type of order)finish.event({type,x:0,y:5});
  assert.equal(finish.waves.length,0);assert.ok(finish.fragments.length>0);
  const frozen=structuredClone(finish.fragments);g.pause();finish.update(g,.8);
  assert.deepEqual(finish.fragments,frozen);
  g.resume();finish.update(g,1.4);finish.event({type:'nova'});
  assert.equal(finish.waves.length,1,'normal NOVA waves must recover after the finish');
  finish.event({type:'stage'});finish.event({type:'nova'});assert.equal(finish.waves.length,1);
 }
});

test('Escape timing follows paused simulation and reaches departure without extending the transition',()=>{
 const g=new Game();g.start();g.spawnBoss();g.boss.hp=1;g.nova();
 const frame=bossEscapeFrame(g.transitionTime);g.pause();g.update(.5,{x:0,y:0,focus:false});
 assert.deepEqual(bossEscapeFrame(g.transitionTime),frame);
 assert.equal(bossEscapeFrame(3.5).departure,0);assert.equal(bossEscapeFrame(0).departure,1);
 for(const remaining of [-10,0,1,3.5,20]){
  const frame=bossEscapeFrame(remaining);assert.ok(frame.streaks>=0&&frame.streaks<=1);
 }
});
