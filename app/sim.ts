export const W = 10.2;
export const BOTTOM = -14.4;
export const TOP = 14.8;
export const STEP = 1 / 60;
export const GAME_SPEED = 2.25;
import {STAGES} from './stages.ts';
import {updateBossPattern,bossCoreDamage} from './boss-patterns.ts';
import {updateEncounters} from './encounters.ts';
import {initialBattlefield,nextBattlefieldStage,updateBattlefield,damageBattlefieldNode,type BattlefieldState} from './battlefield.ts';
import {SHIPS,type ShipClass} from './ship-config.ts';
import {WEAPON_BALANCE,PLAYER_BALANCE} from './player-balance.ts';
import {ENCOUNTERS,BOSS_ATTACKS,encounterTimes,type CombatNode,type Miniboss,type Threat} from './encounter-design.ts';
export {STAGES} from './stages.ts';
export {SHIPS} from './ship-config.ts';
export type {ShipClass} from './ship-config.ts';
export type Weapon = 'wide' | 'laser' | 'homing';
export type Mode = 'campaign' | 'caravan' | 'bossrush';
export type Difficulty = 'casual' | 'normal' | 'expert';
export type State = 'title' | 'playing' | 'paused' | 'transition' | 'result';
export type Kind = 'drone' | 'dart' | 'fighter' | 'tank' | 'cruiser' | 'carrier' | 'relic' | 'weaver' | 'lancer' | 'interceptor' | 'bomber' | 'corvette' | 'sentinel' | 'strider';
export interface Enemy {
  id: number; kind: Kind; x: number; y: number; origin: number; radius: number;
  hp: number; maxHp: number; age: number; shoot: number; flash: number; group: number;
  phase: number; dead: boolean; ground: boolean; pattern: number;
  aimX: number; aimY: number; charging: boolean; volley: number; spawnY: number; recoil:number;
}
export interface Bullet {
  id: number; x: number; y: number; px: number; py: number; vx: number; vy: number;
  radius: number; damage: number; enemy: boolean; homing: boolean; weapon: Weapon;
  age: number; dead: boolean; grazed: boolean; hits: number[]; color: number;
  source?: number; targetId?: number; turn?: number; accel?: number; trail?: {x:number;y:number}[];
  shape?:'missile'|'diamond'; ricochets?:number;
}
export interface Pickup { id: number; x: number; y: number; type: 'power' | 'medal' | 'repair'; age: number; dead: boolean; }
export interface Boss {
  id: number; x: number; y: number; age: number; encounterTime: number; hp: number; maxHp: number;
  parts: number[]; maxPart: number; shoot: number; attack: number; cycle: number;
  warning: number; beam: number; beamX: number; dead: boolean; flash: number;
  phase: number; rest: boolean; spread: number; recoil:number; patternTime:number; guard:number; heat:number;
}
export interface Lock { id: number; progress: number; x: number; y: number; }
export interface GameEvent { type: string; x?: number; y?: number; size?: number; color?: number; text?: string; value?: number; source?:number; kind?:Kind|'player'|'boss'; }
export interface Input { x: number; y: number; target?: { x: number; y: number }; focus: boolean; }
interface Wave { at: number; kind: Kind; count: number; formation: number; side?: number; }
const DATA: Record<Kind, { hp: number; radius: number; score: number; speed: number }> = {
  drone: { hp: 3.0, radius: .72, score: 120, speed: 7.0 },
  dart: { hp: 4.5, radius: .72, score: 180, speed: 7.5 },
  fighter: { hp: 13, radius: 1.0, score: 360, speed: 3.4 },
  tank: { hp: 19, radius: 1.02, score: 500, speed: 4.4 },
  cruiser: { hp: 64, radius: 1.85, score: 1500, speed: 2.7 },
  carrier: { hp: 11, radius: 1.0, score: 400, speed: 3.8 },
  relic: { hp: 28, radius: .9, score: 3500, speed: 4.4 },
  weaver: { hp: 22, radius: 1.1, score: 700, speed: 2.8 },
  lancer: { hp: 15, radius: .9, score: 600, speed: 3.3 },
  interceptor: { hp: 9, radius: .9, score: 400, speed: 5.8 },
  bomber: { hp: 26, radius: 1.35, score: 850, speed: 2.9 },
  corvette: { hp: 38, radius: 1.5, score: 1100, speed: 2.8 },
  sentinel: { hp: 18, radius: 1.0, score: 650, speed: 3.0 },
  strider: { hp: 24, radius: 1.05, score: 700, speed: 4.4 },
};
function waves(stage: number, mode: Mode): Wave[] {
  if(mode==='bossrush')return [];
  const style=STAGES[stage].bossStyle;
  // Teach a role, combine it, release pressure, then resupply.
  const rows: Wave[] = [
    {at:2,kind:'drone',count:5,formation:0}, {at:5,kind:'carrier',count:1,formation:1},
    {at:7.5,kind:'drone',count:6,formation:4}, {at:11,kind:'dart',count:5,formation:1},
    {at:14.5,kind:'tank',count:2,formation:0}, {at:16,kind:'relic',count:1,formation:3},
    {at:18,kind:'drone',count:7,formation:1}, {at:22,kind:'fighter',count:2,formation:0},
    {at:25,kind:'carrier',count:1,formation:2}, {at:28,kind:'dart',count:6,formation:2},
    {at:30,kind:'lancer',count:1,formation:3},
    {at:32,kind:'tank',count:3,formation:0}, {at:35,kind:'cruiser',count:1,formation:0},
    {at:37,kind:'weaver',count:1,formation:3,side:-1},
    {at:39,kind:'drone',count:7,formation:4}, {at:43,kind:'relic',count:1,formation:3},
    {at:44,kind:'fighter',count:3,formation:0}, {at:48,kind:'carrier',count:1,formation:1},
    {at:50,kind:'dart',count:7,formation:2}, {at:54,kind:'tank',count:2,formation:0},
    {at:57,kind:'drone',count:8,formation:1},
  ];
  if(style===1){
    for(const r of rows)if(r.kind==='tank')r.kind='weaver';
    rows.push({at:20,kind:'weaver',count:1,formation:3,side:1},{at:53,kind:'lancer',count:2,formation:0});
  }
  if(style===2){
    for(const r of rows)if(r.kind==='fighter')r.kind='lancer';
    rows.push({at:20,kind:'weaver',count:2,formation:0},{at:47,kind:'weaver',count:1,formation:3});
  }
  if (stage >= 1 || mode === 'caravan') rows.push(
    {at:59,kind:'cruiser',count:2,formation:0}, {at:64,kind:'dart',count:8,formation:2},
    {at:68,kind:'carrier',count:1,formation:1},
  );
  if (stage >= 2 || mode === 'caravan') rows.push(
    {at:71,kind:'fighter',count:3,formation:0}, {at:75,kind:'drone',count:8,formation:1},
    {at:79,kind:'relic',count:1,formation:3},
  );
  if (mode === 'caravan') rows.push(
    {at:82,kind:'dart',count:8,formation:2}, {at:86,kind:'cruiser',count:2,formation:0},
    {at:90,kind:'carrier',count:1,formation:1},
  );
  // Replace repeated squads with distinct roles while retaining supplies and recovery gaps.
  for(const row of rows){
    if(row.at===11){row.kind='interceptor';row.count=stage===2?3:4;row.formation=5;}
    if(row.at===14.5){row.kind='strider';row.count=stage===4?3:2;}
    if(row.at===35){row.kind='corvette';row.count=stage===1?2:1;}
    if(row.at===37){row.kind='sentinel';row.count=stage===3?2:1;}
    if(row.at===44){row.kind='bomber';row.count=stage===0?1:2;row.formation=0;}
    if(row.at===64){row.kind=stage%2?'interceptor':'dart';row.formation=6;row.count=5;}
    if(row.at===71){row.kind=stage===5?'corvette':stage===4?'sentinel':'fighter';row.count=2;}
  }
  if(stage===0)rows.push({at:49,kind:'cruiser',count:1,formation:3},{at:21,kind:'weaver',count:1,formation:3,side:1});
  if(mode==='campaign'){
    const t=encounterTimes(stage,STAGES[stage].duration).mini;
    const keep=rows.filter(r=>r.at<t-2||r.at>t+23);
    keep.push({at:t+24,kind:'bomber',count:1,formation:0},{at:t+25.5,kind:'corvette',count:1,formation:0},{at:t+27,kind:'sentinel',count:1,formation:3},{at:t+29,kind:'carrier',count:1,formation:1});
    return keep.filter(r=>r.at<STAGES[stage].duration-2).sort((a,b)=>a.at-b.at);
  }
  return rows.sort((a,b)=>a.at-b.at);
}
export function segmentDistance2(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1)));
  return (ax+dx*t-x)**2+(ay+dy*t-y)**2;
}
export function turnToward(vx:number,vy:number,dx:number,dy:number,maxTurn:number,speed=Math.hypot(vx,vy)) {
  const angle=Math.atan2(vy,vx),target=Math.atan2(dy,dx);
  const delta=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));
  const next=angle+Math.max(-maxTurn,Math.min(maxTurn,delta));
  return {vx:Math.cos(next)*speed,vy:Math.sin(next)*speed};
}
export function bossPartPosition(b:Boss,index:number) {
  const side=index===0?-1:1;
  return {x:b.x+side*(3+b.spread),y:b.y-b.spread*.65};
}
export class Game {
  state: State = 'title'; mode: Mode = 'campaign'; difficulty: Difficulty = 'normal'; battlefield:BattlefieldState=initialBattlefield();shipClass:ShipClass='striker';
  stage=0; time=0; totalTime=0; visualTime=0; score=0; kills=0; chain=0; maxChain=0;
  chainTime=0; multiplier=1; formations=0; relics=0; grazes=0;
  locks:Lock[]=[];lockKills=0;resonances=0;cancelled=0;medalStreak=0;bestMedal=0;pointBlanks=0;
  power=1; weapon: Weapon='wide'; hull=3; bombs=3; energy=0; invulnerable=0;
  overdrive=0; novaTime=0; shotTimer=0; transitionTime=0; won=false;failureReason:'hull'|'timeout'|null=null; resumeState: State='playing';
  player={x:0,y:-10.5,vx:0,vy:0,focus:false};
  enemies: Enemy[]=[]; bullets: Bullet[]=[]; pickups: Pickup[]=[]; boss: Boss | null=null;
  encounter:Miniboss|null=null;nodes:CombatNode[]=[];threats:Threat[]=[];encounterSeen={stage:false,mini:false};
  events: GameEvent[]=[]; private schedule: Wave[]=[]; private waveIndex=0; private uid=0;
  private seed=2026; private groups=new Map<number,{total:number;kills:number;escaped:boolean}>();
  private volley=0; private lastExtend=0;
  private random() { let x=this.seed|0; x^=x<<13; x^=x>>>17; x^=x<<5; this.seed=x; return (x>>>0)/4294967296; }
  emit(type: string, fields: Omit<GameEvent,'type'>={}) { if(this.events.length<600)this.events.push({type,...fields}); }
  drainEvents() { const r=this.events; this.events=[]; return r; }
  start(mode: Mode='campaign', difficulty: Difficulty='normal',startStage=0,shipClass:ShipClass='striker') {
    this.mode=mode; this.difficulty=difficulty;this.shipClass=shipClass;this.battlefield=initialBattlefield(); this.stage=mode!=='campaign'?0:Math.max(0,Math.min(STAGES.length-1,Math.floor(startStage)||0)); this.time=0; this.totalTime=0;this.visualTime=0;
    this.score=0; this.kills=0; this.chain=0; this.maxChain=0; this.chainTime=0; this.multiplier=1;
    this.formations=0; this.relics=0; this.grazes=0; this.power=1; this.hull=difficulty==='casual'?4:3;
    this.locks=[];this.lockKills=0;this.resonances=0;this.cancelled=0;this.medalStreak=0;this.bestMedal=0;this.pointBlanks=0;
    this.hull=Math.max(1,Math.min(4,this.hull+SHIPS[this.shipClass].hullOffset));
    if(mode==='bossrush')this.power=3;
    this.bombs=3; this.energy=0; this.invulnerable=3; this.overdrive=0; this.novaTime=0;this.transitionTime=0;
    this.weapon='wide'; this.player={x:0,y:-10.5,vx:0,vy:0,focus:false};
    this.enemies=[]; this.bullets=[]; this.pickups=[]; this.events=[]; this.boss=null;this.encounter=null;this.nodes=[];this.threats=[];this.encounterSeen={stage:false,mini:false};
    this.groups.clear(); this.waveIndex=0; this.uid=0; this.seed=2026; this.volley=0;
    this.lastExtend=0; this.won=false;this.failureReason=null; this.shotTimer=0; this.schedule=waves(this.stage,mode);
    this.state='playing'; this.emit('stage',{text:mode==='caravan'?'120 SECOND CARAVAN':STAGES[this.stage].name});
  }
  pause() { if(this.state==='playing'||this.state==='transition'){this.resumeState=this.state;this.state='paused';} }
  resume() { if(this.state==='paused')this.state=this.resumeState; }
  cycleWeapon() {
    const list: Weapon[]=['wide','laser','homing']; this.weapon=list[(list.indexOf(this.weapon)+1)%3];
    this.locks=[];
    this.emit('weapon',{text:this.weapon.toUpperCase()});
  }
  addScore(amount: number) {
    this.score+=Math.round(amount);
    const ext=Math.floor(this.score/80000);
    if(ext>this.lastExtend){this.lastExtend=ext;this.hull=Math.min(4,this.hull+1);this.emit('extend',{text:'80,000 BONUS / HULL +1'});}
  }
  nova() {
    if(this.state!=='playing'||this.novaTime>0)return false;
    if(this.energy>=100){this.energy=0;this.overdrive=6;this.emit('overdrive',{text:'OVERDRIVE / DAMAGE ×'+PLAYER_BALANCE.overdriveMultiplier});}
    else if(this.bombs>0)this.bombs--;else return false;
    this.novaTime=1.2; this.invulnerable=Math.max(this.invulnerable,2.3);
    let converted=0; for(const b of this.bullets)if(b.enemy&&!b.dead){b.dead=true;converted++;}
    this.cancelled+=converted;
    this.addScore(converted*35); this.energy=Math.min(100,this.energy+converted*.3);
    for(const e of [...this.enemies])if(!e.dead)this.damageEnemy(e,70,'nova');
    if(this.boss&&!this.boss.dead){this.boss.hp-=PLAYER_BALANCE.novaBossDamage;for(let i=0;i<2;i++)this.damagePart(i,PLAYER_BALANCE.novaPartDamage);if(this.boss.hp<=0)this.killBoss();}
    for(const t of this.threats)t.dead=true;
    for(const n of [...this.nodes])this.damageNode(n,n.attach==='field'?22:70);if(this.encounter)this.damageMiniboss(PLAYER_BALANCE.novaMinibossDamage);
    this.emit('nova',{x:this.player.x,y:this.player.y,size:18}); return true;
  }
  spawn(kind: Kind, x: number, y: number, group=0, pattern=0): Enemy {
    const d=DATA[kind],hp=d.hp*(this.difficulty==='expert'?1.12:1);
    const e: Enemy={id:++this.uid,kind,x,y,origin:x,radius:d.radius,hp,maxHp:hp,age:0,
      shoot:1.1+this.random()*.8,flash:0,group,phase:this.random()*6.28,dead:false,
      ground:kind==='tank'||kind==='relic'||kind==='strider',pattern,aimX:0,aimY:0,charging:false,volley:0,spawnY:y,recoil:0};this.enemies.push(e);return e;
  }
  private wave(w: Wave) {
    const group=++this.uid;this.groups.set(group,{total:w.count,kills:0,escaped:false});
    const side=w.side??(this.waveIndex%2===0?1:-1);
    for(let i=0;i<w.count;i++){
      let x=0,y=18+i*.85;
      if(w.formation===0)x=(i-(w.count-1)/2)*(w.count<=3?5.3:2.9);
      if(w.formation===1){x=side*(6-i*.9);y=18+i*1.35;}
      if(w.formation===2){x=(i%2===0?-1:1)*(3.2+Math.floor(i/2)*.6);y=18+Math.floor(i/2)*1.7;}
      if(w.formation===3)x=side*7;
      if(w.formation===4){x=side*6;y=18+i*1.6;}
      if(w.formation===5){x=(i%2?1:-1)*(6.7+i*.25);y=18+i*1.8;}
      if(w.formation===6){x=(i%2?1:-1)*(4.7+i*.15);y=18+i*1.7;}
      this.spawn(w.kind,x,y,group,w.formation);
    }
    if(w.kind==='carrier')this.emit('supply',{text:'SUPPLY / 補給機を撃破'});
  }
  projectile(x: number,y: number,vx: number,vy: number,enemy: boolean,damage=1.7,homing=false,color=0xffa73b,extra:Partial<Bullet>={}) {
    if(this.bullets.length>720)return;
    this.bullets.push({id:++this.uid,x,y,px:x,py:y,vx,vy,radius:enemy?.24:.18,damage,
      enemy,homing,weapon:this.weapon,age:0,dead:false,grazed:false,hits:[],color,...extra});
  }
  aimed(x: number,y: number,speed: number,count=1,spread=.15,source=0,target:{x:number;y:number}=this.player,accel=0) {
    if(y<this.player.y+2||Math.hypot(this.player.x-x,this.player.y-y)<3.8)return;
    const a=Math.atan2(target.y-y,target.x-x);
    const scale=this.difficulty==='casual'?.84:this.difficulty==='expert'?1.22:1;
    for(let i=0;i<count;i++){const an=a+(i-(count-1)/2)*spread;this.projectile(x,y,Math.cos(an)*speed*scale,Math.sin(an)*speed*scale,true,1,false,accel?0xff7899:0xffb85f,{source,accel});}
  }
  fan(x:number,y:number,count:number,speed:number,angle:number,spacing:number,source:number,color=0xffc05b,turn=0){
    const scale=this.difficulty==='casual'?.82:this.difficulty==='expert'?1.15:1;
    if(y<this.player.y+2)return;
    for(let i=0;i<count;i++){
      const a=angle+(i-(count-1)/2)*spacing;
      this.projectile(x,y,Math.cos(a)*speed*scale,Math.sin(a)*speed*scale,true,1,false,color,{source,turn});
    }
  }
  private updateLocks(dt:number){
    if(this.weapon!=='homing'||!this.player.focus){this.locks=[];return;}
    const p=this.player;
    const targets=this.enemies.filter(e=>!e.dead&&e.y>p.y+.8&&e.y<16&&Math.abs(e.x-p.x)<4.8)
      .map(e=>({id:e.id,x:e.x,y:e.y}));
    const b=this.boss;if(b&&!b.dead&&b.y<16){
      targets.push({id:b.id,x:b.x,y:b.y-1});
      for(let i=0;i<2;i++)if(b.parts[i]>0)targets.push({id:b.id+100000+i,...bossPartPosition(b,i)});
    }
    for(const n of this.nodes)if(!n.dead&&n.y>p.y+.8)targets.push({id:n.id,x:n.x,y:n.y});if(this.encounter&&this.encounter.y<16)targets.push({id:this.encounter.id,x:this.encounter.x,y:this.encounter.y});
    targets.sort((a,b)=>(a.y-p.y)**2+(a.x-p.x)**2-((b.y-p.y)**2+(b.x-p.x)**2));
    const previous=new Map(this.locks.map(l=>[l.id,l]));
    this.locks=targets.slice(0,Math.min(4,this.power+1)).map(t=>{
      const before=previous.get(t.id)?.progress??0,progress=Math.min(1,before+dt/.42);
      if(before<1&&progress===1)this.emit('lock',{x:t.x,y:t.y});
      return {...t,progress};
    });
  }
  private fire() {
    const p=this.player,level=this.power,boost=(this.overdrive>0?PLAYER_BALANCE.overdriveMultiplier:1)*SHIPS[this.shipClass].damage;
    if(this.weapon==='wide'){
      const n=WEAPON_BALANCE.wide.pellets[level-1];
      for(let i=0;i<n;i++){
        const a=(i-(n-1)/2)*(p.focus?.045:.12);
        this.projectile(p.x+(i-(n-1)/2)*.19,p.y+.7,Math.sin(a)*53,Math.cos(a)*53,false,WEAPON_BALANCE.wide.damage*boost);
      }
    }else if(this.weapon==='laser'){
      const profile=WEAPON_BALANCE.laser;
      for(const s of [-1,1])this.projectile(p.x+s*.24,p.y+.8,0,72,false,(profile.baseDamage+level*profile.levelDamage)*boost*(p.focus?profile.focusMultiplier:1));
    }else{
      const n=Math.min(4,level+1);
      const profile=WEAPON_BALANCE.homing;
      const locked=this.locks.filter(l=>l.progress>=1);
      for(let i=0;i<n;i++){
        const lock=locked[(i+this.volley)%Math.max(1,locked.length)];
        this.projectile(p.x+(i-(n-1)/2)*.3,p.y+.6,(i-(n-1)/2)*12,34,false,(profile.baseDamage+level*profile.levelDamage)*boost*(lock?profile.lockMultiplier:1),true,0x81ffd4,{targetId:lock?.id,trail:[]});
      }
    }
    if(level===4&&this.volley%PLAYER_BALANCE.satelliteEvery===0)for(const s of [-1,1])this.projectile(p.x+s*1.45,p.y-.05,0,52,false,PLAYER_BALANCE.satelliteDamage*boost,true);
    if(++this.volley%3===0)this.emit('shot');
    this.shotTimer=WEAPON_BALANCE[this.weapon].interval;
  }
  damageEnemy(e: Enemy, damage: number,cause:'shot'|'nova'|'pulse'='shot') {
    if(e.dead)return;e.hp-=damage;e.flash=.08;
    if(e.hp>0){if(this.random()<.18)this.emit('hit',{x:e.x,y:e.y});return;}
    e.dead=true;this.kills++;this.chain++;this.maxChain=Math.max(this.maxChain,this.chain);
    this.chainTime=3.4;this.multiplier=Math.min(8,1+Math.floor(this.chain/8));
    const close=Math.hypot(e.x-this.player.x,e.y-this.player.y)<6.5&&e.y>this.player.y;
    const locked=cause==='shot'&&this.locks.some(l=>l.id===e.id&&l.progress>=1);
    if(close)this.pointBlanks++;if(locked)this.lockKills++;
    const value=Math.round(DATA[e.kind].score*this.multiplier*(close?1.5:1)*(locked?1.25:1)*(this.battlefield.alert>0?1.25:1));
    this.addScore(value);
    if(close||locked||e.radius>1.4)this.emit('score',{x:e.x,y:e.y,value,text:(locked?'LOCK ':close?'CLOSE ':'')+'+'+value});
    this.energy=Math.min(100,this.energy+(e.kind==='cruiser'?12:3.2));
    this.emit('explode',{x:e.x,y:e.y,size:e.radius,color:e.kind==='relic'?0xffdb66:0xff8650,source:e.id,kind:e.kind});
    if(e.kind==='cruiser'&&cause!=='nova'){
      this.resonances++;const radius=close?6.4:4.8;
      const converted=this.cancelBullets(e.x,e.y,radius);
      this.energy=Math.min(100,this.energy+converted*.7);
      this.emit('resonance',{x:e.x,y:e.y,size:radius,color:0xffd488,text:'REACTOR BREAK / '+converted+' BULLET CANCEL'});
      for(const other of this.enemies)if(!other.dead&&Math.hypot(other.x-e.x,other.y-e.y)<radius)this.damageEnemy(other,24,'pulse');
    }
    if(e.kind==='carrier')this.pickup('power',e.x,e.y);
    if(e.kind==='cruiser')this.pickup('repair',e.x,e.y);
    if(e.kind==='relic'){this.relics++;this.pickup('medal',e.x,e.y);this.emit('relic',{text:'SECRET CORE / +3,500 × CHAIN'});}
    if(e.group){
      const g=this.groups.get(e.group);
      if(g){g.kills++;if(g.kills===g.total&&!g.escaped&&g.total>=4){
        this.formations++;this.addScore(1000*this.multiplier);this.energy=Math.min(100,this.energy+8);
        this.emit('formation',{x:e.x,y:e.y,text:'FORMATION BREAK / +1,000 × CHAIN'});
        if(this.formations%2===0)this.pickup('power',e.x,e.y);else this.pickup('medal',e.x,e.y);
        this.groups.delete(e.group);
      }}
    }
  }
  pickup(type: Pickup['type'],x: number,y: number) {this.pickups.push({id:++this.uid,x,y,type,age:0,dead:false});}
  private cancelBullets(x:number,y:number,radius:number,source?:number){
    let count=0;for(const bullet of this.bullets)if(bullet.enemy&&!bullet.dead&&(source!==undefined?bullet.source===source:Math.hypot(bullet.x-x,bullet.y-y)<radius)){
      bullet.dead=true;count++;if(count<=35)this.emit('collect',{x:bullet.x,y:bullet.y,size:.18,color:0xffd282});
    }
    this.cancelled+=count;this.addScore(count*40*this.multiplier);return count;
  }
  battlefieldPulse(x:number,y:number,radius:number,damage:number){
    const cleared=this.cancelBullets(x,y,radius);
    for(const e of [...this.enemies])if(!e.dead&&Math.hypot(e.x-x,e.y-y)<radius)this.damageEnemy(e,damage,'pulse');
    return cleared;
  }
  private damagePart(index:number,damage:number){
    const b=this.boss;if(!b||b.dead||b.parts[index]<=0)return;
    b.parts[index]-=damage;
    if(b.parts[index]>0)return;b.parts[index]=0;
    const pos=bossPartPosition(b,index);
    const converted=this.clearSource(b.id+index+1,true);
    for(const n of this.nodes)if(n.attach==='boss'&&n.index===index){n.dead=true;this.clearSource(n.id);}
    this.addScore(2500*this.multiplier);this.pickup('power',pos.x,pos.y-1);
    this.emit('explode',{...pos,size:2.7});this.emit('part',{...pos,text:'PART BREAK / +'+2500*this.multiplier+' / '+converted+' CANCEL'});
  }
  hitPlayer() {
    if(this.invulnerable>0||this.state!=='playing')return;
    this.hull--;this.invulnerable=2.8;this.chain=0;this.multiplier=1;this.chainTime=0;
    this.power=Math.max(1,this.power-1);this.bombs=Math.min(3,this.bombs+1);
    this.locks=[];this.medalStreak=0;
    for(const b of this.bullets)if(b.enemy&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<7)b.dead=true;
    this.emit('damage',{x:this.player.x,y:this.player.y,size:1.4,text:'HULL HIT / 一時無敵',kind:'player'});
    if(this.hull<=0){this.finish(false);return;}
    this.pickup('power',this.player.x,this.player.y+3.5);
  }
  spawnBoss() {
    const maxHp=460+this.stage*220;
    this.clearEncounterSources('mini');this.encounter=null;for(const n of this.nodes)this.clearSource(n.id);this.nodes=[];this.threats=[];
    const branch=this.mode==='campaign'?(this.battlefield.stageDestroyed===2?.85:this.battlefield.stageEscaped>0?1.10:1):1;
    if(this.mode==='campaign')this.emit('fieldoutcome',{text:branch<1?'DEFENSE SUPPRESSED / ボス兵装 -15%':branch>1?'ALERT ESCALATED / ボス兵装 +10%':'BATTLEFIELD SECURED / ボス接近'});
    const id=++this.uid;this.uid+=2;
    this.boss={id,x:0,y:23,age:0,encounterTime:0,hp:maxHp,maxHp,parts:[(100+this.stage*45)*branch,(100+this.stage*45)*branch],
      maxPart:(100+this.stage*45)*branch,shoot:1.5,attack:0,cycle:-1,warning:0,beam:0,beamX:0,dead:false,flash:0,phase:1,rest:false,spread:0,recoil:0,patternTime:0,guard:0,heat:0};
    this.emit('warning',{text:'WARNING / '+STAGES[this.stage].boss});
  }
  private updateBoss(dt:number){updateBossPattern(this,dt);}
  attackName(){const b=this.boss;if(!b)return '';return b.rest?'CORE EXPOSED / DAMAGE ×1.6':BOSS_ATTACKS[this.stage][b.attack]+(b.guard?' / CORE ARMOR':this.stage===5?' / '+Math.round(b.heat*100)+'%':'');}
  nextCombatId(){return ++this.uid;}
  addCombatNode(attach:CombatNode['attach'],owner:number,index:number,x:number,y:number,hp:number,life:number){
    if(this.nodes.filter(n=>!n.dead).length>=8)return;
    this.nodes.push({id:++this.uid,owner,attach,index,stage:this.stage,x,y,baseX:x,baseY:y,hp,maxHp:hp,radius:1.12,age:0,life,shoot:(attach==='stage'?5.0:2.2)+index*.6,flash:0,dead:false});
  }
  addThreat(ax:number,ay:number,bx:number,by:number,width:number,source:number,warmup=2.05,duration=1.35){
    if(this.threats.filter(t=>!t.dead).length>=12)return;
    this.threats.push({id:++this.uid,source,ax,ay,bx,by,width,age:0,warmup:Math.max(GAME_SPEED*.70,warmup),duration,dead:false});this.emit('beam',{x:ax,y:ay,source});
  }
  clearSource(source:number,reward=false){
    let count=0;if(reward)count=this.cancelBullets(0,0,0,source);else for(const b of this.bullets)if(b.enemy&&b.source===source)b.dead=true;
    for(const t of this.threats)if(t.source===source)t.dead=true;return count;
  }
  clearEncounterSources(attach:CombatNode['attach']){
    for(const n of this.nodes)if(n.attach===attach){n.dead=true;this.clearSource(n.id);}
    if(attach==='mini'&&this.encounter)this.clearSource(this.encounter.id);
  }
  clearBossThreats(){
    if(this.boss)this.cancelBullets(this.boss.x,this.boss.y,40);
    this.clearEncounterSources('boss');for(const t of this.threats)t.dead=true;
  }
  damageNode(n:CombatNode,damage:number){
    if(n.dead)return;
    if(n.attach==='field'){if(n.flash<=0)this.emit('hit',{x:n.x,y:n.y,color:0xffcf78});damageBattlefieldNode(this,n,damage);return;}
    if(n.flash<=0)this.emit('hit',{x:n.x,y:n.y,color:ENCOUNTERS[n.stage].color});n.hp-=damage;n.flash=.10;if(n.hp>0)return;n.hp=0;n.dead=true;this.clearSource(n.id,true);this.addScore(800*this.multiplier);this.energy=Math.min(100,this.energy+5);
    this.emit('explode',{x:n.x,y:n.y,size:1.6});this.emit('part',{x:n.x,y:n.y,text:ENCOUNTERS[n.stage].hint+' / +800 × CHAIN'});this.pickup('medal',n.x,n.y);
  }
  damageMiniboss(damage:number){
    const m=this.encounter;if(!m||m.dead)return;
    const guarded=this.nodes.some(n=>n.attach==='mini'&&!n.dead);if(m.flash<=0)this.emit('hit',{x:m.x,y:m.y,color:ENCOUNTERS[m.stage].color});m.hp-=damage*(guarded?.70:1.25);m.flash=.08;if(m.hp>0)return;
    m.dead=true;this.kills++;this.addScore((5000+this.stage*1000)*this.multiplier);this.clearSource(m.id,true);this.clearEncounterSources('mini');
    this.emit('explode',{x:m.x,y:m.y,size:3.8});this.emit('midkill',{x:m.x,y:m.y,text:'MIDBOSS BREAK / 本隊へ進行'});this.pickup('power',m.x-1,m.y);this.pickup('repair',m.x+1,m.y);this.encounter=null;
    const next=this.schedule[this.waveIndex];
    if(next&&next.at-this.time>8)this.schedule.splice(this.waveIndex,0,{at:this.time+2.5,kind:'drone',count:5,formation:4},{at:this.time+6,kind:'carrier',count:1,formation:1});
  }
  private killBoss() {
    const b=this.boss;if(!b||b.dead||this.state!=='playing')return;b.dead=true;
    const timeBonus=Math.max(0,Math.round(8000-Math.max(0,b.age-3)*100));
    this.addScore(((10000+this.stage*5000)+timeBonus)*this.multiplier);
    this.emit('score',{x:b.x,y:b.y-3,text:'TIME BONUS +'+timeBonus*this.multiplier});
    this.encounter=null;this.nodes=[];this.threats=[];
    this.emit('bosskill',{x:b.x,y:b.y,size:5.5,text:'TARGET DESTROYED',source:b.id,kind:'boss'});
    for(const e of this.enemies)e.dead=true;for(const shot of this.bullets)shot.dead=true;
    if(this.mode==='caravan'){
      this.boss=null;
      // Combat reaches the boss earlier at the accelerated speed; fill the remaining real
      // two-minute session instead of leaving a silent final stretch.
      for(let at=this.time+2,cycle=0;at<120*GAME_SPEED;at+=16,cycle++)this.schedule.push(
        {at,kind:'drone',count:9,formation:cycle%2?4:1},
        {at:at+3,kind:'cruiser',count:2,formation:0},
        {at:at+7,kind:'dart',count:8,formation:2},
        {at:at+11,kind:'fighter',count:3,formation:0}
      );
      return;
    }
    this.state='transition';this.transitionTime=3.5;
  }
  private nextStage() {
    if(this.stage>=STAGES.length-1){this.finish(true);return;}
    this.stage++;this.time=0;this.enemies=[];this.bullets=[];this.pickups=[];this.boss=null;this.encounter=null;this.nodes=[];this.threats=[];this.encounterSeen={stage:false,mini:false};
    nextBattlefieldStage(this);
    this.groups.clear();this.waveIndex=0;this.schedule=waves(this.stage,this.mode);this.locks=[];
    this.hull=Math.min(4,this.hull+1);this.bombs=Math.min(3,this.bombs+1);
    this.invulnerable=2.5;this.state='playing';this.emit('stage',{text:STAGES[this.stage].name});
  }
  finish(won: boolean,reason:'hull'|'timeout'='hull') {this.won=won;this.failureReason=won?null:reason;this.state='result';this.emit('finish',{text:won?'MISSION COMPLETE':'SIGNAL LOST'});}
  update(dt: number,input: Input) {
    // The caller supplies real fixed-step seconds. Combat runs at GAME_SPEED,
    // while advertised time limits and results retain real seconds.
    const realDt=dt;dt*=GAME_SPEED;
    if(this.state!=='paused'&&this.state!=='result')this.visualTime+=dt;
    if(this.state==='transition'){this.transitionTime-=dt;if(this.transitionTime<=0)this.nextStage();return;}
    if(this.state!=='playing')return;
    this.time+=dt;this.totalTime+=realDt;
    if(this.mode==='caravan'&&this.totalTime>=120){this.finish(true);return;}
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.novaTime=Math.max(0,this.novaTime-dt);
    this.overdrive=Math.max(0,this.overdrive-dt);this.chainTime=Math.max(0,this.chainTime-dt);
    if(this.chainTime<=0){this.chain=0;this.multiplier=1;}
    const p=this.player;p.focus=input.focus;const oldX=p.x,oldY=p.y;
    if(input.target){
      const dx=input.target.x-p.x,dy=input.target.y-p.y,len=Math.hypot(dx,dy),step=(input.focus?17:47)*SHIPS[this.shipClass].speed*dt;
      const f=Math.min(1,step/(len||1));p.x+=dx*f;p.y+=dy*f;
    }else{const len=Math.max(1,Math.hypot(input.x,input.y)),speed=input.focus?8:18;
      p.x+=input.x/len*speed*SHIPS[this.shipClass].speed*dt;p.y+=input.y/len*speed*SHIPS[this.shipClass].speed*dt;}
    p.x=Math.max(-W,Math.min(W,p.x));p.y=Math.max(BOTTOM,Math.min(TOP,p.y));
    p.vx=(p.x-oldX)/dt;p.vy=(p.y-oldY)/dt;
    this.updateLocks(dt);this.shotTimer-=dt;if(this.shotTimer<=0)this.fire();
    while(this.waveIndex<this.schedule.length&&this.schedule[this.waveIndex].at<=this.time)this.wave(this.schedule[this.waveIndex++]);
    const bossTime=this.mode==='caravan'?96:STAGES[this.stage].duration;
    if(this.time>=bossTime&&!this.boss&&this.mode==='campaign')this.spawnBoss();
    if(this.mode==='caravan'&&this.time>=96&&this.time<96+dt*1.1&&!this.boss)this.spawnBoss();
    if(this.mode==='bossrush'&&this.time>=1.5&&!this.boss)this.spawnBoss();
    for(const e of this.enemies){
      if(e.dead)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.recoil=Math.max(0,e.recoil-dt);
      e.y-=DATA[e.kind].speed*dt;
      if(e.pattern===4){const t=(18-e.y)/DATA[e.kind].speed;e.x=Math.sign(e.origin)*6*Math.cos(t*.78);}
      else if(e.pattern===5)e.x=e.origin*Math.cos(e.age*.75);
      else if(e.pattern===6)e.x=e.origin+Math.sin(e.age*.95+e.phase)*2.0;
      else if(e.kind==='dart')e.x=e.origin+Math.sin(e.age*1.5+e.phase)*2.2;
      else if(e.kind==='drone'&&e.pattern===1)e.x=e.origin+Math.sin(e.age)*1.75;
      if(e.kind==='fighter'){e.x=e.origin+Math.sin(e.age*1.1+e.phase)*1.2;e.y+=e.age<4?1.6*dt:0;}
      if(e.kind==='weaver')e.x=e.origin+Math.sin(e.age*.85)*1.1;
      if(e.kind==='lancer'&&e.age<5)e.y+=2.4*dt;
      if(e.kind==='interceptor'&&e.pattern<4)e.x=e.origin+Math.sin(e.age*1.7+e.phase)*2.4;
      if(e.kind==='bomber'){e.x=e.origin+Math.sin(e.age*.55+e.phase)*.65;e.y+=e.age<3?1.0*dt:0;}
      if(e.kind==='corvette'){e.x=e.origin+Math.sin(e.age*.6+e.phase)*.8;e.y+=e.age<4?1.6*dt:0;}
      if(e.kind==='sentinel')e.x=e.origin+Math.sin(e.age*1.3+e.phase)*1.7;
      if(e.kind==='strider')e.x=e.origin+Math.sin(e.age*.7+e.phase)*.8;
      e.shoot-=dt;
      if(this.battlefield.suppression>0)e.shoot=Math.max(.35,e.shoot);
      if(e.y<13.5&&e.y>p.y+3.8&&this.battlefield.suppression<=0){
        if(e.shoot<=.48&&!e.charging){e.charging=true;e.shoot=.48;e.aimX=p.x;e.aimY=p.y;}
        if(e.shoot<=0){
          const aim={x:e.aimX,y:e.aimY};e.charging=false;e.volley++;const bulletsBefore=this.bullets.length;
          if(e.kind==='tank'){this.aimed(e.x,e.y,10,1+Math.min(this.stage,2),.16,e.id,aim);e.shoot=2.1;}
          else if(e.kind==='fighter'){this.fan(e.x,e.y,5,8,-Math.PI/2,.26,e.id);e.shoot=1.85;}
          else if(e.kind==='cruiser'){this.fan(e.x,e.y-1.5,9,7.5,-Math.PI/2,.22,e.id);e.shoot=2.3;}
          else if(e.kind==='weaver'){this.fan(e.x,e.y-1,e.volley%2?6:7,7.8,-Math.PI/2,.23,e.id,0xffa8da);e.shoot=1.85;}
          else if(e.kind==='lancer'){this.aimed(e.x,e.y,5.5,3,.13,e.id,aim,5.0);e.shoot=2.15;}
          else if(e.kind==='dart'){this.aimed(e.x,e.y,9,1,.15,e.id,aim);e.shoot=3.8;}
          else if(e.kind==='drone'&&(this.stage>0||e.id%3===0)){this.aimed(e.x,e.y,8,1,.15,e.id,aim);e.shoot=6;}
          else if(e.kind==='interceptor'){this.aimed(e.x,e.y,9.5,2,.20,e.id,aim);e.shoot=2.05;}
          else if(e.kind==='bomber'){this.aimed(e.x,e.y-.8,5.5,3,.25,e.id,aim,1.7);e.shoot=2.75;}
          else if(e.kind==='corvette'){for(const s of[-1,1])this.aimed(e.x+s*1.3,e.y-1,7.2,2,.15,e.id,aim);e.shoot=2.65;}
          else if(e.kind==='sentinel'){for(const s of[-1,1])this.fan(e.x+s*.5,e.y-.3,4,6.8,-Math.PI/2+s*.55,.14,e.id,0xffa8ef,-s*.10);e.shoot=2.4;}
          else if(e.kind==='strider'){this.aimed(e.x,e.y-.9,8.3,e.volley%2?2:3,.18,e.id,aim);e.shoot=2.35;}
          else e.shoot=10;
          for(let i=bulletsBefore;i<this.bullets.length;i++)if(e.kind==='bomber')this.bullets[i].shape='missile';else if(e.kind==='sentinel')this.bullets[i].shape='diamond';
          if(this.bullets.length>bulletsBefore){e.recoil=.24;this.emit('enemyshot',{x:e.x,y:e.y,source:e.id,kind:e.kind});}
        }
      }
      if(!e.ground&&Math.hypot(e.x-p.x,e.y-p.y)<e.radius*.8+.23)this.hitPlayer();
      if(e.y<-19){e.dead=true;const group=this.groups.get(e.group);if(group)group.escaped=true;}
    }
    if(this.state!=='playing')return;updateEncounters(this,dt);updateBattlefield(this,dt);if(this.state!=='playing')return;this.updateBoss(dt);if(this.state!=='playing')return;
    for(const b of this.bullets){
      if(b.dead)continue;b.age+=dt;b.px=b.x;b.py=b.y;
      if(b.homing&&!b.enemy){
        let tx=b.x,ty=b.y+10,best=Infinity;
        const locked=this.enemies.find(e=>e.id===b.targetId&&!e.dead);
        if(locked){tx=locked.x;ty=locked.y;best=0;}
        else for(const e of this.enemies)if(!e.dead&&e.y>b.y-1){const d=(e.x-b.x)**2+(e.y-b.y)**2;if(d<best){best=d;tx=e.x;ty=e.y;}}
        for(const n of this.nodes)if(!n.dead&&n.y>b.y-1){const d=(n.x-b.x)**2+(n.y-b.y)**2;if(n.id===b.targetId||d<best){best=n.id===b.targetId?0:d;tx=n.x;ty=n.y;}}
        const mini=this.encounter;if(mini&&(mini.id===b.targetId||(mini.x-b.x)**2+(mini.y-b.y)**2<best)){best=0;tx=mini.x;ty=mini.y;}
        const boss=this.boss;
        if(boss&&!boss.dead&&(best>120||b.targetId===boss.id||(b.targetId??0)>=boss.id+100000)){
          const part=(b.targetId??0)-boss.id-100000;
          const pos=part>=0&&part<2&&boss.parts[part]>0?bossPartPosition(boss,part):{x:boss.x,y:boss.y-1};tx=pos.x;ty=pos.y;
        }
        const v=turnToward(b.vx,b.vy,tx-b.x,ty-b.y,dt*4.3,42);b.vx=v.vx;b.vy=v.vy;
        b.trail??=[];b.trail.push({x:b.px,y:b.py});if(b.trail.length>12)b.trail.shift();
      }
      if(b.enemy){
        if(b.turn&&b.age<1.5){const a=b.turn*dt,c=Math.cos(a),s=Math.sin(a),vx=b.vx;b.vx=vx*c-b.vy*s;b.vy=vx*s+b.vy*c;}
        if(b.accel){const speed=Math.hypot(b.vx,b.vy),next=Math.min(18,speed+b.accel*dt),f=next/(speed||1);b.vx*=f;b.vy*=f;}
      }
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.enemy&&b.ricochets&&Math.abs(b.x)>W&&this.nodes.some(n=>n.stage===3&&n.attach==='stage'&&!n.dead)){b.x=Math.sign(b.x)*W;b.vx=-b.vx;b.ricochets--;this.emit('hit',{x:b.x,y:b.y});}
      if(Math.abs(b.x)>16||b.y>25||b.y<-22||b.age>5){b.dead=true;continue;}
      if(b.enemy){
        const d=segmentDistance2(b.px,b.py,b.x,b.y,p.x,p.y);
        const hitRadius=this.difficulty==='casual'?.17:.23;
        if(d<(hitRadius+b.radius*.65)**2){if(this.invulnerable<=0){b.dead=true;this.hitPlayer();if(this.state!=='playing')return;}}
        else if(!b.grazed&&d<1.1**2&&this.invulnerable<=0){b.grazed=true;this.grazes++;this.energy=Math.min(100,this.energy+1.1);this.chainTime=Math.max(this.chainTime,1.2);this.addScore(30*this.multiplier);this.emit('graze',{x:p.x,y:p.y});}
      }else{
        for(const e of this.enemies){
          if(e.dead||b.hits.includes(e.id)||e.y>18)continue;
          if(segmentDistance2(b.px,b.py,b.x,b.y,e.x,e.y)<(e.radius+b.radius)**2){
            this.damageEnemy(e,b.damage);b.hits.push(e.id);
            if(b.weapon!=='laser'||b.hits.length>=(p.focus?4:3)){b.dead=true;break;}
          }
        }
        for(const n of this.nodes){if(b.dead||n.dead||b.hits.includes(n.id))continue;if(segmentDistance2(b.px,b.py,b.x,b.y,n.x,n.y)<(n.radius+b.radius)**2){this.damageNode(n,b.damage);b.hits.push(n.id);if(b.weapon!=='laser'||b.hits.length>=(p.focus?4:3))b.dead=true;}}
        const mini=this.encounter;if(!b.dead&&mini&&!mini.dead&&mini.y<16&&!b.hits.includes(mini.id)&&segmentDistance2(b.px,b.py,b.x,b.y,mini.x,mini.y)<(2.15+b.radius)**2){this.damageMiniboss(b.damage);b.hits.push(mini.id);b.dead=true;}
        const boss=this.boss;
        if(!b.dead&&boss&&!boss.dead&&boss.y<16){
          for(let i=0;i<3;i++){
            const pos=i===0?{x:boss.x,y:boss.y-1}:bossPartPosition(boss,i-1);
            const id=boss.id+i+100000,px=pos.x,py=pos.y,r=i===0?1.7:1.35;
            if(i>0&&boss.parts[i-1]<=0||b.hits.includes(id))continue;
            if(segmentDistance2(b.px,b.py,b.x,b.y,px,py)<(r+b.radius)**2){
              if(i===0){boss.hp-=b.damage*bossCoreDamage(this,boss);boss.flash=.07;}
              else this.damagePart(i-1,b.damage);
              b.hits.push(id);b.dead=true;if(boss.hp<=0)this.killBoss();break;
            }
          }
        }
      }
    }
    for(const item of this.pickups){
      if(item.dead)continue;item.age+=dt;item.y-=2.6*dt;
      const d=Math.hypot(item.x-p.x,item.y-p.y);
      if(d<4.6){item.x+=(p.x-item.x)*dt*5;item.y+=(p.y-item.y)*dt*5;}
      if(d<1.0){item.dead=true;
        if(item.type==='power'){this.power=Math.min(4,this.power+1);this.addScore(500);this.emit('power',{text:'POWER UP / LEVEL '+this.power});}
        else if(item.type==='repair'){this.hull=Math.min(4,this.hull+1);this.emit('repair',{text:'HULL RECOVERED / +1'});}
        else{this.medalStreak=Math.min(5,this.medalStreak+1);this.bestMedal=Math.max(this.bestMedal,this.medalStreak);
          const value=this.medalStreak*1000*this.multiplier;this.addScore(value);this.energy=Math.min(100,this.energy+10);
          this.emit('medal',{x:item.x,y:item.y,value,text:'MEDAL LEVEL '+this.medalStreak+' / +'+value});}
        this.emit('collect',{x:item.x,y:item.y,color:item.type==='power'?0x65ffff:0xffd56d});
      }else if(item.y<-19){item.dead=true;if(item.type==='medal')this.medalStreak=0;}
    }
    this.nodes=this.nodes.filter(n=>!n.dead);this.threats=this.threats.filter(t=>!t.dead);
    this.enemies=this.enemies.filter(e=>!e.dead);this.bullets=this.bullets.filter(b=>!b.dead);this.pickups=this.pickups.filter(p=>!p.dead);
  }
  snapshot() { return {state:this.state,stage:this.stage,time:this.time,totalTime:this.totalTime,score:this.score,
    hull:this.hull,power:this.power,bombs:this.bombs,energy:this.energy,weapon:this.weapon,kills:this.kills,
    bullets:this.bullets.length,enemies:this.enemies.length,chain:this.chain,multiplier:this.multiplier,locks:this.locks,lockKills:this.lockKills,resonances:this.resonances,cancelled:this.cancelled,medalStreak:this.medalStreak,battlefield:{...this.battlefield},shipClass:this.shipClass,
    boss:this.boss?{hp:this.boss.hp,parts:this.boss.parts,attack:this.boss.attack,phase:this.boss.phase,rest:this.boss.rest}:null,
    encounter:this.encounter?{name:ENCOUNTERS[this.stage].mini,hp:this.encounter.hp,maxHp:this.encounter.maxHp,age:this.encounter.age,attack:this.encounter.attack}:null,stageEvent:{...this.encounterSeen,nodes:this.nodes.length,threats:this.threats.length},
    player:{...this.player},won:this.won,failureReason:this.failureReason}; }
}
