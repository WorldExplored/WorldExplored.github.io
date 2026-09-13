# Srreyansh Sethi

Personal portfolio: [worldexplored.github.io](https://worldexplored.github.io).

## Development

Use Node 24 or newer. Run `npm ci`, then `npm run dev`.
Run `npm run check` for lint, strict TypeScript and production export, followed by `npm test` for content and export checks. Preview the export with `npm start`.

## Content

Edit `src/content/profile.ts` for copy, links, featured work, contribution status, sections and availability. Add a `profile.additions` entry under an existing section for a future project, publication, or affiliation. Set `showAvailability` to false to remove the availability statement. `npm run sync:github` refreshes public contribution metadata without requiring a token; review its diff and rerun checks before committing.

## Deployment

GitHub Actions builds and deploys `out/` to the root GitHub Pages site. No server or custom domain is required. To add a domain later, update `siteUrl`, canonical metadata, robots and sitemap alongside GitHub Pages settings. Do not add a repository-name base path to this root user site.

## Design and QA

`design-system/srreyansh-sethi/MASTER.md` records the visual system. `docs/research/` documents the reference analysis and behavior. `docs/qa/ITERATION_LOG.md` records viewport evidence and refinement. The landscape is original; no assets from the visual reference sites are reused.

The MIT-licensed scaffold's button and class utilities are retained. See `LICENSE` for the original notice.
