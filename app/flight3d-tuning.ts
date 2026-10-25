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
