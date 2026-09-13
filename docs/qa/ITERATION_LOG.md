# Visual and interaction QA

Date: 2026-09-13. Tested the production static export in a real Chromium browser, with a separate Chrome DevTools reduced-motion check.

## Iteration 01 — Complete first version

Captured 390 × 844, 768 × 1024, 1024 × 768 and 1440 × 900. Inspected the opening landscape, evidence links, content hierarchy and a work panel. Identity and direct evidence were immediately legible. The landscape, glossy icons and label signposts established the original visual direction.

- Major: long panels let the close controls and section navigation scroll out of view. Fixed by separating the scrolling paper body from a fixed panel header and footer.
- Major: compact desktop composition could put Research too low and crop the distant landmark. Fixed the minimum scene height and image framing.
- Minor: mobile guidance and the motion control crowded the fixed dock. Increased scene spacing, then revisited in the next pass.

## Iteration 02 — Panel and composition refinement

Recaptured all four required sizes and the work panel. Controls remained visible while reading long contributions. Browser Back restored Work after switching to Research; Escape closed and restored focus to Work.

- Major: panel-to-panel history needed individual entries. Resolved with grouped history depth so Back restores each previous section and close returns to the habitat.
- Minor: mobile motion placement still overlapped the dock near the initial view. Moved the control onto the sky area of the scene.
- Minor: evidence links needed stronger text surfaces. Added opaque pale glass plates and full 44px targets.

## Iteration 03 — Readability and mobile polish

Inspected all four sizes again, including mobile research and the expanded authored contribution log. Scene controls, mobile route tiles and the dock no longer collided. All 11 authored PRs appeared with distinct status labels.

- Major: native fragment navigation could leave initial focus on the body after opening a hash-linked dialog. Added a post-navigation focus correction and reset panel content scroll on section switches. Direct entries and reloads now focus Close inside the dialog.
- Capture issue: the browser tool’s full-page images showed scaling and stitching artifacts, despite correct viewport renders and DOM geometry. Earlier raw captures are retained as the iteration record; iteration 04 replaces final full-page evidence with composites made from overlapping unmodified viewport captures.

## Iteration 04 — Final verification

Full pages and opening viewports saved for every required size. The composites remove repeated fixed-dock overlays between viewport frames; the separate opening-viewport captures preserve the actual dock presentation. All four complete pages were visually inspected.

| Check | Result |
| --- | --- |
| Horizontal overflow at 390, 768, 1024, 1440 | None |
| Compact desktop work panel | 880 × 696, inside 1024 × 768; header and footer remain visible |
| Controls | At least 44 × 44 at settled layout; mobile audit found no undersized controls |
| Dock destinations | Work, Research, Purdue, About, Contact pass |
| Landmarks | All four open their corresponding states |
| Close paths | Close, minimize, Escape, backdrop pass |
| Focus | Close receives initial focus; Tab/Shift+Tab wrap; initiating control receives focus after close |
| Deep links | All five required hashes pass; direct-load focus regression fixed |
| History | Back/Forward restores Work/Research; grouped close returns to habitat |
| Mobile reading | Vertical sections, direct hashes and dock anchors pass without dialogs |
| Contribution log | Native disclosure expands all 11 authored PRs |
| Reduced motion | Chrome DevTools emulated prefers-reduced-motion: reduce; matching CSS and environment-still class observed; scene and Work panel remain complete |
| Manual motion control | Bubble and water animations report paused; resume works |
| Primary HTML | Identity, all sections, paper and full PR log present before JavaScript enhancement |
| Browser console | No errors or warnings in the clean production-preview browser |
| First-party assets | Every referenced image, script, stylesheet and metadata asset returns HTTP 200; see local-assets.json |
| External evidence | GitHub profile, vLLM search and ACL paper open the correct destination; LinkedIn redirects to its ordinary sign-in wall with the correct profile destination |
| Metadata | Title, description, canonical, original OG image, icons, robots and sitemap verified |

Text contrast checks: primary 11.56:1; secondary 7.12:1; hover link 4.75:1; open 6.31:1; merged 6.81:1; closed 6.95:1; availability 6.88:1. Navy text and pale plates were inspected over the scene at every size. All tested text pairs exceed WCAG AA normal-text contrast.

Lint, strict type checking, production build and all five content/export tests passed at each stable checkpoint. The development-only GitHub refresh completed without a token. Dependency audit reported zero vulnerabilities.

## Remaining findings

Critical: none. Major: none. Minor product issues: none known. LinkedIn may require sign-in; this is external platform behavior.
