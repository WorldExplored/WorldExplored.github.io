# Optional music review

Reviewed 14 September 2026. No music files were downloaded or rehosted.

## Source and permission

The selected track is **Firefly — Scott Buckley**, published in the creator's library in 2013. The creator describes a light, optimistic arrangement of piano, synths and drums; that description fits this site's bright direction better than the more melancholy orchestral candidate Horizons. This is an editorial assessment based on the creator's description, not a claim of listening verification.

- [Creator's track and license page](https://www.scottbuckley.com.au/library/firefly/) explicitly grants use under CC BY 4.0 with attribution.
- [Creator's official YouTube upload](https://www.youtube.com/watch?v=PiPyx9sBCi8) is credited to Scott Buckley's verified channel and independently supplies the CC BY 4.0 attribution instruction.
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) requires creator credit, a license link and a notice of modifications when applicable. The control links the unmodified source track, creator and license.
- [Horizons](https://www.scottbuckley.com.au/library/horizons/) also has clear CC BY 4.0 permission, but its creator describes a darker emotional character. It was not selected.

The public YouTube oEmbed endpoint returned HTTP 200 with the matching title and creator. Both the normal and privacy-enhanced embed HTML returned HTTP 200 and contained `videoFlags.playableInEmbed: true` and `previewPlayabilityStatus.status: "OK"`, also with `playableInEmbed: true`. These observations establish the current embed permission signal; they do not guarantee that every region or browser will allow playback. The selected fields are recorded in `audio-source-evidence.json`; no full player response or visitor identifiers are stored.

## Player constraints

[YouTube's IFrame API](https://developers.google.com/youtube/iframe_api_reference#Requirements) requires at least a 200 × 200 player viewport. [YouTube's developer policies](https://developers.google.com/youtube/terms/developer-policies#iii.-youtube-api-services) prohibit playback through a player hidden from the viewed page or tab. [Required functionality](https://developers.google.com/youtube/terms/required-minimum-functionality#overlays-and-frames) also prohibits covering the embedded player. A tiny audio-only iframe would not satisfy those requirements.

The implementation begins with a 44 px high glossy Play music button. Intentional activation reveals a player whose viewport is at least 200 × 200, normally 304 × 200, with controls and credit outside it. Playback begins only after that action; if the browser blocks delayed programmatic playback, the compact control returns to Ready and another Play action works through the supported API. The initial volume is 25%. No video, thumbnail or API script is requested before activation.

The player stays visible while playing. Closing destroys it and restores focus to Play music. A hidden browser tab or a player with less than half its surface visible pauses playback. Play, Pause, Mute and the current state remain available in the compact controls; the visible YouTube controls remain usable too. A one-second check synchronizes mute and playback state when the visitor uses YouTube's controls. An unavailable player exposes a concise status and retains the source link.

## Integration

- Import the named `AudioControl` from `src/components/AudioControl.tsx`.
- Import `src/components/AudioControl.css` in the application stylesheet entry or layout. The component does not import global CSS itself.
- Render `<AudioControl />` once, in a fixed or sticky corner with enough clear space for the revealed 328 px wide surface. Parent layout owns positioning and stacking order.
- The exported CSS namespace is `.audio-control` and its `__` child classes. Set `className="audio-control--above"` when the revealed player should open above the button, such as next to a bottom dock. The default expands downward.
- Do not clip the component, cover its iframe, or put it beneath another panel while it is playing. Test the expanded state at every supported viewport.
- Source, credit, UI labels, permission evidence and verification date live in `src/content/audio.ts`. Setting `audio.source = null` renders nothing and requests nothing. A replacement must include track-specific reuse permission and matching embed evidence.

## Verification and limits

`scripts/audio.test.tsx` checks silent initial HTML, a null source, matching permission/source identifiers, safe embedding URLs with autoplay disabled, actual-origin binding and truthful playback state mapping. Run it with `node --import tsx --test scripts/audio.test.tsx`; the parent should add it to the existing test command during integration.

Browser inventory was empty for this component task; native Chrome was reserved for the parent task. Source metadata and embed flags were verified through public endpoints, but audible playback, visible player sizing, API Play/Pause/Mute, close cleanup and responsive positioning require the parent's integrated browser pass. Do not describe those browser interactions as tested until that pass is complete.
