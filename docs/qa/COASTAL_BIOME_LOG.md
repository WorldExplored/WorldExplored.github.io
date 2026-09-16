# Coastal biome and interaction rebuild — 2026-09-16

Baseline: `b9950de9f1814b822bd6c019e13c4c6f8d8793e3`. The static Pages deployment workflow is unchanged.

## Architecture and visual review

- Floors and foundations now follow each building's actual room unions, curves and split footprints. Interior metadata survives material batching for triangle-level containment tests. The academic hall has a continuous inset substrate below its plank finish; no exposed terrain between planks.
- A shared coastal ecology field controls terrain color and vegetation. Broad irregular beaches separate wet sand, dry sand, soil and coastal grass. Eight instanced flora families, planted town courts, driftwood, shells, pebbles and shallow seaweed replace the uniform lawn. Six angular stratified rock archetypes have flat embedded bases.
- Rounded circulation routes grade the ground itself. Paving is a ground attribute rather than overlapping ribbons. Entrance landing planes, bridges, station stairs, curbs and drainage share actual terrain heights. Ground support and full doorway widths are tested against rendered triangles.
- The lighthouse has recessed openings, masonry seams, framed glazing, balcony brackets, service details, a rotating Fresnel assembly and a temporary lantern response. The existing bird and private teaser remain.
- Six bounded town interactions cover fountain patterns, transit illumination, solar orientation, greenhouse vents, buoy bell and turbine alignment. Stable raycast targets and native keyboard controls share resettable state. Reduced motion uses immediate poses and timed resets without an animation loop.
- A single camera controller owns orbit, pan, pointer-anchored normalized zoom and one/two-finger transitions. Both position and target are bounded, with terrain/building collision checks. The identity button and Escape recover overview.
- Five creator-hosted Scott Buckley tracks use verified CC BY 4.0 licensing. Shuffle, wrapping progression, previous/next, no consecutive repeats, volume/mute persistence, fades and bounded failure handling use one native audio element. See `docs/research/AUDIO_REVIEW.md` and `audio-source-evidence.json`.

## Validation

`npm run check` passes lint, strict TypeScript and production static export. All 177 tests pass. New coverage includes floor containment and plank seams, flora exclusions, shared path grading and complete doorway widths, repeated camera gestures/recovery, stable hitboxes, timed reduced-motion resets, playlist progression/failure/wrap and browser timer binding.

Production-export screenshots were inspected at 1920×1080, 1440×900, 1024×768, 768×1024 and 390×844, without horizontal overflow. Mobile Research scrolling, expanded audio controls and two-stage Escape dismissal were checked. Close inspection covers every landmark at entrance, oblique and rear angles, interiors, three city buildings, planted courts, island/city circulation, eight shoreline views, angular formations, lighthouse and all six town interactions. Private review controls import the repository geometry and are not included in the exported site.

Real pointer orbit/wheel actions and identity/Escape recovery were exercised. A private production fixture additionally dispatched 20 mixed one/two-finger, right-pan and wheel sequences through the real DOM listeners; the camera remained bounded and no scene/unhandled errors occurred. These synthetic touch tests do not substitute for physical phone testing. A first fixture incorrectly targeted Document instead of Canvas and was corrected before acceptance.

All five tracks played in native browser audio. Seeking to the final quarter second confirmed a genuine ended event and automatic advance; a synthetic media error confirmed fallback to another playing track. Creator endpoints return audio/mpeg, HTTP 200 and byte-range support. They omit Access-Control-Allow-Origin; native audio without a crossorigin attribute plays correctly and does not require a CORS-enabled Web Audio pipeline.

The reduced-motion production fixture reports stopped motion, elapsed scene time zero, keyboard activation and automatic greenhouse reset. Two captures after settling were byte-identical. No OS preference was changed in this pass.

## Performance

Single desktop-browser trials at 1440×900, DPR 1; no CPU throttle. Network fixture adds 100 ms latency and limits each response to 6 Mbps. Results are observations, not universal device guarantees.

| Trial | Interface DOM | Core frame | Camera ready | Full vegetation | Longest startup task |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold | 52 ms | 933 ms | 942 ms | 5002 ms | 315 ms |
| Warm | 76 ms | 888 ms | 901 ms | 4743 ms | 314 ms |
| Throttled | 340 ms | 1615 ms | 1626 ms | 5473 ms | 321 ms |

Cold JavaScript is 441,889 gzip bytes, up 9,560 bytes (2.2%) from the prior release. Prior cold core was 943 ms and full vegetation 2394 ms. The first usable world remains equally prompt; the richer ecological sampling extends progressive plant completion by about 2.6 seconds. Sampling yields between work slices. Warm layout coordinates remain stable through scene readiness. The cold trial included an intentional viewport change and is not used as layout-stability evidence.

A 142-second observation ended at 60 fps, 364 render calls and 1,867,460 triangles (prior overview 340 calls / 1,679,038 triangles: approximately +7% / +11%). One renderer and configuration, no context loss, black frames, scene errors or unhandled errors. Main landmark architecture remains 95,564 triangles / 184 calls within the existing 100k / 185 budget. Materials, static batches, instanced plants/rocks and distance detail remain bounded; no large downloaded models/textures were added.

## Evidence and limits

Private evidence lives in the workspace `work/biome/after`; the final HTML report also records the deployed commit, live viewport/audio/asset checks and screenshots. Fine machinery, interiors and plants require approaching them; the narrow overview presents the islands at a smaller scale. The world remains stylized, with economical transparent glazing/water instead of full-scene physical refraction. Full vegetation takes longer than the previous release. Physical mobile GPU performance and hardware multi-touch were not measured. Creator-hosted audio availability remains outside this repository's control.
