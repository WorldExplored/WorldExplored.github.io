# Tactile bubbles

`InteractionField.tsx` exports `InteractionField({ runtime, paused, mobile })`. The runtime is a mutable `SceneRuntime` ref; both other props are booleans. `bubblePhysics.ts` contains pure boundary and release-velocity helpers. The component is placed at the world origin. Current camera poses, bubble bounds and the tactile count live in [world.ts](../../../src/content/world.ts).

## Physics and appearance

Use six tactile bubbles independently of decorative instances. React Three Rapier supplies small ball colliders, zero gravity, a fixed 1/60-second step, sleeping, approximately 0.85 restitution and 1.2 linear damping. Bubbles collide with one another and invisible boundary colliders; no detailed environment collision mesh is needed. Position them in the foreground while preserving the central view.

Smooth translucent cyan spheres use Fresnel rims and white highlights that respond to the camera. Share sphere geometry and material, and dispose owned resources on cleanup. Avoid opaque gray spheres, screen-space refraction and postprocessing. No portfolio content depends on interacting with a bubble.

## Pointer behavior

Mouse proximity applies gentle, bounded repulsion based on distance from the pointer ray. Reuse vectors for ray and force calculations. A grabbed body receives no idle or repulsion force.

Pointer-down captures the selected bubble and establishes a camera-facing drag plane with an initial offset. Pointer movement intersects that plane, constrains the body's center within the configured bounds including its radius, and records a bounded release velocity. Releasing restores dynamic motion, applies momentum and increments `runtime.dragCount`. The release speed is capped at eight world units per second. Stop propagation so dragging cannot activate water or a landmark behind the bubble.

Use `grab` and `grabbing` cursors and restore the canvas cursor after release or cancellation. Pointer cancellation, lost capture, window blur, pause and unmount must release capture and leave no body stuck in a dragged state. `runtime.dragging` suspends camera response while a bubble is held.

Touch preserves native vertical scrolling through `touch-action: pan-y`. It does not capture bubble dragging or prevent the page's vertical gesture. A small tap impulse is optional.

## Suspension and verification

Idle forces provide gentle visible floating motion within bounds and allow sleeping where possible. Pause, open panels and hidden/offscreen rendering suspend physics. Reduced-motion and static modes do not mount the physics scene. Avoid per-frame React state and temporary vector allocations.

Verification covers radius-aware boundaries, release-speed limits, pointer capture and cancellation, momentum/collision behavior, camera stability during dragging, pause behavior and native touch scrolling. Component tests establish numerical behavior; browser interaction checks establish the visible result.
