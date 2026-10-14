import * as T from 'three/webgpu';
import {PLAYER_BALANCE} from './player-balance.ts';
import type {Game} from './sim.ts';

/** An overlay at the collision plane, with a fixed radius and dark outline.
 * Hull banking and invulnerability never displace or enlarge the hit point. */
export function playerMarker(){
 const root=new T.Group();root.name='player-hit-point';
 const add=(geometry:T.BufferGeometry,color:number,order:number)=>{
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false,transparent:true}));
  mesh.renderOrder=order;root.add(mesh);
 };
 add(new T.RingGeometry(.98,1.42,24),0x03101e,60);
 add(new T.RingGeometry(.80,1,24),0xffffff,61);
 add(new T.CircleGeometry(.34,12),0xa4f6ff,62);
 return root;
}
export function positionPlayerMarker(marker:T.Group,g:Game){
 marker.position.set(g.player.x,g.player.y,1);
 marker.scale.setScalar(PLAYER_BALANCE.hitRadius[g.difficulty]);
 marker.visible=g.state!=='title'&&g.state!=='transition'&&g.state!=='result'&&g.hull>0;
}
