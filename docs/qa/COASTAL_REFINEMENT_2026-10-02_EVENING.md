# Coastal refinement — 2 October 2026, evening

Addresses the 8:50–8:53 PM screenshots and requests.

## Changes

- Replaced disconnected vine attachment points with branches sampled from their real curved leaders. Woody stems taper, vary by seed, and meet leaf bases and flower/fruit stalks. Added subtle attached moss. Near and far geometry remain batched.
- Replaced dock growth rows and spirals with seeded recruitment pockets, gaps, outliers, ragged biofilm, and mixed shell colonies. Each pile has its own distribution.
- Removed the exact oval projection of the outer city reef chains. Outcrops vary in depth and lateral position, and smaller mineral scatter spans a wider shelf. A quarter of suitable small coastal stones now occupy cleared inland margins. Rock moss/algae is attached to the material rather than floating decals.
- Replaced overlapping lighthouse walking surfaces with unions at each finished elevation. Terrain is below the court. City circulation slabs subtract occupied room footprints, and near-coplanar floor lighting overlays were removed.
- Activated mounted lamps around the complete monorail loop, trolley ceiling lights, and trolley headlights. Strengthened masked interior diffuse lighting and museum exhibit/gallery illumination; transparent windows and outdoor grass do not receive the room fill.
- The crab now leaves its chamber, rests outside, and returns over a 140-second cycle. Its body follows the grade and each planted foot samples the seabed. Added fractured stone, shell grit, and tube sponges around the cave shoulders, leaving the entrance open.
- Added a seagrass meadow in front of the crab with 4,249 grass mats, three varied grazing/breathing manatees, 12 small hermit crabs, and 42 clams. Low quality retains two manatees and seven hermits. Local water clarity blends into the surrounding ocean. Added 21 floating algae patches and nine rooted shoreline lily pads; three algae patches are larger clumps. Surface growth follows the water clock.
- Added Lagoon Tiles (a solvable fifteen-tile puzzle) and Lily Leap (a river-crossing game) to Arrow Arcade. Removed the introductory slogans. Both support keyboard and touch controls, pause, restart, and focus return.

## Verification

- Full local suite: 491 tests passed before the final wave-clock regression was added. Final focused meadow, arcade, and water checks passed 16/16, including that regression. Release CI runs the complete suite again.
- `npm run check`: ESLint, TypeScript, and static production export.
- Geometry tests check duplicate upward floor faces, lighthouse landings, fixture mounting, branch/leaf contact, seeded colony variation, and route clearance. An independent crab audit sampled 4,990,720 transformed vertices over the full excursion with zero terrain penetrations and 3.9 cm minimum floor clearance.
- Independent gameplay review completed all three Lily Leap homes using legal hops and time steps without losing a life, and reversed 100 generated tile shuffles using legal moves.
- Browser review covered close city floors, lighthouse stairs, dock colonies, vines, museum lighting, monorail/trolley lighting, meadow inhabitants, and the crab outside its cave. Phone and tablet interaction checks exercised tile moves, river controls, pause, and return to the library. Layouts were inspected at 1920×1080, 1440×900, 1024×768, 768×1024, and 390×844; measured phone/tablet widths had no horizontal page overflow. Short landscape panels scroll vertically.
- Browser testing caught an unavailable cave-shoal route after the crab corridor expanded; routing now tries alternate anchors and safely omits an optional group if all candidates fail. Current geometry still supports the full shoal. Route tests also corrected marlin and octopus clearances after reef redistribution.
- Actual GPU compilation caught GLSL's reserved word `patch` in the rock moss shader. It was renamed before release; TypeScript checks alone could not detect this issue.

## Performance and visual limits

The meadow uses 17 instanced batches including animals, surface plants, and clams, with approximately 148,268 transformed triangles at high quality. Grass shares three batches and uses shader sway. Dock growth remains one merged draw per dock assembly; lighting reuses material masks rather than adding a point light to every lamp. The existing city draw budget is retained.

After the final shader rebuild, the 1440×900 meadow view reported 60 FPS, 247 draw calls, 4,975,099 triangles, DPR 1, high quality, and readiness at 3,788 ms. A 1280×720 wide archipelago view reported 42–44 FPS at medium quality and DPR 1.25, with roughly 845 draw calls and 4.18 million triangles; readiness was 4,442 ms. Both completed all five loading stages with zero pending textures. A fresh browser session showed no console/GPU shader errors, context losses, or runtime errors. These are single-view samples, not a before/after benchmark. Measurements are observations on the local browser and machine, not cross-device guarantees. Foliage and animal silhouettes remain stylized at extreme zoom. Distant rock and vegetation detail reduces with quality settings; this update does not claim photorealism or universal elimination of every possible rendering artifact.

## Sources and licenses

No new external assets, packages, bitmap textures, or models were imported. New anatomy, plants, games, and moss masks are repository-native mesh, SVG, and shader code. Existing material textures are retained from Poly Haven under CC0-1.0: `coast_sand_rocks_02`, `forrest_ground_01`, `wood_floor_deck`, `concrete_wall_006`, and `sparse_grass` (Amal Kumar). Exact source URLs and processing notes remain in `public/materials/sources.json`.

## Local evidence

Canvas captures and runtime metadata live in the ignored `.tmp/qa/oct2evening/` directory. Relevant captures include `meadow-dense`, `meadow-gpu-final`, `rock-distribution-final`, `city-night`, `museum-night`, `lighthouse-joins`, `city-floor-joins`, `train-lighting`, `crab-outside`, `dock-growth`, and `vine-connections`. Final GPU captures supersede any earlier captures made before the moss shader fix.

## Exact changed files

- `docs/qa/COASTAL_REFINEMENT_2026-10-02_EVENING.md`
- `package.json`
- `scripts/arcade-puzzles.test.ts`
- `scripts/city-architecture.test.ts`
- `scripts/exterior-lighting.test.tsx`
- `scripts/lighthouse.test.tsx`
- `scripts/living-assets.test.ts`
- `scripts/night-lighting.test.ts`
- `scripts/pelagic-fish.test.tsx`
- `scripts/reef-habitat.test.ts`
- `scripts/seagrass-meadow.test.tsx`
- `scripts/seaweed.test.tsx`
- `scripts/water-optics.test.ts`
- `scripts/world-details.test.tsx`
- `src/components/arcade/Arcade.tsx`
- `src/components/arcade/arcade.css`
- `src/components/arcade/puzzleLogic.ts`
- `src/components/world/AeroWorld.tsx`
- `src/components/world/CityArchitecture.ts`
- `src/components/world/CityGuideway.ts`
- `src/components/world/CityLife.tsx`
- `src/components/world/CityMonorail.ts`
- `src/components/world/CivicLandmarks.tsx`
- `src/components/world/CoastalTraffic.tsx`
- `src/components/world/DockEcology.tsx`
- `src/components/world/EcoCity.tsx`
- `src/components/world/FacadeGarden.ts`
- `src/components/world/InteriorKit.tsx`
- `src/components/world/LighthouseAccess.tsx`
- `src/components/world/MythicGrotto.tsx`
- `src/components/world/PelagicLife.tsx`
- `src/components/world/ReefHabitatScene.tsx`
- `src/components/world/RoomLighting.tsx`
- `src/components/world/SeabedMeadows.ts`
- `src/components/world/SeagrassMeadow.tsx`
- `src/components/world/ShoreDetails.ts`
- `src/components/world/Water.tsx`
- `src/components/world/coastalCaveLayout.ts`
- `src/components/world/coastalRocks.ts`
- `src/components/world/marineVisitorState.ts`
- `src/components/world/meadowAnatomy.ts`
- `src/components/world/pelagicFishState.ts`
- `src/components/world/qaViews.ts`
- `src/components/world/reefHabitat.ts`
- `src/components/world/seagrassMeadowLayout.ts`
- `src/components/world/seagrassMeadowState.ts`
- `src/components/world/terrain.ts`
- `src/components/world/waterOptics.ts`
- `src/content/profile.ts`
