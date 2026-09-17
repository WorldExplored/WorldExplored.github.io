import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { profile, contributions, featured, publicContributions } from '../src/content/profile.ts';
import { world } from '../src/content/world.ts';

const html = await readFile(new URL('../out/index.html', import.meta.url), 'utf8');
const semanticHtml = html.replace(/<(script|style|template|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
const bodyHtml = semanticHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';

function decodeEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    return String.fromCodePoint(Number.parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10));
  });
}

function plainText(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attributes(source) {
  return Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g), match => [match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')]));
}

function anchors(source) {
  return Array.from(source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi), match => ({ ...attributes(match[1]), text: plainText(match[2]) }));
}

function sectionBody(id) {
  const section = bodyHtml.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/section>`, 'i'));
  assert.ok(section, `Semantic section ${id} is present without scripts or canvas.`);
  return section[1];
}

function containsText(source, expected) {
  assert.ok(plainText(source).includes(expected.replace(/\s+/g, ' ').trim()), expected);
}

test('featured contributions preserve verified status and co-development', () => {
  assert.equal(featured.length, 5);
  assert.deepEqual(featured.map(item => item.number), [50096, 40193, 26468, 27516, 28443]);
  assert.deepEqual(featured.map(item => item.status), ['Open', 'Merged', 'Merged', 'Merged', 'Merged']);
  assert.equal(featured.find(item => item.number === 26468).attribution, 'co-developed');
  for (const item of featured) {
    assert.ok(item.problem && item.contribution && item.tags.length);
    assert.equal(item.url, `https://github.com/vllm-project/vllm/pull/${item.number}`);
  }
});

test('authored source snapshot is complete, distinct and accurately attributed', () => {
  assert.equal(new Set(contributions.map(item => item.number)).size, contributions.length);
  assert.ok(contributions.every(item => item.author === 'WorldExplored'));
  assert.ok(!contributions.some(item => item.number === 26468));
  for (const item of contributions) assert.ok(['Open', 'Merged', 'Closed without merge'].includes(item.status));
  assert.equal(contributions.length, 11);
  assert.ok(publicContributions.every(item => item.status === 'Merged' || item.status === 'Open'));
});

test('all content states have stable identifiers and availability is one flag', () => {
  assert.deepEqual(profile.sections.map(item => item.id), ['work', 'experience', 'research', 'purdue', 'history', 'about', 'contact', 'building']);
  assert.deepEqual(profile.sections.filter(item => item.dock).map(item => item.id), ['work', 'experience', 'research', 'purdue', 'history', 'about', 'contact']);
  assert.equal(typeof profile.showAvailability, 'boolean');
  assert.equal(profile.building, 'Building something impactful...');
});

test('static HTML contains identity, evidence and canonical sections', () => {
  assert.ok(bodyHtml, 'The exported document has a semantic body.');
  assert.match(bodyHtml, /<main\b/);
  const heading=bodyHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  assert.equal(heading?.replace(/<[^>]+>/g, ''), profile.name);
  for (const required of [profile.name, profile.university, profile.degree, ...profile.research.map(item => item.title), 'co-developed']) containsText(bodyHtml, required);
  for (const section of profile.sections) sectionBody(section.id);
  for (const item of publicContributions) assert.ok(anchors(sectionBody('work')).some(link => link.href === item.url), item.url);
  assert.ok(!bodyHtml.includes('<dialog'));
  assert.ok(!bodyHtml.includes('habitat.webp'));
  assert.ok(!sectionBody('work').includes('<details'));
  const canonical = Array.from(semanticHtml.matchAll(/<link\b([^>]*)>/gi), match => attributes(match[1])).find(link => link.rel === 'canonical');
  assert.equal(canonical?.href, 'https://worldexplored.github.io/');
});

test('essential portfolio content is rendered in semantic sections without WebGL or scripts', () => {
  for (const item of featured) {
    for (const value of [item.heading, item.problem, item.contribution, item.status]) containsText(sectionBody('work'), value);
  }
  for (const item of profile.experience) for (const value of [item.company, item.role, item.dates, item.location, ...item.details]) containsText(sectionBody('experience'), value);
  for (const item of profile.research) for (const value of [item.title, item.venue, item.attribution, item.description, item.role]) containsText(sectionBody('research'), value);
  for (const value of [profile.university, profile.degree, profile.graduation]) containsText(sectionBody('purdue'), value);
  for (const item of profile.history) for (const value of [item.organization, item.role, item.school, item.dates, item.description].filter(Boolean)) containsText(sectionBody('history'), value);
  containsText(sectionBody('about'), profile.about);
  if (profile.showAvailability) containsText(sectionBody('contact'), profile.availability);
  for (const href of [profile.links.email, profile.links.github, profile.links.linkedin]) assert.ok(anchors(sectionBody('contact')).some(link => link.href === href));
  containsText(sectionBody('building'), profile.building);
});

test('one whole-card collection contains only open or merged work, with no repeated PR links', () => {
  const links = anchors(sectionBody('work'));
  assert.equal(links.length, publicContributions.length);
  assert.equal(new Set(links.map(link => link.href)).size, publicContributions.length);
  for (const item of publicContributions) {
    const link = links.find(link => link.href === item.url);
    assert.ok(link.class.includes('contribution-card'));
    containsText(link.text, item.heading);
    containsText(link.text, item.problem);
    containsText(link.text, item.contribution);
  }
  assert.doesNotMatch(plainText(bodyHtml), /Closed without merge/);
  for (const item of contributions.filter(item => item.status === 'Closed without merge')) assert.ok(!links.some(link => link.href === item.url));
});

test('every spatial landmark has one matching semantic link and destination section', () => {
  const controls = anchors(bodyHtml).filter(link => link['data-landmark']);
  assert.equal(world.landmarks.length, 8);
  assert.equal(controls.length, 8);
  assert.deepEqual(new Set(controls.map(link => link['data-landmark'])), new Set(world.landmarks.map(item => item.id)));
  for (const landmark of world.landmarks) {
    const control = controls.find(link => link['data-landmark'] === landmark.id);
    assert.equal(control.href, `#${landmark.id}`);
    assert.ok(control.text || control['aria-label']);
    sectionBody(landmark.id);
  }
});

test('the unannounced-project teaser appears once in rendered HTML', () => {
  assert.equal(plainText(sectionBody('building')).split(profile.building).length - 1, 1);
});

test('experience and history preserve stated chronology without invented organizations or outcomes', () => {
  assert.deepEqual(profile.experience.map(item => item.company), ['Zero-True', 'Equiwiz']);
  assert.deepEqual(profile.history.map(item => item.organization), ['Computer Science Club', 'High School Artificial Intelligence Club', 'Game Development Club']);
  assert.equal(profile.history.length, 3);
  assert.equal(profile.history[2].dates, '');
  assert.equal(profile.history[2].description, '');
  for (const milestone of ['Open-source ML systems work', 'Purdue University', 'Ukrainian Resilience', 'AI Reinforcement Learning Traffic System Implementations and Limitations', 'Zero-True internship', 'Equiwiz internship']) {
    assert.ok(profile.historyMilestones.some(item => item.title === milestone), milestone);
  }
  for (const item of profile.historyMilestones) for (const value of [item.date, item.title, item.description]) containsText(sectionBody('history'), value);
  assert.match(plainText(sectionBody('history')), /Python maze navigation/);
  assert.match(plainText(sectionBody('history')), /hackathons/);
  assert.match(profile.research[1].description, /Ninety-nine simulation runs/);
  assert.match(profile.research[1].limitations, /real traffic data/);
  assert.doesNotMatch(plainText(sectionBody('experience')), /increased|improved|reduced|percent|%/i);
  assert.doesNotMatch(plainText(sectionBody('history')), /oversaw|spearheaded|led a team|increased|improved|percent|%/i);
});

test('external destinations use HTTPS and new tabs have safe rel attributes', () => {
  const base = new URL(profile.siteUrl);
  const authoredUrls = [...Object.values(profile.links), ...contributions.map(item => item.url), ...featured.map(item => item.url), ...profile.additions.flatMap(item => item.url ? [item.url] : [])];
  for (const href of authoredUrls) {
    const url = new URL(href);
    if (href === profile.links.email) { assert.equal(href, 'mailto:sethi64@purdue.edu'); continue; }
    assert.equal(url.protocol, 'https:', href);
    assert.ok(url.hostname && !url.username && !url.password, href);
  }
  for (const link of anchors(bodyHtml)) {
    assert.ok(link.href, 'Every semantic anchor has a destination.');
    const url = new URL(link.href, base);
    if (link.href === profile.links.email) { assert.equal(url.protocol, 'mailto:'); continue; }
    if (url.origin !== base.origin) {
      assert.equal(url.protocol, 'https:', link.href);
      assert.ok(url.hostname && !url.username && !url.password, link.href);
    }
    if (link.target === '_blank') {
      const rel = new Set((link.rel ?? '').toLowerCase().split(/\s+/));
      assert.ok(rel.has('noopener') && rel.has('noreferrer'), link.href);
    }
  }
});

test('profile and visible copy exclude retired vague phrases', () => {
  const retired = [
    'Working where performance meets correctness.',
    'A small world of systems & ideas.',
    'Choose a landmark. Follow a curiosity.',
    'A closer look at the work.',
    'Performance and correctness, together.',
    'Curiosity, with room to grow.',
  ];
  const sources = [JSON.stringify(profile).toLowerCase(), plainText(bodyHtml).toLowerCase()];
  for (const source of sources) {
    for (const phrase of retired) assert.ok(!source.includes(phrase.toLowerCase()), phrase);
    assert.doesNotMatch(source, /\b(?:passionate|innovative|cutting-edge|leveraging|seamless|robust|revolutionary|exploring the intersection|building the future)\b/i);
  }
});

test('export contains no local paths, credentials or visitor API requests', async () => {
  const root = new URL('../out/', import.meta.url);
  const forbidden = /\/Users\/|(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]|api\.github\.com/i;
  for (const entry of await readdir(root, { recursive: true })) {
    if (!/\.(html|txt|js|json|xml|svg|css|map)$/.test(entry)) continue;
    const text = await readFile(new URL(entry, root), 'utf8');
    assert.equal(forbidden.test(text), false, entry);
  }
});

test('canonical sections avoid duplicate presentations and unrelated links', () => {
  assert.doesNotMatch(plainText(bodyHtml), /Verified|Back to world|How I work/);
  assert.equal((bodyHtml.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(bodyHtml, /<header\b|surface-attachment/);
  for (const section of profile.sections) assert.equal((bodyHtml.match(new RegExp(`id="${section.id}"`, 'g')) ?? []).length, 1);
  assert.equal(anchors(sectionBody('research')).filter(link => profile.research.some(item => item.url === link.href)).length, 2);
  assert.equal(anchors(sectionBody('contact')).length, 3);
  assert.ok(!anchors(sectionBody('contact')).some(link => link.href === profile.links.paper));
  assert.doesNotMatch(plainText(bodyHtml), /Pause motion|Still view|Guided view|Free Explore|Minimize|Aero Research Habitat|Click the water|Drag a bubble|field guide/i);
});
