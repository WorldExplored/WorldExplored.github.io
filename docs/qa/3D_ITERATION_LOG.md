# 3D habitat verification — 14 September 2026

This record concerns the real-time rebuild. The earlier illustration-based release has its own `ITERATION_LOG.md`.

## Rendered refinement

1. **First complete scene:** desktop, 768 × 1024 tablet and 390 × 844 mobile captures exposed washed-out materials, overlapping signs and an overly distant mobile camera. Idle observation exceeded 20 seconds. Added rounded groves and shoreline detail, lowered lighting intensity, repositioned signs and moved the mobile camera closer. Camera flight and initialization handling also needed corrections.
2. **Integrated renderer:** the guarded Fiber root kept HTML usable after a missing constructor was discovered and fixed. Desktop idle measured 60 FPS. Responsive inspection exposed renderer-written canvas dimensions preventing resize. The performance monitor also incorrectly treated healthy incline samples as a reason to fall back. Fixed parent-host sizing and removed the incline-counting fallback. Mouse drag, dialog focus and Back/Forward worked. This iteration was not accepted.
3. **Responsive scene and stronger color:** captured all three sizes and observed more than 30 seconds of idle motion. Water ripple and bubble-drag counters each advanced; pointer movement changed the camera. Tablet framing now included all landmarks, but exposed a clipped sky sphere. Increased the far plane to contain the sky from every camera pose. Retained caustics at low quality and bypassed tone mapping for authored sky/water colors.
4. **Release review:** recaptured desktop, tablet and mobile, tested every dock destination, keyboard wrapping, Escape, hashes, fallback, native scroll and overview recovery. Corrected mobile landmark/dock overlap and added a soft reading surface behind the hero. An extended idle observation exposed cloud vertices wrapping independently and stretching across the sky. Clouds now wrap by a shared cluster origin; 75 numerical boundary cases preserve every vertex offset. Browser shader startup remains clean.

Early failing iterations received targeted checks; they did not complete the entire acceptance matrix. The release checks below distinguish browser observations from automated coverage and remaining gaps.

## Measured results

| Check | Result |
| --- | --- |
| `npm run check` | ESLint, strict `tsc --noEmit`, Next.js production build and static export pass |
| `npm test` | 20 pass, 0 fail: 11 content/export tests and 9 R3F/policy tests |
| Dependency validation | Valid pinned peer tree; `npm audit --omit=dev`: 0 vulnerabilities |
| Privacy audit | Two private exclusion criteria scanned externally through filenames, source, exported text, Unicode, escapes, entities and Base64; no violations; criteria are not shipped |
| Desktop | 1440 × 900, high tier, representative 60 FPS, 79–80 main-render calls, 141,918–143,390 triangles, DPR 1 on the test display |
| Tablet | 768 × 1024, all four landmarks in frame, no horizontal overflow; representative high tier 60 FPS, 80 calls, 143,390 triangles |
| Mobile | 390 × 844, medium tier on fresh load, representative 60 FPS, 80 calls, 107,462 triangles; landmark map ends at y=746 and dock begins at y=752 |
| Low tier | Observed before the monitor correction: 79–80 calls, 85,268–86,740 triangles and 60 FPS; final low-tier geometry/water behavior also covered by tests |
| Idle | Multiple observations beyond 20 seconds show cloud, vegetation, water, bubble and signal motion; a longer observation found the cloud-wrap defect described above |
| Pause | Frame/time diagnostic snapshot stayed at frame 2,546 / 42.44 seconds through a subsequent observation over 20 seconds later; canvas reports stopped |
| Native scroll | Mobile scroll moved from 0 to 548.5 px and changed the camera from `[17,19,37]` to approximately `[12.19,16.1,31.38]`; vertical scrolling is not intercepted |
| Pointer and drag | Camera position responds, water ripple counter advances, tactile drag counter advances, released bubble moves; bounded collision/momentum probe and regression tests pass |
| Free Explore | Expanded pointer range, visible recovery action, Return to overview and guided mode pass |
| Dock and dialog | Work, Research, Purdue, About and Contact open the correct title; Close receives focus; ambient work stops |
| Keyboard | Shift+Tab wraps to the final Contact link; Tab wraps to Minimize; Escape closes and restores the initiating control |
| History and hashes | Work Back/Forward, direct Research, and direct Contact under failure fallback pass; close clears the destination |
| Building teaser | Exactly once in semantic HTML; full additional list excludes featured authored work |
| WebGL failure | Controlled context-denial branch returns static view, zero canvases, complete Contact dialog and correct focus; no warning/error logged |
| Manual Still view | Removes the canvas and preserves content/navigation |
| No JavaScript/WebGL content | Export tests inspect semantic HTML with scripts, templates and canvas removed; identity, all six sections, evidence and links remain |
| External URLs | 16 of 17 unique destinations return HTTP 200; LinkedIn returns its automated-request block (999). HTTPS and new-tab safety attributes pass for every link |
| Console | Fresh production-preview tab has no warnings or errors after dependency and renderer fixes |

Counts are `renderer.info.render` for the explicitly rendered main scene, not a total including every shadow/environment subpass. DPR caps of 1.75 desktop / 1.25 mobile are implemented and tested as configuration; the browser display used for these measurements reported DPR 1. These are viewport checks on a desktop computer, not benchmarks on physical mobile hardware.

## Review rubric

| Category | Initial | Release review |
| --- | ---: | ---: |
| Spatial depth | 4 | 4 |
| Continuous environmental life | 4 | 5 |
| Input responsiveness | 3 | 4 |
| Frutiger Aero specificity | 3 | 4 |
| Discoverability and navigation | 3 | 4 |
| Copy precision | 5 | 5 |
| Mobile behavior | 2 | 4 |
| Accessibility | 3 | 4, with preference-browser verification outstanding |
| Runtime performance | 3 | 4 |
| Visual polish | 3 | 4 |

The environment uses stylized procedural water highlights and a small generated reflection environment, without full-scene refraction or photographic water reflections. Free Explore is bounded pointer looking, not walking or unrestricted orbiting. Touch checks use taps and vertical scroll at mobile viewports; physical touchscreen testing remains outside these measurements.

## Outstanding verification

Automated tests confirm reduced motion, forced colors, Save-Data and manual static preference each disable WebGL, camera, ambient and physics channels. The requested browser-level reduced-motion and forced-colors emulation remains unverified: native browser control was interrupted and then timed out. Save-Data is policy-tested, not emulated on a physical connection. These gaps remain explicit; this record does not claim full acceptance of the original verification request.

Release screenshots: [desktop](3d/desktop.jpg), [tablet](3d/tablet.jpg), [mobile](3d/mobile.jpg), [work panel](3d/work-panel.jpg).
