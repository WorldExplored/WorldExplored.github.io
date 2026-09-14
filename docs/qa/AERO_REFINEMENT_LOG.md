# Aero refinement verification — 14 September 2026

The baseline was commit `377b581`. This log describes the subsequent refinement. Earlier 2D and 3D logs/screenshots are historical, including their retired view controls, dialogs and bubble system.

## Visual passes

1. Inspected the deployed baseline and the first revised export at 1440 × 900, 768 × 1024 and 390 × 844. Canonical connected surfaces and glossy controls worked. The review found weak white identity text against clouds, clipped portrait landmarks, foreground object placement issues, a connector selector error, and a Back control that scrolled away.
2. Changed identity to navy humanist typography, strengthened sky color, fitted portrait overview and destination cameras, moved foreground landmarks inward, made Back sticky and repaired connector measurement. Reinspected desktop, tablet Research and mobile Contact/Research/overview. The selected mobile structure remained above its surface; reading widths and full contact targets fit without horizontal overflow.
3. Removed overlapping sculpture geometry, pushed distant fog beyond the portrait camera, extended the water past its visible boundary, corrected deep-link scroll alignment and connector updates, and verified all section arrivals. Replaced unavailable embedded video playback with the creator-published licensed audio through a compact native control. Reinspected the final mobile overview and Research layout; direct hash starts at scroll zero and the music controls fit.

No foreground fog overlay, backdrop filter, mode selector, static island fallback, duplicate section body or expandable duplicate contribution collection remains. Each interface surface uses a crisp edge, top highlight, gradient body and defined shadow. Source Sans 3 is self-hosted under OFL.

## Browser evidence

- Desktop 1440 × 900: steady 60 FPS in multiple samples over more than 50 seconds, 92 draw calls and 138138 rendered triangles in the overview. Observed automatic DPR reductions during interaction and recovery. Reading frames report zero continuous FPS and frozen elapsed time through demand rendering.
- Water click incremented only the ripple counter; reflective drag incremented its drag counter; cloud/plant proximity incremented their respective counters. Keyboard focus on Research exposed only that landmark label. Subsequent dock navigation left all environmental counters unchanged.
- Work, Research, Purdue, About and Contact revealed exactly one canonical section at the corresponding camera pose. The distant lamp was also reached through its keyboard link and showed only the teaser.
- Back to world, Escape, direct Research/Contact hashes and browser Back/Forward worked. Focus moved to Back and returned to the initiating dock control. Long Work content used native scroll; Back remained at about 12 px from the viewport top.
- Whole contribution anchors measured 586 px wide and 217–241 px tall on desktop; points inside their outer corners resolved to the card anchor. The five PR statuses and authors were rechecked through GitHub; the co-developed entry remains attributed accordingly.
- Mobile 390 × 844: dock and Contact links were accessible, all destinations worked, and document width remained 390 px. Tablet 768 × 1024 showed a 429 px Research surface with the book and surrounding world visible. Responsive viewport checks do not claim physical touch-device testing; touch cancellation/scroll preservation is covered by component events.
- Guarded initialization failure at `?scene=unavailable#contact` exposed semantic Contact with email, GitHub and LinkedIn. No static island or canvas-only content dependency remained. Static export tests verify all sections without JavaScript.
- Music: no initial source/request; intentional Play reached Playing and advancing time; Mute, Pause, Unmute, resume and Close were verified against native media state. Source cleared and focus returned on Close. See `../research/AUDIO_REVIEW.md`.
- The fresh local verification tab reported no console or shader errors after the connector fix.

## Automated checks

`npm run check` passed ESLint, strict TypeScript and the Next.js static export. `npm test` passed 33 tests. Coverage includes 24/60/120 FPS bounded rotation, capture/cancel/blur/pause, local environment responses at all three tiers, finite landmark geometry, camera arrival/cancellation, water input/decay, all preference-policy combinations, preference change subscriptions/cleanup, source integrity, canonical semantic HTML and licensed audio source guards.

An external audit derived 12 exclusion criteria from the private request and passed source, metadata, export, filenames, normalized/escaped/entity and encoded-text checks. The criteria are not stored in the repository.

## Limits and publication

Reduced motion is covered by preference subscriptions, frozen scene behavior and immediate camera-arrival tests. Native Safari preference emulation could not be completed because native app access became unresponsive. The developer-tools setting was temporarily enabled with user approval; restoration was requested after the app connection failed. Forced colors and Save-Data have policy coverage, not a physical-device browser claim.

The existing GitHub Pages workflow remains unchanged and runs the release checks before uploading `out/`. Exact deployed commit, observed asset paths, live screenshots and final browser findings are recorded in the external handoff after publication. Third-party music hosting and physical mobile hardware remain external dependencies.
