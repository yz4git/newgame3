import './style.css';
import {loadVisualAssets} from './visual-assets.ts';
import { Game, STEP, GAME_SPEED, STAGES, W, BOTTOM, TOP, type Difficulty, type Mode, type ShipClass, SHIPS } from './sim.ts';
import { View } from './render.ts';
import { AudioEngine } from './audio-engine.ts';
import type {SoundBus} from './sound-design.ts';
import { CanvasView } from './canvas.ts';
import {stageCue} from './motion.ts';
import {ENCOUNTERS} from './encounter-design.ts';
import {fieldDamagePhase} from './battlefield.ts';
import {BOSS_FORM_NAMES} from './boss-evolution.ts';
import {zoneAt,stageDistance} from './bg-map.ts';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const game=new Game(),audio=new AudioEngine();let canvas=el<HTMLCanvasElement>('game');
let selectedStage=0;let selectedShip:ShipClass='striker';
let view:View|CanvasView;let ready=false,difficulty:Difficulty='normal',helpFrom='title',lastState=game.state;
let toastUntil=0,messageUntil=0,tipUntil=0,lastTime=0,accumulator=0,lastUI=0;
let lastCueKey='';
const keys=new Set<string>();let pointerId:number|null=null,lastPointer={x:0,y:0};
let target:{x:number;y:number}|undefined,focusPointer:number|null=null;
let record:Record<string,number>={},padButtons:boolean[]=[];
const popups:{element:HTMLSpanElement;x:number;y:number;at:number}[]=[];
try{record=JSON.parse(localStorage.getItem('nova-strike-records-v1')||'{}');const d=localStorage.getItem('nova-strike-difficulty');if(d==='casual'||d==='normal'||d==='expert')difficulty=d;const ship=localStorage.getItem('nova-strike-ship');if(ship&&ship in SHIPS)selectedShip=ship as ShipClass;audio.muted=localStorage.getItem('nova-strike-muted')==='true';}catch{/* Storage can be disabled in private browsing. */}
const scoreText=(s:number)=>Math.floor(s).toString().padStart(7,'0');
const keyFor=(mode=game.mode)=>mode+':'+difficulty+(selectedShip==='striker'?'':':'+selectedShip);
const best=(mode:Mode)=>Math.max(0,Number(record[keyFor(mode)])||0);
function selectDifficulty(d:Difficulty){difficulty=d;document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===d));el('title-best').textContent=scoreText(best('campaign'));try{localStorage.setItem('nova-strike-difficulty',d);}catch{/* Optional storage. */}}
const stageSelect=el<HTMLSelectElement>('stage-select');
STAGES.forEach((stage,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=String(index+1).padStart(2,'0')+' / '+stage.jp;stageSelect.append(option);});
function updateSectorPreview(){const n=Math.max(0,Math.min(5,selectedStage)),x=n%3*50,y=Math.floor(n/3)*100;stageSelect.parentElement?.style.setProperty('--stage-art-position',x+'% '+y+'%');}
stageSelect.addEventListener('change',()=>{selectedStage=Number(stageSelect.value);updateSectorPreview();if(game.state==='title'){game.stage=selectedStage;game.visualTime=0;}});updateSectorPreview();
document.querySelectorAll<HTMLButtonElement>('[data-ship]').forEach(button=>{const type=button.dataset.ship as ShipClass;button.classList.toggle('selected',type===selectedShip);button.addEventListener('click',()=>{selectedShip=type;game.shipClass=type;el('title-best').textContent=scoreText(best('campaign'));document.querySelectorAll<HTMLButtonElement>('[data-ship]').forEach(b=>b.classList.toggle('selected',b.dataset.ship===type));try{localStorage.setItem('nova-strike-ship',type);}catch{/* Storage optional. */}});});game.shipClass=selectedShip;
selectDifficulty(difficulty);el('sound-button').textContent=audio.muted?'SOUND OFF':'SOUND ON';
function clearPopups(){for(const p of popups)p.element.remove();popups.length=0;}
function clearInput(){keys.clear();pointerId=null;target=undefined;focusPointer=null;padButtons=[];el('focus-button').classList.remove('held');}
function screens(){
  el('title-screen').hidden=game.state!=='title';el('pause-screen').hidden=game.state!=='paused'||!el('help-screen').hidden||!el('audio-screen').hidden;
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
  clearInput();clearPopups();el('help-screen').hidden=true;el('audio-screen').hidden=true;game.start(mode,difficulty,selectedStage,selectedShip);lastState='title';
  tipUntil=performance.now()+6500;el('touch-tip').hidden=!matchMedia('(pointer:coarse)').matches;
  el('message').classList.remove('show');el('toast').classList.remove('show');screens();
}
function pause(){game.pause();clearInput();screens();}
function resume(){el('help-screen').hidden=true;game.resume();clearInput();lastTime=performance.now();accumulator=0;screens();void audio.unlock().catch(()=>{});}
function title(){clearPopups();game.locks=[];game.state='title';game.enemies=[];game.bullets=[];game.pickups=[];game.boss=null;game.encounter=null;game.nodes=[];game.threats=[];game.encounterSeen={stage:false,mini:false};game.hull=3;game.stage=selectedStage;game.player.vx=0;game.player.vy=0;clearInput();el('help-screen').hidden=true;el('touch-tip').hidden=true;el('message').classList.remove('show');el('toast').classList.remove('show');screens();}
function help(){helpFrom=game.state;if(game.state==='playing'||game.state==='transition')pause();el('help-screen').hidden=false;el('pause-screen').hidden=true;}
function result(){
  clearInput();let newRecord=game.score>best(game.mode);
  if(newRecord){record[keyFor()]=game.score;try{localStorage.setItem('nova-strike-records-v1',JSON.stringify(record));}catch{/* Records remain available during this session. */}}
  el('result-title').textContent=game.won?game.mode==='caravan'?'TIME COMPLETE':game.mode==='bossrush'?'BOSS RUSH CLEAR':'MISSION COMPLETE':game.failureReason==='timeout'?'TIME LIMIT':'SIGNAL LOST';
  el('result-subtitle').textContent=game.won?game.mode==='caravan'?'2分間の戦果。次は、さらに高く。':game.mode==='bossrush'?'全6守護艦撃破。最速撃破を目指そう。':'星核を回収。夜明けは、ここから。':game.failureReason==='timeout'?'制限時間を超過。砲台を壊し、攻撃の合間に本体を狙おう。':'機体ロスト。次の出撃へ、経験をつなぐ。';
  el('final-score').textContent=scoreText(game.score);el('new-record').hidden=!newRecord;
  el('result-stats').replaceChildren();const values=[['撃破',String(game.kills)],['最大連続撃破',String(game.maxChain)],['編隊全滅',String(game.formations)],['戦場目標破壊',String(game.battlefield.destroyed)],['目標突破を許した数',String(game.battlefield.escaped)],['誘爆撃破',String(game.battlefield.reactions)],['遮蔽物が防いだ敵弾',String(game.battlefield.shotsBlocked)],['障害物排除',String(game.battlefield.hazardsCleared)],['迂回した敵機',String(game.battlefield.rerouted)],['特別任務達成',String(game.sectorMission.totalSuccess)],['特別任務失敗',String(game.sectorMission.totalFailed)],['ロック撃破',String(game.lockKills)],['弾消し',String(game.cancelled)],['最高メダル',String(game.bestMedal)+' / 5'],['到達セクター',String(game.stage+1)+' / '+STAGES.length],['プレイ時間',Math.floor(game.totalTime/60)+':'+Math.floor(game.totalTime%60).toString().padStart(2,'0')]];
  for(const[label,value]of values){const d=document.createElement('div');d.textContent=label;const s=document.createElement('strong');s.textContent=value;d.append(s);el('result-stats').append(d);}
  el('message').classList.remove('show');el('boss-hud').hidden=true;el('touch-tip').hidden=true;screens();
}
function actionButton(id:string,callback:()=>void,onPress=false){
  el(id).addEventListener('click',e=>{e.stopPropagation();if(!onPress||e.detail===0)callback();});
  el(id).addEventListener('pointerdown',e=>{e.stopPropagation();if(onPress){e.preventDefault();callback();}});
}
actionButton('start-button',()=>start('campaign'));actionButton('caravan-button',()=>start('caravan'));actionButton('bossrush-button',()=>start('bossrush'));
actionButton('pause-button',pause);actionButton('resume-button',resume);actionButton('restart-button',()=>start(game.mode));
actionButton('retry-button',()=>start(game.mode));actionButton('title-button',title);actionButton('result-title-button',title);
actionButton('help-button',help);actionButton('pause-help-button',help);
actionButton('help-back',()=>{el('help-screen').hidden=true;if(helpFrom==='title')title();else screens();});
actionButton('weapon-button',()=>{if(game.state==='playing')game.cycleWeapon();},true);
actionButton('nova-button',()=>{if(!game.nova()&&game.state==='playing')toast('撃破・かすりでゲージを充填');},true);
actionButton('sound-button',()=>{void audio.unlock().catch(()=>{});const muted=audio.toggle();el('sound-button').textContent=muted?'SOUND OFF':'SOUND ON';try{localStorage.setItem('nova-strike-muted',String(muted));}catch{/* Optional storage. */}});
function soundSettings(){if(game.state==='playing'||game.state==='transition')pause();el('audio-screen').hidden=false;screens();el('audio-toggle').textContent=audio.muted?'SOUND OFF':'SOUND ON';for(const bus of ['master','music','effects'] as SoundBus[]){el<HTMLInputElement>('volume-'+bus).value=String(Math.round(audio.volumes[bus]*100));el('level-'+bus).textContent=Math.round(audio.volumes[bus]*100)+'%';}}
actionButton('audio-settings-button',soundSettings);actionButton('pause-audio-button',soundSettings);
actionButton('audio-back',()=>{el('audio-screen').hidden=true;screens();});
actionButton('audio-preview',()=>{void audio.unlock().then(()=>audio.preview()).catch(()=>toast('サウンドボタンからもう一度お試しください'));});
actionButton('audio-toggle',()=>{void audio.unlock().catch(()=>{});audio.toggle();const text=audio.muted?'SOUND OFF':'SOUND ON';el('sound-button').textContent=text;el('audio-toggle').textContent=text;try{localStorage.setItem('nova-strike-muted',String(audio.muted));}catch{/* Optional storage. */}});
for(const bus of ['master','music','effects'] as SoundBus[])el<HTMLInputElement>('volume-'+bus).addEventListener('input',e=>{audio.setVolume(bus,Number((e.target as HTMLInputElement).value)/100);el('level-'+bus).textContent=Math.round(audio.volumes[bus]*100)+'%';});
document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>selectDifficulty(b.dataset.difficulty as Difficulty)));
function bindCanvas(){canvas.addEventListener('pointerdown',e=>{
  if(game.state!=='playing'||pointerId!==null)return;e.preventDefault();pointerId=e.pointerId;lastPointer=view.pointerToWorld(e.clientX,e.clientY);target={x:game.player.x,y:game.player.y};canvas.setPointerCapture(e.pointerId);el('touch-tip').hidden=true;
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointerId||!target)return;e.preventDefault();const p=view.pointerToWorld(e.clientX,e.clientY);
  target.x=Math.max(-W,Math.min(W,target.x+p.x-lastPointer.x));target.y=Math.max(BOTTOM,Math.min(TOP,target.y+p.y-lastPointer.y));lastPointer=p;
});
function release(e:PointerEvent){if(e.pointerId===pointerId){pointerId=null;target=undefined;}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);}
el('focus-button').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();focusPointer=e.pointerId;el('focus-button').setPointerCapture(e.pointerId);el('focus-button').classList.add('held');});
for(const event of['pointerup','pointercancel','lostpointercapture'])el('focus-button').addEventListener(event,e=>{if((e as PointerEvent).pointerId===focusPointer){focusPointer=null;el('focus-button').classList.remove('held');}});
window.addEventListener('keydown',e=>{
  if((e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)&&!(e.code==='Escape'&&!el('audio-screen').hidden))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)&&e.code!=='Tab')e.preventDefault();
  if(e.repeat)return;keys.add(e.code);
  if(e.code==='Escape'||e.code==='KeyP'){if(!el('audio-screen').hidden){el('audio-screen').hidden=true;screens();}else if(!el('help-screen').hidden){el('help-screen').hidden=true;screens();}else if(game.state==='paused')resume();else pause();}
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
  el('chain-readout').firstChild!.textContent='CHAIN '+game.chain.toString().padStart(3,'0')+' ';el('chain-fill').style.width=Math.min(100,game.chainTime/3.4*100)+'%';
  const activeField=game.nodes.find(n=>n.attach==='field'&&!n.dead);
  const fieldLabel=el('battlefield-status');fieldLabel.hidden=game.mode!=='campaign';
  const activeTerrain=game.battlefield.terrain.some(p=>!p.dead);fieldLabel.textContent=activeTerrain?'AFTERMATH '+(game.battlefield.route==='cover'?'COVER +'+game.battlefield.shotsBlocked+' BLOCK':'HAZARD · SHOOT TO CLEAR'):activeField?'TARGET '+(activeField.index+1)+'/2 · '+(fieldDamagePhase(activeField.hp,activeField.maxHp)===2?'CORE EXPOSED ':fieldDamagePhase(activeField.hp,activeField.maxHp)===1?'ARMOUR BROKEN ':'')+Math.max(0,Math.ceil(activeField.hp/activeField.maxHp*100))+'%':game.battlefield.suppression>0?'DEFENSE OFFLINE '+Math.ceil(game.battlefield.suppression/GAME_SPEED)+'s':game.battlefield.alert>0?'ALERT ×1.25 '+Math.ceil(game.battlefield.alert/GAME_SPEED)+'s':'FIELD '+game.battlefield.stageDestroyed+'/2 · '+game.battlefield.stageEscaped+' ESCAPED';
  fieldLabel.classList.toggle('alert',game.battlefield.alert>0||!!activeField&&fieldDamagePhase(activeField.hp,activeField.maxHp)===2);
  const missionLabel=el('mission-status'),mission=game.sectorMission;
  missionLabel.hidden=game.mode!=='campaign'||!mission.active;
  if(mission.active){const objective=game.nodes.find(n=>n.id===mission.targetId&&!n.dead);
    missionLabel.textContent='MISSION '+mission.name+' · '+Math.ceil(Math.max(0,mission.timeLeft)/GAME_SPEED)+'s'+(objective?' · '+Math.ceil(Math.max(0,objective.hp)/objective.maxHp*100)+'%':'');
    missionLabel.classList.toggle('danger',mission.route==='intercept');}

  el('focus-caption').textContent=game.weapon==='homing'?'LOCK '+game.locks.filter(l=>l.progress>=1).length:game.weapon==='laser'?'貫通強化':'集中射撃';
  el('hull').innerHTML=Array.from({length:4},(_,i)=>'<i'+(i>=game.hull?' class="empty"':'')+'></i>').join('');
  el('hull').setAttribute('aria-label','残り耐久 '+game.hull);
  el('sector').textContent=game.mode==='caravan'?'残り '+Math.max(0,Math.ceil(120-game.totalTime)).toString().padStart(3,'0')+' s':'SECTOR '+String(game.stage+1).padStart(2,'0')+' / '+String(STAGES.length).padStart(2,'0');
  el('progress').style.width=Math.min(100,game.mode==='caravan'?game.totalTime/120*100:game.time/STAGES[game.stage].duration*100)+'%';
  el('weapon-name').textContent=game.weapon.toUpperCase();el('power-level').textContent=Array.from({length:4},(_,i)=>i<game.power?'▰':'▱').join(' ');
  el('bombs').textContent=game.energy>=100?'READY':game.bombs.toString().padStart(2,'0');
  el('nova-ready').textContent=game.overdrive>0?'BOOST':game.energy>=100?'OVERDRIVE':'NOVA';
  el('nova-button').classList.toggle('ready',game.energy>=100);el('nova-button').classList.toggle('unavailable',game.bombs===0&&game.energy<100);
  el('energy').style.width=game.energy+'%';const boss=game.boss,mini=game.encounter;
  el('boss-hud').hidden=(!boss||boss.dead)&&!mini||game.state==='result'||game.state==='title';
  const bossFormLabel=el('boss-form');bossFormLabel.hidden=!boss||boss.form==='standard';
  if(boss){bossFormLabel.textContent=BOSS_FORM_NAMES[boss.form];bossFormLabel.classList.toggle('overcharged',boss.form==='overcharged');el('boss-pattern').textContent=game.attackName();el('boss-hud').classList.toggle('exposed',boss.rest);el('boss-name').textContent=STAGES[game.stage].boss;el('boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';el('boss-percent').textContent=Math.max(0,Math.ceil(boss.hp/boss.maxHp*100))+'%';el('parts-status').textContent=boss.parts.map((p,i)=>(i===0?'L':'R')+' '+(p>0?'ACTIVE':'DESTROYED')).join(' / ')+(game.mode==='campaign'?' / '+Math.max(0,Math.ceil(90-boss.encounterTime))+'s':'');}
  else if(mini){const guarded=game.nodes.some(n=>n.attach==='mini'&&!n.dead);el('boss-hud').classList.toggle('exposed',!guarded);el('boss-name').textContent=ENCOUNTERS[game.stage].mini;el('boss-pattern').textContent=guarded?'ESCORT SHIELD / 護衛を壊すと本体が露出':'MIDBOSS / 集中射撃で突破';el('boss-fill').style.width=Math.max(0,mini.hp/mini.maxHp*100)+'%';el('boss-percent').textContent=Math.max(0,Math.ceil(mini.hp/mini.maxHp*100))+'%';el('parts-status').textContent=(guarded?'ESCORT ACTIVE':'CORE EXPOSED')+' / 撤退まで '+Math.max(0,Math.ceil((22-mini.age)/GAME_SPEED))+'s';}
  const cue=stageCue(game),stage=STAGES[game.stage],playing=game.state==='playing';
  const panel=el('stage-cue');panel.hidden=!cue;
  el('cinematic-frame').hidden=!cue&&game.state!=='transition'||cue?.kind==='radio';
  el('sector-strip').hidden=!playing||!!boss||!!mini;el('sector-strip').style.setProperty('--world-color','#'+stage.color.toString(16).padStart(6,'0'));
  el('district').textContent=zoneAt(game.stage,stageDistance(game.time)).toUpperCase().replaceAll('-',' ');
  el('sector-badge').style.backgroundPosition=(game.stage*20)+'% 0%';
  if(cue){
    panel.className='stage-cue '+cue.kind;panel.style.setProperty('--world-color','#'+stage.color.toString(16).padStart(6,'0'));
    panel.style.opacity=String(Math.min(1,cue.progress*7,(1-cue.progress)*7));
    el('cue-label').textContent=cue.title;el('cue-text').textContent=cue.text;el('cue-progress').style.width=cue.progress*100+'%';
    el('radio-bars').hidden=cue.kind!=='radio';Array.from(el('radio-bars').children).forEach((bar,i)=>(bar as HTMLElement).style.transform='scaleY('+( .25+Math.abs(Math.sin(game.visualTime*11+i*.85))*.75)+')');
    if(cue.key!==lastCueKey){lastCueKey=cue.key;if(cue.kind==='radio')audio.event({type:'radio'});}
  }
  if(now>messageUntil)el('message').classList.remove('show');if(now>toastUntil)el('toast').classList.remove('show');if(now>tipUntil)el('touch-tip').hidden=true;
}
function scorePopup(text:string,x:number,y:number,type='score'){
  if(popups.length>=14){popups.shift()!.element.remove();}
  const element=document.createElement('span');element.className='score-popup '+(text.startsWith('LOCK')?'lock':type);element.textContent=text;el('score-popups').append(element);popups.push({element,x,y,at:performance.now()});
}
function drawPopups(now:number){
  for(let i=popups.length-1;i>=0;i--){const p=popups[i],age=(now-p.at)/1000;if(age>1){p.element.remove();popups.splice(i,1);continue;}
    const pos=view.worldToScreen(p.x,p.y);p.element.style.left=pos.x+'px';p.element.style.top=(pos.y-age*28)+'px';p.element.style.opacity=String(Math.min(1,(1-age)*2.8));}
}
function events(){
  for(const e of game.drainEvents()){
    view.event(e);audio.event(e.type==='shot'?{...e,x:game.player.x}:e,game.weapon);
    if(e.type==='score'||e.type==='medal'){scorePopup(e.type==='medal'?'MEDAL +'+e.value:e.text||'',e.x??0,e.y??0,e.type);continue;}
    if(e.type==='stage'){lastCueKey='';el('message').classList.remove('show');}
    else if(e.type==='warning')el('touch-tip').hidden=true;
    else if(e.type==='bosskill')showMessage(game.stage===STAGES.length-1&&game.mode==='campaign'?'STAR CORE RECOVERED':'SECTOR CLEAR',game.mode==='campaign'&&game.stage<STAGES.length-1?'TARGET DESTROYED / HULL +1':'TARGET DESTROYED',1.3);
    else if(e.type==='phase')showMessage('PHASE '+String(e.value??2).padStart(2,'0'),'ATTACK PATTERN SHIFT',.8,true);
    else if(e.type==='midboss'){el('touch-tip').hidden=true;}
    else if(e.type==='midkill')showMessage('MIDBOSS BREAK','SUPPLY DROPPED / 補給を回収',1.0);
    else if(e.type==='fieldclear')showMessage('BATTLEFIELD CHAIN',e.text||'STRATEGIC TARGET DESTROYED',1.4);
    else if(e.type==='fieldrisk')showMessage('ALERT ESCALATED',e.text||'REINFORCEMENTS INBOUND',1.4,true);
    else if(e.type==='fieldfracture')toast(e.text||'ARMOUR FRACTURED');
    else if(e.type==='fieldcritical')toast('CORE EXPOSED / 攻撃を集中');
    else if(e.type==='fieldcollapse')toast(e.text||'STRUCTURE COLLAPSE');
    else if(e.type==='terrainroute')showMessage(e.color===0xff986d?'DANGER CORRIDOR':'SALVAGE CORRIDOR',e.text||'BATTLEFIELD SHIFT',1.7,e.color===0xff986d);
    else if(e.type==='terrainbreak')scorePopup('HAZARD CLEAR +650',e.x??0,e.y??0,'score');
    else if(e.type==='terrainflank')toast(e.text||'HOSTILE FLANK');
    else if(e.type==='missionstart')showMessage('SECTOR OPERATION',e.text||'PRIORITY TARGET',1.8,e.color===0xffa572);
    else if(e.type==='missionclear')showMessage('MISSION COMPLETE',e.text||'BOSS DEFENSE REDUCED',1.8);
    else if(e.type==='missionfail')showMessage('MISSION FAILED',e.text||'BOSS DEFENSE REINFORCED',1.8,true);
    else if(e.type==='bossform')showMessage('BOSS EVOLUTION',e.text||'MORPHING ARMATURE',1.8,e.color===0xff9762);
    else if(e.type==='bosstransform')showMessage('PHASE TRANSFORMATION',e.text||'CORE ALTERED',1.4,e.color===0xff9762);
    else if(e.type==='bossreinforce')toast(e.text||'LASER GRID ACTIVATED');
    else if(e.type==='missionsupport')toast(e.text||'ESCORT INBOUND');
    else if(e.type==='finish')continue;
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
  if(game.state!==lastState){lastState=game.state;if(game.state==='result')result();else screens();}
  events();audio.update(game.state,game.stage,!!game.boss&&!game.boss.dead||!!game.encounter&&!game.encounter.dead);view.draw(game,dt*GAME_SPEED,frameMs);drawPopups(now);updateUI(now);
  requestAnimationFrame(loop);
}
async function boot(){
  try{
    el('boot-text').textContent='動く水面と機体を読み込み中';
    await loadVisualAssets();
    const rendererMode=new URLSearchParams(location.search).get('renderer');
    try{
      view=rendererMode==='canvas'?new CanvasView(canvas):new View(canvas);
      await view.init(rendererMode==='webgl');view.draw(game,0,16.67);
    }catch(error){
      console.warn('GPU unavailable; selecting the compatibility view',error);
      const next=document.createElement('canvas');next.id='game';next.setAttribute('aria-label','NOVA STRIKE ゲーム画面');canvas.replaceWith(next);canvas=next;
      view=new CanvasView(canvas);await view.init();view.draw(game,0,16.67);
    }
    bindCanvas();ready=true;el('boot').hidden=true;screens();
    new ResizeObserver(()=>view.resize()).observe(el('frame'));
    window.addEventListener('pageshow',e=>{if(e.persisted){clearInput();lastTime=performance.now();accumulator=0;}});
    Object.assign(window,{__nova:{game,view,audio,start,pause,resume,snapshot:()=>({...game.snapshot(),render:view.getDiagnostics(),sound:audio.diagnostics()})}});
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
