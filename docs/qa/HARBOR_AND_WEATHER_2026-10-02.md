# Harbor and weather verification — 2 October 2026

The city now has one connected pier with separate ferry and visitor berths. Three vessels remain: the ferry, survey launch and coastal visitor. Enclosed waterjets replace exposed propellers. The visitor has a matching doorway, sliding gate and gangway, full guardrails, fenders, life rings, raft canisters and fitted passenger spaces. Dock algae stays attached to the piles alongside barnacles. Rain catches both connected pier decks.

Four residential towers gained wider floor plans and additional rooms at a consistent floor height. The History museum is 18% smaller, with its lighting, planting, stairs, path threshold and camera framing adjusted together. Its exhibits include a globe, microscope, orrery, camera, processor board and computer display.

Mature trees form irregular groves; grass fibers and ground share a natural green palette. Six slender vine leaders spiral up the lighthouse. Four exposed cliff faces receive breaking waves, foam and airborne spray. Clouds travel in groups across consistent height bands under a breeze that holds for ten minutes and turns over two minutes. The larger storm bank sits at 104 m. Thin cloud geometry has consistent surface winding, and spray composites after the ocean.

Gulls are smaller and retain separate nesting approaches around the larger trees. A migrating flock crosses the sky every 2.5 hours during daytime. One free-swimming sea snake and one mostly hidden cave eel replace the more numerous snakes. Octopus mantles and flexible arms have finer anatomy. The front garden cave is removed. A roughly 23 m whale stays far offshore, with rare breaches, splash particles and blowhole mist.

## Checks

- `npm run check`: ESLint, TypeScript and static export passed.
- `npm test`: 434 tests passed, including twenty-minute vessel separation, physical boarding openings, complete gull-route clearance, occupied nests, rain/deck intersections, long wind schedules, cave occupancy and offshore whale exclusion.
- Production-export browser review: connected harbor and open gangway, museum proportions and displays, full-height lighthouse vines, shoreline spray, cloud undersides, high storm bank, distant whale breach and spout, migrating flock, city lighting at night and mobile History navigation.
- Desktop harbor sample: 52 FPS, 598 draws at high quality; prepared scene in 5.28 seconds with no pending textures. Mobile 390 × 844 History sample: 60 FPS at medium quality; preparation 5.82 seconds. These are local observations, not device-independent guarantees.
- No browser scene errors, unhandled errors or context losses observed. Entry remains gated on completed assembly; navigation does not construct new rooms.

Static boat parts are merged by material, cloud geometry remains within its existing budget, and the deterministic landscape plan is cached and frozen. Repeated landscape reads no longer rerun tree placement. Temporary captures and diagnostics are in `.tmp/qa/oct2/`, excluded from Git.
