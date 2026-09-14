# Landmark architecture

`LandmarkModels.tsx` exports `LandmarkModel({ id, active, runtime, paused, quality })`. Types come from [world.ts](../../../src/content/world.ts): `LandmarkId`, `QualityTier` and a mutable `SceneRuntime` ref. The enclosing landmark supplies its configured world position and event handlers. Current camera poses, label anchors, transforms and palette also live in world configuration.

Models contain no DOM, product copy, navigation, scene lights or environment setup. Preserve the established terrain base heights. Every form must remain legible in overview, close-up and mobile views.

## Four distinct forms

| Landmark | Architectural intent |
| --- | --- |
| GPU Observatory | A roughly seven-unit-wide glass dome on a stepped white plinth with an illuminated aqua skirt. Four polished ribs define the hemisphere. A lime GPU chip with metallic contacts and three slim server columns remain visible inside. Fine orbital rings, moving pulses, a camera-facing entrance and short steps establish its technical purpose. |
| Research Lagoon | A roughly 4.5-unit-wide open book in glass and porcelain on a circular lagoon platform. Curved pages rise from the spine, with four thin layers per side, an aqua cover and fine parallel page lines. Two restrained orbital arcs and a moving cyan bead provide local life without embedded text. |
| Purdue Pavilion | A rounded open pavilion with a stepped porch, six white columns and simple capitals. A shallow gold dome, white rim, inlaid band and small finial give it a distinct warm accent. The architecture is abstract and uses no official logo or additional affiliation claim. |
| Distant Signal | A slender white tower with a circular base, cyan glass lens and rings near its top. A restrained occasional light sweep and small moving light suggest activity. The model contains no project details or text. |

## Materials and movement

Use original procedural geometry and the world palette: porcelain, transparent aqua glass, cyan, lime and restrained gold. Smooth rounded forms, clearcoat and polished surfaces provide the Aero character. Transparency must preserve interior silhouettes; avoid expensive transmission passes and flat low-poly forms.

Hover or active state brightens trim and emissive material with approximately 180 ms damping. Any scale feedback is limited to 1.02; model bases never move. Ambient signals use the shared elapsed time. Paused frames freeze transforms and materials without resetting them. Static/reduced-motion modes bypass the models.

## Resource and verification contract

Share or merge repeated pins, columns, page lines and other geometry. Reuse materials by role, adapt curve segment counts to the selected quality tier and retain smooth silhouettes at low quality. Principal opaque structures may cast shadows; transparent glass must not cast an opaque black shadow. Avoid extra point lights.

Target fewer than 140 architecture draw calls before shadow passes and fewer than 180,000 triangles at high quality. Dispose owned geometry and materials on unmount. Use no per-frame React state, temporary vectors or geometry creation.

Verification covers finite geometry, material/shader startup, pause and hover states, resource costs, clear landmark silhouettes and camera views at every supported layout. Measured browser results belong in the QA record, separately from these design targets.
