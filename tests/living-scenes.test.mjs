import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,GAME_SPEED} from '../app/sim.ts';
import {worldClock} from '../app/motion.ts';
import {surfaceSample,surfaceFlow,surfaceCrests,waterfallPose,wakePose,cloudPose,ventPulse,atlasFrame,hasSurface} from '../app/surface-motion.ts';
import {CombatMotion} from '../app/combat-motion.ts';
const idle={x:0,y:0,focus:false};

test('Wave normals match the continuous surface gradient and remain below scenery',()=>{
  for(const stage of[1,3,4,5])for(let i=0;i<60;i++){
    const x=Math.sin(i*2.1)*16,y=i*47-150,t=i*.37,e=.0001,s=surfaceSample(stage,x,y,t);
    const dx=(surfaceSample(stage,x+e,y,t).height-surfaceSample(stage,x-e,y,t).height)/(2*e);
    const dy=(surfaceSample(stage,x,y+e,t).height-surfaceSample(stage,x,y-e,t).height)/(2*e);
    assert.ok(Math.abs(dx-s.dx)<1e-7);assert.ok(Math.abs(dy-s.dy)<1e-7);assert.ok(Math.abs(s.height)<.36);
    for(const value of Object.values(s))assert.ok(Number.isFinite(value));
  }
  assert.deepEqual([0,1,2,3,4,5].filter(hasSurface),[1,3,4,5]);
});
test('Water flow is periodic without jumps and moving foam stays bounded during long encounters',()=>{
  const periodic=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
  for(const stage of[1,3,4,5])for(let t=0;t<1800;t+=4.3){
    const a=surfaceFlow(stage,t,t*4.4),b=surfaceFlow(stage,t+.001,(t+.001)*4.4);
    for(const key of Object.keys(a)){assert.ok(a[key]>=0&&a[key]<1);assert.ok(periodic(a[key],b[key])<.001);}
    const crests=surfaceCrests(stage,t,t*4.4);assert.ok(crests.length<=18);
    for(const p of crests){for(const v of Object.values(p))assert.ok(Number.isFinite(v));assert.ok(p.alpha>=0&&p.alpha<=.24);assert.ok(Math.abs(p.x)<16&&Math.abs(p.y)<50);}
  }
});
test('Pause freezes waves, falls, wakes, clouds and vents; retry returns the same initial world',()=>{
  const g=new Game();g.start('campaign','normal',1);g.invulnerable=100;
  const snapshot=()=>{const t=worldClock(g),d=t*4.4;return {s:surfaceSample(g.stage,3,d,t),flow:surfaceFlow(g.stage,t,d),crests:surfaceCrests(g.stage,t,d),fall:waterfallPose(t,2),wake:wakePose(t,1),cloud:cloudPose(0,t,d),vent:ventPulse(1,t)};};
  const initial=snapshot();for(let i=0;i<150;i++)g.update(STEP,idle);const before=snapshot();assert.notDeepEqual(before,initial);
  g.pause();for(let i=0;i<120;i++)g.update(STEP,idle);assert.deepEqual(snapshot(),before);
  g.resume();g.update(STEP,idle);assert.notDeepEqual(snapshot(),before);g.start('campaign','normal',1);assert.deepEqual(snapshot(),initial);
});
test('Impact animation reaches each atlas cell once and never addresses outside the atlas',()=>{
  for(const life of[.28,.48]){const frames=Array.from({length:24},(_,i)=>atlasFrame(i*life/24,life));assert.deepEqual([...new Set(frames)],[0,1,2,3]);assert.ok(frames.every((v,i)=>i===0||v>=frames[i-1]));assert.equal(atlasFrame(life*3,life),3);assert.equal(atlasFrame(-1,life),0);}
});
test('Combat effects keep bounded historic positions without consuming simulation RNG',()=>{
  const g=new Game();g.start();g.invulnerable=100;g.overdrive=6;const effects=new CombatMotion();
  for(let i=0;i<600;i++){
    g.update(STEP,{x:i%80<40?1:-1,y:0,focus:false});const before=g.snapshot();
    effects.event({type:'hit',x:g.player.x,y:8});effects.update(g,STEP*GAME_SPEED);
    assert.deepEqual(g.snapshot(),before);assert.ok(effects.echoes.length<=6&&effects.impacts.length<=24);
    if(i===90){assert.ok(effects.echoes.length);assert.ok(effects.echoes.some(e=>e.x!==g.player.x));}
  }
  const before=structuredClone({impacts:effects.impacts,echoes:effects.echoes});g.pause();effects.update(g,1);assert.deepEqual({impacts:effects.impacts,echoes:effects.echoes},before);
  effects.event({type:'stage'});assert.deepEqual(effects.diagnostics(),{impacts:0,echoes:0});g.resume();g.overdrive=6;effects.update(g,.01,true);assert.equal(effects.echoes.length,0);
  for(let i=0;i<100;i++)effects.event({type:'hit',x:0,y:0});assert.equal(effects.impacts.length,24);
  effects.update(g,1);assert.equal(effects.impacts.length,0);
});
