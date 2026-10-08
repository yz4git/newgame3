import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {updateBattlefield} from '../app/battlefield.ts';
import {stageDistance} from '../app/bg-map.ts';
import {fieldPresentation} from '../app/field-clarity.ts';
const idle={x:0,y:0,focus:false};
function field(stage=0){
 const g=new Game();g.start('campaign','normal',stage);
 g.time=STAGES[stage].duration*.095;g.update(STEP,idle);
 const n=g.nodes.find(n=>!n.dead&&n.attach==='field');
 assert.ok(n,'facility present');
 return {g,n};
}
test('Physical facilities traverse the background at the same world speed, without billboard sliding',()=>{
 const {g,n}=field();const y=n.y;
 const time=.7;const backgroundTravel=stageDistance(time)-stageDistance(0);
 updateBattlefield(g,time);
 assert.ok(Math.abs((y-n.y)-backgroundTravel)<1e-7,'geometry is anchored to background traversal');
 assert.ok(n.radius>=2.65,'the visible facility has a matching large damage surface');
});
test('Spatial installations have a finite and honest escape timer',()=>{
 const {g,n}=field();
 assert.ok(n.y>=18&&n.y<=19.1,'installation enters from outside camera top');
 assert.ok(n.life>=8,'facility should remain available for deliberate targeting');
 const start=fieldPresentation(n).timeLeft;
 updateBattlefield(g,2);
 assert.ok(fieldPresentation(n).timeLeft<start-1.9);
 assert.ok(n.y<10.5);
});
test('Structures cease to exist when they pass completely beyond the viewport',()=>{
 const {g,n}=field(3);
 n.age=8.19;n.y=-17;
 updateBattlefield(g,.15);
 assert.ok(n.dead);
 assert.equal(g.battlefield.stageEscaped,1);
});
test('Stage variants retain two accessible reactors on schedule',()=>{
 for(let stage=0;stage<6;stage++){
  const {g,n}=field(stage);
  assert.equal(n.index,0);
  assert.ok(n.maxHp>=40);
  assert.equal(g.battlefield.seen[0],true);
  g.time=STAGES[stage].duration*.615;
  updateBattlefield(g,.05);
  assert.equal(g.battlefield.seen[1],true);
  const reactors=g.nodes.filter(n=>n.attach==='field');
  assert.equal(reactors.length,2);
 }
});
