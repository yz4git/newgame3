/** Additional world-space-only, zero-gameplay-impact effects added in 3.2. */
export const DEPTH_SPECTACLE_FEATURES=[
 'velocity-aligned 3D ballistic tracers',
 'paired physical laser warmup guide rails',
 'depth-separated live laser cylinders',
 'three-axis gyroscopic lock-on feedback',
 'tilted rotating salvage capture orbits',
 'air-compression cones on hostile wingtips',
 'bank-sensitive 3D hull-fin afterimages',
 'metal parallax corridor strain frames',
 'boss phase-reactive segmented mechanical iris',
 'boss low-energy depth shield corona',
 'short-lived muzzle compression waves',
 'local precision graze contact rings',
 'transparent hull damage geodesic shield',
 'NOVA expanding icosphere shock-shell',
 'facility collapse momentum-driven steel dust',
 'two-depth structural detonation contact waves'
] as const;
export const DEPTH_SPECTACLE_BUDGET={
 tracers:116,threats:16,locks:24,pickups:24,enemyVortices:64,
 ghosts:9,driftFrames:16,iris:8,pulses:34,dust:64,
 maxLuminance:.54
} as const;
