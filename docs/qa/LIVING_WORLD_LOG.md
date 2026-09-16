# Living coastal world verification

Reviewed 2026-09-16 against deployed baseline `bbbc085df740947fcaee4f33ea75864221c4fc97`. Visual inspection is separate from the behavior suite.

## Changes

The first interface uses its final layout before hydration. Core terrain, water, camera and building shells appear before secondary scenery. Coast data is generated during the build; deterministic planting uses a spatial index, cached positions and short yielding batches.

Both bridges share sampled curves for solid decks, rails, supports, flattened landing pads and clearance checks. The campus hall faces its separated landing and entrance path. Eighteen gulls have unique routes, deconflicted approach corridors and exclusive perch reservations. The lighthouse resident has a dedicated physical perch. Crab behavior uses bounded idle, walk, alert, retreat, hide and return states. The pale lighthouse artifact was an intersecting bird approach/body envelope; corrected waypoints and folded wing transforms remove the intersection.

Five destinations now have distinct enclosed volumes: a two-level compute building, low research wing and observatory, compact campus hall, glazed reception terminal, and garden gallery/conservatory. The sculpture remains in its courtyard. Mobile focus includes entrance and roof; tablet focus fits the available scene width, and the campus camera follows its entrance orientation.

A shared terrain lattice removes overlapping radial surfaces. Grass/soil, dry sand, wet sand, submerged shelf and exposed stone blend from distance, elevation, slope, depth and wetness. Beaches have fine grain, small shells and moving wash. Sparse seaweed grows in five calm coves, with all tips below the lowest wave surface. A single garden service rover follows a validated path from its visible charging post, tends planting and returns without teleporting. Existing city, train, clouds, music and public profile content are preserved.

## Production measurements

Times are milliseconds. These are individual local-browser trials, not device-independent guarantees. Core is the first complete core frame; full is staged environmental completion including plant buffers.

| Trial | Interface FCP | Core | Camera ready | Successful first drag | Full | Longest task through full |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before cold, 1280×720 | 128 | 2403 | Not instrumented | Not measured | 2403 | 1741 |
| Before warm, 1440×900 | 92 | 2317 | Not instrumented | Not measured | 2317 | 1709 |
| After cold, 1440×900 | 88 | 914 | 931 | Not attempted | 1914 | 305 |
| Final quiet warm, 1440×900 | 312 | 926 | 927 | Not attempted | 1972 | 191 |
| After warm with immediate camera use, 1440×900 | 164 | 1029 | 1052 | 1485 | 4892 | 378 |
| After network throttle, 390×844 | 388 | 1497 | 1506 | 1757 | 2501 | 193 |

The throttle adds 100 ms latency and 6 Mbps per response, with desktop CPU and no CPU throttling. Cold JavaScript transferred 417,579 bytes with gzip; warm transferred zero. The largest chunk took 24.5 ms locally and 607 ms under the network fixture. Decoded JavaScript is 1.442 MB versus approximately 1.415 MB before; the transfer difference includes server compression, not a code-size reduction. The active warm trial delays full scenery while camera input remains usable. Cold construction costs included terrain/trees 137 ms, coast field 14 ms, clouds 93 ms, city 44 ms and wildlife 22 ms. The old coast field took 587 ms and grass generation 844 ms. The longest task across the wider cold observation was 427 ms. The quiet warm trial uses the final camera framing build; the other after trials use the same staged initializer.

The interface coordinates stayed stable through hydration/core readiness. Mobile font loading changed the name width by approximately five pixels without moving its origin. No ordinary-load semantic-document flash was observed.

## Verification

- `npm run check`: ESLint, strict TypeScript and production static export passed.
- `npm test`: 118 tests passed. A subsequent 12-test camera pass covers final entrance orientation and tablet framing.
- Bridge checks sample actual final deck vertices against terrain triangles, footprint bounds, rails, supports and pads. Both bridges were inspected above, below, from both sides and at both landings; the campus entrance was inspected separately.
- All five buildings were captured from front, three-quarter, rear/side and overview positions. Eight coastal views cover the main beach, campus and garden shores, lighthouse islet, submerged shelf, seaweed, sand/grass boundary and wet wash. A private inspector imports production components; it omits foreground scenery for structural clarity and hides water only in below-deck views. No inspector files ship.
- Wildlife tests cover five-minute deterministic trajectories, rapid pointer changes, exclusive perches, finite/bounded motion and actual bird mesh clearance. Browser observation exceeded two uninterrupted minutes. Lighthouse environment checks include birds, rocks, clouds, wave impacts, mechanisms, vegetation, seaweed and shore props.
- A continuous 272-second production sample reported approximately 60 fps, one renderer/configuration, zero black frames, context losses or application errors. Console inspection was clean.
- Reviewed 1920×1080, 1440×900, 1024×768, 768×1024 and 390×844. Mobile navigation targets are approximately 65×66 px; tablet targets are approximately 91×75 px. No horizontal overflow was observed.
- Free camera, keyboard activation, focus return, Escape, native panel scrolling, direct hashes and Back/Forward verified. A direct lighthouse load followed by About leaves one panel and clears bootstrap layout state.
- Private production-HTML fixtures exercise unavailable WebGL and unavailable JavaScript. Canonical content and navigation remain usable. Reduced-motion screenshots were byte-identical across approximately 50 seconds and destination navigation remained immediate. No OS preferences were changed.
- Touch ownership, pinch and cancellation are covered by component input tests; no physical phone was used.
- All 32 exported files returned HTTP 200 locally. Profile and music source files are unchanged. Content audit completed; its private criteria and evidence remain outside the repository.

## Limits

The world remains stylized. Fine machinery, wildlife and underwater plants require approaching them. The narrow mobile overview fits the primary islands at a smaller scale. Foreground vegetation and hills may occlude portions of buildings from some free-camera angles. Measurements use one desktop browser and a network fixture rather than physical mobile hardware. Local visual evidence is retained in the private release report; Pages verification is recorded with the release handoff.


## Inhabited-world extension — 2026-09-16

Built on stabilization release `910a3a1491564cb9c90fcc46139ab98b6a393ba8`. All five main buildings now have visible furnished rooms. The compute atrium is enclosed with transparent framed glazing; lab rooms, gallery/conservatory, reception and the enlarged academic hall have purpose-specific furnishings. The city has thirteen distinct silhouettes and thirty-one furnished window groups. Nine static finish batches retain a bounded draw budget.

Four fish species use distinct body, tail and fin geometry with independent habitat and swimming parameters. The new open-basin fountain uses transparent animated streams, droplets, ripples and splash detail. Physical transmission was removed after profiling revealed an extra full-world render; reflected highlights and transparency remain. Materials now separate wood, fabric, stone, metal, glazing and selected glossy shells.

An explicit circulation graph connects actual primary entrances, both bridge approaches, city housing, parks, station, streets and existing ferry docks. The lighthouse has a local entrance/court/overlook route. Ground path tops follow actual terrain triangles, with closed sides and raised entrance transitions. The gallery route clears its sculpture, bench and planter. The station has fifteen uniform steps between measured ground and platform elevations, closed risers, continuous rails and a top landing. Its raised canopy and attached arrival lights preserve platform headroom.

Existing service pods now travel on visible guides behind two residences and meet grounded docks. The full 22-second cycle was sampled 441 times against actual building geometry: minimum clearance 0.306 m; rotating solar panels clear roofs by more than 0.053 m. No new freely flying machine was added. The garden rover retains its charging post and bounded route.

### Final production measurements

Individual quiet local trials with the final exported build; milliseconds. Interface means first contentful paint.

| Trial | Interface | Core frame | Camera ready | Successful first drag | Full environment | Longest task through completion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original baseline cold | 128 | 2403 | — | — | 2403 | 1741 |
| Original baseline warm | 92 | 2317 | — | — | 2317 | 1709 |
| Final cold, 1440×900 | 68 | 943 | 952 | Not attempted | 2394 | 277 |
| Final warm, 1440×900 | 68 | 767 | 777 | 1067 | 2291 | 254 |
| Final cold network throttle, 390×844 | 388 | 1500 | 1509 | 1800 | 2944 | 241 |

The network fixture adds 100 ms latency and limits each response to 6 Mbps, with desktop CPU and no CPU throttle. Cold JavaScript transfer is 432,329 bytes with gzip; decoded JavaScript is approximately 1.484 MB. Warm transfer is zero. The largest local chunk took 26.6 ms. Original baseline transfer was uncompressed, so transfer-size differences are not a code-size improvement.

Final cold construction measures: coast field 15 ms, terrain/trees/paths 185 ms, city 22 ms, clouds 99 ms, flora sites 14 ms and wildlife 32 ms. Deterministic terrain-lattice samples and validated authored city routes remove repeated procedural work. The identity and navigation coordinates remain stable between initial layout and scene-ready; mobile font loading changes name width by five pixels without moving its origin. No ordinary-load fallback-document flash was observed.

### Final checks and evidence

- `npm run check` passes ESLint, strict TypeScript and the production static export. `npm test` passes all 143 tests.
- New tests cover species silhouettes and long swimming simulations; furnished interiors; city material batches and bounds; final path triangles and entrance connections; station stair endpoints/headroom; fountain resource retention and reduced-motion poses; and complete service-lift/solar geometry cycles. Existing bridge, bird, crab, camera, input, content and rendering checks remain passing.
- Path validation samples 72,878 top vertices and 133,416 triangles at four interior points each, with minimum terrain clearance greater than 0.016 m. Bridge checks continue to inspect actual final deck/rail/landing geometry.
- Close-up evidence includes five furnished landmark interiors, twenty exterior views, both bridges from six positions, four station stair angles, city room depth and streets, grayscale fish silhouettes, species habitats, fountain motion, and the complete island/city path network. The private inspector imports repository geometry; dense foreground scenery is omitted for structural visibility, and water is hidden only for below-deck inspection. It is excluded from the export.
- Responsive checks cover 1920×1080, 1440×900, 1024×768, 768×1024 and 390×844. No horizontal overflow; desktop/tablet dock links are approximately 91×75 px. Keyboard activation, Escape with focus return, mobile panel scrolling and Back/Forward were checked in the production browser. Touch ownership, pinch and cancellation remain covered by input tests; no physical phone was used.

The scene is stylized, and fine fish/interior details require approaching them. A few close path junctions retain visible paving seams. Glass and fountain highlights use economical transparency/reflection rather than full-scene physical refraction. Local browser measurements do not establish performance on every mobile GPU.

- Final uninterrupted production observation lasted 133 seconds: 726 diagnostic samples, one renderer/configuration, no context loss, black frame, scene error or unhandled error. Observed samples ranged from 54 to 60 fps, ending at 57 fps, 340 render calls and 1,679,038 triangles at high quality. Console clean.
- Reduced-motion screenshots were byte-identical across 105 seconds and About navigation remained immediate. Private export fixtures verified Research content with WebGL unavailable and native Purdue hash navigation with JavaScript absent. No OS preferences were changed.
- All 32 exported files returned HTTP 200. The private screenshot report includes the raw startup, renderer, console and route evidence.
