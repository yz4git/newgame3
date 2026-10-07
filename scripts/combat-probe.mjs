// Fixed-input combat measurements in real seconds. No artificial damage is applied.
import {Game,STEP} from '../app/sim.ts';
import {spawnMiniboss} from '../app/encounters.ts';
import {fileURLToPath} from 'node:url';

export function isolated(stage=0,weapon='laser',power=1){
 const g=new Game();g.start('campaign','normal',stage);g.waveIndex=999;
 g.encounterSeen={stage:true,mini:true};g.battlefield.seen=[true,true];g.invulnerable=1000;g.weapon=weapon;g.power=power;
 return g;
}
export function emittedDamage(weapon,power,focus,boost=false){
 const g=isolated(0,weapon,power);g.overdrive=boost?1000:0;
 // Locked missiles need a genuine surviving target for the acquisition bonus.
 if(weapon==='homing'&&focus){const e=g.spawn('tank',0,10);e.hp=e.maxHp=1e9;g.locks=[{id:e.id,x:0,y:10,progress:1}];}
 let damage=0,shots=0;
 const projectile=g.projectile.bind(g);g.projectile=(...args)=>{if(!args[4]){damage+=args[5];shots++;}return projectile(...args);};
 for(let i=0;i<180;i++){
  if(g.enemies.length){g.enemies[0].x=g.enemies[0].origin=0;g.enemies[0].y=10;}
  g.update(STEP,{x:0,y:0,focus});g.drainEvents();
 }
 return {damagePerSecond:Math.round(damage/3*100)/100,shotsPerSecond:Math.round(shots/3*100)/100};
}
export function enemyFight(kind,weapon,power,focus=true){
 const g=isolated(0,weapon,power),e=g.spawn(kind,0,10);let frames=0,volleys=0;
 for(;frames<360&&!e.dead;frames++){
  g.update(STEP,{x:0,y:0,focus,target:{x:e.x,y:-9}});
  volleys+=g.drainEvents().filter(v=>v.type==='enemyshot'&&v.source===e.id).length;
 }
 return {seconds:Math.round(frames*STEP*100)/100,killed:e.hp<=0,volleys};
}
export function minibossFight(stage,weapon,power,focus=true){
 const g=isolated(stage,weapon,power);spawnMiniboss(g);const m=g.encounter;
 m.age=3.1;m.y=8.8;let frames=0,volleys=0;
 for(;frames<600&&g.encounter;frames++){
  g.update(STEP,{x:0,y:0,focus,target:{x:m.x,y:-9}});
  volleys+=g.drainEvents().filter(v=>v.type==='enemyshot'&&v.source===m.id).length;
 }
 return {seconds:Math.round(frames*STEP*100)/100,killed:m.dead,volleys,hpRemaining:Math.max(0,Math.round(m.hp))};
}
export function bossFight(stage,weapon,power,focus=true,holdPower=false){
 const g=isolated(stage,weapon,power);g.spawnBoss();const b=g.boss;b.age=3;b.y=9;
 let frames=0,volleys=0;const attacks=new Set(),phases=new Set([1]);
 for(;frames<60*91&&g.state==='playing'&&!b.dead;frames++){
  if(holdPower)g.power=power;
  g.update(STEP,{x:0,y:0,focus,target:{x:b.x,y:-9}});
  phases.add(b.phase);attacks.add(b.attack);
  volleys+=g.drainEvents().filter(v=>v.type==='enemyshot'&&v.source===b.id).length;
 }
 return {seconds:Math.round(frames*STEP*100)/100,killed:b.dead,attacks:[...attacks],phases:[...phases],volleys,powerAtEnd:g.power};
}
export function measureCombat(){
 const weapons=['wide','laser','homing'];
 return {
  conditions:'Normal; fixed 60 Hz; seconds are real time; invulnerable tracking player at y=-9, no NOVA; boss entry skipped, miniboss starts at age 3.1. Perfect tracking tests collision/progression, not human survivability. Emitted damage includes every projectile before misses and piercing.',
  output:weapons.flatMap(weapon=>[1,2,3,4].flatMap(power=>[false,true].map(focus=>({weapon,power,focus,...emittedDamage(weapon,power,focus)})))),
  enemy:weapons.flatMap(weapon=>[1,4].flatMap(power=>['drone','fighter','cruiser','corvette'].map(kind=>({weapon,power,kind,...enemyFight(kind,weapon,power)})))),
  miniboss:weapons.flatMap(weapon=>[1,4].flatMap(power=>[0,2,5].map(stage=>({weapon,power,stage,...minibossFight(stage,weapon,power)})))),
  boss:weapons.flatMap(weapon=>[1,4].flatMap(power=>[0,2,5].map(stage=>({weapon,power,stage,...bossFight(stage,weapon,power)})))),
  overdrive:weapons.map(weapon=>({weapon,power:4,focus:true,...emittedDamage(weapon,4,true,true)})),
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(measureCombat(),null,2));
