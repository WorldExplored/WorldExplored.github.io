# World repair QA — 2026-09-16

Baseline: `7e4ff1c32925eee9414f5214c74f5c134c0cb185`

## Structural verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed as a static export.
- `npm test`: 181/181 tests passed before the final visual audit. The final pre-commit run is recorded in the task output.
- `git diff --check`: passed.
- The 22-second city-service geometry audit sampled 441 poses with no building overlap, detached guides, floating docks, or solar/roof collisions.
- The camera suite includes more than 100 mixed orbit, pan, zoom, touch, cancellation, and recovery gestures.
- Five-minute simulation tests cover the ferry, fountain, fish schools, wildlife, and garden rover.

## Browser views inspected

The local production export was inspected at 1920×1080, 1440×900, 1024×768, 768×1024, and 390×844. Captures are attached to the Codex task that produced this report.

Reviewed states included the overview, close History and Experience views, the long Research panel on portrait and phone layouts, distant and close city roads, interiors through glazing, the activated lighthouse, and the separate ambience control.

## Moving-scene audit

The local diagnostics run covered 470.28 seconds (7 minutes 50 seconds) of continuous scene time with repeated orbit, pan, zoom, viewport changes, interactions, and Escape recovery.

- Renderer creations: 1
- Renderer configurations: 1
- WebGL context losses/restorations: 0/0
- Scene errors: 0
- Unhandled errors: 0
- Black frames: 0
- Worst black-frame fraction: 0
- Console warnings/errors: 0
- Final camera after recovery: `[41.97, 29, 76.02]`
- Final renderer tier: low after sustained browser-automation load; adaptive quality changed three times and navigation remained responsive.

## Visual acceptance notes

- History and Experience foundations, floors, and thresholds have distinct elevations; no flashing or terrain bleed was observed while moving.
- Major streets are authored curves with graded terrain, coherent junctions, entrance gaps, and restrained curbs. No universal white road outline remains.
- City planting, courtyards, coastal beds, facade vines, roof gardens, and gray-brown trunks read as one ecological system.
- Rear elevations use continuous building materials, framed service openings, lift landings, brackets, roof access, drains, and connected platforms.
- Pointer activation of the lighthouse no longer produces the dark circular focus artifact. The uncapped additive beam has axial alpha falloff and a hidden non-depth-writing hitbox.
- The ferry has cabin, glazing, seating, console, rails, bumpers, cleats, propulsion detail, navigation fixtures, and a speed-dependent wake.
- Shore spray originates from exposed modeled rocks at wave-arrival phases; fish re-entry and direct interactions share bounded ripple/particle events.
- Procedural ambience starts only after activation, exposes separate mute and volume controls, and pauses cleanly.
- The expanded Work, Experience, Research, and History copy is present in semantic HTML and live panels.

## Remaining limits

- Environmental audio is procedural and intentionally lightweight. Distance mixing is represented by destination-proximity changes for city/fountain layers rather than binaural 3D panning.
- The daylight arc stays within a bright daytime palette; this pass does not introduce night lighting.
