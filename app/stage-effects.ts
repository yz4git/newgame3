import * as T from 'three/webgpu';
import {STAGES} from './stages.ts';
import {LANDMARKS,noise,stageDistance} from './bg-map.ts';
import {block as sharedBlock,ball as sharedBall,glow,radialTexture} from './art.ts';
import {terrainMaps,playerMap,armourMap} from './visual-assets.ts';
import {worldClock,smooth,wrap,clamp,presentationState,WORLD_CUES} from './motion.ts';
import type {Game} from './sim.ts';

const dummy=new T.Object3D();
function block(...args:Parameters<typeof sharedBlock>){const m=sharedBlock(...args);m.geometry=m.geometry.clone();return m;}
function ball(...args:Parameters<typeof sharedBall>){const m=sharedBall(...args);m.geometry=m.geometry.clone();return m;}
/** Low-cost moving scenery. Everything is decorative and below the combat plane. */
export class StageEffects{
  root=new T.Group();private props=new T.Group();private stage=-1;
  private dustMap=radialTexture();private weather:T.InstancedMesh;private layers:T.Group[]=[];
  private convoy=new T.Group();private ambient=0;private time=0;
  constructor(){
    this.weather=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:this.dustMap,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),112);
    this.weather.frustumCulled=false;this.weather.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(this.props,this.weather);this.setStage(0);
  }
  private clearProps(){const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();this.props.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);if(!Array.isArray(o.material))mats.add(o.material);}if(o instanceof T.Sprite)mats.add(o.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());this.props.clear();this.layers=[];}
  private mist(g:T.Group,name:string,x:number,y:number,size:number,color:number){const s=new T.Sprite(new T.SpriteMaterial({map:this.dustMap,color,transparent:true,opacity:.25,depthWrite:false}));s.name=name;s.position.set(x,y,-1.5);s.scale.set(size,size*1.6,1);g.add(s);return s;}
  private setStage(stage:number){
    if(this.stage===stage)return;this.stage=stage;this.clearProps();const env=STAGES[stage].environment,color=STAGES[stage].color;
    (this.weather.material as T.MeshBasicMaterial).color.setHex(env==='lava'?0xffbb79:env==='jungle'?0xadffd6:0xcceaff);
    for(const [i,entry]of LANDMARKS[stage].entries()){
      const g=new T.Group();g.position.x=entry.x;g.scale.setScalar(entry.scale);g.userData.entry=i;g.userData.kind=entry.kind;this.props.add(g);this.layers.push(g);
      if(['orbital','gate','temple'].includes(entry.kind)){
        const rotor=new T.Group();rotor.name='mechanism';rotor.position.z=-1.9;
        const r=entry.kind==='gate'?5.7:entry.kind==='orbital'?4.7:2.6;
        for(let j=0;j<8;j++){const a=j*Math.PI/4,p=block(rotor,glow(color,1.3),Math.cos(a)*r,Math.sin(a)*r,0,.045,.48,.035);p.rotation.z=a;}
        const ring=new T.Mesh(new T.RingGeometry(r-.045,r+.045,48),new T.MeshBasicMaterial({color,transparent:true,opacity:.45,depthWrite:false,toneMapped:false}));rotor.add(ring);g.add(rotor);
      }else if(entry.kind==='submarine'){
        for(let j=0;j<3;j++){const wake=new T.Mesh(new T.RingGeometry(1,1.06,36,1,0,Math.PI),new T.MeshBasicMaterial({color:0xb5eaff,transparent:true,opacity:.25,depthWrite:false}));wake.name='wake'+j;wake.position.z=-2.4;g.add(wake);}
      }else if(entry.kind==='furnace'||entry.kind==='reactor'){
        const piston=new T.Group();piston.name='mechanism';piston.position.z=-1.8;
        for(const s of[-1,1]){block(piston,new T.MeshStandardMaterial({color:0x7b8589,map:armourMap,metalness:.7,roughness:.4}),s*1.75,0,0,.16,3.1,.15);block(piston,glow(0xffa14c,1.2),s*1.75,-1.4,.11,.06,.24,.05);}g.add(piston);
        this.mist(g,'steam',0,1.2,3.8,env==='lava'?0xbe8365:0x82b5dc);
      }else if(entry.kind==='waterfall'||entry.kind==='glacier'){
        for(let j=0;j<3;j++)this.mist(g,'mist'+j,(j-1)*1.5,0,3.2,env==='ice'?0xc9eafa:0xcaf4df);
      }else{
        const radar=new T.Group();radar.name='mechanism';radar.position.z=-1.7;
        const sector=new T.Shape();sector.moveTo(0,0);for(let j=0;j<=8;j++){const a=j/8*.5;sector.lineTo(Math.sin(a)*3.4,Math.cos(a)*3.4);}sector.closePath();
        radar.add(new T.Mesh(new T.ShapeGeometry(sector),new T.MeshBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false,toneMapped:false})));g.add(radar);
      }
    }
    this.convoy=new T.Group();this.convoy.name='flyover';
    const ocean=env==='ocean',ice=env==='ice';
    for(let i=0;i<3;i++){
      const craft=new T.Group();craft.position.set((i-1)*2.9,(i===1?1:0)*2,-2.0);
      if(ocean||ice){
        ball(craft,new T.MeshStandardMaterial({map:armourMap,color:ice?0xc7d5dd:0x647d94,metalness:.55,roughness:.38}),0,0,0,.38,1.1,.3);
        block(craft,glow(0x7febff,1.1),0,-.6,.2,.23,.22,.08);
        const rotor=new T.Group();rotor.name='rotor';rotor.position.z=.45;
        for(const a of[0,Math.PI/2]){const blade=block(rotor,new T.MeshBasicMaterial({color:0x91b0bd,transparent:true,opacity:.5}),0,0,0,.07,3,.025);blade.rotation.z=a;}craft.add(rotor);
      }else{
        const s=new T.Sprite(new T.SpriteMaterial({map:playerMap,color:env==='lava'?0xa9c3de:0x6da9cb,transparent:true,opacity:.65,depthWrite:false,toneMapped:false}));s.scale.set(1.9,2.6,1);s.material.rotation=-.58;craft.add(s);
      }this.convoy.add(craft);
    }this.props.add(this.convoy);
    if(env==='jungle')for(let i=0;i<12;i++){
      const leaf=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({map:terrainMaps.canopy,color:0x7eaa79,transparent:true,alphaTest:.18,depthWrite:false}));leaf.name='wind-leaf';leaf.position.set((i%2?1:-1)*(10.9+noise(i,stage)),i*5-28,-1.7);leaf.userData.seed=i;this.props.add(leaf);
    }
  }
  draw(g:Game,performance=false,reduced=false){
    this.setStage(g.stage);const env=STAGES[g.stage].environment,t=this.time=worldClock(g),distance=g.state==='title'?18+t*1.4:stageDistance(t),boss=!!g.boss&&!g.boss.dead;
    const count=reduced?18:performance?34:env==='ice'?100:env==='lava'?78:env==='jungle'?60:42;this.ambient=count;
    for(let i=0;i<count;i++){
      const seed=noise(i,g.stage,94),side=i%2?1:-1,edge=env==='lava'||env==='asteroids'||env==='jungle';
      const x=edge?side*(7.2+seed*6):seed*27-13.5,y=wrap(noise(i,stageSeed(g.stage))*54-t*(env==='lava'?-2.2:env==='ice'?4.8:2.1),54)-27;
      const flutter=reduced?0:Math.sin(t*(.4+seed)+i)*(env==='ice'?1.2:.4),size=env==='ice'?.03+seed*.08:env==='lava'?.04+seed*.11:.055+seed*.09;
      dummy.position.set(x+flutter,y,env==='ice'&&i%5===0?2.5:-1.2);dummy.rotation.set(0,0,env==='ice'?-.35:0);dummy.scale.set(size,env==='ice'?size*2.8:size*(env==='lava'?2:1),1);dummy.updateMatrix();this.weather.setMatrixAt(i,dummy.matrix);
    }this.weather.count=count;this.weather.instanceMatrix.needsUpdate=true;
    for(const layer of this.layers){
      const entry=LANDMARKS[g.stage][layer.userData.entry],kind=entry.kind;layer.position.y=entry.distance-distance;layer.visible=Math.abs(layer.position.y)<38;
      const mechanism=layer.getObjectByName('mechanism');if(mechanism){if(kind==='furnace'||kind==='reactor')mechanism.position.y=Math.sin(t*2.7+layer.userData.entry)*.55;else mechanism.rotation.z=t*(kind==='temple'?.5:kind==='orbital'?.18:.7);}
      for(let j=0;j<3;j++){
        const mist=layer.getObjectByName('mist'+j) as T.Sprite|undefined;if(mist){mist.material.opacity=.15+.08*Math.sin(t*1.3+j);mist.position.y=Math.sin(t*.7+j)*.6;}
        const wake=layer.getObjectByName('wake'+j) as T.Mesh|undefined;if(wake){const a=wrap(t*.8+j/3,1);wake.scale.set(1+a*2.2,(1+a*2.2)*.6,1);wake.position.y=1.8+a*4;(wake.material as T.MeshBasicMaterial).opacity=(1-a)*.35;}
      }
      const steam=layer.getObjectByName('steam') as T.Sprite|undefined;if(steam){const pressure=.5+.5*Math.sin(t*2+layer.userData.entry);steam.scale.set(2.7+pressure,4+pressure*3,1);steam.material.opacity=.12+pressure*.13;}
    }
    // A single timed flyover per sector, then a distant relief convoy before the boss.
    const flight=t<16?(t-8)/7:(t-(STAGES[g.stage].duration*.62))/7;
    this.convoy.visible=!reduced&&!boss&&presentationState(g)!=='transition'&&flight>0&&flight<1;
    this.convoy.position.set(-18+flight*36,13-flight*9,0);this.convoy.rotation.z=-.28;
    this.convoy.traverse(o=>{if(o.name==='rotor')o.rotation.z=t*22;});
    this.props.children.forEach(o=>{if(o.name==='wind-leaf'){const s=o.userData.seed;o.rotation.z=Math.sin(t*.9+s)*.06;o.position.y=wrap(s*5-distance,60)-30;}});
    this.root.visible=g.state!=='result'||g.won;
  }
  diagnostics(){return {feature:WORLD_CUES[this.stage].feature,clock:this.time,ambient:this.ambient,mechanisms:this.layers.length,flyover:this.convoy.visible};}
}
function stageSeed(stage:number){return stage*37+13;}
