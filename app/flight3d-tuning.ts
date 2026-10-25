/** Flight distances are world units / second. Base velocities are exactly 3x v1. */
export const SPEED_MULTIPLIER = 3 as const;
export const cruiseSpeed = (stage: number) => (20 + stage * 1.3) * SPEED_MULTIPLIER;
export const boostSpeed = () => 45 * SPEED_MULTIPLIER;
/** Muzzle velocities must be relative to the carrier, not fixed world coordinates. */
export const laserSpeed = (flightSpeed: number) => flightSpeed + 245;
export const missileSpeed = (flightSpeed: number) => flightSpeed + 165;
export const enemySpawnRange = 195;
/** World-space speedometer uses the same speed scale as the previous mode. */
export const displaySpeed = (flightSpeed: number) => Math.round(flightSpeed * 12);

export interface Position3 { x: number; y: number; z: number; }
/** Continuous 3D swept-sphere contact for two objects moving in one frame. */
export function sweptCollision(a0: Position3, a1: Position3, b0: Position3, b1: Position3, radius: number): boolean {
  const x=a0.x-b0.x, y=a0.y-b0.y, z=a0.z-b0.z;
  const vx=(a1.x-b1.x)-x,vy=(a1.y-b1.y)-y,vz=(a1.z-b1.z)-z;
  const dot=vx*vx+vy*vy+vz*vz;
  const t=dot>1e-9?Math.max(0,Math.min(1,-(x*vx+y*vy+z*vz)/dot)):0;
  const dx=x+vx*t,dy=y+vy*t,dz=z+vz*t;
  return dx*dx+dy*dy+dz*dz<=radius*radius;
}
