import * as T from 'three';

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
  return root;
}

export class FlightVfx {
  readonly root = new T.Group();
  private streaks: T.InstancedMesh;
  private sparks: T.InstancedMesh;
  private dummy = new T.Object3D();
  private particles: { p:T.Vector3;v:T.Vector3;age:number;life:number;color:T.Color;size:number }[] = [];
  private rings: { mesh:T.Mesh;life:number }[] = [];
  constructor(private mobile: boolean) {
    const count=mobile?75:130;
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
    const mesh=new T.Mesh(new T.RingGeometry(.7,1.05,32),neon(0xffcd9a,.83));
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
    const stride=this.streaks.count;
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
      ring.mesh.scale.setScalar(1+(1-ring.life/.6)*7);
      (ring.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,ring.life/.6)*.83;
      if(ring.life<=0){this.root.remove(ring.mesh);ring.mesh.geometry.dispose();(ring.mesh.material as T.Material).dispose();this.rings.splice(i,1);}
    }
  }
}
