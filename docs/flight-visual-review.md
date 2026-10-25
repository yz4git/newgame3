## Wide horizontal scrolling / rail-camera behavior (2026-10-25)

Unlike the earlier ±9.4-unit corridor, 3D Scroll mode now has **±44 units** of world-space horizontal maneuvering. The local aircraft offset is not simply remapped into a screen coordinate: the entire Three.js **camera is translated horizontally**, revealing the full-width modeled terrain, flanking buildings, turrets and enemies. This follows Star Fox 64 manual's defining 3D-scroll behavior: freely move around the viewing area with a screen-edge arrow at the outer limit.

- Central dead zone **±6.5 units**: aircraft moves around the screen while camera stays on the course.
- Past dead zone, `railCameraPan` follows **82%** of outer motion. At the edge, ~31 units of camera movement reveal new terrain, while the fighter remains about 13 units offset from the viewport center.
- When near ±44, a red left/right world-boundary warning appears. Controls cannot send the ship off the corridor.
- Local aim points at 70 and 145 units are projected in the same camera as actual shots so reticles remain valid after the sideways scroll.
- Player speed, banking, mouse/touch steering and frame-independent gamepad input recalibrated for the expanded range; enemy intercept/crossfire/pincer groups, turrets and pickups now occupy flanks.
- `tests/flight-corridor-scroll.test.mjs` validates dead zone, sign, smooth pan, boundaries and reticle geometry; `scripts/flight-visual-audit.mjs` captures center, far-right and far-left scenes **in a running browser** and asserts the camera has actually shifted at least 15 world units and the fighter stays on-screen. All-range mode remains separate.

# 3D Flight — Reference video / live gameplay comparison (2026-10-25)

## Reference material

- [Star Fox 64 N64 longplay, Corneria 03:28–09:16](https://www.youtube.com/watch?v=c2d-zGE8G98) — chapter-marked, three route versions.
- [Star Fox 64 100% N64 walkthrough, Corneria gameplay 05:02–09:06](https://www.youtube.com/watch?v=GhQp8le67Xo).
- Original screenshots: [MobyGames](https://www.mobygames.com/game/3536/star-fox-64/screenshots/), [Nintendo World Report](https://www.nintendoworldreport.com/game/42342/star-fox-64-wii-u-vc-n64).
- Nintendo game controls and the corridor/all-range design are documented in the [official English manual](https://assets.nintendo.eu/image/upload/v1635394987/NAL/Support/Starfox64_3D_manual.pdf).

The source comparison here is based on indexed video chapters, searchable reference frames and gameplay documentation. It is not a claim to have frame-by-frame decoded the full 2.5-hour original video.

## Actual NovaStrike playcheck

The `Visual flight gameplay audit` GitHub Actions workflow starts the **production Vite build** in real Chrome/WebGL, captures the title and opening, sends actual keyboard steering and hold/release laser controls, plays several live seconds, then seeks only for **scenery inspection** (city/canyon/arches/waterfall), and simulates iPhone landscape, simultaneous touch movement and FIRE, and pause.

- Inspect the screenshots and scene-state JSONs in the PR's `flight-visual-screenshots` artifact.
- Each artifact has 12+ PNG frames, viewport sizing, mission time, actual ship position, terrain tile count, enemy count, damage and JavaScript console errors.
- The saved screenshot passes are useful visual evidence, **not** a substitute for hardware Safari testing, complete playthrough or a Nintendo console-to-console comparison.

## Visual / interaction difference log

| Area | Old actual screenshot findings | Implemented change |
|---|---|---|
| City geometry | Hundreds of repetitive, evenly spaced cyan-striped boxes; some buildings filled the whole flight corridor | Five materially and geometrically different hard-surface building types, urban overpasses, landmarks, rubble, foliage, safer clear flight corridor |
| Ground | A flat green strip with abrupt horizontal cutoff at the horizon | 520m-wide sculpted, vertex-coloured landscape with distant raised hills and mottled terrain; 12 active corridor tiles or 17 all-range tiles |
| Early stage | Straight asphalt road directly below plane, no recognizable opening | Ocean/coastal opening, diversified city corridor, then river basin with physical arches and waterfall |
| River | Bright opaque blue slab and white highway-like streaks | Darker subdued water with faint ripples and translucent GPU-animated waterfall |
| Arch obstacles | Square gate posts / bridge beam instead of recognizable arch profile | Curved low-poly stone masonry, physical clearance colliders, pass/miss geometry |
| Craft & camera | Small craft pinned near center by 100% camera movement | Chase camera with screen-relative steering (only 27% follow on local x, 32% local y), craft scale rebalanced |
| Enemy rhythm | Sparse distant ships, slow exposure, lifeless opening | Earliest 1.7s formation, 16 first-stage scripted waves, closer encounters, 5.6s ground turret rhythm, friendly flyby |
| Motion speed | Old frame cap 34ms slowed simulation severely on low frame rates | Actual frame elapsed integrated in stable ~34ms substeps up to 250ms, eliminating cap-induced slow motion; software browser is still not a real iPhone performance benchmark |
| Speed effects | Bright white streaks everywhere regardless of boost | Lower streak budget in normal flight; boost produces stronger streaks |
| Phone UI | Button panel and thick HUD obscured much of the landscape | Compact landscape HUD, smaller control surfaces, verified visual phone emulator |
| Team radio | Abstract N/S letterbox | Procedurally drawn original helmeted pilot portraits, colour-coded radio speakers |
| First boss | An ordinary enemy fighter with glowing rings, tiny at 90m and no focal weakpoint | Giant original airborne carrier for the normal route, articulated land walker for special route, with glowing reactor target and three changing phases |
| Start visibility | Opening invulnerability blink hid the player's ship in screenshot | First launch always shows craft; blinking reserved for genuine respawn |
| Touch input | Unverified multi-touch | Browser audit now dispatches simultaneous steering + FIRE touch sequence |

## Important remaining gaps

Star Fox 64 has tightly authored music, cinematics, boss-specific anatomy/weak points, bespoke traffic and event staging, numerous unique planet levels and finely tuned moment-to-moment pacing. This version still contains six **original** NovaStrike missions and procedural geometry, not a one-to-one licensed port, nor a verified equivalent in feel or asset quality. Full original video capture/step-by-step inspection and direct iPhone Safari visual/manual playcheck remain outside the automated environment; do not claim otherwise.
