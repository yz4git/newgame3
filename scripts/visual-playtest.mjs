import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const root='visual-review';
await fs.mkdir(root,{recursive:true});
let browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const results={};
async function scene(page,name,delay=650){
 await page.waitForTimeout(delay);
 const path=root+'/'+name+'.jpg';
 const picture=await page.screenshot({path,type:'jpeg',quality:82,animations:'disabled',scale:'css'});
 // Upload the JPEG via GitHub Actions artifact; avoid multi-megabyte console logs.
 console.log('NOVA_SHOT:'+name+':'+picture.byteLength+' bytes');
 return path;
}
async function setup(viewport,{renderer='canvas',visual='rebuilt',blockGPU=false}={}){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP',reducedMotion:'no-preference'});
 if(blockGPU)await context.addInitScript(()=>{
  // Reproduce the public cloud browser's unavailable GPU APIs without
  // changing the working WebGL context used by the main visual review.
  Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>null}});
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...options){
   if(['webgl','webgl2','webgpu','experimental-webgl'].includes(type))return null;
   return original.call(this,type,...options);
  };
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text());});
 const url='http://127.0.0.1:5173/?renderer='+renderer+'&visual='+visual;
 await page.goto(url,{waitUntil:'domcontentloaded'});
 try{
  await page.waitForFunction(()=>!!window.__nova&&document.getElementById('boot').hidden,{timeout:55000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({
   bootText:document.getElementById('boot-text')?.textContent,
   bootHTML:document.getElementById('boot')?.innerHTML?.slice(0,700),
   renderCanvas:document.getElementById('game')?.outerHTML,
   location:location.href
  })).catch(e=>({evaluateError:String(e)}));
  console.error('NOVA_BOOT_DIAGNOSTIC',JSON.stringify({renderer,visual,diagnostic,errors}));
  throw error;
 }
 return {page,context};
}
const mobile=await setup({width:390,height:844});
const page=mobile.page;
await scene(page,'01-title');
const titleLayout=await page.evaluate(()=>{
 const bounds=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)}};
 return {frame:bounds('frame'),top:bounds('title-screen'),start:bounds('start-button'),bossrush:bounds('bossrush-button'),sound:bounds('sound-button'),help:bounds('help-button'),viewport:{w:innerWidth,h:innerHeight},doc:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}};
});
results.titleLayout=titleLayout;
await page.locator('#start-button').click();
await page.waitForFunction(()=>window.__nova?.game.state==='playing');
await page.evaluate(()=>{const g=window.__nova.game;g.invulnerable=900;g.shotTimer=1000;});
await scene(page,'02-first-battle',1200);
const box=await page.locator('#game').boundingBox();
const at={x:Math.round(box.x+box.width*.50),y:Math.round(box.y+box.height*.64)};
const before=await page.evaluate(()=>({x:window.__nova.game.player.x,y:window.__nova.game.player.y,bombs:window.__nova.game.bombs,weapon:window.__nova.game.weapon}));
const cdp=await mobile.context.newCDPSession(page);
const t1=(x,y,id)=>({x:Math.round(x),y:Math.round(y),id});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t1(at.x,at.y,1)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t1(at.x+85,at.y-35,1)]});
await page.waitForTimeout(580);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.locator('#weapon-button').click();
await page.locator('#nova-button').click();
await page.waitForTimeout(160);
const after=await page.evaluate(()=>({x:window.__nova.game.player.x,y:window.__nova.game.player.y,bombs:window.__nova.game.bombs,weapon:window.__nova.game.weapon}));
results.controls={before,after,moved:Math.hypot(after.x-before.x,after.y-before.y)>0.1,weaponChanged:before.weapon!==after.weapon,usedBomb:after.bombs<before.bombs};
const focusRect=await page.locator('#focus-button').boundingBox();
const focusPoint=t1(focusRect.x+focusRect.width/2,focusRect.y+focusRect.height/2,2);
const originalX=after.x;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t1(at.x,at.y,1)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t1(at.x,at.y,1),focusPoint]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t1(at.x-65,at.y+22,1),focusPoint]});
await page.waitForTimeout(350);
results.multitouch=await page.evaluate(()=>({focus:window.__nova.game.player.focus,x:window.__nova.game.player.x,held:document.getElementById('focus-button').classList.contains('held')}));
results.multitouch.moved=Math.abs(results.multitouch.x-originalX)>.12;
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await scene(page,'03-controls-and-action',200);
await page.evaluate(()=>{
 const g=window.__nova.game;g.enemies=[];g.bullets=[];g.nodes=[];g.battlefield.seen=[false,false];
 g.encounterSeen={stage:true,mini:true};g.time=64*.095;g.shotTimer=1000;
});
await page.waitForFunction(()=>!document.getElementById('field-objective').hidden&&document.getElementById('message').classList.contains('tactical'));
await scene(page,'04-strategic-facility',500);
results.facilityHUD=await page.evaluate(()=>{
 const box=document.getElementById('field-objective');
 const field=window.__nova.game.nodes.find(n=>n.attach==='field'&&!n.dead);
 const notice=document.getElementById('message').getBoundingClientRect(),objective=box.getBoundingClientRect();
 return {visible:!box.hidden,name:document.getElementById('field-objective-name').textContent,noticeTop:notice.top,objectiveBottom:objective.bottom,
 health:document.getElementById('field-objective-health-text').textContent,fieldHp:field?.hp??null,cardWidth:Math.round(box.getBoundingClientRect().width)};
});
await page.evaluate(()=>{
 const g=window.__nova.game,n=g.nodes.find(n=>n.attach==='field'&&!n.dead);
 if(n){n.age=4.8;n.y=7.4;n.hp=n.maxHp*.57;n.shoot=200;}
 g.shotTimer=200;
});
await scene(page,'04b-armor-damaged',480);
await page.evaluate(()=>{
 const g=window.__nova.game,n=g.nodes.find(n=>n.attach==='field'&&!n.dead);
 if(n)n.hp=n.maxHp*.24;
});
await scene(page,'04c-core-exposed',300);
await page.evaluate(()=>{
 const g=window.__nova.game,n=g.nodes.find(n=>n.attach==='field'&&!n.dead);
 if(n){n.y=6.4;g.damageNode(n,n.hp+100);}
});
await scene(page,'04d-canvas-detonation-060ms',60);
await scene(page,'04e-canvas-detonation-200ms',140);
await scene(page,'04f-canvas-detonation-420ms',220);
results.canvasDemolition=await page.evaluate(()=>({
  blasts:window.__nova.view.facilityDemolition?.diagnostics(),
  atlasExplosions:window.__nova.view.explosions?.length
}));
await scene(page,'04g-canvas-chain-bursts',460);
await page.evaluate(()=>{
 const g=window.__nova.game;g.nodes=[];g.enemies=[];g.bullets=[];g.encounter=null;g.battlefield.seen=[true,true];
 g.battlefield.outcomes=['destroyed',null];g.sectorMission.started=false;g.time=64*.76;
});
await scene(page,'05-sector-mission',650);
await page.evaluate(()=>{
 const g=window.__nova.game;g.nodes=[];g.enemies=[];g.bullets=[];g.sectorMission.active=false;
 g.sectorMission.started=true;g.sectorMission.result='success';g.spawnBoss();g.boss.age=3.4;g.boss.hp=g.boss.maxHp*.56;g.boss.phase=2;g.boss.y=9;g.shotTimer=1000;
});
await scene(page,'06-shattered-boss',700);
results.gameState=await page.evaluate(()=>window.__nova.snapshot());
const small=await setup({width:375,height:667});
await scene(small.page,'07-short-iphone-title',400);
results.smallLayout=await small.page.evaluate(()=>{
 const ids=['title-screen','title-top','title-lockup','title-menu','start-button','bossrush-button','help-button'];
 return Object.fromEntries(ids.map(id=>{const r=(document.getElementById(id)||document.querySelector('.'+id)).getBoundingClientRect();return [id,{y:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)}]}));
});
// Discard two active 2D canvases before starting the heavy true-3D scene.
// SwiftShader runs out of graphics memory if all three mobile views stay live.
await mobile.context.close();await small.context.close();
await browser.close();
browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rich=await setup({width:390,height:844},{renderer:'webgl'});
// This is an actual hardware-API 3D review. Never mistake Canvas fallback for
// successfully checking the rebuilt scene.
if(await rich.page.evaluate(()=>window.__nova.view.constructor.name)!=='View')throw new Error('World Rebuild GPU review fell back to Canvas; gameplay visuals were NOT verified');
await rich.page.locator('#start-button').click();
await rich.page.waitForFunction(()=>window.__nova?.game.state==='playing');
await rich.page.evaluate(()=>{const g=window.__nova.game;g.invulnerable=900;g.shotTimer=1000;g.time=64*.095;g.encounterSeen={stage:true,mini:true};});
await scene(rich.page,'08-gpu-or-fallback-battle',1000);
results.gpu=await rich.page.evaluate(()=>({view:window.__nova.view.constructor.name,diagnostics:window.__nova.view.getDiagnostics()}));
await rich.page.evaluate(()=>{
 const g=window.__nova.game;
 g.time=64*.095;g.nodes=[];g.enemies=[];g.bullets=[];
 g.battlefield.seen=[false,false];g.encounterSeen={stage:true,mini:true};g.invulnerable=800;g.shotTimer=800;
});
await scene(rich.page,'09-real-world-facility',700);
results.facilityGeometry=await rich.page.evaluate(()=>{
 const pool=window.__nova.view.encounterView?.worldFacilities??[];
 const visible=pool.filter(g=>g.visible);
 return {models:pool.length,visible:visible.length,meshes:visible[0]?.children.filter(o=>o.type==='Group').length??0,
   worldPosition:visible[0]?.position?.toArray(),worldScale:visible[0]?.scale?.x};
});
await rich.page.evaluate(()=>{
 const g=window.__nova.game,n=g.nodes.find(n=>n.attach==='field'&&!n.dead);
 if(n){n.y=6.4;g.damageNode(n,n.hp+100);}
});
await scene(rich.page,'10-gpu-core-flash-050ms',50);
results.explosionUnobstructed=await rich.page.evaluate(()=>({stageCueHidden:document.getElementById('stage-cue').hidden,centerBannerCompact:document.getElementById('message').classList.contains('facility')}));
results.gpuDetonationEarly=await rich.page.evaluate(()=>{
 const fx=window.__nova.view.facilityDemolition;
 return {visibleRings:fx.rings.filter(r=>r.visible).length,opacity:fx.rings.filter(r=>r.visible).map(r=>r.material.opacity),coreVisible:fx.cores.some(c=>c.visible&&c.material.opacity>.075)};
});
await scene(rich.page,'10b-gpu-core-blast-180ms',130);
const blastPng=(await rich.page.screenshot({type:'png',animations:'disabled'})).toString('base64');
results.glare=await rich.page.evaluate(async encoded=>{
 const bitmap=new Image();bitmap.src='data:image/png;base64,'+encoded;await bitmap.decode();
 const cv=document.createElement('canvas');cv.width=bitmap.naturalWidth;cv.height=bitmap.naturalHeight;
 const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
 const g=window.__nova.game,view=window.__nova.view;
 const active=g.battlefield.collapses[0],position=view.worldToScreen(active.x,active.y);
 const targetRect=document.getElementById('game').getBoundingClientRect();
 const cx=position.x+targetRect.left,cy=position.y+targetRect.top;
 const x=Math.max(0,Math.floor(cx-90)),y=Math.max(0,Math.floor(cy-90));
 const w=Math.min(180,cv.width-x),h=Math.min(180,cv.height-y);
 const rgba=ctx.getImageData(x,y,w,h).data;let nearWhite=0,bright=0;
 for(let i=0;i<rgba.length;i+=4){
  if(rgba[i]>242&&rgba[i+1]>242&&rgba[i+2]>232)nearWhite++;
  if(rgba[i]>220&&rgba[i+1]>217&&rgba[i+2]>205)bright++;
 }
 const fx=view.facilityDemolition;
 return {nearWhiteFraction:nearWhite/(w*h),brightFraction:bright/(w*h),width:w,height:h,
  visibleCoreScale:fx.cores.filter(c=>c.visible).map(c=>c.scale.x),
  visibleCoreOpacity:fx.cores.filter(c=>c.visible).map(c=>c.material.opacity)};
},blastPng);
await scene(rich.page,'10c-gpu-shockwave-400ms',220);
results.gpuDetonationLate=await rich.page.evaluate(()=>{
 const fx=window.__nova.view.facilityDemolition;
 return {visibleRings:fx.rings.filter(r=>r.visible).length,opacity:fx.rings.filter(r=>r.visible).map(r=>r.material.opacity)};
});
results.gpuDemolition=await rich.page.evaluate(()=>({
  blasts:window.__nova.view.facilityDemolition?.diagnostics(),
  oldExplosionSprites:window.__nova.view.flares?.length,
  // Metal collapse chunks remain, but no older opaque rings may hide combat.
  obsoleteOpaqueTori:window.__nova.view.colossal?.collapses
    ?.flatMap(c=>c.rings).filter(r=>r.visible).length??0
}));
await scene(rich.page,'11-gpu-chain-bursts',580);



results.worldRebuild={};
results.cinematicLayers={};
results.worldStageEpisodes={};
results.worldStageImpact={};
results.filmWorlds={};
results.flightWorlds={};
for(let stage=0;stage<6;stage++){
 await rich.page.evaluate(stage=>{
  const {game:g,view}=window.__nova;
  g.start('campaign','normal',stage,['striker','falcon','bulwark'][stage%3]);
  g.time=[64,74,82,78,82,86][stage]*.49;
  g.invulnerable=900;g.shotTimer=900;
  g.battlefield.seen=[true,true];g.encounterSeen={stage:true,mini:true};
  g.sectorMission.started=true;g.nodes=[];g.enemies=[];g.bullets=[];
  g.spawn('fighter',-3.7,7.5);g.spawn('corvette',3.8,10.3);
  view.draw(g,.02,16.7);
 },stage);
 await scene(rich.page,'world-rebuild-stage-'+String(stage+1).padStart(2,'0'),420);
 // Snapshot a bespoke stage-only event while it crosses the battlefield.
 await rich.page.evaluate(stage=>{
  const {game:g,view}=window.__nova;
  g.time=[64,74,82,78,82,86][stage]*.43+8.4;
  g.visualTime=g.time;g.enemies=[];g.bullets=[];
  view.draw(g,.016,16.7);
 },stage);
 await rich.page.evaluate(stage=>{
  const {game:g,view}=window.__nova;
  g.time=[64,74,82,78,82,86][stage]*.43+5.99;
  g.visualTime=g.time;
  view.draw(g,.016,16.7);
 },stage);
 results.worldStageImpact[stage]=await rich.page.evaluate(()=>{
  const d=window.__nova.view.getDiagnostics().stageSequences;
  const episode=d.activePhases?.find(x=>x.phase==='action'&&x.impact>.8);
  return {stage:d.stage,id:episode?.id,phase:episode?.phase,impact:episode?.impact??0,fragments:episode?.fragments??0};
 });
 results.filmWorlds[stage]=await rich.page.evaluate(()=>{
  const {view,game:g}=window.__nova,d=view.getDiagnostics();
  view.event({type:'explode',x:-3,y:3,size:2});
  view.draw(g,.45,16.7);
  return {film:d.film,geometry:d.stageSequences.cinematic,detonations:view.getDiagnostics().detonations};
 });
 await scene(rich.page,'world-unique-impact-'+String(stage+1).padStart(2,'0'),160);
 await rich.page.evaluate(stage=>{
  const {game:g,view}=window.__nova;
  g.time=[64,74,82,78,82,86][stage]*.43+8.4;g.visualTime=g.time;
  view.draw(g,.016,16.7);
 },stage);
 await scene(rich.page,'world-unique-sequence-'+String(stage+1).padStart(2,'0'),240);
 results.worldStageEpisodes[stage]=await rich.page.evaluate(()=>{
  const layer=window.__nova.view.stageSequences,info=layer.diagnostics();
  let visibleMeshes=0,allMeshes=0;
  layer.root.traverse(o=>{if(o.isMesh){allMeshes++;if(o.parent.visible&&o.parent.parent?.visible)visibleMeshes++;}});
  return {info,visibleMeshes,allMeshes,
   rootMounted:!!window.__nova.view.scene.getObjectByName('stage-authored-nonrepeating-cinematics')};
 });
 // Review every newly authored full-scale location, not only the middle act.
 for(let act=0;act<3;act++){
  await rich.page.evaluate(({stage,act})=>{
   const {game:g,view}=window.__nova;
   g.time=[64,74,82,78,82,86][stage]*[.13,.43,.72][act]+6.7;
   g.visualTime=g.time;g.enemies=[];g.bullets=[];
   view.draw(g,.016,16.7);
  },{stage,act});
  await scene(rich.page,`v6-colossal-${stage+1}-${act+1}`,80);
 }

 const flightSamples=[];
 for(const progress of[.16,.34,.72]){
  await rich.page.evaluate(({stage,progress})=>{
   const {game:g,view}=window.__nova;
   g.time=[64,74,82,78,82,86][stage]*progress;g.visualTime=g.time;
   g.enemies=[];g.bullets=[];view.draw(g,.016,16.7);
  },{stage,progress});
  await scene(rich.page,`v8-flight-${stage+1}-${Math.round(progress*100)}`,80);
  flightSamples.push(await rich.page.evaluate(()=>{
   const {view}=window.__nova;
   const corners=[[-10.2,-14.4],[10.2,-14.4],[-10.2,14.8],[10.2,14.8]].map(([x,y])=>view.worldToScreen(x,y));
   return {flight:view.getDiagnostics().flight,camera:view.camera.position.toArray(),corners,
    frame:{width:view.getDiagnostics().width,height:view.getDiagnostics().height},
    mounted:!!view.scene.getObjectByName('continuous-3d-flight-world')?.visible};
  }));
 }
 results.flightWorlds[stage]=flightSamples;

 if(stage===4){
  await rich.page.evaluate(()=>{
   const {game:g,view}=window.__nova;
   g.time=82*.385;g.visualTime=g.time;view.draw(g,.016,16.7);
  });
  await scene(rich.page,'v8-canopy-exposed-waterfall',80);
 }

 results.cinematicLayers[stage]=await rich.page.evaluate(()=>{
  const {view}=window.__nova;
  const detail=view.getDiagnostics().volumetric;
  const kinetic=view.background.scenes[0].getObjectByName('kinetic-world-assembly');
  const chapters=view.background.scenes.slice(1).map(x=>x.userData.chapterId);
  const moving=kinetic?.children.filter(x=>x.name.startsWith('hero-actuator-'))??[];
  return {detail,crowded:window.__nova.game.bullets.length>=38||window.__nova.game.enemies.filter(e=>!e.dead).length>=17,
   heroMotion:kinetic?.userData.motionId,heroActuators:moving.length,
   chapterIds:chapters,chapterActuators:view.background.scenes.slice(1).map(x=>x.getObjectByName('stage-primary-motion')?.children.length??0),
   realWorldRoot:!!view.scene.getObjectByName('world-space-cinematics-v31')};
 });
 // The cinematic isolation screenshot clears test enemies on purpose.
 // Restore two real actors before auditing normal gameplay's ship geometry.
 await rich.page.evaluate(()=>{
  const {game:g,view}=window.__nova;
  g.spawn('fighter',-3.7,7.5);
  g.spawn('corvette',3.8,10.3);
  view.draw(g,.016,16.7);
 });
 results.worldRebuild[stage]=await rich.page.evaluate(()=>{
  const {view,game:g}=window.__nova;
  const scene=view.background.scenes.some(m=>m.name==='physical-world-centrepiece-'+g.stage);
  const enemies=[...view.models.values()];
  const skinCount=enemies.reduce((a,m)=>a+(m.getObjectByName('skin')?1:0),0);
  return {worldScene:scene,enemy3D:enemies.length,enemyBillboards:skinCount,
    style:view.getDiagnostics().visualStyle,ship:view.renderedShip,background:view.getDiagnostics().background,
    scenic:view.getDiagnostics().scenic,worldAlive:view.getDiagnostics().worldAliveScene,
    sharedSideProps:(()=>{let n=0;view.scene.traverse(o=>{if(o.name.startsWith('real-gameplay-hangar-')||['real-enemy-launch-bays','left-reactive-wall','right-reactive-wall','event-reactive-world-machinery'].includes(o.name))n++;});return n;})(),
    rail:view.getDiagnostics().railDistricts};
 });
}
// 4.3 verify that previously endlessly repeated rail districts really are
// absent from the live graphics scene, not merely low-opacity silhouettes.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.start('campaign','normal',2,'striker');
 g.time=46;g.visualTime=46;g.invulnerable=900;
 g.battlefield.seen=[true,true];g.encounterSeen={stage:true,mini:true};
 g.sectorMission.started=true;g.nodes=[];g.enemies=[];g.bullets=[];
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v43-fortress-edges-cleared',220);
results.sideRemoval=await rich.page.evaluate(()=>{
 const {view}=window.__nova;
 let railChildren=0,visibleWorldTowers=0;
 view.scene.traverse(o=>{
  if(o.name.startsWith('rail-chapter-')||o.name.startsWith('independent-sideways-stage-landmark-'))railChildren++;
  if(o.name==='living-stage-megastructures')visibleWorldTowers+=o.children.filter(c=>c.visible).length;
 });
 return {noRailController:view.getDiagnostics().railDistricts===null,railChildren,visibleWorldTowers,
  farTileGroups:view.background.far.filter(o=>!!o.parent).length};
});
// Timed reinforcements remain actual enemies after retiring their decorative
// box-shaped docks. Destroying a linked field node still suppresses its sortie.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.start('campaign','normal',2,'striker');
 g.time=82*.25;
 g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];
 g.sectorMission.started=true;g.waveIndex=999;g.schedule=[];
 g.shotTimer=900;g.invulnerable=900;g.enemies=[];g.bullets=[];
 g.update(1/60,{x:0,y:0,focus:false});
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v711-reinforcements-without-box-dock',360);
results.worldAliveLaunch=await rich.page.evaluate(()=>({
 game:window.__nova.game.snapshot().worldAlive,
 scene:window.__nova.view.getDiagnostics().worldAliveScene,
 actualEnemyCount:window.__nova.game.enemies.length,
 sharedSideProps:(()=>{let n=0;window.__nova.view.scene.traverse(o=>{if(o.name.startsWith('real-gameplay-hangar-')||['real-enemy-launch-bays','left-reactive-wall','right-reactive-wall','event-reactive-world-machinery'].includes(o.name))n++;});return n;})(),
 actualKinds:window.__nova.game.enemies.map(e=>e.kind)
}));
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.addCombatNode('field',0,1,3.25,9.3,38,8.3);
 const n=g.nodes.find(n=>n.attach==='field'&&n.index===1);
 if(n)g.damageNode(n,n.hp+2);
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v40-3d-defence-grid-disabled',300);
results.worldAliveBreach=await rich.page.evaluate(()=>({
 game:window.__nova.game.snapshot().worldAlive,
 scene:window.__nova.view.getDiagnostics().worldAliveScene
}));
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.spawnBoss();g.boss.y=9;g.boss.age=5;g.boss.phase=2;
 g.damagePart(0,g.boss.maxPart+1);
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v40-boss-vault-weakpoint-break',220);
results.worldAliveBoss=await rich.page.evaluate(()=>({
 game:window.__nova.game.snapshot().worldAlive,
 scene:window.__nova.view.getDiagnostics().worldAliveScene,
 oldBossRings:window.__nova.view.getDiagnostics().invasion.legacyBossBands
}));
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.damagePart(1,g.boss.maxPart+1);
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v40-reactor-exposed-after-two-real-wing-breaks',170);
results.worldAliveCore=await rich.page.evaluate(()=>({
 game:window.__nova.game.snapshot().worldAlive,
 scene:window.__nova.view.getDiagnostics().worldAliveScene
}));
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.boss.hp=1;g.nova();
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v40-fortress-collapse-and-escape',220);
results.worldAliveEscape=await rich.page.evaluate(()=>({
 game:window.__nova.game.snapshot().worldAlive,
 scene:window.__nova.view.getDiagnostics().worldAliveScene,
 state:window.__nova.game.state
}));
// Quiet airspace retains depth weather; a real field event must not recreate
// the retired generic rectangular side walls.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.start('campaign','normal',1,'striker');
 g.time=14;g.enemies=[];g.bullets=[];g.nodes=[];g.invulnerable=900;g.shotTimer=900;
 g.waveIndex=999;g.schedule=[];g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.sectorMission.started=true;
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v39-3d-background-harbor-freight',450);
results.scenicPeace=await rich.page.evaluate(()=>({
 ...window.__nova.view.getDiagnostics().scenic,quality:window.__nova.view.getDiagnostics().quality
}));
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.enemies=[];g.bullets=[];
 view.event({type:'fieldcollapse',x:0,y:7.5,size:5.5});
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v39-3d-reactive-dock-machinery',160);
results.scenicResponse=await rich.page.evaluate(()=>window.__nova.view.getDiagnostics().scenic);
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;g.start('campaign','normal',5,'striker');
 g.spawnBoss();view.draw(g,.02,16.7);
});
await scene(rich.page,'world-rebuild-boss-physical',600);
results.cinematicBoss=await rich.page.evaluate(()=>{const d=window.__nova.view.getDiagnostics();return {volumetric:d.volumetric,invasion:d.invasion,mix:d.fxMix,mechanical:d.mechanical};});
results.worldBoss=await rich.page.evaluate(()=>{
 const view=window.__nova.view;
 return {hasBoss:!!view.boss,skin:!!view.boss?.getObjectByName('boss-skin0'),meshes:(()=>{let n=0;view.boss?.traverse(o=>{if(o.isMesh)n++});return n})()};
});
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.state='transition';g.transitionTime=2.4;view.draw(g,.016,16.7);
});
await scene(rich.page,'v31-world-space-warp-tunnel',120);
results.cinematicWarp=await rich.page.evaluate(()=>{const d=window.__nova.view.getDiagnostics();return {volumetric:d.volumetric,invasion:d.invasion,mix:d.fxMix};});
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.state='playing';g.boss=null;
 view.event({type:'bosskill',x:1.5,y:5,size:5.5,color:0xffab65});
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v31-depth-explosion-debris',150);
results.cinematicBlast=await rich.page.evaluate(()=>{const d=window.__nova.view.getDiagnostics();return {volumetric:d.volumetric,invasion:d.invasion,mix:d.fxMix,mechanical:d.mechanical};});
// Verify the actual GPU backdrop opacity at both ends of the same finite
// landmark. A boolean-only test would miss sudden materialization.
results.landmarkReveal=await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.start('campaign','normal',3,'striker');
 g.invulnerable=900;g.shotTimer=900;g.waveIndex=999;g.schedule=[];
 g.sectorMission.started=true;g.encounterSeen={stage:true,mini:true};
 g.battlefield.seen=[true,true];g.enemies=[];g.bullets=[];
 const samples=[];
 for(const offset of [56,50,42,30,0,-30,-42,-50,-56]){
  g.time=(166-offset)/4.4;g.visualTime=g.time;
  view.draw(g,.016,16.7);
  const model=view.background.objects[2];
  let opacity=null;
  model.traverse(o=>{if(opacity===null&&o.isMesh){
   const material=Array.isArray(o.material)?o.material[0]:o.material;
   opacity=material?.opacity??null;
  }});
  // The flight world now owns campaign scenery. Audit the retained legacy
  // fade independently from the deliberate cinematic handoff to the new map.
  view.background.draw(g);
  let baseline=null;model.traverse(o=>{if(baseline===null&&o.isMesh)baseline=(Array.isArray(o.material)?o.material[0]:o.material).opacity;});
  samples.push({offset,visible:model.visible,opacity:baseline,handoffOpacity:opacity});
 }
 return samples;
});
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.time=(166-42)/4.4;g.visualTime=g.time;view.draw(g,.016,16.7);
});
await scene(rich.page,'v44-glacier-landmark-gradual-entry',170);
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.time=166/4.4;g.visualTime=g.time;view.draw(g,.016,16.7);
});
await scene(rich.page,'v44-glacier-landmark-fully-arrived',170);

results.sharedSceneryRemoval=[];
for(let stage=0;stage<6;stage++){
 await rich.page.evaluate(stage=>{
  const {game:g}=window.__nova;
  g.start('campaign','normal',stage,'striker');g.invulnerable=900;g.shotTimer=900;
  g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];
  g.sectorMission.started=true;g.waveIndex=999;g.schedule=[];
 },stage);
 for(const progress of[.25,.70]){
  const sample=await rich.page.evaluate(({stage,progress})=>{
   const {game:g,view}=window.__nova;
   g.time=[64,74,82,78,82,86][stage]*progress;g.visualTime=g.time;g.enemies=[];g.bullets=[];
   g.update(1/60,{x:0,y:0,focus:false});view.draw(g,.016,16.7);
   view.event({type:'fieldcollapse',x:0,y:7.5,size:4});
   view.draw(g,.6,16.7);
   let mounted=0;view.scene.traverse(o=>{
    if(o.name.startsWith('real-gameplay-hangar-')||['real-enemy-launch-bays','left-reactive-wall','right-reactive-wall','event-reactive-world-machinery'].includes(o.name))mounted++;
   });
   return {stage,progress,mounted,enemies:g.enemies.length,launched:g.worldAlive.launched,
    hangars:view.getDiagnostics().worldAliveScene.hangars,walls:view.getDiagnostics().scenic.reactiveWallUnits};
  },{stage,progress});
  results.sharedSceneryRemoval.push(sample);
  // Let the software GPU finish each pair of draws before switching worlds.
  await rich.page.waitForTimeout(160);
 }
}
console.log('NOVA_SIDE_REMOVAL:'+JSON.stringify(results.sharedSceneryRemoval));
await scene(rich.page,'v711-launch-and-events-without-shared-boxes',200);

// Test the real two-finger input path while the WebGL camera is banking.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;g.start('campaign','normal',2);
 g.time=82*.34;g.visualTime=g.time;g.invulnerable=900;g.shotTimer=900;
 g.waveIndex=999;g.schedule=[];g.nodes=[];g.enemies=[];g.bullets=[];
 g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.sectorMission.started=true;
 view.draw(g,.016,16.7);
});
await rich.page.waitForTimeout(120);
const richBox=await rich.page.locator('#game').boundingBox();
const richFocus=await rich.page.locator('#focus-button').boundingBox();
const bankPoint=t1(richBox.x+richBox.width*.48,richBox.y+richBox.height*.62,1);
const bankFocus=t1(richFocus.x+richFocus.width/2,richFocus.y+richFocus.height/2,2);
const bankBefore=await rich.page.evaluate(()=>window.__nova.game.player.x);
const bankCDP=await rich.context.newCDPSession(rich.page);
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[bankPoint]});
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[bankPoint,bankFocus]});
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t1(bankPoint.x+52,bankPoint.y-24,1),bankFocus]});
await rich.page.waitForTimeout(350);
results.flightControls=await rich.page.evaluate(()=>({x:window.__nova.game.player.x,focus:window.__nova.game.player.focus,projection:window.__nova.view.camera.type}));
results.flightControls.moved=Math.abs(results.flightControls.x-bankBefore)>.15;
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await scene(rich.page,'v7-webgl-banking-dual-touch',120);
const pausedCamera=await rich.page.evaluate(()=>{const {game:g,view}=window.__nova;g.pause();view.draw(g,0,16.7);return view.camera.matrixWorld.toArray();});
await rich.page.waitForTimeout(250);
results.flightPause=await rich.page.evaluate(()=>window.__nova.view.camera.matrixWorld.toArray());
results.flightPauseStable=JSON.stringify(pausedCamera)===JSON.stringify(results.flightPause);
await rich.page.evaluate(()=>window.__nova.game.resume());

// Replay a small touch movement across a large change in camera pose.
// Both event endpoints must be interpreted by the current camera.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;g.start('campaign','normal',2);
 g.time=82*.16;g.visualTime=g.time;g.invulnerable=900;g.shotTimer=900;
 g.schedule=[];g.waveIndex=999;g.nodes=[];g.enemies=[];g.bullets=[];
 g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.sectorMission.started=true;
 view.draw(g,.016,16.7);
});
await rich.page.waitForTimeout(120);
const driftBefore=await rich.page.evaluate(()=>({x:window.__nova.game.player.x,y:window.__nova.game.player.y}));
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[bankPoint]});
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;g.time=82*.34;g.visualTime=g.time;view.draw(g,.016,16.7);
});
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[t1(bankPoint.x+2,bankPoint.y-2,1)]});
await rich.page.waitForTimeout(300);
results.cameraDrag=await rich.page.evaluate(before=>{
 const p=window.__nova.game.player;return {dx:p.x-before.x,dy:p.y-before.y};
},driftBefore);
await bankCDP.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

// Bright ice is the hard case for the actual diamond instance colors and
// the hit point. Trigger the real launch event and review its live DOM card.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;g.start('campaign','normal',3);
 g.time=78*.34;g.visualTime=g.time;g.invulnerable=0;g.shotTimer=900;
 g.schedule=[];g.waveIndex=999;g.nodes=[];g.enemies=[];g.bullets=[];
 g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.sectorMission.started=true;
 for(let i=-3;i<=3;i++)g.projectile(i*1.8,4+(i%2)*2,0,-3,true,1,false,0xff487e,{shape:'diamond'});
 g.emit('worldlaunch',{text:'GLACIER HANGAR / LAUNCH'});view.draw(g,.016,16.7);
});
await rich.page.waitForFunction(()=>document.getElementById('message').classList.contains('show')&&document.getElementById('message-title').textContent==='敵機発進');
results.phoneReview=await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova,card=document.getElementById('message'),title=document.getElementById('message-title');
 const rect=card.getBoundingClientRect(),hud=document.getElementById('hud').getBoundingClientRect(),frame=document.getElementById('frame').getBoundingClientRect();
 const marker=view.scene.getObjectByName('player-hit-point');
 const visual=marker.position.clone().project(view.camera),physical=marker.position.clone().set(g.player.x,g.player.y,1).project(view.camera);
 return {notice:{top:rect.top-frame.top,bottom:rect.bottom-frame.top,height:rect.height,hudBottom:hud.bottom-frame.top,frameHeight:frame.height,
  tactical:card.classList.contains('tactical'),title:title.textContent,titleHeight:title.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(title).lineHeight),cueHidden:document.getElementById('stage-cue').hidden},
  marker:{position:marker.position.toArray(),player:[g.player.x,g.player.y,1],scale:marker.scale.x,projectionError:visual.distanceTo(physical),depthTest:marker.children[1].material.depthTest},
  diamond:{count:view.diamonds.count,color:Array.from(view.diamonds.instanceColor.array.slice(0,3))}};
});
await scene(rich.page,'v801-polar-projectiles-and-notice',80);

const classic=await setup({width:390,height:844},{renderer:'canvas',visual:'classic'});
results.classic=await classic.page.evaluate(()=>({
 visual:window.__nova.view.getDiagnostics().visualStyle,
 buttons:[...document.querySelectorAll('[data-visual]')].map(b=>({style:b.dataset.visual,selected:b.classList.contains('selected')}))
}));
await scene(classic.page,'world-rebuild-classic-preserved',450);
await classic.context.close();
await rich.context.close();

// Failed GPU initialization must enter a usable compatibility game without
// leaking the modern renderer's rejected promise through dispose().
const compatibility=await setup({width:390,height:844},{renderer:'auto',blockGPU:true});
await compatibility.page.locator('#start-button').click();
await compatibility.page.waitForFunction(()=>window.__nova.game.state==='playing');
await compatibility.page.locator('#weapon-button').click();
await compatibility.page.locator('#nova-button').click();
await compatibility.page.locator('#pause-button').click();
await compatibility.page.locator('#pause-help-button').click();
await compatibility.page.locator('.manual').evaluate(e=>e.scrollTop=e.scrollHeight);
results.compatibility=await compatibility.page.evaluate(()=>({
 engine:window.__nova.view.constructor.name,state:window.__nova.game.state,weapon:window.__nova.game.weapon,bombs:window.__nova.game.bombs,
 label:document.getElementById('graphics-version').textContent,help:!document.getElementById('help-screen').hidden,
 scroll:document.querySelector('.manual').scrollTop
}));
await scene(compatibility.page,'v801-no-gpu-manual-and-controls',200);
await compatibility.page.locator('#help-back').click();
await compatibility.page.locator('#resume-button').click();
results.compatibility.resumed=await compatibility.page.evaluate(()=>window.__nova.game.state==='playing');
await compatibility.context.close();

results.errors=errors;
console.log('NOVA_PROGRESS:'+JSON.stringify({controls:results.controls,titleLayout:results.titleLayout,smallLayout:results.smallLayout,gpu:results.gpu.view,errors}));
console.log('NOVA_REVIEW:'+JSON.stringify(results));
await browser.close();
if(results.gpu.view==='View'){
 const a=results.landmarkReveal;
 if(!a||a.length!==9||a[0].visible||a[8].visible||
   !(a[1].opacity>0&&a[1].opacity<a[2].opacity&&a[2].opacity<a[3].opacity&&a[3].opacity<a[4].opacity)||
   !(a[4].opacity>a[5].opacity&&a[5].opacity>a[6].opacity&&a[6].opacity>a[7].opacity))
  throw new Error('Live 3D landmark still pops without intermediate opacity: '+JSON.stringify(a));
 if(results.sharedSceneryRemoval?.length!==12||!results.sharedSceneryRemoval.every(x=>
  x.mounted===0&&x.hangars===0&&x.walls===0&&x.enemies===(x.progress===.25?2:3)))
  throw new Error('Shared rectangular scenery returned or actual reinforcement waves changed: '+JSON.stringify(results.sharedSceneryRemoval));
}
if(!results.facilityHUD.visible||!results.facilityHUD.name||results.facilityHUD.cardWidth<140)throw new Error('Strategic facility identification must be legible on iPhone');
if(results.facilityHUD.noticeTop<results.facilityHUD.objectiveBottom)throw new Error('Tactical notice overlaps the strategic objective card: '+JSON.stringify(results.facilityHUD));
if(results.gpu.view==='View'&&(results.facilityGeometry.models!==12||results.facilityGeometry.visible<1||results.facilityGeometry.worldScale<1.1))throw new Error('Real physical world facility models missing from GPU scene');
if(results.gpu.view==='View'&&(!results.gpuDetonationEarly.coreVisible||results.gpuDetonationEarly.visibleRings<2||results.gpuDetonationLate.visibleRings<1))throw new Error('Facility 3D core/rings too faint at 50ms or 400ms');
if(results.gpu.view==='View'&&results.gpuDemolition.obsoleteOpaqueTori>0)throw new Error('Legacy opaque 3D metal rings must never obscure the playfield');
if(results.gpu.view==='View'&&(results.glare.nearWhiteFraction>.14||results.glare.visibleCoreScale.some(v=>v>1.08)||results.glare.visibleCoreOpacity.some(v=>v>.43)))throw new Error('Facility core light still obscures the 180ms playfield: '+JSON.stringify(results.glare));
if(!results.explosionUnobstructed.stageCueHidden||!results.explosionUnobstructed.centerBannerCompact)throw new Error('Facility explosion obscured by stage radio or oversized banner');
if(!results.controls.moved||!results.controls.weaponChanged||!results.controls.usedBomb||!results.multitouch.focus||!results.multitouch.moved)throw new Error('Functional mobile and dual-touch control regression');
if(new Set(Object.values(results.filmWorlds).map(x=>x.film?.look)).size!==6||
 !Object.values(results.filmWorlds).every(x=>x.geometry.solidMeshes>20&&x.geometry.triangles<40000&&x.detonations.fire>0&&x.detonations.draws===3&&x.film.exposure<.95))
 throw new Error('Cinematic solid geometry, stage lighting or pooled detonation missing: '+JSON.stringify(results.filmWorlds));
if(Object.keys(results.flightWorlds).length!==6||!Object.values(results.flightWorlds).every(samples=>
 samples.length===3&&new Set(samples.map(x=>x.flight.section)).size===3&&samples.every(x=>
  x.mounted&&x.flight.finite&&x.flight.instances>50&&x.flight.instances<3000&&x.flight.details>0&&x.flight.triangles<80000&&x.flight.draws<=9&&
  x.corners.every(p=>p.x>0&&p.x<x.frame.width&&p.y>0&&p.y<x.frame.height))))
 throw new Error('Authored 3D route, continuous world or camera framing missing: '+JSON.stringify(results.flightWorlds));
const actualWorlds=Object.values(results.flightWorlds).map(samples=>samples[1].flight);
if(new Set(actualWorlds.map(x=>x.identity)).size!==6||new Set(actualWorlds.map(x=>x.topology)).size!==6||
 !actualWorlds.every((x,stage)=>x.terrain.filter(name=>/cliff-|river-bank-/.test(name)).length===([3,4].includes(stage)?2:0)))
 throw new Error('Six stages reverted to a shared corridor topology: '+JSON.stringify(actualWorlds));
if(Object.keys(results.worldStageImpact).length!==6||
 !Object.values(results.worldStageImpact).every(x=>x.phase==='action'&&x.impact>.8&&x.fragments>=4))
 throw new Error('One-time environmental catastrophe invisible at impact moment: '+JSON.stringify(results.worldStageImpact));
if(new Set(Object.values(results.worldStageEpisodes).map(x=>x.info.availableIds.join('/'))).size!==6||
 !Object.values(results.worldStageEpisodes).every(x=>x.rootMounted&&x.info.stageSpecific&&x.info.loops===0&&x.info.availableIds.length===3&&x.info.activeEpisodes.length>=1&&x.visibleMeshes>=5))
 throw new Error('Stage-specific event sequences absent from real GPU or repeated: '+JSON.stringify(results.worldStageEpisodes));
if(!Object.values(results.worldRebuild).every(x=>x.rail===null))throw new Error('Decorative rail districts still running in World Rebuild');
if(!results.sideRemoval?.noRailController||results.sideRemoval.railChildren!==0||results.sideRemoval.visibleWorldTowers!==0||results.sideRemoval.farTileGroups!==0)throw new Error('Scrolling edge decoration still visible: '+JSON.stringify(results.sideRemoval));


if(!Object.values(results.worldRebuild).every(x=>x.worldScene&&x.enemy3D>=2&&x.enemyBillboards===0&&x.style==='rebuilt'))throw new Error('3D world and physical enemy meshes not rendered consistently: '+JSON.stringify(results.worldRebuild));
if(!Object.values(results.worldRebuild).every(x=>x.background?.physicalAudit?.textureMappedMeshes===0&&x.background.physicalAudit.flatImageCards===0&&x.background.physicalAudit.sprites===0))throw new Error('2D image/textured photo backdrop still present in REAL World Rebuild scene: '+JSON.stringify(Object.values(results.worldRebuild).map(x=>x.background?.physicalAudit)));
if(![3,4,5].every(stage=>results.worldRebuild[stage]?.background?.physicalAudit?.terrainReliefMeshes>0&&results.worldRebuild[stage].background.physicalAudit.terrainTriangles>200))throw new Error('Ice, jungle and lava banks require actual tessellated 3D relief instead of flat painted cliffs');
// All six stages retain depth weather, with the generic edge machinery retired.
if(!Object.entries(results.worldRebuild).every(([stage,x])=>x.scenic?.stage===Number(stage)&&x.scenic?.farWeather>0&&x.scenic?.style==='world-space-3d-only'&&x.scenic?.machines===0))throw new Error('3D scenic systems disappeared or exceeded staging budget: '+JSON.stringify(Object.values(results.worldRebuild).map(x=>x.scenic)));
if(!Object.entries(results.worldRebuild).every(([stage,x])=>!results.cinematicLayers[stage]?.crowded||x.scenic?.machines===0))throw new Error('Stage machinery obscures dense live projectile patterns');
if(results.scenicPeace?.traffic!==0||results.scenicPeace?.machines!==0||results.scenicPeace?.farWeather<(results.scenicPeace?.quality==='PERFORMANCE'?12:20))throw new Error('Quiet scenery restored retired structures or lost its depth particles: '+JSON.stringify(results.scenicPeace));
if(!results.flightControls?.moved||!results.flightControls.focus||results.flightControls.projection!=='PerspectiveCamera'||!results.flightPauseStable)
 throw new Error('Banking WebGL flight input or paused camera changed: '+JSON.stringify({controls:results.flightControls,pause:results.flightPauseStable}));
if(!results.cameraDrag||Math.hypot(results.cameraDrag.dx,results.cameraDrag.dy)>.35)
 throw new Error('Camera movement leaked into the two-pixel touch movement: '+JSON.stringify(results.cameraDrag));
const phone=results.phoneReview;
if(!phone?.notice.tactical||phone.notice.title!=='敵機発進'||phone.notice.height>70||phone.notice.top<phone.notice.hudBottom||
 phone.notice.bottom>phone.notice.frameHeight*.4||phone.notice.titleHeight>phone.notice.lineHeight*1.1||!phone.notice.cueHidden)
 throw new Error('Launch notice overlaps combat or wraps its short Japanese title: '+JSON.stringify(phone));
if(phone.marker.projectionError>1e-8||Math.abs(phone.marker.scale-.23)>1e-6||phone.marker.depthTest)
 throw new Error('Visible hit point disagrees with the collision plane: '+JSON.stringify(phone.marker));
if(phone.diamond.count<1||phone.diamond.color[0]<phone.diamond.color[1]*2)
 throw new Error('Enemy diamond lost its attack color to the white core pass: '+JSON.stringify(phone.diamond));
if(results.compatibility?.engine!=='CanvasView'||results.compatibility.state!=='paused'||results.compatibility.weapon!=='laser'||
 results.compatibility.bombs!==2||!results.compatibility.help||results.compatibility.scroll<50||!results.compatibility.resumed)
 throw new Error('No-GPU compatibility controls or help navigation failed: '+JSON.stringify(results.compatibility));
if(results.scenicResponse?.cue!=='facility'||results.scenicResponse?.reactiveWallUnits!==0)throw new Error('Facility events restored retired shared rectangular walls: '+JSON.stringify(results.scenicResponse));
// Neither normal route snapshots nor actual launch windows may mount the
// former shared rectangular dock/wall models, even as hidden objects.
if(!Object.entries(results.worldRebuild).every(([stage,r])=>r.worldAlive?.stage===Number(stage)&&
 r.worldAlive.structureCount===0&&r.worldAlive.hangars===0&&r.sharedSideProps===0))
 throw new Error('Shared rectangular stage props returned: '+JSON.stringify(Object.values(results.worldRebuild).map(r=>r.worldAlive)));
if(results.worldAliveLaunch?.game?.launched!==2||results.worldAliveLaunch?.actualEnemyCount!==2||results.worldAliveLaunch?.scene?.hangars!==0||results.worldAliveLaunch?.sharedSideProps!==0)throw new Error('Actual reinforcements changed or their decorative docks returned: '+JSON.stringify(results.worldAliveLaunch));
if(results.worldAliveBreach?.game?.baysOpen?.[1]!==false||results.worldAliveBreach?.game?.destroyed?.[1]!==true)throw new Error('4.0 strategic facility blast failed to close the physical right-side hangar: '+JSON.stringify(results.worldAliveBreach));
if(!results.worldAliveBoss?.scene?.bossVault||results.worldAliveBoss?.scene?.reactorFaces!==1||results.worldAliveBoss.game.wingBroken[0]!==true||results.worldAliveBoss.oldBossRings!==0)throw new Error('4.0 boss vault / one wing or excessive old rings obscure HUD: '+JSON.stringify(results.worldAliveBoss));
if(!results.worldAliveCore?.game?.wingBroken.every(Boolean)||!results.worldAliveCore.scene.centerExposed)throw new Error('4.0 actual wing-break damage must physically open the central 3D reactor: '+JSON.stringify(results.worldAliveCore));
if(results.worldAliveEscape?.state!=='transition'||results.worldAliveEscape?.game?.escape!==true)throw new Error('4.0 actual NOVA boss defeat did not collapse base and start the escape: '+JSON.stringify(results.worldAliveEscape));
if(!results.worldBoss.hasBoss||results.worldBoss.skin||results.worldBoss.meshes<3)throw new Error('Boss must be fully geometrical in World Rebuild');
if(results.classic.visual!=='classic'||!results.classic.buttons.some(b=>b.style==='classic'&&b.selected))throw new Error('Original graphics not accessible after preserving Classic mode');
if(new Set(Object.values(results.cinematicLayers).map(x=>x.heroMotion)).size!==6||
 !Object.values(results.cinematicLayers).every(x=>x.realWorldRoot&&x.heroActuators>=4&&x.chapterIds?.length===3&&new Set(x.chapterIds).size===3&&x.chapterActuators?.every(v=>v>0)&&x.detail&&x.detail.motes>0&&x.detail.flybys===0))
 throw new Error('Stage identity is reused, incomplete, or obscures combat: '+JSON.stringify(results.cinematicLayers));
if(!results.cinematicBoss.invasion?.bossStructure||results.cinematicBoss.volumetric?.bossHalos!==0)throw new Error('Boss ring ownership regression: '+JSON.stringify(results.cinematicBoss));
if(results.cinematicWarp.invasion?.travelRings<8||results.cinematicWarp.volumetric?.warpRings!==0)throw new Error('Single-owner 3D warp tunnel invisible or overlapping: '+JSON.stringify(results.cinematicWarp));
if(results.cinematicBlast.mechanical?.panels<6||results.cinematicBlast.mechanical?.reactors<1||results.cinematicBlast.invasion?.armorFragments<8)throw new Error('Multi-stage physical boss breakup invisible: '+JSON.stringify(results.cinematicBlast));
if(Object.values(results.cinematicLayers).some(x=>x.detail.instances>420||x.detail.fragments>90||x.detail.contrails>48))throw new Error('3D cinematic budgets exceeded');
if(errors.length)throw new Error('Browser console/page errors: '+JSON.stringify(errors));
