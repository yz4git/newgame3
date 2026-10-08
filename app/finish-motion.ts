import type {Game,GameEvent} from './sim.ts';
import {animationClockRunning} from './motion.ts';
export interface Fragment {x:number;y:number;vx:number;vy:number;age:number;life:number;size:number;angle:number;spin:number;frame:number;}
export interface Wave {x:number;y:number;age:number;life:number;size:number;color:number;}
const fraction=(n:number)=>{const v=Math.sin(n*127.13+17.7)*43758.5;return v-Math.floor(v);};
export class FinishMotion {
 fragments:Fragment[]=[];waves:Wave[]=[];private serial=0;
 event(e:GameEvent){
  if(e.type==='stage'){this.fragments=[];this.waves=[];this.serial=0;return;}
  if(['nova','bosskill','resonance','missionstart','missionclear','missionfail','bossform','bosstransform','bossreinforce'].includes(e.type)){this.waves.push({x:e.x??0,y:e.y??0,age:0,life: .68,size:e.type==='nova'?30:e.type==='missionstart'?16:e.type==='bosstransform'?22:e.type==='bossform'?20:24,color:e.color??(e.type==='resonance'?0xffd59a:0xa5efff)});if(this.waves.length>4)this.waves.shift();}
  if(!['explode','bosskill','part','missionstart','missionclear','missionfail','bossform','bosstransform','bossreinforce'].includes(e.type))return;
  const count=e.type==='bosskill'?18:e.type==='missionstart'?16:e.type==='missionclear'?22:e.type==='bosstransform'?24:e.type==='bossform'?20:e.type==='fieldcritical'?12:e.type==='fieldburst'?9:e.type==='fieldfracture'?8:e.type==='part'?8:Math.min(9,Math.ceil((e.size??1)*4));
  for(let i=0;i<count;i++){
   const n=++this.serial,a=fraction(n)*Math.PI*2,speed=3+fraction(n+57)*9;
   this.fragments.push({x:e.x??0,y:e.y??0,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-1,age:0,life:.70+fraction(n+19)*.55,size:.32+fraction(n+11)*.65,angle:a,spin:(fraction(n+44)-.5)*8,frame:n%4});
   if(this.fragments.length>48)this.fragments.shift();
  }
 }
 update(g:Game,dt:number,reduced=false){
  if(reduced){this.fragments=[];this.waves=[];return;}if(!animationClockRunning(g))return;
  for(const p of this.fragments){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=dt*1.5;p.angle+=p.spin*dt;}
  this.fragments=this.fragments.filter(p=>p.age<p.life);
  for(const p of this.waves)p.age+=dt;this.waves=this.waves.filter(p=>p.age<p.life);
 }
 diagnostics(){return {fragments:this.fragments.length,waves:this.waves.length};}
}
