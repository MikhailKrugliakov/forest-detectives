# Forest Detectives: The Mystery of the Forest Parcel

A family-friendly detective adventure for players aged 7–12. Choose one of five forest heroes, solve the mystery of a missing parcel, help the residents of a growing woodland village, and explore dangerous regions filled with animal and insect robots.

The game combines story quests, exploration, light action combat, puzzles, gathering, crafting, and local save slots. Progress can be approached at a comfortable pace, and most village activities are optional.

## Game Features

- **Five playable detectives.** Play as Wolf Cub, Fox Cub, Rabbit, Watermelon, or Sheepwolf. Each hero has different attributes, a signature tool, and a personal home challenge.
- **A two-chapter adventure.** Investigate the missing parcel in the opening case, then travel to the Forest Village and take on several quests in parallel.
- **A large connected world.** Explore the Forest Village, Wild Forest, Aunt Melon's Farm, Forest Mine, Mountain Hollow, Uncle Mole's Shop, five hero homes, and Beaver's trap-filled house.
- **Village quests and resident errands.** Recover lost letters, collect robot parts, defeat forest machines, repair the village, water flowerbeds, deliver baked goods, light lamps, and help residents in the western district.
- **Melee and ranged combat.** Use each hero's main weapon or switch to throwable tomatoes and cucumbers. Enemy health, rank, and combat status are displayed directly in the world.
- **Four enemy ranks.** Weak, normal, and strong robots return after different delays, while bosses remain defeated. Every recurring robot can drop a new physical gear after each victory.
- **Mountain encounters.** Fight robot beetles, wasps, and mantises before facing two bear guardians with different weapons and attack patterns.
- **Gadgets with practical uses.** Buy a jetpack, magnetic glove, gas mask, and pulse shield from Uncle Mole. Gadgets open shortcuts and provide options in puzzles and combat.
- **Resources and crafting.** Gather stones, sticks, ropes, and mechanical scrap. Craft a pickaxe and use it to mine iron and diamonds in a mine whose entrance and ore layout change with every new game.
- **A safe farm area.** Visit Aunt Melon's Farm, meet its watermelon and melon residents, buy throwable vegetables, and explore without enemy encounters. Watermelon starts the adventure in the central garden bed.
- **Beaver's challenge house.** Cross a collapsing floor, survive wall launchers and poison gas, solve a power-door mechanism, and use a jetpack to reach the final control panel. Room checkpoints preserve completed stages.
- **Optional home challenges.** Visit the heroes' homes for lasso practice, mirror puzzles, evidence sorting, greenhouse controls, and batting training.
- **Healing potions.** Every hero carries three potions. Each restores 33% of maximum health and recharges independently after 90 seconds.
- **Local saving and loading.** Use an autosave and three manual slots. Saves include quests, health, inventory, purchases, gathered resources, mine generation, enemy respawn timers, dropped loot, defeated bosses, and Beaver House checkpoints.

## Adventure Structure

### The Missing Parcel

The first chapter introduces the selected detective and the central mystery. Search for clues, question characters, and determine what happened to the parcel. Completing the case opens the road to the Forest Village.

### The Forest Village

The second chapter is built around four main assignments that can be accepted and completed in parallel:

1. Recover three lost letters for the Squirrel Postie.
2. Bring five robot parts to Beaver.
3. Disable ten forest robots for the Owl Guardian.
4. Enter Beaver's house and shut down its malfunctioning defense system.

Turning in all four assignments unlocks the **Village Saved** finale. Resident errands and hero-home challenges are optional sources of gears, keepsakes, and additional conversations.

## Locations

| Location | What to Expect |
|---|---|
| Forest Clearing | The opening investigation and tutorial area |
| Forest Village | A `4800×1600` hub with homes, shops, NPCs, quests, and several exits |
| Wild Forest | Road-based exploration, animal robots, resources, a shifting mine entrance, and the mountain gate |
| Aunt Melon's Farm | A peaceful farm, vegetable shop, resident dialogues, and Watermelon's home |
| Forest Mine | Eight iron deposits and three diamond deposits, available after crafting a pickaxe |
| Mountain Hollow | A `4800×1600` mountain route with robot insects and a two-guardian arena |
| Uncle Mole's Shop | Gadget purchasing and equipment management |
| Beaver's House | Five connected trap and puzzle rooms with checkpoints |
| Hero Homes | Five single-screen locations with character-specific mini-challenges |

Wild Forest and Mountain Hollow use road and arena boundaries. Trees, cliffs, dense vegetation, rock formations, buildings, NPCs, and enemy bodies are solid obstacles rather than walk-through scenery.

## Enemies and Respawning

| Rank | Examples | Respawn Time |
|---|---|---:|
| Weak | Robot hares | 30 seconds |
| Normal | Robot wolves, beetles, and wasps | 60 seconds |
| Strong | Robot boars and mantises | 90 seconds |
| Boss | Reinforced boar and bear guardians | No respawn |

Forest quest progress uses a cumulative victory counter, so robots defeated after respawning continue to count. Mountain enemies have a separate counter and do not affect the Owl or Beaver assignments. Each non-boss victory leaves a location-specific gear drop that can be collected with `E`.

## Equipment and Economy

Gears are earned from robots, quests, errands, hidden scrap, and home challenges. Rewards and purchases are one-time, so the game does not require repeated reward farming.

| Gadget | Price | Use with `Q` |
|---|---:|---|
| Jetpack | 12 gears | Automatically crosses a marked chasm from its launch pad |
| Magnetic Glove | 8 gears | Pulls marked mechanisms within range |
| Gas Mask | 8 gears | Protects from gas for 8 seconds; 12-second cooldown |
| Pulse Shield | 10 gears | Blocks the next hit or volley for 2 seconds; 6-second cooldown |

Aunt Melon sells two tomatoes or two cucumbers for one gear. Thrown vegetables deal light damage: four hits are needed to defeat a standard robot hare. When vegetable ammunition runs out, the hero returns to their main weapon automatically.

Beaver also sells safe training versions of a collapsing floor kit and a falling wall kit. Purchased building materials are recorded in the rewards section of the journal.

## Controls

- `WASD` or arrow keys — move.
- `Shift` — run while stamina is available.
- `E` — interact, talk, mine, or collect an item.
- `Space` — attack in combat areas or perform an action in certain challenges.
- `R` — cycle between the main weapon, tomatoes, and cucumbers.
- `Q` — use the equipped gadget.
- `T` — use a healing potion.
- `I` — open the journal, inventory, resources, rewards, gadgets, and saves.
- `Esc` — close the current window.

Character dialogue appears along the bottom of the screen. Short instructions, combat warnings, and system notifications appear in a compact panel on the right.

## Run Locally

The project requires Node.js 24 LTS.

```bash
npm install
npm run dev
```

Vite prints the local game address after startup. To create and preview a production build:

```bash
npm run build
npm run preview
```

Useful scene shortcuts for visual testing:

```text
?scene=forest-village
?scene=wild-forest
?scene=mountain-hollow
?scene=forest-mine
?scene=melon-farm
?scene=mole-shop
?scene=beaver-house
?scene=hero-home
```

Add a hero query when needed, for example `&hero=watermelon`.

## Quality Checks

```bash
npm run check
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

## Project Structure

- `src/domain` — characters, quests, economy, resources, gadgets, enemies, saves, and game state.
- `src/game/scenes` — locations, combat areas, shops, homes, puzzles, and UI scenes.
- `public/assets/maps` — Tiled object maps with collisions, roads, NPCs, portals, resources, and encounter points.
- `public/assets` — character, enemy, NPC, gadget, interior, and world artwork.
- `tests/unit` and `tests/e2e` — domain tests and browser-based game scenarios.

The current session and save slots are stored in the browser. Cloud synchronization and save transfer between browsers are not included.
