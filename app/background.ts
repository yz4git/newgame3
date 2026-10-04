import * as T from 'three/webgpu';
import {Game} from './sim.ts';
import {makeAtlas,makeCloud,makeLandmark} from './bg-art.ts';
import {TILE,CHIP_SIZE,ATLAS_COLS,LANDMARKS,chipAt,stageDistance,zoneAt,type Landmark} from './bg-map.ts';

/** Both renderers consume the same authored map and atlas. No frame-time painting. */
export class BackgroundArt {
  stage=-1;atlas!:HTMLCanvasElement;cloud=makeCloud();landmarks=new Map<number,HTMLCanvasElement>();
  setStage(stage:number){if(stage===this.stage)return false;this.stage=stage;this.atlas=makeAtlas(stage);this.landmarks.clear();LANDMARKS[stage].forEach((l,i)=>this.landmarks.set(l.distance,makeLandmark(stage,l.kind,i)));return true;}
  distance(g:Game){return g.state==='title'?18+g.visualTime*1.4:stageDistance(g.time);}
}
interface Stream {mesh:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;speed:number;scale:number;row:number;far:boolean;}
export class TileBackground {
  root=new T.Group();art=new BackgroundArt();private streams:Stream[]=[];private objects:{mesh:T.Mesh;entry:Landmark}[]=[];private clouds:T.Mesh[]=[];private resources:T.Texture[]=[];distance=0;
  constructor(){this.setStage(0);}
  private clear(){this.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});this.root.clear();for(const t of this.resources)t.dispose();this.resources=[];this.streams=[];this.objects=[];this.clouds=[];}
  private texture(canvas:HTMLCanvasElement){const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;t.generateMipmaps=false;t.minFilter=T.LinearFilter;this.resources.push(t);return t;}
  setStage(stage:number){
    if(!this.art.setStage(stage))return;this.clear();const atlas=this.texture(this.art.atlas);
    for(const [speed,scale,z,far] of [[.3,6,-16,true],[1,4,-3.8,false]] as [number,number,number,boolean][]){
      const geometry=new T.BufferGeometry(),count=12*20*6;geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2).setUsage(T.DynamicDrawUsage));
      const material=new T.MeshBasicMaterial({map:atlas,color:far?0x728794:0xc9d1d4,toneMapped:false,transparent:stage===1,alphaTest:stage===1?.015:0});const mesh=new T.Mesh(geometry,material);mesh.position.z=z;mesh.frustumCulled=false;this.root.add(mesh);this.streams.push({mesh,speed,scale,row:Infinity,far});
    }
    const maps=new Map<number,T.Texture>();for(const[k,v]of this.art.landmarks)maps.set(k,this.texture(v));
    for(const entry of LANDMARKS[stage]){
      const mesh=new T.Mesh(new T.PlaneGeometry(16*entry.scale,21.333*entry.scale),new T.MeshBasicMaterial({map:maps.get(entry.distance),color:0xd5dce0,transparent:true,depthWrite:false,toneMapped:false}));mesh.position.set(entry.x,entry.distance,-2.4);this.root.add(mesh);this.objects.push({mesh,entry});
    }
    // Near clouds cross at 1.38x ground speed; distant haze moves with the far field.
    const cloud=this.texture(this.art.cloud);for(let i=0;i<6;i++){
      const mesh=new T.Mesh(new T.PlaneGeometry(35,29),new T.MeshBasicMaterial({map:cloud,color:stage===2?0xc89d86:stage===1?0x827ec5:0xc4e3e7,transparent:true,opacity:i<3?.40:.24,depthWrite:false,toneMapped:false}));mesh.position.z=i<3?4:-10;this.root.add(mesh);this.clouds.push(mesh);
    }
  }
  private fill(stream:Stream,row:number){
    const positions=stream.mesh.geometry.getAttribute('position') as T.BufferAttribute,uv=stream.mesh.geometry.getAttribute('uv') as T.BufferAttribute;
    const height=this.art.atlas.height;let n=0;
    for(let r=0;r<20;r++)for(let col=-6;col<6;col++){
      const worldRow=row+r-9,id=chipAt(this.art.stage,col,worldRow,stream.far),empty=!stream.far&&Math.floor(id/4)===0;
      const x=col*stream.scale,y=(r-9)*stream.scale,s=empty?0:stream.scale;
      const u0=(id%ATLAS_COLS*CHIP_SIZE+.5)/this.art.atlas.width,u1=(id%ATLAS_COLS*CHIP_SIZE+CHIP_SIZE-.5)/this.art.atlas.width;
      const v1=1-(Math.floor(id/ATLAS_COLS)*CHIP_SIZE+.5)/height,v0=1-(Math.floor(id/ATLAS_COLS)*CHIP_SIZE+CHIP_SIZE-.5)/height;
      for(const [dx,dy,u,v]of[[0,0,u0,v0],[1,0,u1,v0],[1,1,u1,v1],[0,0,u0,v0],[1,1,u1,v1],[0,1,u0,v1]]){positions.setXYZ(n,x+dx*s,y+dy*s,0);uv.setXY(n,u,v);n++;}
    }positions.needsUpdate=true;uv.needsUpdate=true;stream.row=row;
  }
  draw(g:Game){
    this.setStage(g.stage);this.distance=this.art.distance(g);
    for(const s of this.streams){const offset=this.distance*s.speed,row=Math.floor(offset/s.scale);if(row!==s.row)this.fill(s,row);s.mesh.position.y=-(offset-row*s.scale);}
    for(const {mesh,entry}of this.objects){mesh.position.y=entry.distance-this.distance;mesh.visible=Math.abs(mesh.position.y)<45;}
    for(let i=0;i<this.clouds.length;i++){const m=this.clouds[i],speed=i<3?1.38:.16;m.position.x=(i%2?-1:1)*(13+Math.sin((this.distance+i*70)*.008)*4);m.position.y=((i*37-this.distance*speed)%126+126)%126-63;}
  }
  diagnostics(){return {technique:'BG CHIP ATLAS',zone:zoneAt(this.art.stage,this.distance),distance:Math.round(this.distance),layers:4,quads:480};}
}
export class CanvasBackground {
  art=new BackgroundArt();private distance=0;
  draw(c:CanvasRenderingContext2D,g:Game){
    this.art.setStage(g.stage);this.distance=this.art.distance(g);const atlas=this.art.atlas;
    c.save();
    for(const far of[true,false]){
      const scale=far?6:4,offset=this.distance*(far?.3:1),row=Math.floor(offset/scale),shift=offset-row*scale;c.globalAlpha=far?.60:.85;
      for(let r=-7;r<8;r++)for(let col=-4;col<4;col++){
        const id=chipAt(g.stage,col,row+r,far);if(!far&&Math.floor(id/4)===0)continue;
        c.save();c.translate(col*scale,(r+1)*scale-shift);c.scale(1,-1);c.drawImage(atlas,id%ATLAS_COLS*CHIP_SIZE,Math.floor(id/ATLAS_COLS)*CHIP_SIZE,CHIP_SIZE,CHIP_SIZE,0,0,scale+.008,scale+.008);c.restore();
      }
    }
    c.globalAlpha=.92;for(const e of LANDMARKS[g.stage]){const y=e.distance-this.distance;if(Math.abs(y)>40)continue;c.save();c.translate(e.x,y);c.scale(1,-1);c.drawImage(this.art.landmarks.get(e.distance)!,-8*e.scale,-10.666*e.scale,16*e.scale,21.333*e.scale);c.restore();}
    c.globalAlpha=.25;for(let i=0;i<6;i++){const speed=i<3?1.38:.16,x=(i%2?-1:1)*(13+Math.sin((this.distance+i*70)*.008)*4),y=((i*37-this.distance*speed)%126+126)%126-63;c.drawImage(this.art.cloud,x-17,y-14,35,29);}
    c.restore();
  }
  diagnostics(){return {technique:'BG CHIP ATLAS',zone:zoneAt(this.art.stage,this.distance),distance:Math.round(this.distance),layers:4};}
}
