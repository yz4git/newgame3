import type {Game,Enemy,Bullet} from './sim.ts';
import {segmentDistance2,W,BOTTOM} from './sim.ts';

export type TerrainRoute='cover'|'hazard';
/** Fixed-count gameplay terrain. Positions and collisions are shared by WebGL and Canvas. */
export interface TerrainPiece {
 id:number;stage:number;index:number;route:TerrainRoute;x:number;y:number;originX:number;
 radius:number;hp:number;age:number;warning:number;speed:number;life:number;dead:boolean;side:-1|1;
}
export const TERRAIN_WORLD_NAMES=[
 'ASTEROID DEBRIS PASS','CARRIER WRECKAGE LANE','CITADEL BREACH',
 'GLACIER FRACTURE','RELIC CAUSEWAY','FURNACE SLAG RUN'
] as const;
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export function isTerrainActive(piece:TerrainPiece){
 return !piece.dead&&piece.age>=piece.warning&&piece.y>-18&&piece.y<18;
}
export function terrainSpawn(g:Game,route:TerrainRoute,index:number,x:number){
 if(g.mode!=='campaign'||g.boss)return;
 const st=g.battlefield;
 // The new corridor is centered on the player's current lane so obstacles never materialize on top of the ship.
 const lane=clamp(g.player.x,-3.5,3.5),off=route==='cover'?4.15:3.9;
 for(const row of [0,1])for(const side of [-1,1] as const){
  const radius=route==='cover'?1.34:1.18;
  st.terrain.push({
   id:++st.terrainSerial,stage:g.stage,index,route,x:clamp(lane+side*(off+row*.32),-8.8,8.8),
   originX:x,y:14+row*6.0+Math.abs(side)*0,
   radius,hp:route==='hazard'?15+g.stage*2:999,
   age:0,warning:route==='hazard'?1.45:.80,speed:route==='hazard'?3.15:3.5,life:13,dead:false,side
  });
 }
 if(st.terrain.length>12)st.terrain.splice(0,st.terrain.length-12);
 st.route=route;st.terrainCreated++;
 g.emit('terrainroute',{x,y:12,color:route==='cover'?0x7eeeff:0xff986d,
  text:TERRAIN_WORLD_NAMES[g.stage]+' / '+(route==='cover'?'COVER ROUTE · 弾を遮る残骸':'DANGER ROUTE · 撃って排除する障害物')});
}
export function updateTerrain(g:Game,dt:number){
 const st=g.battlefield;
 for(const piece of st.terrain){
  piece.age+=dt;piece.y-=piece.speed*dt;
  if(piece.age>=piece.life||piece.y<-19)piece.dead=true;
 }
 st.terrain=st.terrain.filter(p=>!p.dead);
}
export function interceptTerrainShot(g:Game,bullet:Bullet):boolean{
 if(g.mode!=='campaign'||g.boss||bullet.dead)return false;
 for(const piece of g.battlefield.terrain){
  if(!isTerrainActive(piece))continue;
  if(segmentDistance2(bullet.px,bullet.py,bullet.x,bullet.y,piece.x,piece.y)>(piece.radius+bullet.radius)**2)continue;
  if(bullet.enemy){
   bullet.dead=true;g.battlefield.shotsBlocked++;
   if(g.battlefield.shotsBlocked%6===0)g.addScore(90*g.multiplier);
   return true;
  }
  if(piece.route==='cover')continue; // Player shots pass through friendly cover.
  bullet.dead=true;piece.hp-=Math.max(.5,bullet.damage);
  if(piece.hp<=0){
   piece.dead=true;g.battlefield.hazardsCleared++;
   g.addScore(650*g.multiplier);
   g.emit('terrainbreak',{x:piece.x,y:piece.y,size:1.7,color:0xffb983});
  }
  return true;
 }
 return false;
}
export function redirectTerrainEnemy(g:Game,e:Enemy,dt:number){
 if(g.mode!=='campaign'||g.boss||e.terrainRedirected||e.dead)return;
 for(const piece of g.battlefield.terrain){
  if(!isTerrainActive(piece)||Math.abs(e.y-piece.y)>piece.radius+e.radius+2.0)continue;
  if(Math.abs(e.x-piece.x)>piece.radius+e.radius+1.0)continue;
  const dir=e.x>=piece.x?1:-1;
  e.origin=clamp(e.origin+dir*3.1,-W+.9,W-.9);
  e.x=clamp(e.x+dir*Math.max(1.1,dt*12),-W+.9,W-.9);
  e.terrainRedirected=true;g.battlefield.rerouted++;
  if(g.battlefield.rerouted%3===1)g.emit('terrainflank',{x:e.x,y:e.y,text:'FLANKING SQUAD / 敵編隊が残骸を迂回'});
  return;
 }
}
export function collideTerrainPlayer(g:Game){
 if(g.mode!=='campaign'||g.boss)return;
 const player=g.player;
 for(const piece of g.battlefield.terrain){
  if(!isTerrainActive(piece))continue;
  const dx=player.x-piece.x,dy=player.y-piece.y;
  const radius=piece.radius+.36;
  if(dx*dx+dy*dy>=radius*radius)continue;
  if(piece.route==='hazard'){
   if(g.invulnerable<=0){g.hitPlayer();piece.dead=true;} // One contact per charged hazard, no repeated hit-lock.
   return;
  }
  const horizontal=Math.sqrt(Math.max(0,radius*radius-dy*dy))+.06;
  const direction=dx===0?-piece.side:Math.sign(dx);
  player.x=clamp(piece.x+direction*horizontal,-W,W);
 }
}
