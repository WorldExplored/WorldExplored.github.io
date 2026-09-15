# Living coastal world verification

Reviewed 2026-09-15 against the preceding deployed revision. The visual review is separate from the behavior suite.

## Changes

Continuous shaded cloud volumes with diagonal wind; articulated gulls and coastal crabs; nine responsive fish schools; ecological planting clusters; incoming broken surf and pooled headland spray. Six landmark assemblies operate inside fixed interaction bounds. The offshore beacon moved west to (-76,-36). City operations include station dwell and departure, rooftop equipment, turbines, a dock-to-dock ferry, maintenance pods and a fountain. Navigation uses a curved aqua shell and five original jewel pictograms.

## Verification

- `npm run check`: ESLint, strict TypeScript and production static export passed.
- `npm test`: 104 tests passed. New coverage includes cloud depth and continuous two-axis travel, wildlife states and safe terrain, fish scatter/recovery, surf distance/exposure, beacon reachability, mechanism envelopes, resource identity, quality reductions and paused movement.
- Production browser review at 1920×1080, 1440×900 and 390×844. Inspected overview, rear islands, beaches, gulls and lighthouse, city infrastructure, all six landmarks, navigation and content.
- Inspected actual production cloud geometry/material from front, side and underside in a private local viewer, plus tall and deep-bank profiles. No viewer files are shipped.
- Watched independent ambient changes; compared city train/ferry/turbine activity across time.
- Renderer capture: 129 seconds, 705 sampled frames, zero black frames, context losses or application errors. One renderer and one configuration survived seven quality transitions. Samples reported approximately 60 fps on the review machine. This is not a device-independent performance guarantee.
- Mobile navigation targets measure approximately 65×66 px with no horizontal page overflow. Native panel scroll, keyboard focus, Escape, direct hashes and browser Back/Forward verified.
- Private production-HTML fixtures exercised unavailable WebGL and unavailable JavaScript. Canonical content and navigation remained usable. A fixture reporting reduced-motion preference produced byte-identical world screenshots across time and immediate destination navigation. No OS preferences changed.
- Touch gesture ownership, pinch, cancellation and absence of stuck hover are covered by component input tests; no physical phone was used.
- All 31 exported files returned HTTP 200 locally. Profile and music source files are unchanged. Private content audit completed; its criteria remain outside the repository.

## Limits

Architecture and wildlife are deliberately stylized. Very close cloud silhouettes show their mesh resolution; fine mechanisms and fauna are easier to see after approaching them. The narrow mobile overview prioritizes the main islands, with distant details requiring exploration. The performance sample is from one desktop browser. Deployment verification is recorded with the release handoff.
