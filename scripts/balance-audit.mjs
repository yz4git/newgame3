import {Game,STEP,STAGES,W} from '../app/sim.ts';
import {writeFile,mkdir} from 'node:fs/promises';
// Deterministic simulation uses the exact runtime Game.update for waves, aiming, loot, boss and player hits.
// Pilot policies model broad skill bands, not observed human win rates.
const clamp=(v,l,h)=>Math.min(h,Math.max(l,v));
function pilot(g,skill,step){
 if(skill==='static')return {x:0,y:0,focus:false};
 const p=g.player;
 const candidates=[
 ...g.nodes.filter(n=>!n.dead&&n.y>p.y+2&&n.y<16).map(n=>({x:n.x,y:n.y,priority:n.attach==='mission'?1:n.attach==='field'?2:n.attach==='mini'?3:n.attach==='stage'?5:6})),
 ...(g.encounter?[{x:g.encounter.x,y:g.encounter.y,priority:4}]:[]),
 ...(g.boss&&!g.boss.dead?[{x:g.boss.x,y:g.boss.y-1,priority:7}]:[]),
 ...g.enemies.filter(e=>!e.dead&&e.y>p.y+2&&e.y<15).map(e=>({x:e.x,y:e.y,priority:e.kind==='carrier'?8:12}))
 ];
 candidates.sort((a,b)=>a.priority-b.priority||Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
 let x=candidates[0]?.x??Math.sin(step*.02)*3;
 let y=-10.2;
 if(skill==='veteran'){
  const incoming=g.bullets.filter(b=>b.enemy&&!b.dead&&b.vy<0&&b.y>p.y-1.8&&b.y<p.y+11);
  const values=[clamp(x,-9,9),p.x,-7,-4,0,4,7];
  let best=Infinity,bx=x;
  for(const lane of values){
   let cost=Math.abs(lane-x)*.16+Math.abs(lane-p.x)*.032;
   for(const b of incoming){
    const travel=(y-b.y)/(b.vy||-1);
    if(travel<0||travel>2.5)continue;
    const place=b.x+b.vx*travel;
    const gap=Math.abs(place-lane);
    if(gap<1.0)cost+=(1-gap)*8;else if(gap<1.7)cost+=(1.7-gap)*.8;
   }
   if(cost<best){best=cost;bx=lane;}
  }
  x=bx;
 }
 return {x:0,y:0,focus:skill==='veteran'&&g.weapon==='laser',target:{x:clamp(x,-W+.1,W-.1),y}};
}
function run(stage,ship,skill,difficulty){
 const g=new Game();g.start('campaign',difficulty,stage,ship);
 if(skill!=='static')g.cycleWeapon(); // Actual key: WIDE -> LASER.
 let seenBoss=false,bossAt=0,damage=0,events={},shotsAt=[],pilotTransitions=0;
 let elapsed=0,prevHull=g.hull,lastX=g.player.x;
 const ceiling=115*60;
 for(let i=0;i<ceiling;i++){
  if(g.state==='result')break;
  if(skill==='veteran'&&g.state==='playing'&&g.novaTime<=0&&(g.boss&&g.boss.hp<g.boss.maxHp*.55&&g.bombs>=1||g.hull===1&&g.bombs>0)){
   g.nova();
  }
  const ctrl=pilot(g,skill,i);g.update(STEP,ctrl);
  if(g.hull<prevHull)damage+=prevHull-g.hull;prevHull=g.hull;
  if(g.boss&&!seenBoss){seenBoss=true;bossAt=i/60;}
  if(Math.abs(g.player.x-lastX)>1)pilotTransitions++;lastX=g.player.x;
  for(const e of g.drainEvents()){events[e.type]=(events[e.type]||0)+1;if(e.type==='bosskill')shotsAt.push(i/60);}
  elapsed=(i+1)/60;
 }
 return {stage,ship,skill,difficulty,elapsed:Math.round(elapsed*10)/10,state:g.state,won:g.won,
   reachedBoss:seenBoss,bossAt:Math.round(bossAt*10)/10,damage,hull:g.hull,
   power:g.power,score:g.score,kills:g.kills,
   fieldClears:g.battlefield.destroyed,fieldMisses:g.battlefield.escaped,
   missionSuccess:g.sectorMission.totalSuccess,missionFail:g.sectorMission.totalFailed,
   form:g.boss?.form??null,bombs:g.bombs,events:Object.fromEntries(Object.entries(events).filter(([k])=>['bosskill','hit','damage','midkill','fieldclear','fieldrisk','missionstart','missionfail','missionclear','power','repair','nova'].includes(k))),
   pilotTransitions};
}
const rows=[];
for(const skill of ['static','guided','veteran'])for(const ship of ['striker','falcon','bulwark'])
for(let stage=0;stage<6;stage++)rows.push(run(stage,ship,skill,'normal'));
for(const difficulty of ['casual','expert'])for(const skill of ['guided','veteran'])for(let stage=0;stage<6;stage++)rows.push(run(stage,'striker',skill,difficulty));
const by={};
for(const r of rows){const k=r.skill+' / '+r.ship+' / '+r.difficulty;const a=by[k]??={games:0,wins:0,deaths:0,timeouts:0,bossSeen:0,bossKills:0,damage:0,clears:0,misses:0,missions:0,missionFails:0,score:0,power:0,elapsed:0,forms:{},ranges:[]};
 a.games++;a.wins+=r.won?1:0;a.deaths+=r.state==='result'&&!r.won&&r.hull<=0?1:0;a.timeouts+=r.events.bosskill?0:r.reachedBoss&&r.state==='result'&&!r.won?1:0;
 a.bossSeen+=r.reachedBoss?1:0;a.bossKills+=r.events.bosskill||0;a.damage+=r.damage;a.clears+=r.fieldClears;a.misses+=r.fieldMisses;a.missions+=r.missionSuccess;a.missionFails+=r.missionFail;a.score+=r.score;a.power+=r.power;a.elapsed+=r.elapsed;
 a.ranges.push(r.stage+':'+(r.won?'W':r.reachedBoss?'B':r.state==='playing'?'P':'L')+':'+r.fieldClears+'/'+r.missionSuccess+':'+r.power);
}
await mkdir('balance-review',{recursive:true});
await writeFile('balance-review/audit.json',JSON.stringify({summary:by,runs:rows},null,2));
console.log('BALANCE_REPORT:'+JSON.stringify({summary:by,runs:rows}));
