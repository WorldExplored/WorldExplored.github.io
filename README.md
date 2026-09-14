# Srreyansh Sethi

Personal portfolio: [worldexplored.github.io](https://worldexplored.github.io).

The Aero Research Habitat combines an original real-time landscape with a complete HTML portfolio. GPU Observatory, Research Lagoon, Purdue Pavilion and Distant Signal lead to the same sections as the keyboard-accessible links and five-item dock. The page remains readable without WebGL or JavaScript.

## Development

Use Node 24 or newer and the checked-in lockfile.

```sh
npm ci
npm run dev
```

Run `npm run check` for ESLint, strict TypeScript and the Next.js static export, then `npm test` for content, export, camera, preference and scene-interaction tests. Preview the generated `out/` directory with `npm start`.

React and React DOM are pinned to 19.2.8, Fiber to 9.7.0, Drei to 10.7.8, Three and its types to 0.182.0, and React Three Rapier to 2.2.0. The scoped `@dimforge/rapier3d-compat` override selects 0.20.0 to fix the upstream deprecated initialization signature. Keep these versions and the lockfile together; test dependency upgrades in the browser as well as in TypeScript.

## Editing content and the world

- `src/content/profile.ts`: identity, education, copy, links, availability, featured work, authored PRs and section labels. Add an entry to `profile.additions` for another project, paper or affiliation in an existing section. Set `showAvailability` to `false` to hide availability.
- `src/content/world.ts`: landmark positions and camera targets, flight duration, environment colors and speeds, island dimensions, quality tiers and bubble bounds.
- `src/components/SectionContent.tsx`: semantic section layouts. Featured authored PRs are automatically excluded from “Additional authored PRs”; retain the complete authored source list.
- `src/components/world/`: procedural models, terrain, vegetation, water, camera, interaction and rendering policies. `src/app/globals.css` owns the HTML chrome and responsive layout.

`npm run sync:github` refreshes public contribution metadata during maintenance. Review its diff and rerun checks before committing. Visitors make no GitHub API requests.

For a new section, add its stable ID and configuration in `profile.ts`, provide its `SectionContent` layout and icon, and check native anchors and dialog navigation first. If it also needs a spatial landmark, extend the landmark ID/configuration and model, then update route measurements in `WorldCanvas.tsx`, camera sequencing and fallback label placement. Keep the dock at five primary destinations unless a reviewed navigation change requires otherwise. Extend content and interaction tests, then inspect mobile, keyboard, history and static views.

## Runtime and fallback

HTML content renders before the scene bundle loads. `WorldCanvas` requests a WebGL2 context inside a guarded initializer, then configures a manual Fiber root. Parent-host resize measurements keep the canvas responsive. Context denial, context loss or a scene error returns to the original static habitat illustration.

Native page scrolling drives the guided camera route. Landmark and dock selection share hash/history state; an active scene normally completes an 800 ms flight before opening a native HTML dialog. Free Explore on larger screens expands bounded pointer parallax and provides Return to overview. Touch keeps native vertical scrolling.

High, medium and low tiers reduce resolution and environmental detail. Sustained declines below 38 FPS can lower a tier with an eight-second cooldown; healthy samples never trigger a fallback or automatically upgrade the tier. DPR is capped at 1.75 on desktop and 1.25 on mobile, with temporary reductions during camera motion. Hidden or offscreen canvases stop rendering. Pause and open panels stop ambient animation and physics. Reduced motion, forced colors, Save-Data and the Static view control bypass WebGL; all content and navigation remain available.

For local QA, `?diagnostics` displays renderer statistics and `?scene=unavailable` exercises initialization fallback. These controls send no telemetry.

## Deployment and design record

GitHub Actions runs `npm ci`, `npm run check` and `npm test`, then publishes only `out/` to GitHub Pages. This root user site requires no repository-name base path or runtime service. Update `siteUrl` and review generated canonical, robots and sitemap output when changing domains.

See `docs/3d-rebuild-notes.md` for architecture, toolkit influence and verification; `design-system/srreyansh-sethi/MASTER.md` for the visual system; and `docs/qa/3D_ITERATION_LOG.md` for iteration evidence. Scene geometry and shaders are original procedural work. Reference-site assets are not reused. The original fallback illustration and icons remain, and the MIT-licensed scaffold utilities retain their notice in `LICENSE`.

Automated checks and browser results are recorded in the 3D iteration log, including the outstanding native-browser preference check.
