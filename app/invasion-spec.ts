/** Hard ceiling for 3.4 cinematic director geometry and gameplay-safe projection. */
export const INVASION_FEATURES=[
 'opening supercarrier interception',
 'scaled three-dimensional dreadnought approach',
 'full-depth open-hangar flypast',
 'reactive independently traversing gun turrets',
 'capital engine nacelles with restrained glow',
 'enormous ribbed trench dive',
 'moving side bulkheads and struts',
 'boss arrival hyperstructure unfolding',
 'giant outer segmented armor petals',
 'counter-rotating concentric boss defense rings',
 'deep boss pylon frame and central columns',
 'boss vulnerability-driven iris retraction',
 'background optical banking cinematic tracking',
 'high-impact entry camera lens sequence',
 'boss-entry dolly choreography',
 'full barrel roll during noninteractive warp',
 'layered 3D hyperspace ring tunnel',
 'real 3D material breakup on boss kill',
 'metallic world fracture shockframes',
 'deep tumbling structural debris',
 'per-stage mechanical material palettes',
 'strictly simulation-independent director'
] as const;
export const INVASION_BUDGET={
 dreadnoughts:2,trenchBeams:48,bossPetals:16,
 hyperRings:12,ruptures:3,ruptureRings:9,
 debris:80,bossDebris:32,fieldDebris:22,
 maxGameplayRoll:.060,maxWarpRoll:.38,maxBossZoom:1.10,maxWarpZoom:1.22
} as const;
