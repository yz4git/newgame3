import * as T from 'three/webgpu';
import {block} from './art.ts';
import {armourMap} from './visual-assets.ts';
import type {ShipPose} from './motion.ts';
import type {Kind} from './sim.ts';

const lightMap=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!,g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.25,'#ffffffc0');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);})();
function light(g:T.Group,name:string,x:number,y:number,color:number){const m=new T.Sprite(new T.SpriteMaterial({map:lightMap,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));m.name=name;m.position.set(x,y-.640625,2.05);m.scale.set(.32,.50,1);m.userData.animated=true;m.userData.baseX=x;m.userData.baseY=y;g.add(m);return m;}
function panel(g:T.Group,name:string,x:number,y:number,w:number,h:number,color=0x8898a5){const m=block(g,new T.MeshStandardMaterial({map:armourMap,color,metalness:.55,roughness:.3}),x,y-.625,2.0,w,h,.07);m.name=name;m.userData.animated=true;m.userData.baseX=x;m.userData.baseY=y;return m;}
/** Articulated hardware stays inside the existing combat silhouette. */
export function addShipRig(g:T.Group,kind:Kind|'player'){
  const rig=new T.Group();rig.name='animation-rig';
  const player=kind==='player',large=kind==='cruiser',ground=kind==='tank'||kind==='relic';
  const x=ground?.24:large?1.35:player?.50:kind==='drone'||kind==='dart'?.35:.62;
  const back=large?2.20:player?-1.68:kind==='drone'||kind==='dart'?.78:1.05;
  const front=ground?-1.27:large?-2.15:player?.90:kind==='drone'||kind==='dart'?-.7:-1.05;
  const color=player||kind==='carrier'?0x63dfff:kind==='weaver'||kind==='lancer'?0xff8cc8:0xffa950;
  if(!ground)for(const s of[-1,1])light(rig,'engine'+(s<0?0:1),s*x,back,color);
  if(kind!=='carrier'&&kind!=='relic')for(const s of[-1,1]){const m=light(rig,'muzzle'+(s<0?0:1),s*x,front,player?0x99eaff:0xffdca0);if(ground)m.position.set(s*x,front,.82);}
  if(player||large||kind==='fighter'||kind==='lancer')for(const s of[-1,1])panel(rig,'flap'+(s<0?0:1),s*(large?1.48:player?.74:.78),player?-.76:.40,large?.23:.15,large?.78:.45,player?0xb3cfdb:0xa38782);
  if(kind==='carrier')for(const s of[-1,1])panel(rig,'door'+(s<0?0:1),s*.23,-.1,.42,.98,0x526c87);
  const energy=light(rig,'charge',0,kind==='weaver'?0:large?-.8:ground?.15:player?-.6:-.1,color);energy.scale.set(1.0,1.0,1);
  if(kind==='weaver'||kind==='relic'){
    const rotor=new T.Group();rotor.name='spin-rig';for(let i=0;i<4;i++){const a=i*Math.PI/2,p=panel(rotor,'blade'+i,Math.cos(a)*.57,Math.sin(a)*.57,.08,.32,0xb7a2be);p.rotation.z=a;}rig.add(rotor);
  }
  g.add(rig);return g;
}
export function addBossRig(g:T.Group,color:number){
  const rig=new T.Group();rig.name='animation-rig';
  for(let i=0;i<4;i++){const a=i*Math.PI/2,p=panel(rig,'petal'+i,Math.cos(a)*.45,-.85+Math.sin(a)*.45,.31,.60,0x748799);p.rotation.z=a;p.position.z=1.9;}
  const core=light(rig,'core-light',0,-.85,color);core.position.y=-.85;core.position.z=1.8;
  for(let i=0;i<2;i++){const wing=g.getObjectByName('wing'+i) as T.Group;for(const s of[-1,1]){const m=light(wing,'boss-muzzle'+i+(s<0?0:1),(i===0?-3:3)+s*.25,-1.54,color);m.position.y=-1.54;m.position.z=1.10;}}
  g.add(rig);return g;
}
const references=new WeakMap<T.Group,Map<string,T.Object3D>>();
function nodes(g:T.Group){let map=references.get(g);if(!map){map=new Map();g.traverse(o=>{if(o.name)map!.set(o.name,o);});references.set(g,map);}return map;}
export function cloneAnimatedModel(g:T.Group){const m=g.clone();m.traverse(o=>{if(o instanceof T.Sprite||o instanceof T.Mesh&&o.userData.animated)o.material=(o.material as T.Material).clone();});return m;}
export function disposeAnimatedModel(g:T.Group){g.traverse(o=>{if(o instanceof T.Sprite||o instanceof T.Mesh&&o.userData.animated)(o.material as T.Material).dispose();});}
export function animateShip(g:T.Group,pose:ShipPose,t:number,kind:Kind|'player'){
  const n=nodes(g),pulse=.9+Math.sin(t*36)*.1;
  for(let i=0;i<2;i++){
    const engine=n.get('engine'+i) as T.Sprite|undefined;if(engine){engine.scale.set(.30*pose.thrust,.65*pose.thrust*pulse,1);engine.material.opacity=.78;}
    const muzzle=n.get('muzzle'+i) as T.Sprite|undefined;if(muzzle){muzzle.visible=pose.recoil>.04;muzzle.scale.set(.20+pose.recoil*.23,.30+pose.recoil*.6,1);muzzle.material.opacity=pose.recoil*.85;if(kind==='tank'){const x=muzzle.userData.baseX,y=muzzle.userData.baseY;muzzle.position.x=x*Math.cos(pose.turret)-y*Math.sin(pose.turret);muzzle.position.y=x*Math.sin(pose.turret)+y*Math.cos(pose.turret)+pose.recoil*.18;}}
    const flap=n.get('flap'+i);if(flap){flap.rotation.y=(i===0?-1:1)*(pose.flex*.46+pose.bank*.5);flap.position.x=flap.userData.baseX+(i===0?-1:1)*pose.flex*.08;}
    const door=n.get('door'+i);if(door)door.position.x=door.userData.baseX+(i===0?-1:1)*pose.flex*.30;
  }
  const turret=n.get('turret');if(turret){turret.rotation.z=pose.turret;turret.position.y=pose.recoil*.18;}
  const charge=n.get('charge') as T.Sprite|undefined;if(charge){charge.material.opacity=pose.charge*.45+(kind==='relic'?.2:.035);charge.scale.setScalar(.75+pose.charge*.70);}
  const spin=n.get('spin-rig');if(spin)spin.rotation.z=pose.rotor;
}
export function animateBoss(g:T.Group,pose:ReturnType<typeof import('./motion.ts').bossPose>,b:{age:number;parts:number[];spread:number}){
  const n=nodes(g);
  for(let i=0;i<4;i++){const p=n.get('petal'+i);if(!p)continue;const a=i*Math.PI/2;p.position.x=Math.cos(a)*(.45+pose.open*.52);p.position.y=-.85+Math.sin(a)*(.45+pose.open*.52);p.rotation.y=pose.open*.75;}
  const core=n.get('core-light') as T.Sprite;if(core){core.material.opacity=.22+pose.open*.5+pose.charge*.25;core.scale.setScalar(1.25+pose.open*.85+Math.sin(b.age*8)*.05);}
  for(let i=0;i<2;i++){
    const wing=n.get('wing'+i);if(wing){wing.visible=b.parts[i]>0;wing.position.x=(i===0?-1:1)*(b.spread+(1-pose.deploy)*1.2);wing.position.y=-b.spread*.65;wing.rotation.y=(i===0?-1:1)*(1-pose.deploy)*.7+Math.sin(b.age*1.5)*.035;}
    for(let j=0;j<2;j++){const m=n.get('boss-muzzle'+i+j) as T.Sprite|undefined;if(m){m.visible=pose.recoil>.02;m.material.opacity=pose.recoil;m.scale.set(.65,1.0+pose.recoil,1);}}
  }
  const rotor=n.get('rotor');if(rotor)rotor.rotation.z=pose.rotor;
}
