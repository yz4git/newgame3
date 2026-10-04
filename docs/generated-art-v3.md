# Textured fortress update — 2026-10-04

Reference direction: the image supplied by the user, with layered dark metal platforms, exposed pipes, blue lighting, white/red fighters, orange projectiles, smoke and a blue planet seen through the gaps. The reference screenshot itself is not used as a game background.

Seven original assets were generated with the built-in `image_gen` tool (not the CLI). The source images were retained; project copies are compressed WebP files. There are no runtime generation/API requests.

## fortress-metal-v3.webp

Asset: `app/textures/fortress-metal-v3.webp` — Metal decking / 1254 × 1254.

Prompt:

> Use case: stylized-concept. Asset type: seamless physically based albedo texture for a real-time 3D space fortress vertical shooter, NOT a game screenshot. Create a square 2048x2048 orthographic straight overhead texture sheet filling the entire image edge to edge: dark battleship gunmetal modular decking and armour. Extremely fine realistic dense aerospace machining, recessed seams, bolted chamfered panels of varied large and small sizes, ventilation grates, tiny circuit housings, cable channels, maintenance access hatches, sparse worn pale yellow safety marks, subtle grime and chipped steel at edges. Neutral diffuse light, flat albedo colour, subtle ambient occlusion only, no dramatic light baked into the material. Cool dark blue-grey titanium metal, realistic industrial material like a high-budget science-fiction game. Organically designed varied panel arrangements rather than repeated uniform squares. Tileable opposite edges. Crisp detailed material with no perspective, no objects, no spacecraft, no stars, no text, no logo, no border, no UI, no glow.

## fighter-armour-v3.webp

Asset: `app/textures/fighter-armour-v3.webp` — Fighter armour / 1254 × 1254.

Prompt:

> Use case: stylized-concept. Asset type: square seamless 2048x2048 albedo texture for physically shaded 3D fighter spacecraft armour. Straight overhead orthographic flat material texture filling every edge, NOT a spaceship image. Pearl off-white and pale grey aerospace painted titanium plates, varied elegant large bevel-edged access panels, slim dark recessed seams, tiny screws, microscopic brushed wear and rubbed edges, subtle dirt, faint oil marks around access ports, narrow understated blue-grey maintenance channels. Material polish similar to a realistic high-budget science fiction shooter. Neutral even diffuse studio light; only subtle seam occlusion, no baked dramatic shadow, no glossy highlights. A white paint texture that can be colour-tinted red or navy in a game. No yellow stripes, no text, no logos, no perspective, no objects, no spaceship silhouettes, no border, no glow. Opposite edges tile cleanly. Most of the texture stays light silver-white with clean panels; the detailed wear should be subtle, not a filthy ruin.

## explosion-v3.webp

Asset: `app/textures/explosion-v3.webp` — Explosion / 1254 × 1254 / RGBA.

Prompt:

> Use case: stylized-concept. Asset type: a single transparent-background explosion sprite texture for a real-time space shooter game. One centred bright incandescent orange explosion fireball, viewed straight on from above, sharply detailed rolling turbulent plasma and physically realistic billowing dark smoke around the edge, white-hot small inner core, orange molten fire tongues spreading unevenly with a few tiny ember sparks, expanding fire with volume and optical glow. Cinematic high-budget CGI VFX quality, like a spacecraft exploding. The entire fireball must fit with generous transparent margin and no cropped smoke. Square image. Isolated single explosion only, actual alpha transparency outside the smoke and fire, no ground, no stars, no spaceship or debris objects, no text, no border, no contact shadow. Soft edge transparency, not a black rectangle.

## planet-v3.webp

Asset: `app/textures/planet-v3.webp` — Planet / 1774 × 887.

Prompt:

> Use case: stylized-concept. Asset type: 2:1 equirectangular albedo texture for a blue Earth-like planet in a high-end real-time space shooter. Create a wide landscape texture filling every pixel edge to edge. Deep blue ocean, scattered muted green and slate continents, exceptionally detailed white hurricane spirals and fine filamentary atmospheric cloud systems over the ocean and continents. Physically realistic satellite material with natural irregular scales and tremendous fine detail. Neutral evenly illuminated surface albedo, no directional shadows, no planet rim, no black space, no sphere perspective, no stars, no text, no logos, no UI. Equirectangular full surface wrap, horizontally seamless, top and bottom correspond to polar ice and clouds. Wide 2:1 format.

## Rendering

The fortress is native beveled 3D BG geometry: eight reusable row chips per sector, deterministic absolute row addresses, five authored large facilities per sector, pipes, vent grilles, stepped roofs, raised relays and exposed openings. The composed map does not wrap. Metal and armour textures also provide bump detail. Player, fighters and cruisers combine generated transparent ship sprites with native 3D shadow proxies. Their screen positions compensate for camera tilt and sprite height so the visual center matches the combat plane. Remaining enemies and bosses retain native textured 3D models. Ship fuselages and cockpit canopies use raised cross sections.

Far structures, the ground, foreground haze and distant haze scroll at 0.30×, 1×, 1.38× and 0.16× ground speed. The planet adds a slower atmospheric reference. Lighting includes an environment, warm directional key, cool rim, a 1024-pixel shadow map and a brief local light on explosions. Instanced projectile halos preserve bullet readability. A generated RGBA explosion is combined with native sparks and smoke.

The Canvas 2D fallback uses the same generated ship, explosion and planet assets and rasterizes and caches the fortress meshes on the CPU. It does not perform per-frame 3D rasterization. WebGPU uses a TSL bloom pipeline; WebGL 2 uses the standard renderer and EffectComposer with UnrealBloomPass. Lower sustained frame rates reduce resolution and then disable bloom and dynamic shadows; the fortress geometry and textures remain visible.

The combat speed stays at 2.25×. Caravan and boss encounter limits still use real elapsed time.

## Verification

See the repository README for the completed validation record. Browser screenshots are deterministic visual test scenes, not a claim of hardware frame rate or completion of a commercial art production pipeline.

## player-v3.webp

Asset: `app/textures/player-v3.webp` — 1254 × 1254 / RGBA.

Prompt:

> Asset type: a production-quality transparent pre-rendered spacecraft sprite for a vertical scrolling arcade shooter. A single compact elegant fighter spacecraft in a square canvas, centered and fully visible, nose points straight UP, tail points DOWN, wings symmetrical. Silhouette slender and aerodynamic, width around 65 percent of canvas and height 88 percent, ten percent transparent breathing room. Pearlescent white aerospace armour, blue fuselage racing panels, a few small red wing markings, dark glass canopy, two detailed rear engine housings with a cool blue glow but NO engine flames. Top-down view with only a subtle 17 degree tilt, realistic dimensional raised fuselage, layered beveled metal panels, very fine mechanical surface details, bolts, tiny vents, machined gun barrels, grime and edge wear. Photoreal high-end science-fiction game art with warm light from upper left and cool edge reflection, crisp readable silhouette. Isolated cutout on transparent background. No external shadows, no space background, no bullets, no explosion, no UI, no letters, no text, no logo, no watermark, no second spacecraft.

## fighter-v3.webp

Asset: `app/textures/fighter-v3.webp` — 1254 × 1254 / RGBA.

Prompt:

> Asset type: a production-quality transparent pre-rendered enemy spacecraft sprite for a vertical scrolling arcade shooter. A single compact sleek fighter spacecraft in a square canvas, centered and fully visible, NOSE POINTS STRAIGHT DOWN, rear engines at the TOP, symmetrical angular swept wings. Silhouette slender and aerodynamic, width about 75 percent of canvas, height 86 percent, all appendages inside canvas. Off-white aerospace armour with bold red main fuselage and red outer wing panels, dark gunmetal inset mechanics, black glass canopy, two small orange engine glow apertures at rear but NO flames. Top-down view with a subtle 17 degree tilt, realistic dimensional raised fuselage, layered beveled metal panels, exceptionally fine mechanical details, bolted seams, vents, gun barrels, chipped paint. Photoreal high-budget science-fiction game art with warm key light from upper left and cool steel edge reflections. Isolated cutout on transparent background. No external shadows, no space, no background, no bullets, no explosion, no UI, no text, no logos, no watermark, no second spacecraft.

## cruiser-v3.webp

Asset: `app/textures/cruiser-v3.webp` — 1254 × 1254 / RGBA.

Prompt:

> Asset type: a production-quality transparent pre-rendered heavy enemy spaceship sprite for a vertical scrolling arcade shooter. A single heavy futuristic assault cruiser, centered and fully visible on a square canvas, NOSE POINTS STRAIGHT DOWN and tail points UP, symmetrical shape. Large central long red and white armoured fuselage with black glass canopy, two massive white side nacelles containing orange glowing circular weapon ports, two long dark metallic cannon barrels flanking the central nose and pointing DOWN. Width 75 percent of canvas and height 89 percent, every appendage stays within image, plenty of transparent padding. Top-down view with a subtle 17 degree tilt. Extremely detailed dimensional aerospace machinery, stepped panels, industrial grilles, tiny bolts, heat sinks, panel seams, dark piping, battle scratches, realistic painted white/red metal, bright orange apertures but no flames or beams. Photoreal premium science-fiction game art lit warm from upper left with cool edge reflections and strong contact shading within the spaceship. Transparent isolated cutout. No external shadows, no background, no space, no bullets, no explosion, no UI, no text, no logos, no watermark, no additional spaceships.
