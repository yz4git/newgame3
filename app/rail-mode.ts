/**
 * Original on-rails combat direction for NovaStrike 3D.
 * Coordinates are world metres, negative Z is forward.
 * All timings deterministic so encounter layouts can be regression tested.
 */
export const STAGE_DURATION = 48;
export const ROLL_DURATION = .66;
export const ROLL_COOLDOWN = .88;
export const CHARGE_SECONDS = .75;
export const CHARGE_MAX = 1.3;
export const BASE_SHIELD = 5;
export const TRACK_HALF_WIDTH = 9.2;
export const TRACK_VERTICAL = { low: -6.1, high: 7.4 } as const;

const waveKinds = ['vee', 'cross', 'squad', 'pincer', 'guard', 'weave'] as const;
export type WaveKind = typeof waveKinds[number];
export type Wave = {at:number;kind:WaveKind;count:number;line:number;support:boolean};
export type Vec3 = {x:number;y:number;z:number};

export function trackCenter(stage: number, z: number) {
  const d = -z;
  // Different stages turn, climb and dive at different intervals.
  const seed=stage*1.37;
  const turn = Math.sin(d*(.0015 + stage*.00013)+seed)*5.4
    + Math.sin(d*.0032+seed*.7)*2.5;
  const height=Math.sin(d*(.00155+stage*.0001)+seed*.81)*1.6+
    Math.sin(d*.0031+seed*.8)*.95;
  return {x: turn, y: height};
}
export function trackYaw(stage:number,z:number) {
  const a=trackCenter(stage,z-4),b=trackCenter(stage,z+4);
  return Math.atan2(b.x-a.x,8);
}
/** Each sector has a fixed 10-wave action/relief rhythm with an authored finale. */
export function createRailWaves(stage: number): Wave[] {
  return [2.5,6.1,10.2,14.1,18.5,23.4,27.8,32.1,36.1,40.2].map((at,i)=>({
    at,
    kind:waveKinds[(i+stage*2)%waveKinds.length],
    count: i===4 || i===8?3:4 + ((i+stage)%2),
    line:i%3,
    support:i===4 || i===8
  }));
}
export function formationOffset(kind:WaveKind,index:number,count:number,age:number) {
  const middle=index-(count-1)/2;
  switch(kind){
    case 'vee':return {x:middle*2.5,y:-Math.abs(middle)*1.1,z:Math.abs(middle)*6};
    case 'cross':return {x:middle*3.2+(age-.5)*1.7*(index%2?1:-1),y:Math.sin(index*1.9)*3,z:index%2*5};
    case 'squad':return {x:middle*2.2,y:Math.sin(index*2.1)*2.2,z:Math.floor(index/2)*5};
    case 'pincer':return {x:(index%2===0?-1:1)*(5+Math.floor(index/2)*1.5),y:Math.sin(index)*1.7,z:Math.floor(index/2)*5};
    case 'guard':return {x:middle*3.2,y:Math.sin(index*1.6)*1.7,z:index%2*3};
    case 'weave':return {x:middle*2.5+Math.sin(age*3+index)*2.3,y:Math.cos(age*2.2+index)*2.6,z:Math.floor(index/2)*4};
  }
}
export function clampRail(x:number,y:number) {
  return {x:Math.max(-TRACK_HALF_WIDTH,Math.min(TRACK_HALF_WIDTH,x)),
    y:Math.max(TRACK_VERTICAL.low,Math.min(TRACK_VERTICAL.high,y))};
}
export function rollDeflects(remaining:number){return remaining>.07&&remaining<ROLL_DURATION;}
export function bossPhase(hp:number,max:number) {const ratio=hp/Math.max(1,max);return ratio>.65?1:ratio>.32?2:3;}
export function collisionSegment(a:Vec3,b:Vec3,target:Vec3,radius:number) {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const dd=dx*dx+dy*dy+dz*dz;
  const k=dd>1e-8?Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy+(target.z-a.z)*dz)/dd)):0;
  return (target.x-a.x-dx*k)**2+(target.y-a.y-dy*k)**2+(target.z-a.z-dz*k)**2<=radius*radius;
}
