# Organic Krok City neighborhoods

The current Krok City renderer uses four complete painted backgrounds across eight sectors. These replace the detached building/ground composition documented in ASSET_REFRESH_PROMPTS.md. The earlier source assets remain available but are not loaded by KrokCityScene.

## Outputs and production

- Mode: built-in imagegen, sketch-to-render for the residential base and reference-image edits for the three variants.
- Each painting is 1536 × 1024, displayed as a 2400 × 1600 sector.
- The variant edits use the accepted residential painting as their common reference, retaining the street layout and winter palette.
- `scripts/pack-krok-neighborhoods.cjs` only encodes the accepted paintings as quality-94 JPEGs; it does not assemble buildings or draw road overlays.
- Portraits, NPC routes, interactions, saves, and collision contracts are unchanged by this art replacement.
- The runtime replays small silhouette-clipped portions of those same paintings at roof depth. Actors behind a projecting roof no longer draw on top of it; a muted silhouette keeps the hidden hero readable. These temporary WebGL-compatible textures are shared between matching sectors and released on leaving the scene.
- Narrow street-only runtime blends soften the junctions between adjacent paintings, including four-sector intersections. They use only neighboring pavement pixels within 48 source pixels of each edge, never move/crop buildings, and leave physical passages unchanged. The original JPEGs remain intact.

## residential

Output: `public/assets/world/krok-city-residential-organic-v3.jpg`

Exact generation prompt:

```text
Use case: sketch-to-render. Paint directly over this exact 1536x1024 game layout image, preserving its block boundaries. Keep the geometry and scale of every rectangle precisely. Do not zoom, recenter, or enlarge any rectangle. This is one complete overhead snowy fantasy town painting, not a sheet of icons.
Replace each tan rectangle with a broad, low stone-and-timber house with a snow-covered roof; the front facade and door occupy the blue inset at the bottom. Paint four DISTINCT homes: twin-chimney cottage, curved-gable bakery, rustic longhouse, stone manor with rounded bay. Any roof or chimney MUST stay INSIDE its tan rectangle. Replace the small green flanks with low garden walls, short snow-dusted shrubs and warm lanterns, strictly within their green bounds. No tall trees. All blue-grey area remains walkable blue-grey cobblestone pavement, dusted with powder snow. Its exact extent must remain unchanged. Thus all streets around the four plots remain wide and open, including the entire top and bottom strips.
Style: richly textured polished storybook adventure game, high-angle three-quarter overhead view, carved stone foundations, detailed wood beams, thick roof snow, icicles, glowing amber windows, lantern light blending softly onto the surrounding blue-cobblestone street. House walls, gardens, snowdrifts, light and street painted organically as one world. Do NOT retain any flat-colored guide shapes, outlines or labels. No white rectangular fields, no separate sprites, no uniform rectangular snow lawns. Feather the snow at each foundation naturally onto the street. Fill the FULL WIDTH of each tan plot with detailed low architecture, do not create small isolated houses. Keep the top and bottom street strips completely free of any solid object. No people, UI, text, grids or watermark. Opaque 3:2 image.
```

## crafts

Output: `public/assets/world/krok-city-crafts-organic-v3.jpg`

Exact generation prompt:

```text
Use case: precise-object-edit. Edit this exact COMPLETE painted winter town game background. Preserve its canvas, camera, scale, lighting, every outside edge and ALL street/cobblestone pixels unchanged. Change ONLY the four existing buildings and their tiny attached courtyard details inside the same silhouettes/footprints. Keep the front doors at exactly the same four locations, the roof extents the same or smaller, and the streets just as open. Everything must remain naturally painted into the same environment with warm lamplight and irregular snow at foundations; no pasted sprites, white rectangles or separate panels. No new buildings outside the four existing footprints, no taller towers or trees, no new obstacles in the streets, no people, text or UI. Output the same 3:2 opaque map. Make this the craftsmen's neighborhood: NW a broad stone smithy with low forge chimney, iron tools hung beside its existing door and orange furnace glow; NE a carved-timber carpenter's workshop with a low green shingle roof and timberwork details; SW a warm brick pottery workshop with a small kiln built into its facade and ceramic jars tucked against its wall; SE a small stone archive/bookbinder's house, blue roof and books visible in lit windows. Retain wintry medieval Krok architecture and rich painterly detail.
```

## market

Output: `public/assets/world/krok-city-market-organic-v3.jpg`

Exact generation prompt:

```text
Use case: precise-object-edit. Edit this exact COMPLETE painted winter town game background. Preserve its canvas, camera, scale, lighting, every outside edge and ALL street/cobblestone pixels unchanged. Change ONLY the four existing buildings and their tiny attached courtyard details inside the same silhouettes/footprints. Keep the front doors at exactly the same four locations, the roof extents the same or smaller, and the streets just as open. Everything must remain naturally painted into the same environment with warm lamplight and irregular snow at foundations; no pasted sprites, white rectangles or separate panels. No new buildings outside the four existing footprints, no taller towers or trees, no new obstacles in the streets, no people, text or UI. Output the same 3:2 opaque map. Make this the market neighborhood: NW a cozy apothecary with dark teal tiled roof and small glass bottles in its glowing shopfront; NE a broad covered produce market house with snow-covered red tile roof and red/cream striped awning, tomato and cucumber baskets tucked under the awning; SW a bakery and flour store with mustard-gold wooden roof details and bread in its windows; SE a timber-and-stone trading hall with blue-and-cream awning, small crates immediately against its wall. Four complete different substantial buildings, integrated into the existing street painting, no sprawling stalls in the roads.
```

## royal

Output: `public/assets/world/krok-city-royal-organic-v3.jpg`

Exact generation prompt:

```text
Use case: precise-object-edit. Edit this exact COMPLETE painted winter town game background. Preserve its canvas, camera, scale, lighting, every outside edge and ALL street/cobblestone pixels unchanged. Change ONLY the four existing buildings and their tiny attached courtyard details inside the same silhouettes/footprints. Keep the front doors at exactly the same four locations, the roof extents the same or smaller, and the streets just as open. Everything must remain naturally painted into the same environment with warm lamplight and irregular snow at foundations; no pasted sprites, white rectangles or separate panels. No new buildings outside the four existing footprints, no taller towers or trees, no new obstacles in the streets, no people, text or UI. Output the same 3:2 opaque map. Make this the royal neighborhood: NW a sturdy low guardhouse with two squat corner buttresses, blue-gold banners and a carved crocodile crest above the doorway; NE an elegant broad royal manor with blue slate roof, arched amber-lit windows and a crocodile crest, NOT a tall castle; SW a wide stone library with copper roof details and carved arches; SE a winter conservatory/manor with a low glass bay and warm windows, blue/gold royal accents. No freestanding statues or fences blocking streets. Preserve the same footprints and roof heights.
```
