import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../app/sim.ts';
import {FxDirector,FX_MIX_LIMITS} from '../app/fx-director.ts';
const repoFile=name=>readFile('app/'+name+'.ts','utf8');
function game(stage=0){const g=new Game();g.start('campaign','normal',stage);return g;}
test('Cinematic cue priorities are explicit, nonrandom and bounded',()=>{
 const director=new FxDirector(),g=game();
 let mix=director.plan(g);assert.equal(mix.moment,'combat');
 director.event({type:'fieldcollapse',x:0,y:8});
 mix=director.plan(g);assert.equal(mix.moment,'facility');
 director.event({type:'nova',x:0,y:0});assert.equal(director.plan(g).moment,'nova');
 director.event({type:'fieldcollapse',x:0,y:3});assert.equal(director.plan(g).moment,'nova','lower-priority event cannot drown out NOVA');
 director.event({type:'bosskill',x:0,y:8});assert.equal(director.plan(g).moment,'boss-finish');
 assert.ok(mix.density<=FX_MIX_LIMITS.openDensity);
 assert.ok(FX_MIX_LIMITS.maxGameplayRoll<.05&&FX_MIX_LIMITS.maxGameplayZoom<=1.05);
 assert.ok(FX_MIX_LIMITS.maxConcurrentShowpieces<=3);
});
test('Bullet density automatically reduces scenery, but never disables visual warnings',()=>{
 const director=new FxDirector(),g=game();
 g.bullets=Array.from({length:FX_MIX_LIMITS.bulletCrowd},()=>({}));
 const p=director.plan(g);assert.equal(p.crowded,true);
 assert.equal(p.showFlybys,false);assert.equal(p.showAmbientStructures,false);
 assert.equal(p.density,FX_MIX_LIMITS.quietDensity);
 assert.equal(director.plan(g,true).cameraRollCap,0);
 assert.equal(director.plan(g,true).cameraZoomCap,1);
});
test('Warp and boss have unique 3D setpiece owners',async()=>{
 const [volume,depth,colossal,invasion,render]=await Promise.all([
  repoFile('volumetric-cinematics'),repoFile('depth-spectacle'),repoFile('colossal-cinematics'),
  repoFile('invasion-director'),repoFile('render')
 ]);
 assert.match(volume,/const warp=false; \/\/ SINGLE OWNER/);
 assert.match(volume,/m.visible=false; \/\/ InvasionDirector owns/);
 assert.match(depth,/mix===undefined\)\{ \/\/ owned by InvasionDirector/);
 assert.match(colossal,/this.flight.visible=.*&&!mix; \/\/ 3\.4 invasion fleet/);
 assert.match(invasion,/this.travel.visible=transition&&!reduced/);
 assert.match(invasion,/this.bossCore.visible=boss&&!reduced/);
 assert.match(invasion,/if\(nw>=LIMIT.ruptureRings\|\|reduced\|\|!!mix\)break/);
 assert.match(render,/const mix=this.fxDirector.plan\(game/);
 assert.match(render,/this.mechanical\?\.draw\(game,dt,mix/);
 assert.match(render,/fxMix:this.fxDirector.diagnostics\(\)/);
});
test('Structural finish has real bounded three-phase physical geometry, not photo explosions',async()=>{
 const s=await repoFile('mechanical-setpiece-fx');
 for(const key of ['fractured-armour-panels','telescoping-reactor-pistons','exposed-physical-reactor-faces',
 'T.BoxGeometry','T.CylinderGeometry','T.DodecahedronGeometry','fieldcritical','fieldcollapse',
 'bosstransform','bosskill']){
  assert.ok(s.includes(key),key);
 }
 assert.doesNotMatch(s,/new T\.Sprite|PlaneGeometry|AdditiveBlending|Math\.random|new T\.PointLight/);
 assert.match(s,/if\(this.beats.length>=3\)this.beats.shift\(\)/);
 assert.match(s,/this.panel.count=np;this.piston.count=nr;this.core.count=nc/);
});
test('Old effect engine still honors shared director plan and preserves Classic renderer',async()=>{
 const [v,d,c,i,r]=await Promise.all(['volumetric-cinematics','depth-spectacle','colossal-cinematics','invasion-director','render'].map(repoFile));
 for(const x of[v,d,c,i])assert.match(x,/mix\?:FxMix/);
 assert.match(v,/const ringCount=\['fieldcollapse'/);
 assert.match(d,/const limit=\(max:number\)=>reduced\?0/);
 assert.match(r,/private mechanical=usesRebuiltGraphics\(\)\?new MechanicalSetpieceFX\(\):null/);
 assert.match(r,/usesRebuiltGraphics\(\)\?Math.min\(36,rawCount\):rawCount/);
 assert.match(r,/flame.visible=.*&&!usesRebuiltGraphics\(\)/);
});
