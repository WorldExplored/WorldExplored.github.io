# Coastal future art direction

Baseline: `56b7d21dcd6ba629d2a0e5a4259550b5c156c754`.

## Pixel diagnosis

The seven supplied close-range renders show pale material values collapsing together, repeated opaque city walls, tiny research facilities, disconnected-looking architectural parts, coarse leaf silhouettes, and high-frequency repeated ocean marks. More primitive objects do not solve these problems. Acceptance is based on production pixels at 3–12 m, including the actual structural joins and circulation.

## References and interpretation

- [CARI — Frutiger Aero](https://cari.institute/aesthetics/frutiger-aero): nature and clean consumer technology, saturated blue/green, gloss and visual depth.
- [Microsoft — Vista product introduction](https://news.microsoft.com/source/2006/02/26/microsoft-unveils-windows-vista-product-lineup/): translucent glass, restrained reflection and smooth motion.
- [Microsoft — Windows identity history](https://blogs.windows.com/windowsexperience/2012/02/17/redesigning-the-windows-logo/): XP-era rounded, colorful consumer identity and Vista glass depth. XP landscape imagery informs the saturated blue/green balance, not copied wallpaper assets.
- [WOHA — Kampung Admiralty](https://woha.net/project/kampung-admiralty/): layered civic uses, garden terraces and connected circulation. Gardens need reachable floors, rather than decorative pots outside sealed windows.

Local reference guidance used read-only: `ai-website-cloner-template/docs/research/INSPECTION_GUIDE.md` and its component workflow; UI UX Pro Max `ui-styling/SKILL.md` for shared tokens, visual hierarchy, accessible controls and responsive review. This is an original 3D redesign, not a clone of a reference website.

## Palette and material roles

| Role | Color | Surface |
| --- | --- | --- |
| Technology | `#1262c4` / `#06abc1` | Cobalt enamel, aqua trim; selective gloss |
| Glass | `#124b62` | Recessed transparent glazing with visible mullions |
| Structure | `#edf6ef` | Porcelain shell with contrasting shadow and joints |
| Vegetation | `#287843` / `#58a432` / `#83b92b` | Layered mature/young foliage and limited lime accents |
| Timber | `#986345` | Warm textured decking, furniture and screens |
| Beach | `#cfb785` | Fine sand and rock detail, dark wet transition |
| Promenade | `#ccd7d1` | Pearlescent mineral aggregate, no world-space grid |

Implementation tokens live in `src/components/world/surfaceMaterials.ts`. Stronger directional light and lower ambient/environment fill separate solid surfaces, glass and vegetation.

## Asset provenance and budget

All new imported material maps come from [Poly Haven](https://polyhaven.com/license), licensed CC0:

- [Coast Sand Rocks 02](https://polyhaven.com/a/coast_sand_rocks_02)
- [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01)
- [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck)
- [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006)

`scripts/prepare-surfaces.mjs` prepares 512×512 WebP color, OpenGL normal and packed AO/roughness maps. Exact original download URLs are in `public/materials/sources.json`. Mineral albedo is desaturated and remapped toward pearl; timber is brightened to avoid double tinting. Normal and packed roughness detail remain intact. Only optimized derivatives ship. No reference-site illustration, screenshot or wallpaper ships as a scene asset. New models are authored project-native geometry; they do not acquire quality merely by being packaged as GLB.

Shared material/geometry batches, quality-dependent natural density, staged scene construction, and mipmapped textures retain the existing static export architecture. Detail and performance must both be measured in the browser.

## Audio

Natural recorded coastal layers retain their published licenses. Music playback is unmounted, with the player implementation preserved for a future approved playlist. Brief synthesized servo and interface tones are tied to visible technology events and proximity; they share the gesture-started environmental audio master. They are not a replacement shore bed or continuous science-fiction drone.

## Verification artifacts

Temporary renders, browser metadata, logs and worktrees belong in ignored `.tmp/`. Do not commit another gallery. Geometry and behavioral tests support but do not substitute for close-range review. Record final production and deployed observations separately from design intent.
