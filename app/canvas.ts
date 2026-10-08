import { Game, STAGES, type GameEvent, type Kind } from './sim.ts';
import {shipSprite,bossSprite,tankSprite,warpedSprite} from './canvas-art.ts';
import {CanvasFortressBackground} from './canvas-background.ts';
import {explosionAtlasMap,smokeMap,livingMaps,finishMaps,visualAssetStatus,playerShipsAtlasMap} from './visual-assets.ts';
import {bossWingAngle,bossScars,scarPositions} from './boss-finish.ts';
import {playerPose,enemyPose,bossPose,smooth,animationClockRunning,presentationState,type ShipPose} from './motion.ts';
import {CanvasStageEffects,canvasGlow} from './canvas-effects.ts';
import {CanvasCombatEffects} from './canvas-combat.ts';
import {drawAirCanvas} from './air-effects.ts';
import {drawThreatsCanvas,drawEncounterActorsCanvas,drawBossShieldCanvas,encounterDiagnostics} from './encounter-view.ts';

// Compatibility view for browsers where all GPU contexts are unavailable.
// It shares the same fixed-step combat, controls, scores and progression.
interface Spark {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;}
export class CanvasView {
  engine='Canvas 2D';quality='COMPATIBLE';private playerTint='#65dcff';private playerSkinIndex=0;
  private ctx!:CanvasRenderingContext2D;private width=0;private height=0;private ratio=1;
  private background=new CanvasFortressBackground();private sparks:Spark[]=[];private pulse=0;private ring={x:0,y:0,age:2};
  private explosions:{x:number;y:number;size:number;age:number;life:number;smoke?:boolean}[]=[];
  private stageEffects=new CanvasStageEffects();private playerAnimation='cruise';private bossAnimation='none';private enemyAnimations:Record<string,number>={};private stage=0;
  private combatEffects=new CanvasCombatEffects();private encounterStatus={miniboss:false,nodes:0,telegraphs:0,activeThreats:0,shield:false};
  private air={clock:0,layers:0,kind:'none'};
  private wrecks:{x:number;y:number;kind:Kind|'boss';age:number;life:number;stage:number;parts?:number[];spread?:number;deploy?:number}[]=[];private cascades:{at:number;x:number;y:number;size:number}[]=[];private lastBoss:Game['boss']=null;
  constructor(private canvas:HTMLCanvasElement){}
  async init(_forceWebGL=false){this.ctx=this.canvas.getContext('2d',{alpha:false})!;if(!this.ctx)throw new Error('No graphics context');this.resize();}
  resize(){const r=this.canvas.parentElement!.getBoundingClientRect();this.width=r.width;this.height=r.height;this.ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*this.ratio);this.canvas.height=Math.round(r.height*this.ratio);}
  pointerToWorld(x:number,y:number){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left)/r.width*24-12,y:(.5-(y-r.top)/r.height)*128/3};}
  private shape(points:number[][],fill:string,stroke?:string){const c=this.ctx;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.045;c.stroke();}}
  private rect(x:number,y:number,w:number,h:number,color:string){this.ctx.fillStyle=color;this.ctx.fillRect(x,y,w,h);}
  private circle(x:number,y:number,r:number,color:string){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  worldToScreen(x:number,y:number){return {x:(x/24+.5)*this.width,y:(.5-y/(128/3))*this.height};}
  private asset(asset:ReturnType<typeof shipSprite>,x:number,y:number,scale=1,tilt=0,bank=0,warp?:{kind:Kind;t:number;flex:number}){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(tilt);c.scale(scale*(1-Math.abs(bank)*.30),-scale);
    const sprite=warp?warpedSprite(asset,warp.kind,warp.t,warp.flex):asset;c.drawImage(sprite.canvas,sprite.left,-sprite.top,sprite.width,sprite.height);c.restore();
  }
  private ship(kind:Kind|'player',x:number,y:number,pose:ShipPose,scale=1,flash=false,t=0){
    if(kind!=='tank'&&kind!=='relic'&&kind!=='strider')this.circle(x+.15,y+.6,kind==='cruiser'?1.9:1.05,'#02061170');
    if(kind==='tank'){this.asset(tankSprite('chassis'),x,y,scale);this.asset(tankSprite('turret'),x,y+pose.recoil*.18,scale,pose.turret);}else if(kind==='player'&&playerShipsAtlasMap.image instanceof HTMLImageElement&&playerShipsAtlasMap.image.complete){const image=playerShipsAtlasMap.image;const w=image.width/3;c.save();c.translate(x,y);c.rotate(pose.roll);c.scale(scale*(1-Math.abs(pose.bank)*.3),-scale);c.drawImage(image,w*this.playerSkinIndex,0,w,image.height,-1.78,-1.93,3.56,3.86);c.restore();}
    else this.asset(shipSprite(kind),x,y,scale,pose.roll,pose.bank,['bomber','strider','sentinel'].includes(kind)?{kind:kind as Kind,t,flex:pose.flex}:undefined);
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(kind==='tank'?pose.turret:pose.roll);c.scale(scale,scale);
    const player=kind==='player',large=kind==='cruiser'||kind==='corvette',small=kind==='drone'||kind==='dart',color=player?this.playerTint:kind==='carrier'?'#65dcff':kind==='weaver'||kind==='lancer'||kind==='sentinel'?'#ff9adb':'#ffb56d';
    if(kind!=='tank'&&kind!=='relic'&&kind!=='strider')for(const side of[-1,1]){
      const ex=side*(large?1.35:kind==='bomber'?1.38:player?.50:small?.35:.62),ey=large?2.2:kind==='bomber'?1.37:kind==='sentinel'?.20:player?-1.68:small?.78:1.05;
      canvasGlow(c,ex,ey,.3*pose.thrust,color,.65);c.save();c.translate(ex,ey);if(!player)c.rotate(Math.PI);c.scale(1,-1);c.globalAlpha=.6;c.globalCompositeOperation='lighter';const length=1.65*pose.thrust*(.9+Math.sin(t*36)*.1),width=.48*pose.thrust;c.drawImage(livingMaps.plume.image,-width/2,-length*.05,width,length);c.restore();
    }
    if(kind!=='carrier'&&kind!=='relic'&&pose.recoil>.04)for(const s of[-1,1])canvasGlow(c,s*(kind==='tank'?.24:large?1.35:player?.50:.62),kind==='tank'||kind==='strider'?-1.27:large?-2.15:kind==='lancer'?-2.16:player?.90:-1.05,.20+pose.recoil*.35,player?'#a8eaff':'#ffdfb0',pose.recoil*.9);
    if(player||kind==='fighter'||kind==='lancer'||large){c.fillStyle=player?'#afc8d4':'#ac9695';for(const s of[-1,1]){const xx=s*(large?1.48:player?.74:.78)+s*pose.flex*.08;c.save();c.translate(xx,player?-.76:.4);c.rotate(s*pose.flex*.18);c.fillRect(-.055,-.22,.11,.45);c.restore();}}
    if(kind==='carrier'){c.fillStyle='#576f89';for(const s of[-1,1])c.fillRect(s*(.23+pose.flex*.30)-.2,-.58,.40,.98);}
    if(kind==='weaver'||kind==='relic'){c.save();c.rotate(pose.rotor);c.strokeStyle=color;c.lineWidth=.055;for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.moveTo(Math.cos(a)*.45,Math.sin(a)*.45);c.lineTo(Math.cos(a)*.70,Math.sin(a)*.70);c.stroke();}c.restore();}
    if(pose.charge>0)canvasGlow(c,0,player?-.6:-.1,.55+pose.charge*.45,color,pose.charge*.3);c.restore();
    if(flash){this.ctx.globalAlpha=.50;this.circle(x,y,.35,'#fff8d9');this.ctx.globalAlpha=1;}
  }
  event(e:GameEvent){
    this.combatEffects.event(e);
    if(e.type==='stage'){this.sparks=[];this.explosions=[];this.wrecks=[];this.cascades=[];this.pulse=0;this.ring.age=2;}
    if(e.type==='explode'&&e.kind&&e.kind!=='player'&&e.kind!=='boss'&&this.wrecks.length<12)this.wrecks.push({x:e.x||0,y:e.y||0,kind:e.kind,stage:this.stage,age:0,life:e.kind==='cruiser'?1.65:.85});
    if(e.type==='bosskill'){
      this.wrecks.push({x:e.x||0,y:e.y||0,kind:'boss',stage:this.stage,age:0,life:3.3,parts:[...(this.lastBoss?.parts??[1,1])],spread:this.lastBoss?.spread??0,deploy:smooth((this.lastBoss?.age??3)/3)});
      for(let i=0;i<7;i++)this.cascades.push({at:.25+i*.35,x:(e.x||0)+Math.sin(i*2.3)*3.4,y:(e.y||0)+Math.cos(i*1.7)*2.1,size:1.2+i*.13});
    }
    if(!['explode','bosskill','damage','nova','collect','hit','graze','resonance'].includes(e.type))return;
    const size=e.size||.7,count=e.type==='nova'||e.type==='bosskill'||e.type==='resonance'?80:e.type==='hit'?4:e.type==='graze'?2:25;
    const color=e.type==='collect'||e.type==='graze'?'#79f4ff':e.type==='hit'?'#ffe9b9':'#ffb86f';
    for(let i=0;i<count&&this.sparks.length<450;i++){
      const a=Math.random()*6.283,v=(3+Math.random()*8)*Math.sqrt(size),life=.18+Math.random()*.6;
      this.sparks.push({x:e.x||0,y:e.y||0,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:.05+Math.random()*.14});
    }
    if(e.type==='nova'||e.type==='bosskill'||e.type==='resonance'){this.ring={x:e.x||0,y:e.y||0,age:0};this.pulse=.3;}
    if(['explode','bosskill','damage'].includes(e.type)&&this.explosions.length<48){this.explosions.push({x:e.x||0,y:e.y||0,size:size*3.4,age:0,life:.88});this.explosions.push({x:e.x||0,y:e.y||0,size:size*3.8,age:-.08,life:1.6,smoke:true});}
  }
  draw(g:Game,dt:number,_frameMs:number){
    dt=animationClockRunning(g)?dt:0;this.encounterStatus=encounterDiagnostics(g);
    const c=this.ctx,state=presentationState(g),title=state==='title',active=state==='playing'||state==='transition',stage=this.stage=g.stage;
    c.setTransform(this.ratio,0,0,this.ratio,0,0);c.fillStyle='#'+STAGES[stage].sky.toString(16).padStart(6,'0');c.fillRect(0,0,this.width,this.height);
    c.translate(this.width/2,this.height/2);c.scale(this.width/24,-this.height/(128/3));
    this.background.draw(c,g);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.air=drawAirCanvas(c,g,reduced);
    this.stageEffects.draw(c,g,reduced);this.combatEffects.step(g,dt,reduced);this.combatEffects.drawWaves(c);this.combatEffects.drawEchoes(c);this.enemyAnimations={};drawThreatsCanvas(c,g);
    for(const e of g.enemies){const pose=enemyPose(e,g.player);this.enemyAnimations[pose.mode]=(this.enemyAnimations[pose.mode]||0)+1;this.ship(e.kind,e.x,e.y,pose,1,e.flash>0,e.age);}
    drawEncounterActorsCanvas(c,g);
    const b=g.boss;
    if(b&&!b.dead){
      this.lastBoss=b;
      const pose=bossPose(b);this.bossAnimation=pose.mode;
      this.asset(bossSprite(stage,'core'),b.x,b.y);
      for(let i=0;i<2;i++)if(b.parts[i]>0){this.asset(bossSprite(stage,i===0?'wing0':'wing1'),b.x+(i===0?-1:1)*(b.spread+(1-pose.deploy)*1.2),b.y-b.spread*.65,1,bossWingAngle(stage,i===0?-1:1,b.age,pose.deploy));if(pose.recoil>.01)canvasGlow(c,b.x+(i===0?-1:1)*(3+b.spread),b.y-b.spread*.65-1.5,.6+pose.recoil*.4,'#ffd9ad',pose.recoil);}
      for(const [x,y,size]of scarPositions){c.save();c.translate(b.x+x,b.y+y);c.scale(1,-1);c.globalAlpha=bossScars(b);c.drawImage(finishMaps.scorch.image,-size/2,-size/2,size,size);c.restore();}
      c.save();c.translate(b.x,b.y-.85);c.rotate(pose.rotor);c.strokeStyle='#c9dce5';c.lineWidth=.065;for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(Math.cos(a)*.65,Math.sin(a)*.65);c.lineTo(Math.cos(a)*.89,Math.sin(a)*.89);c.stroke();}c.restore();
      for(let i=0;i<4;i++){const a=i*Math.PI/2,x=b.x+Math.cos(a)*(.45+pose.open*.52),y=b.y-.85+Math.sin(a)*(.45+pose.open*.52);c.save();c.translate(x,y);c.rotate(a);this.rect(-.15,-.30,.30,.6,'#738a9b');c.restore();}
      canvasGlow(c,b.x,b.y-.85,.7+pose.open*.65,'#'+STAGES[stage].color.toString(16).padStart(6,'0'),.2+pose.open*.4);
    }else this.bossAnimation=this.wrecks.some(w=>w.kind==='boss')?'collapse':'none';
    drawBossShieldCanvas(c,g);
    for(const item of g.pickups){c.save();c.translate(item.x,item.y);c.rotate(item.age);const color=item.type==='power'?'#7effff':item.type==='repair'?'#8affa6':'#ffd282';c.strokeStyle=color;c.lineWidth=.08;c.beginPath();c.arc(0,0,.58,0,Math.PI*2);c.stroke();this.shape([[0,.4],[-.35,0],[0,-.4],[.35,0]],color);c.restore();}
    for(const bullet of g.bullets)if(bullet.trail&&bullet.trail.length>1){c.strokeStyle='#6cffcc';c.lineWidth=.09;c.globalAlpha=.6;c.beginPath();bullet.trail.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}c.globalAlpha=1;
    for(const lock of g.locks){c.strokeStyle='#94ffd6';c.lineWidth=.05;const r=1.5-lock.progress*.5;c.strokeRect(lock.x-r,lock.y-r,r*2,r*2);}
    for(const e of g.enemies)if(e.charging&&e.y<13.5&&e.y>g.player.y+3.8){c.strokeStyle='#ff9d86';c.lineWidth=.06;c.beginPath();c.arc(e.x,e.y,.45+(1-e.shoot/.48)*.3,0,Math.PI*2);c.stroke();if(e.kind==='lancer'||e.kind==='tank'||e.kind==='strider'){c.globalAlpha=.30;c.setLineDash([.25,.2]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.aimX,e.aimY);c.stroke();c.setLineDash([]);c.globalAlpha=1;}}
    for(const bullet of g.bullets){
      const color=bullet.enemy?'#'+bullet.color.toString(16).padStart(6,'0'):bullet.weapon==='laser'?'#bb9dff':bullet.weapon==='homing'?'#9bffe2':'#7ce6ff';
      c.save();c.translate(bullet.x,bullet.y);c.rotate(Math.atan2(bullet.vy,bullet.vx)-Math.PI/2);c.shadowColor=color;c.shadowBlur=bullet.enemy?6:8;
      if(bullet.enemy){if(bullet.shape==='missile'){this.shape([[0,.60],[-.21,.18],[-.16,-.52],[.16,-.52],[.21,.18]],'#030a16');this.rect(-.12,-.40,.24,.8,color);canvasGlow(c,0,-.55,.25,'#ffac69',.8);this.rect(-.065,.1,.13,.30,'#fff5de');}else if(bullet.shape==='diamond'){this.shape([[0,.35],[-.29,0],[0,-.35],[.29,0]],color,'#160d2c');this.circle(0,0,.09,'#fff5ef');}else{this.circle(0,0,.36,'#030a16');this.circle(0,0,.265,color);this.circle(0,0,.1,'#fff5de');}}else this.rect(-.07,-.5,.14,bullet.weapon==='laser'?1.6:.9,color);c.restore();
    }
    const p=g.player,pose=playerPose(g),depart=state==='transition'?smooth((3.5-g.transitionTime)/3.5):g.state==='result'&&g.won&&g.boss?.dead?1:0;this.playerAnimation=state==='transition'?'depart':pose.mode;
    const playerVisible=title||g.hull>0&&(g.time<2.6||g.invulnerable<=0||Math.floor(g.invulnerable*12)%3!==0);
    this.playerTint=g.shipClass==='falcon'?'#89bcff':g.shipClass==='bulwark'?'#ffc18e':'#65dcff';this.playerSkinIndex=g.shipClass==='falcon'?1:g.shipClass==='bulwark'?2:0;
    if(playerVisible)this.ship('player',title?Math.sin(g.visualTime*.5)*.4:p.x,title?1.9:p.y+depart*34,pose,title?2:1,false,g.visualTime);
    if(!title&&g.hull>0&&state!=='transition'&&g.state!=='result'){this.circle(p.x,p.y,.09,'#e8ffff');c.strokeStyle='#ddf6ff';c.lineWidth=.04;c.beginPath();c.arc(p.x,p.y,.23,0,Math.PI*2);c.stroke();}
    if(!title&&g.power===4)for(const s of[-1,1]){this.circle(p.x+s*1.45,p.y-.15,.25,'#aedce8');this.circle(p.x+s*1.45,p.y-.05,.13,'#87f9ff');}
    if(active&&playerVisible){const y=p.y+depart*34,length=(1.3+Math.sin(g.visualTime*36)*.15)*pose.thrust;for(const s of[-1,1]){c.save();c.translate(p.x+s*.5,y-1.65);c.scale(.12,length);canvasGlow(c,0,-.5,.75,'#57d6ff',.8);c.restore();}}
    for(const q of this.cascades)q.at-=dt;const due=this.cascades.filter(q=>q.at<=0);this.cascades=this.cascades.filter(q=>q.at>0);for(const q of due)this.event({type:'explode',x:q.x,y:q.y,size:q.size});
    this.wrecks=this.wrecks.filter(w=>{w.age+=dt;if(w.age>=w.life)return false;w.y-=dt*(w.kind==='boss'?.6:2.3);const t=w.age/w.life;c.save();c.translate(w.x,w.y);c.rotate(w.age*(w.x>0?1:-1)*(w.kind==='boss'?.13:1.3));c.globalAlpha=(1-t)*.45;if(w.kind==='boss'){this.asset(bossSprite(w.stage,'core'),0,0);for(let i=0;i<2;i++)if(w.parts![i]>0)this.asset(bossSprite(w.stage,i===0?'wing0':'wing1'),(i===0?-1:1)*(w.spread!+(1-w.deploy!)*1.2),-w.spread!*.65);}else this.asset(shipSprite(w.kind),0,0);c.restore();return true;});
    for(const e of this.explosions){e.age+=dt;if(e.age<0)continue;const t=e.age/e.life,s=e.size*(e.smoke?.45+t*.7:.25+Math.sin(Math.min(1,t)*Math.PI/2)*.75);c.save();c.globalAlpha=Math.max(0,(1-t)*(e.smoke?.75:1));c.translate(e.x,e.y);c.scale(1,-1);if(e.smoke)c.drawImage(smokeMap.image,-s/2,-s/2,s,s);else{const frame=Math.min(3,Math.floor(t*4)),im=explosionAtlasMap.image,w=im.width/2,h=im.height/2;c.drawImage(im,frame%2*w,Math.floor(frame/2)*h,w,h,-s/2,-s/2,s,s);}c.restore();}this.explosions=this.explosions.filter(e=>e.age<e.life);
    this.combatEffects.drawFragments(c);this.combatEffects.drawImpacts(c);
    for(const s of this.sparks){s.life-=dt;if(s.life<=0)continue;s.x+=s.vx*dt;s.y+=s.vy*dt;c.globalAlpha=s.life/s.max;this.rect(s.x,s.y,s.size,s.size*1.5,s.color);}c.globalAlpha=1;this.sparks=this.sparks.filter(s=>s.life>0);
    this.ring.age+=dt;
    this.pulse=Math.max(0,this.pulse-dt);if(this.pulse>0){c.globalAlpha=this.pulse*.35;this.rect(-12,-22,24,44,'#92ecff');c.globalAlpha=1;}
  }
  getDiagnostics(){return {background:this.background.diagnostics(),stageEffects:this.stageEffects.diagnostics(),combatEffects:this.combatEffects.diagnostics(),air:this.air,animation:{player:this.playerAnimation,enemies:this.enemyAnimations,boss:this.bossAnimation,wrecks:this.wrecks.length},encounters:this.encounterStatus,textures:visualAssetStatus(),engine:this.engine,quality:this.quality,dpr:this.ratio,frameMs:0,particles:this.sparks.length,width:this.width,height:this.height};}
}
