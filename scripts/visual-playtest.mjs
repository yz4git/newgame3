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
async function setup(viewport,{renderer='canvas'}={}){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP',reducedMotion:'no-preference'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text());});
 const url='http://127.0.0.1:5173/?renderer='+renderer;
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
results.errors=errors;
console.log('NOVA_PROGRESS:'+JSON.stringify({controls:results.controls,titleLayout:results.titleLayout,smallLayout:results.smallLayout,gpu:results.gpu.view,errors}));
console.log('NOVA_REVIEW:'+JSON.stringify(results));
await browser.close();
if(!results.controls.moved||!results.controls.weaponChanged||!results.controls.usedBomb||!results.multitouch.focus||!results.multitouch.moved)throw new Error('Functional mobile and dual-touch control regression');
if(errors.length)throw new Error('Browser console/page errors: '+JSON.stringify(errors));
