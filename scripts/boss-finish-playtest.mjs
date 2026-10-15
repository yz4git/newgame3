import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const root='boss-finish-review';
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try{
 for(const renderer of ['webgl','canvas']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP',reducedMotion:'no-preference',serviceWorkers:'block'});
  // Hold and step the application's real RAF callback. The production loop
  // still processes fixed-step combat, event order, HUD and all render layers.
  await context.addInitScript(()=>{
   const native=requestAnimationFrame.bind(window);
   const control=window.__bossReview={frozen:false,next:null,now:0,
    step(){const callback=this.next;if(!callback)throw new Error('No held game frame');this.next=null;this.now+=50;callback(this.now);}};
   window.requestAnimationFrame=callback=>{
    if(control.frozen){control.next=callback;return 0;}
    return native(now=>{control.now=now;if(control.frozen)control.next=callback;else callback(now);});
   };
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto('http://127.0.0.1:5173/?renderer='+renderer+'&visual=rebuilt',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__nova&&document.getElementById('boot').hidden,{timeout:55000});
  await page.locator('#start-button').click();
  await page.evaluate(()=>{window.__bossReview.frozen=true;});
  await page.waitForFunction(()=>!!window.__bossReview.next);
  assert.equal(await page.evaluate(()=>window.__nova.view.engine),renderer==='webgl'?'WebGL 2':'Canvas 2D');
  for(let stage=0;stage<6;stage++){
   await page.evaluate(stage=>{
    const {game:g}=window.__nova;
    g.start('campaign','normal',stage,'striker');g.time=40;g.invulnerable=900;g.shotTimer=900;
    g.waveIndex=999;g.schedule=[];g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.sectorMission.started=true;
    g.spawnBoss();g.boss.age=12;g.boss.y=6;
    window.__bossReview.step();
   },stage);
   await page.evaluate(stage=>{
    const {game:g}=window.__nova;g.boss.hp=1;
    if(stage%2===0)g.nova();
    else{
     g.fire();const shot=g.bullets.find(b=>!b.enemy&&!b.dead);
     Object.assign(shot,{x:g.boss.x,y:g.boss.y,vx:0,vy:0,damage:99999});
    }
    window.__bossReview.step();
   },stage);
   assert.equal(await page.evaluate(()=>window.__nova.game.state),'transition','real weapon must defeat the boss');
   const frames=[];
   for(const target of [.1,.45,.9,1.5,2.5,3.3]){
    const data=await page.evaluate(target=>{
     const {game:g,view}=window.__nova;
     for(let n=0;3.5-g.transitionTime<target&&n<80;n++)window.__bossReview.step();
     const d=view.getDiagnostics(),travel=view.scene?.getObjectByName('hyperspace-strata');
     let travelTori=0;travel?.traverse(o=>{if(o.geometry?.type==='TorusGeometry'&&o.visible)travelTori+=o.count??1;});
     return {age:3.5-g.transitionTime,state:g.state,dead:g.boss?.dead,engine:d.engine,
      invasion:d.invasion,detonations:d.detonations,combat:d.combatEffects,mechanical:d.mechanical,camera:d.cameraRig,travelTori,
      player:view.player?.position.toArray(),simulationPlayer:[g.player.x,g.player.y]};
    },target);
    assert.equal(data.state,'transition');assert.equal(data.dead,true);assert.equal(data.travelTori,0);
    assert.equal(data.combat.waves,0,'no auxiliary boss/NOVA hoop');
    if(target<.9&&renderer==='webgl'){
     assert.equal(data.invasion.travelStreaks,0);
     assert.ok(Math.abs(data.player[1]-data.simulationPlayer[1])<.001,'do not depart during the initial rupture');
    }
    if(target===1.5&&renderer==='webgl')assert.ok(data.invasion.travelStreaks>=12);
    const name=`${renderer}-stage-${stage+1}-${String(Math.round(target*1000)).padStart(4,'0')}ms.jpg`;
    await page.screenshot({path:root+'/'+name,type:'jpeg',quality:85,scale:'css',animations:'disabled'});
    frames.push({...data,image:name});
   }
   // Pause holds the current simulation clock and effect matrices.
   const pause=await page.evaluate(()=>{
    const {game:g,view}=window.__nova;g.pause();const before=g.transitionTime;
    const matrix=view.scene?.getObjectByName('tapered-world-space-escape-trails')?.instanceMatrix.array.slice();
    for(let i=0;i<4;i++)window.__bossReview.step();
    const stable=before===g.transitionTime&&(!matrix||matrix.every((v,i)=>v===view.scene.getObjectByName('tapered-world-space-escape-trails').instanceMatrix.array[i]));
    g.resume();return stable;
   });assert.equal(pause,true);
   await page.evaluate(()=>{for(let i=0;i<5;i++)window.__bossReview.step();});
   const outcome=await page.evaluate(()=>({state:window.__nova.game.state,stage:window.__nova.game.stage,won:window.__nova.game.won}));
   assert.equal(outcome.state,stage===5?'result':'playing');
   assert.equal(outcome.stage,stage===5?5:stage+1);if(stage===5)assert.equal(outcome.won,true);
   results.push({renderer,stage,kill:stage%2===0?'nova':'shot',frames,pause,outcome});
  }
  // Motion-reduced rendering must not reintroduce a travel mesh or auxiliary hoop.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{
   const {game:g}=window.__nova;g.start();g.spawnBoss();window.__bossReview.step();g.boss.hp=1;g.nova();
   for(let i=0;i<16;i++)window.__bossReview.step();
  });
  const reduced=await page.evaluate(()=>window.__nova.view.getDiagnostics());
  assert.equal(reduced.combatEffects.waves,0);if(renderer==='webgl')assert.equal(reduced.invasion.travelStreaks,0);
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('NOVA_BOSS_REVIEW:'+JSON.stringify({results,errors}));
 await fs.writeFile(root+'/results.json',JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
