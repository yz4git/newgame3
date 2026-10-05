# Enemy fire and player balance — v1.10

## Fixed enemy firing

Crossing (pattern 5) and weaving (pattern 6) movement branches were duplicated inside the shooting chain. They intercepted dart, drone, interceptor, bomber, corvette, sentinel and strider attacks before projectile creation and cooldown assignment. The duplicate branches have been removed; the original movement update remains.

Regression coverage runs all 12 armed enemy classes through all seven formation patterns, checks the charge window, saved aim, actual volley and cooldown, and checks movement during fire. Supply carriers and relics retain their intended non-shooting behavior. Enemy health, projectile speeds and attack counts have not been increased.

## Weapon changes

| Mechanic | v1.9 | v1.10 |
| --- | --- | --- |
| WIDE pellets at levels 1–4 | 2 / 3 / 5 / 5 | 2 / 3 / 4 / 5 |
| WIDE pellet damage | 1.8 | 1.25 |
| LASER damage per beam | 2.2 + level × 0.55 | 1.8 + level × 0.35 |
| LASER focus damage | ×1.15 | ×1.08 |
| HOMING missile damage | 1.9 + level × 0.2 | 1.65 + level × 0.10 |
| HOMING completed lock damage | ×1.45 | ×1.20 |
| Level 4 satellite damage / frequency | 1.6 / every volley | 0.8 / every other volley |
| OVERDRIVE damage | ×1.65 | ×1.35 |
| NOVA boss / wing / miniboss damage | 105 / 60 / 70 | 60 / 35 / 35 |

Main weapon firing intervals, bullet speeds, laser penetration, lock acquisition and missile turning remain responsive. WIDE covers separated formations, LASER concentrates damage and pierces aligned enemies, and HOMING trades raw frontal efficiency for off-axis tracking. Every power level raises output. Emergency NOVA still cancels all enemy bullets and lasers and grants invulnerability; ordinary enemies and machinery still receive its existing area damage. Three bombs alone can no longer erase a fresh first miniboss.

OVERDRIVE still lasts six simulation seconds, or about 2.7 real seconds at the existing 2.25× game speed. Its old “6 seconds” help text has been corrected to match actual play. Hull, hit radius, movement, damage recovery supplies and stage resupply remain available.

## Measurements

Fixed 60 Hz, Normal difficulty. Output counts emitted projectile damage over three real seconds, before misses, armor and piercing. HOMING has a completed real target lock. This is a reproducible upper-output comparison, not guaranteed damage against every target.

| Level 4 + focus | v1.9 damage / real sec | v1.10 damage / real sec | Reduction |
| --- | ---: | ---: | ---: |
| WIDE | 244.00 | 141.00 | 42.2% |
| LASER | 266.40 | 154.24 | 42.1% |
| HOMING | 282.90 | 159.87 | 43.5% |

The same player tracks boss center at y = −9, with focus, no NOVA, ordinary projectile collision and invulnerability for measurement. Boss entry is skipped. Natural wing drops may raise power in runs starting at level 1; raw results include `powerAtEnd`.

| Level 4 focused LASER | v1.9 | v1.10 |
| --- | ---: | ---: |
| First orbital boss | 3.95 sec | 6.75 sec |
| Fortress boss | 3.50 sec | 5.95 sec |
| Final furnace boss | 6.00 sec | 9.80 sec |

The regression also holds power at level 1 throughout all six boss fights, for all three weapons. Each can finish under 85 real seconds without NOVA, within the 90-second encounter limit. All six minibosses can be intercepted before withdrawal with each base weapon. Maximum-power first minibosses can still fall quickly as a reward for upgrades; stronger later encounters take longer. These invulnerable tracking checks establish collision and progression, not human survivability or final difficulty calibration.

- Reproduce output and fight measurements: `node scripts/combat-probe.mjs`.
- Baseline and updated raw results: [combat-measurements-v10.json](combat-measurements-v10.json).
- Simulation and presentation regressions: 62 tests; TypeScript check and production build pass.
- Browser checks: actual production bundle in WebGL 2 and Canvas 2D, both with a mobile viewport. Formation firing, output budgets, ordinary final boss and miniboss kills, NOVA cancellation and rendering were verified. Reports: [WebGL](qa-combat-webgl-v10.json) / [Canvas](qa-combat-canvas-v10.json).
- Control, multitouch, pause/retry, six sectors, real-time limits, offline loading and v1.9 → v1.10 cache upgrade are checked separately before publication.

Browser WebGL tests use software rendering. Physical iPhone performance and human difficulty are not measured by these tests.
