# Object refinement

Own LandmarkModels.tsx and a new ReflectiveObject.tsx only. Preserve existing major original structures. Strengthen glossy white/blue plastic and glass edges, restrained gold, clean reflections, localized hover response. Use world.lighting.windowIllumination, lampEnabled/lampIntensity for illumination defaults. Type LandmarkId now covers about/contact too. Add distinct small forms for these routes: a reflective sculptural desk object for About and a compact correspondence kiosk for Contact. Parent adds configs/placement and wrappers.

Add ReflectiveObject as a decorative draggable reflective small object at [-12,2.5,13] by default. Rotation is pointer delta with capture, bounded pitch and speed, damping after release, no position or scale growth. Touch must retain vertical pan-y; use tap feedback on touch if capture would conflict. Props runtime:MutableRefObject<SceneRuntime>, paused:boolean, quality:QualityTier. runtime.dragging and dragCount track only deliberate rotation. Prevent click propagation to water/navigation during drag; clean cancellation/blur. No full physics dependency. A keyboard focusable DOM counterpart for rotation will be added by parent if needed; accept optional runtime values or document integration.

The distant signal moves from z=-17 to about z=-42 in parent config. Its emissive pulse on selection should be restrained, localized and disabled when paused. No unrelated hover changes.

Typecheck and commit only owned files. Do not copy third-party code/models. Report exact integration/export signature and tests. Parent conducts browser review.
