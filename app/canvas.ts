import { Game, STAGES, type GameEvent, type Kind } from './sim.ts';
import {shipSprite,bossSprite} from './canvas-art.ts';
import {CanvasBackground} from './background.ts';

// Compatibility view for browsers where all GPU contexts are unavailable.
// It shares the same fixed-step combat, controls, scores and progression.
interface Spark {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;}
export class CanvasView {
  engine='Canvas 2D';quality='COMPATIBLE';
  private ctx!:CanvasRenderingContext2D;private width=0;private height=0;private ratio=1;
  private background=new CanvasBackground();private sparks:Spark[]=[];private pulse=0;private ring={x:0,y:0,age:2};
  constructor(private canvas:HTMLCanvasElement){}
  async init(_forceWebGL=false){this.ctx=this.canvas.getContext('2d',{alpha:false})!;if(!this.ctx)throw new Error('No graphics context');this.resize();}
  resize(){const r=this.canvas.parentElement!.getBoundingClientRect();this.width=r.width;this.height=r.height;this.ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*this.ratio);this.canvas.height=Math.round(r.height*this.ratio);}
  pointerToWorld(x:number,y:number){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left)/r.width*24-12,y:(.5-(y-r.top)/r.height)*128/3};}
  private shape(points:number[][],fill:string,stroke?:string){const c=this.ctx;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.045;c.stroke();}}
  private rect(x:number,y:number,w:number,h:number,color:string){this.ctx.fillStyle=color;this.ctx.fillRect(x,y,w,h);}
  private circle(x:number,y:number,r:number,color:string){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  worldToScreen(x:number,y:number){return {x:(x/24+.5)*this.width,y:(.5-y/(128/3))*this.height};}
  private asset(asset:ReturnType<typeof shipSprite>,x:number,y:number,scale=1,tilt=0){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(tilt);c.scale(scale,-scale);
    c.drawImage(asset.canvas,asset.left,-asset.top,asset.width,asset.height);c.restore();
  }
  private ship(kind:Kind|'player',x:number,y:number,scale=1,tilt=0,flash=false){
    if(kind!=='tank'&&kind!=='relic')this.circle(x+.15,y+.6,kind==='cruiser'?1.9:1.05,'#02061170');
    this.asset(shipSprite(kind),x,y,scale,tilt);
    if(flash){this.ctx.globalAlpha=.50;this.circle(x,y,.35,'#fff8d9');this.ctx.globalAlpha=1;}
  }
  event(e:GameEvent){
    if(!['explode','bosskill','damage','nova','collect','hit','graze','resonance'].includes(e.type))return;
    const size=e.size||.7,count=e.type==='nova'||e.type==='bosskill'||e.type==='resonance'?80:e.type==='hit'?4:e.type==='graze'?2:25;
    const color=e.type==='collect'||e.type==='graze'?'#79f4ff':e.type==='hit'?'#ffe9b9':'#ffb86f';
    for(let i=0;i<count&&this.sparks.length<450;i++){
      const a=Math.random()*6.283,v=(3+Math.random()*8)*Math.sqrt(size),life=.18+Math.random()*.6;
      this.sparks.push({x:e.x||0,y:e.y||0,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:.05+Math.random()*.14});
    }
    if(e.type==='nova'||e.type==='bosskill'||e.type==='resonance'){this.ring={x:e.x||0,y:e.y||0,age:0};this.pulse=.3;}
  }
  draw(g:Game,dt:number,_frameMs:number){
    const c=this.ctx,title=g.state==='title',active=g.state==='playing'||g.state==='transition',stage=g.stage;
    c.setTransform(this.ratio,0,0,this.ratio,0,0);c.fillStyle=['#060e1b','#0a0621','#110c13'][stage];c.fillRect(0,0,this.width,this.height);
    c.translate(this.width/2,this.height/2);c.scale(this.width/24,-this.height/(128/3));
    this.background.draw(c,g);
    for(const e of g.enemies)this.ship(e.kind,e.x,e.y,1,e.kind==='dart'?Math.sin(e.age*1.5)*.15:0,e.flash>0);
    const b=g.boss;
    if(b&&!b.dead){
      this.asset(bossSprite(stage,'core'),b.x,b.y);
      for(let i=0;i<2;i++)if(b.parts[i]>0)this.asset(bossSprite(stage,i===0?'wing0':'wing1'),b.x+(i===0?-1:1)*b.spread,b.y-b.spread*.65);
      if(b.warning>0){c.globalAlpha=.15+Math.abs(Math.sin(g.visualTime*15))*.15;this.rect(b.beamX-.8,-19,1.6,b.y+19,'#ff4d87');c.globalAlpha=1;}
      if(b.beam>0){c.shadowColor='#ffa981';c.shadowBlur=20;this.rect(b.beamX-.8,-19,1.6,b.y+19,'#fff0cb');this.rect(b.beamX-.45,-19,.9,b.y+19,'#ffffff');c.shadowBlur=0;}
    }
    for(const item of g.pickups){c.save();c.translate(item.x,item.y);c.rotate(item.age);const color=item.type==='power'?'#7effff':item.type==='repair'?'#8affa6':'#ffd282';c.strokeStyle=color;c.lineWidth=.08;c.beginPath();c.arc(0,0,.58,0,Math.PI*2);c.stroke();this.shape([[0,.4],[-.35,0],[0,-.4],[.35,0]],color);c.restore();}
    for(const bullet of g.bullets)if(bullet.trail&&bullet.trail.length>1){c.strokeStyle='#6cffcc';c.lineWidth=.09;c.globalAlpha=.6;c.beginPath();bullet.trail.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}c.globalAlpha=1;
    for(const lock of g.locks){c.strokeStyle='#94ffd6';c.lineWidth=.05;const r=1.5-lock.progress*.5;c.strokeRect(lock.x-r,lock.y-r,r*2,r*2);}
    for(const e of g.enemies)if(e.charging&&e.y<13.5&&e.y>g.player.y+3.8){c.strokeStyle='#ff9d86';c.lineWidth=.06;c.beginPath();c.arc(e.x,e.y,.45+(1-e.shoot/.48)*.3,0,Math.PI*2);c.stroke();if(e.kind==='lancer'||e.kind==='tank'){c.globalAlpha=.30;c.setLineDash([.25,.2]);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.aimX,e.aimY);c.stroke();c.setLineDash([]);c.globalAlpha=1;}}
    for(const bullet of g.bullets){
      const color=bullet.enemy?'#'+bullet.color.toString(16).padStart(6,'0'):bullet.weapon==='laser'?'#bb9dff':bullet.weapon==='homing'?'#9bffe2':'#7ce6ff';
      c.save();c.translate(bullet.x,bullet.y);c.rotate(Math.atan2(bullet.vy,bullet.vx)-Math.PI/2);c.shadowColor=color;c.shadowBlur=bullet.enemy?6:8;
      if(bullet.enemy){this.circle(0,0,.36,'#030a16');this.circle(0,0,.265,color);this.circle(0,0,.1,'#fff5de');}else this.rect(-.07,-.5,.14,bullet.weapon==='laser'?1.6:.9,color);c.restore();
    }
    const p=g.player;if(title||g.hull>0&&(g.invulnerable<=0||Math.floor(g.invulnerable*12)%3!==0))this.ship('player',title?Math.sin(g.visualTime*.5)*.4:p.x,title?1.9:p.y,title?2:1,-p.vx*.007);
    if(!title&&g.hull>0){this.circle(p.x,p.y,.09,'#e8ffff');c.strokeStyle='#ddf6ff';c.lineWidth=.04;c.beginPath();c.arc(p.x,p.y,.23,0,Math.PI*2);c.stroke();}
    if(!title&&g.power===4)for(const s of[-1,1]){this.circle(p.x+s*1.45,p.y-.15,.25,'#aedce8');this.circle(p.x+s*1.45,p.y-.05,.13,'#87f9ff');}
    if(active){c.shadowColor='#63dfff';c.shadowBlur=10;this.shape([[p.x-.5,p.y-1.2],[p.x-.62,p.y-1.7-Math.random()*.3],[p.x-.38,p.y-1.7-Math.random()*.3]],'#6bdbff');this.shape([[p.x+.5,p.y-1.2],[p.x+.38,p.y-1.7-Math.random()*.3],[p.x+.62,p.y-1.7-Math.random()*.3]],'#6bdbff');c.shadowBlur=0;}
    for(const s of this.sparks){s.life-=dt;if(s.life<=0)continue;s.x+=s.vx*dt;s.y+=s.vy*dt;c.globalAlpha=s.life/s.max;this.rect(s.x,s.y,s.size,s.size*1.5,s.color);}c.globalAlpha=1;this.sparks=this.sparks.filter(s=>s.life>0);
    this.ring.age+=dt;if(this.ring.age<.8){c.globalAlpha=1-this.ring.age/.8;c.strokeStyle='#92f3ff';c.lineWidth=.13;c.beginPath();c.arc(this.ring.x,this.ring.y,this.ring.age*34,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    this.pulse=Math.max(0,this.pulse-dt);if(this.pulse>0){c.globalAlpha=this.pulse*.35;this.rect(-12,-22,24,44,'#92ecff');c.globalAlpha=1;}
  }
  getDiagnostics(){return {background:this.background.diagnostics(),engine:this.engine,quality:this.quality,dpr:this.ratio,frameMs:0,particles:this.sparks.length,width:this.width,height:this.height};}
}
