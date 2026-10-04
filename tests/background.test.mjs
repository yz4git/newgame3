import test from 'node:test';
import {STAGES} from '../app/stages.ts';
import assert from 'node:assert/strict';
import {chipAt,fortressVariant,zoneAt,LANDMARKS,CHIP_TYPES,VARIANTS,stageDistance} from '../app/bg-map.ts';

test('Streaming map addresses remain valid before the start and during long boss encounters',()=>{
  for(let stage=0;stage<STAGES.length;stage++)for(let row=-30;row<250;row++){const id=fortressVariant(stage,row);assert.ok(Number.isInteger(id)&&id>=0&&id<8);}
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
