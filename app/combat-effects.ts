import * as T from 'three/webgpu';
import {CombatMotion} from './combat-motion.ts';
import {impactFrames,playerMap,finishMaps,debrisFrames} from './visual-assets.ts';
import {FinishMotion} from './finish-motion.ts';
import {atlasFrame} from './surface-motion.ts';
import type {Game,GameEvent} from './sim.ts';

export class CombatEffects {
  root=new T.Group();motion=new CombatMotion();finish=new FinishMotion();private impacts:T.Sprite[]=[];private echoes:T.Sprite[]=[];private fragments:T.Sprite[]=[];private waves:T.Sprite[]=[];
  constructor(){
    for(let i=0;i<24;i++){const s=new T.Sprite(new T.SpriteMaterial({map:impactFrames[0],transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;this.impacts.push(s);this.root.add(s);}
    for(let i=0;i<6;i++){const s=new T.Sprite(new T.SpriteMaterial({map:playerMap,color:0x60dcff,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;s.scale.set(3.1,4.25,1);this.echoes.push(s);this.root.add(s);}
    for(let i=0;i<48;i++){const s=new T.Sprite(new T.SpriteMaterial({map:debrisFrames[i%4],transparent:true,alphaTest:.02,depthWrite:false,toneMapped:false}));s.visible=false;this.fragments.push(s);this.root.add(s);}
    for(let i=0;i<4;i++){const s=new T.Sprite(new T.SpriteMaterial({map:finishMaps.shockwave,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;this.waves.push(s);this.root.add(s);}
  }
  event(e:GameEvent){this.motion.event(e);this.finish.event(e);}
  draw(g:Game,dt:number,reduced=false,performance=false){
    this.motion.update(g,dt,reduced);
    this.finish.update(g,dt,reduced);
    this.impacts.forEach((s,i)=>{const p=this.motion.impacts[i];s.visible=!!p;if(!p)return;const life=p.age/p.life;s.position.set(p.x,p.y-.3125,2);s.scale.setScalar(p.size*(.5+life*.75));s.material.map=impactFrames[atlasFrame(p.age,p.life)];s.material.opacity=(1-life)*.85;s.material.color.setHex(p.color);});
    this.echoes.forEach((s,i)=>{const e=this.motion.echoes[i];s.visible=!!e;if(!e)return;s.position.set(e.x,e.y,1);s.material.rotation=e.roll;s.material.opacity=(1-e.age/e.life)*.14;});
    this.fragments.forEach((s,i)=>{const p=this.finish.fragments[i];s.visible=!!p&&i<(performance?24:48);if(!p)return;s.position.set(p.x,p.y,1.85);s.scale.set(p.size,p.size*.8,1);s.material.map=debrisFrames[p.frame];s.material.rotation=p.angle;s.material.opacity=Math.min(1,(1-p.age/p.life)*3);});
    this.waves.forEach((s,i)=>{const p=this.finish.waves[i];s.visible=!!p;if(!p)return;const u=p.age/p.life;s.position.set(p.x,p.y,.75);s.scale.setScalar(p.size*(.06+u));s.material.color.setHex(p.color);s.material.rotation=u*.12;s.material.opacity=(1-u)**2*.56;});
  }
  diagnostics(){return {...this.motion.diagnostics(),...this.finish.diagnostics()};}
}
