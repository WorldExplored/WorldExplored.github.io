# Portfolio conventions
Before changes, inspect git status, git diff and git diff --staged. Preserve unrelated work. Read relevant installed Next.js guides under node_modules/next/dist/docs before framework changes.

Use Next.js static export, React 19, TypeScript strict and Tailwind 4. Named component exports, 2-space indentation, semantic HTML and CSS classes. Keep all editable copy, links, statuses and section configuration in src/content/profile.ts. Follow design-system/srreyansh-sethi/MASTER.md.

Run npm run check and npm test. Verify changed navigation and responsive behavior in a browser. Publish only the out directory through GitHub Pages. No runtime service, visitor GitHub requests or paid hosting. Preserve LICENSE for reused scaffold utilities.
