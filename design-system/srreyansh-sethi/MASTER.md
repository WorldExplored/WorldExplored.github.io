# Srreyansh Sethi — Aero Research Habitat

## Direction

An original Frutiger Aero landscape: saturated blue sky, clear cyan water, rounded green islands and trees, glossy porcelain, luminous glass and restrained gold. The four landmarks have distinct silhouettes and remain understandable while the camera moves. Foreground vegetation, bridges, distant hills, cloud layers and haze establish depth. Preserve the visible relationship between nature and technical work.

Identity and evidence remain ordinary HTML. State education once in the hero, then give concrete contributions and paper attribution. Section copy adds facts or explains a useful action; omit repeated slogans. Readable content must never depend on a camera maneuver or an unlabelled object.

## Tokens and surfaces

| Use | Token |
| --- | --- |
| Primary / secondary text | `#123a4a` / `#365a65` |
| Reading surface / edge | `#f3fbfa` / `#bbd5d9` |
| HTML action / success | `#007b95` / `#166044` |
| Sky / horizon | `#0875cf` / `#b8edf7` |
| Water / deep water | `#03afc7` / `#00568e` |
| Grass / light grass / dark grass | `#347315` / `#78ab24` / `#306b17` |
| Porcelain / cyan / gold | `#f5fff4` / `#56e4ee` / `#ddb858` |

Keep scene tokens in `src/content/world.ts` and HTML tokens in `src/app/globals.css`. These colors describe the authored materials; scene lighting and tone mapping change their rendered appearance.

Use Segoe UI, Trebuchet MS, Arial and system fallbacks. Body text is generally 15–18 px with generous line height; desktop identity is 52–76 px and scales down on mobile. Reserve monospace for PR identifiers and developer diagnostics.

Glass uses a bright rim, soft navy shadow and restrained backdrop blur. Landmark signs and controls have mostly opaque pale fills; long-form text sits on an opaque paper surface. Gloss comes from coherent highlights and gentle gradients. Sky and water retain saturated shader colors; lit metal and porcelain use ACES tone mapping. Keep text separate from moving detail and maintain at least 4.5:1 contrast for normal text.

## Composition and interaction

Desktop keeps the world behind a native-scroll field guide. Signs project from world anchors, while the five-label dock remains a stable route to Work, Research, Purdue, About and Contact. On mobile, identity precedes the scene and a fixed two-column landmark map; the field guide follows in one column. Do not use hover as the only way to discover a destination.

GPU Observatory, Research Lagoon, Purdue Pavilion and Distant Signal receive distinct forms and local hover/focus feedback. Signs and scene objects call the same navigation state. A cancellable 800 ms flight establishes continuity before a native dialog opens; Close, Escape, history navigation and Return to overview provide recovery. Keep the world visible behind the window and preserve the reader's focus.

Native scrolling drives a stable camera path. Desktop pointer motion adds restrained parallax; Free Explore increases its bounded range without requiring keyboard movement, wheel zoom or drag orbit. Water clicks create a short ripple. Six tactile bubbles support drag, momentum and rebound, while decorative bubbles and plants use instancing and shader motion.

Target 44 px controls, clear focus outlines and descriptive labels. Preserve touch `pan-y`; dragging decorative objects must not capture vertical page scrolling. New interactions need an equivalent HTML route and correct keyboard/history behavior.

## Motion, quality and accessibility

Ambient life includes cloud drift, vegetation sway, bubbles, water highlights and technical pulses. Motion should reveal depth and material, with a slower rhythm than interface responses. Do not add a postprocessing chain or full-scene refraction to achieve gloss.

High/medium/low tiers retain architecture and navigation while reducing DPR, instance counts, water detail and shadows. Cap desktop DPR at 1.75 and mobile at 1.25. Quality declines use an eight-second cooldown and never upgrade automatically; healthy frame samples must not force a downgrade. Pause ambient motion and physics during reading; stop rendering when hidden or offscreen.

Reduced motion, forced colors, Save-Data, manual Static view and WebGL failure use the original static scene and full HTML content. Reduced motion removes flights, continuous motion and physics. Forced colors uses system Canvas/CanvasText surfaces. The canvas is decorative in the accessibility tree; native links, headings, details and dialog controls carry the portfolio.

## Toolkit influence and review

`ai-website-cloner-template` supplies actual-site inspection, durable behavior specifications, a compiling foundation before parallel component work, and repeated rendered comparison. Its default cloning workflow is adapted to an original landscape; reference branding, text and assets are not copied.

`ui-ux-pro-max-skill-main` supplies contrast, focus, target sizing, spatial hierarchy, native touch scrolling and performance guidance. Its search output selected Spatial UI and raised blur/contrast costs. The generic monochrome palette and project grid were replaced with this Aero system. The requested 800 ms camera transition and layered environment take precedence over generic short-animation limits. Detailed research provenance remains in `docs/3d-rebuild-notes.md`.

Every iteration must inspect desktop, tablet and mobile; observe at least 20 seconds of idle behavior; exercise pointer, scroll, landmark, water, drag, keyboard, history and static/reduced states; and inspect console output and renderer statistics. Score depth, life, input response, Aero specificity, discovery, copy, mobile, accessibility, performance and polish from 1–5. Publication requires every category at least 4, with a target of 5 for depth, life, Aero specificity and copy.

The rubric, measured viewports and remaining preference-browser verification are recorded in `docs/qa/3D_ITERATION_LOG.md`.
