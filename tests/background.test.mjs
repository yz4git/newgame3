import test from 'node:test';
import {STAGES} from '../app/stages.ts';
import assert from 'node:assert/strict';
import {chipAt,fortressVariant,zoneAt,LANDMARKS,CHIP_TYPES,VARIANTS,stageDistance,SCENERY_VARIANTS,routeAt,terrainX,rowScenery} from '../app/bg-map.ts';

test('Streaming map addresses remain valid before the start and during long boss encounters',()=>{
  for(let stage=0;stage<STAGES.length;stage++)for(let row=-30;row<250;row++){const id=fortressVariant(stage,row);assert.ok(Number.isInteger(id)&&id>=0&&id<SCENERY_VARIANTS);}
  for(let stage=0;stage<STAGES.length;stage++)for(let row=-30;row<250;row++)for(let column=-6;column<6;column++)for(const far of[false,true]){
    const id=chipAt(stage,column,row,far);assert.ok(Number.isInteger(id)&&id>=0&&id<CHIP_TYPES*VARIANTS);
  }
});
test('Each sector changes districts and does not replay the old 99-unit background loop',()=>{
  const fingerprint=(stage,start)=>Array.from({length:12},(_,r)=>Array.from({length:12},(_,c)=>chipAt(stage,c-6,start+r)));
  for(let stage=0;stage<STAGES.length;stage++){
    const rows=start=>Array.from({length:24},(_,i)=>fortressVariant(stage,start+i));assert.notDeepEqual(rows(0),rows(13));assert.notDeepEqual(rows(13),rows(26));
    assert.notDeepEqual(fingerprint(stage,0),fingerprint(stage,25));
    assert.notDeepEqual(fingerprint(stage,25),fingerprint(stage,50));
    assert.equal(new Set([0,70,150,230,340].map(d=>zoneAt(stage,d))).size>=4,true);
    assert.equal(new Set(LANDMARKS[stage].map(l=>l.distance)).size,5);
  }
});
test('Background position derives from the stage clock so pause and retry cannot drift',()=>{
  const before=stageDistance(18.5);for(let i=0;i<120;i++)assert.equal(stageDistance(18.5),before);
  assert.equal(stageDistance(0),0);assert.equal(stageDistance(-1),0);assert.ok(stageDistance(80)>stageDistance(20));
});

test('Continuous terrain bends vary within a stage and preserve the outer world edges',()=>{
 for(let stage=0;stage<6;stage++){const samples=Array.from({length:40},(_,i)=>routeAt(stage,i*8));assert.ok(new Set(samples.map(r=>r.center.toFixed(1))).size>20);
  for(let d=0;d<800;d+=2){const r=routeAt(stage,d),next=routeAt(stage,d+.01);assert.ok(r.width>.7&&r.width<1.3);assert.ok(Math.abs(r.center-next.center)<.003);assert.equal(terrainX(stage,15,d),15);assert.equal(terrainX(stage,-15,d),-15);}
  const rows=Array.from({length:100},(_,i)=>rowScenery(stage,i));assert.ok(new Set(rows.map(r=>r.variant)).size>=22);assert.ok(rows.some(r=>r.damage));assert.ok(rows.some(r=>!r.installations)||stage===2);
 }
});
test('Every world has four unique set pieces with one generated landmark and no wrapping',async()=>{
 const {SCENES,sceneVisible}=await import('../app/scenery.ts');const ids=new Set();for(let stage=0;stage<6;stage++){assert.equal(SCENES[stage].length,4);assert.equal(SCENES[stage].filter(e=>e.kind==='artwork').length,1);for(const e of SCENES[stage]){assert.ok(e.distance>0&&e.distance<STAGES[stage].duration*4.4);assert.ok(sceneVisible(e,e.distance));assert.ok(!sceneVisible(e,e.distance+100));assert.ok(!ids.has(e.id));ids.add(e.id);}}assert.equal(ids.size,24);
});
