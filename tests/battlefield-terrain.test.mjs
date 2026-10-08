import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP,STAGES} from '../app/sim.ts';
import {
 terrainSpawn,updateTerrain,interceptTerrainShot,redirectTerrainEnemy,collideTerrainPlayer,
 isTerrainActive,TERRAIN_WORLD_NAMES
} from '../app/battlefield-terrain.ts';
const idle={x:0,y:0,focus:false};
function combat(){const g=new Game();g.start();g.battlefield.seen=[true,true];return g;}
function activate(piece,g){piece.age=piece.warning+.1;piece.y=g.player.y;piece.x=g.player.x;}
test('Six worlds have distinct shifting terrain routes and bounded debris pools',()=>{
 assert.equal(TERRAIN_WORLD_NAMES.length,STAGES.length);
 assert.equal(new Set(TERRAIN_WORLD_NAMES).size,6);
 const g=combat();for(let k=0;k<8;k++)terrainSpawn(g,k%2?'hazard':'cover',k%2,0);
 assert.equal(g.battlefield.terrain.length,12);
 assert.equal(g.battlefield.terrainCreated,8);
 assert.equal(g.battlefield.terrainSerial,32);
 assert.ok(g.battlefield.terrain.every(p=>Math.abs(p.x)<=8.8&&p.y>=14));
});
test('Cover blocks enemy projectiles but lets all player weapons pass',()=>{
 const g=combat();terrainSpawn(g,'cover',0,0);
 const piece=g.battlefield.terrain[0];piece.age=1;piece.y=0;
 const shot=(enemy,weapon='wide')=>({x:piece.x,y:0,px:piece.x,py:0,radius:.2,damage:4,enemy,weapon,dead:false});
 const incoming=shot(true);assert.equal(interceptTerrainShot(g,incoming),true);assert.equal(incoming.dead,true);assert.equal(g.battlefield.shotsBlocked,1);
 for(const weapon of ['wide','laser','homing']){const friendly=shot(false,weapon);assert.equal(interceptTerrainShot(g,friendly),false);assert.equal(friendly.dead,false);}
});
test('Danger-route objects are telegraphed and can be destroyed with normal bullets',()=>{
 const g=combat();terrainSpawn(g,'hazard',1,0);const piece=g.battlefield.terrain[0];
 piece.y=0;piece.age=piece.warning-.05;
 assert.equal(isTerrainActive(piece),false);
 const early={x:piece.x,y:0,px:piece.x,py:0,radius:.2,damage:30,enemy:false,dead:false};
 assert.equal(interceptTerrainShot(g,early),false);
 piece.age=piece.warning+.01;
 const shot={...early,dead:false};assert.equal(interceptTerrainShot(g,shot),true);
 assert.equal(shot.dead,true);assert.equal(piece.dead,true);
 assert.equal(g.battlefield.hazardsCleared,1);
 assert.ok(g.score>=650);
});
test('Enemy route change is permanent, once only and stays inside playfield',()=>{
 const g=combat();terrainSpawn(g,'cover',0,0);
 const piece=g.battlefield.terrain[0];piece.age=piece.warning+.1;piece.y=7;
 const enemy=g.spawn('interceptor',piece.x,piece.y);
 const origin=enemy.origin;redirectTerrainEnemy(g,enemy,STEP);
 assert.equal(enemy.terrainRedirected,true);assert.notEqual(enemy.origin,origin);
 assert.equal(g.battlefield.rerouted,1);assert.ok(Math.abs(enemy.origin)<=9.3);
 redirectTerrainEnemy(g,enemy,STEP);assert.equal(g.battlefield.rerouted,1);
});
test('Player can move safely while corridor telegraph is active; cover physically pushes but does not damage',()=>{
 const g=combat();terrainSpawn(g,'cover',0,0);const p=g.battlefield.terrain[0];
 activate(p,g);p.age=p.warning-.05;
 const hp=g.hull;collideTerrainPlayer(g);
 assert.equal(g.player.x,p.x);assert.equal(g.hull,hp);
 p.age=p.warning+.1;collideTerrainPlayer(g);
 assert.notEqual(g.player.x,p.x);assert.equal(g.hull,hp);
});
test('Charged hazards hit at most once even if the player does not move',()=>{
 const g=combat();g.invulnerable=0;terrainSpawn(g,'hazard',0,0);
 const p=g.battlefield.terrain[0];activate(p,g);
 const hp=g.hull;collideTerrainPlayer(g);
 assert.equal(g.hull,hp-1);assert.equal(p.dead,true);
 collideTerrainPlayer(g);assert.equal(g.hull,hp-1);
});
test('Terrain pauses, expires and cannot affect caravan or boss rush',()=>{
 const g=combat();terrainSpawn(g,'cover',0,0);const p=g.battlefield.terrain[0];
 g.pause();const age=p.age;g.update(STEP,idle);assert.equal(p.age,age);
 g.resume();g.update(STEP,idle);assert.ok(p.age>age);
 updateTerrain(g,20);assert.equal(g.battlefield.terrain.length,0);
 for(const mode of ['caravan','bossrush']){
  const other=new Game();other.start(mode);
  terrainSpawn(other,'cover',0,0);
  assert.equal(other.battlefield.terrain.length,0);
 }
});
test('Actual strategic target events create mutually exclusive cover or hazard routes',()=>{
 const a=new Game();a.start();a.time=STAGES[0].duration*.095;a.update(STEP,idle);
 const node=a.nodes.find(n=>n.attach==='field');assert.ok(node);
 a.damageNode(node,999);assert.equal(a.battlefield.terrain.length,4);
 assert.ok(a.battlefield.terrain.every(p=>p.route==='cover'));
 const b=new Game();b.start();b.time=STAGES[0].duration*.095;b.update(STEP,idle);
 const escaped=b.nodes.find(n=>n.attach==='field');assert.ok(escaped);
 escaped.age=21;escaped.y=-17;b.update(STEP,idle);
 assert.equal(b.battlefield.terrain.length,4);
 assert.ok(b.battlefield.terrain.every(p=>p.route==='hazard'));
});
