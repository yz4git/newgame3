import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const root='visual-review';
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const results={};
async function scene(page,name,delay=650){
 await page.waitForTimeout(delay);
 const path=root+'/'+name+'.jpg';
 const picture=await page.screenshot({path,type:'jpeg',quality:49,animations:'disabled',scale:'css'});
 console.log('NOVA_SHOT:'+name+':'+picture.toString('base64'));
 return path;
}
async function setup(viewport,{renderer='canvas',visual='rebuilt'}={}){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP',reducedMotion:'no-preference'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text());});
 const url='http://127.0.0.1:5173/?renderer='+renderer+'&visual='+visual;
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__nova&&document.getElementById('boot').hidden,{timeout:90000});
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
await scene(page,'04-strategic-facility',500);
results.facilityHUD=await page.evaluate(()=>{
 const box=document.getElementById('field-objective');
 const field=window.__nova.game.nodes.find(n=>n.attach==='field'&&!n.dead);
 return {visible:!box.hidden,name:document.getElementById('field-objective-name').textContent,
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
const rich=await setup({width:390,height:844},{renderer:'webgl'});
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
 results.cinematicLayers[stage]=await rich.page.evaluate(()=>{
  const {view}=window.__nova;
  const detail=view.getDiagnostics().volumetric;
  const kinetic=view.background.scenes[0].getObjectByName('kinetic-world-assembly');
  return {detail,crowded:window.__nova.game.bullets.length>=38||window.__nova.game.enemies.filter(e=>!e.dead).length>=17,kineticRings:kinetic?.children.filter(x=>x.name.startsWith('kinetic-ring-')).length??0,
   kineticArms:kinetic?.children.filter(x=>x.name.startsWith('kinetic-arm-')).length??0,
   realWorldRoot:!!view.scene.getObjectByName('world-space-cinematics-v31')};
 });
 results.worldRebuild[stage]=await rich.page.evaluate(()=>{
  const {view,game:g}=window.__nova;
  const scene=view.background.scenes.some(m=>m.name==='physical-world-centrepiece-'+g.stage);
  const enemies=[...view.models.values()];
  const skinCount=enemies.reduce((a,m)=>a+(m.getObjectByName('skin')?1:0),0);
  return {worldScene:scene,enemy3D:enemies.length,enemyBillboards:skinCount,
    style:view.getDiagnostics().visualStyle,ship:view.renderedShip,background:view.getDiagnostics().background,
    scenic:view.getDiagnostics().scenic};
 });
}
// Intentionally quiet airspace proves the new 3D cargo lanes are actually
// visible when enemy bullets don't need the screen. Then verify a real field
// event physically moves background wall shutters rather than flashing HUD.
await rich.page.evaluate(()=>{
 const {game:g,view}=window.__nova;
 g.start('campaign','normal',1,'striker');
 g.time=14;g.enemies=[];g.bullets=[];g.nodes=[];g.invulnerable=900;g.shotTimer=900;
 view.draw(g,.016,16.7);
});
await scene(rich.page,'v39-3d-background-harbor-freight',450);
results.scenicPeace=await rich.page.evaluate(()=>window.__nova.view.getDiagnostics().scenic);
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
const classic=await setup({width:390,height:844},{renderer:'canvas',visual:'classic'});
results.classic=await classic.page.evaluate(()=>({
 visual:window.__nova.view.getDiagnostics().visualStyle,
 buttons:[...document.querySelectorAll('[data-visual]')].map(b=>({style:b.dataset.visual,selected:b.classList.contains('selected')}))
}));
await scene(classic.page,'world-rebuild-classic-preserved',450);
await classic.context.close();

results.errors=errors;
console.log('NOVA_PROGRESS:'+JSON.stringify({controls:results.controls,titleLayout:results.titleLayout,smallLayout:results.smallLayout,gpu:results.gpu.view,errors}));
console.log('NOVA_REVIEW:'+JSON.stringify(results));
await browser.close();
if(!results.facilityHUD.visible||!results.facilityHUD.name||results.facilityHUD.cardWidth<140)throw new Error('Strategic facility identification must be legible on iPhone');
if(results.gpu.view==='View'&&(results.facilityGeometry.models!==12||results.facilityGeometry.visible<1||results.facilityGeometry.worldScale<1.1))throw new Error('Real physical world facility models missing from GPU scene');
if(results.gpu.view==='View'&&(!results.gpuDetonationEarly.coreVisible||results.gpuDetonationEarly.visibleRings<2||results.gpuDetonationLate.visibleRings<1))throw new Error('Facility 3D core/rings too faint at 50ms or 400ms');
if(results.gpu.view==='View'&&results.gpuDemolition.obsoleteOpaqueTori>0)throw new Error('Legacy opaque 3D metal rings must never obscure the playfield');
if(results.gpu.view==='View'&&(results.glare.nearWhiteFraction>.14||results.glare.visibleCoreScale.some(v=>v>1.08)||results.glare.visibleCoreOpacity.some(v=>v>.43)))throw new Error('Facility core light still obscures the 180ms playfield: '+JSON.stringify(results.glare));
if(!results.explosionUnobstructed.stageCueHidden||!results.explosionUnobstructed.centerBannerCompact)throw new Error('Facility explosion obscured by stage radio or oversized banner');
if(!results.controls.moved||!results.controls.weaponChanged||!results.controls.usedBomb||!results.multitouch.focus||!results.multitouch.moved)throw new Error('Functional mobile and dual-touch control regression');
if(!Object.values(results.worldRebuild).every(x=>x.worldScene&&x.enemy3D>=2&&x.enemyBillboards===0&&x.style==='rebuilt'))throw new Error('3D world and physical enemy meshes not rendered consistently: '+JSON.stringify(results.worldRebuild));
if(!Object.values(results.worldRebuild).every(x=>x.background?.physicalAudit?.textureMappedMeshes===0&&x.background.physicalAudit.flatImageCards===0&&x.background.physicalAudit.sprites===0))throw new Error('2D image/textured photo backdrop still present in REAL World Rebuild scene: '+JSON.stringify(Object.values(results.worldRebuild).map(x=>x.background?.physicalAudit)));
if(![3,4,5].every(stage=>results.worldRebuild[stage]?.background?.physicalAudit?.terrainReliefMeshes>0&&results.worldRebuild[stage].background.physicalAudit.terrainTriangles>200))throw new Error('Ice, jungle and lava banks require actual tessellated 3D relief instead of flat painted cliffs');
if(!Object.entries(results.worldRebuild).every(([stage,x])=>x.scenic?.stage===Number(stage)&&x.scenic?.machines>=1&&x.scenic?.farWeather>0&&x.scenic?.style==='world-space-3d-only'))throw new Error('Missing moving real-3D scenic backdrops in all six stages: '+JSON.stringify(Object.values(results.worldRebuild).map(x=>x.scenic)));
if(results.scenicPeace?.traffic<2||results.scenicPeace?.machines<1||results.scenicPeace?.farWeather<20)throw new Error('Background freight and weather must appear when no bullets block the view: '+JSON.stringify(results.scenicPeace));
if(results.scenicResponse?.cue!=='facility'||results.scenicResponse?.reactiveWallUnits!==2)throw new Error('Large base destruction must physically animate both sides of dock walls: '+JSON.stringify(results.scenicResponse));
if(!results.worldBoss.hasBoss||results.worldBoss.skin||results.worldBoss.meshes<3)throw new Error('Boss must be fully geometrical in World Rebuild');
if(results.classic.visual!=='classic'||!results.classic.buttons.some(b=>b.style==='classic'&&b.selected))throw new Error('Original graphics not accessible after preserving Classic mode');
if(!Object.values(results.cinematicLayers).every(x=>x.realWorldRoot&&x.kineticRings===3&&x.kineticArms===4&&x.detail&&x.detail.motes>0&&(x.crowded?x.detail.flybys===0:x.detail.flybys>0)))throw new Error('3D cinematics missing or decorative flybys not hidden during dangerous bullet/enemy crowding: '+JSON.stringify(results.cinematicLayers));
if(!results.cinematicBoss.invasion?.bossStructure||results.cinematicBoss.volumetric?.bossHalos!==0)throw new Error('Boss ring ownership regression: '+JSON.stringify(results.cinematicBoss));
if(results.cinematicWarp.invasion?.travelRings<8||results.cinematicWarp.volumetric?.warpRings!==0)throw new Error('Single-owner 3D warp tunnel invisible or overlapping: '+JSON.stringify(results.cinematicWarp));
if(results.cinematicBlast.mechanical?.panels<6||results.cinematicBlast.mechanical?.reactors<1||results.cinematicBlast.invasion?.armorFragments<8)throw new Error('Multi-stage physical boss breakup invisible: '+JSON.stringify(results.cinematicBlast));
if(Object.values(results.cinematicLayers).some(x=>x.detail.instances>420||x.detail.fragments>90||x.detail.contrails>48))throw new Error('3D cinematic budgets exceeded');
if(errors.length)throw new Error('Browser console/page errors: '+JSON.stringify(errors));
