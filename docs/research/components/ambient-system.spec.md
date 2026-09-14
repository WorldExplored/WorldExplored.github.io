# Landscape and ambient system

`AmbientSystem.tsx` and `Water.tsx` export components with `{ runtime, paused, quality }` props: a mutable `SceneRuntime` ref, a boolean and a `QualityTier`. `terrain.ts` provides shared geometry helpers. [world.ts](../../../src/content/world.ts) defines current camera poses, island transforms, colors, environment speeds and quality settings. Sky, scene lighting, camera and landmark architecture belong to other modules.

## Landscape

Use original procedural geometry throughout the active scene. The original habitat illustration supplies only the static fallback. Water lies at `y = 0`; island dimensions and elevation come from world configuration. Preserve the architecture's established base heights and keep clear areas around the observatory and pavilion, with at least a 3.4-unit radius, and the signal, with a 1.5-unit radius.

Terrain has smooth, gently domed green surfaces, varied shore contours, narrow warm sand or stone edges and rounded rocks. The underside remains underwater. Distant hills use cooler greens and haze; foreground islands, reeds, flowers and rounded groves establish parallax. Avoid flat floating discs, faceted cones and trees that obscure the landmarks.

White and cyan arched pedestrian bridges connect the observatory to research and research to the pavilion. Their approximately one-unit-wide decks rise gently toward the center, with thin continuous rails and shared geometry. Repeated posts must not dominate the draw budget.

## Ambient life

Grass, flowers, rocks, foliage, cloud puffs and decorative bubbles use shared geometry or instancing. Seed positions deterministically during initialization. Plants follow the terrain and respect architecture clearances. Shader wind bends blade tips while leaving their bases planted; avoid per-frame CPU loops over vegetation.

Quality tiers supply grass, cloud, bubble and particle counts. White cloud clusters occupy several distant layers and drift at different slow speeds. Each cluster shares a wrap origin and speed, so every puff and vertex receives the same translation when the cluster crosses the distant boundary. Rounded silhouettes must remain intact during wrapping.

Decorative bubbles use smooth translucent Fresnel shading, several depths, restrained floating motion and gentle pointer repulsion. They are separate from the six tactile physics bubbles. Small warm-white atmospheric points may brighten on landmark hover; they should read as sunlight, not confetti or stars.

## Water and lifecycle

Water spans at least 180 units and fades into a misty horizon. Analytic waves, fine highlights, a reflective sky gradient and restrained caustics provide movement without a full reflection or refraction pass. Low quality reduces wave detail while retaining the composition.

A water click stops event propagation and updates the shared ripple position, elapsed-time origin and serial. Ignore pointer travel above five pixels and all clicks while paused. The expanding ring fades over 2.5 seconds.

Paused frames preserve the current scene and return before updating uniforms or transforms. Static accessibility/failure modes bypass the scene entirely. Create and dispose owned resources predictably; use no per-frame React state, vectors, arrays or layout measurements. Keep product copy and navigation in HTML.

The environment and water target fewer than 40 draw calls and approximately 90,000 triangles at high quality, before additional shadow passes. Verification covers finite geometry, ripple/drag handling, pause behavior, tier costs, shader compilation and rendered desktop/mobile appearance.
