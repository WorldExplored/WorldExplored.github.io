# Environment refinement

Own AmbientSystem.tsx and Water.tsx only. Preserve original terrain/bridges. Strong clear cyan water and greener vegetation, with atmospheric haze only from world.lighting.fogNear/fogFar. All lighting/color values use world.lighting where provided.

Add deterministic local cloud proximity response and plant bending. SceneRuntime now contains pointerActive:boolean and pointerWorld:Vec3 plus cloudInteraction/plantInteraction diagnostic counters. Parent will set normalized pointer only when physically over canvas, and false over UI. Derive a Three ray at cloud heights or screen-space proximity per cluster; keep instanced clouds, bounded deformation, no geometry allocation per frame. Paused freezes every motion. Use existing shader structure.

Remove decorative bubble pointer response. Use few small softened distant bubbles above water, z<-25, y>9, distinct from touchable objects. Parent removes all foreground bubble physics.

Replace white click rings with smooth localized radial disturbance affecting water normals/highlights. Click origin is event.point x/z; UI cannot propagate to canvas. Finite 2.5–3 s decay, no white circle overlay. Respect paused and drag threshold.

Use no public private-project names. Typecheck, focused tests if appropriate, commit only owned changes. Report counters/evidence and quality limits. Parent integrates and visually tests.
