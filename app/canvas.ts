import { Game, STAGES, type GameEvent, type Kind } from './sim.ts';

// Compatibility view for browsers where all GPU contexts are unavailable.
// It shares the same fixed-step combat, controls, scores and progression.
interface Spark {x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;}
export class CanvasView {
  engine='Canvas 2D';quality='COMPATIBLE';
  private ctx!:CanvasRenderingContext2D;private width=0;private height=0;private ratio=1;
  private scroll=0;private sparks:Spark[]=[];private pulse=0;private ring={x:0,y:0,age:2};
  constructor(private canvas:HTMLCanvasElement){}
  async init(_forceWebGL=false){this.ctx=this.canvas.getContext('2d',{alpha:false})!;if(!this.ctx)throw new Error('No graphics context');this.resize();}
  resize(){const r=this.canvas.parentElement!.getBoundingClientRect();this.width=r.width;this.height=r.height;this.ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*this.ratio);this.canvas.height=Math.round(r.height*this.ratio);}
  pointerToWorld(x:number,y:number){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left)/r.width*24-12,y:(.5-(y-r.top)/r.height)*128/3};}
  private shape(points:number[][],fill:string,stroke?:string){const c=this.ctx;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.045;c.stroke();}}
  private rect(x:number,y:number,w:number,h:number,color:string){this.ctx.fillStyle=color;this.ctx.fillRect(x,y,w,h);}
  private circle(x:number,y:number,r:number,color:string){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  private ship(kind:Kind|'player',x:number,y:number,scale=1,tilt=0,flash=false){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(tilt);c.scale(scale,scale);
    if(kind==='player'){
      this.shape([[0,1.55],[-.36,.1],[-1.5,-.75],[-1.4,-1],[-.44,-.55],[-.35,-1.15],[.35,-1.15],[.44,-.55],[1.4,-1],[1.5,-.75],[.36,.1]],'#cce1eb','#5a849c');
      this.shape([[-.4,.03],[-1.42,-.77],[-1.35,-.96],[-.39,-.55]],'#274b77');this.shape([[.4,.03],[1.42,-.77],[1.35,-.96],[.39,-.55]],'#274b77');
      this.shape([[0,.8],[-.2,-.2],[0,-.47],[.2,-.2]],'#65e6ff');
      this.rect(-.60,-1.05,.2,.78,'#7d99aa');this.rect(.40,-1.05,.2,.78,'#7d99aa');
      c.shadowColor='#38d5ff';c.shadowBlur=14;this.circle(-.49,-1.2,.12,'#b7faff');this.circle(.49,-1.2,.12,'#b7faff');
    }else if(kind==='tank'||kind==='relic'){
      this.rect(-1,-.95,2,1.9,'#112433');for(const s of[-1,1])this.rect(s*.8-.18,-.93,.36,1.86,'#698292');
      if(kind==='tank'){this.circle(0,0,.63,flash?'#fff':'#ad9c7d');this.rect(-.12,-1.2,.24,1.2,'#bdc6ca');this.circle(0,0,.23,'#667378');}
      else{this.rect(-.55,-.55,1.1,1.1,'#273f57');c.shadowColor='#ffc96a';c.shadowBlur=15;this.shape([[0,.55],[-.45,0],[0,-.55],[.45,0]],'#ffd77d');}
    }else if(kind==='cruiser'){
      this.shape([[0,-2.3],[-1.4,-1.1],[-1.8,1.4],[-1.05,2],[1.05,2],[1.8,1.4],[1.4,-1.1]],flash?'#fff':'#864453','#b58993');
      this.shape([[0,-1.9],[-.4,.05],[-.3,1.5],[.3,1.5],[.4,.05]],'#20384f');for(const s of[-1,1]){this.rect(s*1.1-.2,-1,.4,1.9,'#a1acb6');this.rect(s*1.1-.14,-1.17,.28,.19,'#ffcf88');}this.circle(0,-.4,.22,'#ffbe65');
    }else if(kind==='carrier'){
      this.shape([[-.5,-1],[-1,.3],[-.75,.85],[.75,.85],[1,.3],[.5,-1]],flash?'#fff':'#277b9d','#76cce1');
      this.rect(-.28,-.33,.56,.6,'#84f7ff');for(const s of[-1,1])this.rect(s*.75-.1,-.1,.2,.6,'#bedde7');
    }else{
      const larger=kind==='fighter'?1.3:1;c.scale(larger,larger);
      this.shape([[0,-1],[-.46,-.15],[-.95,.45],[-.85,.8],[-.3,.42],[0,.85],[.3,.42],[.85,.8],[.95,.45],[.46,-.15]],flash?'#fff':kind==='dart'?'#9e68c5':'#ba495e','#d999a8');
      this.shape([[0,-.72],[-.15,.30],[.15,.30]],kind==='dart'?'#ff8cdd':'#ffd896');this.rect(-.1,.3,.2,.32,'#293653');
    }c.restore();
  }
  event(e:GameEvent){
    if(!['explode','bosskill','damage','nova','collect','hit','graze'].includes(e.type))return;
    const size=e.size||.7,count=e.type==='nova'||e.type==='bosskill'?80:e.type==='hit'?4:e.type==='graze'?2:25;
    const color=e.type==='collect'||e.type==='graze'?'#79f4ff':e.type==='hit'?'#ffe9b9':'#ffb86f';
    for(let i=0;i<count&&this.sparks.length<450;i++){
      const a=Math.random()*6.283,v=(3+Math.random()*8)*Math.sqrt(size),life=.18+Math.random()*.6;
      this.sparks.push({x:e.x||0,y:e.y||0,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,max:life,color,size:.05+Math.random()*.14});
    }
    if(e.type==='nova'||e.type==='bosskill'){this.ring={x:e.x||0,y:e.y||0,age:0};this.pulse=.3;}
  }
  draw(g:Game,dt:number,_frameMs:number){
    const c=this.ctx,title=g.state==='title',active=g.state==='playing'||g.state==='transition',stage=g.stage;
    this.scroll+=dt*(active?4.4:title?1.4:0);
    c.setTransform(this.ratio,0,0,this.ratio,0,0);c.fillStyle=['#060e1b','#0a0621','#110c13'][stage];c.fillRect(0,0,this.width,this.height);
    c.translate(this.width/2,this.height/2);c.scale(this.width/24,-this.height/(128/3));
    if(stage===1){
      for(const[x,y,color]of[[-7,6,'#573572'],[7,-3,'#204a6c']]as[number,number,string][]){const glow=c.createRadialGradient(x,y,0,x,y,17);glow.addColorStop(0,color);glow.addColorStop(1,'#0a062100');c.fillStyle=glow;c.fillRect(-12,-22,24,44);}
      for(let i=0;i<100;i++){const x=Math.sin(i*48.5)*11.7,y=((i*13.381-this.scroll*.25+12000)%44)-22;this.circle(x,y,i%4===0?.05:.025,i%3===0?'#709ca8':'#506183');}
      for(let row=-4;row<5;row++){const y=row*6-this.scroll%6;for(const s of[-1,1]){
        c.save();c.translate(s*11.7,y);c.rotate(row*.3);this.shape([[-1.8,-1],[-1.2,1.8],[.6,2.2],[2,0],[1,-2]],'#343053','#525077');c.restore();this.circle(s*10.6,y+.6,.28,'#9580c3');}}
    }else{
      this.rect(-12,-22,24,44,stage===0?'#0d202d':'#202028');
      for(let row=-6;row<=6;row++){const y=row*4-this.scroll%4;
        this.rect(-5.5,y,11,3.75,stage===0?'#142b3c':'#24222a');this.rect(-5.5,y+.04,11,.07,'#070f18');
        for(const s of[-1,1]){
          this.rect(s*9.0-2.6,y,5.2,3.8,stage===0?'#173b50':'#4c3c3b');this.rect(s*5.75,y,.05,3.7,stage===0?'#3b95ab':'#b35c3d');
          for(let j=0;j<4;j++)this.rect(s*9.0-2.2+j*1.1,y+.35,.65,.6,stage===0?'#0a1c2c':'#201e24');
          this.rect(s*8.8-.9,y+1.4,1.8,1.85,stage===0?'#0c2537':'#242a32');this.rect(s*8.8-.32,y+2,.64,.62,stage===0?'#378f9f':'#c67552');
          if(stage===2){this.rect(s*4.9,y,.12,3.5,'#bd633e');this.rect(s*4.2,y,.04,3.5,'#813d36');}
        }
      }
    }
    for(const e of g.enemies)this.ship(e.kind,e.x,e.y,1,e.kind==='dart'?Math.sin(e.age*1.5)*.15:0,e.flash>0);
    const b=g.boss;
    if(b&&!b.dead){
      c.save();c.translate(b.x,b.y);const fill=['#526b83','#76529b','#946855'][stage],light=['#85e5ff','#ffa8e1','#ffe2a0'][stage];
      this.shape([[0,-3.2],[-1.9,-1.2],[-2.1,1.7],[-1.1,2.4],[1.1,2.4],[2.1,1.7],[1.9,-1.2]],fill,'#b2a7b3');
      for(let i=0;i<2;i++)if(b.parts[i]>0){const s=i===0?-1:1;this.shape([[s*1.4,1.4],[s*3.1,2],[s*5,.4],[s*4.8,-1.3],[s*3,-1.9],[s*2,-.8]],fill,'#b2a7b3');this.rect(s*3.5-.6,-.7,1.2,1.8,'#263445');this.rect(s*3-.25,-1.65,.5,1.5,'#a7aabd');this.rect(s*3-.18,-1.72,.36,.20,light);}
      this.shape([[0,-2.4],[-.7,-.5],[-.6,1.4],[.6,1.4],[.7,-.5]],'#16243a');c.shadowColor=light;c.shadowBlur=14;this.circle(0,-.9,.65,light);this.circle(0,-.9,.40,'#e8faff');c.restore();
      if(b.warning>0){c.globalAlpha=.15+Math.abs(Math.sin(g.visualTime*15))*.15;this.rect(b.beamX-.8,-19,1.6,b.y+19,'#ff4d87');c.globalAlpha=1;}
      if(b.beam>0){c.shadowColor='#ffa981';c.shadowBlur=20;this.rect(b.beamX-.8,-19,1.6,b.y+19,'#fff0cb');this.rect(b.beamX-.45,-19,.9,b.y+19,'#ffffff');c.shadowBlur=0;}
    }
    for(const item of g.pickups){c.save();c.translate(item.x,item.y);c.rotate(item.age);const color=item.type==='power'?'#7effff':item.type==='repair'?'#8affa6':'#ffd282';c.strokeStyle=color;c.lineWidth=.08;c.beginPath();c.arc(0,0,.58,0,Math.PI*2);c.stroke();this.shape([[0,.4],[-.35,0],[0,-.4],[.35,0]],color);c.restore();}
    for(const bullet of g.bullets){
      const color=bullet.enemy?'#ffd484':bullet.weapon==='laser'?'#bb9dff':bullet.weapon==='homing'?'#9bffe2':'#7ce6ff';
      c.save();c.translate(bullet.x,bullet.y);c.rotate(Math.atan2(bullet.vy,bullet.vx)-Math.PI/2);c.shadowColor=color;c.shadowBlur=bullet.enemy?6:8;
      if(bullet.enemy)this.circle(0,0,.23,color);else this.rect(-.07,-.5,.14,bullet.weapon==='laser'?1.6:.9,color);c.restore();
    }
    const p=g.player;if(title||g.hull>0&&(g.invulnerable<=0||Math.floor(g.invulnerable*12)%3!==0))this.ship('player',title?Math.sin(g.visualTime*.5)*.4:p.x,title?1.9:p.y,title?2:1,-p.vx*.007);
    if(!title&&g.hull>0){this.circle(p.x,p.y,.09,'#e8ffff');c.strokeStyle='#ddf6ff';c.lineWidth=.04;c.beginPath();c.arc(p.x,p.y,.23,0,Math.PI*2);c.stroke();}
    if(!title&&g.power===4)for(const s of[-1,1]){this.circle(p.x+s*1.45,p.y-.15,.25,'#aedce8');this.circle(p.x+s*1.45,p.y-.05,.13,'#87f9ff');}
    if(active){c.shadowColor='#63dfff';c.shadowBlur=10;this.shape([[p.x-.5,p.y-1.2],[p.x-.62,p.y-1.7-Math.random()*.3],[p.x-.38,p.y-1.7-Math.random()*.3]],'#6bdbff');this.shape([[p.x+.5,p.y-1.2],[p.x+.38,p.y-1.7-Math.random()*.3],[p.x+.62,p.y-1.7-Math.random()*.3]],'#6bdbff');c.shadowBlur=0;}
    for(const s of this.sparks){s.life-=dt;if(s.life<=0)continue;s.x+=s.vx*dt;s.y+=s.vy*dt;c.globalAlpha=s.life/s.max;this.rect(s.x,s.y,s.size,s.size*1.5,s.color);}c.globalAlpha=1;this.sparks=this.sparks.filter(s=>s.life>0);
    this.ring.age+=dt;if(this.ring.age<.8){c.globalAlpha=1-this.ring.age/.8;c.strokeStyle='#92f3ff';c.lineWidth=.13;c.beginPath();c.arc(this.ring.x,this.ring.y,this.ring.age*34,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    this.pulse=Math.max(0,this.pulse-dt);if(this.pulse>0){c.globalAlpha=this.pulse*.35;this.rect(-12,-22,24,44,'#92ecff');c.globalAlpha=1;}
  }
  getDiagnostics(){return {engine:this.engine,quality:this.quality,dpr:this.ratio,frameMs:0,particles:this.sparks.length,width:this.width,height:this.height};}
}
