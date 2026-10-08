import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {updateBattlefield} from '../app/battlefield.ts';
import {FacilityDemolitionMotion,isFacilityDemolition,drawFacilityDemolitionCanvas} from '../app/facility-demolition.ts';
const idle={x:0,y:0,focus:false};
function liveFacility(stage=0){
 const g=new Game();g.start('campaign','normal',stage);
 g.time=STAGES[stage].duration*.095;g.update(STEP,idle);g.drainEvents();
 const n=g.nodes.find(n=>n.attach==='field'&&!n.dead);assert.ok(n);
 return {g,n};
}
test('3D facility destruction no longer emits stock enemy explode or atlas resonance events',()=>{
 for(let stage=0;stage<6;stage++){
  const {g,n}=liveFacility(stage);
  g.damageNode(n,999);
  const events=g.drainEvents();
  assert.equal(events.filter(e=>e.type==='fieldcollapse').length,1);
  assert.equal(events.filter(e=>e.type==='fieldclear').length,1);
  assert.equal(events.some(e=>(e.type==='explode'||e.type==='resonance')&&e.x===n.x&&e.y===n.y),false,
   'Facility explosion must not route into old stretched 2D animation textures');
 }
});
test('Cinematic facility destruction has analytic rings and bounded metallic debris',()=>{
 const motion=new FacilityDemolitionMotion();
 for(const type of ['fieldcollapse','fieldburst','fieldcritical','fieldclear']){
  assert.ok(isFacilityDemolition(type));
  motion.event({type,x:2,y:4,size:7,color:0xffa76e});
 }
 assert.equal(isFacilityDemolition('explode'),false);
 assert.equal(isFacilityDemolition('bosskill'),false);
 assert.equal(motion.pulses.length,4);
 assert.ok(motion.shards.length>=20);
 assert.ok(motion.shards.every(s=>s.size>0&&s.life>.5&&Number.isFinite(s.vx)));
 assert.ok(motion.pulses.every(p=>p.life<1&&p.size<=7.5));
});
test('Long continuous demolition remains strictly bounded in memory and draw capacity',()=>{
 const m=new FacilityDemolitionMotion();
 for(let i=0;i<100;i++){
  m.event({type:i%2===0?'fieldcollapse':'fieldburst',x:i%12-6,y:5,color:0xffa058});
  assert.ok(m.pulses.length<=12);assert.ok(m.shards.length<=112);
 }
 const g=liveFacility().g;
 m.update(g,.4);
 assert.ok(m.diagnostics().pulses<=12&&m.diagnostics().shards<=112);
 m.update(g,2);assert.deepEqual(m.diagnostics(),{pulses:0,shards:0});
});
test('Reduced animation mode does not leak fragments or prevent shockwave lifetime',()=>{
 const m=new FacilityDemolitionMotion(),g=liveFacility().g;
 m.event({type:'fieldcollapse',x:0,y:0});
 assert.ok(m.shards.length>0);
 m.update(g,.35,true);
 assert.equal(m.shards.length,0);
 assert.equal(m.pulses.length,1);
 m.update(g,1,true);
 assert.equal(m.pulses.length,0);
 m.event({type:'fieldclear',x:0,y:0});m.event({type:'stage'});
 assert.deepEqual(m.diagnostics(),{pulses:0,shards:0});
});
test('Four-stage chain detonations are still present after texture replacement',()=>{
 const {g,n}=liveFacility(4);g.damageNode(n,999);g.drainEvents();
 updateBattlefield(g,2.3);
 const events=g.drainEvents().filter(e=>e.type==='fieldburst');
 assert.equal(events.length,4);
 const fx=new FacilityDemolitionMotion();events.forEach(e=>fx.event(e));
 assert.equal(fx.pulses.length,4);assert.ok(fx.shards.length>0);
});
test('Explosions and wrecks never fall back to facility atlas or generic texture sprites',async()=>{
 const [encounter,render,canvas,finish]=await Promise.all([
  readFile('app/encounter-view.ts','utf8'),readFile('app/render.ts','utf8'),
  readFile('app/canvas.ts','utf8'),readFile('app/finish-motion.ts','utf8')
 ]);
 const collapse=encounter.slice(encounter.indexOf('for(const wreck of g.battlefield.collapses)'));
 assert.match(collapse,/canvasFacility\(wreck.stage,wreck.index\)/);
 assert.doesNotMatch(collapse,/drawImage\(fieldAtlas/);
 assert.match(render,/if\(isFacilityDemolition\(e.type\)\)/);
 assert.match(canvas,/if\(isFacilityDemolition\(e.type\)\)return/);
 assert.doesNotMatch(finish,/\bfieldcollapse\b|\bfieldburst\b/);
});
