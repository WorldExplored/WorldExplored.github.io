# Coastal refinement — 2 October 2026

This pass addresses the afternoon screenshots: vessel access and dock intersections, lighthouse breakers and stairs, tree scale, attached climbing plants, denser marine planting, animal anatomy, and the hidden giant crab habitat.

## Implementation

- Three vessels share a connected harbor. Visitor and survey boats have interlocked boarding gates and matching gangways. The island taxi has side entrances at both stops. Helms, instruments, thresholds and rescue fittings are modeled. Dock rails form a connected perimeter; shellfish and algae follow the pile surfaces.
- Navigation checks oriented hulls against the real dock envelope. Departure remains straight until the visitor boat clears the quay. Existing boat-to-boat yielding remains active.
- Lighthouse waves travel toward the rocks, curl, then release gravity-driven spray. Foam highlights the crest. The access stair is a straight, supported flight with continuous rails and a connected door landing.
- Trees use distinct oak, alder and willow crowns, with mature heights roughly 6–10 m. Palms and coconuts are larger, with brown trunks. Thin rooted vines branch along the lighthouse and turbine surfaces. Meadows and seabed clusters are denser, with distinct blade, broadleaf and fern forms. Tiny insects appear only at close range.
- Four larger dolphins use their enlarged body bounds for avoidance. Whales have a broad head, pleated underside, long pectoral fins and notched horizontal flukes; breaches use constant downward acceleration along offshore routes. Octopus, squid and crabs have varied anatomy and coloration. One rare sea snake alternates bursts, coasting and rest.
- An angular submerged recess between the lighthouse and Experience shelters an oversized crab. Its roof conceals the animal from above, and the outside mesh edges meet the physical seabed.
- Guideway panels, conduits, joints and bearings sit below the train corridor. An occasional solar glider crosses beyond the world boundary. Cloud dimensions increased while keeping the existing tessellation budget.

## Verification

- `npm test`: **454 passed, 0 failed** after integration fixes.
- `npm run check`: lint, TypeScript and production static export passed. Repeated after the final startup optimization.
- Boat checks include 20-minute route simulations, transformed hull geometry versus fixed harbor structures, mutually exclusive berths, boarding widths, connected rails and preserved draw-call limits. Conservative minimum static clearances: visitor 0.05 m, survey 0.22 m, taxi 0.218 m.
- Dolphin checks sample actual transformed body vertices for 10 minutes; minimum reef clearance was 0.192 m. Gull tests include the enlarged tree canopies.
- Cave tests cast through the entrance and roof, then sample every exposed mesh perimeter edge against the seabed. Solar panel corners are ray-tested against the actual wing surface. Guideway tests protect the station and running gear corridor.
- Lighthouse tests verify connected stair surfaces and rails; travelling waves remain present at low quality. Wildlife and planting budgets remain bounded. Added ferry fittings were batched to preserve the original city draw-call ceiling.
- Browser inspection covered the visitor and survey berths, wave crest and stairs, lighthouse vines, palms and skyline, guideway, kelp, cave, octopus, whale breach/spout and solar glider. Normal entry, History navigation and a playable Arcade game worked. At 390 × 844, document width stayed 390 px and controls remained usable. Music continued through navigation and advanced tracks. No scene or browser console errors were observed.

## Performance

The initial browser checks exposed a reef construction hotspot. A spatial radius rejection and one floor sample per planting candidate reduced a fresh-process `getReefHabitat()` call from 4,706 ms to 455 ms. The entire generated habitat JSON retained the same SHA-256 (`f88b39f317dc949d45ae05d6d17be57e3e904548600560c412b48c57d3f2d361`): 1,683 corals, 622 rocks, 2,514 plants and 639 kelp. This optimization changes work performed, not placement or density.

After rebuilding, a normal entry in the in-app browser reported `readyMs: 4689`, all five construction stages complete, plants ready and zero pending textures. Entering then completed without a second loading phase. Earlier runs before the optimization ranged from 7,896 to 17,702 ms; these are local observations, not a controlled cross-device benchmark.

The world still uses adaptive quality. Browser frame rate depends on view, viewport and GPU; a fixed 60 FPS or instant startup is not guaranteed. Close views recovered to 56–60 FPS at low quality in the in-app browser. Full-world views are more demanding.

## Local visual evidence

Screenshots and matching camera/runtime metadata are kept under the ignored `.tmp/qa/` directory:

- `oct2final/harbor`: visitor boarding and connected pier rails.
- `oct2final/survey`: survey berth and helm.
- `oct2final/breaker`: travelling crest at the lighthouse and rebuilt stair.
- `oct2final/plane`: completed solar glider in flight.
- `oct2b/grotto-final`: buried cave and giant crab.
- `oct2b/whale-apex`, `oct2b/whale-spout`: whale anatomy and offshore events.
- `oct2b/city-skyline`, `oct2b/lighthouse-vines`, `oct2b/guideway`, `oct2b/kelp`: scale and environment details.
