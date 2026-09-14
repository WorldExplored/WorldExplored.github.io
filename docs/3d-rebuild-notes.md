# Aero habitat: 3D rebuild

## Research and decisions recorded before implementation — 14 September 2026

The baseline at c9ffcbda uses one 1672 × 941 WebP, zero canvases, two CSS bubbles and a 6 × 4 pixel image offset. Camera movement cannot change occlusion, light, reflections or the relation of foreground to architecture. Desktop, 768 px tablet and 390 px mobile inspections confirm this. Preserve its Segoe UI/Trebuchet typography, navy text, glossy dock, verified source record and static export.

### Reference findings

- [Bruno Simon](https://bruno-simon.com/): a recognizable object, a lit boundary and a handwritten start cue establish an actionable focal point. The entry scene visibly changes lighting while idle. Our inference: silhouette and local feedback can make landmarks legible; driving and an entry gate would delay portfolio access, so omit both.
- [Ryo Lu](https://ryo.lu/): immediate ordinary links coexist with an optional expandable desktop. The desktop exposes named applications, Close/Minimize and a persistent menu. Adopt the familiar recovery and window hierarchy, without its branding or application replica.
- [Stripe globe](https://stripe.com/blog/globe): the authors describe animation budgeting, pausing ambient work during scrolling, and resolution-related bottlenecks. Use a measured renderer budget and pause environmental work while reading. Preserve native scrolling and degrade detail before removing navigation.
- [David Heckhoff](https://david-hckh.com/): the workspace and character persist through a scroll transition; About/Projects/Contact remain visible. Adopt camera continuity and direct navigation. Our own architecture and materials remain original.
- [Lusion](https://lusion.co/): the current homepage places an interactive material study beside ordinary headings and a scroll cue, then leads into indexed project links. Use continuous visual feedback without hiding the evidence behind the effect.
- [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas), [events](https://r3f.docs.pmnd.rs/api/events), [testing](https://r3f.docs.pmnd.rs/api/testing), [scaling](https://r3f.docs.pmnd.rs/advanced/scaling-performance): keep the renderer client-only, use an error boundary and static fallback, demand rendering when stopped, instancing, pointer capture, and component event tests. Official source documents were read when the documentation frontend could not be fetched.
- [Drei performance monitor](https://drei.docs.pmnd.rs/performances/performance-monitor), [AdaptiveDpr](https://drei.docs.pmnd.rs/performances/adaptive-dpr), [controls](https://drei.docs.pmnd.rs/controls/introduction): average frames over multiple windows, use hysteresis and a stable floor, lower DPR while moving, and bound optional camera controls. Guided scrolling stays outside controls.
- [Rapier](https://pmndrs.github.io/react-three-rapier/): v2 supports Fiber 9/React 19; use only six ball colliders with sleeping and bounded restitution. Decorative bubble instances do not need physics.
- [Three instancing](https://threejs.org/docs/pages/InstancedMesh.html), [LOD](https://threejs.org/docs/pages/LOD.html), [renderer statistics](https://threejs.org/docs/pages/WebGLRenderer.html), [shadows](https://threejs.org/docs/pages/DirectionalLightShadow.html), [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): share repeated geometry, use tier counts and segment counts, restrict shadows to one sun, prefer clearcoat/Fresnel over expensive full-scene refraction, report calls and triangles. Preserve major silhouettes across tiers.
- [MDN WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): canvas alone cannot expose the portfolio semantically. Render all content as HTML first. Reduced motion, forced colors and Save-Data bypass WebGL and continuous animation entirely.

### Material use of the local toolkits

Both source directories are read-only. Exact names: `ai-website-cloner-template` and `ui-ux-pro-max-skill-main`.

The cloner README, AGENTS, clone-website skill and inspection guide supply the workflow: inspect actual DOM and computed styles, sweep behavior and breakpoints, write durable component specifications, establish a compiling foundation before parallel component builders, and compare multiple rendered iterations. This is an original redesign; its default instruction to copy assets and third-party text does not apply. No reference code, models, fonts or branding are imported. Existing original icons and fallback illustration remain.

UI/UX Pro Max's README, main skill, quick reference, search entry point, and relevant Three.js/UX records guide the five-label dock, 44 px targets, visible focus, modal recovery, native vertical touch scroll, motion preference, geometry reuse and pausing hidden rendering. Its actual design-system search selected Spatial UI and explicitly flagged blur/contrast costs; focused searches identified no per-frame geometry creation and scroll-sensitivity concerns. The generic gray palette and project grid are rejected in favor of the requested Aero palette and real terrain. Its gesture example's preventDefault is not used on vertical scrolling. The requested 800 ms flight and layered ambient life intentionally supersede generic 400 ms/two-element animation defaults.

## Final architecture

### HTML and navigation

`Habitat.tsx` renders identity, source links, section headings, full content and ordinary hash anchors before the dynamic scene bundle loads. `SectionContent.tsx` is the single section renderer: opening a panel temporarily replaces the corresponding field-guide body with a height placeholder, so its text is not duplicated. The original WebP remains the loading and static scene.

`navigation.ts` shares hash/history state across dock links, landmark signs, scene clicks and panel navigation. `CameraDirector.tsx` interpolates position and look target with bounded easing over 800 ms, uses a serial to cancel superseded flights, and opens the native HTML dialog after arrival. Initial deep links and unavailable scenes expose content immediately. Paused navigation arrives without animation. Close, Minimize, Escape and backdrop dismissal clear the selected destination; Return to overview also resets the native scroll position. Focus moves to Close and returns to the initiating control, with a visible keyboard focus indicator.

Page scrolling is native. Section positions are measured on setup/resize, and a passive scroll listener interpolates progress through the guided route. The frame loop does no layout reads. Free Explore increases bounded desktop pointer offsets; it does not add wheel zoom, drag orbit or mandatory keyboard movement. The camera keeps a stable up vector and bounded height. Mobile retains `touch-action: pan-y`, fixed semantic landmark controls and the complete vertical field guide.

### Guarded renderer and scene modules

`WorldCanvas.tsx` owns an ordinary canvas and a manual Fiber `createRoot`. A guarded `getContext('webgl2')` runs before renderer construction; denied/throwing context creation, initialization rejection, context loss and the scene error boundary all invoke the HTML/static fallback. Root reconfiguration is serialized, and cleanup unmounts the root and removes observers/listeners. A ResizeObserver measures the parent host; CSS keeps the canvas at `100% !important` so renderer-written pixel dimensions cannot lock its size after a viewport change.

`AeroWorld.tsx` composes sky, haze, one shadow-casting sun, a one-frame local environment map and the scene modules:

| Module | Responsibility |
| --- | --- |
| `CameraDirector.tsx` | Guided route, cancellable destination flights, pointer offsets and arrival callback |
| `Landmark.tsx` / `LandmarkModels.tsx` | Hit targets, shared navigation, local feedback and four original architectural forms |
| `AmbientSystem.tsx` / `terrain.ts` | Smooth islands and hills, bridges, rounded groves, instanced grass, flowers, rocks, clouds and decorative bubbles |
| `Water.tsx` | Analytic waves, highlights and finite click ripples with reduced detail at low quality |
| `InteractionField.tsx` / `bubblePhysics.ts` | Six tactile bubbles, pointer capture, bounded drag/release velocity, collision and cancellation |
| `QualityController.tsx` | Tier degradation, DPR, explicit rendering and opt-in local statistics |
| `preferences.ts` / `navigation.ts` | Stable browser preference and location snapshots for React |

Repeated scene elements share procedural geometry and materials; per-frame movement updates Three.js objects and uniforms rather than React state. Scene-owned geometry/materials are disposed on cleanup. Rounded foliage and coastal contours add an intermediate depth layer while keeping the main architecture bases unchanged. Sky and water shaders bypass ACES tone mapping to retain their saturated palette; lit metal and porcelain materials retain the renderer's ACES lighting response. Gloss uses clearcoat, Fresnel rims and the small generated environment map, without a postprocessing chain or full-scene refraction.

### Quality and suspension

| Tier | Nominal DPR ceiling | Grass blades | Cloud clusters | Decorative bubbles | Light particles | Sun shadows | Water detail |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| High | 1.75 | 2,000 | 24 | 26 | 80 | On | 1.00 |
| Medium | 1.35 | 1,100 | 16 | 18 | 40 | On | 0.65 |
| Low | 1.00 | 450 | 10 | 10 | 18 | Off | 0.35 |

Actual DPR also respects the device scale and a mobile cap of 1.25. Temporary performance regression during camera movement reduces DPR within the selected tier, with a floor of 0.75. Camera motion settling restores that tier's normal resolution.

Runtime tiers only move downward during a mounted scene. PerformanceMonitor samples frame rate across 500 ms windows; a decline below 38 FPS can lower one tier, subject to an eight-second cooldown. Good samples do not automatically upgrade quality. The monitor's flipflop fallback is deliberately omitted: counting successful inclines toward a fallback could otherwise force low quality during a healthy 60 FPS session. This hysteresis prevents frequent tier changes without penalizing stable rendering.

Document visibility and canvas intersection control the root frame loop: hidden/offscreen uses `never`; Pause and open panels use `demand`; the active scene uses `always`. Open panels and Pause freeze elapsed ambient time, water, vegetation, bubbles and physics. Camera navigation under Pause is immediate. An offscreen mobile scene consumes no continuous rendering while its field guide is read.

Reduced motion, forced colors, Save-Data and manual Static view bypass WebGL and all camera, ambient and physics channels. WebGL denial or runtime failure uses the same readable fallback. The canvas is `aria-hidden`; semantic HTML carries destinations and content. With JavaScript disabled, the complete exported document and native anchors remain available. Forced colors uses system surfaces and boundaries.

### Dependency compatibility

The current lockfile pins React/React DOM 19.2.8, Fiber 9.7.0, Drei 10.7.8, Three and its types 0.182.0, and React Three Rapier 2.2.0. React remains within Fiber's supported peer range. Three's revision is held with its matching types rather than adopting a newer revision that introduces deprecation noise in this stack.

The scoped npm override selects `@dimforge/rapier3d-compat` 0.20.0 beneath React Three Rapier. It fixes the upstream deprecated initialization signature while preserving the wrapper's API. Keep the override and lockfile together; dependency updates require clean browser startup, interaction/physics checks and the test suite, not just peer resolution. No peer-dependency bypass is used.

## Editing and extending

`src/content/profile.ts` owns public copy, education, links, availability, contribution evidence and section labels. Preserve the full authored PR list and the separately attributed co-developed work; `additionalContributions` removes featured authored PRs from the displayed additional list. Use `profile.additions` for another entry under an existing section. Review public source evidence when changing statuses or attribution; do not infer results from a PR title.

`src/content/world.ts` owns scene transforms, camera poses, timing, palette, environmental speeds and quality settings. Geometric details stay in their respective scene modules; UI surfaces and responsive placement stay in `src/app/globals.css`.

For a new section:

1. Extend the stable section ID/configuration, semantic renderer and icon. Add verified copy and links first.
2. Confirm native anchors, dialog focus, Escape, back/forward and static content before adding a model.
3. If a spatial destination is useful, add its landmark type/configuration/model and matching DOM control. Update the explicit section/progress mapping in `WorldCanvas.tsx`, camera sequencing, desktop sign anchor and mobile/fallback placement.
4. Extend content and scene-event tests. Inspect every viewport and preference/failure state, and check the renderer budget. A new landmark must remain discoverable without WebGL.

All active landscape models, geometry and shaders are original procedural assets. The original fallback illustration and icons remain; no reference-site asset pack, model, font or branding is reused. Existing scaffold utilities retain their MIT notice in `LICENSE`.

## Verification before publication

Use `npm run check`, then `npm test`. The latter covers content/export integrity and focused R3F behavior: camera arrival/cancellation, paused navigation, semantic landmark events, water ripple/drag handling, preference policy, bounded easing/tier transitions and bubble release limits. These component tests do not replace browser shader, visual or input verification.

`?diagnostics` displays local FPS, calls, triangles, DPR, tier, frame/time, camera, ripple and drag values. It sends no telemetry. `?scene=unavailable` exercises context-initialization fallback. Capture measured values after warm-up and at least 20 seconds of idle observation; distinguish actual renderer statistics from theoretical geometry totals.

The [3D iteration log](qa/3D_ITERATION_LOG.md) records all command results, measured renderer statistics, screenshots, refinement decisions and the ten-category review. ESLint, strict TypeScript, the production export and all 20 tests pass. A separate audit reads private exclusion criteria outside the repository and checks source/export representations without publishing those criteria.

Browser checks verify desktop, tablet and mobile composition, native scrolling, camera/landmark/water/bubble input, keyboard wrapping, modal focus, Escape, history, direct hashes, Still view and guarded WebGL failure. The release review leaves the native-browser reduced-motion/forced-colors emulation explicitly unverified after browser control interruptions/timeouts. Save-Data is policy-tested. Physical mobile hardware, unrestricted exploration and full-scene water reflections are not claimed.

The original GitHub Pages workflow remains the publication path and repeats the build and tests on the pushed revision. Public URL and exported assets must be checked after the workflow succeeds.
