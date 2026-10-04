import * as T from 'three/webgpu';
import {CombatMotion} from './combat-motion.ts';
import {impactFrames,playerMap} from './visual-assets.ts';
import {atlasFrame} from './surface-motion.ts';
import type {Game,GameEvent} from './sim.ts';

export class CombatEffects {
  root=new T.Group();motion=new CombatMotion();private impacts:T.Sprite[]=[];private echoes:T.Sprite[]=[];
  constructor(){
    for(let i=0;i<24;i++){const s=new T.Sprite(new T.SpriteMaterial({map:impactFrames[0],transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;this.impacts.push(s);this.root.add(s);}
    for(let i=0;i<6;i++){const s=new T.Sprite(new T.SpriteMaterial({map:playerMap,color:0x60dcff,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));s.visible=false;s.scale.set(3.1,4.25,1);this.echoes.push(s);this.root.add(s);}
  }
  event(e:GameEvent){this.motion.event(e);}
  draw(g:Game,dt:number,reduced=false){
    this.motion.update(g,dt,reduced);
    this.impacts.forEach((s,i)=>{const p=this.motion.impacts[i];s.visible=!!p;if(!p)return;const life=p.age/p.life;s.position.set(p.x,p.y-.3125,2);s.scale.setScalar(p.size*(.5+life*.75));s.material.map=impactFrames[atlasFrame(p.age,p.life)];s.material.opacity=(1-life)*.85;s.material.color.setHex(p.color);});
    this.echoes.forEach((s,i)=>{const e=this.motion.echoes[i];s.visible=!!e;if(!e)return;s.position.set(e.x,e.y,1);s.material.rotation=e.roll;s.material.opacity=(1-e.age/e.life)*.14;});
  }
  diagnostics(){return this.motion.diagnostics();}
}
