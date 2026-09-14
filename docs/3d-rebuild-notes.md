# Aero habitat: 3D rebuild

## Research and decisions recorded before implementation — 14 September 2026

The baseline at c9ffcbda uses one 1672 × 941 WebP, zero canvases, two CSS bubbles and a 6 × 4 pixel image offset. Camera movement cannot change occlusion, light, reflections or the relation of foreground to architecture. Desktop, 768 px tablet and 390 px mobile inspections confirm this. Preserve its Segoe UI/Trebuchet typography, navy text, glossy dock, verified source record and static export.

### Reference findings

- [Bruno Simon](https://bruno-simon.com/): a recognizable object, a lit boundary and a handwritten start cue establish an actionable focal point. The entry scene visibly changes lighting while idle. Our inference: silhouette and local feedback can make landmarks legible; driving and an entry gate would delay portfolio access, so omit both.
- [Ryo Lu](https://ryo.lu/): immediate ordinary links coexist with an optional expandable desktop. The desktop exposes named applications, Close/Minimize and a persistent menu. Adopt the familiar recovery and window hierarchy, without its branding or application replica.
- [Stripe globe](https://stripe.com/blog/globe): the authors describe animation budgeting, pausing ambient work during scrolling, and resolution-related bottlenecks. Use a measured renderer budget and pause environmental work while reading. Preserve native scrolling and degrade detail before removing navigation.
- [David Heckhoff](https://david-hckh.com/): the workspace and character persist through a scroll transition; About/Projects/Contact remain visible. Adopt camera continuity and direct navigation. Our own architecture and materials remain original.
- [Lusion](https://lusion.co/): the current homepage places an interactive material study beside ordinary headings and a scroll cue, then leads into indexed project links. Use continuous visual feedback without hiding the evidence behind the effect.
- [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas), [events](https://r3f.docs.pmnd.rs/api/events), [testing](https://r3f.docs.pmnd.rs/api/testing), [scaling](https://r3f.docs.pmnd.rs/advanced/scaling-performance): use client-only Canvas, an error boundary and static fallback, demand rendering when stopped, instancing, pointer capture, and component event tests. Official source documents were read when the documentation frontend could not be fetched.
- [Drei performance monitor](https://drei.docs.pmnd.rs/performances/performance-monitor), [AdaptiveDpr](https://drei.docs.pmnd.rs/performances/adaptive-dpr), [controls](https://drei.docs.pmnd.rs/controls/introduction): average frames over multiple windows, use hysteresis and a stable floor, lower DPR while moving, and bound optional orbit controls. Guided scrolling stays outside controls.
- [Rapier](https://pmndrs.github.io/react-three-rapier/): v2 supports Fiber 9/React 19; use only six ball colliders with sleeping and bounded restitution. Decorative bubble instances do not need physics.
- [Three instancing](https://threejs.org/docs/pages/InstancedMesh.html), [LOD](https://threejs.org/docs/pages/LOD.html), [renderer statistics](https://threejs.org/docs/pages/WebGLRenderer.html), [shadows](https://threejs.org/docs/pages/DirectionalLightShadow.html), [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): share repeated geometry, use tier counts and segment counts, restrict shadows to one sun, prefer clearcoat/Fresnel over expensive full-scene refraction, report calls and triangles. Preserve major silhouettes across tiers.
- [MDN WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): canvas alone cannot expose the portfolio semantically. Render all content as HTML first. Reduced motion, forced colors and Save-Data bypass WebGL and continuous animation entirely.

### Material use of the local toolkits

Both source directories are read-only. Exact names: `ai-website-cloner-template` and `ui-ux-pro-max-skill-main`.

The cloner README, AGENTS, clone-website skill and inspection guide supply the workflow: inspect actual DOM and computed styles, sweep behavior and breakpoints, write durable component specifications, establish a compiling foundation before parallel component builders, and compare multiple rendered iterations. This is an original redesign; its default instruction to copy assets and third-party text does not apply. No reference code, models, fonts or branding are imported. Existing original icons and fallback illustration remain.

UI/UX Pro Max's README, main skill, quick reference, search entry point, and relevant Three.js/UX records guide the five-label dock, 44 px targets, visible focus, modal recovery, native vertical touch scroll, motion preference, geometry reuse and pausing hidden rendering. Its actual design-system search selected Spatial UI and explicitly flagged blur/contrast costs; focused searches identified no per-frame geometry creation and scroll-sensitivity concerns. The generic gray palette and project grid are rejected in favor of the requested Aero palette and real terrain. Its gesture example's preventDefault is not used on vertical scrolling. The requested 800 ms flight and layered ambient life intentionally supersede generic 400 ms/two-element animation defaults.

### Implementation contract

Four distinct positions: observatory west, lagoon foreground, pavilion east, signal behind. Model the architecture as curved porcelain, glass and luminous technical details; connect the sites with arched bridges. Water, rounded terrain, distant haze and foreground plants give measurable perspective and occlusion. No asset packs or postprocessing chain.

Immediate SSR identity and content precede a separately loaded scene. Each 3D landmark and matching semantic control call the same navigation handler. Hash/history state selects a camera target; a cancellable 800 ms flight completes before opening a native HTML dialog. Overview reverses that transition. The static document remains a native-scroll field guide. Panel content is rendered only once at a time, including the single teaser.

Native page scroll moves a bounded camera through a route with a stable up vector. Optional desktop Free Explore has restricted angles and no zoom/pan, plus a visible return action. It never captures vertical mobile scrolling. Pointer motion adds gentle camera parallax, landmarks emit local feedback, water clicks create finite ripples and six bubbles support drag momentum and collisions.

High/medium/low tiers lower DPR, grass/cloud/bubble/particle counts and shadows. Desktop DPR ≤1.75, mobile ≤1.25. Avoid per-frame React state, allocations and layout queries. Hidden pages stop rendering; open panels stop ambient and physics. Development diagnostics expose measured rendering statistics without sending data anywhere.

Compatibility verified against npm: Fiber 9.7.0 requires React >=19 <19.3. Use React/React DOM 19.2.8, compatible with Next 16.3.5, Three 0.186.0, Drei 10.7.8 and Rapier 2.2.0. No peer dependency bypass.

Copy: replace repeated slogans with education, specific vLLM areas and the paper attribution; maintain exact PR evidence; filter featured authored PRs out of Additional authored PRs; About describes the debugging method; Purdue contains education and one context sentence. Keep the confidential-topic exclusion criteria outside the public repository.

## Verification and final architecture

To be completed with measured iteration results before publication.
