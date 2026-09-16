# Soundtrack sources and verification

Reviewed 16 September 2026. The playlist streams five original recordings by Scott Buckley from the creator's own server. No audio is bundled, rehosted, ripped from video, or accessed through an embedded video player.

| Track and creator license evidence | Atmosphere | Creator-hosted MP3 |
| --- | --- | --- |
| [Firefly](https://www.scottbuckley.com.au/library/firefly/) | Optimistic piano and synth pop | [MP3](https://www.scottbuckley.com.au/wp-content/audio/sb_firefly.mp3) |
| [Reparateur](https://www.scottbuckley.com.au/library/reparateur/) | Bright, dreamy synths | [MP3](https://www.scottbuckley.com.au/wp-content/audio/sb_reparateur.mp3) |
| [Electric Dreams](https://www.scottbuckley.com.au/library/electric-dreams/) | Warm nostalgic synthwave | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2020/09/sb_electricdreams.mp3) |
| [Meanwhile](https://www.scottbuckley.com.au/library/meanwhile/) | Floating piano and atmospheric synth | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2025/01/Meanwhile.mp3) |
| [Hymn to the Dawn](https://www.scottbuckley.com.au/library/hymn-to-the-dawn/) | Quiet, warm synths and strings | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2022/11/HymnToTheDawn.mp3) |

Each creator page publishes the linked download and explicitly permits use under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) with credit. The player visibly identifies the current title, links its creator-published source, credits [Scott Buckley](https://www.scottbuckley.com.au/), and links the license. Tracks are unchanged; playback volume envelopes are applied locally. This soundtrack accompanies the interactive portfolio, following the creator's [usage guidance](https://www.scottbuckley.com.au/library/using-this-music/). YouTube embedding metadata is not license evidence and is no longer part of the data model.

## Delivery evidence

All five MP3 endpoints returned HTTP 200, `Content-Type: audio/mpeg`, and `Accept-Ranges: bytes` during HEAD requests carrying `Origin: https://worldexplored.github.io`. Full headers and timestamps are recorded in `audio-source-evidence.json`. The creator source pages and their MP3 links were inspected separately. Content lengths range from 5.9 to 16.7 MB; only the selected track is requested, after activation.

The responses contain no `Access-Control-Allow-Origin`. This is compatible with ordinary native HTML audio because the element deliberately omits `crossorigin`. The player neither fetches decoded bytes nor connects the media to Web Audio. See the [HTML media CORS setting](https://html.spec.whatwg.org/multipage/media.html#attr-media-crossorigin) and [documented default no-CORS behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin). Header checks establish delivery availability, not a guarantee that every browser or network will play the files. Integrated and deployed browser playback must be recorded in the final QA report.

## Playback behavior

Initial markup has `preload="none"`, no source, and no autoplay. The first intentional Play shuffles a complete sequence and calls native play synchronously inside that gesture. Natural completion advances continuously and wraps without consecutive repeats. Previous and Next follow the same order and preserve the paused state. A 220 ms fade-out and 420 ms fade-in soften manual changes; natural transitions fade in. Reduced-motion preference removes these timed transitions and visual button transitions.

Volume and mute persist under `portfolio-audio-preferences-v1`. Storage failure does not prevent playback. Close unloads the media without erasing preferences and restores button focus; hiding the tab pauses playback. A load or buffering stall is bounded at 20 seconds. Failed tracks are skipped once for that session; exhausting available alternatives exposes Retry, which clears the failed set only when the user activates it. Autoplay-policy rejection returns Ready without trying other tracks. A sole surviving track is not automatically repeated consecutively.

The existing glass control retains 44 px buttons. Previous, Next, a 44 px-high volume slider, current title and attribution sit in the expanded 288 px surface. All displayed copy and track metadata are editable in `src/content/audio.ts`.

## Automated verification

Seven focused tests cover silent initial rendering, creator/license metadata, shuffle coverage, continuous progression, previous/next, no consecutive repeats, fades and reduced motion, bounded unavailable-track fallback, all-failed retry, stalled loads, stale rejection cancellation, and persistent preferences. These controller tests use a deterministic native-media substitute; they do not replace real browser listening and playback checks.
