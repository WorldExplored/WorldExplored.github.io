# Facts and assets

Verified 2026-09-13 against public sources.

- [Public profile README](https://github.com/WorldExplored/WorldExplored): education, technical focus, research contributions and co-development attribution. Degree and class also supplied directly by Srreyansh.
- [Authored vLLM PR search](https://github.com/vllm-project/vllm/pulls?q=is%3Apr+author%3AWorldExplored): complete snapshot of 11 authored contributions, including 1 open, 3 merged and 7 closed without merge. Public API search returned complete results.
- Featured PR detail endpoints supplied the exact titles, authors and merge state; technical descriptions were checked against their public descriptions. [#50096](https://github.com/vllm-project/vllm/pull/50096) remains open. [#26468](https://github.com/vllm-project/vllm/pull/26468) has a different API author and is explicitly co-developed, outside the authored log. No measured speedup is claimed.
- [ACL Anthology](https://aclanthology.org/2024.findings-emnlp.16/): publication title, venue, author list and study description.
- [LinkedIn](https://www.linkedin.com/in/srreyansh-sethi-762264281/): contact destination supplied by Srreyansh and linked from the public profile. No additional biography inferred.

`src/content/profile.ts` is the editable source. `npm run sync:github` refreshes public PR metadata and date during development only; it was exercised successfully before publication. Review editorial descriptions when a PR changes.

## Original visual assets

The original static illustration was removed during the Aero refinement. The active landscape consists of original procedural geometry and shaders; no reference-site artwork is reused. Historical screenshots remain only as repository QA evidence.

The glossy icon family, document cover, bubbles, favicon and social image are original SVG/CSS compositions. The social image was rasterized to JPEG; the touch icon to PNG. Fonts use the installed system stack.

The retained shadcn button and class utility originate in the MIT-licensed scaffold. The original notice is preserved in `LICENSE`.
