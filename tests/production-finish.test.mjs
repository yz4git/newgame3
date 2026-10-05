import test from 'node:test';
import assert from 'node:assert/strict';
import {effectSamples,effectDurations,safeVolume,stereoPosition} from '../app/sound-design.ts';
import {FinishMotion} from '../app/finish-motion.ts';
import {airLayers} from '../app/air-motion.ts';
import {bossScars,bossWingAngle} from '../app/boss-finish.ts';
import {Game} from '../app/sim.ts';

test('Original effects are finite and unclipped at mobile sample rates; arpeggio boundaries are smooth',()=>{
 for(const rate of [22050,44100,48000])for(const name of Object.keys(effectDurations)){
  const data=effectSamples(name,rate);let peak=0,energy=0;for(const s of data){assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));energy+=s*s;}
  assert.equal(data.length,Math.ceil(effectDurations[name]*rate));assert.ok(peak<=.900001&&energy/data.length>.00001);assert.equal(Math.abs(data[0]),0);assert.ok(Math.abs(data.at(-1))<.001);
  if(name==='collect'||name==='finish')for(let i=1;i<4;i++){const j=Math.round(i*(name==='collect'?.065:.14)*rate);assert.ok(Math.abs(data[j]-data[j-1])<.025);}
 }
});
test('Sound gain and stereo positions cannot escape safe mixer ranges',()=>{
 for(const n of [-100,0,.5,1,100,NaN,Infinity]){const gain=safeVolume(n);assert.ok(Number.isFinite(gain)&&gain>=0&&gain<=1);}
 assert.equal(stereoPosition(0),0);assert.ok(stereoPosition(-20)<0&&stereoPosition(20)>0);assert.equal(stereoPosition(100),.65);
});
test('Fragment and wave pools remain bounded, respect pause, reset and reduced motion, and leave combat untouched',()=>{
 const g=new Game();g.start();const f=new FinishMotion(),before=g.snapshot();
 for(let i=0;i<100;i++){f.event({type:'bosskill',x:2,y:8,size:4});f.update(g,.001);assert.ok(f.fragments.length<=48&&f.waves.length<=4);}
 assert.deepEqual(g.snapshot(),before);const saved=structuredClone([f.fragments,f.waves]);g.pause();f.update(g,.5);assert.deepEqual([f.fragments,f.waves],saved);
 g.resume();f.update(g,2);assert.deepEqual(f.diagnostics(),{fragments:0,waves:0});f.event({type:'explode',x:0,y:0});f.event({type:'stage'});assert.deepEqual(f.diagnostics(),{fragments:0,waves:0});
 f.event({type:'nova'});f.event({type:'explode'});f.update(g,0,true);assert.deepEqual(f.diagnostics(),{fragments:0,waves:0});
});
test('Atmospheric layers stay bounded for long stage clocks and retain each environment identity',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(s=>airLayers(s,0,0)[0].key),['nebula','shafts','nebula','aurora','shafts','shafts']);
 for(let stage=0;stage<6;stage++)for(let t=0;t<7200;t+=117.3){const layers=airLayers(stage,t,t*4.4);assert.equal(layers.length,2);for(const p of layers){for(const [k,v]of Object.entries(p))if(k!=='key')assert.ok(Number.isFinite(v));assert.ok(Math.abs(p.x)<10&&Math.abs(p.y)<47);assert.ok(p.opacity>=0&&p.opacity<.14);}}
});
test('Boss damage reads persistently while articulated panels remain within small visual offsets',()=>{
 assert.equal(bossScars({hp:100,maxHp:100}),0);assert.ok(bossScars({hp:30,maxHp:100})>bossScars({hp:70,maxHp:100}));assert.equal(bossScars({hp:0,maxHp:100}),.65);
 for(let s=0;s<6;s++)for(let t=0;t<400;t+=.71)for(const d of [0,.5,1])assert.ok(Math.abs(bossWingAngle(s,-1,t,d))<.15);
});
