# BG-chip visual overhaul / v1.2

The former 11 chunks repeated every 99 world units. The renderer now streams an absolute-coordinate stage map, using an original canvas-painted 2048 × 1536 atlas (12 chip families × 4 variants per sector). Tile artwork is reused; complete background sections do not wrap. Both WebGL/WebGPU and Canvas 2D use the same atlas, landmarks and route definitions.

## Route composition

- Orbital Dawn: harbor, asymmetric city blocks, gardens, spaceport runway, defense perimeter.
- Prism Rift: scattered debris, crystal field, shipwreck belt, orbital gate, sanctuary.
- Core Zero: intake conduits, foundry, coolant channels, reactor district, core defenses.

Fifteen authored landmark placements include terminal complexes, gardens, crystal formations, wrecked cruisers, gates and reactors. Repeated terminal categories have individual markings and added structures. Tiles include several building footprints, turbine arrangements, heat exchangers, transport surfaces, containers and service infrastructure. Materials use bevel highlights, cast shadows, glazing, rivets and machining marks; every asset is authored in code, without external image dependencies.

## Depth and motion

- Far field: 0.30 × ground scrolling, with larger chips and distance tint.
- Ground and landmark pass: 1.00 × scrolling.
- Distant haze: 0.16 × scrolling.
- Near clouds: 1.38 × scrolling, with slow lateral drift around the margins.

The ground moves at 4.4 world units per stage second, matching ground enemies. Position comes from the simulation stage clock: pausing freezes the map, retries reset it, and stage changes select their own map. Clouds are periodic atmospheric elements; terrain and landmarks do not cycle. Map selection remains valid throughout long boss encounters.

## Rendering budget

Two reusable geometry buffers contain 480 quads total. Atlas coordinates change only when crossing a tile row. No background geometry or painted assets are allocated every frame. Atlas and landmark textures are disposed on theme changes, with only the active sector retained. Existing adaptive pixel ratio and bloom fallback remain enabled. Transparent space chips expose the planet and distant haze instead of rectangular tile backgrounds.

The player also gains canopy frames, avionics, intake surfaces, separated control surfaces and navigation lights. Hull bevels use two segments.

## Validation

- Type checking and 16 simulation/map tests.
- Browser views across six locations in three sectors on WebGL 2 and Canvas 2D.
- Pause/retry clock behavior, multi-touch controls, layer offsets and atlas bounds.
- Screenshots are browser rendering fixtures; they are not a claim of physical iPhone GPU performance. Real-device Safari and the native WebGPU backend still require hardware validation.
