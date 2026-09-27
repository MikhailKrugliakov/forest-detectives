# World and locomotion refresh

The Krok City building/ground composition below has been superseded by the
complete painted neighborhoods in [ASSET_KROK_ORGANIC_PROMPTS.md](ASSET_KROK_ORGANIC_PROMPTS.md).
The village, Snow Valley and hero work described here remains in use.

Accepted imagegen assets for the village, Snow Valley, Krok City and five heroes.
Existing world paintings and character portraits were supplied as style/identity
references. The prompts below describe the accepted production set; rejected
walk-cycle experiments are not used by the game.

## Continuous panoramas

Outputs:

- `public/assets/world/forest-village-panorama-v2.jpg`
- `public/assets/world/snow-valley-panorama-v2.jpg`

Village prompt:

> Combine the existing western neighborhood and eastern forest village into one
> coherent 3:1 top-down storybook panorama. Preserve the warm rendering style,
> woodland cottages, workshop, homes and paths. Make the center one continuous
> landscape with a natural stream and two complete wooden bridges, around 47%
> and 75% of the image height. Connect the roads across both bridges. Keep every
> building complete, with clear entrances and usable paths. No panel borders,
> grid, abrupt changes of scale, characters, labels or UI.

Snow Valley prompt:

> Use the two existing snowy valley panels as references and compose one
> continuous 3:1 landscape. Match their painted adventure-game style, camera
> angle, mountain scale and winter palette. A broad stone road winds continuously
> through the valley from west to east; retain four connected side trails. Make
> the central saddle a natural part of the same landscape, without a separate
> bridge patch, duplicated cliffs, visible panel seams or abrupt lighting changes.
> No characters, text, grid or UI.

## Complete Krok buildings

Outputs: `public/assets/world/krok-house-0.png` through `krok-house-7.png`.

> Create a transparent 4-column by 2-row sheet of eight complete, isolated winter
> buildings for the friendly armored crocodile city. Match the existing Krok
> architecture, storybook rendering and elevated three-quarter camera. In order:
> a cozy chalet, timber longhouse, working forge, stone archive, glass greenhouse,
> apothecary, covered market and royal manor. Vary roof shapes, materials, doors
> and architectural details. Each building must fit fully inside its own cell
> with generous transparent padding. No cropped roofs, neighboring fragments,
> surrounding streets, fences, background, characters, labels or UI.

## Continuous winter ground

Output: `public/assets/world/krok-snow-ground.jpg`.

> Seamless, tileable soft powder-snow ground for a top-down winter game. Subtle
> blue-white variation, uniform lighting and low contrast. No roads, buildings,
> footprints, objects, large landmarks or distinctive repeated patterns. All
> edges must connect naturally.

Output: `public/assets/world/krok-road-v2.jpg`.

> Seamless tileable game texture. Soft low-contrast winter street paving: small
> irregular natural cobblestones dusted with thin powder snow, viewed exactly
> vertically from above, flat orthographic material. Square image, uniformly
> evenly lit. Many small nonsymmetrical rounded polygon stones, each approximately
> 15–30 pixels at 1024 resolution, separated by fine pale snow-filled joints.
> Pale desaturated blue-grey: light grey #abbfcb stone with #d6e3eb joints. No
> dark blue or black stones, large central features, flower patterns, kaleidoscopic
> or radial symmetry, medallions, circles, vignette, footprints, scenery or text.
> All four edges tile seamlessly. Crisp hand-painted storybook surface, with
> stones small enough to walk on rather than giant decorative tiles.

## Articulated hero sheets

Outputs: `public/assets/animations/hero-{wolf,fox,rabbit,watermelon,sheepwolf}-rig.png`.
Run the shared prompt once per hero, using that hero's existing portrait:

> Identity-preserving 2D game cutout-puppet parts sheet, not animation frames.
> Genuine transparent alpha. Exactly 3 columns × 4 rows. Rows: front, back,
> left-facing profile, right-facing profile. Column 1: upper body from head to
> pelvis, both arms in a relaxed weapon-holding pose, all clothing, accessories,
> weapon and tail; no attached legs. Column 2: left leg from hip to toe. Column 3:
> right leg from hip to toe. Each leg hangs neutrally with a slight knee bend and
> matches its row's direction. Include a rounded upper hip for overlap beneath
> the torso, with matching fur, shoes and clothing. Preserve the exact adorable
> identity, proportions and weapon hand. Do not mirror asymmetrical equipment.
> Keep all rows at the same scale and every part inside its regular cell with
> transparent padding. No extra body parts, disconnected heads in leg cells,
> background, halo, text, labels, grid or cast shadow. Crisp storybook game art.

Rabbit correction: turn only the third-row torso to the left; preserve all other
parts and the 3×4 layout. The watermelon source's two profile rows are reordered
during packing to match the common front/back/left/right convention.

## Packaging and review

- `scripts/pack-world-refresh.cjs` creates compressed panoramas and eight padded,
  alpha-preserving building sprites. `scripts/pack-hero-rig.cjs` packs the hero
  parts at 256 px per cell.
- The world uses one panorama per village/valley, not independently tiled halves.
  The former Krok ground/house renderer is no longer used; see the organic
  neighborhood manifest linked above for its replacement.
- Hero parts move independently with a continuous, alternating leg cycle; the
  carrier and physical body remain unchanged. No full-body frame crossfade is
  used for locomotion.
- Review covers transparent edges, both leg contact poses, the passing pose,
  in-world scale, bridge joins, complete buildings and street seams at 1280×720.
