import './style.css';
import { Game, STEP, STAGES, W, BOTTOM, TOP, type Difficulty, type Mode } from './sim.ts';
import { View } from './render.ts';
import { AudioEngine } from './audio.ts';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const game=new Game(),audio=new AudioEngine(),canvas=el<HTMLCanvasElement>('game');
let view:View;let ready=false,difficulty:Difficulty='normal',helpFrom='title',lastState=game.state;
let toastUntil=0,messageUntil=0,tipUntil=0,lastTime=0,accumulator=0,lastUI=0;
const keys=new Set<string>();let pointerId:number|null=null,lastPointer={x:0,y:0};
let target:{x:number;y:number}|undefined,focusPointer:number|null=null;
let record:Record<string,number>={},padButtons:boolean[]=[];
try{record=JSON.parse(localStorage.getItem('nova-strike-records-v1')||'{}');const d=localStorage.getItem('nova-strike-difficulty');if(d==='casual'||d==='normal'||d==='expert')difficulty=d;audio.muted=localStorage.getItem('nova-strike-muted')==='true';}catch{/* Storage can be disabled in private browsing. */}
const scoreText=(s:number)=>Math.floor(s).toString().padStart(7,'0');
const keyFor=(mode=game.mode)=>mode+':'+difficulty;
const best=(mode:Mode)=>Math.max(0,Number(record[keyFor(mode)])||0);
function selectDifficulty(d:Difficulty){difficulty=d;document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===d));el('title-best').textContent=scoreText(best('campaign'));try{localStorage.setItem('nova-strike-difficulty',d);}catch{/* Optional storage. */}}
selectDifficulty(difficulty);el('sound-button').textContent=audio.muted?'SOUND OFF':'SOUND ON';
function clearInput(){keys.clear();pointerId=null;target=undefined;focusPointer=null;padButtons=[];el('focus-button').classList.remove('held');}
function screens(){
  el('title-screen').hidden=game.state!=='title';el('pause-screen').hidden=game.state!=='paused'||!el('help-screen').hidden;
  el('result-screen').hidden=game.state!=='result';const active=['playing','paused','transition'].includes(game.state);
  el('hud').hidden=!active;el('controls').hidden=!active||game.state==='paused';
  if(game.state==='title'){el('title-best').textContent=scoreText(best('campaign'));el('boss-hud').hidden=true;}
}
function showMessage(title:string,caption:string,seconds=2.3,danger=false){
  el('message-title').textContent=title;el('message-caption').textContent=caption;
  el('message').classList.toggle('danger',danger);el('message').classList.add('show');messageUntil=performance.now()+seconds*1000;
}
function toast(text:string){el('toast').textContent=text;el('toast').classList.add('show');toastUntil=performance.now()+1900;}
function start(mode:Mode){
  if(!ready)return;void audio.unlock().catch(()=>toast('音声はサウンドボタンで再試行できます'));
  clearInput();el('help-screen').hidden=true;game.start(mode,difficulty);lastState='title';
  tipUntil=performance.now()+6500;el('touch-tip').hidden=!matchMedia('(pointer:coarse)').matches;
  el('message').classList.remove('show');el('toast').classList.remove('show');screens();
}
function pause(){game.pause();clearInput();screens();}
function resume(){el('help-screen').hidden=true;game.resume();clearInput();lastTime=performance.now();accumulator=0;screens();void audio.unlock().catch(()=>{});}
function title(){game.state='title';game.enemies=[];game.bullets=[];game.pickups=[];game.boss=null;game.hull=3;game.stage=0;game.player.vx=0;game.player.vy=0;clearInput();el('help-screen').hidden=true;el('touch-tip').hidden=true;el('message').classList.remove('show');el('toast').classList.remove('show');screens();}
function help(){helpFrom=game.state;if(game.state==='playing'||game.state==='transition')pause();el('help-screen').hidden=false;el('pause-screen').hidden=true;}
function result(){
  clearInput();let newRecord=game.score>best(game.mode);
  if(newRecord){record[keyFor()]=game.score;try{localStorage.setItem('nova-strike-records-v1',JSON.stringify(record));}catch{/* Records remain available during this session. */}}
  el('result-title').textContent=game.won?game.mode==='caravan'?'TIME COMPLETE':'MISSION COMPLETE':'SIGNAL LOST';
  el('result-subtitle').textContent=game.won?game.mode==='caravan'?'2分間の戦果。次は、さらに高く。':'星核を回収。夜明けは、ここから。':'機体ロスト。次の出撃へ、経験をつなぐ。';
  el('final-score').textContent=scoreText(game.score);el('new-record').hidden=!newRecord;
  el('result-stats').replaceChildren();const values=[['撃破',String(game.kills)],['最大連続撃破',String(game.maxChain)],['編隊全滅',String(game.formations)],['秘密のコア',String(game.relics)],['到達セクター',String(game.stage+1)+' / 3'],['プレイ時間',Math.floor(game.totalTime/60)+':'+Math.floor(game.totalTime%60).toString().padStart(2,'0')]];
  for(const[label,value]of values){const d=document.createElement('div');d.textContent=label;const s=document.createElement('strong');s.textContent=value;d.append(s);el('result-stats').append(d);}
  el('message').classList.remove('show');el('boss-hud').hidden=true;el('touch-tip').hidden=true;screens();
}
function actionButton(id:string,callback:()=>void,onPress=false){
  el(id).addEventListener('click',e=>{e.stopPropagation();if(!onPress||e.detail===0)callback();});
  el(id).addEventListener('pointerdown',e=>{e.stopPropagation();if(onPress){e.preventDefault();callback();}});
}
actionButton('start-button',()=>start('campaign'));actionButton('caravan-button',()=>start('caravan'));
actionButton('pause-button',pause);actionButton('resume-button',resume);actionButton('restart-button',()=>start(game.mode));
actionButton('retry-button',()=>start(game.mode));actionButton('title-button',title);actionButton('result-title-button',title);
actionButton('help-button',help);actionButton('pause-help-button',help);
actionButton('help-back',()=>{el('help-screen').hidden=true;if(helpFrom==='title')title();else screens();});
actionButton('weapon-button',()=>{if(game.state==='playing')game.cycleWeapon();},true);
actionButton('nova-button',()=>{if(!game.nova()&&game.state==='playing')toast('撃破・かすりでゲージを充填');},true);
actionButton('sound-button',()=>{void audio.unlock().catch(()=>{});const muted=audio.toggle();el('sound-button').textContent=muted?'SOUND OFF':'SOUND ON';try{localStorage.setItem('nova-strike-muted',String(muted));}catch{/* Optional storage. */}});
document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>selectDifficulty(b.dataset.difficulty as Difficulty)));
canvas.addEventListener('pointerdown',e=>{
  if(game.state!=='playing'||pointerId!==null)return;e.preventDefault();pointerId=e.pointerId;lastPointer=view.pointerToWorld(e.clientX,e.clientY);target={x:game.player.x,y:game.player.y};canvas.setPointerCapture(e.pointerId);el('touch-tip').hidden=true;
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointerId||!target)return;e.preventDefault();const p=view.pointerToWorld(e.clientX,e.clientY);
  target.x=Math.max(-W,Math.min(W,target.x+p.x-lastPointer.x));target.y=Math.max(BOTTOM,Math.min(TOP,target.y+p.y-lastPointer.y));lastPointer=p;
});
function release(e:PointerEvent){if(e.pointerId===pointerId){pointerId=null;target=undefined;}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
el('focus-button').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();focusPointer=e.pointerId;el('focus-button').setPointerCapture(e.pointerId);el('focus-button').classList.add('held');});
for(const event of['pointerup','pointercancel','lostpointercapture'])el('focus-button').addEventListener(event,e=>{if((e as PointerEvent).pointerId===focusPointer){focusPointer=null;el('focus-button').classList.remove('held');}});
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)&&e.code!=='Tab')e.preventDefault();
  if(e.repeat)return;keys.add(e.code);
  if(e.code==='Escape'||e.code==='KeyP'){if(!el('help-screen').hidden){el('help-screen').hidden=true;screens();}else if(game.state==='paused')resume();else pause();}
  if(e.code==='KeyC'&&game.state==='playing')game.cycleWeapon();
  if(['Space','KeyX'].includes(e.code))game.nova();
  if(e.code==='Enter'&&game.state==='title')start('campaign');
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(game.state==='playing'||game.state==='transition')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('gesturechange',e=>e.preventDefault());
function input(){
  let x=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  let y=Number(keys.has('ArrowUp')||keys.has('KeyW'))-Number(keys.has('ArrowDown')||keys.has('KeyS'));
  let focus=focusPointer!==null||keys.has('ShiftLeft')||keys.has('ShiftRight');
  const pad=navigator.getGamepads?.()[0];if(pad){
    const ax=pad.axes[0]||0,ay=pad.axes[1]||0;x+=Math.abs(ax)>.15?ax:0;y-=Math.abs(ay)>.15?ay:0;
    x+=Number(!!pad.buttons[15]?.pressed)-Number(!!pad.buttons[14]?.pressed);y+=Number(!!pad.buttons[12]?.pressed)-Number(!!pad.buttons[13]?.pressed);focus ||=!!pad.buttons[0]?.pressed;
    if(pad.buttons[1]?.pressed&&!padButtons[1])game.nova();if(pad.buttons[2]?.pressed&&!padButtons[2]&&game.state==='playing')game.cycleWeapon();
    if(pad.buttons[9]?.pressed&&!padButtons[9]){if(game.state==='paused')resume();else pause();}
    padButtons=pad.buttons.map(b=>b.pressed);
  }
  return {x,y,focus,target};
}
function updateUI(now:number){
  if(now-lastUI<65)return;lastUI=now;
  el('score').textContent=scoreText(game.score);el('high').textContent='BEST '+scoreText(Math.max(best(game.mode),game.score));
  el('multiplier').textContent='×'+game.multiplier;
  el('hull').innerHTML=Array.from({length:4},(_,i)=>'<i'+(i>=game.hull?' class="empty"':'')+'></i>').join('');
  el('hull').setAttribute('aria-label','残り耐久 '+game.hull);
  el('sector').textContent=game.mode==='caravan'?'残り '+Math.max(0,Math.ceil(120-game.totalTime)).toString().padStart(3,'0')+' s':'SECTOR 0'+(game.stage+1)+' / 03';
  el('progress').style.width=Math.min(100,game.mode==='caravan'?game.totalTime/120*100:game.time/STAGES[game.stage].duration*100)+'%';
  el('weapon-name').textContent=game.weapon.toUpperCase();el('power-level').textContent=Array.from({length:4},(_,i)=>i<game.power?'▰':'▱').join(' ');
  el('bombs').textContent=game.energy>=100?'READY':game.bombs.toString().padStart(2,'0');
  el('nova-ready').textContent=game.overdrive>0?'BOOST':game.energy>=100?'OVERDRIVE':'NOVA';
  el('nova-button').classList.toggle('ready',game.energy>=100);el('nova-button').classList.toggle('unavailable',game.bombs===0&&game.energy<100);
  el('energy').style.width=game.energy+'%';const boss=game.boss;
  el('boss-hud').hidden=!boss||boss.dead||game.state==='result'||game.state==='title';
  if(boss){el('boss-name').textContent=STAGES[game.stage].boss;el('boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';el('boss-percent').textContent=Math.max(0,Math.ceil(boss.hp/boss.maxHp*100))+'%';el('parts-status').textContent=boss.parts.map((p,i)=>(i===0?'L':'R')+' '+(p>0?'ACTIVE':'DESTROYED')).join(' / ');}
  if(now>messageUntil)el('message').classList.remove('show');if(now>toastUntil)el('toast').classList.remove('show');if(now>tipUntil)el('touch-tip').hidden=true;
}
function events(){
  for(const e of game.drainEvents()){
    view.event(e);audio.event(e);
    if(e.type==='stage')showMessage(e.text||'','SECTOR 0'+(game.stage+1)+' / '+STAGES[game.stage].jp,2.6);
    else if(e.type==='warning')showMessage('WARNING',e.text||'',2.8,true);
    else if(e.type==='bosskill')showMessage('SECTOR CLEAR',game.mode==='campaign'&&game.stage<2?'TARGET DESTROYED / HULL +1':'TARGET DESTROYED',3.1);
    else if(e.type==='finish')result();
    else if(e.text)toast(e.text);
    if(e.type==='damage'||e.type==='nova'){
      el('flash').className='screen-flash';void el('flash').offsetWidth;el('flash').classList.add(e.type==='damage'?'hit':'nova');
    }
  }
}
function loop(now:number){
  if(!ready){requestAnimationFrame(loop);return;}
  const frameMs=lastTime?now-lastTime:16.67;lastTime=now;const dt=Math.min(.05,frameMs/1000);
  accumulator+=dt;const controls=input();let count=0;
  while(accumulator>=STEP&&count<4){game.update(STEP,controls);accumulator-=STEP;count++;}
  if(game.state!==lastState){lastState=game.state;screens();}
  events();audio.update(game.state==='playing',game.stage,!!game.boss&&!game.boss.dead);view.draw(game,dt,frameMs);updateUI(now);
  requestAnimationFrame(loop);
}
async function boot(){
  try{
    view=new View(canvas);await view.init(new URLSearchParams(location.search).get('renderer')==='webgl');
    view.draw(game,0,16.67);ready=true;el('boot').hidden=true;screens();
    new ResizeObserver(()=>view.resize()).observe(el('frame'));
    window.addEventListener('pageshow',e=>{if(e.persisted){clearInput();lastTime=performance.now();accumulator=0;}});
    Object.assign(window,{__nova:{game,view,start,pause,resume,snapshot:()=>({...game.snapshot(),render:view.getDiagnostics()})}});
    if('serviceWorker'in navigator&&!import.meta.env.DEV){
      void navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
        void reg.update();reg.addEventListener('updatefound',()=>{const sw=reg.installing;sw?.addEventListener('statechange',()=>{if(sw.state==='installed'&&navigator.serviceWorker.controller)el('update-button').hidden=false;});});
      }).catch(()=>{});
    }
    actionButton('update-button',()=>location.reload());
    requestAnimationFrame(loop);
  }catch(error){console.error(error);el('boot-text').textContent='グラフィックの起動に失敗しました';const b=document.createElement('button');b.className='secondary-button';b.textContent='軽量モードで再起動';b.onclick=()=>{const u=new URL(location.href);u.searchParams.set('renderer','webgl');location.href=u.href;};el('boot').append(b);}
}
void boot();
