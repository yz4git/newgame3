# NOVA STRIKE 1.4 — Six environments

ユーザー提供の5枚の画像にあるステージ番号を採用し、既存の宇宙要塞（03）と合わせて6ステージを構成しました。参考画像の画面全体を貼る方式ではなく、生成した素材を立体地形とBGチップへ組み込んでいます。

| Stage | Environment | Reference | Main scenery |
|---|---|---|---|
| 01 | ASTEROID FRONT / 小惑星帯 | FB91F06F… | 岩塊・破船・環状基地・紫の星雲 |
| 02 | PELAGIC BASE / 海上基地 | 9418CA15… | 波・海上プラットフォーム・潜水艦・連絡橋 |
| 03 | ORBITAL FORTRESS / 宇宙要塞 | 既存のE943F26E… | 金属の通路・配管・大型ゲート・惑星 |
| 04 | GLACIER CHASM / 氷峡谷 | E15EC3D4… | 氷壁・雪・氷晶群・極地施設 |
| 05 | VERDANT RELIC / 密林遺跡 | 7A83A388… | 樹冠・川・滝・石積み・発光する環状遺跡 |
| 06 | VULCAN FOUNDRY / 溶岩工場 | 08C1ADBF… | 玄武岩・流れる溶岩・溶鉱炉・配管・橋 |

タイトルの「開始ステージ」で選んだステージから最終ステージまでプレイできます。CARAVANはステージ01で120秒。難易度、武器、ボム、スコアは出撃ごとにリセットされます。ゲーム速度は初期比2.25倍、CARAVANとボス制限は実時間120秒・90秒です。

## Newly generated materials

Mode: built-in image generation, 8 distinct assets. PNG originals were retained; integration copies were resized and converted to WebP at quality 93. The canopy retains its generated transparency. Material maps are 1024×1024; nebula is 1024×1536. Seven assets from v1.3 remain in use, for 15 generated assets in total. Texture files are bundled locally and included in the versioned PWA cache.

| Asset | Usage |
|---|---|
| `app/textures/asteroid-rock-v4.webp` | 小惑星と玄武岩の表面・起伏 |
| `app/textures/ocean-water-v4.webp` | 海上基地の海面・密林の川 |
| `app/textures/glacier-ice-v4.webp` | 氷壁・氷晶・峡谷の底 |
| `app/textures/wind-snow-v4.webp` | 雪面と岩塊の雪冠 |
| `app/textures/ancient-moss-v4.webp` | 遺跡・川岸・苔むした石材 |
| `app/textures/molten-lava-v4.webp` | 溶岩流と溶鉱炉の発光面 |
| `app/textures/violet-nebula-v4.webp` | 小惑星帯の遠い星雲 |
| `app/textures/jungle-canopy-v4.webp` | 樹冠と遺跡周囲の葉・透過素材 |

## Composition and rendering

`app/stages.ts` shares campaign, visual, district, light and music metadata. `app/environment-art.ts` builds the five new environment families. `app/fortress.ts` streams 8-unit rows from 8 templates per environment and places 5 authored landmarks per stage, for 30 landmarks. Terrain and installations are separate groups. Installations change in density by district; their absolute-row hash controls placement and vertical proportions. There is no fixed composed-map wrap, including during long boss encounters. Small material textures and reusable parts are repeated as BG chips.

The distant layer scrolls at 0.30×, terrain at 1×, foreground haze at 1.38×, distant haze at 0.16×. Ocean, deep ice, river and lava surfaces move at 0.72×, giving those environments a fifth layer. Light color and intensity change per environment. Metal retains reflections, bump detail and shadows; lava uses emissive maps. Transparent foliage has alpha clipping and cast shadows. Stage transitions dispose retired merged geometry, material instances and private fluid texture copies while retaining shared generated maps.

Canvas 2D caches the same merged terrain and installation meshes independently, uses the same absolute-row placement, and retains generated surface and foliage images. Transparent faces do not paint solid background rectangles. Empty installation groups are supported. It is the compatibility path without real-time GPU shadows or bloom.

## Verification

- TypeScript check and production build passed.
- 21 automated tests passed, including ordinary shots clearing all 6 bosses, stage selection, seeded combat, swept collisions, background addressing, pause, speed 2.25× and real time limits.
- Headless Chromium, WebGL 2 and Canvas 2D, 720×1280: all 6 environments rendered without page, console or WebGL errors. A final focused rendering check covers the refined ice crystals and crevasse texture.
- Both renderers, touch viewport 390×844: stage selection, movement plus NOVA multitouch, weapon switching, focus, pause, retry, 6 bosses, 2.25× clocks, boss timeout, Caravan completion, viewport scale and offline reload with all 15 textures passed. WebGL ground projection and adaptive performance mode also passed.
- The screenshots below use arranged combat scenes to inspect graphics; they are not recorded full campaign runs.
- Physical iPhone and hardware WebGPU frame rates have not been measured.

![All six environments](stages-v4.webp)

## Exact generation prompts

### asteroid-rock

Create a premium photorealistic game environment material texture: charcoal grey pitted asteroid rock, jagged fractured stone, shallow craters, mineral inclusions, finely eroded regolith, dark metallic grey and a few warm tan flecks. A seamless square physically plausible diffuse/albedo texture, straight-on orthographic, evenly lit, no cast shadows, no objects, no sky, no text, no UI, no border, fills the entire image. Very high fine detail for a top-down science fiction shooter, realistic AAA material. Avoid large black voids or obvious repeating features. 1:1 square composition.

### ocean-water

Premium photorealistic top-down ocean water material texture for a vertical shooter set above naval platforms. Entire square filled with deep sapphire blue sea and translucent teal currents, densely detailed small ripples and irregular scattered white foam tips, bright natural sunlight glints but balanced overall exposure, no islands, no land, no boats, no ships, no structures, no horizon, no text, no UI. Strict orthographic view directly downward, seamless tileable water surface with natural nonregular turbulence, visually realistic AAA game water albedo, rich contrast, dark blue remains dominant.

### glacier-ice

Create an exceptionally detailed photorealistic game material texture for huge blue glacier cliff walls, ice crystalline facets, layered striations, deep sapphire fissures, turquoise translucent seams, natural irregular fractured glacial ice. Entire square covered in solid ice, no mountains silhouettes, no horizon, no snow covering most of it, no sky, no objects, no UI, no text. Orthographic straight-on diffuse texture, evenly illuminated, seamless all edges, suitable for wrapping rocky cliff meshes. Rich medium icy blue with cyan reflective fissures, not luminous neon. Premium commercial game material.

### wind-snow

Photorealistic seamless material texture of fresh polar wind-swept snow seen straight from above, intricate small wind ridges, subtle blue-grey shadows in the ridges and tiny sparkles of compressed frost, soft white snow dominates, no footprints, no objects, no horizon, no rock outcrops, no text, no UI. Uniform balanced diffuse light, no directional baked hard cast shadows. Entire square filled with snow detail, realistic AAA game ground albedo. Seamless on all edges, subtle nonregular texture and no large distinctive repeating features.

### ancient-moss

Photorealistic seamless albedo material of ancient jungle temple masonry seen directly overhead, dark weathered olive-grey stone slabs, cracked irregular limestone seams, natural dense moss in cracks, tiny ferns and green lichens, chipped relief carvings, occasional damp earthy crevices. Entire square filled with detailed mossy ruin stone texture, no temple building silhouettes, no perspective, no water, no people, no objects, no text, no UI, no border. Soft even diffuse daylight, suitable for a top-down 3D ruined temple and cliff material. Premium realistic game texture, distinct stone grain visible among lush moss.

### molten-lava

Photorealistic seamless top-down molten lava surface texture for a high-end vertical shooter environment. Incandescent orange-yellow molten streams surrounding many small irregular charcoal-black basalt crust islands, intricate glowing golden cracks, molten swirls and granular volcanic detail. Entire square filled with lava surface, no buildings, no machines, no horizon, no smoke, no objects, no text, no UI. Seamless all edges, overhead orthographic view, black crust about 45 percent and intensely hot liquid about 55 percent, realistic AAA game emissive surface texture with crisp detail and subtle fluid variations.

### violet-nebula

Create a premium deep space environment background texture, 2:3 portrait. Very dark navy blue and charcoal space with elegant wisps of violet and muted magenta nebula gas mostly on the right and lower edges, distant sparse pinprick stars, naturally asymmetric fine cosmic dust, cinematic scientific space aesthetic, realistic NASA-inspired star field, no planets, no asteroids, no spacecraft, no text, no logo, no UI. Keep the center dark and readable for a top-down action game. Intricate astronomical detail but mostly black-blue negative space. Entire image filled, no border.

### jungle-canopy

A premium photorealistic top-down jungle vegetation cutout for a 3D vertical shooter game. One isolated dense irregular cluster of several tropical palm crowns, broad fern fronds, tiny emerald leaves and dangling vines, lush layered botanical detail, deep dark green leaves with varied yellow-green sunlit edges, a few small cyan-turquoise exotic leaves. Camera looks strictly vertically downward, realistic natural leaf textures and fine serrated fronds. Cluster fills 85 percent of a square image and has a completely transparent background with clean soft alpha edges, no ground, no pot, no rock, no text, no UI, no border. No rectangular background, no white background, no black background, transparent outside leaves. No baked cast shadow outside the plant silhouette.
