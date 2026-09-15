# Coastal archipelago verification

The world now has five organic islands, submerged shelves, distinct destination architecture and a separate coastal city. Shared terrain functions drive geometry, shoreline shading, vegetation, structural exclusions and camera clearance. The renderer lifecycle, free camera, canonical portfolio content and optional audio remain intact.

The local cloner and UI/UX toolkits informed screenshot comparison, responsive checks, accessibility and performance review. Reference research remained private; no reference artwork or branding is included in the export.

## Iterations

- Replaced rectangular terrain and planting bounds with organic island contours and area sampling.
- Added a thirteen-building city with five architectural families, gardens and continuous transit.
- Rebuilt the six landmarks with curved shells, glass, terraces and an ocean-facing lighthouse.
- Added five cloud graphs with variable instance ranges, continuous bounded drift and one damped interaction system.
- Replaced child-mesh hover handling with stable hit proxies and a cancellable 120 ms exit grace.
- Refined overview framing, water color, atmospheric depth and sun size after desktop/phone screenshots.
- Corrected pane/solid-wall overlap, frame intersections, shadow coverage and path seams after close visual inspection. Reflective aqua outer Work panes and flat frame sections remove the remaining facade speckling; the atrium stays transparent.

## Checks

`npm run check` runs ESLint, strict TypeScript and a production static export. `npm test` passes all 79 tests and covers content, audio, navigation, camera bounds, touch gestures, reduced-motion preferences, architecture, rendering lifecycle, city, coastline and clouds. Each landmark's stationary-hover regression runs for at least three real seconds.

Actual browser inspection covers 1920×1080, 1440×900, 1024×768, 768×1024 and 390×844. Captures include the initial layout, reverse water/island views, Work, city, lighthouse, planting, development coverage colors, clouds, hover labels, phone content and WebGL fallback. Browser navigation includes direct hashes, model selection, dock links, keyboard activation, Escape/focus, history and internal content scrolling. Free orbit remains available with content open, and wheel zoom reaches the city.

A 148-second browser run crossed seven quality changes and rendered 8,889 frames with 810 sampled frames: one renderer/configuration, zero black frames, context losses or errors, and 60 fps in its final sample. Local HTTP checks returned 200 for all sixteen exported assets. No unrelated content or audio changes were made.

Browser performance was measured at DPR 1 on the development Mac. Responsive views are viewport tests, not physical-device benchmarks. Touch/pinch and reduced-motion transitions also have automated component coverage; an OS preference toggle was not performed in this pass. Periodic black-frame sampling supplements visual checks and does not capture every frame.

The existing Pages workflow verifies and deploys only the static `out` artifact on main pushes.
