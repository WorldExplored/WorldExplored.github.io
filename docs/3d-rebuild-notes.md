# Portfolio architecture — Aero refinement

Current revision: September 2026 refinement. Earlier build evidence remains in `qa/3D_ITERATION_LOG.md`; it describes retired interfaces and is not the current architecture.

## Canonical content and navigation

`Habitat.tsx` renders each semantic section exactly once. Before enhancement all sections are readable in document flow. Enhancement selects one canonical section after a cancellable 800 ms camera approach. Content appears in a framed architectural display on the right of desktop views and below the selected structure on narrow views. A projected connector ties the surface to the landmark; no backdrop or modal is used.

`navigation.ts` provides stable hash/history snapshots. Native and modified anchors, deep links, Back/Forward and Escape are preserved. Opening focuses Back to world; closing returns focus to the initiating control. The reading surface uses native document scrolling and a sticky Back control, with no focus trap.

## Scene

`WorldCanvas.tsx` guards WebGL2 initialization, serializes Fiber root reconfiguration, observes host size, handles context loss and exposes failure to HTML. There is no image fallback. Automatic reduced motion retains a stable 3D view with immediate destination changes. Forced colors, Save-Data and genuine WebGL failure use a simple background and semantic navigation/content.

| Module | Responsibility |
| --- | --- |
| `AeroWorld` | Sky, sun, ambient light, reflection sources, pointer projection and HTML connectors |
| `CameraDirector` | Native scroll route, aspect fitting, cancellable approaches and immediate reduced-motion navigation |
| `Landmark` / `LandmarkModels` | Six distinct destinations, full model click handling and corresponding local feedback |
| `AmbientSystem` / `terrain` | Islands, bridges, groves, instanced grass, clouds and a few distant motes |
| `Water` | Local radial disturbance in analytic normals/highlights, natural decay and drag filtering |
| `ReflectiveObject` | Bounded rotation, damped release, fixed scale, capture cleanup and touch/keyboard behavior |
| `QualityController` | Actual renderer statistics, DPR and tier reductions |
| `preferences` / `navigation` | Stable browser-state subscriptions with cleanup |

All future daylight inputs live in `world.lighting`: sky and horizon, sun position/intensity/color, ambient colors/intensity, fog range/color, water colors, window illumination, lamp state/intensity and cloud color. There is no location request or clock-based lighting system.

Frame callbacks mutate reused Three.js objects/uniforms, not React state. Repeated environmental forms share geometry/materials. Reading uses demand rendering; hidden/offscreen canvases stop. Desktop/mobile DPR caps are 1.75/1.25. Sustained declines can reduce high to medium to low after an eight-second cooldown.

Foreground physics bubbles and Rapier were removed. Distant motes are small, soft, high and far behind the destinations. Cloud proximity uses the pointer's camera ray; vegetation uses its projected ground point. UI hover disables environmental proximity, and destination focus affects only the corresponding landmark.

## Content and assets

The public contribution collection contains five unique Open/Merged entries, including the accurately attributed co-developed work. Full source metadata remains available for maintenance. Research has one paper link and precise attribution; Purdue contains the verified institution, degree and class. Contact offers email, GitHub and LinkedIn. The introduction has one short research credential.

Source Sans 3 is self-hosted under SIL OFL 1.1; the license is adjacent to the font. The interface uses crisp edges, top highlights, controlled gradients and defined shadows without backdrop blur. Scene geometry is original procedural work. Historic screenshots are retained only as repository evidence.

`AudioControl` uses the approved source in `content/audio.ts`. Intentional Play starts the native HTML audio player using the creator-published licensed file. No media request occurs before activation; no YouTube API, video iframe or thumbnail is loaded. Source, creator and CC BY 4.0 attribution remain visible. Loading is bounded and unavailable playback retains the source link. See `research/AUDIO_REVIEW.md` for permission evidence and testing limits.

## Research and verification

The two requested local toolkits informed actual-reference inspection, component specifications, responsive review, 44 px targets, visible focus, native touch scrolling and measured rendering. The cloner workflow was adapted to original artwork, and generic grid/monochrome suggestions were rejected. Detailed Aero/font sources and decisions are recorded in `research/AERO_REFINEMENT.md`.

Run `npm run check` and `npm test`, then inspect the static export in a browser. The current refinement log records repeated visual passes, actual frame/input counters, preference coverage, third-party playback limits and deployment evidence. Component tests do not substitute for browser shader or physical-device checks. Private exclusion criteria are read by an external audit and never embedded in public tests or documentation.
