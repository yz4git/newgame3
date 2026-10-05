// Simulation seconds; GAME_SPEED converts them to real time.
export const WEAPON_BALANCE={
 wide:{interval:.10,damage:1.25,pellets:[2,3,4,5]},
 laser:{interval:.10,baseDamage:1.8,levelDamage:.35,focusMultiplier:1.08},
 homing:{interval:.145,baseDamage:1.65,levelDamage:.10,lockMultiplier:1.20},
} as const;
export const PLAYER_BALANCE={
 overdriveMultiplier:1.35,
 satelliteDamage:.8,satelliteEvery:2,
 novaBossDamage:60,novaPartDamage:35,novaMinibossDamage:35,
} as const;
