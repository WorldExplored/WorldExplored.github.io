# Coastal weather and habitat verification — September 25, 2026

## Changes

- Replaced white offshore fog with a marine haze that preserves blue depth and purple dusk color. A single low sun is visible near the horizon.
- Added ceiling fixtures and warm indirect fill to opaque room surfaces. Glass keeps its existing material. Raised the lighthouse by seven world units and added Automatic / On / Off in Settings.
- Expanded seagrass and island meadows, rooted front-building vines, and algae on wet dock posts. Spatial batches, simplified distant blades, and shared geometry bound the additional rendering work.
- Clouds carry finite moisture; only wet clouds accept pressure. Rain begins at their undersides, follows wind and gravity, and makes temporary land puddles or ocean ripples. Droplets already in flight survive release and depletion.
- Replaced two exposed coastal arches with recessed rock burrows. Turtle shells, flippers, nests, and hatchlings have revised geometry.
- Added two coastal launches and a visiting solar passenger boat. The visitor approaches from the west, holds a dedicated city berth for 32 active seconds, then leaves to the east. Swept traffic checks preserve ferry and wildlife clearance.

## Browser checks

The static export was served with `scripts/serve-qa.mjs`. Local captures are under `.tmp/qa/september25c/` and are not publication assets.

Reviewed daytime, dusk, midnight, city interiors, lighthouse controls and direct tower navigation, localized rainfall and puddles, a storm bank, visitor berth alignment, adult turtles and hatchlings. Checked entry, Settings, and arcade navigation at 390 × 844, plus desktop views at 1440 × 1000.

One early browser check caught an unregistered Three.js Sprite used by the beacon; the production renderer registration now includes it. Close-up inspection also prompted a second cave geometry pass and corrected the beacon glow being occluded by its own lens.

The desktop overview sample before the final cosmetic cave adjustment recorded about 7.06 million rendered triangles and 39–43 FPS at DPR 1. These are local observations, not a cross-device performance guarantee. Performance diagnostics no longer perform synchronous pixel readback; explicit pixel audits remain opt-in.

## Automated checks

`npm run check` passed (ESLint, TypeScript, and static production build). `npm test` passed all 374 tests. The final interior cave shading adjustment was followed by a production rebuild and focused cave checks. Tests cover cloud moisture and rain trajectories, actual terrain impacts, bounded particle pools, nesting stages, cave route and geometry clearance, lamp controls in demand rendering, interior fixture placement, planting exclusion footprints, and repeated boat visits with ferry/wildlife separation.
