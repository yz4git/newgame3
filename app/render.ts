import * as T from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Game, STAGES, type GameEvent, type Kind } from './sim.ts';

const metal=(c: number,emission=0)=>new T.MeshStandardMaterial({color:c,metalness:.55,roughness:.48,flatShading:true,emissive:c,emissiveIntensity:emission});
const glow=(c: number,p=2)=>new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(p),toneMapped:false});
const boxGeometry=new T.BoxGeometry(1,1,1);
const sphereGeometry=new T.IcosahedronGeometry(1,1);
const shotGeometry=new T.SphereGeometry(1,6,4);
const dummy=new T.Object3D();
const cyan=glow(0x52e7ff,2.6),gold=glow(0xffc765,2.6),pink=glow(0xff668f,2.0);
const white=metal(0xd6e8ee),navy=metal(0x203d60),dark=metal(0x101d30),steel=metal(0x617787);
function block(g: T.Group,mat: T.Material,x: number,y: number,z: number,sx: number,sy: number,sz: number) {
  const m=new T.Mesh(boxGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;
}
function hull(g:T.Group,points:number[][],depth:number,mat:T.Material,z=0){
  const s=new T.Shape();s.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)s.lineTo(points[i][0],points[i][1]);s.closePath();
  const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.07,bevelThickness:.05});
  const m=new T.Mesh(geo,mat);m.position.z=z;g.add(m);return m;
}
function ball(g:T.Group,mat:T.Material,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const m=new T.Mesh(sphereGeometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
function batch(group:T.Group){
  group.updateMatrixWorld(true);const bucket=new Map<T.Material,T.BufferGeometry[]>();
  group.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)){
    const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);
    const list=bucket.get(o.material)||[];list.push(geo);bucket.set(o.material,list);
  }});
  const result=new T.Group();for(const [mat,list]of bucket){const geo=mergeGeometries(list,false);if(geo)result.add(new T.Mesh(geo,mat));for(const item of list)item.dispose();}
  return result;
}
function shipModel(kind:Kind|'player'){
  const g=new T.Group();
  if(kind==='player'){
    hull(g,[[0,1.6],[-.35,.35],[-.42,-1],[.42,-1],[.35,.35]],.32,white);
    hull(g,[[-.3,.2],[-1.55,-.75],[-1.48,-1.1],[-.3,-.65]],.15,navy);
    hull(g,[[.3,.2],[1.55,-.75],[1.48,-1.1],[.3,-.65]],.15,navy);
    hull(g,[[0,.75],[-.23,-.2],[.23,-.2]],.18,cyan,.37);
    for(const s of [-1,1]){
      block(g,steel,s*.48,-.65,.26,.28,1.3,.26);block(g,cyan,s*.5,-1.26,.2,.22,.22,.15);
      hull(g,[[s*.52,-.2],[s*.78,-.7],[s*.95,-.88],[s*.58,-.8]],.08,white,.25);
      block(g,pink,s*1.3,-.7,.2,.09,.34,.08);
    }
  }else if(kind==='drone'||kind==='dart'){
    const red=metal(kind==='dart'?0xb975df:0xb84047),accent=kind==='dart'?pink:gold;
    hull(g,[[0,-.92],[-.55,.35],[-.9,.7],[-.35,.55],[0,.8],[.35,.55],[.9,.7],[.55,.35]],.24,red);
    block(g,dark,0,.2,.2,.35,.7,.2);ball(g,accent,0,-.15,.38,.18,.35,.1);
    for(const s of[-1,1])block(g,steel,s*.55,.35,.25,.22,.44,.16);
  }else if(kind==='fighter'){
    const red=metal(0xaa384b);
    hull(g,[[0,-1.25],[-.48,-.45],[-1.4,.6],[-1.2,1],[-.4,.45],[0,1.2],[.4,.45],[1.2,1],[1.4,.6],[.48,-.45]],.4,red);
    hull(g,[[0,-.8],[-.24,.3],[.24,.3]],.2,gold,.45);
    for(const s of[-1,1]){block(g,steel,s*.82,.24,.4,.35,.8,.24);block(g,gold,s*.82,-.24,.44,.22,.15,.1);}
  }else if(kind==='tank'){
    block(g,dark,0,0,0,2,1.8,.35);
    for(const s of[-1,1]){block(g,steel,s*.8,0,.15,.4,1.95,.26);for(let j=0;j<5;j++)block(g,navy,s*.82,-.78+j*.38,.35,.45,.07,.06);}
    ball(g,metal(0xb5976b),0,0,.45,.68,.7,.35);block(g,steel,0,-.7,.52,.25,1.1,.23);block(g,gold,0,-1.2,.53,.19,.15,.12);
  }else if(kind==='carrier'){
    hull(g,[[-.5,-1.1],[-1,.1],[-.85,.8],[.85,.8],[1,.1],[.5,-1.1]],.38,metal(0x267c96));
    block(g,cyan,0,-.1,.45,.55,.5,.12);for(const s of[-1,1])block(g,white,s*.75,.4,.2,.3,.7,.3);
    block(g,cyan,0,.7,.4,.45,.12,.1);
  }else if(kind==='relic'){
    block(g,steel,0,0,.05,1.6,1.6,.32);block(g,navy,0,0,.27,1.2,1.2,.17);
    const b=ball(g,gold,0,0,.53,.48,.48,.15);b.rotation.z=Math.PI/4;
    for(const s of[-1,1])block(g,gold,s*.6,0,.4,.08,1.2,.06);
  }else{
    hull(g,[[0,-2.3],[-1.35,-1.2],[-1.85,1.5],[-1.1,2],[1.1,2],[1.85,1.5],[1.35,-1.2]],.8,metal(0x834554));
    hull(g,[[0,-1.7],[-.5,0],[-.4,1.4],[.4,1.4],[.5,0]],.25,navy,.8);
    for(const s of[-1,1]){block(g,steel,s*1.2,0,.75,.48,2.1,.4);block(g,gold,s*1.2,-1.0,.9,.3,.2,.2);block(g,pink,s*.55,1.3,1,.16,.5,.1);}
    ball(g,gold,0,-.3,1.1,.25,.6,.12);
  }
  return batch(g);
}
function bossModel(stage:number){
  const g=new T.Group(),c=metal([0x485d74,0x6c4487,0x845342][stage]),accent=[cyan,pink,gold][stage];
  const body=new T.Group();
  hull(body,[[0,-3.1],[-1.8,-1.2],[-2.15,1.5],[-1.3,2.4],[1.3,2.4],[2.15,1.5],[1.8,-1.2]],1.0,c);
  hull(body,[[0,-2.7],[-.9,-.5],[-.75,1.7],[.75,1.7],[.9,-.5]],.25,dark,1.0);
  const core=new T.Mesh(new T.TorusGeometry(.72,.17,8,24),accent);core.position.set(0,-.8,1.45);body.add(core);
  ball(body,accent,0,-.8,1.37,.44,.5,.17);
  for(const s of[-1,1]){block(body,steel,s*1.15,.5,1.15,.36,1.9,.25);block(body,accent,s*1.15,-.5,1.28,.14,.9,.08);}
  for(let i=0;i<5;i++)block(body,steel,0,1.1+i*.26,1.07,1.05,.1,.15);
  g.add(batch(body));
  for(let i=0;i<2;i++){
    const wing=new T.Group(),s=i===0?-1:1;
    hull(wing,[[s*1.4,1.4],[s*3.1,2.0],[s*5.0,.4],[s*4.8,-1.3],[s*3.0,-1.9],[s*2,-.8]],.55,c);
    block(wing,dark,s*3.5,.15,.7,1.6,1.8,.25);block(wing,steel,s*3,-.8,.9,.7,1.6,.38);
    block(wing,accent,s*3,-1.65,.9,.47,.14,.18);
    for(let j=0;j<3;j++)block(wing,accent,s*(3.1+j*.4),.8,.99,.17,.55,.06);
    const w=batch(wing);w.name='wing'+i;g.add(w);
  }
  return g;
}
function radialTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.16,'rgba(255,255,255,.7)');grad.addColorStop(.5,'rgba(255,255,255,.13)');grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);return new T.CanvasTexture(c);
}
interface Particle {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;max:number;size:number;color:T.Color;}
export class View {
  scene=new T.Scene();camera=new T.OrthographicCamera(-12,12,64/3,-64/3,.1,110);
  renderer!: T.WebGPURenderer | import('three').WebGLRenderer;
  pipeline: T.RenderPipeline | null=null;engine='';quality='';
  private player=shipModel('player');private satellites:T.Group[]=[];
  private models=new Map<number,T.Group>();private templates=new Map<Kind,T.Group>();private boss:T.Group|null=null;private bossStage=-1;
  private theme=-1;private terrain:T.Group[]=[];private terrainRoot=new T.Group();private terrainMaterials:T.Material[]=[];private atmosphere=new T.Group();
  private stars:T.InstancedMesh;private starData:Float32Array;
  private shots:T.InstancedMesh;private shotColor=new T.Color();private particles:Particle[]=[];private sparkMesh:T.InstancedMesh;
  private pickups=new Map<number,T.Group>();private ring:T.Mesh;private indicator:T.Group;
  private beam:T.Mesh;private warning:T.Mesh;private shake=0;private spriteTexture=radialTexture();
  private frameAverage=16.6;private frames=0;private pixelRatio=1.5;private lastDprChange=0;
  private width=0;private height=0;private epoch=0;
  constructor(private canvas:HTMLCanvasElement){
    this.scene.background=new T.Color(0x030914);this.camera.position.set(0,-7.8,40);this.camera.lookAt(0,0,0);
    this.scene.add(new T.HemisphereLight(0xb9e7ff,0x18162c,2.0));
    const key=new T.DirectionalLight(0xe6f8ff,3.0);key.position.set(-10,18,28);this.scene.add(key);
    const rim=new T.DirectionalLight(0x526bff,2.0);rim.position.set(16,-5,12);this.scene.add(rim);
    this.scene.add(this.terrainRoot,this.atmosphere);this.player.position.z=1.0;this.scene.add(this.player);
    for(const s of[-1,1]){const satellite=new T.Group();ball(satellite,white,0,0,0,.3,.4,.23);ball(satellite,cyan,0,.15,.22,.14,.2,.06);satellite.position.z=1;this.satellites.push(satellite);this.scene.add(satellite);}
    const bulletMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
    this.shots=new T.InstancedMesh(shotGeometry,bulletMat,740);this.shots.setColorAt(0,new T.Color(0xffffff));this.shots.instanceColor!.setUsage(T.DynamicDrawUsage);
    this.shots.instanceMatrix.setUsage(T.DynamicDrawUsage);this.shots.frustumCulled=false;this.scene.add(this.shots);
    this.sparkMesh=new T.InstancedMesh(boxGeometry,new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,opacity:.95}),1600);
    this.sparkMesh.setColorAt(0,new T.Color(0xffffff));this.sparkMesh.instanceColor!.setUsage(T.DynamicDrawUsage);
    this.sparkMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.sparkMesh.frustumCulled=false;this.scene.add(this.sparkMesh);
    this.stars=new T.InstancedMesh(boxGeometry,new T.MeshBasicMaterial({color:0x83caff,toneMapped:false}),200);
    this.starData=new Float32Array(200*4);for(let i=0;i<200;i++){this.starData[i*4]=(Math.random()-.5)*48;this.starData[i*4+1]=(Math.random()-.5)*75;this.starData[i*4+2]=-8-Math.random()*16;this.starData[i*4+3]=.02+Math.random()*.065;}
    this.stars.frustumCulled=false;this.scene.add(this.stars);
    this.ring=new T.Mesh(new T.TorusGeometry(1,.025,5,48),new T.MeshBasicMaterial({color:0x70faff,transparent:true,opacity:0,toneMapped:false}));this.ring.position.z=1.2;this.scene.add(this.ring);
    this.indicator=new T.Group();
    const hit=new T.Mesh(new T.RingGeometry(.19,.27,20),glow(0xffffff,1.3));this.indicator.add(hit);
    const dot=new T.Mesh(new T.CircleGeometry(.08,10),glow(0xa4f6ff,1.7));this.indicator.add(dot);this.scene.add(this.indicator);
    this.beam=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:new T.Color(0xffdda9).multiplyScalar(4),transparent:true,opacity:.9,toneMapped:false}));this.beam.position.z=1.7;this.scene.add(this.beam);
    this.warning=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xff517b,transparent:true,opacity:.4,toneMapped:false}));this.warning.position.z=1.4;this.scene.add(this.warning);
    this.setTheme(0);
  }
  async init(forceWebGL=false){
    try{
      const renderer=new T.WebGPURenderer({canvas:this.canvas,antialias:true,forceWebGL:forceWebGL||!('gpu'in navigator),powerPreference:'high-performance'});
      this.renderer=renderer;
      await Promise.race([renderer.init(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('GPU initialization timeout')),7000))]);
      this.engine=renderer.backend.constructor.name.includes('WebGPU')?'WebGPU':'WebGL 2';
      const scenePass=pass(this.scene,this.camera),output=scenePass.getTextureNode('output');
      this.pipeline=new T.RenderPipeline(renderer,output.add(bloom(output,.50,.32,1.35)));
    }catch(error){
      console.warn('Modern renderer fallback',error);
      try{this.renderer?.dispose();}catch{/* The renderer may not have initialized. */}
      const GL=await import('three');this.renderer=new GL.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.engine='WebGL 2';this.pipeline=null;
    }
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.85;
    this.pixelRatio=Math.min(window.devicePixelRatio||1,1.65);this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();this.quality=this.pixelRatio>=1.4?'HIGH':'BALANCED';
  }
  resize(){
    const rect=this.canvas.parentElement!.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    this.renderer.setSize(rect.width,rect.height,false);
  }
  pointerToWorld(clientX:number,clientY:number){
    const r=this.canvas.getBoundingClientRect();const v=new T.Vector3((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1,0);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(v.x,v.y),this.camera);
    const target=new T.Vector3();ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-1),target);return {x:target.x,y:target.y};
  }
  private setTheme(stage:number){
    if(stage===this.theme)return;this.theme=stage;
    for(const sprite of [...this.atmosphere.children]){(sprite as T.Sprite).material.dispose();this.atmosphere.remove(sprite);}
    if(stage===1)for(let i=0;i<3;i++){
      const cloud=new T.Sprite(new T.SpriteMaterial({map:this.spriteTexture,color:[0x7650d3,0x3158ac,0x78418f][i],transparent:true,opacity:.24,depthWrite:false}));
      cloud.position.set((i-1)*9,6-i*9,-25);cloud.scale.set(46,45,1);this.atmosphere.add(cloud);
    }
    for(const chunk of this.terrain){chunk.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.terrainRoot.remove(chunk);}this.terrain=[];
    for(const m of this.terrainMaterials)m.dispose();this.terrainMaterials=[];
    const mats=[metal([0x102938,0x251c3c,0x312120][stage]),metal([0x183b4d,0x3a2854,0x54332b][stage]),metal([0x0c1b2e,0x121124,0x171618][stage])];
    const lights=glow(STAGES[stage].color,.48),edge=glow(STAGES[stage].color,1.15);this.terrainMaterials=[...mats,lights,edge];
    for(let n=0;n<11;n++){
      const group=new T.Group();
      if(stage!==1){
        block(group,mats[2],0,0,-3.9,29,9,.3);
        for(let i=0;i<4;i++){
          const y=-3.75+i*2.25;
          block(group,mats[0],0,y,-3.6,stage===0?11:6,2.1,.18);
          for(const s of[-1,1]){
            block(group,mats[1],s*8.4,y,-3.4,4.5,2,.35);
            block(group,lights,s*(stage===0?5.8:3.3),y,-3.3,.055,1.7,.02);
            for(let j=0;j<3;j++)block(group,mats[2],s*(6.8+j*.8),y+.25,-3.13,.6,1.0,.14);
          }
        }
      }
      for(const s of[-1,1]){
        const h=1.4+(n%3)*1.2;
        if(stage===0){
          block(group,mats[1],s*12.6,.3,-2.0,3,6.5,h);block(group,mats[0],s*12.6,.3,-2+h*.5,2.5,5.7,.15);
          for(let i=0;i<6;i++){block(group,lights,s*11.0,-2+i*1.0,-2+h*.35,.03,.45,.18);block(group,edge,s*12.7,-2+i*.9,-1+h*.5,.9,.035,.025);}
          block(group,mats[1],s*7.4,2,-2.65,2.3,2.1,.9);block(group,mats[0],s*7.4,2,-2.0,1.7,1.5,.3);block(group,lights,s*7.4,2,-1.8,.7,.7,.035);
        }else if(stage===1){
          for(let j=0;j<3;j++){
            const b=ball(group,mats[j%2],s*(11.5+(n%2)),j*2.5-2,-4+j*.6,2.2,2.4,2.0);b.rotation.set(n*.7,j*.8,n);
            const shard=ball(group,lights,s*10.5,j*2.5-1.8,-3+j*.6,.55,.9,.5);shard.rotation.z=n;
          }
          if(n%3===0){const ring=new T.Mesh(new T.TorusGeometry(14,.25,6,64),mats[1]);ring.position.set(0,1,-7);ring.rotation.x=.3;group.add(ring);
            for(let j=0;j<12;j++){const a=j/12*Math.PI*2;block(group,edge,Math.cos(a)*14,Math.sin(a)*14+1,-6.5,.17,.85,.05);}}
        }else{
          block(group,mats[1],s*10.8,0,-2.6,5,8,1.4);
          for(let j=0;j<4;j++){block(group,mats[0],s*10.8,-3+j*2,-1.25,4.8,.6,.8);block(group,edge,s*8.6,-3+j*2,-1,.05,.5,.1);}
          block(group,lights,s*4.5,0,-3.4,1.0,8.5,.03);block(group,mats[2],s*4.5,0,-3.3,.55,8.7,.08);
          if(n%2===0){block(group,mats[0],s*7,1,-2.3,2,2,1.4);ball(group,edge,s*7,1,-1.55,.45,.45,.1);}
        }
      }
      const chunk=batch(group);chunk.position.y=n*9-40;this.terrain.push(chunk);this.terrainRoot.add(chunk);
    }
    this.scene.background=new T.Color([0x040c18,0x09051b,0x0c080e][stage]);
  }
  event(e:GameEvent){
    const x=e.x||0,y=e.y||0;
    if(['explode','bosskill','damage','nova'].includes(e.type)){
      const size=e.size||1,count=e.type==='nova'?95:e.type==='bosskill'?150:Math.floor(20+size*13);
      this.burst(x,y,count,size,e.color||0xff8743);this.shake=Math.max(this.shake,e.type==='bosskill'?1.0:e.type==='damage'?.65:e.type==='nova'?.8:.09*size);
      if(e.type==='nova'||e.type==='bosskill'){this.ring.position.set(x,y,1.3);this.ring.scale.setScalar(.2);(this.ring.material as T.MeshBasicMaterial).opacity=.9;}
    }
    if(e.type==='collect')this.burst(x,y,24,.7,e.color||0x62ffff);
    if(e.type==='hit')this.burst(x,y,3,.2,0xffddab);
    if(e.type==='graze')this.burst(x,y,2,.15,0x9dffff);
  }
  private burst(x:number,y:number,count:number,size:number,color:number){
    for(let i=0;i<count&&this.particles.length<1600;i++){
      const a=Math.random()*Math.PI*2,speed=(3+Math.random()*9)*Math.sqrt(size),life=.2+Math.random()*.65;
      this.particles.push({x,y,z:1.2,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:Math.random()*3,life,max:life,size:(.07+Math.random()*.16)*Math.sqrt(size),color:new T.Color(i%4===0?0xffffff:color).multiplyScalar(1.8)});
    }
  }
  draw(game:Game,dt:number,frameMs:number){
    this.epoch+=dt;this.setTheme(game.stage);
    const active=game.state==='playing'||game.state==='transition',title=game.state==='title';
    const scroll=active?4.4:title?1.4:0;
    for(const chunk of this.terrain){chunk.position.y-=scroll*dt;if(chunk.position.y<-47)chunk.position.y+=99;}
    for(let i=0;i<200;i++){
      this.starData[i*4+1]-=scroll*dt*.25;if(this.starData[i*4+1]<-40)this.starData[i*4+1]+=80;
      dummy.position.set(this.starData[i*4],this.starData[i*4+1],this.starData[i*4+2]);dummy.scale.setScalar(this.starData[i*4+3]);dummy.rotation.set(0,0,0);dummy.updateMatrix();this.stars.setMatrixAt(i,dummy.matrix);
    }this.stars.instanceMatrix.needsUpdate=true;
    const p=game.player;
    this.player.position.set(title?Math.sin(this.epoch*.5)*.5:p.x,title?1.9+Math.sin(this.epoch)*.25:p.y,1.0);
    this.player.rotation.y+=(Math.max(-.35,Math.min(.35,-p.vx*.016))-this.player.rotation.y)*.15;
    this.player.scale.setScalar(title?2.0:1.0);this.player.visible=game.hull>0||title;
    if(game.invulnerable>0&&!title)this.player.visible=Math.floor(game.invulnerable*12)%3!==0;
    this.indicator.position.set(p.x,p.y,1.58);this.indicator.visible=!title&&game.hull>0;
    this.indicator.scale.setScalar(p.focus?1.1:.85);
    for(let i=0;i<2;i++){this.satellites[i].visible=!title&&game.power===4;this.satellites[i].position.set(p.x+(i===0?-1.45:1.45),p.y-.15+Math.sin(this.epoch*4)*.1,1.0);}
    if(active&&Math.random()<.85){for(const s of[-1,1])this.particles.push({x:p.x+s*.5,y:p.y-1.35,z:1,vx:0,vy:-7-Math.random()*4,vz:0,life:.20,max:.20,size:.12,color:new T.Color(0x39ccff).multiplyScalar(2)});}
    const live=new Set(game.enemies.map(e=>e.id));for(const [id,m]of this.models)if(!live.has(id)){this.scene.remove(m);this.models.delete(id);}
    for(const e of game.enemies){
      let m=this.models.get(e.id);if(!m){let template=this.templates.get(e.kind);if(!template){template=shipModel(e.kind);this.templates.set(e.kind,template);}m=template.clone();this.models.set(e.id,m);this.scene.add(m);}
      m.position.set(e.x,e.y,e.ground?-1.6:1);m.rotation.z=e.kind==='dart'?Math.sin(e.age*1.5+e.phase)*.22:0;m.scale.setScalar(e.flash>0?1.08:1);
    }
    const liveItems=new Set(game.pickups.map(p=>p.id));for(const[id,m]of this.pickups)if(!liveItems.has(id)){this.scene.remove(m);this.pickups.delete(id);}
    for(const item of game.pickups){
      let model=this.pickups.get(item.id);if(!model){model=new T.Group();const material=item.type==='power'?cyan:item.type==='repair'?glow(0x7dffbd):gold;
        const ring=new T.Mesh(new T.TorusGeometry(.58,.045,5,16),material);model.add(ring);
        block(model,white,0,0,0,.47,.47,.17);
        if(item.type==='repair'){block(model,material,0,0,.13,.12,.34,.06);block(model,material,0,0,.13,.34,.12,.06);}else ball(model,material,0,0,.2,.15,.2,.06);
        this.pickups.set(item.id,model);this.scene.add(model);
      }model.position.set(item.x,item.y,1.1);model.rotation.z=item.age*1.1;
    }
    if(game.boss&&!game.boss.dead){
      if(!this.boss||this.bossStage!==game.stage){if(this.boss)this.scene.remove(this.boss);this.boss=bossModel(game.stage);this.bossStage=game.stage;this.scene.add(this.boss);}
      this.boss.visible=true;this.boss.position.set(game.boss.x,game.boss.y,1);this.boss.scale.setScalar(game.boss.flash>0?1.01:1);
      for(let i=0;i<2;i++){const w=this.boss.getObjectByName('wing'+i);if(w){w.visible=game.boss.parts[i]>0;w.rotation.y=Math.sin(game.boss.age*1.5)*.05;}}
    }else if(this.boss)this.boss.visible=false;
    const b=game.boss;
    this.beam.visible=!!b&&b.beam>0&&!b.dead;this.warning.visible=!!b&&b.warning>0&&!b.dead;
    if(b){this.beam.position.set(b.beamX,-2,1.8);this.beam.scale.set(1.6,33,1);this.warning.position.set(b.beamX,-2,1.6);this.warning.scale.set(1.6,33,1);(this.warning.material as T.MeshBasicMaterial).opacity=.18+Math.sin(this.epoch*28)*.13;}
    let n=0;for(const bullet of game.bullets){if(n>=740)break;
      dummy.position.set(bullet.x,bullet.y,1.32);dummy.rotation.set(0,0,Math.atan2(bullet.vy,bullet.vx)-Math.PI/2);
      const rad=bullet.enemy?.245:bullet.weapon==='laser'?.08:.12;
      dummy.scale.set(rad,bullet.enemy?.30:bullet.weapon==='laser'?1.15:.45,.10);dummy.updateMatrix();this.shots.setMatrixAt(n,dummy.matrix);
      this.shotColor.setHex(bullet.enemy?bullet.color:bullet.weapon==='homing'?0xaaffee:bullet.weapon==='laser'?0xa68aff:0x66dfff).multiplyScalar(bullet.enemy?2.1:2.6);this.shots.setColorAt(n++,this.shotColor);
    }this.shots.count=n;this.shots.instanceMatrix.needsUpdate=true;if(this.shots.instanceColor)this.shots.instanceColor.needsUpdate=true;
    n=0;for(const part of this.particles){part.life-=dt;if(part.life<=0)continue;part.x+=part.vx*dt;part.y+=part.vy*dt;part.z+=part.vz*dt;
      dummy.position.set(part.x,part.y,part.z);dummy.rotation.set(0,0,Math.atan2(part.vy,part.vx));const fade=part.life/part.max;
      dummy.scale.set(part.size*fade,part.size*fade*(Math.hypot(part.vx,part.vy)>8?2:1),part.size*.6*fade);dummy.updateMatrix();this.sparkMesh.setMatrixAt(n,dummy.matrix);this.sparkMesh.setColorAt(n,part.color);n++;
    }this.particles=this.particles.filter(p=>p.life>0);this.sparkMesh.count=n;this.sparkMesh.instanceMatrix.needsUpdate=true;if(this.sparkMesh.instanceColor)this.sparkMesh.instanceColor.needsUpdate=true;
    const ringMat=this.ring.material as T.MeshBasicMaterial;
    ringMat.opacity=Math.max(0,ringMat.opacity-dt*1.6);this.ring.visible=ringMat.opacity>0;this.ring.scale.addScalar(dt*32);
    this.shake=Math.max(0,this.shake-dt*3);const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.camera.position.x=reduce?0:(Math.random()-.5)*this.shake*.55;this.camera.position.y=-7.8+(reduce?0:(Math.random()-.5)*this.shake*.35);
    this.camera.lookAt(this.camera.position.x,this.camera.position.y+7.8,0);
    this.frameAverage=this.frameAverage*.98+Math.min(frameMs,100)*.02;this.frames++;
    if(this.frames>150&&this.epoch-this.lastDprChange>5&&this.frameAverage>23&&this.pixelRatio>1){
      this.pixelRatio=Math.max(1,this.pixelRatio-.2);this.renderer.setPixelRatio(this.pixelRatio);this.resize();this.lastDprChange=this.epoch;this.quality='BALANCED';
    }
    if(this.pipeline)this.pipeline.render();else this.renderer.render(this.scene,this.camera);
  }
  getDiagnostics(){return {engine:this.engine,quality:this.quality,dpr:this.pixelRatio,frameMs:this.frameAverage,particles:this.particles.length,width:this.width,height:this.height};}
}
