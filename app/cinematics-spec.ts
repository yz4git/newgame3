/** Deterministic, allocation-bounded visual-only catalogue for physical 3D cinematics. */
export const CINEMATIC_FEATURES=[
 'three-depth atmospheric motes','close-pass three-dimensional asteroids and turbines',
 'parallax overhead service gantries','rotating orbital docking rails',
 'animated 3D light-sweep cones','distant construction beacons',
 'stage-specific ash snow spray and pollen','low-altitude terrain flyby shadows',
 'player twin volumetric jet cones','bank-responsive nozzle gimbals',
 'staggered world-space engine contrails','wing-tip vapor in fast movement',
 'landing-pad style undercarriage rings','boss arrival geometric gate',
 'boss phase concentric mechanical halos','boss shield spin accents',
 'multi-layer physically positioned impact shockwaves','3D ejected armor fragments',
 'facility meltdown structural pulses','NOVA spherical evacuation ripples',
 'reactor chain-reaction tremor rings','depth-sorted warning sweep'
] as const;
export const CINEMATIC_BUDGETS={
 atmosphere:72,nearFlybys:14,contrails:48,shards:90,rings:14,gantries:3,
 maxEventsPerFrame:12,maxLuminance:.56,
} as const;
export const CINEMATIC_STAGE_COLORS=[0xb6a4ef,0x77cfec,0x82b5e6,0xbbebf3,0xa1d8a3,0xffa66c] as const;
export const CINEMATIC_ENV_MOTION=[.86,1.28,1.03,.75,.65,1.17] as const;
