# Content and world QA

These captures document the September 16, 2026 content and world refinement pass. Local images were produced from the optimized production export before deployment.

- `deployed-before-1920x1080.jpg` — the deployed `84fb3f9` baseline with five dock destinations and the sparse landscape.
- `overview-1920x1080.jpg` — the matching local overview with seven dock destinations, two new landmarks, denser planting, ecological shoreline detail, and a fuller city.
- `overview-1440x900.jpg`, `overview-1024x768.jpg`, `overview-768x1024.jpg`, and `overview-390x844.jpg` — the required responsive overview matrix.
- `experience-panel-1440x900.jpg` and `experience-building-1440x900.jpg` — the two-internship timeline, distinct work areas, furniture visible through glazing, roof planting, graded approach, and surrounding vegetation.
- `history-panel-1440x900.jpg` and `history-mobile-390x844.jpg` — the museum, planted roof and atrium, visible stairs and exhibit furniture, complete chronology, and responsive sheet.
- `research-direct-hash-1024x768.jpg` — direct-hash navigation to the two canonical publication records and linked titles.
- `music-controls-1024x768.jpg` — user-initiated playback controls, track title, creator attribution, and CC BY 4.0 link.
- `before-overview.jpg`, `overview-desktop.jpg`, `experience-desktop.jpg`, `history-mobile.jpg`, and `research-desktop.jpg` — earlier captures from the same implementation pass retained for comparison.

The measured viewport checks were 1920 × 1080, 1440 × 900, 1024 × 768, 768 × 1024, and 390 × 844. The 390-pixel dock had no horizontal overflow and every destination measured 49 × 62 pixels. Navigation was exercised through the dock, keyboard Enter, the in-world History landmark, and a direct `#research` URL. Panel close returned to the overview.

The local 1440 × 900 scene ran continuously for 255.91 seconds and 2,323 diagnostic samples. The audit reported one renderer creation, zero scene errors, zero unhandled errors, zero WebGL context losses, zero black frames, and a zero worst-black-frame fraction. The transport check started playback only after a user gesture, moved from Origami to A New Year, exposed previous, next, pause, mute, volume, creator, and license controls, and was paused after inspection.
