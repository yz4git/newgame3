import * as T from 'three/webgpu';
import {FortressBackground} from './fortress.ts';
import {explosionFrames,smokeMap,shipSkin,planetMap,terrainMaps,visualAssetStatus,playerShipMaps,playerShipsAtlasMap} from './visual-assets.ts';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {glow,block,ball,shipModel,bossModel,radialTexture,environmentTexture,effectTexture,planetModel,cyan,gold,white} from './art.ts';
import { Game, STAGES, SHIPS, type GameEvent, type Kind } from './sim.ts';
import {StageEffects} from './stage-effects.ts';
import {playerPose,enemyPose,bossPose,smooth,animationClockRunning,presentationState} from './motion.ts';
import {addShipRig,addBossRig,cloneAnimatedModel,disposeAnimatedModel,animateShip,animateBoss} from './animation-rig.ts';
import {CombatEffects} from './combat-effects.ts';
import {FacilityDemolition3D,isFacilityDemolition} from './facility-demolition.ts';
import {AirEffects} from './air-effects.ts';
import {EncounterView} from './encounter-view.ts';
import {usesRebuiltGraphics,currentVisualStyle} from './visual-style.ts';
import {VolumetricCinematics} from './volumetric-cinematics.ts';
import {DepthSpectacle} from './depth-spectacle.ts';
import {ColossalCinematics} from './colossal-cinematics.ts';
import {COLOSSAL_BUDGET} from './colossal-spec.ts';
import {InvasionDirector} from './invasion-director.ts';
import {INVASION_BUDGET} from './invasion-spec.ts';
import {FxDirector} from './fx-director.ts';
import {MechanicalSetpieceFX} from './mechanical-setpiece-fx.ts';
import {ScenicChoreography3D} from './scenic-choreography.ts';
import {WorldAliveScene} from './world-alive-scene.ts';

const boxGeometry=new T.BoxGeometry(1,1,1);
const shotGeometry=new T.SphereGeometry(1,10,6);
const dummy=new T.Object3D();
const skinOffset=new T.Vector3(0,-.50625,1.62),inverseRotation=new T.Quaternion(),faceRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.atan(12.5/40)),rollRotation=new T.Quaternion();

interface Particle {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;max:number;size:number;color:T.Color;}
interface Flare {sprite:T.Sprite|T.Mesh<T.IcosahedronGeometry,T.MeshBasicMaterial>;age:number;life:number;size:number;smoke:boolean;}
interface Wreck {model:T.Group;age:number;life:number;side:number;boss:boolean;}
export class View {
  scene=new T.Scene();camera=new T.OrthographicCamera(-12,12,64/3,-64/3,.1,110);
  renderer!: T.WebGPURenderer | import('three').WebGLRenderer;
  pipeline: T.RenderPipeline | null=null;engine='';quality='';
  private composer?:EffectComposer;
  private player=addShipRig(shipModel('player'),'player');private renderedShip='striker';private satellites:T.Group[]=[];
  private models=new Map<number,T.Group>();private templates=new Map<Kind,T.Group>();private boss:T.Group|null=null;private bossStage=-1;
  private theme=-1;private background=new FortressBackground();private atmosphere=new T.Group();
  private stars:T.InstancedMesh;private starData:Float32Array;
  private diamonds:T.InstancedMesh;private diamondRims:T.InstancedMesh;private shots:T.InstancedMesh;private shotColor=new T.Color();private particles:Particle[]=[];private sparkMesh:T.InstancedMesh;
  private shotRims:T.InstancedMesh;private shotCores:T.InstancedMesh;private shotGlows:T.InstancedMesh;private trails:T.InstancedMesh;private shadows:T.InstancedMesh;
  private markers:T.InstancedMesh;private aimLines:T.InstancedMesh;private flames:(T.Sprite|T.Mesh<T.ConeGeometry,T.MeshBasicMaterial>)[]=[];private flares:Flare[]=[];
  private fireMap=effectTexture('fire');private smokeMap=smokeMap;
  private lockMarkers=new Map<number,T.Group>();
  private pickups=new Map<number,T.Group>();private ring:T.Mesh;private indicator:T.Group;
  private shake=0;private spriteTexture=radialTexture();
  private frameAverage=16.6;private frames=0;private pixelRatio=1.5;private lastDprChange=0;
  private useBloom=true;
  private key:T.DirectionalLight;private blastLight=new T.PointLight(0xff7430,0,14,1.5);
  private width=0;private height=0;private epoch=0;
  private stageEffects=new StageEffects();private wrecks:Wreck[]=[];private cascades:{at:number;x:number;y:number;size:number}[]=[];
  private playerAnimation='cruise';private bossAnimation='none';private enemyAnimations:Record<string,number>={};
  private lastBoss:Game['boss']=null;
  private combatEffects=new CombatEffects();private facilityDemolition=new FacilityDemolition3D();private airEffects=new AirEffects();private encounterView=new EncounterView();
   private volumetric=usesRebuiltGraphics()?new VolumetricCinematics():null;
   private depthSpectacle=usesRebuiltGraphics()?new DepthSpectacle():null;
   private colossal=usesRebuiltGraphics()?new ColossalCinematics():null;
   private invasion=usesRebuiltGraphics()?new InvasionDirector():null;
   private fxDirector=new FxDirector();
   private mechanical=usesRebuiltGraphics()?new MechanicalSetpieceFX():null;
   private scenic=usesRebuiltGraphics()?new ScenicChoreography3D():null;
   private aliveScene=usesRebuiltGraphics()?new WorldAliveScene():null;
   private cameraRoll=0;private cameraZoom=1;private cinematicKick=0;
  constructor(private canvas:HTMLCanvasElement){
    this.scene.background=new T.Color(0x030914);this.scene.environment=environmentTexture();this.camera.position.set(0,-12.5,40);this.camera.lookAt(0,0,0);
    this.scene.add(new T.HemisphereLight(0xb5d1ef,0x080d18,1.15));
    this.key=new T.DirectionalLight(0xffe8d2,3.8);this.key.position.set(-12,18,25);this.key.castShadow=true;
    this.key.shadow.mapSize.set(1024,1024);Object.assign(this.key.shadow.camera,{left:-19,right:19,top:30,bottom:-30,near:1,far:80});this.key.shadow.bias=-.0006;this.key.shadow.normalBias=.09;this.scene.add(this.key);
    const rim=new T.DirectionalLight(0x7096cf,1.8);rim.position.set(16,-5,12);this.scene.add(rim,this.blastLight);
    this.scene.add(this.background.root,this.atmosphere,this.stageEffects.root,this.combatEffects.root,this.facilityDemolition.root,this.airEffects.root,this.encounterView.root);if(this.volumetric)this.scene.add(this.volumetric.root);if(this.depthSpectacle)this.scene.add(this.depthSpectacle.root);if(this.colossal)this.scene.add(this.colossal.root);if(this.invasion)this.scene.add(this.invasion.root);if(this.mechanical)this.scene.add(this.mechanical.root);if(this.scenic)this.scene.add(this.scenic.root);if(this.aliveScene)this.scene.add(this.aliveScene.root);this.player.position.z=1.0;this.scene.add(this.player);
    for(const s of[-1,1]){const satellite=new T.Group();ball(satellite,white,0,0,0,.3,.4,.23);ball(satellite,cyan,0,.15,.22,.14,.2,.06);satellite.position.z=1;this.satellites.push(satellite);this.scene.add(satellite);}
    const bulletMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
    this.shots=new T.InstancedMesh(shotGeometry,bulletMat,740);this.shots.setColorAt(0,new T.Color(0xffffff));this.shots.instanceColor!.setUsage(T.DynamicDrawUsage);
    this.shots.instanceMatrix.setUsage(T.DynamicDrawUsage);this.shots.frustumCulled=false;this.scene.add(this.shots);
    this.diamonds=new T.InstancedMesh(boxGeometry,bulletMat,740);this.diamonds.setColorAt(0,new T.Color());this.diamonds.frustumCulled=false;this.scene.add(this.diamonds);this.diamondRims=new T.InstancedMesh(boxGeometry,new T.MeshBasicMaterial({color:0x10071c}),740);this.diamondRims.frustumCulled=false;this.scene.add(this.diamondRims);
    this.shotRims=new T.InstancedMesh(shotGeometry,new T.MeshBasicMaterial({color:0x030b17}),740);this.shotRims.frustumCulled=false;this.scene.add(this.shotRims);
    this.shotCores=new T.InstancedMesh(shotGeometry,new T.MeshBasicMaterial({color:0xfffbef,toneMapped:false}),740);this.shotCores.frustumCulled=false;this.scene.add(this.shotCores);
    this.shotGlows=new T.InstancedMesh(usesRebuiltGraphics()?new T.SphereGeometry(.5,6,4):new T.PlaneGeometry(1,1),new T.MeshBasicMaterial(usesRebuiltGraphics()?{color:0xffffff,transparent:true,opacity:.20,depthWrite:false,toneMapped:true}:{map:this.spriteTexture,transparent:true,opacity:.74,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),740);this.shotGlows.setColorAt(0,new T.Color());this.shotGlows.frustumCulled=false;this.scene.add(this.shotGlows);
    this.trails=new T.InstancedMesh(usesRebuiltGraphics()?new T.CylinderGeometry(.33,.25,1,6):new T.PlaneGeometry(1,1),new T.MeshBasicMaterial(usesRebuiltGraphics()?{color:0x478e90,transparent:true,opacity:.26,depthWrite:false,toneMapped:true}:{map:this.spriteTexture,color:0x76ffd4,transparent:true,opacity:.62,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),1800);this.trails.frustumCulled=false;this.scene.add(this.trails);
    this.shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:effectTexture('shadow'),transparent:true,depthWrite:false}),100);this.shadows.frustumCulled=false;this.scene.add(this.shadows);
    this.markers=new T.InstancedMesh(new T.RingGeometry(.45,.53,24),new T.MeshBasicMaterial({color:0xff9876,transparent:true,opacity:.85,toneMapped:false,depthWrite:false}),60);this.markers.frustumCulled=false;this.scene.add(this.markers);
    this.aimLines=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xff808b,transparent:true,opacity:.28,toneMapped:false,depthWrite:false}),60);this.aimLines.frustumCulled=false;this.scene.add(this.aimLines);
    for(let i=0;i<2;i++){
      const flame=usesRebuiltGraphics()
        ?new T.Mesh(new T.ConeGeometry(.32,1.0,7),new T.MeshBasicMaterial({color:0x2c8ca9,transparent:true,opacity:.38,depthWrite:false,toneMapped:true}))
        :new T.Sprite(new T.SpriteMaterial({map:this.spriteTexture,color:new T.Color(0x249cff).multiplyScalar(2.8),transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
      if(flame instanceof T.Mesh)flame.rotation.z=Math.PI;
      this.flames.push(flame);this.scene.add(flame);
    }
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
    this.setTheme(0);
  }
  async init(forceWebGL=false){
    let modern=false;
    if(!forceWebGL&&'gpu'in navigator)try{
      const renderer=new T.WebGPURenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
      this.renderer=renderer;
      await Promise.race([renderer.init(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('GPU initialization timeout')),7000))]);
      if(!renderer.backend.constructor.name.includes('WebGPU'))throw new Error('No WebGPU adapter');
      this.engine='WebGPU';
      const scenePass=pass(this.scene,this.camera),output=scenePass.getTextureNode('output');
      this.pipeline=new T.RenderPipeline(renderer,output.add(bloom(output,usesRebuiltGraphics()?.31:.52,.43,usesRebuiltGraphics()?.90:1.15)));
      modern=true;
    }catch(error){
      console.warn('Modern renderer fallback',error);
      try{this.renderer?.dispose();}catch{/* The renderer may not have initialized. */}
    }
    if(!modern){
      const GL=await import('three');const renderer=new GL.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer=renderer;this.engine='WebGL 2';this.pipeline=null;
      const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass}]=await Promise.all([import('three/addons/postprocessing/EffectComposer.js'),import('three/addons/postprocessing/RenderPass.js'),import('three/addons/postprocessing/UnrealBloomPass.js'),import('three/addons/postprocessing/OutputPass.js')]);
      this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.composer.addPass(new UnrealBloomPass(new T.Vector2(390,694),usesRebuiltGraphics()?.31:.52,.43,usesRebuiltGraphics()?.90:1.15));this.composer.addPass(new OutputPass());
    }
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=usesRebuiltGraphics()?.84:.90;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.pixelRatio=Math.min(window.devicePixelRatio||1,1.65);this.renderer.setPixelRatio(this.pixelRatio);
    this.resize();this.quality=this.pixelRatio>=1.4?'HIGH':'BALANCED';
  }
  resize(){
    const rect=this.canvas.parentElement!.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    // Expand the visible vertical flight corridor on tall phones without deforming ship and projectile geometry.
    const vertical=Math.max(128/3,24*rect.height/Math.max(1,rect.width));
    this.camera.left=-12;this.camera.right=12;this.camera.top=vertical/2;this.camera.bottom=-vertical/2;this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width,rect.height,false);
    if(this.composer){this.composer.setPixelRatio(this.pixelRatio);this.composer.setSize(rect.width,rect.height);}
  }
  pointerToWorld(clientX:number,clientY:number){
    const r=this.canvas.getBoundingClientRect();const v=new T.Vector3((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1,0);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(v.x,v.y),this.camera);
    const target=new T.Vector3();ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-1),target);return {x:target.x,y:target.y};
  }
  worldToScreen(x:number,y:number){const p=new T.Vector3(x,y,1.3).project(this.camera);return {x:(p.x*.5+.5)*this.width,y:(.5-p.y*.5)*this.height};}
  private setTheme(stage:number){
    if(stage===this.theme)return;this.theme=stage;
    for(const object of [...this.atmosphere.children]){object.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite||o instanceof T.Mesh){if(!Array.isArray(o.material)){if(o.material.map&&o.material.map!==this.spriteTexture&&o.material.map!==planetMap&&!Object.values(terrainMaps).includes(o.material.map as T.CanvasTexture))o.material.map.dispose();o.material.dispose();}}});this.atmosphere.remove(object);}
    const theme=STAGES[stage];
    if(theme.environment==='fortress')this.atmosphere.add(planetModel());
    if(theme.environment==='asteroids'){
      if(usesRebuiltGraphics()){
        // Inside-facing THREE-DIMENSIONAL sky volume; never a one-card nebula backdrop.
        const sky=new T.Mesh(new T.SphereGeometry(82,24,12),
          new T.MeshBasicMaterial({color:0x0c1426,side:T.BackSide,depthWrite:false,toneMapped:true}));
        sky.name='deep-3d-nebula-sky';sky.position.set(0,0,-19);this.atmosphere.add(sky);
        // Real depth-layered nebular dust/asteroid formations rather than a
        // panoramic 2D nebula picture stretched over the background sphere.
        const dust=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),
          new T.MeshStandardMaterial({color:0x45556e,metalness:.08,roughness:.91,transparent:true,opacity:.14,depthWrite:false}),48);
        dust.name='3d-nebular-distance-clouds';dust.frustumCulled=false;
        const instance=new T.Object3D();
        for(let i=0;i<48;i++){
          const a=i*2.39996,r=9+(i%9)*3.3;
          instance.position.set(Math.sin(a)*r,((i*17)%91)-45,-18-(i%6)*7.2);
          instance.rotation.set(i*.3,i*.13,a);
          const size=1.5+(i%5)*.90;instance.scale.set(size,size*.67,size*1.48);
          instance.updateMatrix();dust.setMatrixAt(i,instance.matrix);
        }
        dust.instanceMatrix.needsUpdate=true;this.atmosphere.add(dust);
      }else{
        const sky=new T.Mesh(new T.PlaneGeometry(46,76),new T.MeshBasicMaterial({map:terrainMaps.nebula,color:0xd6d9e8,toneMapped:false}));sky.position.set(0,0,-36);this.atmosphere.add(sky);
      }
    }
    this.key.color.setHex(theme.sun);this.key.intensity=theme.light;
    this.stars.visible=theme.environment==='asteroids'||theme.environment==='fortress';
    this.scene.background=new T.Color(theme.sky);
  }
  event(e:GameEvent){
    this.volumetric?.event(e);
    this.depthSpectacle?.event(e);
    this.colossal?.event(e);
    this.invasion?.event(e);
    this.fxDirector.event(e);
    this.mechanical?.event(e);
    this.scenic?.event(e);
    this.aliveScene?.event(e);
    if(this.colossal){
      if(e.type==='stage')this.cinematicKick=0;
      else if(e.type==='nova'||e.type==='bosskill')this.cinematicKick=Math.max(this.cinematicKick,1);
      else if(e.type==='fieldcollapse'||e.type==='bosstransform')this.cinematicKick=Math.max(this.cinematicKick,.60);
    }
    this.combatEffects.event(e);
    this.facilityDemolition.event(e);
    const x=e.x||0,y=e.y||0;
    if(isFacilityDemolition(e.type)){
      // Facility blasts are real geometric pulses and metal, never giant atlas quads.
      this.shake=Math.max(this.shake,e.type==='fieldcollapse'?.35:e.type==='fieldclear'?.22:.07);
      return;
    }
    if(e.type==='stage'){
      this.cascades=[];this.particles=[];for(const f of this.flares){this.scene.remove(f.sprite);f.sprite.material.dispose();}this.flares=[];
      for(const w of this.wrecks)this.disposeWreck(w);this.wrecks=[];this.shake=0;(this.ring.material as T.MeshBasicMaterial).opacity=0;
    }
    if(e.type==='explode'&&e.source){const source=this.models.get(e.source);if(source)this.wreck(source,false,e.kind==='cruiser'?1.65:.85);}
    if(e.type==='bosskill'){
      if(this.boss&&this.lastBoss)animateBoss(this.boss,bossPose(this.lastBoss),this.lastBoss);
      if(this.boss)this.wreck(this.boss,true,3.3);
      for(let i=0;i<7;i++)this.cascades.push({at:.25+i*.35,x:x+Math.sin(i*2.3)*3.4,y:y+Math.cos(i*1.7)*2.1,size:1.2+i*.13});
    }
    if(e.type==='phase'){this.burst(x,y,usesRebuiltGraphics()?18:50,2,e.color||0xff8b6a);this.shake=.3;}
    if(['missionstart','missionclear','missionfail','bosstransform','bossform'].includes(e.type)){this.burst(x,y,usesRebuiltGraphics()?20:e.type==='missionstart'?52:75,e.size??3,e.color??0x9deaff);this.shake=Math.max(this.shake,e.type==='bosstransform'?.47:.26);}
    if(['explode','bosskill','damage','nova','resonance','fieldfracture','bossreinforce','fieldwarning','fieldhit'].includes(e.type)){
      const size=e.size||1,rawCount=e.type==='nova'?95:e.type==='bosskill'?150:Math.floor(20+size*13),count=usesRebuiltGraphics()?Math.min(36,rawCount):rawCount;
      this.burst(x,y,e.type==='fieldhit'?13:e.type==='fieldwarning'?18:e.type==='fieldclear'?110:count,e.type==='fieldhit'?.65:e.type==='fieldwarning'?1.15:size,e.color||0xff8743);this.shake=Math.max(this.shake,e.type==='bosskill'?1.0:e.type==='damage'?.65:e.type==='nova'?.8:e.type==='fieldcollapse'?.52:e.type==='fieldburst'?.12:e.type==='fieldcritical'?.2:e.type==='fieldclear'?.36:e.type==='fieldhit'?.025:e.type==='fieldwarning'?.08:.09*size);
      if(e.type==='nova'||e.type==='bosskill'||e.type==='resonance')(this.ring.material as T.MeshBasicMaterial).opacity=0;
      if(e.type!=='nova'&&e.type!=='resonance'&&e.type!=='fieldfracture'&&e.type!=='fieldcritical'&&e.type!=='fieldhit'&&e.type!=='fieldwarning'&&e.type!=='fieldclear'){
        for(const smoke of[false,true]){
          if(this.flares.length>=48)break;
          const sprite=usesRebuiltGraphics()
            ?new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:smoke?0x656663:0x9b7156,transparent:true,opacity:smoke?.065:.20,depthWrite:false,toneMapped:true}))
            :new T.Sprite(new T.SpriteMaterial({map:smoke?this.smokeMap:explosionFrames[0],transparent:true,blending:T.NormalBlending,depthWrite:false,toneMapped:false}));
          sprite.position.set(x,y,smoke?-.25:1.65);this.scene.add(sprite);
          this.flares.push({sprite,age:smoke?-.08:0,life:smoke?1.6:.88,size:size*(usesRebuiltGraphics()?(smoke?1.3:.85):(smoke?3.8:3.4)),smoke});
        }
      }
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
  private wreck(source:T.Group,boss:boolean,life:number){
    if(this.wrecks.length>=12)this.disposeWreck(this.wrecks.shift()!);
    const model=source.clone();model.traverse(o=>{if(o instanceof T.Sprite||o instanceof T.Mesh){if(Array.isArray(o.material))return;o.material=o.material.clone();if(o instanceof T.Mesh&&o.userData.deformSkin)o.geometry=o.geometry.clone();o.material.transparent=true;o.material.depthWrite=false;if('color'in o.material)(o.material.color as T.Color).multiplyScalar(boss?.65:.45);}});this.scene.add(model);this.wrecks.push({model,age:0,life,side:source.position.x>=0?1:-1,boss});
  }
  private disposeWreck(w:Wreck){this.scene.remove(w.model);w.model.traverse(o=>{if(o instanceof T.Sprite||o instanceof T.Mesh){if(!Array.isArray(o.material))o.material.dispose();if(o instanceof T.Mesh&&o.userData.deformSkin)o.geometry.dispose();}});}
  draw(game:Game,dt:number,frameMs:number){
    dt=animationClockRunning(game)?dt:0;this.epoch=game.visualTime;this.setTheme(game.stage);
    if(usesRebuiltGraphics()&&this.renderedShip!==game.shipClass){
      this.scene.remove(this.player);
      this.player=addShipRig(shipModel('player',game.shipClass),'player');
      this.scene.add(this.player);this.renderedShip=game.shipClass;
    }
    const state=presentationState(game),active=state==='playing'||state==='transition',title=state==='title';
    const scroll=active?4.4:title?1.4:0;
    const visualReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mix=this.fxDirector.plan(game,visualReduced,this.quality==='PERFORMANCE');
    this.background.draw(game,this.quality==='PERFORMANCE',visualReduced);
    this.stageEffects.draw(game,this.quality==='PERFORMANCE',window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.airEffects.draw(game,this.quality==='PERFORMANCE',window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.combatEffects.draw(game,dt,window.matchMedia('(prefers-reduced-motion: reduce)').matches,this.quality==='PERFORMANCE');
    this.facilityDemolition.draw(game,dt,window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.volumetric?.draw(game,dt,visualReduced,this.quality==='PERFORMANCE',mix);
    this.depthSpectacle?.draw(game,dt,visualReduced,this.quality==='PERFORMANCE',mix);
    this.colossal?.draw(game,dt,visualReduced,this.quality==='PERFORMANCE',mix);
    this.invasion?.draw(game,dt,visualReduced,this.quality==='PERFORMANCE',mix);
    this.mechanical?.draw(game,dt,mix,visualReduced,this.quality==='PERFORMANCE');
    this.scenic?.draw(game,dt,mix,visualReduced,this.quality==='PERFORMANCE');
    this.aliveScene?.draw(game,dt,mix,visualReduced,this.quality==='PERFORMANCE');
    this.atmosphere.position.y=-this.background.distance*.018;
    for(let i=0;i<200;i++){
      this.starData[i*4+1]-=scroll*dt*.25;if(this.starData[i*4+1]<-40)this.starData[i*4+1]+=80;
      dummy.position.set(this.starData[i*4],this.starData[i*4+1],this.starData[i*4+2]);dummy.scale.setScalar(this.starData[i*4+3]);dummy.rotation.set(0,0,0);dummy.updateMatrix();this.stars.setMatrixAt(i,dummy.matrix);
    }this.stars.instanceMatrix.needsUpdate=true;
    const p=game.player;
    const pose=playerPose(game);this.playerAnimation=state==='transition'?'depart':pose.mode;
    const depart=state==='transition'?smooth((3.5-game.transitionTime)/3.5):game.state==='result'&&game.won&&game.boss?.dead?1:0;
    this.player.position.set(title?Math.sin(this.epoch*.5)*.5:p.x,title?1.9+Math.sin(this.epoch)*.25:p.y+depart*34,1.0);
    this.player.rotation.y+=(pose.bank-this.player.rotation.y)*(dt>0?1-Math.exp(-dt*9):0);
    this.player.rotation.z=title?Math.sin(this.epoch*.7)*.035:pose.roll;
    const skin=this.player.getObjectByName('skin') as T.Sprite|undefined;if(skin){skin.position.copy(skinOffset).applyQuaternion(inverseRotation.copy(this.player.quaternion).invert());skin.material.rotation=title?Math.sin(this.epoch*.7)*.035:pose.roll;
      // The new generated sheets contain three physically different silhouettes, not color variants.
      if(playerShipsAtlasMap.image instanceof HTMLImageElement&&playerShipsAtlasMap.image.naturalWidth>0){
        skin.material.map=playerShipMaps[game.shipClass==='striker'?0:game.shipClass==='falcon'?1:2];
        skin.material.color.setHex(0xffffff);skin.scale.set(3.55*(1-Math.abs(this.player.rotation.y)*.3),3.85,1);
      }else{skin.material.color.setHex(SHIPS[game.shipClass].tint);skin.scale.set(3.1*(1-Math.abs(this.player.rotation.y)*.3),4.25,1);}}
    animateShip(this.player,pose,this.epoch,'player');
    this.player.scale.setScalar(title?2.0:game.invulnerable>0?1.015+Math.sin(game.visualTime*15)*.025:1.0);this.player.visible=game.hull>0||title;
    // Never hide the craft during invulnerability: on a busy background players must keep visual tracking.
    this.indicator.position.set(p.x,p.y-.5625,2.8);this.indicator.visible=!title&&game.hull>0&&state!=='transition'&&game.state!=='result';
    this.indicator.scale.setScalar(game.invulnerable>0&&!title?1.2+Math.sin(game.visualTime*11)*.12:p.focus?1.1:.85);
    for(let i=0;i<2;i++){
      const flame=this.flames[i],side=i===0?-1:1,scale=title?2:1;
      flame.visible=this.player.visible&&(active||title)&&!usesRebuiltGraphics(); // rig owns rebuilt engine thrustflame.position.set(this.player.position.x+side*.496*scale,this.player.position.y-2.03*scale,1.05);
      flame.scale.set(.40*scale,(1.5+Math.sin(this.epoch*45)*.15+(game.overdrive>0?.8:0))*scale,1);
    }
    for(let i=0;i<2;i++){this.satellites[i].visible=!title&&game.power===4;this.satellites[i].position.set(p.x+(i===0?-1.45:1.45),p.y-.15+Math.sin(this.epoch*4)*.1,1.0);}
    if(active&&dt>0&&this.particles.length<1598&&Math.random()<.85){for(const s of[-1,1])this.particles.push({x:p.x+s*.5,y:p.y-1.35,z:1,vx:0,vy:-7-Math.random()*4,vz:0,life:.20,max:.20,size:.12,color:new T.Color(0x39ccff).multiplyScalar(2)});}
    this.enemyAnimations={};const live=new Set(game.enemies.map(e=>e.id));for(const [id,m]of this.models)if(!live.has(id)){this.scene.remove(m);disposeAnimatedModel(m);this.models.delete(id);}
    for(const e of game.enemies){
      let m=this.models.get(e.id);if(!m){let template=this.templates.get(e.kind);if(!template){template=addShipRig(shipModel(e.kind),e.kind);this.templates.set(e.kind,template);}m=cloneAnimatedModel(template);this.models.set(e.id,m);this.scene.add(m);}
      const pose=enemyPose(e,p);this.enemyAnimations[pose.mode]=(this.enemyAnimations[pose.mode]||0)+1;
      m.position.set(e.x,e.y+(e.ground?.4375:0),e.ground?-.4:1);m.rotation.z=pose.roll;m.rotation.y=pose.bank;m.scale.setScalar(e.flash>0?1.025:1);animateShip(m,pose,e.age,e.kind);
      const skin=m.getObjectByName('skin') as T.Sprite|T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>|undefined;if(skin){skin.position.copy(skinOffset).applyQuaternion(inverseRotation.copy(m.quaternion).invert());if(skin instanceof T.Sprite){skin.material.rotation=pose.roll;skin.scale.x=(shipSkin(e.kind)?.width??3.1)*(1-Math.abs(pose.bank)*.32);}else{skin.quaternion.copy(inverseRotation).multiply(faceRotation).multiply(rollRotation.setFromAxisAngle(new T.Vector3(0,0,1),pose.roll));skin.scale.x=1-Math.abs(pose.bank)*.32;}skin.material.color.setHex(e.flash>0?0xfff0d0:shipSkin(e.kind)?.color??shipTint(e.kind));}
    }
    const liveItems=new Set(game.pickups.map(p=>p.id));for(const[id,m]of this.pickups)if(!liveItems.has(id)){this.scene.remove(m);this.pickups.delete(id);}
    for(const item of game.pickups){
      let model=this.pickups.get(item.id);if(!model){model=new T.Group();const material=item.type==='power'?cyan:item.type==='repair'?glow(0x7dffbd):gold;
        const ring=new T.Mesh(new T.TorusGeometry(.58,.045,5,16).toNonIndexed(),material);model.add(ring);
        block(model,white,0,0,0,.47,.47,.17);
        if(item.type==='repair'){block(model,material,0,0,.13,.12,.34,.06);block(model,material,0,0,.13,.34,.12,.06);}else ball(model,material,0,0,.2,.15,.2,.06);
        this.pickups.set(item.id,model);this.scene.add(model);
      }model.position.set(item.x,item.y,1.1);model.rotation.z=item.age*1.1;
    }
    if(game.boss&&!game.boss.dead){
      this.lastBoss=game.boss;
      if(!this.boss||this.bossStage!==game.stage){if(this.boss){this.scene.remove(this.boss);disposeAnimatedModel(this.boss);}this.boss=addBossRig(bossModel(game.stage),STAGES[game.stage].color);this.bossStage=game.stage;this.scene.add(this.boss);}
      this.boss.visible=true;this.boss.position.set(game.boss.x,game.boss.y,1);this.boss.scale.setScalar(game.boss.flash>0?1.01:1);
      const pose=bossPose(game.boss);this.bossAnimation=pose.mode;animateBoss(this.boss,pose,game.boss);
    }else {if(this.boss)this.boss.visible=false;this.bossAnimation=this.wrecks.some(w=>w.boss)?'collapse':'none';}
    this.encounterView.draw(game);
    let markerCount=0,lineCount=0,shadowCount=0;
    for(const e of game.enemies){
      if(!e.ground&&shadowCount<98){dummy.position.set(e.x+.15,e.y+.7,-2.95);dummy.rotation.set(0,0,0);dummy.scale.set(e.radius*2.8,e.radius*2.0,1);dummy.updateMatrix();this.shadows.setMatrixAt(shadowCount++,dummy.matrix);}
      if(e.charging&&e.y<13.5&&e.y>p.y+3.8&&markerCount<60&&['tank','lancer','weaver','cruiser','bomber','corvette','sentinel','strider'].includes(e.kind)){
        dummy.position.set(e.x,e.y,1.18);dummy.scale.setScalar(.7+(1-Math.max(0,e.shoot/.48))*.6);dummy.updateMatrix();this.markers.setMatrixAt(markerCount++,dummy.matrix);
        if(e.kind==='tank'||e.kind==='lancer'||e.kind==='strider'){
          const dx=e.aimX-e.x,dy=e.aimY-e.y;dummy.position.set((e.x+e.aimX)/2,(e.y+e.aimY)/2,1.10);dummy.rotation.z=-Math.atan2(dx,dy);dummy.scale.set(.035,Math.hypot(dx,dy),1);dummy.updateMatrix();this.aimLines.setMatrixAt(lineCount++,dummy.matrix);
        }
      }
    }
    if(!title){dummy.position.set(p.x+.15,p.y+.7,-2.95);dummy.rotation.set(0,0,0);dummy.scale.set(3.8,2.8,1);dummy.updateMatrix();this.shadows.setMatrixAt(shadowCount++,dummy.matrix);}
    this.shadows.count=shadowCount;this.shadows.instanceMatrix.needsUpdate=true;
    this.markers.count=markerCount;this.markers.instanceMatrix.needsUpdate=true;this.aimLines.count=lineCount;this.aimLines.instanceMatrix.needsUpdate=true;
    const lockIds=new Set(game.locks.map(l=>l.id));
    for(const[id,m]of this.lockMarkers)if(!lockIds.has(id)){this.scene.remove(m);m.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.lockMarkers.delete(id);}
    for(const lock of game.locks){
      let m=this.lockMarkers.get(lock.id);if(!m){m=new T.Group();const color=glow(0x81ffcf,1.5);
        const ring=new T.Mesh(new T.RingGeometry(.88,.94,32,1,0,Math.PI*1.55).toNonIndexed(),color);ring.name='ring';m.add(ring);
        for(const sx of[-1,1])for(const sy of[-1,1]){const a=block(m,color,sx*.91,sy*.76,0,.29,.045,.015),b=block(m,color,sx*.76,sy*.91,0,.045,.29,.015);a.geometry=a.geometry.clone();b.geometry=b.geometry.clone();}
        this.lockMarkers.set(lock.id,m);this.scene.add(m);
      }m.position.set(lock.x,lock.y,1.6);m.scale.setScalar(1.4-lock.progress*.4);m.getObjectByName('ring')!.rotation.z=-this.epoch*2;
    }
    let n=0,rimCount=0,coreCount=0,trailCount=0,diamondCount=0;for(const bullet of game.bullets){if(n>=740)break;
      dummy.position.set(bullet.x,bullet.y,1.32);dummy.rotation.set(0,0,Math.atan2(bullet.vy,bullet.vx)-Math.PI/2);
      const rad=bullet.enemy?(bullet.shape==='missile'?.16:bullet.shape==='diamond'?0:.21):bullet.weapon==='laser'?.08:.105;
      dummy.scale.set(rad,bullet.enemy?(bullet.shape==='missile'?.58:bullet.shape==='diamond'?.23:.36):bullet.weapon==='laser'?1.15:.60,.10);dummy.updateMatrix();this.shots.setMatrixAt(n,dummy.matrix);
      this.shotColor.setHex(bullet.enemy?bullet.color:bullet.weapon==='homing'?0xaaffee:bullet.weapon==='laser'?0xa68aff:0x35afff).multiplyScalar(usesRebuiltGraphics()?(bullet.enemy?1.55:1.85):(bullet.enemy?2.4:3.0));this.shots.setColorAt(n,this.shotColor);
      dummy.position.z=1.23;dummy.scale.set(usesRebuiltGraphics()?(bullet.enemy?.55:.33):(bullet.enemy?1.18:.64),usesRebuiltGraphics()?(bullet.enemy?.8:.70):(bullet.enemy?1.85:2.4),usesRebuiltGraphics()?.22:1);dummy.updateMatrix();this.shotGlows.setMatrixAt(n,dummy.matrix);this.shotGlows.setColorAt(n++,this.shotColor);
      if(bullet.enemy){
        dummy.position.z=1.27;dummy.scale.set(bullet.shape==='diamond'?0:bullet.shape==='missile'?.22:.27,bullet.shape==='missile'?.64:bullet.shape==='diamond'?.27:.42,.1);dummy.updateMatrix();this.shotRims.setMatrixAt(rimCount++,dummy.matrix);
        dummy.position.z=1.44;dummy.scale.set(.105,.135,.07);dummy.updateMatrix();this.shotCores.setMatrixAt(coreCount++,dummy.matrix);
      }else{dummy.position.z=1.44;dummy.scale.set(.045,.33,.07);dummy.updateMatrix();this.shotCores.setMatrixAt(coreCount++,dummy.matrix);}
      if(bullet.enemy&&bullet.shape==='diamond'){dummy.position.set(bullet.x,bullet.y,1.34);dummy.rotation.set(0,0,Math.PI/4);dummy.scale.set(.40,.40,.08);dummy.updateMatrix();this.diamonds.setMatrixAt(diamondCount,dummy.matrix);this.diamonds.setColorAt(diamondCount,this.shotColor);dummy.position.z=1.26;dummy.scale.set(.48,.48,.06);dummy.updateMatrix();this.diamondRims.setMatrixAt(diamondCount++,dummy.matrix);}
      if(bullet.trail)for(let i=1;i<bullet.trail.length&&trailCount<1800;i++){
        const a=bullet.trail[i-1],b=bullet.trail[i],dx=b.x-a.x,dy=b.y-a.y;
        dummy.position.set((a.x+b.x)/2,(a.y+b.y)/2,1.10);dummy.rotation.set(0,0,-Math.atan2(dx,dy));dummy.scale.set(.18*i/bullet.trail.length,Math.hypot(dx,dy)+.28,1);dummy.updateMatrix();this.trails.setMatrixAt(trailCount++,dummy.matrix);
      }
    }this.shots.count=n;this.shots.instanceMatrix.needsUpdate=true;if(this.shots.instanceColor)this.shots.instanceColor.needsUpdate=true;
    this.diamonds.count=diamondCount;this.diamonds.instanceMatrix.needsUpdate=true;this.diamonds.instanceColor!.needsUpdate=true;this.diamondRims.count=diamondCount;this.diamondRims.instanceMatrix.needsUpdate=true;
    this.shotGlows.count=n;this.shotGlows.instanceMatrix.needsUpdate=true;if(this.shotGlows.instanceColor)this.shotGlows.instanceColor.needsUpdate=true;
    this.shotRims.count=rimCount;this.shotRims.instanceMatrix.needsUpdate=true;this.shotCores.count=coreCount;this.shotCores.instanceMatrix.needsUpdate=true;this.trails.count=trailCount;this.trails.instanceMatrix.needsUpdate=true;
    for(const c of this.cascades)c.at-=dt;const due=this.cascades.filter(c=>c.at<=0);this.cascades=this.cascades.filter(c=>c.at>0);for(const c of due)this.event({type:'explode',x:c.x,y:c.y,size:c.size});
    this.wrecks=this.wrecks.filter(w=>{w.age+=dt;if(w.age>=w.life){this.disposeWreck(w);return false;}const t=w.age/w.life;w.model.position.y-=dt*(w.boss?.6:2.3);w.model.rotation.z+=dt*w.side*(w.boss?.13:1.3);w.model.scale.multiplyScalar(Math.exp(-dt*(w.boss?.035:.13)));w.model.traverse(o=>{if(o instanceof T.Sprite||o instanceof T.Mesh){if(!Array.isArray(o.material))o.material.opacity=(1-t)*.7;}});return true;});
    n=0;for(const part of this.particles){part.life-=dt;if(part.life<=0||n>=1600)continue;part.x+=part.vx*dt;part.y+=part.vy*dt;part.z+=part.vz*dt;
      dummy.position.set(part.x,part.y,part.z);dummy.rotation.set(0,0,Math.atan2(part.vy,part.vx));const fade=part.life/part.max;
      dummy.scale.set(part.size*fade,part.size*fade*(Math.hypot(part.vx,part.vy)>8?2:1),part.size*.6*fade);dummy.updateMatrix();this.sparkMesh.setMatrixAt(n,dummy.matrix);this.sparkMesh.setColorAt(n,part.color);n++;
    }this.particles=this.particles.filter(p=>p.life>0);this.sparkMesh.count=n;this.sparkMesh.instanceMatrix.needsUpdate=true;if(this.sparkMesh.instanceColor)this.sparkMesh.instanceColor.needsUpdate=true;
    for(const f of this.flares){
      f.age+=dt;const t=Math.max(0,f.age/f.life);
      f.sprite.visible=f.age>=0;
      f.sprite.scale.setScalar(f.size*(f.smoke?.45+t*.7:.20+Math.sin(Math.min(1,t)*Math.PI/2)*.75));
      f.sprite.material.opacity=Math.max(0,(1-t)*(f.sprite instanceof T.Sprite?(f.smoke?.75:1):(f.smoke?.08:.18)));
      if(f.sprite instanceof T.Sprite){if(!f.smoke)f.sprite.material.map=explosionFrames[Math.min(3,Math.floor(t*4))];else f.sprite.material.rotation+=dt*.12;}
      else f.sprite.rotation.set(t*1.4,t*.8,t*.55);
    }
    this.flares=this.flares.filter(f=>{if(f.age<f.life)return true;this.scene.remove(f.sprite);f.sprite.material.dispose();return false;});
    const blast=this.flares.find(f=>!f.smoke&&f.age>=0&&f.age<.35);this.blastLight.intensity=blast?(usesRebuiltGraphics()?5:45)*(1-blast.age/.35):0;if(blast)this.blastLight.position.copy(blast.sprite.position).add(new T.Vector3(0,0,2.8));
    const ringMat=this.ring.material as T.MeshBasicMaterial;
    ringMat.opacity=Math.max(0,ringMat.opacity-dt*1.6);this.ring.visible=ringMat.opacity>0;this.ring.scale.addScalar(dt*32);
    this.shake=Math.max(0,this.shake-dt*3);const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(dt>0||reduce){const strength=usesRebuiltGraphics()?(mix.crowded?.16:.26):1;this.camera.position.x=reduce?0:(Math.random()-.5)*this.shake*.55*strength;this.camera.position.y=-12.5+(reduce?0:(Math.random()-.5)*this.shake*.35*strength);}
    // Physics-free cinematic lens: shallow banking, arrival push-ins and a measured
    // depth-pressure kick. Player/bullets stay in the same world-space coordinate system.
    if(this.colossal&&dt>0)this.cinematicKick=Math.max(0,this.cinematicKick-dt*1.7);
    const kinetic=!!this.colossal&&!reduce&&game.state!=='paused';
    const invade=kinetic&&!!this.invasion;
    const bossEntry=game.boss&&!game.boss.dead&&game.boss.age<2.3?1-game.boss.age/2.3:0;
    const warp=game.state==='transition'?1:0;
    const intro=invade&&game.state==='playing'&&game.time<6?Math.sin(Math.PI*game.time/6)**2:0;
    // The 3D tunnel's dramatic 20-degree barrel motion happens only during
    // non-interactive stage change. Live combat remains within 0.060 radians.
    const warpRoll=warp?Math.sin(this.epoch*1.65)*Math.min(INVASION_BUDGET.maxWarpRoll,mix.cameraRollCap):0;
    const combatRoll=Math.max(-mix.cameraRollCap,Math.min(mix.cameraRollCap,
      -game.player.vx*.0021+Math.sin(this.epoch*1.2)*intro*.038));
    const targetRoll=kinetic?(invade?(warp?warpRoll:combatRoll):Math.max(-COLOSSAL_BUDGET.maxRollRadians,
      Math.min(COLOSSAL_BUDGET.maxRollRadians,-game.player.vx*.0021))):0;
    const desiredZoom=kinetic?(invade?
      Math.min(warp?INVASION_BUDGET.maxWarpZoom:INVASION_BUDGET.maxBossZoom,
        1+intro*.075+bossEntry*.09+warp*.20+this.cinematicKick*.012):
      Math.min(COLOSSAL_BUDGET.maxZoom,1+bossEntry*.030+warp*.035+this.cinematicKick*.012)):1;
    const targetZoom=Math.min(mix.cameraZoomCap,desiredZoom);
    const follow=dt>0?1-Math.exp(-dt*(warp?5.2:3.8)):reduce?1:0;
    this.cameraRoll+=(targetRoll-this.cameraRoll)*follow;
    this.cameraZoom+=(targetZoom-this.cameraZoom)*follow;
    this.camera.up.set(-Math.sin(this.cameraRoll),Math.cos(this.cameraRoll),0);
    // Full roll is presentational only: simulation, collision and touch raycasts
    // keep their original world coordinates and use this same actual camera.
    this.camera.position.z=40-(kinetic?bossEntry*1.45+warp*2.4+intro*1.2+this.cinematicKick*.38:0);
    this.camera.zoom=this.cameraZoom;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camera.position.x,this.camera.position.y+12.5,0);
    this.frameAverage=this.frameAverage*.98+Math.min(frameMs,100)*.02;this.frames++;
    if(this.frames>150&&this.epoch-this.lastDprChange>5&&this.frameAverage>23&&this.pixelRatio>1){
      this.pixelRatio=Math.max(1,this.pixelRatio-.2);this.renderer.setPixelRatio(this.pixelRatio);this.resize();this.lastDprChange=this.epoch;this.quality='BALANCED';
    }
    if(this.pixelRatio<=1.01&&this.frames>300&&this.epoch-this.lastDprChange>7&&this.frameAverage>32){this.useBloom=false;this.key.castShadow=false;this.quality='PERFORMANCE';}
    if(this.useBloom&&this.pipeline)this.pipeline.render();else if(this.useBloom&&this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
  }
  getDiagnostics(){return {visualStyle:currentVisualStyle(),volumetric:this.volumetric?.diagnostics()??null,depthSpectacle:this.depthSpectacle?.diagnostics()??null,fxMix:this.fxDirector.diagnostics(),scenic:this.scenic?.diagnostics()??null,worldAliveScene:this.aliveScene?.diagnostics()??null,mechanical:this.mechanical?.diagnostics()??null,colossal:this.colossal?.diagnostics()??null,invasion:this.invasion?.diagnostics()??null,cameraRig:{roll:this.cameraRoll,zoom:this.cameraZoom,kick:this.cinematicKick},background:this.background.diagnostics(),stageEffects:this.stageEffects.diagnostics(),combatEffects:this.combatEffects.diagnostics(),air:this.airEffects.diagnostics(),animation:{player:this.playerAnimation,enemies:this.enemyAnimations,boss:this.bossAnimation,wrecks:this.wrecks.length},encounters:this.encounterView.diagnostics(),facilityDemolition:this.facilityDemolition.diagnostics(),textures:visualAssetStatus(),shadows:this.key.castShadow,engine:this.engine,quality:this.quality,dpr:this.pixelRatio,frameMs:this.frameAverage,particles:this.particles.length,width:this.width,height:this.height};}
}
function shipTint(kind:Kind){return kind==='dart'?0xb69add:kind==='lancer'?0xd2ddf7:0xffffff;}
