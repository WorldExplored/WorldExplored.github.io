# Startup and habitat verification — 26 September 2026

The entry window now waits for shader preparation, texture settlement and two complete rendered frames. City interiors are constructed before entry and only change visibility during navigation. Exported terrain and deterministic planting avoid regenerating the ground on each visit. Shared material downloads run alongside the layout download; stalled images receive neutral fallback pixels after eight seconds and recover if the original image arrives later.

The city coastline is an oval containing the previous city and museum shorelines. Buildings retain their original placements. Docks, ferry boarding, vegetation, reef ridges and marine routes were adjusted to that expanded coast. Vessel checks use the full long hull, including turning and ferry crossings.

## Verification

- `npm run check`: lint, TypeScript and static export passed.
- `npm test`: all 419 tests passed, including long wildlife cycles, boat traffic, collision envelopes, shoreline coverage, shader contracts, scene disposal and startup fallback behavior.
- Desktop production-export inspection: night city lighting, street fixture attachment, sidewall planting, fountain, visitor berth, embedded lighthouse cave, turtle nursery and sunset.
- Normal entry stays disabled during assembly and reveals the completed scene when activated. No room construction occurs when approaching the city.
- Time preview accepts keyboard changes while retaining focus and returns to Eastern time. Settings do not send pointer motion into the world.
- 390 × 844 responsive inspection: navigation to History, readable panel and intact world layout.

Temporary screenshots and capture metadata are under `.tmp/qa/september26/`, excluded from Git. No screenshots or browser output are included in the release.

## Rendering budget

At equal medium-tier coverage, overview reef and shoreline seaweed decreased from 1,468,768 to 815,208 triangles (44.5%) with no increase in active overview draws. Detail returns near the camera without moving roots or changing their colors. Cave geometry remains below 14,000 triangles for four embedded banks and their residents. Vegetation and wildlife remain instanced or merged by material.

The final desktop entry reached complete readiness in 5.96 seconds with zero pending texture loads; entering required no further assembly. Desktop overview samples were approximately 43–47 FPS as quality adapted; the 390 × 844 viewport sampled 60 FPS. Browser scene and unhandled-error counters remained zero. Performance measurements are local browser observations, not device-independent guarantees. Initial loading still depends on network and GPU shader compilation; the change removes premature readiness and navigation-time room creation rather than promising instantaneous startup. Audio delivery depends on the existing external player and was not changed in this pass.
