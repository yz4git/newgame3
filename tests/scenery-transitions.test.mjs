import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../app/sim.ts';
import {distanceReveal,easeReveal,approachReveal} from '../app/scenery-transitions.ts';

test('finite background setpieces fade continuously and symmetrically as they approach or leave',()=>{
 const offsets=[-55,-52,-50,-42,-36,-30,-24,0,24,30,36,42,50,52,55];
 const values=offsets.map(x=>distanceReveal(x,24,54));
 assert.equal(values[0],0);assert.equal(values.at(-1),0);
 assert.equal(distanceReveal(0,24,54),1);
 assert.equal(distanceReveal(54,24,54),0);
 assert.equal(distanceReveal(-54,24,54),0);
 for(const d of [25,28,30,34,40,46,50,53]){
  const a=distanceReveal(d,24,54),b=distanceReveal(d+.01,24,54);
  assert.ok(a>b,`opacity must decrease continuously towards the edge: ${d}`);
  assert.ok(a-b<.003,'single frame must not cause a jump');
  assert.equal(a,distanceReveal(-d,24,54));
 }
 assert.ok(distanceReveal(36,24,54)>.5);
 assert.ok(easeReveal(.2)>0&&easeReveal(.2)<1);
});

test('event architecture needs multiple frames to appear and withdraw, even on instant cues',()=>{
 let reveal=0;
 const entrances=[];
 for(let i=0;i<30;i++){reveal=approachReveal(reveal,1,1/60,.55);entrances.push(reveal);}
 assert.ok(entrances[0]>0&&entrances[0]<.04);
 assert.ok(entrances[10]<entrances[20]);
 assert.ok(entrances[29]<1);
 for(let i=0;i<45;i++)reveal=approachReveal(reveal,1,1/60,.55);
 assert.equal(reveal,1);
 reveal=approachReveal(reveal,0,1/60,.55);
 assert.ok(reveal>.9&&reveal<1);
 for(let i=0;i<40;i++)reveal=approachReveal(reveal,0,1/60,.55);
 assert.equal(reveal,0);
 assert.equal(approachReveal(.3,1,0),.3,'pausing game must hold the visual state');
 assert.equal(approachReveal(0,1,-.01),0);
});

test('background-only easing never mutates combat state, bullets or enemy hit boxes',()=>{
 const g=new Game();g.start('campaign','normal',3);
 const before=g.snapshot();
 for(let i=0;i<300;i++){
  distanceReveal(20+i*.04,23,54);
  approachReveal(i/300,1,1/60,.57);
 }
 assert.deepEqual(g.snapshot(),before);
});

test('all active world background systems use a continuous reveal and preserve Classic mode',async()=>{
 const [world,fortress,scenic,stageEffects]=await Promise.all(
  ['world-alive-scene','fortress','scenic-choreography','stage-effects'].map(n=>readFile('app/'+n+'.ts','utf8')));
 assert.match(world,/this\.bayReveal\[bay\.index\]=approachReveal\(/);
 assert.match(world,/bay\.root\.position\.y=12\.5\+\(1-reveal\)\*19/);
 assert.match(world,/this\.exitReveal=approachReveal\(/);
 assert.doesNotMatch(world,/bay\.root\.visible=underway&&!reduced&&!disabled&&preparing>/);
 assert.match(scenic,/this\.reactionReveal=approachReveal\(/);
 assert.match(scenic,/side\*\(10\.7\+\(1-reveal\)\*10\)/);
 assert.match(fortress,/this\.reveal\(m,distanceReveal\(m\.position\.y,24,54\)\)/);
 assert.match(fortress,/this\.prepareReveal\(m\)/);
 assert.match(fortress,/else m\.visible=Math\.abs\(m\.position\.y\)<42/);
 assert.match(stageEffects,/distanceReveal\(layer\.position\.y,23,54\)/);
 assert.match(stageEffects,/s\.material\.opacity=p\.alpha\*\.20\*alpha/);
 assert.doesNotMatch(fortress,/m\.visible=sceneVisible\(/);
});
