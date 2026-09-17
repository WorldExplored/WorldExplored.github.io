# Coastal world close-range verification

This pass replaces synthetic environmental tones with recorded local audio, rebuilds tree branch and leaf structure, repairs bridge mouths and city circulation, and connects detailed city interiors, doors, solar racks and nine enclosed lifts. The existing portfolio content and section architecture are preserved.

## Comparison method

Open [the before/after gallery](index.html). Fifteen views include separate gull, crab and fish captures. Fourteen are close or medium inspection views; one is the complete overview. Each PNG is an actual WebGL canvas capture at 1440 × 900, paired with JSON containing the camera, target, quality, runtime, rendering counters and audio-control state. The canvas captures omit the HTML identity, navigation and content overlays; those were inspected separately in the browser.

The baseline was reconstructed from `e1acc67d12baf1a18422e8f5ad9ecca3131022b0` inside ignored `build/baseline`. The same localhost-only camera/capture harness was added to that archive. Baseline visual assets, geometry and materials were unchanged. Both builds used the same constrained camera poses and initial animation state. Camera and target coordinates match within 1e-10 world units. The baseline is a rebuilt historical revision, not an archived screenshot of the old deployment.

`qaView`, `qaStill`, capture POSTs and Alt+Shift+P are enabled only on localhost. The production site does not run the capture server. Reproduce with `npm run build`, `node scripts/serve-qa.mjs`, then `http://127.0.0.1:4177/?qaView=tree&qaCapture=after/tree&qaStill=1&qaBatch=after&diagnostics=1`.

## Visible changes

- Three tree forms use tapered trunks, root flares, branching forks, bark relief and smaller individual leaves. Ground flora follows shared route/structure exclusions with additional spacing. Flower heads have more credible proportions. A grape trellis occupies the city courtyard.
- City glazing exposes workspaces, reading areas, dining spaces and conservatory counters. Doors have attached frames, handles, thresholds and approach porches. Rear openings connect actual floors to guarded landings and enclosed moving lift cabins. Roof slabs no longer cross upper rooms.
- Solar installations have four feet, crossrails, bearings and visible cell grids. Low-gloss mineral and wood finishes replace uniform shiny white surfaces.
- Bridge mouths have terrain cutouts underneath their decks and buried abutments instead of competing circular caps. Contour-built curbs follow route unions, with flush drainage grates and restrained paving joints.
- Gulls have independent idle head motion. Crabs have layered shells. Fish have smoother species profiles and wider, bounded schooling separation; each breach produces one splash at its actual water-surface crossing.
- Whole landmark parents own hover and click events. City buildings illuminate locally without fake portfolio navigation. Fountain patterns blend actual water trajectories. Tree and exposed-rock responses remain visible when animation is paused.

## Interaction evidence

- [Landmark neutral](interactions/hover.png), [roof hover](interactions/hover-01.png), [glazing hover](interactions/hover-02.png), [rotor hover](interactions/hover-03.png). JSON confirms `hovered: work` and identical camera coordinates across all three surfaces over more than 20 seconds. A zero-distance browser scroll moved the pointer without wheel zoom. Clicking the visible rotor opened the real Open-source work panel.
- [Bell initial](interactions/bell.png), [recorded strike](interactions/bell-02.png), [ambience running](interactions/bell-03.png). Corresponding JSON records bell-strike count 1 and `data-audio-state=playing`. Native mute/unmute and pause controls were exercised with no browser errors.
- [Fountain default](interactions/fountain-response.png), [pattern one](interactions/fountain-response-01.png), [pattern two](interactions/fountain-response-02.png). The visible basin was clicked directly. An additional matched [before reaction](before/fountain-reaction.png) / [after reaction](after/fountain-reaction.png) pair holds the same camera and first activated pattern.
- [Tree before](interactions/tree.png), [tree activation](interactions/tree-01.png). The nature event identifies the clicked tree rather than a global response.
- [Rock before](interactions/shore-motion.png), [rock impact](interactions/shore-motion-01.png), [later state](interactions/shore-motion-02.png). The click produces an identified `rock` event at the exposed water-facing edge, with an accompanying ripple. Spray is deliberately small. The later state may also include the independently timed fish re-entry; metadata identifies the latest cause.
- [Zoom initial](interactions/zoom.png), [approach](interactions/zoom-01.png), [retreat](interactions/zoom-02.png), [orbit](interactions/zoom-14.png), and [overview recovery](interactions/zoom-15.png). Six complete approach/retreat cycles plus a seventh longer approach were exercised. The camera returned to the overview after Escape; all runtime error counters stayed zero.

## Verification

`npm run check` passes ESLint, TypeScript and the static production build. `npm test`: **188 passed, 0 failed**. [Build log](check-output.txt), [test log](test-output.txt). `git diff --check` passes.

Behavior checks cover parent hover stability for every landmark, localized city hover, bridge-mouth surface ownership, route and foliage containment, room floors, nine lift stop sets and closed doors during travel, solar-foot contact, audio gesture/start/retry/mute/bell behavior, wheel/touch navigation recovery, fauna separation and actual re-entry positions. The shore regression checks every rock response lies outside its footprint in water.

## Responsive browser audit

The static export was opened at 1920×1080, 1440×900, 1024×768, 768×1024 and 390×844. The `viewports` folder stores canvas PNGs and runtime JSON for each size. Identity, dock and content controls were separately inspected in native browser screenshots. Browser console checks returned no warnings or errors. Desktop and portrait tablet runs were around 60 fps on this host; compact landscape reported 45–48 fps. Mobile selected medium detail and reported around 60 fps; its Open-source work panel opened and closed correctly. These are sampled host observations, not hardware benchmarks. [Browser audit record](browser-report.json).

## Audio provenance

Six optimized local MP3 files total approximately 734 KB. Original excerpts were converted to mono, level adjusted and compressed; playback adds a one-second equal-power loop overlap. The gull clip is a bounded occasional one-shot with slight pitch variation. Fountain and ferry gain follow actual listener/source positions; vegetation rustle follows tree proximity. Bell playback uses the same mute and volume master and can work while ambient loops are paused. Music remains independent.

See [published audio credits](../../../public/audio/coast/credits.html) for exact source links and transformations: Luftrum shore (CC BY 3.0), giddster wind/leaves (CC0), avphillips gull (public domain), Siddharth Patil water (CC0), Work With Sounds/Torsten Nilsson boat engine (CC BY 4.0), Stephan/PDSounds bell shortened by Ocaasi (CC0). The historical boat recording is filtered for a faint ferry layer; it is not a recording of the modeled vessel.

## Limits

The world retains an authored stylized miniature aesthetic. It uses procedural geometry and material detail, not photogrammetry or newly imported GLB assets. Some distant rooms and fauna remain simplified. The viewport audit runs on the host browser, not physical mobile hardware. Automated audio decoding, playback state and control behavior were checked; speaker/headphone listening quality was not independently auditioned. Reduced-motion behavior is covered through the paused scene path and regression tests, rather than an OS-wide preference change.
