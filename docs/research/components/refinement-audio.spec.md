# Optional audio control

Investigate fitting Frutiger Aero music on YouTube with primary-source licensing and embedding evidence. No ripping, downloads or rehosting. An official creator source must establish CC/reuse permission, and the uploader must allow embedding. Scott Buckley's library is generally CC BY 4.0; Horizons has a specific license page but mood and YouTube availability need assessment. Do not infer embedding permission merely from a watch URL.

If verified, implement AudioControl.tsx and content/audio.ts with compact intentional Play/Pause/Mute and current state, source/creator/license attribution. Obey YouTube's documented minimum player dimensions and never run a hidden audio-only YouTube player. A modest revealed player when intentionally activated is acceptable only if unobtrusive; discuss integration constraints in notes. No autoplay, downloads, arbitrary media assets, third-party requests before activation, or extra modes.

If no suitable source and compliant compact presentation can be verified, leave a typed source-null ready component that renders nothing until approved; document the exact missing evidence. Never fabricate license or embedding approval. Keep CSS limited to exported class names and a separate optional audio stylesheet, if necessary. Parent owns globals and integration.

Read repo AGENTS and full current request (provided in task message). Run typecheck, include meaningful state tests if adding behavior, and commit only audio component/config/spec/notes. Report source and verification truthfully.
