import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Stylized hard-surface art is procedural: no sprite billboards or 2D backdrops.
// Shared primitives/materials keep the mobile GPU cost predictable.
const cube = new T.BoxGeometry(1, 1, 1);
const cylinder = new T.CylinderGeometry(1, 1, 1, 9);
const orb = new T.IcosahedronGeometry(1, 1);
const cone = new T.ConeGeometry(1, 1, 7);
const torus = new T.TorusGeometry(1, .08, 6, 32);
const plane = new T.PlaneGeometry(1, 1, 8, 8);
const r = (seed: number) => { const v = Math.sin(seed * 127.19 + 19.7) * 43758.5453; return v - Math.floor(v); };
const standard = (c: number, emissive = 0) => new T.MeshStandardMaterial({
  color: c, metalness: .79, roughness: .29, flatShading: true,
  emissive: c, emissiveIntensity: emissive
});
const neon = (c: number, alpha = 1) => new T.MeshBasicMaterial({
  color: c, transparent: alpha < 1, opacity: alpha,
  depthWrite: alpha === 1, blending: alpha < 1 ? T.AdditiveBlending : T.NormalBlending,
  toneMapped: false
});
function part(parent: T.Group, geometry: T.BufferGeometry, material: T.Material,
  x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}
function poly(parent: T.Group, points: [number, number][], thickness: number, material: T.Material, y = 0) {
  const n = points.length, pos: number[] = [], idx: number[] = [];
  for (const layer of [y - thickness / 2, y + thickness / 2])
    for (const [x, z] of points) pos.push(x, layer, z);
  for (let i = 1; i < n - 1; i++) {
    idx.push(n, n + i, n + i + 1);
    idx.push(0, i + 1, i);
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    idx.push(i, next, n + next, i, n + next, n + i);
  }
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  const mesh = new T.Mesh(geom, material);
  parent.add(mesh);
  return mesh;
}
function beam(parent: T.Group, from: T.Vector3, to: T.Vector3, width: number, material: T.Material) {
  const line = new T.Mesh(cylinder, material);
  const delta = to.clone().sub(from);
  line.position.copy(from).add(to).multiplyScalar(.5);
  line.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
  line.scale.set(width, delta.length(), width);
  parent.add(line);
  return line;
}
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

export function createFlightShip(color: number, boss = false, variant = 0) {
  const root = new T.Group();
  const hull = standard(color, .08);
  const armor = standard(0x233650);
  const edge = standard(0x8daec3, .1);
  const dark = standard(0x101b2c);
  const lamp = neon(boss ? 0xff9773 : 0x7de9ff);
  const hullShape: [number, number][] = [
    [0, -3.0], [.66, -1.65], [.72, -.45], [.55, 1.36], [.30, 2.18],
    [-.30, 2.18], [-.55, 1.36], [-.72, -.45], [-.66, -1.65]
  ];
  poly(root, hullShape, .72, hull, 0);
  poly(root, [[0,-2.95],[.18,-2.22],[.18,1.6],[-.18,1.6]], .1, edge, .41);
  const canopy = part(root, orb, standard(0x145d79,.35), 0, .55, -.95, .50, .46, 1.05);
  canopy.rotation.x = .12;
  part(root, orb, neon(0x92f6ff,.6), 0, .69, -1.16, .25, .12, .64);
  for (const s of [-1, 1]) {
    const shape: [number,number][] = [
      [s*.53,-1.46],[s*1.28,-1.1],[s*3.17,.16],
      [s*3.34,.61],[s*2.48,.92],[s*.88,1.73]
    ];
    poly(root, shape, .25, hull, -.13);
    poly(root, [[s*.82,-.9],[s*2.53,.25],[s*2.37,.55],[s*.82,.52]], .09, armor, .075);
    poly(root, [[s*2.95,.18],[s*3.41,.22],[s*3.53,1.38],[s*3.12,1.16]], .2, edge, .08);
    beam(root, V(s*.92,.1,.84), V(s*2.64,.1,.12), .065, edge);
    part(root,cube,dark,s*1.02,-.3,.58,.69,.64,1.75);
    const nozzle = part(root,cylinder,edge,s*1.10,-.20,1.58,.37,.79,.37);
    nozzle.rotation.x = Math.PI/2;
    part(root,cylinder,lamp,s*1.10,-.20,1.99,.27,.09,.27).rotation.x = Math.PI/2;
    const flame = part(root,cone,neon(0x54e1ff,.63),s*1.1,-.20,2.42,.29,.95,.29);
    flame.rotation.x = Math.PI/2;
    flame.userData.flame = true;
    part(root,cube,hull,s*2.25,.23,.49,.27,.53,1.1);
    part(root,orb,lamp,s*2.25,.27,-.21,.18,.12,.3);
    beam(root,V(s*.56,.25,-1.24),V(s*1.75,.15,-.43),.09,dark);
  }
  part(root,cube,edge,0,-.24,.92,.36,.29,1.4);
  part(root,orb,lamp,0,.12,-2.8,.13,.17,.24);
  if (!boss) {
    root.scale.setScalar(.86);
    root.rotation.y = Math.PI; // opponents face the player (+Z)
    // Player is rotated back at its construction call-site.
  } else {
    root.scale.set(2.05,1.6,1.8);
    for (const s of [-1,1]) {
      poly(root, [[s*2.45,-1.8],[s*4.85,-.97],[s*5.7,.8],[s*4.15,1.8],[s*2.48,1.17]],.95,armor,.23);
      beam(root,V(s*2.7,.15,.4),V(s*4.4,.5,-.4),.18,edge);
      part(root,cylinder,hull,s*4.55,.8,-1.12,.66,1.15,.66).rotation.x=Math.PI/2;
      part(root,orb,lamp,s*4.55,.8,-2.03,.42,.42,.4);
    }
    const ring = part(root,torus,lamp,0,.6,-.75,1.53,1.53,1);
    ring.userData.spin = true; ring.rotation.x = .35;
    part(root,orb,lamp,0,.55,-.72,.6,.6,.6);
    // Sector-exclusive silhouettes make each guardian a recognizable machine.
    const signature=neon([0x75dcff,0x67ffe2,0xf0a5ff,0xa5f5ff,0x8cff9e,0xffaa66][variant%6]);
    if(variant===0){ // orbital refinery: concentric stabilizers and dish array
      for(const s of [-1,1]){
        part(root,torus,signature,s*4.1,.7,.8,2.5,2.5,.85).rotation.y=.33*s;
        part(root,orb,armor,s*4.1,.7,.8,.85,.85,.85);
      }
    }else if(variant===1){ // ocean carrier: elongated deck and outboard hulls
      poly(root,[[-3,-2.6],[3,-2.6],[5.7,.4],[3.6,2.9],[-3.6,2.9],[-5.7,.4]],.25,armor,.9);
      for(const s of [-1,1]){
        part(root,cube,edge,s*5.2,-.55,1.2,1.5,1.2,5.3);
        part(root,cube,signature,s*4.7,1,.5,.12,.14,2.5);
      }
    }else if(variant===2){ // urban sentinel: upright weapon spines
      for(const s of [-1,1]){
        part(root,cube,armor,s*3.2,1.9,.1,.82,4.6,1.2);
        part(root,cube,signature,s*3.2,4.2,-.5,.2,1.15,.35);
        beam(root,V(s*1.1,.6,.8),V(s*3.2,4.1,-.3),.23,edge);
      }
    }else if(variant===3){ // polar colossus: crystalline armor blades
      for(const s of [-1,1]){
        const spear=part(root,cone,edge,s*4.0,2.6,.1,1.05,6.7,.95);
        spear.rotation.z=s*.31;
        part(root,orb,signature,s*4.6,2.1,.3,.65,.85,.58);
      }
    }else if(variant===4){ // forest guardian: articulated claws
      for(const s of [-1,1]){
        beam(root,V(s*4.1,.6,-.6),V(s*6.2,1.9,-2.2),.58,armor);
        beam(root,V(s*6.2,1.9,-2.2),V(s*7.4,.2,-3.6),.38,edge);
        part(root,orb,signature,s*6.2,1.9,-2.2,.65,.65,.65);
      }
    }else{ // crucible: paired furnace drums and rotary heat rings
      for(const s of [-1,1]){
        const barrel=part(root,cylinder,armor,s*3.4,1.8,1.6,1.25,3.3,1.25);
        barrel.rotation.x=Math.PI/2;
        const rotor=part(root,torus,signature,s*3.4,1.8,-.3,1.4,1.4,1);
        rotor.userData.spin=true;
        part(root,orb,signature,s*3.4,1.8,-.3,.8,.8,.8);
      }
    }
  }
  root.userData.engines = root.children.filter(o => o.userData.flame);
  root.userData.variant = variant;
  return root;
}
export function animateFlightShip(ship: T.Group, time: number, speedRatio: number) {
  for (const o of ship.userData.engines as T.Object3D[] ?? []) {
    o.scale.y = 1 + Math.sin(time * 47 + o.position.x * 3) * .12 + speedRatio * .42;
  }
  for (const child of ship.children) if (child.userData.spin) child.rotation.z += .009;
}

const lattice = (root: T.Group, x: number, y: number, z: number, h: number,
  metal: T.Material, light: T.Material) => {
  part(root,cube,metal,x,y+h*.5,z,1.15,h,1.15);
  for (let i=0;i<3;i++) {
    const height=y+i*h/3+.7;
    beam(root,V(x-1.5,height,z),V(x+1.5,height+1.7,z),.10,light);
    beam(root,V(x+1.5,height,z),V(x-1.5,height+1.7,z),.09,metal);
  }
  part(root,orb,light,x,y+h,z,.24,.24,.24);
};
export function createFlightSection(
  stage: number, index: number, z: number,
  ground: T.Material, metal: T.Material, accent: T.Material
) {
  const root = new T.Group();
  root.position.z=z;
  const water = stage===1 || stage===5, space=stage===0;
  if (!space) {
    const floor=part(root,plane,ground,0,-15,0,56,30,1);
    floor.rotation.x=-Math.PI/2;
    if (water) {
      const geo=floor.geometry.clone();
      // Separate river/ocean relief: horizon-visible normals reflect the key light.
      const position=geo.getAttribute('position');
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i);
        position.setZ(i,Math.sin(x*.3+index*.7)*.24+Math.cos(y*.47+index*.8)*.35);
      }
      position.needsUpdate=true;geo.computeVertexNormals();floor.geometry=geo;
    }
  }
  for (let n=0;n<7;n++) {
    const seed=index*101+n*13+stage*1103, s=n%2===0?1:-1;
    const x=s*(12+r(seed)*17), zz=(r(seed+6)-.5)*25;
    if(stage===0) {
      const asteroid=part(root,orb,metal,x*(.8+r(seed+9)),r(seed+3)*27-7,zz,
        2+r(seed+4)*4.2,1.7+r(seed+7)*4.5,2+r(seed+2)*5.5);
      asteroid.rotation.set(r(seed+8)*3,r(seed+4)*4,r(seed+6)*2);
      if(n===1 || n===5) {
        part(root,cylinder,metal,x*.7,5,zz,3,4,3).rotation.z=Math.PI/2;
        part(root,torus,accent,x*.7,5,zz,5.5,5.5,1).rotation.y=.3;
        for(const sx of [-1,1]) part(root,cube,ground,x*.7+sx*5,4,zz,3.5,.18,5);
      }
    }
    if(stage===1) {
      if(n<4) {
        poly(root,[[x-2,zz-7],[x+2,zz-7],[x+2.7,zz+4],[x,zz+7],[x-2.7,zz+4]],2,metal,-12.1);
        part(root,cube,accent,x,-10.8,zz,.3,.12,7.5);
        part(root,cube,metal,x,-9.5,zz,3.4,2.7,3);
        part(root,cylinder,metal,x+1.1,-6.2,zz,.17,4,.17);
        part(root,orb,accent,x+1.1,-3.9,zz,.41,.31,.34);
      } else {
        lattice(root,x,-14,zz,16+10*r(seed+2),metal,accent);
        beam(root,V(x,-.4,zz),V(x-s*6,-2,zz),.19,metal);
      }
    }
    if(stage===2) {
      const h=12+r(seed)*32, w=3+r(seed+2)*4;
      part(root,cube,metal,x,-15+h*.5,zz,w,h,w);
      for(let f=0;f<5;f++) {
        const fy=-13+f*(h-3)/4;
        part(root,cube,accent,x,fy,zz+w*.501,w*.75,.09,.09);
        part(root,cube,ground,x,fy+.35,zz-w*.505,w*.87,.44,.1);
      }
      part(root,cube,accent,x,-15+h+.15,zz,w*1.12,.22,w*1.12);
      if(n===2 || n===4) beam(root,V(x,-15+h,zz),V(x-s*13,-8,zz+5),.32,metal);
    }
    if(stage===3) {
      const spire=part(root,cone,metal,x,-6,zz,3.1,20+r(seed)*30,3.8);
      spire.rotation.z=(r(seed+3)-.5)*.35;
      const fractures=part(root,orb,accent,x,-12,zz+1.5,2.7,1.0,3.1);
      fractures.rotation.z=.6;
      if(n===1 || n===5) {
        part(root,cube,metal,x,-11,zz,12,6,9);
        part(root,orb,accent,x,-7,zz,2.1,.45,2.1);
      }
    }
    if(stage===4) {
      const trunk=part(root,cylinder,metal,x,-4,zz,1,24+r(seed)*10,1);
      trunk.rotation.z=.1*s;
      for(let b=0;b<4;b++) {
        const dx=(b-1.5)*2.5,dy=3+(b%2)*3;
        beam(root,V(x,2,zz),V(x+dx,dy+6,zz+dx*.3),.26,metal);
        part(root,orb,ground,x+dx,dy+8,zz+dx*.3,4.3,2.7,4.2);
      }
      if(n===3) {
        part(root,cube,metal,x,-10,zz,8,10,8);
        for(let level=0;level<3;level++) part(root,cube,accent,x,-4+level*2,zz,8-level*1.1,.34,8-level*1.1);
      }
    }
    if(stage===5) {
      const h=11+r(seed)*19;
      part(root,cylinder,metal,x,-15+h*.5,zz,2.6,h,2.6);
      for(let t=0;t<3;t++)part(root,torus,accent,x,-13+h*(t+1)/4,zz,2.8,2.8,.5).rotation.x=Math.PI/2;
      part(root,cone,ground,x,-15+h+1,zz,3,4,3);
      if(n===2||n===5) {
        beam(root,V(x,-2,zz),V(x-s*13,2,zz+6),.68,metal);
        part(root,orb,accent,x-s*13,2,zz+6,.68,.68,.68);
      }
    }
  }
  // Distinct authored architectural beats rather than identical portals everywhere.
  if(index%5===2) {
    for(const s of [-1,1]) lattice(root,s*12,-14,3,12,metal,accent);
    beam(root,V(-12,-1,3),V(12,-1,3),.32,metal);
    for(let i=-4;i<=4;i++)part(root,cube,accent,i*2.4,-1,3,.12,.35,.12);
  } else if(index%5===4) {
    const ring=part(root,torus,accent,0,1,-1,10.3,10.3,.95);
    ring.rotation.z=(index%3-1)*.18;
    for(const s of [-1,1]) part(root,cube,metal,s*10,-7,-1,1.4,16,2);
  }
  // Static geometric batching: at most three draw calls per section, rather
  // than a separate draw call for every building, tree, wave and surface.
  const materials=new Map<T.Material,T.BufferGeometry[]>();
  for(const object of [...root.children]){
    if(!(object instanceof T.Mesh)) continue;
    object.updateMatrix();
    const geometry=object.geometry.clone().applyMatrix4(object.matrix);
    for(const name of Object.keys(geometry.attributes)){
      if(name!=='position'&&name!=='normal') geometry.deleteAttribute(name);
    }
    const material=Array.isArray(object.material)?object.material[0]:object.material;
    const bucket=materials.get(material)||[];
    bucket.push(geometry);
    materials.set(material,bucket);
    if(!SHARED.has(object.geometry))object.geometry.dispose();
    root.remove(object);
  }
  for(const [material,geometries] of materials){
    const merged=mergeGeometries(geometries,false);
    if(merged)root.add(new T.Mesh(merged,material));
    geometries.forEach(g=>g.dispose());
  }
  return root;
}

const SHARED=new Set<T.BufferGeometry>([cube,cylinder,orb,cone,torus,plane]);
export function disposeFlightVisual(root:T.Object3D,materials=false){
  const disposed=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    if(!SHARED.has(o.geometry)&&!disposed.has(o.geometry)){
      disposed.add(o.geometry);o.geometry.dispose();
    }
    if(materials){
      const array=Array.isArray(o.material)?o.material:[o.material];
      for(const m of array)mats.add(m);
    }
  });
  for(const m of mats)m.dispose();
}


/** Camera-centered spherical atmosphere with real 3D directional color.
 * No photo skybox, billboard or environment texture is required. */
export class FlightAtmosphere {
  readonly material=new T.ShaderMaterial({
    uniforms:{
      upper:{value:new T.Color(0x040b1b)},
      lower:{value:new T.Color(0x132b45)},
      sun:{value:new T.Color(0x5caacc)}
    },
    vertexShader: 'varying vec3 vRay; void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: String.raw`
      varying vec3 vRay;
      uniform vec3 upper;
      uniform vec3 lower;
      uniform vec3 sun;
      void main(){
        vec3 dir=normalize(vRay);
        float band=smoothstep(-0.62,0.78,dir.y);
        vec3 col=mix(lower,upper,band);
        float halo=pow(max(0.0,dot(dir,normalize(vec3(-0.57,0.32,-0.77)))),35.0);
        col+=sun*halo*0.48;
        col+=sun*0.055*exp(-abs(dir.y+0.07)*8.0);
        gl_FragColor=vec4(col,1.0);
      }
    `,
    side:T.BackSide,depthWrite:false,depthTest:false,
    fog:false
  });
  readonly mesh=new T.Mesh(new T.SphereGeometry(300,28,16),this.material);
  constructor(){
    this.mesh.renderOrder=-1000;
    this.mesh.frustumCulled=false;
  }
  setPalette(upper:number,lower:number,sun:number) {
    (this.material.uniforms.upper.value as T.Color).setHex(upper);
    (this.material.uniforms.lower.value as T.Color).setHex(lower);
    (this.material.uniforms.sun.value as T.Color).setHex(sun);
  }
  follow(position:T.Vector3){this.mesh.position.copy(position);}
}

export class FlightVfx {
  readonly root = new T.Group();
  private streaks: T.InstancedMesh;
  private streakCapacity: number;
  private sparks: T.InstancedMesh;
  private dummy = new T.Object3D();
  private particles: { p:T.Vector3;v:T.Vector3;age:number;life:number;color:T.Color;size:number }[] = [];
  private rings: { mesh:T.Mesh;life:number }[] = [];
  constructor(mobile: boolean) {
    const count=mobile?44:74;
    this.streakCapacity=count;
    this.streaks = new T.InstancedMesh(cube, neon(0x8bdfff,.55),count);
    this.streaks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.streaks.frustumCulled=false;
    this.root.add(this.streaks);
    this.sparks=new T.InstancedMesh(cube,new T.MeshBasicMaterial({
      color:0xffffff,transparent:true,opacity:.92,depthWrite:false,blending:T.AdditiveBlending
    }), mobile?160:260);
    this.sparks.setColorAt(0,new T.Color(0xffffff));
    this.sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.sparks.frustumCulled=false;
    this.root.add(this.sparks);
  }
  burst(position:T.Vector3, size:number, color=0xff985d) {
    const count=Math.floor(Math.min(42,8+size*4));
    for(let i=0;i<count && this.particles.length<this.sparks.instanceMatrix.count;i++) {
      const a=i*2.39996+r(i+size)*.6,z=r(i*19+size)*2-1;
      const v=new T.Vector3(Math.cos(a),Math.sin(a),z).normalize()
        .multiplyScalar((7+r(i+size*13)*17)*Math.sqrt(size/2));
      this.particles.push({ p:position.clone(),v,age:0,life:.32+r(i*7+size)*.6,color:new T.Color(i%4===0?0xffffff:color),size:.08+r(i*11+size)*.24 });
    }
    // Flash rings must not grow into screen-sized white disks that hide bosses.
    const mesh=new T.Mesh(new T.RingGeometry(.7,1.05,32),neon(0xffbb86,.24));
    mesh.position.copy(position);this.root.add(mesh);
    this.rings.push({mesh,life:.6});
  }
  clear() {
    this.particles.length=0;this.sparks.count=0;
    for(const r of this.rings){this.root.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as T.Material).dispose();}
    this.rings.length=0;
  }
  update(position:T.Vector3,time:number,dt:number,speed:number,boost:boolean) {
    const active=(boost?1.5:1)*Math.min(1.5,speed/60);
    const stride=boost?this.streakCapacity:Math.round(this.streakCapacity*.28);
    this.streaks.count=stride;
    for(let i=0;i<stride;i++) {
      const u=r(i*7+8),v=r(i*19+3),z=(r(i*13+5)*240+time*speed*1.65)%250;
      const x=(u-.5)*60,y=(v-.5)*46;
      this.dummy.position.set(position.x+x,position.y+y,position.z-220+z);
      this.dummy.scale.set(.022*active,.024*active,(1.4+r(i+1)*2.7)*active);
      this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();
      this.streaks.setMatrixAt(i,this.dummy.matrix);
    }
    this.streaks.instanceMatrix.needsUpdate=true;
    let drawn=0;
    for(let i=this.particles.length-1;i>=0;i--) {
      const p=this.particles[i];
      p.age+=dt;
      if(p.age>=p.life){this.particles.splice(i,1);continue;}
      p.p.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.max(0,1-dt*1.7));
      const s=p.size*(1-p.age/p.life);
      this.dummy.position.copy(p.p);this.dummy.scale.set(s,s,s);this.dummy.rotation.set(0,0,0);
      this.dummy.updateMatrix();this.sparks.setMatrixAt(drawn,this.dummy.matrix);this.sparks.setColorAt(drawn,p.color);drawn++;
    }
    this.sparks.count=drawn;
    this.sparks.instanceMatrix.needsUpdate=true;
    if(this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate=true;
    for(let i=this.rings.length-1;i>=0;i--){
      const ring=this.rings[i];ring.life-=dt;
      ring.mesh.scale.setScalar(0.65+(1-ring.life/.6)*2.25);
      (ring.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,ring.life/.6)*.24;
      if(ring.life<=0){this.root.remove(ring.mesh);ring.mesh.geometry.dispose();(ring.mesh.material as T.Material).dispose();this.rings.splice(i,1);}
    }
  }
}
