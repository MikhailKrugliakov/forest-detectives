# Ocean chapter image assets

Generated with the built-in imagegen tool on 2026-09-27. Original generated files remain in the Codex generated_images directory. Existing game art was inspected to match its painted fantasy style.

## Runtime contract

- `public/assets/ocean/{beach,sea,trench}-panorama.png`: one continuous panorama, displayed at 4800 × 1600. No tile joins.
- `public/assets/ocean/{robot-crab,predatory-fish,jellyfish,spiny-fish,tiger-shark,ichthyosaur}.png`: transparent 2560 × 640 atlas, four 640 × 640 frames horizontally. Frame 0 idle, frame 1 movement, frame 2 attack, frame 3 alternate movement. All fish face right; crab and jellyfish face front three-quarter view. Use flipping for leftward movement.
- `public/assets/ocean/scuba.png`: transparent 1254 × 1254 inventory/shop icon. The wearable hero overlay is implemented separately by the scene.

Atlases were mechanically assembled from four separate connected alpha silhouettes in the generated sheets. Silhouettes are centered with at least 22 px edge padding, uniformly scaled only when required, and preserved with their source alpha. The last predatory-fish and spiny-fish poses were mirrored to keep orientation consistent. No new illustration was drawn during packing.

## Traversal geometry and visual review

Panoramas were edited with a 2400 × 800 layout guide for connected floor, two branches and a right-side boss arena. Guide rectangles in image pixels were: main `[-5,225,2410,350]`; branches `[610,150,190,545]` and `[1360,150,190,545]`; arena `[1800,75,600,655]`. These are a visual generation guide, not collision geometry.

Visual inspection: all maps form one continuous main route, both side branches join it without seams, and the right end opens into an arena. Actual painted central floor is conservatively clear around game y=590..930. Use collision geometry inside the painted floor; suggested shared route center y=760 and half width 170. Boss arena should remain within approximately x=3720..4660, y=310..1260. The runtime layout and traversal tests remain authoritative.

## Exact generation prompts

### beach

Runtime file: `public/assets/ocean/beach-panorama.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: one continuous ultra-wide 3:1 environment panorama for a 2D storybook adventure game, no panels, full image is one traversable map. Primary request: a beautiful sunny beach map, angled overhead/isometric camera with no sky or horizon. Painterly detailed handpainted fantasy game environment, rounded rocks, warm sand, turquoise shallows, small vegetation and scattered broken brass mechanical debris along edges. Layout constraint CRITICAL: keep a very broad continuous completely open walkable sandy corridor from left edge to right edge, its center at 52% image height, empty band from35% to69% image height at EVERY x. Open branching sandy clearings at x29% and60% lead to upper and lower edge. Beach ocean water restricted to upper20% edge; loweredge has dunes/rocks. Far-right20% a wider empty sand clearing connected smoothly to corridor, ending at turquoise water at right edge. Every region meets seamlessly with no separate panels or abrupt joins; no walls, rocks, cliffs, branches, or objects in central corridor. Consistent scale throughout. Textured sand and occasional tiny shells only on walkable ground. No characters, no text, no UI, no borders, no lettering. Requested aspect ratio3:1.
```

Targeted layout revision prompt (reference 1: initial generated panorama, reference 2: layout guide):

```text
Use case: sketch-to-render / precise-object-edit. IMAGE1 is the beautiful existing beach game panorama whose art style, camera, palette and subject to retain. IMAGE2 is the EXACT gameplay floor-plan target, same3:1canvas. Repaint IMAGE1 so ALL of the beige shapes fromIMAGE2 are visible perfectly flat completely open sandybeach: the HUGE broad central horizontal band, BOTH north+south sidebranches, and the HUGE open arena onright. Keep their exact positions and extent from IMAGE2. No rock, ruin, plant, palm, coral, vertical drop, or obstacle may protrude into the beige shapes; trees or rocks must be placed entirely inside the dark teal areas fromguide. You may expand openfloor beyond beige slightly with natural irregularshore, but never narrowbeige. Thedarktealparts should become organicallypainted dunes,coastalrocks,palms andturquoisewater alongtopedge. Remove theguide colors and rectangular appearance by painting soft organic edges OUTSIDEthebeige shapes. Use same detailed painterly storybookgame aesthetic asIMAGE1. Nocharacters,text,labels,grid,UI,borders. Finalimage onecontinuous3:1panorama with no seams, no panels. Camera andscaleuniform. PRIORITY: honor wideclearfloor inIMAGE2 precisely.
```

### sea

Runtime file: `public/assets/ocean/sea-panorama.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: ONE continuous ultra-wide 3:1 underwater panorama for a2D handpainted storybook fantasy adventure game. Camera angled overhead/isometric, no horizon, no sky. Turquoise blue underwater sea floor with caustic light, coral reefs and kelp along edges, rounded rocks, small ruins, inviting magical exploration. CRITICAL GAMEPLAY LAYOUT: continuous flat sandy seabed with absolutely clear open corridor from leftedge to rightedge occupying y31%-69% ofimage across EVERY x. Branchesatx29%and60% extend the open sandy clearing up to y24% and down to78%, connecting smoothly to centralroute. Final boss arena is a wide open flat seabed covering rightmost24% ofimage, fromy12%to88%, with absolutely no big rocks, corals or obstacles there. Surrounding coral rocks vegetation restricted outside those walkable regions. All regions join naturally without any seams or panels, consistent camera and scale. Avoid deep cracks or terrain barriers; water is transparent enough to see traversable seafloor. No characters,no text,no labels,no borders,no UI. Aspectratio3:1.
```

Targeted layout revision prompt (reference 1: initial generated panorama, reference 2: layout guide):

```text
Use case: sketch-to-render / precise-object-edit. IMAGE1 is the beautiful existing sea game panorama whose art style, camera, palette and subject to retain. IMAGE2 is the EXACT gameplay floor-plan target, same3:1canvas. Repaint IMAGE1 so ALL of the beige shapes fromIMAGE2 are visible perfectly flat completely open underwater seabed: the HUGE broad central horizontal band, BOTH north+south sidebranches, and the HUGE open arena onright. Keep their exact positions and extent from IMAGE2. No rock, ruin, plant, palm, coral, vertical drop, or obstacle may protrude into the beige shapes; trees or rocks must be placed entirely inside the dark teal areas fromguide. You may expand openfloor beyond beige slightly with natural irregularshore, but never narrowbeige. Thedarktealparts should become organicallypainted turquoisecoralreefs,kelp,roundedrocks andsmallancientruins. Remove theguide colors and rectangular appearance by painting soft organic edges OUTSIDEthebeige shapes. Use same detailed painterly storybookgame aesthetic asIMAGE1. Nocharacters,text,labels,grid,UI,borders. Finalimage onecontinuous3:1panorama with no seams, no panels. Camera andscaleuniform. PRIORITY: honor wideclearfloor inIMAGE2 precisely.
```

### trench

Runtime file: `public/assets/ocean/trench-panorama.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: ONE continuous ultra-wide 3:1 undersea trench panorama for a2D handpainted storybook fantasy adventure game. Camera angled overhead/isometric, no horizon, no sky. Deep cobalt blue and purple underwater canyon floor with subtle bioluminescent teal flora, ancient worn stone ruins along edges, atmospheric but readable soft blue light. CRITICAL GAMEPLAY LAYOUT: continuous flat sandy dark blue seabed with absolutely clear open corridor from leftedge to rightedge occupying y31%-69% ofimage across EVERY x. Branchesatx29%and60% extend the open seabed clearing up to y24% and down to78%, connecting smoothly to centralroute. Final boss arena is a wide open flat seabed covering rightmost24% ofimage, fromy12%to88%, with absolutely no big rocks, corals or obstacles there. Surrounding dark rock faces, glowing flora and ruins restricted outside those walkable regions. Tiny ancient tide machinery hints onupperrightedge outsidearenaonly. All regions join naturally without any seams or panels, consistent camera and scale. Avoid deep cracks or terrain barriers. Rich painterly detail, no characters,no text,no labels,no borders,no UI. Aspectratio3:1.
```

Targeted layout revision prompt (reference 1: initial generated panorama, reference 2: layout guide):

```text
Use case: sketch-to-render / precise-object-edit. IMAGE1 is the beautiful existing trench game panorama whose art style, camera, palette and subject to retain. IMAGE2 is the EXACT gameplay floor-plan target, same3:1canvas. Repaint IMAGE1 so ALL of the beige shapes fromIMAGE2 are visible perfectly flat completely open underwater seabed: the HUGE broad central horizontal band, BOTH north+south sidebranches, and the HUGE open arena onright. Keep their exact positions and extent from IMAGE2. No rock, ruin, plant, palm, coral, vertical drop, or obstacle may protrude into the beige shapes; trees or rocks must be placed entirely inside the dark teal areas fromguide. You may expand openfloor beyond beige slightly with natural irregularshore, but never narrowbeige. Thedarktealparts should become organicallypainted darkbluecanyonwalls,bioluminescent plants and ancientruins. Remove theguide colors and rectangular appearance by painting soft organic edges OUTSIDEthebeige shapes. Use same detailed painterly storybookgame aesthetic asIMAGE1. Nocharacters,text,labels,grid,UI,borders. Finalimage onecontinuous3:1panorama with no seams, no panels. Camera andscaleuniform. PRIORITY: honor wideclearfloor inIMAGE2 precisely.
```

### robot-crab

Runtime file: `public/assets/ocean/robot-crab.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: a transparent sprite animation strip for a handpainted storybook adventure game. Subject: one stout brass and copper clockwork robot crab with articulated mechanical legs, two large pincers and glowing amber eyes, friendly fantasy steampunk aesthetic but enemy pose. Four frames of SAME crab, arranged in a single horizontal row of four equal square cells, each frame independently centered with20%transparent padding, consistent scale and facing diagonally right, slightly angled overhead view. Frames:1standing pincershalfopen,2walking leftlegsraised,3standing pincersupattack,4walking rightlegsraised. Detailed soft painterly rendering, crisp silhouette at smallgame size. Whole legs and claws fitwithin eachcell,nooverlap acrosscells. Real alpha transparency outsidecreatures, nofloor, no background, nogrid, no labels, no text, no outlinesaroundcells. Aspectratio4:1 requested2048x512.
```

### predatory-fish

Runtime file: `public/assets/ocean/predatory-fish.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: transparent sprite animation strip for a handpainted storybook adventure game. Subject: one living fantasy predatory ocean fish, turquoise scales, strong jaw with modestpointed teeth, amber eye and orange fins, recognizably biological not robot. Four frames of SAME fish in a single horizontal row of four equal square cells, each independently centered with20%transparent padding, consistent size, facing right in a threequarter slightly overhead sideview. Frames1tailstraight,2tailcurledtowardviewer,3mouthopenattack,4tailcurledaway. Painterly warmfamily adventure aesthetic matching detailed fantasygame enemies, clean readable silhouette. Entirefish fitswithin eachcell withoutclipping. Realalpha transparency outsidefish,nofloor,nobackground,nogrid,nolabels,notext. Aspectratio4:1 requested2048x512.
```

### jellyfish

Runtime file: `public/assets/ocean/jellyfish.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: transparent sprite animation strip for handpainted storybook fantasy game. Subject: one beautiful small neutral living jellyfish, translucent lilac bell, subtle turquoise luminescence, four curled blue-purple tentacles and soft internalglow; recognizably biological not robot, nohumanface. Four frames of SAME jellyfish in one horizontal row of four equal squarecells, independently centered with20%transparentpadding, consistent size, viewed angledoverhead isometric. Frames1bellrelaxed,2bellcontracting,3bellcontractedtentaclesextended,4bellopeningandtentaclescurled. Detailed painterly gameasset, distinct readable silhouette. Wholejellyfish fitswithin eachcellwithoutoverlap. Realalphatransparency outsidecreature,nofloor,nobackground,nogrid,nolabels,notext. Aspectratio4:1 requested2048x512.
```

### spiny-fish

Runtime file: `public/assets/ocean/spiny-fish.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: transparent sprite animation strip for handpainted storybook fantasygame. Subject: one powerful ancient prehistoric spiny fish, living darkpurple coelacanth/armoredplacoderm-inspired creature, heavy boneplates, paler ivory spikes alongback andfins, strongjaw, blueglowing eye, biological notrobot. Four frames of SAMEfish in onehorizontalrow offour equal squarecells, eachindependentlycentered with20%transparentpadding, consistentscale, facingright in threequarter slightlyoverhead sideview. Frames1tailstraight,2tailcurledtowardviewer,3mouthopenanddorsalspikesraisedattack,4tailcurledaway. Detailed painterly adventuregameasset with clearspikes and readablesilhouette, notgory or photorealistic. Wholefish fitsineachcell,noclip,nooverlap. Realalphatransparency outsidecreature,nofloor,nobackground,nogrid,nolabels,notext. Aspectratio4:1 requested2048x512.
```

### tiger-shark

Runtime file: `public/assets/ocean/tiger-shark.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: transparent sprite animation strip for handpainted storybook fantasy adventuregame. Subject: one impressive boss tiger shark, living bluegray shark with darktigerstripes onback, palecream underside, muscularbody,strongtail, amber eyeandpointedteeth, biological notrobot. Fourframes of SAMEshark inonehorizontalrow offour equal squarecells, eachindependentlycentered with18%transparentpadding, consistentscale, facingright inthreequarter slightlyoverhead sideview. Frames1tailstraightandmouthclosed,2tailsweepingforward,3mouthwideopenbiting,4tailsweepingback. Detailed painterly premiumgameasset,readablesilhouette,nogore. Everywholebodytailandfinsfullyinsideitsowncell,noclip,nooverlap. Realalphatransparency outsidecreatures,nofloor,nobackground,nogrid,nolabels,notext. Aspectratio4:1 requested2048x512.
```

### ichthyosaur

Runtime file: `public/assets/ocean/ichthyosaur.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: transparent sprite animation strip for handpainted storybook fantasy adventuregame. Subject: one majestic prehistoric ichthyosaur boss, living marine reptile with longtoothedsnout, distinct largeflippers, dolphinlike streamlinedbody, deepindigo iridescentscales, paleblue belly, tealcrest markings, intelligentgoldeneye. Anatomyclearlyichthyosaur notsharknotdinosaurdragon; biologicalnotrobot. Fourframes of SAMEichthyosaur inonehorizontalrow offour equal squarecells, eachindependentlycentered with18%transparentpadding, consistentscale, facingrightinthreequarter slightlyoverheadsideview. Frames1tailstraightandjawclosed,2tailcurledandflippersswimming,3jawopenroaringwithflippersspread,4tailcurledopposite. Beautifuldetailedpainterlyfamilyadventuregameasset,cleanreadablesilhouette,nogore. Wholebodytailandflippersfullyinsideeachcell,noclip,nooverlap. Realalphatransparency,nofloor,nobackground,nogrid,nolabels,notext. Aspectratio4:1 requested2048x512.
```

### scuba

Runtime file: `public/assets/ocean/scuba.png`

Original generation prompt:

```text
Use case: stylized-concept. Asset type: single square inventory icon on realtransparentbackground for ahandpaintedstorybook adventuregame. Subject: compact charming scuba equipment set consisting of one brass andturquoise oxygen tank with leatherstraps, rounded divingmaskwithglass and flexiblebreathinghose, all together as oneclearlyreadable item. Threequarter slightoverheadview, detailedpainterlylightandsoftshading consistent withfantasysteampunk equipment, cleanrecognizablesilhouette. Centeredwith15%padding. Nocharacter,nofloor,nobackground,noshadowrectangle,nolabels,notext,nowatermark. Truealpha transparencyoutsideequipment. Square1024x1024.
```


## Village coastal path revision

`public/assets/ocean/village-coastal-panorama.png` — 2172 × 724, single continuous panorama. Edited from `public/assets/world/forest-village-panorama-v2.jpg`. Keeps major buildings, doors, rivers and bridges in place; replaces small decorative kiosks along the northern exit with a narrow painted lane. No flooding is baked into the artwork.

Visual review found a slight rightward curve relative to the requested centerline. For movement to follow the painted lane, use approximate world points `(1440,980), (1405,900), (1375,700), (1290,420), (1220,130), (1230,0)` with a lane around 100 world units wide. The exit aligns near x=1230. Root integration owns final collision geometry.

Exact edit prompt:

```text
Use case: precise-object-edit. Edit the attached existing game village panorama with a VERY LOCAL addition, preserving its detailed painterly fairy-tale game art and exact 3:1 composition. Preserve every major building at its current coordinates, size, orientation, roof shape and doorway, every river, every bridge, and all existing roads. Preserve the left 70% of the image unchanged. Add ONE naturally painted narrow cobbled/dirt footpath leading north from an existing road in the right-hand neighborhood to the top edge. EXACT centerline in image coordinates given as percentage of full width and full height: (80%,61.25%) -> (76.04%,56.25%) -> (75.42%,43.75%) -> (75.42%,26.25%) -> (75%,8.1%) -> (75%,0%). The lane is about 2.1% of the whole image width, softly irregular, gently curved around those waypoints, and stays continuously connected to the existing road at its lower end. Match existing golden-earth and small-stone paths with hand-painted textures, leafy natural edges, tiny shadows. At top edge it disappears through a newly opened narrow gap in the trees. Keep it clear and walkable, with no gaps, obstacles or foliage across the lane. Remove only small decorative notice-board kiosks, bushes or tiny decorative huts that directly intersect this lane. Never shift or erase any major house, workshop, store, door, river or bridge. It must look like part of the original painted village, not an opaque geometric strip or a flat overlay. No flood, no water additions, no characters, no text, no labels, no UI, no borders. Output a single continuous panorama with exactly the same camera, crop and building composition as the source.
```


## Flooded village state

`public/assets/ocean/flood-panorama.png` — 2172 × 724 RGB. Separate flooded variant of `village-coastal-panorama.png`; the dry coastal file remains unchanged. Water is painted at ground level around peripheral tree roots and river banks, with foliage above it and natural irregular boundaries. Main buildings, doors, bridges, roads and the northern lane retain their source positions. Central paths and approaches to doors are dry. Visual comparison was performed against the dry coastal source before publishing.

Exact edit prompt:

```text
Use case: precise-object-edit. Create a flooded-outskirts version of this exact game village panorama. KEEP THE EXACT SOURCE COMPOSITION AND COORDINATES. Do not redraw, shift, resize or remove any house, roof, shop, doorway, bridge, fence, or road. Preserve ALL ROAD GEOMETRY pixel-aligned to the source, including the narrow northern lane near x=75–80% which must remain dry and continuously walkable all the way to the top edge. Preserve every building doorway and porch dry and accessible. Preserve the camera angle, map scale, 3:1 aspect, painterly fantasy style, color lighting, and full crop.

ONLY CHANGE SMALL PERIPHERAL GROUND AREAS into clearly visible, naturally painted shallow turquoise seawater encroaching on the village outskirts. Add irregular shallow inlets along the far left border and several stretches of the bottom border, with small flooded grass patches and water wrapping organically around tree roots and rocks. Slightly widen the existing stream inside its banks where open ground is available, but keep every bridge and all connecting roads perfectly intact and dry. The flooded water must be at GROUND LEVEL BELOW foliage: tree crowns and bushes remain naturally painted IN FRONT OF/ABOVE the water, trunks extend into water with small reflections and ripples around their bases. No blue tint painted over treetops, no transparent overlay, no straight blue band, no polygon shapes. Water edges have varied muddy/sandy grassy margins and scattered submerged stones with subtle reflections. Main paths, central plazas, yards adjacent to doors and all bridges stay DRY. The flood affects only outer forest ground and river margins, does not drown trees, and must be noticeable in the lower-left and lower-right outskirts without overwhelming the village.

Keep every source building, landmark and road in exactly the same position. Add no people, animals, characters, UI, text, labels or extra buildings. Output one continuous 2172 by 724 panorama. This is a subtle coherent painted environment-state edit, not a new map.
```
