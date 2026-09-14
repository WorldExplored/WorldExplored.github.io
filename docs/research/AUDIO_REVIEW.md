# Music source and verification

Reviewed 14 September 2026. The track is **Firefly — Scott Buckley**. The creator describes piano, synths and light drums suited to a bright setting. The browser playback test verified loading and advancing media time; it was not a listening assessment.

## Permission and provenance

- [Creator's track page](https://www.scottbuckley.com.au/library/firefly/) supplies the official MP3 and explicitly licenses the work under CC BY 4.0 with attribution.
- [Creator's usage page](https://www.scottbuckley.com.au/library/using-this-music/) covers the published MP3 library and requires credit. This use accompanies the interactive visual portfolio; it is not a standalone music service or redistribution to a streaming platform.
- [Official YouTube upload](https://www.youtube.com/watch?v=PiPyx9sBCi8) identifies the same creator and track. Its oEmbed response matched, and public player metadata permitted embedding. Recorded fields remain in `audio-source-evidence.json`.
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) is linked beside the creator and track source. The track is unmodified.

The integrated YouTube embed remained blank in the available browser. Native HTML audio now streams the official file directly from the creator's website. No track was ripped from YouTube, downloaded into the repository, or rehosted. The verified endpoint returned HTTP 200, `audio/mpeg`, byte-range support and Content-Length 5912941.

## Interface

One compact Play control is present initially, with an audio element that has `preload="none"` and no source. Intentional Play sets the approved URL and calls native playback at 25% volume. Active controls provide Play/Pause, Mute/Unmute, current state and Close. A small credit surface links the creator's track page, creator, license and YouTube upload. There is no video panel or iframe.

Closing pauses playback, clears the source and restores focus. A hidden tab pauses. A 20-second loading bound exposes Unavailable if the remote source cannot play; browser autoplay rejection returns Ready. A null or invalid configured source renders no control.

## Verification

The four audio tests check silent initial output with no source/autoplay, null or mismatched source rejection, creator/track/license/evidence agreement, and a secure creator-hosted playback URL.

Integrated browser checks at 390 × 844: intentional Play reached Playing; native readyState was 4; media time advanced; duration was 157.356 seconds. Mute set the media flag and status, Pause stopped at 15.10 seconds, Unmute/Play resumed, and Close left a null source, paused media and focus on Play music. The control and credits fit the viewport. Playback remains dependent on the creator's hosting and browser media support.
