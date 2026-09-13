import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { profile, contributions, featured } from '../src/content/profile.ts';

test('featured contributions preserve verified status and co-development', () => {
  assert.equal(featured.length, 5);
  assert.deepEqual(featured.map(item => item.number), [50096, 40193, 26468, 27516, 28443]);
  assert.equal(featured.find(item => item.number === 26468).attribution, 'co-developed');
  for (const item of featured) {
    assert.ok(item.problem && item.contribution && item.tags.length);
    assert.equal(item.url, `https://github.com/vllm-project/vllm/pull/${item.number}`);
  }
});
test('authored log is complete, distinct and accurately attributed', () => {
  assert.equal(new Set(contributions.map(item => item.number)).size, contributions.length);
  assert.ok(contributions.every(item => item.author === 'WorldExplored'));
  assert.ok(!contributions.some(item => item.number === 26468));
  for (const item of contributions) assert.ok(['Open', 'Merged', 'Closed without merge'].includes(item.status));
});
test('all content states have stable identifiers and availability is one flag', () => {
  assert.deepEqual(profile.sections.filter(item => item.dock).map(item => item.id), ['work', 'research', 'purdue', 'about', 'contact']);
  assert.equal(typeof profile.showAvailability, 'boolean');
  assert.equal(profile.building, 'Something new is taking shape. Details later.');
});
test('static HTML contains identity, evidence, sections and contribution log', async () => {
  const html = await readFile(new URL('../out/index.html', import.meta.url), 'utf8');
  for (const required of [profile.name, profile.university, profile.degree, profile.research.title, 'co-developed']) assert.ok(html.includes(required), required);
  for (const section of profile.sections) assert.ok(html.includes(`id="${section.id}"`));
  for (const item of contributions) assert.ok(html.includes(item.url));
  assert.ok(html.includes('<details'));
  assert.ok(html.includes('<link rel="canonical" href="https://worldexplored.github.io/"'));
});
test('export contains no local paths, credentials or visitor API requests', async () => {
  const root = new URL('../out/', import.meta.url);
  const forbidden = /\/Users\/|gho_[A-Za-z0-9]|api\.github\.com/i;
  for (const entry of await readdir(root, { recursive: true })) {
    if (!/\.(html|txt|js|json|xml)$/.test(entry)) continue;
    const text = await readFile(new URL(entry, root), 'utf8');
    assert.equal(forbidden.test(text), false, entry);
  }
});
