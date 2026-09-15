# Rendering and art-direction correction

Starting revision: 5225b9a. Baseline desktop/mobile captures and 16-image contact sheet are temporary workspace artifacts; no reference photographs are copied into public assets.

## Reference comparison

Searches covered Frutiger Aero; Vista Aero promotional imagery; Windows 7 nature/technology; Web 2.0 gloss; mid-2000s eco-technology; meadow/water/bubbles/glass/skyline. The board includes recent interpretations and archival interface/advertising examples, not a claim that every image is an official Microsoft advertisement.

Recurring visual decisions: a single broad landscape rather than separate islands; vivid green ground and cyan water below coherent blue sky; sharply lit white cumulus; smooth white/glass technology; selective transparent wet forms and daisies. The old baseline instead had broad teal water, gray flattened cloud puffs, scattered tiny islands, huge Purdue pavilion, and grass emerging through bases. The new layout removes the conventional header and unequal dock. Source Sans 3 remains the licensed humanist font. Readable surfaces use crisp rims and pale opaque interiors, not frosted blur.

Useful reference sources: https://cari.institute/aesthetics/frutiger-aero ; https://www.are.na/block/13413569 ; https://wall.alphacoders.com/big.php?i=225617 ; https://smartcube.ru/page/power-mac-g4-cube/ ; https://www.clker.com/clipart-perfect-web-20.html . Full image URLs and downloaded study images remain in the external workspace manifest.

## Identified rendering mechanisms

The installed Fiber 9.7.0 configure implementation defaults missing dpr to [1,2], shadows to false, and frameloop to always. WorldCanvas called configure with partial objects on ResizeObserver notifications and every props/tier update. QualityController separately called setDpr using performance regression. A partial configure therefore undid the selected DPR, resizing and clearing the drawing buffer; frame-loop defaults also conflicted with demand/never. The opaque alpha:false buffer exposed black when cleared before a new frame.

QualityController also had a priority-1 useFrame callback manually rendering the scene, taking screen rendering away from Fiber. The environment cleanup effect disposed all grouped resources whenever any one changed, including resources still retained across some quality transitions. Architecture and water recreated resources unnecessarily. These were concrete invalidation/ownership defects; they do not prove every flash observed on every machine had a single trigger.

Fix: configure once; keep the renderer and scene mounted; update actual dimensions with setSize; update DPR only when changed; use Fiber's normal rendering rather than a priority takeover; no whole-scene null Suspense; keep resources owned until unmount. The context permits alpha, while host, renderer clear color and scene background use the sky color. A discarded transparent drawing buffer exposes sky. Visibility controls stop/resume only the frame loop. Content surfaces do not stop world input.

## Development capture

Only ?diagnostics exposes counters; ?diagnostics&stress cycles quality every 12 scene seconds through a bounded six-step sequence. After actual Fiber frames, a 12×8 drawing-buffer grid is sampled at most every 180ms. An opaque near-black fraction above 80% is a failing frame. Counters include renderer creation/configuration, resize, DPR, quality, frame-loop, context loss/restoration, scene errors and unhandled errors. This supplements actual viewport screenshots; it is not a visual-quality score. There is no logging or capture in ordinary visits.

Development effect replay also exposed duplicate root allocation. Allocation is scheduled one animation frame later and cancelled by replay cleanup before a root exists. A fresh development load verified one root. See the final QA log for browser coverage and remaining testing limits.
