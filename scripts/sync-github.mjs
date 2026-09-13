import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../src/content/profile.ts', import.meta.url);
const source = await readFile(path, 'utf8');
async function get(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}; snapshot was not changed.`);
  return response.json();
}
function normalize(item) {
  return { number: item.number, title: item.title.trim(), url: item.html_url, status: item.merged_at || item.pull_request?.merged_at ? 'Merged' : item.state === 'open' ? 'Open' : 'Closed without merge', author: item.user.login };
}
const results = [];
for (let page = 1; ; page += 1) {
  const data = await get(`https://api.github.com/search/issues?q=repo%3Avllm-project%2Fvllm+is%3Apr+author%3AWorldExplored&per_page=100&page=${page}`);
  if (data.incomplete_results || data.total_count > 1000) throw new Error('Search completeness cannot be verified; snapshot was not changed.');
  results.push(...data.items);
  if (results.length >= data.total_count) break;
}
const current = JSON.parse(source.match(/export const featured: FeaturedContribution\[\] = ([\s\S]*?);\n\/\/ END/)[1]);
const featured = await Promise.all(current.map(async entry => ({ ...entry, ...normalize(await get(`https://api.github.com/repos/vllm-project/vllm/pulls/${entry.number}`)) })));
const contributions = results.map(normalize).sort((a, b) => b.number - a.number);
const snapshot = `// BEGIN GITHUB SNAPSHOT\nexport const contributions: Contribution[] = ${JSON.stringify(contributions, null, 2)};\nexport const featured: FeaturedContribution[] = ${JSON.stringify(featured, null, 2)};\n// END GITHUB SNAPSHOT`;
const updated = source.replace(/\/\/ BEGIN GITHUB SNAPSHOT[\s\S]*?\/\/ END GITHUB SNAPSHOT/, snapshot).replace(/lastVerified: '[^']*'/, `lastVerified: '${new Date().toISOString().slice(0, 10)}'`);
await writeFile(path, updated);
console.log(`Verified ${contributions.length} authored PRs and ${featured.length} featured contributions. Review the diff before publishing.`);
