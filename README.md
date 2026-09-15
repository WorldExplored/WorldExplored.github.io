# Srreyansh Sethi

Personal portfolio: [worldexplored.github.io](https://worldexplored.github.io).

An original Frutiger Aero landscape with semantic portfolio content. Work, Research, Purdue, About and Contact share a five-item dock and matching spatial destinations. Camera approaches reveal one canonical HTML surface connected to its landmark. Native scrolling, links, keyboard focus and browser history remain available.

## Development

Use Node 24 or newer and the checked-in lockfile.

```sh
npm ci
npm run dev
npm run check
npm test
```

`check` runs ESLint, strict TypeScript and the Next.js static export. Tests cover content, preference subscriptions, camera arrival/cancellation, localized environmental input, bounded object rotation, water and optional audio. Preview `out/` with `npm start`.

React/React DOM 19.2.8, Fiber 9.7.0, Drei 10.7.8 and Three 0.182.0 remain pinned. Keep the lockfile with dependency changes and test them in a browser. Foreground bubble physics and its dependency have been removed.

## Editing

- `src/content/profile.ts`: verified copy, contact destinations, availability, public contribution curation and section IDs. The source snapshot retains authored history; the public collection includes only selected Open/Merged work and the attributed co-developed contribution.
- `src/content/world.ts`: landmarks, overview framing, terrain, quality tiers and the centralized `lighting` configuration. Sky, horizon, sun, ambient light, fog, water, windows, lamp and clouds are controlled here. No time or location system is implemented.
- `src/content/audio.ts`: approved source, license evidence and player labels. A null source renders no player or requests.
- `src/components/SectionContent.tsx`: the single semantic presentation of each section. Add a renderer, icon, configuration and tests when adding a section.
- `src/components/world/`: procedural architecture, vegetation, clouds, water, camera, bounded rotation and renderer policies.
- `src/app/globals.css`: humanist typography, layered interface surfaces and responsive placement. Source Sans 3 is self-hosted with its SIL Open Font License under `src/app/fonts/`.

`npm run sync:github` refreshes the source snapshot during maintenance. Review its diff and the curated public collection before publishing. Visitors make no GitHub API requests.

## Runtime

A guarded WebGL2 initializer creates a client-only Fiber root. Context denial/loss or an initialization error leaves semantic navigation and content over a simple designed background. No separate island screenshot or view selector is shipped. Without JavaScript, all canonical sections remain readable in document flow.

Empty-world dragging orbits, right-drag pans, wheel zoom follows the cursor and pinch zooms. Pointer motion adds bounded parallax. Destination selection uses a cancellable 800 ms approach, then leaves the camera free. Close and Escape return to overview and restore focus. The enhanced document occupies one viewport; long content scrolls inside its keyboard-focusable surface with a hidden scrollbar. Hashes and browser history remain available.

Reduced motion automatically freezes ambient motion and removes camera flights while retaining the world. Forced colors and Save-Data use semantic fallback. Hidden canvases stop rendering; reduced motion uses demand rendering. Reading surfaces preserve ambient rendering and world input. Quality tiers reduce detail and DPR while preserving landmarks; declines have an eight-second cooldown. Desktop DPR caps at 1.75 and mobile at 1.25.

Every visible cloud uses ray-tested puff ellipsoids synchronized with drift and deformation. Plant placement excludes architecture, paths, rocks, trees and shoreline with a motion margin; responses remain local to the pointer. Water clicks alter material normals and highlights. A reflective sculpture supports bounded mouse/pen rotation, touch feedback and keyboard activation. Only a few small distant decorative motes remain.

Music stays silent and makes no player requests until Play. The native player streams the creator-published licensed audio file, with no video embed; close clears the source. Source, creator and license credit accompany playback. Third-party availability can vary.

## Publication and evidence

The existing GitHub Actions workflow verifies the repository and publishes only `out/` to GitHub Pages. This root user site has no repository-name base path or runtime service.

See `docs/qa/ARCHIPELAGO_LOG.md` and `design-system/srreyansh-sethi/MASTER.md` for the current coastal world and verification. Earlier iteration logs and images are historical evidence. Development-only `?vegetation` shows land coverage and structural exclusions. `?diagnostics` shows local renderer/input counters; `?scene=unavailable` exercises guarded initialization failure. Neither sends telemetry.

Procedural scene assets are original. Reference-site branding and artwork are not reused. Existing scaffold utilities retain their MIT notice in `LICENSE`.
