# Rendering correction review

Starting revision: `5225b9a`. The temporary external study contains 16 images from all six requested searches. No reference images are shipped. Baselines, iteration captures, cloud-volume capture, clean responsive views, focused surfaces and JSON audits are retained in the task workspace.

## Visual comparison

The first working build established a continuous meadow and viewport layout, but had pale terrain, sparse plants, rounded tree crowns and an overly elevated camera. These were material failures and were corrected before publication.

| Review question | Refinement 1 | Refinement 2 and final corrections |
| --- | --- | --- |
| Recognizable without the style label? | Partly: coherent green landscape/blue sky, but too pale. | Yes: saturated blue/green, white sunlight/cumulus, cyan shoreline, white/glass technology and humanist glossy UI reproduce the board's main relationships. |
| Bright and optimistic? | Bright but washed out. | White sunlight, deep blue sky and vivid diffuse meadow; no dark lighting or broad fog. |
| Nature and technology together? | Structures connected by paths in one meadow. | Daisies, individual tree leaves, fine grass and glass skyline reinforce the same place. |
| Wet dimensional gloss rather than blur? | Crisp UI and model edges; field reflections too broad. | Ground specular wash removed, selective glass/water highlights retained; water normals evaluated per fragment to remove the coarse highlight grid. No backdrop blur. |
| Continuous world? | One terrain mesh and connected paths replaced islands. | Continuous shoreline, lagoon, meadow and distant skyline remain coherent during orbit/zoom. |
| Correct hierarchy? | Work larger than Research; Purdue reduced to marker. | Work enlarged 20%, its exclusion/focus footprint expanded; About/Contact distinct and portrait overview reframed to retain both. |
| Generic low-poly remnants? | Tree crown envelopes and sparse terrain still looked toy-like. | Crown envelopes replaced with curved leaves, fine fiber texture and denser blades; smooth model geometry persists across tiers. Symbols remain deliberately stylized, not photorealistic. |
| Can visible interactive objects respond? | Dock/object routing and local cloud model worked. | All six destinations, sculpture, water and world controls exercised or component-tested. Every cloud puff is ray-tested in deterministic drift/deformation tests; development hit volumes were visually used, including behind the identity plate. |

Final captures cover 1440×900, 1024×768, 768×1024 and 390×844, all five main surfaces, the distant signal, free camera views and bases/vegetation around each landmark. Portrait camera and surface spacing were corrected after review. The content surface ends at y=690 and the unchanged music button starts at y=700 in the 844px portrait viewport.

## Rendering and interaction evidence

The final scene stress run sampled 480 actual drawing-buffer frames over 87.84 scene seconds, after all scene changes. It included pointer input, water, wheel zoom, orbit, every destination opening/closing, portrait-to-desktop resize and the bounded quality sequence. Result: zero predominantly black samples, context losses/restorations, scene errors or unhandled errors; one renderer and one configuration. Eight quality applications include the initial mobile tier and stress transitions. A preceding 164-second desktop/laptop/tablet/mobile sweep sampled 894 frames without a black sample. Viewport screenshots supplement the 12×8 pixel grid; sparse sampling cannot guarantee an unobserved frame on every device.

The development Strict Mode replay initially revealed a duplicate manual root. Deferring allocation by one animation frame lets replay cancel before creation. A fresh development load then had one renderer/configuration and no new warnings. Hot module replacement may require a full reload after renderer-source edits; production does not use HMR.

Browser checks: Chromium in the Codex in-app browser, actual WebGL rendering at the four sizes above, real wheel/drag, cloud hit-volume inspection, internal wheel/End scrolling, Escape/focus return, Enter activation, Back/Forward, all surfaces and guarded WebGL failure. Document/canvas bounds are 1440×900 on desktop and document height 844 at 390×844, with no outer overflow. Normal visits contain no diagnostic output. Console inspection returned no warnings/errors. Static asset HTTP checks passed.

Safari was available intermittently: an earlier integration rendered WebGL and its audit recorded 47 nonblack samples, but background visibility throttling and native-control timeouts prevented a complete final Safari run. The temporary developer preference was restored and verified off. Chrome's separate native window was in use and control was interrupted; no final native Chrome result is claimed. Firefox was not installed. Physical mobile pinch and live OS reduced-motion emulation were not completed; touch/pinch, reduced-motion and preference changes have deterministic component coverage.

## Automated checks and boundaries

`npm run check` passed (ESLint, strict TypeScript and production static export). `npm test` passed 54 tests, including original audio/content coverage and camera bounds, fast-travel collision clipping, touch pinch, free input after focus, portrait visibility, every cloud puff's drifting volume, plant exclusion, stable resources through quality changes and black-frame capture classification. Test counts are not visual-quality evidence.

The external private-content audit found one normalization-only false positive spanning ordinary source tokens `from.y; const`; manual source inspection confirmed no excluded name. Audio component, source configuration and audio tests are unchanged. No day/night, location, playlist, mode selector or runtime service was added.

Deployment uses the existing verified GitHub Pages workflow and only `out/`. The final commit and live deployment are recorded in the task handoff.
