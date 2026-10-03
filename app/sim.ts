export const W = 10.2;
export const BOTTOM = -14.4;
export const TOP = 14.8;
export const STEP = 1 / 60;
export type Weapon = 'wide' | 'laser' | 'homing';
export type Mode = 'campaign' | 'caravan';
export type Difficulty = 'casual' | 'normal' | 'expert';
export type State = 'title' | 'playing' | 'paused' | 'transition' | 'result';
export type Kind = 'drone' | 'dart' | 'fighter' | 'tank' | 'cruiser' | 'carrier' | 'relic';
export interface Enemy {
  id: number; kind: Kind; x: number; y: number; origin: number; radius: number;
  hp: number; maxHp: number; age: number; shoot: number; flash: number; group: number;
  phase: number; dead: boolean; ground: boolean; pattern: number;
}
export interface Bullet {
  id: number; x: number; y: number; px: number; py: number; vx: number; vy: number;
  radius: number; damage: number; enemy: boolean; homing: boolean; weapon: Weapon;
  age: number; dead: boolean; grazed: boolean; hits: number[]; color: number;
}
export interface Pickup { id: number; x: number; y: number; type: 'power' | 'medal' | 'repair'; age: number; dead: boolean; }
export interface Boss {
  id: number; x: number; y: number; age: number; hp: number; maxHp: number;
  parts: number[]; maxPart: number; shoot: number; attack: number; cycle: number;
  warning: number; beam: number; beamX: number; dead: boolean; flash: number;
}
export interface GameEvent { type: string; x?: number; y?: number; size?: number; color?: number; text?: string; value?: number; }
export interface Input { x: number; y: number; target?: { x: number; y: number }; focus: boolean; }
interface Wave { at: number; kind: Kind; count: number; formation: number; }
export const STAGES = [
  { name: 'ORBITAL DAWN', jp: '軌道都市の夜明け', boss: 'AEGIS / 軌道防衛艦', duration: 64, color: 0x49e4ff },
  { name: 'PRISM RIFT', jp: '光の裂け目', boss: 'MANTIS / 双翼殲滅機', duration: 74, color: 0xc598ff },
  { name: 'CORE ZERO', jp: '機械星の心臓', boss: 'HELIX / 星核要塞', duration: 82, color: 0xff764b },
];
const DATA: Record<Kind, { hp: number; radius: number; score: number; speed: number }> = {
  drone: { hp: 3.0, radius: .72, score: 120, speed: 7.0 },
  dart: { hp: 4.5, radius: .72, score: 180, speed: 7.5 },
  fighter: { hp: 13, radius: 1.0, score: 360, speed: 3.4 },
  tank: { hp: 19, radius: 1.02, score: 500, speed: 4.4 },
  cruiser: { hp: 64, radius: 1.85, score: 1500, speed: 2.7 },
  carrier: { hp: 11, radius: 1.0, score: 400, speed: 3.8 },
  relic: { hp: 28, radius: .9, score: 3500, speed: 4.4 },
};
function waves(stage: number, mode: Mode): Wave[] {
  const rows: Wave[] = [
    {at:2,kind:'drone',count:5,formation:0}, {at:5,kind:'carrier',count:1,formation:1},
    {at:7.5,kind:'drone',count:6,formation:2}, {at:11,kind:'dart',count:5,formation:1},
    {at:14.5,kind:'tank',count:2,formation:0}, {at:16,kind:'relic',count:1,formation:3},
    {at:18,kind:'drone',count:7,formation:1}, {at:22,kind:'fighter',count:2,formation:0},
    {at:25,kind:'carrier',count:1,formation:2}, {at:28,kind:'dart',count:6,formation:2},
    {at:32,kind:'tank',count:3,formation:0}, {at:35,kind:'cruiser',count:1,formation:0},
    {at:39,kind:'drone',count:7,formation:1}, {at:43,kind:'relic',count:1,formation:3},
    {at:44,kind:'fighter',count:3,formation:0}, {at:48,kind:'carrier',count:1,formation:1},
    {at:50,kind:'dart',count:7,formation:2}, {at:54,kind:'tank',count:2,formation:0},
    {at:57,kind:'drone',count:8,formation:1},
  ];
  if (stage >= 1 || mode === 'caravan') rows.push(
    {at:59,kind:'cruiser',count:2,formation:0}, {at:64,kind:'dart',count:8,formation:2},
    {at:68,kind:'carrier',count:1,formation:1},
  );
  if (stage === 2 || mode === 'caravan') rows.push(
    {at:71,kind:'fighter',count:3,formation:0}, {at:75,kind:'drone',count:8,formation:1},
    {at:79,kind:'relic',count:1,formation:3},
  );
  if (mode === 'caravan') rows.push(
    {at:82,kind:'dart',count:8,formation:2}, {at:86,kind:'cruiser',count:2,formation:0},
    {at:90,kind:'carrier',count:1,formation:1},
  );
  return rows.sort((a,b)=>a.at-b.at);
}
export function segmentDistance2(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1)));
  return (ax+dx*t-x)**2+(ay+dy*t-y)**2;
}
export class Game {
  state: State = 'title'; mode: Mode = 'campaign'; difficulty: Difficulty = 'normal';
  stage=0; time=0; totalTime=0; visualTime=0; score=0; kills=0; chain=0; maxChain=0;
  chainTime=0; multiplier=1; formations=0; relics=0; grazes=0;
  power=1; weapon: Weapon='wide'; hull=3; bombs=3; energy=0; invulnerable=0;
  overdrive=0; novaTime=0; shotTimer=0; transitionTime=0; won=false; resumeState: State='playing';
  player={x:0,y:-10.5,vx:0,vy:0,focus:false};
  enemies: Enemy[]=[]; bullets: Bullet[]=[]; pickups: Pickup[]=[]; boss: Boss | null=null;
  events: GameEvent[]=[]; private schedule: Wave[]=[]; private waveIndex=0; private uid=0;
  private seed=2026; private groups=new Map<number,{total:number;kills:number;escaped:boolean}>();
  private volley=0; private lastExtend=0;
  private random() { let x=this.seed|0; x^=x<<13; x^=x>>>17; x^=x<<5; this.seed=x; return (x>>>0)/4294967296; }
  emit(type: string, fields: Omit<GameEvent,'type'>={}) { if(this.events.length<600)this.events.push({type,...fields}); }
  drainEvents() { const r=this.events; this.events=[]; return r; }
  start(mode: Mode='campaign', difficulty: Difficulty='normal') {
    this.mode=mode; this.difficulty=difficulty; this.stage=0; this.time=0; this.totalTime=0;
    this.score=0; this.kills=0; this.chain=0; this.maxChain=0; this.chainTime=0; this.multiplier=1;
    this.formations=0; this.relics=0; this.grazes=0; this.power=1; this.hull=difficulty==='casual'?4:3;
    this.bombs=3; this.energy=0; this.invulnerable=3; this.overdrive=0; this.novaTime=0;
    this.weapon='wide'; this.player={x:0,y:-10.5,vx:0,vy:0,focus:false};
    this.enemies=[]; this.bullets=[]; this.pickups=[]; this.events=[]; this.boss=null;
    this.groups.clear(); this.waveIndex=0; this.uid=0; this.seed=2026; this.volley=0;
    this.lastExtend=0; this.won=false; this.shotTimer=0; this.schedule=waves(0,mode);
    this.state='playing'; this.emit('stage',{text:mode==='caravan'?'120 SECOND CARAVAN':STAGES[0].name});
  }
  pause() { if(this.state==='playing'||this.state==='transition'){this.resumeState=this.state;this.state='paused';} }
  resume() { if(this.state==='paused')this.state=this.resumeState; }
  cycleWeapon() {
    const list: Weapon[]=['wide','laser','homing']; this.weapon=list[(list.indexOf(this.weapon)+1)%3];
    this.emit('weapon',{text:this.weapon.toUpperCase()});
  }
  addScore(amount: number) {
    this.score+=Math.round(amount);
    const ext=Math.floor(this.score/80000);
    if(ext>this.lastExtend){this.lastExtend=ext;this.hull=Math.min(4,this.hull+1);this.emit('extend',{text:'80,000 BONUS / HULL +1'});}
  }
  nova() {
    if(this.state!=='playing'||this.novaTime>0)return false;
    if(this.energy>=100){this.energy=0;this.overdrive=6;this.emit('overdrive',{text:'OVERDRIVE / 6 SEC'});}
    else if(this.bombs>0)this.bombs--;else return false;
    this.novaTime=1.2; this.invulnerable=Math.max(this.invulnerable,2.3);
    let converted=0; for(const b of this.bullets)if(b.enemy&&!b.dead){b.dead=true;converted++;}
    this.addScore(converted*35); this.energy=Math.min(100,this.energy+converted*.3);
    for(const e of [...this.enemies])if(!e.dead)this.damageEnemy(e,70);
    if(this.boss&&!this.boss.dead){this.boss.hp-=105;this.boss.parts=this.boss.parts.map(p=>Math.max(0,p-60));if(this.boss.hp<=0)this.killBoss();}
    this.emit('nova',{x:this.player.x,y:this.player.y,size:18}); return true;
  }
  spawn(kind: Kind, x: number, y: number, group=0, pattern=0): Enemy {
    const d=DATA[kind],hp=d.hp*(this.difficulty==='expert'?1.12:1);
    const e: Enemy={id:++this.uid,kind,x,y,origin:x,radius:d.radius,hp,maxHp:hp,age:0,
      shoot:1.1+this.random()*.8,flash:0,group,phase:this.random()*6.28,dead:false,
      ground:kind==='tank'||kind==='relic',pattern}; this.enemies.push(e);return e;
  }
  private wave(w: Wave) {
    const group=++this.uid;this.groups.set(group,{total:w.count,kills:0,escaped:false});
    const side=this.waveIndex%2===0?1:-1;
    for(let i=0;i<w.count;i++){
      let x=0,y=18+i*.85;
      if(w.formation===0)x=(i-(w.count-1)/2)*(w.count<=3?5.3:2.9);
      if(w.formation===1){x=side*(6-i*.9);y=18+i*1.35;}
      if(w.formation===2){x=(i%2===0?-1:1)*(3.2+Math.floor(i/2)*.6);y=18+Math.floor(i/2)*1.7;}
      if(w.formation===3)x=side*7;
      this.spawn(w.kind,x,y,group,w.formation);
    }
    if(w.kind==='carrier')this.emit('supply',{text:'SUPPLY / 補給機を撃破'});
  }
  private projectile(x: number,y: number,vx: number,vy: number,enemy: boolean,damage=1.7,homing=false,color=0xffa73b) {
    if(this.bullets.length>720)return;
    this.bullets.push({id:++this.uid,x,y,px:x,py:y,vx,vy,radius:enemy?.24:.18,damage,
      enemy,homing,weapon:this.weapon,age:0,dead:false,grazed:false,hits:[],color});
  }
  private aimed(x: number,y: number,speed: number,count=1,spread=.15) {
    if(y<this.player.y+1.5)return;
    const a=Math.atan2(this.player.y-y,this.player.x-x);
    const scale=this.difficulty==='casual'?.84:this.difficulty==='expert'?1.22:1;
    for(let i=0;i<count;i++){const an=a+(i-(count-1)/2)*spread;this.projectile(x,y,Math.cos(an)*speed*scale,Math.sin(an)*speed*scale,true);}
  }
  private fire() {
    const p=this.player,level=this.power,boost=this.overdrive>0?1.65:1;
    if(this.weapon==='wide'){
      const n=level===1?2:level===2?3:5;
      for(let i=0;i<n;i++){
        const a=(i-(n-1)/2)*(p.focus?.045:.12);
        this.projectile(p.x+(i-(n-1)/2)*.19,p.y+.7,Math.sin(a)*53,Math.cos(a)*53,false,1.8*boost);
      }
    }else if(this.weapon==='laser'){
      for(const s of [-1,1])this.projectile(p.x+s*.24,p.y+.8,0,72,false,(2.2+level*.55)*boost);
    }else{
      const n=Math.min(4,level+1);
      for(let i=0;i<n;i++)this.projectile(p.x+(i-(n-1)/2)*.3,p.y+.6,(i-(n-1)/2)*7,34,false,(1.9+level*.2)*boost,true);
    }
    if(level===4)for(const s of [-1,1])this.projectile(p.x+s*1.45,p.y-.05,0,52,false,1.6*boost,true);
    if(++this.volley%3===0)this.emit('shot');
    this.shotTimer=this.weapon==='homing'?.145:.10;
  }
  damageEnemy(e: Enemy, damage: number) {
    if(e.dead)return;e.hp-=damage;e.flash=.08;
    if(e.hp>0){if(this.random()<.18)this.emit('hit',{x:e.x,y:e.y});return;}
    e.dead=true;this.kills++;this.chain++;this.maxChain=Math.max(this.maxChain,this.chain);
    this.chainTime=3.4;this.multiplier=Math.min(8,1+Math.floor(this.chain/8));
    const close=e.y-this.player.y<7&&e.y>this.player.y;
    this.addScore(DATA[e.kind].score*this.multiplier*(close?1.35:1));
    this.energy=Math.min(100,this.energy+(e.kind==='cruiser'?12:3.2));
    this.emit('explode',{x:e.x,y:e.y,size:e.radius,color:e.kind==='relic'?0xffdb66:0xff8650});
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
  hitPlayer() {
    if(this.invulnerable>0||this.state!=='playing')return;
    this.hull--;this.invulnerable=2.8;this.chain=0;this.multiplier=1;this.chainTime=0;
    this.power=Math.max(1,this.power-1);this.bombs=Math.min(3,this.bombs+1);
    for(const b of this.bullets)if(b.enemy&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<7)b.dead=true;
    this.emit('damage',{x:this.player.x,y:this.player.y,size:1.4,text:'HULL HIT / 一時無敵'});
    if(this.hull<=0){this.finish(false);return;}
    this.pickup('power',this.player.x,this.player.y+3.5);
  }
  spawnBoss() {
    const maxHp=460+this.stage*220;
    this.boss={id:++this.uid,x:0,y:23,age:0,hp:maxHp,maxHp,parts:[100+this.stage*45,100+this.stage*45],
      maxPart:100+this.stage*45,shoot:1.5,attack:0,cycle:-1,warning:0,beam:0,beamX:0,dead:false,flash:0};
    this.emit('warning',{text:'WARNING / '+STAGES[this.stage].boss});
  }
  private updateBoss(dt: number) {
    const b=this.boss;if(!b||b.dead)return;
    b.age+=dt;b.flash=Math.max(0,b.flash-dt);
    b.y+=((b.age<3?9.2:9+Math.sin(b.age*.65)*.7)-b.y)*dt*1.9;
    b.x=Math.sin(b.age*.55)*(this.stage===2?3.3:2.8);
    if(b.age<3)return;
    const damaged=b.hp<b.maxHp*.48;
    const cycle=Math.floor((b.age-3)/7.5);
    if(cycle!==b.cycle){b.cycle=cycle;b.attack=cycle%3;b.shoot=.8;
      if(b.attack===2){b.beamX=this.player.x;b.warning=1.35;this.emit('beam',{text:'LASER LOCK / 横に回避'});}
    }
    if(b.warning>0){b.warning-=dt;if(b.warning<=0)b.beam=1.65;}
    else if(b.beam>0){b.beam-=dt;if(Math.abs(this.player.x-b.beamX)<.8&&this.player.y<b.y)this.hitPlayer();}
    b.shoot-=dt;
    if(b.shoot<=0){
      if(b.attack===0){
        const n=7+this.stage*2,base=-Math.PI/2+Math.sin(b.age*1.8)*.24;
        for(let i=0;i<n;i++){const a=base+(i-(n-1)/2)*.15;this.projectile(b.x,b.y-1.8,Math.cos(a)*(8+this.stage),Math.sin(a)*(8+this.stage),true,1,false,0xffc35b);}
        b.shoot=damaged?.62:.88;
      }else if(b.attack===1){
        for(let i=0;i<2;i++)if(b.parts[i]>0)this.aimed(b.x+(i===0?-3.0:3.0),b.y-1,11+this.stage,3,.17);
        this.aimed(b.x,b.y-2,10,damaged?3:1,.23);b.shoot=.95;
      }else{
        for(const side of [-1,1])this.aimed(b.x+side*3,b.y-1,8.5,2,.23);b.shoot=1.5;
      }
    }
  }
  private killBoss() {
    const b=this.boss;if(!b||b.dead)return;b.dead=true;
    this.addScore((10000+this.stage*5000)*this.multiplier);
    this.emit('bosskill',{x:b.x,y:b.y,size:5.5,text:'TARGET DESTROYED'});
    for(const e of this.enemies)e.dead=true;for(const shot of this.bullets)shot.dead=true;
    if(this.mode==='caravan'){this.boss=null;this.schedule.push(
      {at:this.time+2,kind:'drone',count:9,formation:1},{at:this.time+5,kind:'cruiser',count:2,formation:0},
      {at:this.time+9,kind:'dart',count:8,formation:2},{at:this.time+13,kind:'fighter',count:3,formation:0}
    );return;}
    this.state='transition';this.transitionTime=3.5;
  }
  private nextStage() {
    if(this.stage>=2){this.finish(true);return;}
    this.stage++;this.time=0;this.enemies=[];this.bullets=[];this.pickups=[];this.boss=null;
    this.groups.clear();this.waveIndex=0;this.schedule=waves(this.stage,this.mode);
    this.hull=Math.min(4,this.hull+1);this.bombs=Math.min(3,this.bombs+1);
    this.invulnerable=2.5;this.state='playing';this.emit('stage',{text:STAGES[this.stage].name});
  }
  finish(won: boolean) {this.won=won;this.state='result';this.emit('finish',{text:won?'MISSION COMPLETE':'SIGNAL LOST'});}
  update(dt: number,input: Input) {
    this.visualTime+=dt;
    if(this.state==='transition'){this.transitionTime-=dt;if(this.transitionTime<=0)this.nextStage();return;}
    if(this.state!=='playing')return;
    this.time+=dt;this.totalTime+=dt;
    if(this.mode==='caravan'&&this.totalTime>=120){this.finish(true);return;}
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.novaTime=Math.max(0,this.novaTime-dt);
    this.overdrive=Math.max(0,this.overdrive-dt);this.chainTime=Math.max(0,this.chainTime-dt);
    if(this.chainTime<=0){this.chain=0;this.multiplier=1;}
    const p=this.player;p.focus=input.focus;const oldX=p.x,oldY=p.y;
    if(input.target){
      const dx=input.target.x-p.x,dy=input.target.y-p.y,len=Math.hypot(dx,dy),step=(input.focus?17:47)*dt;
      const f=Math.min(1,step/(len||1));p.x+=dx*f;p.y+=dy*f;
    }else{const len=Math.max(1,Math.hypot(input.x,input.y)),speed=input.focus?8:18;
      p.x+=input.x/len*speed*dt;p.y+=input.y/len*speed*dt;}
    p.x=Math.max(-W,Math.min(W,p.x));p.y=Math.max(BOTTOM,Math.min(TOP,p.y));
    p.vx=(p.x-oldX)/dt;p.vy=(p.y-oldY)/dt;
    this.shotTimer-=dt;if(this.shotTimer<=0)this.fire();
    while(this.waveIndex<this.schedule.length&&this.schedule[this.waveIndex].at<=this.time)this.wave(this.schedule[this.waveIndex++]);
    const bossTime=this.mode==='caravan'?96:STAGES[this.stage].duration;
    if(this.time>=bossTime&&!this.boss&&this.mode==='campaign')this.spawnBoss();
    if(this.mode==='caravan'&&this.time>=96&&this.time<96+dt*1.1&&!this.boss)this.spawnBoss();
    for(const e of this.enemies){
      if(e.dead)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);
      e.y-=DATA[e.kind].speed*dt;
      if(e.kind==='dart')e.x=e.origin+Math.sin(e.age*1.5+e.phase)*2.2;
      if(e.kind==='drone'&&e.pattern===1)e.x=e.origin+Math.sin(e.age*1.0)*1.75;
      if(e.kind==='fighter'){e.x=e.origin+Math.sin(e.age*1.1+e.phase)*1.2;e.y+=e.age<4?1.6*dt:0;}
      e.shoot-=dt;
      if(e.shoot<=0&&e.y<13.5&&e.y>p.y+2){
        if(e.kind==='tank'){this.aimed(e.x,e.y,10,1+this.stage,.16);e.shoot=2.0;}
        else if(e.kind==='fighter'){this.aimed(e.x,e.y,10,3,.18);e.shoot=1.7;}
        else if(e.kind==='cruiser'){this.aimed(e.x-1,e.y-.9,9,5,.16);this.aimed(e.x+1,e.y-.9,9,5,.16);e.shoot=2.2;}
        else if(e.kind==='dart'){this.aimed(e.x,e.y,9);e.shoot=3.8;}
        else if(e.kind==='drone'&&(this.stage>0||e.id%3===0)){this.aimed(e.x,e.y,8);e.shoot=6;}
      }
      if(!e.ground&&Math.hypot(e.x-p.x,e.y-p.y)<e.radius*.8+.23)this.hitPlayer();
      if(e.y<-19){e.dead=true;const group=this.groups.get(e.group);if(group)group.escaped=true;}
    }
    this.updateBoss(dt);
    for(const b of this.bullets){
      if(b.dead)continue;b.age+=dt;b.px=b.x;b.py=b.y;
      if(b.homing&&!b.enemy){
        let tx=b.x,ty=b.y+10,best=Infinity;
        for(const e of this.enemies)if(!e.dead&&e.y>b.y-1){const d=(e.x-b.x)**2+(e.y-b.y)**2;if(d<best){best=d;tx=e.x;ty=e.y;}}
        if(this.boss&&!this.boss.dead&&best>120){tx=this.boss.x;ty=this.boss.y;}
        const len=Math.hypot(tx-b.x,ty-b.y)||1,speed=42,t=Math.min(1,dt*6);
        b.vx+=((tx-b.x)/len*speed-b.vx)*t;b.vy+=((ty-b.y)/len*speed-b.vy)*t;
      }
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(Math.abs(b.x)>16||b.y>25||b.y<-22||b.age>5){b.dead=true;continue;}
      if(b.enemy){
        const d=segmentDistance2(b.px,b.py,b.x,b.y,p.x,p.y);
        const hitRadius=this.difficulty==='casual'?.17:.23;
        if(d<(hitRadius+b.radius*.65)**2){if(this.invulnerable<=0){b.dead=true;this.hitPlayer();}}
        else if(!b.grazed&&d<1.1**2&&this.invulnerable<=0){b.grazed=true;this.grazes++;this.energy=Math.min(100,this.energy+1.1);this.addScore(30*this.multiplier);this.emit('graze',{x:p.x,y:p.y});}
      }else{
        for(const e of this.enemies){
          if(e.dead||b.hits.includes(e.id)||e.y>18)continue;
          if(segmentDistance2(b.px,b.py,b.x,b.y,e.x,e.y)<(e.radius+b.radius)**2){
            this.damageEnemy(e,b.damage);b.hits.push(e.id);
            if(b.weapon!=='laser'||b.hits.length>=2){b.dead=true;break;}
          }
        }
        const boss=this.boss;
        if(!b.dead&&boss&&!boss.dead&&boss.y<16){
          for(let i=0;i<3;i++){
            const id=boss.id+i+100000,px=boss.x+(i===0?0:i===1?-3:3),py=boss.y+(i===0?-1:0),r=i===0?1.7:1.35;
            if(i>0&&boss.parts[i-1]<=0||b.hits.includes(id))continue;
            if(segmentDistance2(b.px,b.py,b.x,b.y,px,py)<(r+b.radius)**2){
              if(i===0){boss.hp-=b.damage;boss.flash=.07;}
              else{boss.parts[i-1]-=b.damage;if(boss.parts[i-1]<=0){this.addScore(2500*this.multiplier);this.emit('explode',{x:px,y:py,size:2.5});this.pickup('power',px,py-1);}}
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
        else{this.addScore(1000*this.multiplier);this.energy=Math.min(100,this.energy+10);this.emit('medal',{text:'CORE MEDAL / +1,000 × CHAIN'});}
        this.emit('collect',{x:item.x,y:item.y,color:item.type==='power'?0x65ffff:0xffd56d});
      }else if(item.y<-19)item.dead=true;
    }
    this.enemies=this.enemies.filter(e=>!e.dead);this.bullets=this.bullets.filter(b=>!b.dead);this.pickups=this.pickups.filter(p=>!p.dead);
  }
  snapshot() { return {state:this.state,stage:this.stage,time:this.time,totalTime:this.totalTime,score:this.score,
    hull:this.hull,power:this.power,bombs:this.bombs,energy:this.energy,weapon:this.weapon,kills:this.kills,
    bullets:this.bullets.length,enemies:this.enemies.length,boss:this.boss?{hp:this.boss.hp,parts:this.boss.parts,attack:this.boss.attack}:null,
    player:{...this.player},won:this.won}; }
}
